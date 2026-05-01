import os

from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = "nomic-embed-text"

_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
_embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)


class VectorStore:
    """Per-session FAISS store with Ollama embeddings."""

    def __init__(self):
        self._store: FAISS | None = None
        self._chunks: list[str] = []
        self._sources: list[str] = []

    async def add(self, text: str, filename: str):
        docs = _splitter.create_documents(
            [text],
            metadatas=[{"source": filename}],
        )
        if not docs:
            return

        for doc in docs:
            self._chunks.append(doc.page_content)
            self._sources.append(filename)

        if self._store is None:
            self._store = await FAISS.afrom_documents(docs, _embeddings)
        else:
            new_store = await FAISS.afrom_documents(docs, _embeddings)
            self._store.merge_from(new_store)

    async def query(self, question: str, top_k: int = 5) -> list[dict]:
        if self._store is None:
            return []

        results = await self._store.asimilarity_search_with_score(question, k=top_k)
        return [
            {
                "chunk": doc.page_content,
                "source": doc.metadata.get("source", "unknown"),
                "score": round(1 / (1 + distance), 4),  # convert L2 distance to 0-1 score
            }
            for doc, distance in results
        ]

    @property
    def chunks(self) -> list[str]:
        return self._chunks

    @property
    def sources(self) -> list[str]:
        return self._sources

    @property
    def size(self) -> int:
        return len(self._chunks)
