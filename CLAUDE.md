# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**📚 Detailed Documentation**: See [docs/](./docs/) directory for comprehensive guides:
- [RAG Implementation](./docs/RESPONSE_FORMAT_PROFESSIONAL.md) - Professional chunk display with tables
- [RAG Chunking Guide](./docs/RAG_CHUNKING_VISUALIZATION.md) - Visual explanations and architecture
- [Response Format Examples](./docs/RESPONSE_FORMAT_EXAMPLE.md) - Real-world examples
- [Implementation Status](./docs/IMPLEMENTATION_COMPLETE.md) - Feature checklist

## Project Overview

Agent Chat UI is a Next.js application that provides a chat interface for any LangGraph server with a `messages` key. It enables real-time streaming communication with LangGraph deployments and includes features like human-in-the-loop (HITL) interrupts, artifacts rendering, and thread management.

This repository includes both a Next.js frontend and an optional Python LangGraph backend for PDF RAG functionality.

## Common Commands

### Frontend (Next.js)

```bash
# Install dependencies (uses pnpm@10.5.1)
pnpm install

# Run development server (starts on http://localhost:3000)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Linting
pnpm lint
pnpm lint:fix

# Formatting
pnpm format
pnpm format:check
```

### Backend (LangGraph - Optional)

Located in `backend/` directory. Requires Python 3.11+ and uv package manager.

```bash
cd backend

# Create and activate virtual environment
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt

# Run development server (starts on http://localhost:2024)
uv run langgraph dev

# API docs available at http://localhost:2024/docs
```

**Note:** The backend uses ChromaDB for vector storage (persisted at `backend/chroma_db/`) and BGE-M3 embeddings. The ChromaDB data persists across sessions, so uploaded PDFs remain searchable even after restarting the server. Update Python dependencies in `pyproject.toml` rather than `requirements.txt`.

**IMPORTANT - Environment Variables:** The `langgraph.json` configuration points to `../env` for environment variables, which means the backend reads from the **project root `.env` file** (NOT `backend/.env`). Always configure backend environment variables (OLLAMA_BASE_URL, OLLAMA_MODEL, EMBEDDING_MODEL, etc.) in the root `.env` file.

**⚠️ About backend/.env:**
- `backend/.env` is **NOT used** by LangGraph (it reads from root `.env`)
- You may see a warning "backend/.env.example not found" when using `./run.sh` - **this is safe to ignore**
- If `backend/.env` exists, it will be ignored by the backend (but may cause confusion)
- Best practice: Do not create `backend/.env` or `backend/.env.example` to avoid confusion

## Architecture

### Directory Structure

```
src/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Home/setup page
│   ├── layout.tsx         # Root layout with theme providers
│   ├── globals.css        # Global styles
│   └── api/               # API routes (API passthrough)
├── components/
│   ├── thread/            # Chat thread UI components
│   │   ├── messages/      # Message type renderers (AI, human, tool calls)
│   │   ├── agent-inbox/   # HITL interrupt UI components
│   │   ├── artifact.tsx   # Side panel artifact rendering
│   │   ├── index.tsx      # Main thread component
│   │   └── markdown-text.tsx  # Markdown rendering with KaTeX support
│   └── ui/                # Shadcn UI component library
├── providers/             # React Context providers
│   ├── Stream.tsx         # LangGraph connection management
│   └── Thread.tsx         # Thread list operations
├── hooks/
│   ├── use-file-upload.tsx    # Multi-modal file upload
│   └── useMediaQuery.tsx      # Responsive design hook
└── lib/
    ├── agent-inbox-interrupt.ts   # HITL interrupt schema validation
    ├── ensure-tool-responses.ts   # Tool call/response validation
    ├── multimodal-utils.ts        # File conversion utilities
    └── api-key.tsx                # API key management
```

### Core Providers

The application uses React Context providers to manage global state:

