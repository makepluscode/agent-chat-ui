import base64
import os
from typing import Any, Dict, List, Optional, Tuple, Union

from langchain_core.messages import AIMessage, HumanMessage
from langchain_ollama import ChatOllama

from src.agent.pdf_processor import PDFProcessor
from src.agent.state import AgentState

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


def _get_message_content(
    message: Union[HumanMessage, Dict[str, Any]],
) -> Optional[Any]:
    """Extract content from message, handling both HumanMessage and dict."""
    if isinstance(message, HumanMessage):
        return message.content
    elif isinstance(message, dict):
        if message.get('type') in ('human', 'HumanMessage'):
            return message.get('content')
    return None


def _has_pdf_in_content(content: List[Any]) -> bool:
    """Check if content list contains a PDF file."""
    for item in content:
        if not isinstance(item, dict):
            continue

        # Check for ContentBlock format: type="file" with mimeType="application/pdf"
        if item.get('type') == 'file' and item.get('mimeType') == 'application/pdf':
            return True

        # Check for legacy image_url format with PDF
        if item.get('type') == 'image_url':
            url = _extract_url_from_item(item)
            if _is_pdf_url(url):
                return True

    return False


def _extract_pdf_from_message(content: List[Any]) -> Optional[Tuple[bytes, str]]:
    """Extract PDF data and filename from multimodal message content."""
    for item in content:
        if not isinstance(item, dict):
            continue

        # Check for ContentBlock format: type="file" with mimeType="application/pdf"
        if item.get('type') == 'file' and item.get('mimeType') == 'application/pdf':
            data = item.get('data', '')
            if not data:
                continue

            try:
                # data is base64 string (without data: prefix)
                pdf_data = base64.b64decode(data)
                filename = item.get('metadata', {}).get('filename', 'uploaded.pdf')
                if not filename.endswith('.pdf'):
                    filename = 'uploaded.pdf'
                return pdf_data, filename
            except Exception:
                continue

        # Check for legacy image_url format
        elif item.get('type') == 'image_url':
            url = _extract_url_from_item(item)
            if url.startswith('data:'):
                parts = url.split(',', 1)
                if len(parts) == 2 and _is_pdf_url(parts[0]):
                    try:
                        pdf_data = base64.b64decode(parts[1])
                        filename = item.get('image_url', {}).get(
                            'detail', 'uploaded.pdf'
                        )
                        if not filename.endswith('.pdf'):
                            filename = 'uploaded.pdf'
                        return pdf_data, filename
                    except Exception:
                        continue

    return None


def route_message(state: AgentState) -> str:
    """
    Determine which node to route to based on the message.

    Returns:
        "process_pdf" if the message contains a PDF file
        "chat" for all other messages
    """
    last_message = state["messages"][-1]
    content = _get_message_content(last_message)

    # Only process human messages
    if content is None:
        return "chat"

    # Check if content is a list (multimodal message)
    if isinstance(content, list):
        if _has_pdf_in_content(content):
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
        content = _get_message_content(last_message)

        if not isinstance(content, list):
            return {
                "messages": [
                    AIMessage(
                        content="❌ **PDF Processing Error**\n\nInvalid message format."
                    )
                ]
            }

        pdf_result = _extract_pdf_from_message(content)

        if not pdf_result:
            return {
                "messages": [
                    AIMessage(
                        content=(
                            "❌ **PDF Processing Error**\n\n"
                            "No PDF file found in the message."
                        )
                    )
                ]
            }

        pdf_data, filename = pdf_result

        # Process PDF
        result = pdf_processor.process_pdf(pdf_data, filename)

        if result['success']:
            # Create success message with detailed embedding status
            embeddings_count = result.get(
                'embeddings_generated', result['chunk_count']
            )
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
- **Embeddings Generated**: {embeddings_count} embeddings
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
                page_num = page_data['page']
                char_count = page_data['char_count']
                response += f"\n**Page {page_num}** ({char_count} characters)\n"
                response += f"{preview}...\n"

            if result['total_pages'] > 3:
                response += f"\n... and {result['total_pages'] - 3} more pages"

            response += "\n\nYou can now ask questions about this document!"

            return {"messages": [AIMessage(content=response)]}
        else:
            error_msg = f"❌ **PDF Processing Failed**\n\nError: {result['error']}"
            return {"messages": [AIMessage(content=error_msg)]}

    except Exception as e:
        return {
            "messages": [AIMessage(content=f"❌ **Processing Error**\n\n{str(e)}")]
        }


def build_chunks_table(retrieved_chunks: list) -> str:
    """Build markdown table with detailed chunk information."""
    if not retrieved_chunks:
        return ""

    # Build table header
    table = (
        "| # | Relevance | Document | Page | Similarity | Size | Content Preview |\n"
        "|---|-----------|----------|------|------------|------|------------------|\n"
    )

    for i, chunk in enumerate(retrieved_chunks, 1):
        metadata = chunk['metadata']
        distance = chunk['distance']
        text = chunk['document']

        # Relevance stars
        if distance < 0.20:
            stars = "⭐⭐⭐⭐⭐"
        elif distance < 0.30:
            stars = "⭐⭐⭐⭐"
        elif distance < 0.40:
            stars = "⭐⭐⭐"
        elif distance < 0.50:
            stars = "⭐⭐"
        else:
            stars = "⭐"

        # Get document name
        filename = metadata.get('filename', 'Unknown')
        page = metadata.get('page', 'N/A')
        chunk_size = metadata.get('chunk_size', len(text))

        # Preview text (first 80 chars, remove newlines)
        preview = text[:80].replace('\n', ' ').replace('|', '•')
        if len(text) > 80:
            preview += "..."

        # Build table row
        table += (
            f"| {i} | {stars} | {filename} | {page} | "
            f"{distance:.4f} | {chunk_size} | {preview} |\n"
        )

    return table


