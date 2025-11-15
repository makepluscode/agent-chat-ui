from langchain_core.messages import AIMessage, HumanMessage
from langchain_ollama import ChatOllama
from src.agent.state import AgentState
from src.agent.pdf_processor import PDFProcessor
import base64
import os
from typing import Optional, Tuple


# Initialize Ollama LLM
llm = ChatOllama(
    model=os.getenv("OLLAMA_MODEL", "gemma3:12b"),
    base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
    temperature=0.7,
)

# Initialize PDF processor
pdf_processor = PDFProcessor()


def _extract_url_from_item(item: dict) -> str:
    """Extract URL string from image_url item."""
    url_data = item.get('image_url', {})
    if isinstance(url_data, dict):
        return url_data.get('url', '')
    return url_data if isinstance(url_data, str) else ''


def _is_pdf_url(url: str) -> bool:
    """Check if URL represents a PDF file."""
    url_lower = url.lower()
    return 'pdf' in url_lower or 'application/pdf' in url_lower


def _extract_pdf_from_message(content: list) -> Optional[Tuple[bytes, str]]:
    """Extract PDF data and filename from multimodal message content."""
    for item in content:
        if isinstance(item, dict) and item.get('type') == 'image_url':
            url = _extract_url_from_item(item)
            
            if url.startswith('data:'):
                parts = url.split(',', 1)
                if len(parts) == 2 and _is_pdf_url(parts[0]):
                    pdf_data = base64.b64decode(parts[1])
                    filename = item.get('image_url', {}).get('detail', 'uploaded.pdf')
                    if not filename.endswith('.pdf'):
                        filename = 'uploaded.pdf'
                    return pdf_data, filename
    return None


def route_message(state: AgentState) -> str:
    """Determine which node to route to based on the message."""
    last_message = state["messages"][-1]

    if isinstance(last_message, HumanMessage):
        content = last_message.content
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get('type') == 'image_url':
                    url = _extract_url_from_item(item)
                    if _is_pdf_url(url):
                        return "process_pdf"

    return "chat"


def _extract_text_from_multimodal(content) -> str:
    """Extract text content from multimodal message."""
    if isinstance(content, str):
        return content
    
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
            elif isinstance(item, dict) and item.get('type') == 'text':
                text_parts.append(item.get('text', ''))
        return ' '.join(text_parts)
    
    return str(content)


def process_pdf_node(state: AgentState) -> AgentState:
    """Process uploaded PDF and return results."""
    last_message = state["messages"][-1]

    try:
        content = last_message.content
        pdf_result = None

        if isinstance(content, list):
            pdf_result = _extract_pdf_from_message(content)

        if not pdf_result:
            state["messages"].append(
                AIMessage(content="❌ **PDF Processing Error**\n\nNo PDF file found in the message.")
            )
            return state

        pdf_data, filename = pdf_result

        # Process PDF
        result = pdf_processor.process_pdf(pdf_data, filename)

        if result['success']:
            # Create success message with detailed embedding status
            response = f"""✅ **PDF Parsing and Embedding Complete**

## 📄 File Information
- **Filename**: {result['filename']}
- **Total Pages**: {result['total_pages']} pages
- **Total Characters**: {result['total_chars']:,} characters

## 📊 Processing Steps

### ✅ 1. PDF Text Extraction
- Extracted text from {result['total_pages']} pages

### ✅ 2. Text Chunking
- **Chunks Created**: {result['chunk_count']} chunks
- **Average Chunk Size**: {result['avg_chunk_size']:.0f} characters
- **Chunk Settings**: 1000 chars (overlap: 200 chars)

### ✅ 3. Embedding Generation
- **Embedding Model**: {result.get('embedding_model', 'BAAI/bge-m3')}
- **Embeddings Generated**: {result.get('embeddings_generated', result['chunk_count'])} embeddings
- **Embedding Dimension**: 1024 dimensions

### ✅ 4. Vector Storage
- **Stored Chunks**: {result.get('embeddings_stored', result['chunk_count'])} chunks
- **Collection**: {result.get('collection_name', 'pdf_documents')}
- **Storage Location**: ChromaDB (local)

## 📝 Page Preview
"""
            # Add preview of first 3 pages
            for page_data in result['page_texts'][:3]:
                preview = page_data['text'][:200].replace('\n', ' ')
                response += f"\n**Page {page_data['page']}** ({page_data['char_count']} characters)\n"
                response += f"{preview}...\n"

            if result['total_pages'] > 3:
                response += f"\n... and {result['total_pages'] - 3} more pages"

            response += "\n\nYou can now ask questions about this document!"

            state["messages"].append(AIMessage(content=response))
        else:
            state["messages"].append(
                AIMessage(content=f"❌ **PDF Processing Failed**\n\nError: {result['error']}")
            )

    except Exception as e:
        state["messages"].append(
            AIMessage(content=f"❌ **Processing Error**\n\n{str(e)}")
        )

    return state


def chat_node(state: AgentState) -> AgentState:
    """Simple chat using Ollama."""
    try:
        from langchain_core.messages import convert_to_messages

        messages = convert_to_messages(state["messages"])
        text_messages = []

        for msg in messages:
            text_content = _extract_text_from_multimodal(msg.content)
            
            if text_content.strip():
                if isinstance(msg, HumanMessage):
                    text_messages.append(HumanMessage(content=text_content))
                elif isinstance(msg, AIMessage):
                    text_messages.append(AIMessage(content=text_content))

        if text_messages:
            response = llm.invoke(text_messages)
            state["messages"].append(response)
    except Exception as e:
        state["messages"].append(
            AIMessage(content=f"❌ **LLM 오류**\n\n{str(e)}")
        )

    return state
