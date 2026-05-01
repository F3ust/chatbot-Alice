/** One message in the conversation. */
export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/** POST /api/chat response. */
export interface ChatResponse {
  response: string;
  session_id: string;
}

/** POST /api/upload response. */
export interface FileUploadResponse {
  filename: string;
  file_type: string;
  content_preview: string;
  session_id: string;
  message: string;
}

/** One chunk from the SSE stream. */
export interface StreamChunk {
  content?: string;
  done?: boolean;
  session_id?: string;
  error?: string;
}