def build_sources_summary(retrieved_chunks: list) -> str:
    """Build detailed source information with chunk references."""
    if not retrieved_chunks:
        return ""

    sources = {}

    # Collect unique documents and their chunks
    for i, chunk in enumerate(retrieved_chunks, 1):
        metadata = chunk['metadata']
        filename = metadata.get('filename', 'Unknown')
        page = metadata.get('page', 'N/A')
        chunk_index = metadata.get('chunk_index', 'N/A')
        distance = chunk['distance']

        if filename not in sources:
            sources[filename] = {
                'pages': set(),
                'chunks': [],
                'total_chars': 0
            }

        sources[filename]['pages'].add(page)
        sources[filename]['chunks'].append({
            'number': i,
            'page': page,
            'chunk_index': chunk_index,
            'distance': distance,
            'size': metadata.get('chunk_size', 0),
            'text': chunk['document'][:200]
        })
        sources[filename]['total_chars'] += metadata.get('chunk_size', 0)

    # Build detailed source summary
    summary_parts = []

    for filename, info in sources.items():
        pages_str = ", ".join(map(str, sorted(info['pages'])))
        total_size = info['total_chars']
        num_chunks = len(info['chunks'])

        # Document header
        doc_summary = (
            f"### 📎 **{filename}**\n\n"
            f"**Pages Referenced:** {pages_str}  \n"
            f"**Chunks Used:** {num_chunks}  \n"
            f"**Total Characters:** {total_size:,}\n\n"
        )

        # Chunk details table
        doc_summary += (
            "| Chunk | Page | Position | Score | Quality | Size | Content |\n"
            "|-------|------|----------|-------|---------|------|----------|\n"
        )

        for chunk_info in info['chunks']:
            score = chunk_info['distance']
            if score < 0.20:
                quality = "Perfect"
            elif score < 0.30:
                quality = "Excellent"
            elif score < 0.40:
                quality = "Good"
            elif score < 0.50:
                quality = "Fair"
            else:
                quality = "Weak"

            content_preview = chunk_info['text'].replace('\n', ' ').replace('|', '•')[:60]
            if len(chunk_info['text']) > 60:
                content_preview += "..."

            doc_summary += (
                f"| #{chunk_info['number']} | {chunk_info['page']} | "
                f"Idx:{chunk_info['chunk_index']} | "
                f"{score:.4f} | {quality} | "
                f"{chunk_info['size']} | {content_preview} |\n"
            )

        summary_parts.append(doc_summary)

    return "\n".join(summary_parts)


def chat_node(state: AgentState) -> AgentState:
    """Chat using Ollama with RAG chunk retrieval and source display."""
    try:
        from langchain_core.messages import convert_to_messages

        messages = convert_to_messages(state["messages"])
        text_messages = []
        user_query = None

        # Extract text messages and find last user query
        for msg in messages:
            text_content = _extract_text_from_multimodal(msg.content)

            if text_content.strip():
                if isinstance(msg, HumanMessage):
                    # Use original message with updated content to preserve ID
                    msg.content = text_content
                    text_messages.append(msg)
                    user_query = text_content
                elif isinstance(msg, AIMessage):
                    # Use original message with updated content to preserve ID
                    msg.content = text_content
                    text_messages.append(msg)

        if not text_messages or not user_query:
            return state

        # Try RAG retrieval only if:
        # 1. Query is not about PDF processing
        # 2. Query is reasonably long (not just greetings)
        # 3. ChromaDB has documents (collection not empty)
        retrieved_chunks = None
        should_use_rag = False

        # Skip RAG for short queries (greetings, small talk)
        if len(user_query.strip()) > 10:
            # Skip RAG for PDF processing queries
            if "process" not in user_query.lower() and "pdf" not in user_query.lower():
                should_use_rag = True

        if should_use_rag:
            try:
                # Check if vector store has any documents
                store_stats = pdf_processor.vector_store.get_collection_stats()
                if store_stats.get('document_count', 0) > 0:
                    query_embedding = pdf_processor.embedding_service.embed_query(
                        user_query
                    )
                    retrieved_chunks = pdf_processor.vector_store.search(
                        query_embedding=query_embedding,
                        n_results=5
                    )
            except Exception:
                # If RAG fails, continue without it
                pass

        # Build context from retrieved chunks
        if retrieved_chunks and len(retrieved_chunks) > 0:
            context_text = "\n\n".join([
                f"[{chunk['metadata']['filename']} - Page {chunk['metadata']['page']}]\n"
                f"{chunk['document']}"
                for chunk in retrieved_chunks
            ])

            # Add context instruction to messages
            context_msg = HumanMessage(
                content=(
                    f"Here is relevant context from the document:\n\n{context_text}\n\n"
                    f"Use this information to answer: {user_query}"
                )
            )
            text_messages.append(context_msg)

        # Generate response
        response = llm.invoke(text_messages)
        response_text = response.content

        # Format response with chunk sources
        if retrieved_chunks and len(retrieved_chunks) > 0:
            chunks_table = build_chunks_table(retrieved_chunks)
            sources_summary = build_sources_summary(retrieved_chunks)

            final_response = (
                f"{response_text}\n\n"
                f"---\n\n"
                f"📚 **Retrieved Source Chunks**\n\n"
                f"{chunks_table}\n\n"
                f"📄 **Document References**\n\n"
                f"{sources_summary}"
            )

            return {"messages": [AIMessage(content=final_response)]}
        else:
            return {"messages": [response]}

    except Exception as e:
        return {
            "messages": [AIMessage(content=f"❌ **오류**\n\n{str(e)}")]
        }
