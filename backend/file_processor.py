import io
import csv
from pathlib import Path


def process_file(filename: str, content: bytes) -> str:
    ext = Path(filename).suffix.lower()
    processors = {".txt": _txt, ".csv": _csv, ".pdf": _pdf}
    fn = processors.get(ext)
    if fn is None:
        raise ValueError(f"Unsupported type: {ext}. Supported: {', '.join(processors)}")
    return fn(content)


def _txt(content: bytes) -> str:
    return content.decode("utf-8", errors="replace").strip()


def _csv(content: bytes) -> str:
    text = content.decode("utf-8", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return "Empty CSV file."

    header = rows[0]
    lines = [
        f"CSV with {len(rows) - 1} data rows.",
        f"Columns: {', '.join(header)}",
        "",
    ]
    for row in rows[:11]:
        lines.append(" | ".join(row))
    if len(rows) > 11:
        lines.append(f"\n... and {len(rows) - 11} more rows.")
    return "\n".join(lines)


def _pdf(content: bytes) -> str:
    from PyPDF2 import PdfReader

    reader = PdfReader(io.BytesIO(content))
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            pages.append(f"[Page {i + 1}]\n{text.strip()}")
    if not pages:
        return "Could not extract text from this PDF."
    return "\n\n".join(pages)
