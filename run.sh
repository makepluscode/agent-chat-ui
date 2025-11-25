#!/bin/bash

# Agent Chat UI - Run script
# Usage: ./run.sh [restart|start|stop|dev|build]
# Default: restart

set -e

COMMAND=${1:-restart}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# PID files
BACKEND_PID_FILE=".backend.pid"
FRONTEND_PID_FILE=".frontend.pid"

# Cleanup ports
cleanup_ports() {
    echo -e "${YELLOW}🧹 Cleaning up ports 3000 and 2024...${NC}"

    # Kill processes on port 3000
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo -e "${BLUE}   Killing process on port 3000...${NC}"
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    fi

    # Kill processes on port 2024
    if lsof -ti:2024 > /dev/null 2>&1; then
        echo -e "${BLUE}   Killing process on port 2024...${NC}"
        lsof -ti:2024 | xargs kill -9 2>/dev/null || true
    fi

    echo -e "${GREEN}✅ Ports cleaned${NC}"
}

# Kill zombie processes
kill_zombies() {
    echo -e "${YELLOW}🧟 Cleaning up zombie processes...${NC}"

    # Kill any orphaned next/node processes
    pkill -9 -f "next dev" 2>/dev/null || true
    pkill -9 -f "langgraph dev" 2>/dev/null || true

    # Clean up PID files
    rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"

    echo -e "${GREEN}✅ Zombies cleaned${NC}"
}

# Stop services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping services...${NC}"

    # Stop backend
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
            echo -e "${BLUE}   Stopping backend (PID: $BACKEND_PID)...${NC}"
            kill "$BACKEND_PID" 2>/dev/null || true
            sleep 1
            kill -9 "$BACKEND_PID" 2>/dev/null || true
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # Stop frontend
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
            echo -e "${BLUE}   Stopping frontend (PID: $FRONTEND_PID)...${NC}"
            kill "$FRONTEND_PID" 2>/dev/null || true
            sleep 1
            kill -9 "$FRONTEND_PID" 2>/dev/null || true
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # Cleanup ports and zombies as backup
    cleanup_ports
    kill_zombies

    echo -e "${GREEN}✅ Services stopped${NC}"
}

# Start services
start_services() {
    echo -e "${BLUE}🚀 Starting services...${NC}"

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

    # Start backend
    (
        cd backend
        source .venv/bin/activate
        echo -e "${BLUE}[Backend]${NC} Starting LangGraph dev server on port 2024..."
        uv run langgraph dev > /dev/null 2>&1
    ) &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"

    sleep 2

    # Start frontend
    (
        echo -e "${BLUE}[Frontend]${NC} Starting Next.js dev server on port 3000..."
        pnpm dev > /dev/null 2>&1
    ) &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"

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
    echo -e "${YELLOW}💡 To stop services:${NC}"
    echo "   ./run.sh stop"
    echo ""
}

case "$COMMAND" in
    restart)
        echo -e "${BLUE}🔄 Restarting services...${NC}"
        echo ""
        stop_services
        echo ""
        cleanup_ports
        echo ""
        start_services
        ;;

    start)
        cleanup_ports
        kill_zombies
        echo ""
        start_services
        ;;

    stop)
        stop_services
        ;;

    dev)
        echo -e "${BLUE}🚀 Starting development environment (interactive mode)...${NC}"
        echo ""

        # Clean up first
        cleanup_ports
        kill_zombies
        echo ""

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
        echo -e "${YELLOW}Starting services (with logs)...${NC}"
        echo ""

        # Start backend and frontend in parallel (with logs visible)
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
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        echo ""

        # Wait for both processes
        wait $BACKEND_PID $FRONTEND_PID
        ;;

    build)
        echo -e "${BLUE}🔨 Building production...${NC}"
        pnpm build
        echo -e "${GREEN}✅ Build complete${NC}"
        ;;

    prod)
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
        echo "  restart - Stop and start services (default)"
        echo "  start   - Start services in background"
        echo "  stop    - Stop all services"
        echo "  dev     - Start development server with logs"
        echo "  build   - Build for production"
        echo "  prod    - Start production server"
        echo ""
        exit 1
        ;;
esac
