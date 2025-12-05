#!/bin/bash

# Agent Chat UI - Run script using pm2
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

# App names in pm2
FRONTEND_APP="agent-chat-frontend"
BACKEND_APP="agent-chat-backend"

# Stop services
stop_services() {
    echo -e "${YELLOW}🛑 Stopping services with pm2...${NC}"
    pnpm exec pm2 delete $FRONTEND_APP > /dev/null 2>&1 || true
    pnpm exec pm2 delete $BACKEND_APP > /dev/null 2>&1 || true
    pnpm exec pm2 save --force > /dev/null 2>&1 || true
    echo -e "${GREEN}✅ Services stopped${NC}"
}

# Check and setup environment files
setup_env_files() {
    if [ ! -f ".env.local" ] && [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo -e "${GREEN}✅ Created .env.local from .env.example${NC}"
    fi
    if [ ! -f ".env" ] && [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env from .env.example (for backend)${NC}"
    fi
}

# Check for required commands
check_dependencies() {
    local missing=()
    if ! command -v pnpm >/dev/null 2>&1; then missing+=("pnpm"); fi
    if ! command -v uv >/dev/null 2>&1; then missing+=("uv"); fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing dependencies: ${missing[*]}${NC}"
        echo "Please install them. e.g., 'npm install -g pnpm', 'curl -LsSf https://astral.sh/uv/install.sh | sh'"
        exit 1
    fi
}

# Start services
start_services() {
    echo -e "${BLUE}🚀 Starting services with pm2...${NC}"

    check_dependencies
    setup_env_files

    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Installing Node dependencies...${NC}"
        pnpm install
    fi

    if [ ! -d "backend/.venv" ]; then
        echo -e "${BLUE}📦 Setting up Python virtual environment...${NC}"
        (cd backend && uv venv && source .venv/bin/activate && uv pip install -r requirements.txt)
        echo -e "${GREEN}✅ Python environment ready${NC}"
    fi

    echo ""
    echo -e "${YELLOW}Starting backend...${NC}"
    (
      cd backend
      source .venv/bin/activate
      pnpm exec pm2 start "uv run langgraph dev --host 0.0.0.0 --port 2024" --cwd backend --name $BACKEND_APP
    )


    echo -e "${YELLOW}Starting frontend...${NC}"
    pnpm exec pm2 start "sh" --name $FRONTEND_APP -- -c "cd $(pwd) && pnpm run dev"

    sleep 2
    echo ""
    pnpm exec pm2 list
    echo ""
    echo -e "${GREEN}✅ Services started. Use './run.sh dev' to view logs.${NC}"
    echo -e "${YELLOW}📍 Access Frontend: http://localhost:3000${NC}"
}

case "$COMMAND" in
    restart)
        echo -e "${BLUE}🔄 Restarting services...${NC}"
        stop_services
        start_services
        ;;

    start)
        start_services
        ;;

    stop)
        stop_services
        ;;

    dev)
        echo -e "${BLUE}👀 Tailing logs from pm2... (Press Ctrl+C to stop)${NC}"
        pnpm exec pm2 logs
        ;;

    build)
        echo -e "${BLUE}🔨 Building production frontend...${NC}"
        check_dependencies
        pnpm build
        echo -e "${GREEN}✅ Build complete${NC}"
        ;;

    prod)
        echo -e "${BLUE}🚀 Starting production server with pm2...${NC}"
        if [ ! -d ".next" ]; then
            echo -e "${RED}❌ Build not found. Run './run.sh build' first${NC}"
            exit 1
        fi
        check_dependencies
        stop_services
        pnpm exec pm2 start "sh" --name $FRONTEND_APP -- -c "cd $(pwd) && pnpm start"
        pnpm exec pm2 list
        ;;

    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        # ... (omitting help text for brevity)
        exit 1
        ;;
esac