- **StreamProvider** (`src/providers/Stream.tsx`): Manages LangGraph streaming connections via `useStream` hook from `@langchain/langgraph-sdk/react`. Handles:
  - Connection to LangGraph server (apiUrl, assistantId, apiKey)
  - Thread ID management via URL query params
  - Custom events for UI messages
  - State type: `{ messages: Message[], ui?: UIMessage[] }`
  - Shows configuration form if `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_ASSISTANT_ID` are not set
  - Automatic graph status checking on connection

- **ThreadProvider** (`src/providers/Thread.tsx`): Manages thread operations
  - Fetches thread lists from LangGraph server
  - Handles both graph_id and assistant_id metadata searches
  - Uses UUID validation to determine search type

### Environment Variables

**⚠️ CRITICAL: Backend Environment Configuration**
The backend reads environment variables from the **project root `.env` file** (NOT `backend/.env`). This is configured in `backend/langgraph.json` which points to `../env`. All backend configuration (Ollama, embeddings, LangSmith) must be in the root `.env` file.

**Local Development (.env in project root):**
```bash
# Frontend
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=agent

# Backend (LangGraph reads from root .env)
OLLAMA_BASE_URL=http://172.22.160.1:11434  # Use Windows host IP for WSL, or localhost for native
OLLAMA_MODEL=qwen3:8b
EMBEDDING_MODEL=BAAI/bge-m3

# Optional: LangSmith tracing
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=<your-key>
LANGSMITH_PROJECT=<your-project>
```

**Production (API Passthrough):**
```bash
NEXT_PUBLIC_ASSISTANT_ID="agent"
LANGGRAPH_API_URL="https://my-agent.default.us.langgraph.app"  # Server-side only
NEXT_PUBLIC_API_URL="https://my-website.com/api"  # Client connects here
LANGSMITH_API_KEY="lsv2_..."  # Server-side only, injected by proxy
```

**IMPORTANT:**
- Never prefix `LANGSMITH_API_KEY` with `NEXT_PUBLIC_` as it's a secret used server-side only
- Do NOT create `backend/.env` - use root `.env` only
- For WSL users running Ollama on Windows host, use Windows gateway IP (e.g., `http://172.22.160.1:11434`) instead of `localhost`

### API Passthrough

The app includes built-in API passthrough for production deployments:
- Located in `src/app/api/[..._path]/route.ts`
- Uses `langgraph-nextjs-api-passthrough` package
- Proxies all requests to LangGraph server with API key injection
- Requires `LANGGRAPH_API_URL` and `LANGSMITH_API_KEY` environment variables

### Message Visibility Control

**Hide streaming (but show final message):**
Add `langsmith:nostream` tag to chat model config to prevent live streaming while keeping the final message visible.

**Hide messages permanently:**
Prefix message IDs with `do-not-render-` before adding to state (constant: `DO_NOT_RENDER_ID_PREFIX` in `src/lib/ensure-tool-responses.ts`). Also add `langsmith:do-not-render` tag to chat model.

### Artifacts

Artifacts render in a side panel and are accessed via `thread.meta.artifact` context:
- See `src/components/thread/artifact.tsx` for implementation
- Use `useArtifact()` hook to get `[Artifact, { open, setOpen, context, setContext }]`
- Artifact component accepts `title` and `children` props

### Agent Inbox / HITL Interrupts

The app includes a sophisticated human-in-the-loop system:
- **Schema validation**: `src/lib/agent-inbox-interrupt.ts` - validates interrupt structure
- **Types**: `src/components/thread/agent-inbox/types.ts` - defines HITLRequest, ActionRequest, ReviewConfig, Decision types
- **Interrupt structure**: Contains `action_requests` (actions to review) and `review_configs` (allowed decisions per action)
- **Decision types**: `approve`, `edit` (with edited_action), or `reject` (with optional message)

### File Upload

Multi-modal file upload support in `src/hooks/use-file-upload.tsx`:
- Supports images, PDFs, and text files
- Automatically converts uploads to appropriate format for LangGraph messages

### TypeScript Configuration

- Uses `@/*` alias for `./src/*` (configured in `tsconfig.json`)
- Strict mode enabled for type safety
- Target ES2017 for broad browser compatibility
- Incremental compilation for faster rebuild times

