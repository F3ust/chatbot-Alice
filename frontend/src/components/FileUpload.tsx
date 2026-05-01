import { useRef } from "react";

interface FileUploadProps {
  onUpload: (file: File) => void;
  disabled: boolean;
}

const ACCEPTED_TYPES = ".pdf,.txt,.csv";

export default function FileUpload({ onUpload, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) onUpload(file);
    }
    e.target.value = "";
  }

  return (
    <div className="shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleChange}
        disabled={disabled}
        multiple
        hidden
        id="file-upload-input"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title="Upload files (PDF, TXT, CSV)"
        className="w-9 h-9 flex items-center justify-center bg-alice-card border border-alice-border rounded-lg text-alice-cream-dim cursor-pointer transition-colors hover:bg-alice-border hover:text-alice-teal disabled:opacity-50 disabled:cursor-not-allowed"
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
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
    </div>
  );
}
