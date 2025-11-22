"""Vector store service using ChromaDB."""
import os
from typing import Dict, List, Optional

import chromadb
from chromadb.config import Settings


class VectorStore:
    """Service for storing and retrieving PDF embeddings in ChromaDB."""

    def __init__(self, collection_name: str = "pdf_documents"):
        """
        Initialize ChromaDB client and collection.

        Args:
            collection_name: Name of the collection to use
        """
        # Use persistent storage in chroma_db directory
        persist_directory = os.path.join(os.getcwd(), "chroma_db")
        os.makedirs(persist_directory, exist_ok=True)

        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(anonymized_telemetry=False)
        )

        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        self.collection_name = collection_name

    def add_documents(
        self,
        texts: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict],
        ids: Optional[List[str]] = None
    ) -> int:
        """
        Add documents with embeddings to the vector store.

        Args:
            texts: List of text chunks
            embeddings: List of embedding vectors
            metadatas: List of metadata dictionaries for each chunk
            ids: Optional list of IDs. If None, will be auto-generated

        Returns:
            Number of documents added
        """
        if not texts or not embeddings:
            return 0

        if ids is None:
            # Generate IDs based on filename and chunk index
            ids = [
                f"{meta.get('filename', 'unknown')}_{i}_{meta.get('chunk_index', i)}"
                for i, meta in enumerate(metadatas)
            ]

        self.collection.add(
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )

        return len(texts)

    def search(
        self,
        query_embedding: List[float],
        n_results: int = 5,
        filter_metadata: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Search for similar documents.

        Args:
            query_embedding: Query embedding vector
            n_results: Number of results to return
            filter_metadata: Optional metadata filter

        Returns:
            List of result dictionaries with 'document', 'metadata', 'distance', 'id'
        """
        where = filter_metadata if filter_metadata else None

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            where=where
        )

        # Format results
        formatted_results = []
        if results['documents'] and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                formatted_results.append({
                    'document': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'distance': results['distances'][0][i],
                    'id': results['ids'][0][i]
                })

        return formatted_results

    def get_collection_stats(self) -> Dict:
        """Get statistics about the collection."""
        count = self.collection.count()
        return {
            'collection_name': self.collection_name,
            'document_count': count
        }

    def delete_by_filename(self, filename: str) -> int:
        """
        Delete all documents for a specific filename.

        Args:
            filename: Filename to delete documents for

        Returns:
            Number of documents deleted
        """
        # Get all documents with this filename
        results = self.collection.get(
            where={"filename": filename}
        )

        if results['ids']:
            self.collection.delete(ids=results['ids'])
            return len(results['ids'])

        return 0
