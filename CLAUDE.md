# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Chat UI is a Next.js application that provides a chat interface for any LangGraph server with a `messages` key. It enables real-time streaming communication with LangGraph deployments and includes features like human-in-the-loop (HITL) interrupts, artifacts rendering, and thread management.

## Common Commands

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

## Architecture

### Core Providers

The application uses React Context providers to manage global state:

- **StreamProvider** (`src/providers/Stream.tsx`): Manages LangGraph streaming connections via `useStream` hook from `@langchain/langgraph-sdk/react`. Handles:
  - Connection to LangGraph server (apiUrl, assistantId, apiKey)
  - Thread ID management via URL query params
  - Custom events for UI messages
  - State type: `{ messages: Message[], ui?: UIMessage[] }`
  - Shows configuration form if `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_ASSISTANT_ID` are not set

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

### Tool Call Validation

The app ensures all tool calls have corresponding responses via `ensureToolCallsHaveResponses` in `src/lib/ensure-tool-responses.ts`. This prevents UI rendering issues when messages have incomplete tool call/response pairs.

### Thread Management

- Threads are fetched using metadata filters (graph_id or assistant_id)
- Thread IDs persist via URL query parameter `threadId`
- New threads trigger automatic refetch after 4 second delay (see `StreamSession` in Stream.tsx)

### State History

The stream hook has `fetchStateHistory: true` enabled, allowing historical state to be loaded when viewing existing threads.

### Custom Authentication (Advanced)

For production deployments using custom auth instead of API passthrough:
1. Implement auth token fetching in your app
2. Pass token via `defaultHeaders` in `useTypedStream` hook:
```tsx
defaultHeaders: {
  Authentication: `Bearer ${yourToken}`,
}
```

## Package Manager

Uses `pnpm` (version 10.5.1 specified in package.json)
