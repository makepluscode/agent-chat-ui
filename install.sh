#!/usr/bin/env bash
set -euo pipefail

# Usage flags (set to 1 to skip specific steps)
#   SKIP_SYSTEM=1        -> Skip apt-based system installs
#   SKIP_FRONTEND=1      -> Skip Node/pnpm/frontend setup
#   SKIP_CLI=1           -> Skip langgraph CLI (node) install
#   SKIP_MODEL_DOWNLOAD=1-> Skip downloading embedding model

echo "=== Agent Chat UI setup ==="

# Detect sudo availability
SUDO=""
if command -v sudo >/dev/null 2>&1; then
  SUDO="sudo -n"
fi

# 1) System dependencies (optional)
if [ "${SKIP_SYSTEM:-0}" -ne 1 ]; then
  if command -v apt >/dev/null 2>&1; then
    echo "=== Updating system packages (apt) ==="
    $SUDO apt update || true
    $SUDO apt install -y curl git build-essential pkg-config libssl-dev || true
  else
    echo "apt not found; skipping system package installation"
  fi
else
  echo "Skipping system package installation (SKIP_SYSTEM=1)"
fi

# 2) Node.js / pnpm / frontend (optional)
if [ "${SKIP_FRONTEND:-0}" -ne 1 ]; then
  if ! command -v node >/dev/null 2>&1; then
    if [ "${SKIP_SYSTEM:-0}" -ne 1 ] && command -v apt >/dev/null 2>&1; then
      echo "=== Installing Node.js 20 (NodeSource) ==="
      curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash - || true
      $SUDO apt install -y nodejs || true
    else
      echo "Node.js not found and system install disabled; skipping Node setup"
    fi
  fi

  echo "=== Enabling corepack & pnpm ==="
  $SUDO corepack enable || true
  corepack prepare pnpm@latest --activate || true

  # Fallback pnpm installer
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "Installing pnpm via curl installer..."
    curl -fsSL https://get.pnpm.io/install.sh | sh - || true
    echo 'export PATH="$HOME/.local/share/pnpm:$PATH"' >> "$HOME/.bashrc"
    # shellcheck source=/dev/null
    source "$HOME/.bashrc" || true
  fi

  # Setup pnpm PATH
  if command -v pnpm >/dev/null 2>&1; then
    echo "=== Setting up pnpm ==="
    pnpm setup || true
    export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
    export PATH="$PNPM_HOME:$PATH"
    echo "=== Installing frontend dependencies ==="
    pnpm install || true
  else
    echo "pnpm not available; skipping frontend dependency install"
  fi
else
  echo "Skipping frontend setup (SKIP_FRONTEND=1)"
fi

# 3) uv (Python) and backend
if ! command -v uv >/dev/null 2>&1; then
  echo "=== Installing uv (Python package manager) ==="
  curl -LsSf https://astral.sh/uv/install.sh | sh
  if [ -d "$HOME/.local/bin" ]; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi

echo "=== Setting up Python backend ==="
cd backend || { echo "backend directory not found, skipping Python setup"; exit 0; }

# Create virtual environment and install dependencies
uv venv
# shellcheck source=/dev/null
source .venv/bin/activate
uv pip install -r requirements.txt

# Install langgraph CLI and API packages
echo "=== Installing langgraph-cli and langgraph-api ==="
uv pip install langgraph-cli
uv pip install "langgraph-cli[inmem]"

# Optional: pre-download BGE-M3 only if using sentence_transformers
if [ "${SKIP_MODEL_DOWNLOAD:-0}" -ne 1 ] && [ "${EMBEDDING_PROVIDER:-sentence_transformers}" = "sentence_transformers" ]; then
  echo "=== Downloading BGE-M3 embedding model ==="
  python3 << 'PYEOF'
from sentence_transformers import SentenceTransformer
print("Downloading BAAI/bge-m3 model...")
SentenceTransformer('BAAI/bge-m3')
print("✅ BGE-M3 model downloaded successfully!")
PYEOF
else
  echo "Skipping model download (SKIP_MODEL_DOWNLOAD=1 or EMBEDDING_PROVIDER!=sentence_transformers)"
fi

cd ..

# 4) Optional: langgraph CLI via node (not required for backend)
if [ "${SKIP_CLI:-0}" -ne 1 ] && command -v pnpm >/dev/null 2>&1; then
  echo "=== Installing langgraph CLI (node) ==="
  pnpm add -g langgraph || echo "Warning: langgraph CLI (node) installation failed"
  if command -v langgraph >/dev/null 2>&1; then
    langgraph --version || true
  fi
else
  echo "Skipping node-based langgraph CLI install (SKIP_CLI=1 or pnpm not available)"
fi

echo ""
echo "=== All installations completed (best effort) ==="
echo ""
echo "Next steps:"
echo "1. Run: source ~/.bashrc"
echo "2. Frontend: pnpm dev  (or: pnpm install && pnpm dev)"
echo "3. Backend:  cd backend && source .venv/bin/activate && uv run langgraph dev"
echo ""
