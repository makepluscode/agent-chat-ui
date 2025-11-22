"""Embedding service using BGE-M3 model with Korean support."""
import os
from typing import List

from sentence_transformers import SentenceTransformer


class EmbeddingService:
    """
    Service for generating embeddings using BGE-M3.

    BGE-M3 is a multilingual model that supports Korean, English, and 100+ languages.
    It uses dense, sparse, and multi-vector representations for better retrieval.
    """

    def __init__(self):
        # BGE-M3 supports Korean and is optimized for multilingual retrieval
        model_name = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
        self.model = SentenceTransformer(
            model_name,
            device='cpu'  # Use 'cuda' if GPU is available
        )
        self.model_name = model_name

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts.
        Supports Korean, English, and 100+ languages.

        Args:
            texts: List of text strings to embed (Korean, English, or mixed)

        Returns:
            List of embedding vectors
        """
        if not texts:
            return []

        # BGE-M3 automatically handles Korean and multilingual text
        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32  # Process in batches for efficiency
        )

        return embeddings.tolist()

    def embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for a single query text.
        Supports Korean, English, and multilingual queries.

        Args:
            query: Query text string (Korean, English, or mixed)

        Returns:
            Embedding vector
        """
        # BGE-M3 handles Korean queries automatically
        embedding = self.model.encode(
            query,
            normalize_embeddings=True,
            convert_to_numpy=True
        )

        return embedding.tolist()
