# White Rabbit

AI chatbot with file-based RAG. Upload PDF, TXT, or CSV files and ask questions about their content. Runs on a local Ollama model with FAISS semantic search.

React 19 + Tailwind v4 frontend. Python FastAPI backend. No cloud APIs.

---

## Quick start

### Local development

Requires Python 3.11+, Node.js 20+, and [Ollama](https://ollama.com/download).

```bash
# Pull models
ollama pull qwen3.5:2b
ollama pull nomic-embed-text

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api/*` to the backend.

### Docker

No Python, Node, or Ollama install needed. Just Docker.

```bash
git clone <repo> && cd chatbot-forAlice
docker compose up --build
```

Open http://localhost:3000.

Startup order: Ollama → model pull → backend → frontend. First run downloads ~2GB for models. Model data persists in a Docker volume.

### Pre-built images (for reviewers)

Download `docker-compose.prod.yml` and run:

```bash
docker compose -f docker-compose.prod.yml up
```

Images: `faust455/white-rabbit-backend`, `faust455/white-rabbit-frontend`.

---

## How it works

```
Browser ──POST──▶ FastAPI ──HTTP──▶ Ollama (qwen3.5:2b)
        ◀──SSE───          ◀────────

                   │
                   ▼
             FAISS + nomic-embed-text
             (semantic chunk retrieval)
```

1. User sends a message or uploads a file.
2. Files are chunked (500 chars, 100 overlap) and embedded with `nomic-embed-text`.
3. On each message, FAISS searches the user's file store and a shared knowledge base.
4. Matching chunks are injected into the system prompt.
5. Ollama generates a response, streamed back over SSE.

### RAG pipeline

| Store | Source | Threshold | Behavior |
|-------|--------|-----------|----------|
| **File store** (per session) | User uploads | 0.05 (fallback: top N chunks) | High priority |
| **Knowledge base** (shared) | `backend/knowledge/*.txt` | 0.35 | Low priority |

### Key decisions

| Choice | Reason |
|--------|--------|
| Ollama + qwen3.5:2b | Local, free, runs on low-end hardware |
| FAISS + nomic-embed-text | Semantic search across languages |
| 32K context window | Fits large file chunks + conversation history |
| In-memory sessions | No database setup. Sessions reset on restart |
| Separate file/knowledge stores | Prevents company knowledge from overshadowing uploads |
| SSE streaming | Tokens appear as the model generates them |

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/stream` | Stream a chat response (SSE) |
| POST | `/api/chat` | Non-streaming chat (fallback) |
| POST | `/api/upload?session_id=` | Upload PDF/TXT/CSV |
| GET | `/api/history/{session_id}` | Conversation history |
| DELETE | `/api/history/{session_id}` | Clear session |
| GET | `/api/health` | Server + Ollama status |

---

## Project structure

```
backend/
  main.py              Routes, sessions, RAG context building
  llm.py               Ollama HTTP client (chat + streaming)
  rag.py               FAISS chunking and retrieval
  file_processor.py    PDF / TXT / CSV text extraction
  models.py            Pydantic request/response schemas
  knowledge/           Pre-loaded .txt files indexed on startup
  tests/               pytest suite (parser + RAG)

frontend/
  src/
    App.tsx            Chat UI, state management, streaming
    index.css          Tailwind v4 config + design tokens
    components/
      ChatMessage.tsx  Message bubble with markdown rendering
      ChatInput.tsx    Text input with Shift+Enter support
      FileUpload.tsx   File picker (PDF, TXT, CSV)
    services/api.ts    SSE reader + upload client
    types/index.ts     TypeScript interfaces

docker-compose.yml       Dev: builds from source
docker-compose.prod.yml  Prod: pulls from Docker Hub
PROBLEMS.md              Bugs encountered and fixes applied
```

## Config

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server address |
| `OLLAMA_MODEL` | `qwen3.5:2b` | Chat model |
| `OLLAMA_NUM_CTX` | `32768` | Context window size |

## Tests

```bash
cd backend
python -m pytest tests/ -v
```
