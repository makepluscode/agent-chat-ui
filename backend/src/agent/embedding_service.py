"""Embedding service supporting Sentence Transformers (BGE-M3) and Ollama embeddings."""
import os
from typing import List

from sentence_transformers import SentenceTransformer
from langchain_ollama import OllamaEmbeddings


class EmbeddingService:
    """
    Service for generating embeddings.

    Supports:
    - sentence_transformers (default): e.g., BAAI/bge-m3 (multilingual, incl. Korean)
    - ollama: e.g., nomic-embed-text served via local Ollama
    """

    def __init__(self):
        provider = os.getenv("EMBEDDING_PROVIDER", "sentence_transformers").lower()
        self.provider = provider

        if provider == "ollama":
            model_name = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            self.embedder = OllamaEmbeddings(model=model_name, base_url=base_url)
            self.model_name = model_name
        else:
            # Default to sentence-transformers BGE-M3 (multilingual, incl. Korean)
            model_name = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
            self.model = SentenceTransformer(
                model_name,
                device='cpu'  # Use 'cuda' if GPU is available
            )
            self.model_name = model_name

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts.
        Supports Korean, English, and 100+ languages (depending on model/provider).

        Args:
            texts: List of text strings to embed (Korean, English, or mixed)

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        if self.provider == "ollama":
            embeddings = self.embedder.embed_documents(texts)
        else:
            # BGE-M3 automatically handles Korean and multilingual text
            embeddings = self.model.encode(
                texts,
                normalize_embeddings=True,
                show_progress_bar=False,
                batch_size=32  # Process in batches for efficiency
            )

        # langchain_ollama returns plain lists already; SentenceTransformer returns ndarray
        return embeddings.tolist() if hasattr(embeddings, "tolist") else embeddings

    def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for a single query text.
        Supports Korean, English, and multilingual queries (depending on model/provider).

        Args:
            query: Query text string (Korean, English, or mixed)

        Returns:
            Embedding vector
        """
        if self.provider == "ollama":
            embedding = self.embedder.embed_query(query)
            return embedding
        else:
            # BGE-M3 handles Korean queries automatically
            embedding = self.model.encode(
                query,
                normalize_embeddings=True,
                convert_to_numpy=True
            )

        return embedding.tolist()
