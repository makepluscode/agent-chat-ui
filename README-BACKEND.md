# LangGraph Backend Setup

This directory contains the LangGraph backend for PDF parsing and RAG functionality.

## Quick Start

### 1. Setup Environment

```bash
cd backend

# Create .env file
cp .env.example .env

# Install dependencies with uv
uv venv
uv pip install -r requirements.txt

# Or install in editable mode
uv pip install -e .
```

### 2. Start the Server

```bash
# Development mode (auto-reload)
uv run langgraph dev

# Server will start on http://localhost:2024
```

### 3. Verify

```bash
# Health check
curl http://localhost:2024/ok

# Should return: {"ok":true}
```

## Environment Variables

- `OLLAMA_BASE_URL` - Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL` - Model to use (default: gemma3:12b)

## Features

- ✅ PDF upload and parsing (PyPDF)
- ✅ Text chunking (1000 chars, 200 overlap)
- ✅ Multimodal message handling
- ✅ Simple chat with Ollama
- ✅ Auto-routing between PDF processing and chat

## Architecture

```
backend/
├── src/
│   └── agent/
│       ├── graph.py          # Main LangGraph definition
│       ├── state.py          # State schema
│       ├── nodes.py          # Node functions (route, process_pdf, chat)
│       └── pdf_processor.py  # PDF parsing logic
├── .env                      # Environment variables (gitignored)
├── .env.example             # Environment template
├── langgraph.json           # LangGraph configuration
├── requirements.txt         # Python dependencies
└── README.md

## Requirements

- Python 3.11+
- Ollama with gemma3:12b model installed
- uv (recommended) or pip

## Integration with Frontend

The backend integrates with Agent Chat UI (frontend):

1. Frontend runs on http://localhost:3001 (or 3000)
2. Backend runs on http://localhost:2024
3. Frontend connects via `NEXT_PUBLIC_API_URL=http://localhost:2024`

## Development

### Install CLI tools

```bash
uv pip install "langgraph-cli[inmem]"
```

### Running Tests

```bash
# Test with curl
curl -X POST http://localhost:2024/threads \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Troubleshooting

### Port already in use

```bash
# Find and kill process on port 2024
lsof -ti:2024 | xargs kill -9
```

### Ollama not running

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Pull model if needed
ollama pull gemma3:12b
```

### Module import errors

```bash
# Reinstall in editable mode
uv pip install -e .
```

## API Documentation

When the server is running, visit:
- **API Docs**: http://localhost:2024/docs
- **LangSmith Studio**: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
