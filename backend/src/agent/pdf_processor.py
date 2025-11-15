from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import Dict, List
import io
from datetime import datetime
from src.agent.embedding_service import EmbeddingService
from src.agent.vector_store import VectorStore


class PDFProcessor:
    """PDF processor for parsing, chunking, and embedding."""

    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore()

    def process_pdf(self, pdf_bytes: bytes, filename: str) -> Dict:
        """
        Parse PDF and extract text.

        Args:
            pdf_bytes: PDF file content as bytes
            filename: Name of the PDF file

        Returns:
            Dictionary with parsed content and metadata
        """
        try:
            # Create PDF reader from bytes
            pdf_file = io.BytesIO(pdf_bytes)
            reader = PdfReader(pdf_file)

            # Extract text from all pages
            full_text = ""
            page_texts = []

            for i, page in enumerate(reader.pages):
                page_text = page.extract_text()
                page_texts.append({
                    'page': i + 1,
                    'text': page_text,
                    'char_count': len(page_text)
                })
                full_text += f"\n\n--- Page {i + 1} ---\n\n{page_text}"

            # Create chunks
            chunks = self.text_splitter.split_text(full_text)

            # Generate embeddings for chunks
            embeddings = self.embedding_service.embed_texts(chunks)

            # Prepare metadata for each chunk
            # Map chunks back to pages (simplified - assumes chunks maintain page order)
            metadatas = []
            current_timestamp = datetime.now().isoformat()
            
            for i, chunk in enumerate(chunks):
                # Try to determine which page this chunk belongs to
                # Simple heuristic: find the page number mentioned in chunk
                page_num = 1
                for page_data in page_texts:
                    if f"Page {page_data['page']}" in chunk or f"페이지 {page_data['page']}" in chunk:
                        page_num = page_data['page']
                        break

                metadatas.append({
                    'filename': filename,
                    'chunk_index': i,
                    'page': page_num,
                    'chunk_size': len(chunk),
                    'created_at': current_timestamp
                })

            # Store embeddings in vector database
            stored_count = self.vector_store.add_documents(
                texts=chunks,
                embeddings=embeddings,
                metadatas=metadatas
            )

            # Build result
            result = {
                'success': True,
                'filename': filename,
                'total_pages': len(reader.pages),
                'total_chars': len(full_text),
                'page_texts': page_texts,
                'chunks': chunks,
                'chunk_count': len(chunks),
                'avg_chunk_size': sum(len(c) for c in chunks) / len(chunks) if chunks else 0,
                'embeddings_generated': len(embeddings),
                'embeddings_stored': stored_count,
                'embedding_model': self.embedding_service.model_name,
                'collection_name': self.vector_store.collection_name
            }

            return result

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'filename': filename
            }
