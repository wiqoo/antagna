#!/usr/bin/env bash
# scripts/bootstrap.sh — Bootstrap Antagna on a fresh Ubuntu machine.
#
# Parametrized version of the legacy ./antagna-bootstrap.sh.
# Configure via env vars (or use defaults):
#
#   GITHUB_USER=wiqoo                   # GitHub owner of the antagna repo
#   REPO_NAME=antagna                   # repo name to clone
#   CODE_DIR="$HOME/antagna"            # where the repo lands locally
#   NODE_VERSION=20                     # via nvm
#   INSTALL_DOCKER=1                    # 1 = install Docker, 0 = skip
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/wiqoo/antagna/main/scripts/bootstrap.sh -o /tmp/bootstrap.sh
#   bash /tmp/bootstrap.sh
#
# Or, after the repo is cloned, just: bash scripts/bootstrap.sh

set -euo pipefail

GITHUB_USER="${GITHUB_USER:-wiqoo}"
REPO_NAME="${REPO_NAME:-antagna}"
CODE_DIR="${CODE_DIR:-$HOME/antagna}"
NODE_VERSION="${NODE_VERSION:-20}"
INSTALL_DOCKER="${INSTALL_DOCKER:-1}"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'

say()  { echo -e "${CYAN}==> $*${NC}"; }
step() { echo -e "${YELLOW}[$1] $2${NC}"; }
done_msg() { echo -e "${GREEN}✓ $*${NC}"; }
fail() { echo -e "${RED}✗ $*${NC}"; exit 1; }

say "Antagna bootstrap — github.com/${GITHUB_USER}/${REPO_NAME} → ${CODE_DIR}"

# 1. System essentials
step "1/8" "System update + essentials"
sudo apt update
sudo apt install -y curl git build-essential ca-certificates gnupg lsb-release unzip jq direnv

# 2. Node + nvm
step "2/8" "Node.js ${NODE_VERSION} via nvm"
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install "$NODE_VERSION"
nvm alias default "$NODE_VERSION"
done_msg "Node $(node -v)"

# 3. pnpm
step "3/8" "pnpm"
corepack enable
corepack prepare pnpm@latest --activate
done_msg "pnpm $(pnpm -v)"

# 4. Globals: Claude Code, Supabase, Vercel, Trigger.dev
step "4/8" "Global CLIs: Claude Code, Supabase, Vercel, Trigger.dev"
npm install -g @anthropic-ai/claude-code supabase vercel
npm install -g @trigger.dev/cli@latest || true  # falls back to npx
done_msg "global CLIs installed"

# 5. Docker (optional)
if [ "$INSTALL_DOCKER" = "1" ]; then
  step "5/8" "Docker"
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo -e "${YELLOW}NOTE: log out and back in for docker group to take effect.${NC}"
  else
    done_msg "Docker already installed: $(docker --version)"
  fi
else
  step "5/8" "Docker — SKIPPED (INSTALL_DOCKER=0)"
fi

# 6. GitHub CLI + auth
step "6/8" "GitHub CLI + auth"
if ! command -v gh &>/dev/null; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update
  sudo apt install -y gh
fi
if ! gh auth status &>/dev/null; then
  say "Login to GitHub (browser will open OR you'll get a code)..."
  gh auth login --git-protocol https --web
fi

# 7. Clone the repo
step "7/8" "Clone ${GITHUB_USER}/${REPO_NAME} → ${CODE_DIR}"
if [ ! -d "$CODE_DIR/.git" ]; then
  gh repo clone "${GITHUB_USER}/${REPO_NAME}" "$CODE_DIR"
else
  say "${CODE_DIR} already cloned; pulling latest…"
  (cd "$CODE_DIR" && git pull --ff-only)
fi

# 8. Show next steps
step "8/8" "Next steps"
echo ""
done_msg "Bootstrap complete."
echo ""
echo -e "${CYAN}1. Configure env vars (copy + edit):${NC}"
echo "     cd $CODE_DIR && cp .env.example .env.local"
echo ""
echo -e "${CYAN}2. Provision the cloud accounts (if not already):${NC}"
echo "     bash scripts/provision-supabase.sh    # creates 2 projects (staging + prod)"
echo "     bash scripts/provision-vercel.sh      # creates 2 projects"
echo "     # Anthropic / OpenAI / Trigger.dev / Sentry are still manual (no public APIs for project create)"
echo ""
echo -e "${CYAN}3. Open Claude Code (it auto-reads CLAUDE.md):${NC}"
echo "     cd $CODE_DIR && claude"
echo ""
echo -e "${YELLOW}If Docker says 'permission denied', run: newgrp docker (or log out and back in).${NC}"
