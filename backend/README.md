# LangGraph PDF Parser Backend

Simple LangGraph backend for PDF upload and parsing.

## Features

- PDF upload and parsing
- Text extraction from PDF pages
- Automatic text chunking
- Simple chat with Ollama (Gemma 12B)

## Setup

### 1. Install Dependencies

Using Poetry:
```bash
poetry install
```

Or using pip:
```bash
pip install langgraph langchain-core langchain-ollama pypdf langchain-text-splitters
```

### 2. Environment Variables

Create `.env` file:
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma2:12b
```

### 3. Make sure Ollama is running

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not, start Ollama and pull the model
ollama pull gemma2:12b
```

## Run

### Development Mode

```bash
langgraph dev
```

Server will start on `http://localhost:2024`

## Connect to Frontend

In the Agent Chat UI `.env`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=agent
```

## Usage

1. Upload a PDF using the clip icon in Agent Chat UI
2. Backend will automatically parse the PDF and show:
   - File information
   - Page count
   - Character count
   - Chunking details
   - Preview of first 3 pages

3. Ask questions in the chat (simple Ollama responses for now)

## Project Structure

```
langgraph-backend/
├── src/
│   └── agent/
│       ├── __init__.py
│       ├── graph.py          # Main graph definition
│       ├── state.py          # State schema
│       ├── nodes.py          # Node functions
│       └── pdf_processor.py  # PDF parsing logic
├── uploads/                  # Uploaded files (optional)
├── .env                      # Environment variables
├── langgraph.json           # LangGraph configuration
├── pyproject.toml           # Dependencies
└── README.md
```

## Next Steps

- Add vector database (ChromaDB)
- Add BGE embeddings
- Implement RAG search
- Add source citations
