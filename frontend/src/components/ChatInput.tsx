import { useState, type FormEvent, type KeyboardEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form className="flex items-end gap-2 flex-1" onSubmit={handleSubmit}>
      <textarea
        id="chat-input"
        className="flex-1 px-3.5 py-2.5 bg-alice-card border border-alice-border rounded-lg text-sm text-alice-cream placeholder-alice-cream-dim/60 resize-none outline-none leading-relaxed max-h-[120px] transition-colors focus:border-alice-teal focus:ring-1 focus:ring-alice-teal/30 disabled:opacity-50 font-[inherit]"
        placeholder="Type a message... (Shift+Enter for new line)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        title="Send message"
        className="w-9 h-9 flex items-center justify-center bg-alice-teal text-white border-none rounded-lg cursor-pointer transition-colors shrink-0 hover:bg-alice-teal-light disabled:opacity-40 disabled:cursor-not-allowed shadow-[3px_3px_0_#000]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </form>
  );
}
