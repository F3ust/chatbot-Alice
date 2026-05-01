import { useCallback, useEffect, useRef, useState } from "react";
import ChatInput from "./components/ChatInput.tsx";
import ChatMessage from "./components/ChatMessage.tsx";
import FileUpload from "./components/FileUpload.tsx";
import { clearSession, sendMessageStream, uploadFile } from "./services/api";
import type { Message } from "./types";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [showFiles, setShowFiles] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);
      setStreamingContent("");
      setPendingFiles([]);
      streamRef.current = "";

      try {
        await sendMessageStream(
          text,
          sessionId,
          (chunk) => {
            streamRef.current += chunk;
            setStreamingContent(streamRef.current);
          },
          (sid) => {
            setSessionId(sid);
            if (streamRef.current.trim()) {
              const assistantMsg: Message = {
                role: "assistant",
                content: streamRef.current,
                timestamp: new Date().toISOString(),
              };
              setMessages((msgs) => [...msgs, assistantMsg]);
            }
            setStreamingContent("");
            setLoading(false);
          },
          (errMsg) => {
            setError(errMsg);
            setLoading(false);
            setStreamingContent("");
          }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLoading(false);
        setStreamingContent("");
      }
    },
    [sessionId]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const result = await uploadFile(file, sessionId);
        setSessionId(result.session_id);
        setUploadedFiles((prev) => [...prev, result.filename]);
        setPendingFiles((prev) => [...prev, result.filename]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [sessionId]
  );

  const handleClear = useCallback(async () => {
    if (sessionId) {
      await clearSession(sessionId).catch(() => { });
    }
    setMessages([]);
    setSessionId(null);
    setUploadedFiles([]);
    setPendingFiles([]);
    setError(null);
    setStreamingContent("");
  }, [sessionId]);

  return (
    <div className="flex flex-col h-full max-w-[860px] mx-auto bg-alice-dark shadow-2xl">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-alice-border bg-alice-dark shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-alice-teal flex items-center justify-center text-white text-xs font-bold">
            🐇
          </div>
          <h1 className="text-lg font-serif font-bold text-alice-cream tracking-wide">
            White Rabbit
          </h1>
        </div>
        <button
          onClick={handleClear}
          title="New conversation"
          className="px-3.5 py-1.5 text-sm font-medium text-alice-cream-dim bg-alice-card border border-alice-border rounded-md cursor-pointer transition-colors hover:bg-alice-border hover:text-alice-cream"
        >
          New Chat
        </button>
      </header>

      {/* Knowledge base file list */}
      {uploadedFiles.length > 0 && (
        <div className="px-5 py-2 border-b border-alice-border bg-alice-darker shrink-0">
          <button
            onClick={() => setShowFiles(!showFiles)}
            className="flex items-center gap-2 text-xs text-alice-cream-dim bg-transparent border-none cursor-pointer hover:text-alice-cream transition-colors"
          >
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-alice-teal/20 text-alice-teal text-[10px] font-bold">
              {uploadedFiles.length}
            </span>
            Uploaded Files
            <span className={`text-[10px] transition-transform ${showFiles ? "rotate-180" : ""}`}>▼</span>
          </button>
          {showFiles && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {uploadedFiles.map((name, i) => (
                <span
                  key={i}
                  title={name}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-alice-card border border-alice-border rounded-full text-xs text-alice-cream-dim"
                >
                  📄 {name.length > 30 ? name.slice(0, 27) + "..." : name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center flex-1 text-center text-alice-cream-dim gap-3">
            <div className="w-16 h-16 rounded-full bg-alice-teal/20 flex items-center justify-center text-3xl">
              🐇
            </div>
            <h2 className="text-xl font-serif font-bold text-alice-cream">
              White Rabbit
            </h2>
            <p className="text-sm max-w-xs">
              Upload a document or start a conversation.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {streamingContent && (
          <ChatMessage
            message={{
              role: "assistant",
              content: streamingContent,
              timestamp: new Date().toISOString(),
            }}
          />
        )}

        {loading && !streamingContent && (
          <div className="flex gap-3 self-start animate-[fade-in_0.25s_ease]">
            <div className="w-8 h-8 rounded-full bg-alice-teal flex items-center justify-center text-white text-xs font-bold shrink-0">
              AI
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-alice-card rounded-bl-sm">
              <div className="flex gap-1.5 py-1">
                <span className="w-1.5 h-1.5 bg-alice-cream-dim rounded-full animate-[bounce-dot_1.2s_infinite]" />
                <span className="w-1.5 h-1.5 bg-alice-cream-dim rounded-full animate-[bounce-dot_1.2s_infinite_0.15s]" />
                <span className="w-1.5 h-1.5 bg-alice-cream-dim rounded-full animate-[bounce-dot_1.2s_infinite_0.3s]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-red-950/50 text-red-300 border border-red-800/50 rounded-lg text-sm">
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError(null)}
              className="bg-transparent border-none text-red-300 cursor-pointer text-base px-1"
            >
              ✕
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input area */}
      <footer className="flex flex-col gap-2 px-5 py-3.5 border-t border-alice-border bg-alice-dark shrink-0">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((name, i) => (
              <span
                key={i}
                title={name}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-alice-card border border-alice-border rounded-full text-xs text-alice-cream-dim animate-[fade-in_0.2s_ease]"
              >
                📄 {name.length > 25 ? name.slice(0, 22) + "..." : name}
                <button
                  onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-0.5 text-alice-cream-dim/50 hover:text-alice-cream bg-transparent border-none cursor-pointer text-xs"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <FileUpload onUpload={handleUpload} disabled={loading} />
          <ChatInput onSend={handleSend} disabled={loading} />
        </div>
      </footer>
    </div>
  );
}
