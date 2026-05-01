import type { FileUploadResponse, StreamChunk } from "../types";

const API = "/api";

export async function sendMessageStream(
  message: string,
  sessionId: string | null,
  onChunk: (text: string) => void,
  onDone: (sessionId: string) => void,
  onError: (error: string) => void
): Promise<void> {
  const res = await fetch(`${API}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming not supported");

  const decoder = new TextDecoder();
  let buffer = "";
  let gotContent = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const data = JSON.parse(trimmed.slice(6)) as StreamChunk;
        if (data.error) { onError(data.error); return; }
        if (data.content) { gotContent = true; onChunk(data.content); }
        if (data.done && data.session_id) { onDone(data.session_id); return; }
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  if (gotContent && sessionId) onDone(sessionId);
}

export async function uploadFile(
  file: File,
  sessionId: string | null
): Promise<FileUploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const url = sessionId
    ? `${API}/upload?session_id=${encodeURIComponent(sessionId)}`
    : `${API}/upload`;

  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json() as Promise<FileUploadResponse>;
}

export async function clearSession(sessionId: string): Promise<void> {
  await fetch(`${API}/history/${sessionId}`, { method: "DELETE" });
}