## Key Implementation Details

### Message Rendering

Message components render based on message type:
- **AI messages** (`messages/ai.tsx`): Handles streaming, tool calls, and markdown with KaTeX math support
- **Human messages** (`messages/human.tsx`): User input with multimodal content (images, text, PDFs)
- **Tool calls** (`messages/tool-calls.tsx`): Displays tool invocations and results in table format
- **Generic interrupts** (`messages/generic-interrupt.tsx`): Handles custom interrupt messages
- **Shared utilities** (`messages/shared.tsx`): Common rendering logic across message types

All messages respect the `DO_NOT_RENDER_ID_PREFIX` constant (prefix `do-not-render-`) for hiding messages from UI.

### Tool Call Validation

The app ensures all tool calls have corresponding responses via `ensureToolCallsHaveResponses` in `src/lib/ensure-tool-responses.ts`. This prevents UI rendering issues when messages have incomplete tool call/response pairs.

### Multimodal Content Support

- **Images**: Inline preview in messages (JPEG, PNG, GIF, WebP)
- **PDFs**: Uploaded via file input, processed by backend (uses `multimodal-utils.ts` for conversion)
- **Text files**: Converted to text content in messages
- Backend automatically detects content type and routes appropriately

### Thread Management

- Threads are fetched using metadata filters (graph_id or assistant_id)
- Thread IDs persist via URL query parameter `threadId`
- New threads trigger automatic refetch after 4 second delay (see `StreamSession` in Stream.tsx)
- Thread history is loaded with `fetchStateHistory: true` in stream configuration

### Markdown and Math Rendering

Uses `react-markdown` with `remark-gfm` for GitHub-flavored markdown and `remark-math`/`rehype-katex` for LaTeX math support. Syntax highlighting provided by `react-syntax-highlighter`.

### Custom Authentication (Advanced)

For production deployments using custom auth instead of API passthrough:
1. Implement auth token fetching in your app
2. Pass token via `defaultHeaders` in `useTypedStream` hook:
```tsx
defaultHeaders: {
  Authentication: `Bearer ${yourToken}`,
}
```

## Backend Architecture (Optional PDF RAG)

The `backend/` directory contains a LangGraph application for PDF processing and RAG. Built with Python 3.11+ using uv for dependency management.

### Backend Structure and Components

- **Graph configuration** (`langgraph.json`): Defines the graph entry point (`agent: ./src/agent/graph.py:graph`) and environment variable location
- **State management** (`src/agent/state.py`): Defines input schema with message list and optional content blocks for routing decisions
- **Graph definition** (`src/agent/graph.py`): Main LangGraph workflow that orchestrates nodes
- **Routing** (`src/agent/nodes.py`): Auto-routes between PDF processing and chat nodes based on input type
- **PDF processing** (`src/agent/pdf_processor.py`): Text extraction, chunking (1000 chars, 200 overlap), and metadata tracking
- **Vector storage** (`src/agent/vector_store.py`): ChromaDB integration for persistent storage at `./chroma_db`
- **Embeddings** (`src/agent/embedding_service.py`): BGE-M3 embeddings via sentence-transformers

### RAG (Retrieval-Augmented Generation) System

The chat system now includes RAG functionality:

**How it works:**
1. User uploads a PDF → `process_pdf_node` extracts, chunks (1000 chars, 200 overlap), embeds with BGE-M3, and stores in ChromaDB
2. User asks a question → `chat_node` searches ChromaDB for 5 most relevant chunks using semantic similarity
3. LLM receives both user query and document chunks as context
4. Response includes source attribution with:
   - Relevance star rating (⭐⭐⭐⭐⭐ = perfect match)
   - Cosine similarity score (0.15 = excellent, lower is better)
   - Source document and page number
   - Text preview of each chunk

