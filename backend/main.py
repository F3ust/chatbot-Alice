import json
import logging
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from file_processor import process_file
from llm import chat, chat_stream, check_health
from models import ChatRequest, ChatResponse, FileUploadResponse
from rag import VectorStore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-5s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("whiterabbit")

app = FastAPI(title="White Rabbit", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - start) * 1000
    log.info("%s %s  %d  %.0fms", request.method, request.url.path, response.status_code, ms)
    return response


sessions: dict[str, dict] = {}

SYSTEM_PROMPT = (
    "Your name is White Rabbit. You are a helpful AI assistant. "
    "When asked who you are, only say you are White Rabbit, a helpful assistant. Do not add company details to your introduction. "
    "Never mention Qwen, LLaMA, or any underlying model. "
    "Answer questions clearly and concisely. "
    "If relevant context from files or a knowledge base is provided, use it to answer. "
    "Otherwise, respond normally."
)

RAG_TOP_K = 5
KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"
_base_store = VectorStore()


async def _load_knowledge():
    if not KNOWLEDGE_DIR.exists():
        log.warning("Knowledge dir not found: %s", KNOWLEDGE_DIR)
        return
    count = 0
    for f in KNOWLEDGE_DIR.glob("*.txt"):
        text = f.read_text(encoding="utf-8")
        if text.strip():
            await _base_store.add(text, f.name)
            count += 1
    log.info("Loaded %d knowledge file(s), %d chunks", count, _base_store.size)


@app.on_event("startup")
async def startup():
    await _load_knowledge()
    log.info("White Rabbit ready")


def _get_or_create_session(session_id: str | None) -> tuple[str, dict]:
    if session_id and session_id in sessions:
        return session_id, sessions[session_id]

    new_id = session_id or str(uuid.uuid4())
    sessions[new_id] = {
        "messages": [],
        "file_names": [],
        "vector_store": VectorStore(),
    }
    log.info("New session: %s", new_id[:8])
    return new_id, sessions[new_id]


async def _build_messages(session: dict, user_message: str) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    file_store: VectorStore = session["vector_store"]
    file_names = session.get("file_names", [])

    if file_store.size > 0:
        try:
            results = await file_store.query(user_message, top_k=RAG_TOP_K)
            relevant = [r for r in results if r.get("score", 0) >= 0.05]

            if not relevant:
                limit = min(file_store.size, RAG_TOP_K)
                relevant = [
                    {"chunk": file_store.chunks[i], "source": file_store.sources[i]}
                    for i in range(limit)
                ]
                log.info("File RAG fallback: %d chunks (no score match)", limit)
            else:
                scores = [r["score"] for r in relevant]
                log.info("File RAG: %d hits, scores=%s", len(relevant), scores)

            context_parts = [f"[{r['source']}]\n{r['chunk']}" for r in relevant]
            context = "\n\n---\n\n".join(context_parts)
            messages.append({
                "role": "system",
                "content": (
                    f"The user uploaded these files: {', '.join(file_names)}. "
                    "Use this content to answer:\n\n" + context
                ),
            })
        except Exception as e:
            log.error("File RAG failed: %s", e)

    if _base_store.size > 0:
        try:
            results = await _base_store.query(user_message, top_k=3)
            relevant = [r for r in results if r.get("score", 0) >= 0.35]

            if relevant:
                scores = [r["score"] for r in relevant]
                log.info("Knowledge RAG: %d hits, scores=%s", len(relevant), scores)
                context = "\n\n".join(r["chunk"] for r in relevant)
                messages.append({
                    "role": "system",
                    "content": "Background knowledge:\n\n" + context,
                })
        except Exception as e:
            log.error("Knowledge RAG failed: %s", e)

    for msg in session["messages"]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})
    return messages


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    session_id, session = _get_or_create_session(request.session_id)
    log.info("Chat [%s]: %s", session_id[:8], request.message[:80])
    messages = await _build_messages(session, request.message)

    try:
        t0 = time.perf_counter()
        response_text = await chat(messages)
        ms = (time.perf_counter() - t0) * 1000
        log.info("LLM responded in %.0fms (%d chars)", ms, len(response_text))
    except Exception as e:
        log.error("LLM error: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    session["messages"].append(
        {"role": "user", "content": request.message, "timestamp": _timestamp()}
    )
    session["messages"].append(
        {"role": "assistant", "content": response_text, "timestamp": _timestamp()}
    )
    return ChatResponse(response=response_text, session_id=session_id)


@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    session_id, session = _get_or_create_session(request.session_id)
    log.info("Stream [%s]: %s", session_id[:8], request.message[:80])
    messages = await _build_messages(session, request.message)

    async def event_generator():
        full_response = ""
        t0 = time.perf_counter()
        try:
            async for chunk in chat_stream(messages):
                full_response += chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"

            ms = (time.perf_counter() - t0) * 1000
            log.info("Stream done in %.0fms (%d chars)", ms, len(full_response))

            session["messages"].append(
                {"role": "user", "content": request.message, "timestamp": _timestamp()}
            )
            session["messages"].append(
                {"role": "assistant", "content": full_response, "timestamp": _timestamp()}
            )
            yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"
        except Exception as e:
            log.error("Stream error: %s", e)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/upload", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile,
    session_id: str | None = Query(None),
):
    allowed = {".pdf", ".txt", ".csv"}
    filename = file.filename or "unknown"
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""

    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported type '{ext}'. Allowed: {', '.join(allowed)}")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File is empty.")

    try:
        text = process_file(filename, content)
    except Exception as e:
        log.error("File processing failed [%s]: %s", filename, e)
        raise HTTPException(status_code=422, detail=f"Processing error: {e}")

    sid, session = _get_or_create_session(session_id)

    t0 = time.perf_counter()
    await session["vector_store"].add(text, filename)
    ms = (time.perf_counter() - t0) * 1000
    session["file_names"].append(filename)
    log.info("Indexed [%s] %s (%d bytes, %d chunks, %.0fms)",
             sid[:8], filename, len(content), session["vector_store"].size, ms)

    preview = text[:500] + ("..." if len(text) > 500 else "")
    return FileUploadResponse(
        filename=filename,
        file_type=ext,
        content_preview=preview,
        session_id=sid,
        message="ok",
    )


@app.get("/api/history/{session_id}")
async def get_history(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    s = sessions[session_id]
    return {"session_id": session_id, "messages": s["messages"], "files": s.get("file_names", [])}


@app.delete("/api/history/{session_id}")
async def clear_history(session_id: str):
    if session_id in sessions:
        del sessions[session_id]
        log.info("Cleared session: %s", session_id[:8])
    return {"status": "cleared"}


@app.get("/api/health")
async def health():
    ollama_ok = await check_health()
    return {"status": "ok", "ollama_connected": ollama_ok}
