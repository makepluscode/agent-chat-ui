from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import Dict, List
import io


class PDFProcessor:
    """Simple PDF processor for parsing and chunking."""

    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

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

            # Build result
            result = {
                'success': True,
                'filename': filename,
                'total_pages': len(reader.pages),
                'total_chars': len(full_text),
                'page_texts': page_texts,
                'chunks': chunks,
                'chunk_count': len(chunks),
                'avg_chunk_size': sum(len(c) for c in chunks) / len(chunks) if chunks else 0
            }

            return result

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'filename': filename
            }
