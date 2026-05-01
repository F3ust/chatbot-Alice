import ReactMarkdown from "react-markdown";
import type { Message } from "../types";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex gap-3 animate-[fade-in_0.25s_ease] ${
        isUser ? "self-end flex-row-reverse" : "self-start"
      }`}
      style={{ maxWidth: "90%" }}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 uppercase ${
          isUser
            ? "bg-alice-pink text-white"
            : "bg-alice-teal text-white"
        }`}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div
        className={`px-4 py-2.5 rounded-xl leading-relaxed text-sm ${
          isUser
            ? "bg-alice-pink text-white rounded-br-sm"
            : "bg-alice-card text-alice-cream rounded-bl-sm prose-ai"
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}
