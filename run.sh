#!/bin/bash

# Agent Chat UI - Run script
# Usage: ./run.sh [restart|start|stop|dev|build|prod]
# Default: restart

set -e

COMMAND=${1:-restart}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
FRONTEND_PORT=3000
BACKEND_PORT=2024
BACKEND_PID_FILE=".backend.pid"
FRONTEND_PID_FILE=".frontend.pid"

# Helper: Kill process by PID with grace period
kill_process() {
    local pid=$1
    local name=$2

    if ! ps -p "$pid" > /dev/null 2>&1; then
        return 0
    fi

    echo -e "${BLUE}   Stopping $name (PID: $pid)...${NC}"

    # Try graceful shutdown first
    kill "$pid" 2>/dev/null || true

    # Wait up to 3 seconds for graceful shutdown
    for i in {1..6}; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
        sleep 0.5
    done

    # Force kill if still running
    echo -e "${BLUE}   Force killing $name (PID: $pid)...${NC}"
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.5
}

# Helper: Kill process by port
kill_port() {
    local port=$1
    local killed=false

    # Try lsof first (most reliable)
    if command -v lsof >/dev/null 2>&1; then
        if lsof -ti:$port > /dev/null 2>&1; then
            echo -e "${BLUE}   Killing process on port $port...${NC}"
            lsof -ti:$port | xargs -r kill -9 2>/dev/null || true
            killed=true
        fi
    fi

    # Fallback to fuser
    if ! $killed && command -v fuser >/dev/null 2>&1; then
        if fuser $port/tcp >/dev/null 2>&1; then
            echo -e "${BLUE}   Killing process on port $port (fuser)...${NC}"
            fuser -k -9 $port/tcp 2>/dev/null || true
            killed=true
        fi
    fi

    # Fallback to netstat + kill
    if ! $killed; then
        local pid=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d/ -f1 | head -1)
        if [ -n "$pid" ] && [ "$pid" != "-" ]; then
            echo -e "${BLUE}   Killing process on port $port (netstat)...${NC}"
            kill -9 "$pid" 2>/dev/null || true
            killed=true
        fi
    fi

    return 0
}

# Cleanup ports
cleanup_ports() {
    echo -e "${YELLOW}🧹 Cleaning up ports $FRONTEND_PORT and $BACKEND_PORT...${NC}"

    kill_port $FRONTEND_PORT
    kill_port $BACKEND_PORT

    echo -e "${GREEN}✅ Ports cleaned${NC}"
}

# Kill zombie processes by name pattern
kill_zombies() {
    echo -e "${YELLOW}🧟 Cleaning up zombie processes...${NC}"

    # Kill Next.js processes (multiple patterns for different execution modes)
    pkill -9 -f "next dev" 2>/dev/null || true
    pkill -9 -f "next-server" 2>/dev/null || true
    pkill -9 -f "pnpm.*dev" 2>/dev/null || true

    # Kill LangGraph processes
    pkill -9 -f "langgraph dev" 2>/dev/null || true
    pkill -9 -f "uvicorn.*langgraph" 2>/dev/null || true

    # Clean up PID files
    rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"

    echo -e "${GREEN}✅ Zombies cleaned${NC}"
}

# Stop services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping services...${NC}"

    local stopped_any=false

    # Stop backend via PID file
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        kill_process "$BACKEND_PID" "backend"
        rm -f "$BACKEND_PID_FILE"
        stopped_any=true
    fi

    # Stop frontend via PID file
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        kill_process "$FRONTEND_PID" "frontend"
        rm -f "$FRONTEND_PID_FILE"
        stopped_any=true
    fi

    # Always cleanup ports and zombies to catch processes not tracked by PID files
    # This is crucial for processes started outside of run.sh
    cleanup_ports
    kill_zombies

    if ! $stopped_any; then
        echo -e "${BLUE}   No PID files found, cleaned up by port and process name${NC}"
    fi

    echo -e "${GREEN}✅ Services stopped${NC}"
}

# Check and setup environment files
setup_env_files() {
    # Check and create .env.local for frontend
    if [ ! -f ".env.local" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env.local
            echo -e "${GREEN}✅ Created .env.local from .env.example${NC}"
        else
            echo -e "${YELLOW}⚠️  Warning: .env.example not found, skipping .env.local creation${NC}"
        fi
    fi

    # Check root .env for backend (required by langgraph.json)
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${GREEN}✅ Created .env from .env.example (backend reads from here)${NC}"
        else
            echo -e "${YELLOW}⚠️  Warning: .env not found. Backend requires .env in project root!${NC}"
            echo -e "${YELLOW}   (langgraph.json points to ../env)${NC}"
        fi
    fi

    # Note: backend/.env is NOT used (langgraph.json points to ../env = project root .env)
    # We intentionally do not create backend/.env to avoid confusion
}

# Check for required commands
check_dependencies() {
    local missing=()

    # Check for pnpm (try common locations)
    if ! command -v pnpm >/dev/null 2>&1; then
        if [ -f "$HOME/.npm-global/bin/pnpm" ]; then
            export PATH="$HOME/.npm-global/bin:$PATH"
        elif [ -f "$HOME/.local/share/pnpm/pnpm" ]; then
            export PATH="$HOME/.local/share/pnpm:$PATH"
        else
            missing+=("pnpm")
        fi
    fi

    # Check for uv (backend)
    if ! command -v uv >/dev/null 2>&1; then
        missing+=("uv")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing dependencies: ${missing[*]}${NC}"
        echo ""
        echo "Install missing dependencies:"
        for dep in "${missing[@]}"; do
            case $dep in
                pnpm)
                    echo "  npm install -g pnpm"
                    ;;
                uv)
                    echo "  curl -LsSf https://astral.sh/uv/install.sh | sh"
                    ;;
            esac
        done
        exit 1
    fi
}