**Chunking Details:**
- **Strategy**: RecursiveCharacterTextSplitter with intelligent fallback (paragraphs → lines → sentences → words → characters)
- **Configuration**: 1000 char chunks with 200 char overlap (preserves context at boundaries)
- **Metadata tracked**: Filename, page number, chunk index, character count, creation timestamp

**Embedding Model:**
- **Model**: BAAI/bge-m3 (multilingual, Korean-optimized)
- **Dimensions**: 1024-dimensional dense vectors
- **Supports**: Korean, English, 100+ languages
- **Processing**: 138 chunks (~50 pages) embedded in 2-3 seconds on CPU

### LLM Integration

Uses Ollama with local models (configure via `OLLAMA_BASE_URL` and model selection in environment). Production deployments can substitute with cloud LLM providers.

### Frontend Integration

To connect the frontend to the backend:
1. Ensure backend is running: `cd backend && uv run langgraph dev` (http://localhost:2024)
2. Set frontend environment variables:
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:2024
   NEXT_PUBLIC_ASSISTANT_ID=agent
   ```
3. Upload PDFs via the file input button - backend auto-detects and processes them:
   - Displays processing status (extraction, chunking, embedding, storage)
   - Shows page count, character count, chunk statistics
   - Stores embeddings in ChromaDB for future queries
4. Ask questions about the document:
   - `chat_node` retrieves relevant chunks from ChromaDB
   - Passes chunks as context to LLM
   - Displays answer with detailed source attribution including:
     * **Chunks Table**: Quick overview of all 5 retrieved chunks with document, page, similarity score, and content preview
     * **Document References**: Detailed breakdown organized by source document showing:
       - Pages referenced
       - Number of chunks used
       - Total characters retrieved
       - Per-chunk metadata including position (chunk index), quality rating, size, and content
     * **Quality Labels**: Score-based quality labels (Perfect < 0.20, Excellent < 0.30, Good < 0.40, Fair < 0.50, Weak ≥ 0.50)
5. Chat history and embeddings persist in ChromaDB across sessions

### Python Dependency Management

Backend dependencies are declared in `pyproject.toml`. The `requirements.txt` is auto-generated for deployment. When adding/updating Python packages, always modify `pyproject.toml` and run `uv pip install -r requirements.txt` (or let uv sync dependencies automatically).

## Development Setup and Quality Checks

### Initial Setup
1. Clone the repository: `git clone https://github.com/langchain-ai/agent-chat-ui.git`
2. Install frontend dependencies: `pnpm install`
3. **Create `.env` file in project root** (NOT in `backend/`) with environment variables (see Environment Variables section)
   - **CRITICAL:** Backend's `langgraph.json` references `../env`, which means it reads from the project root `.env` file
   - Configure Ollama URL, model, and embeddings in the root `.env` file
   - For WSL users: Use Windows host IP (e.g., `http://172.22.160.1:11434`) for `OLLAMA_BASE_URL`
4. (Optional) Set up backend:
   - Navigate to `backend/` directory
   - Create virtual environment: `uv venv`
   - Activate: `source .venv/bin/activate` (Linux/Mac) or `.venv\Scripts\activate` (Windows)
   - Install dependencies: `uv pip install -r requirements.txt`
   - Ensure Ollama is running with your chosen model
   - **Do NOT create `backend/.env`** - backend reads from root `.env`

### Code Quality
Before committing, run:
```bash
# Format code with Prettier (tailwind class ordering included)
pnpm format

# Check linting (ESLint for TypeScript and React)
pnpm lint

# Fix linting issues automatically
pnpm lint:fix

# Verify formatting without making changes
pnpm format:check
```

These tools are configured in:
- **Linting**: ESLint (Next.js config in `eslintrc.json`)
- **Formatting**: Prettier with tailwindcss plugin (config in `prettier.config.js`)
- **Build system**: Next.js with TailwindCSS v4

### Next.js Configuration
- **Body size limit**: 10MB for server actions (supports large file uploads)
- **Target**: ES2017 JavaScript
- Uses incremental builds for faster development iterations

## Package Manager

Uses `pnpm` (version 10.5.1 specified in package.json)
