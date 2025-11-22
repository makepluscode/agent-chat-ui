# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Chat UI is a Next.js application that provides a chat interface for any LangGraph server with a `messages` key. It enables real-time streaming communication with LangGraph deployments and includes features like human-in-the-loop (HITL) interrupts, artifacts rendering, and thread management.

This repository includes both a Next.js frontend and an optional Python LangGraph backend for PDF RAG functionality.

## Common Commands

### Frontend (Next.js)

```bash
# Install dependencies
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

**Local Development:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:2024
NEXT_PUBLIC_ASSISTANT_ID=agent
```

**Production (API Passthrough):**
```bash
NEXT_PUBLIC_ASSISTANT_ID="agent"
LANGGRAPH_API_URL="https://my-agent.default.us.langgraph.app"  # Server-side only
NEXT_PUBLIC_API_URL="https://my-website.com/api"  # Client connects here
LANGSMITH_API_KEY="lsv2_..."  # Server-side only, injected by proxy
```

**IMPORTANT:** Never prefix `LANGSMITH_API_KEY` with `NEXT_PUBLIC_` as it's a secret used server-side only.

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

### TypeScript Path Aliases

Uses `@/*` alias for `./src/*` (configured in `tsconfig.json`)

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

The `backend/` directory contains a LangGraph application for PDF processing and RAG:

- **State management** (`src/agent/state.py`): Defines input schema with message list and optional content blocks
- **Routing** (`src/agent/nodes.py`): Auto-routes between PDF processing and chat based on input
- **PDF processing** (`src/agent/pdf_processor.py`): Extracts text, chunks (1000 chars, 200 overlap), and embeds with BGE-M3
- **Vector storage** (`ChromaDB`): Local persistent storage at `./chroma_db`
- **LLM integration** (`Ollama`): Uses local models (default: gemma3:12b)

To integrate with frontend:
1. Set `NEXT_PUBLIC_API_URL=http://localhost:2024` (or production URL)
2. Backend automatically handles file uploads and chat history
3. Embedding status visible in embedding-status.tsx component

## Package Manager

Uses `pnpm` (version 10.5.1 specified in package.json)
