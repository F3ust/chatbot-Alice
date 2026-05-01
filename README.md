# White Rabbit

Chat with your files. Upload a PDF, TXT, or CSV, then ask questions. White Rabbit chunks the document, embeds it with FAISS, and feeds relevant pieces to a local LLM.

Everything runs locally. No API keys, no cloud.

## Run it

### Docker (recommended)

```bash
docker compose up --build
```

http://localhost:3000. First boot pulls ~2GB of models.

### Pre-built images

Grab `docker-compose.prod.yml` from this repo. Run:

```bash
docker compose -f docker-compose.prod.yml up
```

Images live at `faust455/white-rabbit-backend` and `faust455/white-rabbit-frontend` on Docker Hub.

### Local dev

You need Python 3.11+, Node 20+, and [Ollama](https://ollama.com/download).

```bash
ollama pull qwen3.5:2b
ollama pull nomic-embed-text

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# second terminal
cd frontend
npm install && npm run dev
```

http://localhost:5173. Vite proxies `/api/*` to port 8000.

---

## Architecture

```
Browser ──POST──▶ FastAPI ──HTTP──▶ Ollama (qwen3.5:2b)
        ◀──SSE───          ◀────────
                   │
                   ▼
            FAISS + nomic-embed-text
```

You send a message. The backend splits uploaded files into 500-char chunks, embeds them with `nomic-embed-text`, and indexes them in FAISS. Each message triggers a similarity search against two stores:

| Store | Source | Threshold |
|-------|--------|-----------|
| File store (per session) | Your uploads | 0.05, falls back to top N chunks |
| Knowledge base (shared) | `backend/knowledge/*.txt` | 0.35 |

File store results take priority. Matched chunks go into the system prompt. Ollama streams the response back as SSE.

| Decision | Chose | Over | Why | Trade-off |
|----------|-------|------|-----|-----------|
| Retrieval | FAISS + nomic-embed-text | TF-IDF cosine | TF-IDF failed on paraphrased and cross-language queries | +274MB model download, +200ms per index call |
| LLM | qwen3.5:2b | 7B+ models | Fits in 2GB RAM, runs on CPU | Weak at multi-file attribution |
| Context | 32K tokens | Smaller window | Retrieval quality matters more for file Q&A | Slower generation on low-RAM machines |
| Sessions | In-memory dicts | SQLite / Redis | No database to configure | Data lost on restart |
| Serving | Nginx | Vite dev server | Handles static files, proxy, SSE, 50MB uploads in one config | Extra build stage in Dockerfile |

---

## API

| Method | Endpoint | What it does |
|--------|----------|-------------|
| POST | `/api/chat/stream` | SSE chat stream |
| POST | `/api/chat` | Non-streaming chat |
| POST | `/api/upload?session_id=` | Index a PDF, TXT, or CSV |
| GET | `/api/history/{session_id}` | Fetch conversation |
| DELETE | `/api/history/{session_id}` | Wipe session |
| GET | `/api/health` | Ollama connectivity check |

---

## Files

```
backend/
  main.py              Routes, sessions, context assembly
  llm.py               Ollama client (sync + streaming)
  rag.py               FAISS indexing and retrieval
  file_processor.py    PDF / TXT / CSV extraction
  models.py            Pydantic schemas
  knowledge/           .txt files loaded at startup
  tests/               pytest (parser + RAG)

frontend/
  src/
    App.tsx            State, streaming, layout
    components/
      ChatMessage.tsx  Markdown message bubble
      ChatInput.tsx    Textarea with Shift+Enter
      FileUpload.tsx   File picker
    services/api.ts    SSE reader, upload, session clear
    types/index.ts     Interfaces

docker-compose.yml       Build from source
docker-compose.prod.yml  Pull from Docker Hub
```

## Config

| Variable | Default | Controls |
|----------|---------|----------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama address |
| `OLLAMA_MODEL` | `qwen3.5:2b` | Which model to chat with |
| `OLLAMA_NUM_CTX` | `32768` | Token context window |

## Tests

```bash
cd backend && python -m pytest tests/ -v
```

12 tests: 8 cover file parsing (TXT, CSV, PDF, edge cases), 4 cover FAISS indexing and retrieval.

## With more time

- **Persistent storage.** FAISS `save_local`/`load_local` + SQLite for history. Sessions would survive restarts.
- **Auth.** Per-user sessions with token-based login. Right now any visitor shares the same pool.
- **Smarter chunking.** Markdown-aware and code-aware splitting instead of fixed 500-char windows.
- **E2E tests.** Playwright covering upload, chat, streaming, and session clear.
- **GPU passthrough.** Docker compose with `deploy.resources.reservations.devices` for NVIDIA. Cuts generation time 5-10x.

