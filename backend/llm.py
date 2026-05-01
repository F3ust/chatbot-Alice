import json
import os
from typing import AsyncGenerator

import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:2b")
NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "32768"))
TIMEOUT = 300.0

_OPTS = {"num_ctx": NUM_CTX}


async def chat(messages: list[dict[str, str]], model: str | None = None) -> str:
    model = model or OLLAMA_MODEL
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={"model": model, "messages": messages, "stream": False, "options": _OPTS},
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]


async def chat_stream(
    messages: list[dict[str, str]], model: str | None = None
) -> AsyncGenerator[str, None]:
    model = model or OLLAMA_MODEL
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_BASE_URL}/api/chat",
            json={"model": model, "messages": messages, "stream": True, "options": _OPTS},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content
                if data.get("done"):
                    break


async def check_health() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            return any(OLLAMA_MODEL in m for m in models)
    except Exception:
        return False