# Start services
start_services() {
    echo -e "${BLUE}🚀 Starting services...${NC}"

    # Check dependencies first
    check_dependencies

    # Setup environment files
    setup_env_files

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

    # Start backend in background
    (
        cd backend
        source .venv/bin/activate
        echo -e "${BLUE}[Backend]${NC} Starting LangGraph dev server on port $BACKEND_PORT..."
        uv run langgraph dev > /dev/null 2>&1
    ) &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > "$BACKEND_PID_FILE"

    # Wait a bit for backend to initialize
    sleep 2

    # Start frontend in background
    (
        echo -e "${BLUE}[Frontend]${NC} Starting Next.js dev server on port $FRONTEND_PORT..."
        pnpm dev > /dev/null 2>&1
    ) &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"

    # Wait a bit to check if services started successfully
    sleep 2

    # Verify services are running
    local backend_running=false
    local frontend_running=false

    if ps -p "$BACKEND_PID" > /dev/null 2>&1; then
        backend_running=true
    fi

    if ps -p "$FRONTEND_PID" > /dev/null 2>&1; then
        frontend_running=true
    fi

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    if $backend_running && $frontend_running; then
        echo -e "${GREEN}✅ Services started successfully!${NC}"
    elif $backend_running; then
        echo -e "${YELLOW}⚠️  Backend started, but frontend may have issues${NC}"
    elif $frontend_running; then
        echo -e "${YELLOW}⚠️  Frontend started, but backend may have issues${NC}"
    else
        echo -e "${RED}❌ Services may have failed to start${NC}"
        echo -e "${YELLOW}💡 Try './run.sh dev' to see error logs${NC}"
    fi
    echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}📍 Access URLs:${NC}"
    echo "   🌐 Frontend: http://localhost:$FRONTEND_PORT"
    echo "   🌐 Backend:  http://localhost:$BACKEND_PORT"
    echo "   📚 API Docs: http://localhost:$BACKEND_PORT/docs"
    echo ""
    echo -e "${YELLOW}💡 Tips:${NC}"
    echo "   • Stop services: ./run.sh stop"
    echo "   • View logs: ./run.sh dev"
    echo "   • Restart: ./run.sh restart"
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

        # Check dependencies
        check_dependencies

        # Setup environment files
        setup_env_files

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
        echo -e "${YELLOW}Starting services with live logs...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop both services${NC}"
        echo ""
        sleep 1

        # Trap Ctrl+C to cleanly stop both processes
        trap 'echo -e "\n${YELLOW}Stopping services...${NC}"; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; cleanup_ports; kill_zombies; exit 0' INT TERM

        # Start backend with visible logs
        (
            cd backend
            source .venv/bin/activate
            echo -e "${BLUE}[Backend]${NC} Starting LangGraph dev server on port $BACKEND_PORT..."
            echo ""
            uv run langgraph dev 2>&1 | sed 's/^/[Backend] /'
        ) &
        BACKEND_PID=$!

        sleep 3

        # Start frontend with visible logs
        (
            echo -e "${BLUE}[Frontend]${NC} Starting Next.js dev server on port $FRONTEND_PORT..."
            echo ""
            pnpm dev 2>&1 | sed 's/^/[Frontend] /'
        ) &
        FRONTEND_PID=$!

        # Wait for both processes
        wait $BACKEND_PID $FRONTEND_PID
        ;;

    build)
        echo -e "${BLUE}🔨 Building production...${NC}"
        check_dependencies
        pnpm build
        echo -e "${GREEN}✅ Build complete${NC}"
        ;;

    prod)
        echo -e "${BLUE}🚀 Starting production server...${NC}"
        if [ ! -d ".next" ]; then
            echo -e "${RED}❌ Build not found. Run './run.sh build' first${NC}"
            exit 1
        fi
        check_dependencies
        echo ""
        echo -e "${YELLOW}📍 Production server will start on:${NC}"
        echo "   🌐 http://localhost:3000"
        echo ""
        pnpm start
        ;;

    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo ""
        echo -e "${YELLOW}Usage:${NC} ./run.sh [command]"
        echo ""
        echo -e "${YELLOW}Commands:${NC}"
        echo "  ${GREEN}restart${NC} - Stop and start services in background (default)"
        echo "  ${GREEN}start${NC}   - Start services in background"
        echo "  ${GREEN}stop${NC}    - Stop all services (kills by PID, port, and process name)"
        echo "  ${GREEN}dev${NC}     - Start development server with live logs"
        echo "  ${GREEN}build${NC}   - Build for production"
        echo "  ${GREEN}prod${NC}    - Start production server"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo "  ./run.sh          # Restart services"
        echo "  ./run.sh start    # Start in background"
        echo "  ./run.sh dev      # Start with logs visible"
        echo "  ./run.sh stop     # Stop all services"
        echo ""
        exit 1
        ;;
esac
