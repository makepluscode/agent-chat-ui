#!/bin/bash

# Agent Chat UI - Run script
# Usage: ./run.sh [dev|build|start]
# Default: dev

set -e

COMMAND=${1:-dev}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

case "$COMMAND" in
    dev)
        echo -e "${BLUE}🚀 Starting development environment...${NC}"

        # Check and create .env.local
        if [ ! -f ".env.local" ]; then
            cp .env.example .env.local
            echo -e "${GREEN}✅ Created .env.local${NC}"
        fi

        # Check and create backend/.env
        if [ ! -f "backend/.env" ]; then
            cp backend/.env.example backend/.env
            echo -e "${GREEN}✅ Created backend/.env${NC}"
        fi

        # Install Node dependencies if needed
        if [ ! -d "node_modules" ]; then
            echo -e "${BLUE}📦 Installing Node dependencies...${NC}"
            pnpm install
        fi

        # Setup backend venv if needed
        if [ ! -d "backend/.venv" ]; then
            echo -e "${BLUE}📦 Setting up Python virtual environment...${NC}"
            cd backend
            uv venv
            source .venv/bin/activate
            uv pip install -r requirements.txt > /dev/null 2>&1
            cd ..
            echo -e "${GREEN}✅ Python environment ready${NC}"
        fi

        echo ""
        echo -e "${YELLOW}Starting services...${NC}"
        echo ""

        # Start backend and frontend in parallel
        (
            cd backend
            source .venv/bin/activate
            echo -e "${BLUE}[Backend]${NC} Starting LangGraph dev server on port 2024..."
            uv run langgraph dev
        ) &
        BACKEND_PID=$!

        sleep 2

        (
            echo -e "${BLUE}[Frontend]${NC} Starting Next.js dev server on port 3000..."
            pnpm dev
        ) &
        FRONTEND_PID=$!

        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}✅ Services started!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
        echo ""
        echo -e "${YELLOW}📍 Access URLs:${NC}"
        echo "   🌐 Frontend: http://localhost:3000"
        echo "   🌐 Backend:  http://localhost:2024"
        echo "   📚 API Docs: http://localhost:2024/docs"
        echo ""
        echo -e "${YELLOW}💡 Make sure Ollama is running:${NC}"
        echo "   ollama serve"
        echo ""

        # Wait for both processes
        wait $BACKEND_PID $FRONTEND_PID
        ;;

    build)
        echo -e "${BLUE}🔨 Building production...${NC}"
        pnpm build
        echo -e "${GREEN}✅ Build complete${NC}"
        ;;

    start)
        echo -e "${BLUE}🚀 Starting production server...${NC}"
        if [ ! -d ".next" ]; then
            echo -e "${RED}❌ Build not found. Run './run.sh build' first${NC}"
            exit 1
        fi
        pnpm start
        ;;

    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo ""
        echo "Usage: ./run.sh [command]"
        echo ""
        echo "Commands:"
        echo "  dev     - Start development server (default)"
        echo "  build   - Build for production"
        echo "  start   - Start production server"
        echo ""
        exit 1
        ;;
esac
