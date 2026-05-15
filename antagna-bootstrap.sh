#!/usr/bin/env bash
# antagna-bootstrap.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=== Antagna Bootstrap on Ubuntu ===${NC}"
echo ""

# --------------------------------------------------
# 1. System update + essentials
# --------------------------------------------------

echo -e "${YELLOW}[1/9] System update + essentials...${NC}"

sudo apt update

sudo apt install -y \
  curl \
  git \
  build-essential \
  ca-certificates \
  gnupg \
  lsb-release \
  unzip \
  jq

# --------------------------------------------------
# 2. Node.js 22 via nvm
# --------------------------------------------------

echo -e "${YELLOW}[2/9] Node.js 22 via nvm...${NC}"

if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 22
nvm use 22
nvm alias default 22

echo "Node version: $(node -v)"

# --------------------------------------------------
# 3. pnpm
# --------------------------------------------------

echo -e "${YELLOW}[3/9] pnpm...${NC}"

rm -rf "$HOME/.cache/node/corepack" || true

corepack enable
corepack prepare pnpm@latest --activate

echo "pnpm version: $(pnpm -v)"

# --------------------------------------------------
# 4. Claude Code
# --------------------------------------------------

echo -e "${YELLOW}[4/9] Claude Code...${NC}"

npm install -g @anthropic-ai/claude-code

echo "Claude Code installed."

# --------------------------------------------------
# 5. Supabase CLI
# --------------------------------------------------

echo -e "${YELLOW}[5/9] Supabase CLI...${NC}"

SUPABASE_DEB_URL=$(
  curl -s https://api.github.com/repos/supabase/cli/releases/latest \
    | jq -r '.assets[] | select(.name | test("linux_amd64.deb$")) | .browser_download_url' \
    | head -n 1
)

curl -L "$SUPABASE_DEB_URL" -o /tmp/supabase.deb

sudo dpkg -i /tmp/supabase.deb || true
sudo apt-get install -f -y

echo "Supabase version: $(supabase --version)"

# --------------------------------------------------
# 6. Vercel CLI
# --------------------------------------------------

echo -e "${YELLOW}[6/9] Vercel CLI...${NC}"

npm install -g vercel

echo "Vercel version: $(vercel --version)"

# --------------------------------------------------
# 7. Trigger.dev CLI
# --------------------------------------------------

echo -e "${YELLOW}[7/9] Trigger.dev CLI...${NC}"

npm install -g @trigger.dev/cli@latest || echo "Will use npx trigger.dev"

# --------------------------------------------------
# 8. Docker
# --------------------------------------------------

echo -e "${YELLOW}[8/9] Docker...${NC}"

if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh

  sudo usermod -aG docker "$USER"

  echo -e "${YELLOW}NOTE: logout/login required for docker group.${NC}"
else
  echo "Docker already installed: $(docker --version)"
fi

# --------------------------------------------------
# 9. GitHub CLI
# --------------------------------------------------

echo -e "${YELLOW}[9/9] GitHub CLI...${NC}"

if ! command -v gh &> /dev/null; then

  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null

  sudo apt update
  sudo apt install -y gh
fi

# --------------------------------------------------
# 10. GitHub Auth
# --------------------------------------------------

echo ""
echo -e "${CYAN}=== GitHub Authentication ===${NC}"

if ! gh auth status &> /dev/null; then
  gh auth login --git-protocol https --web
fi

# --------------------------------------------------
# 11. Clone / Update Blueprint
# --------------------------------------------------

echo ""
echo -e "${CYAN}=== Clone the Antagna Blueprint ===${NC}"

cd "$HOME"

if [ ! -d "antagna-blueprint" ]; then
  gh repo clone wiqoo/antagna-blueprint
else
  echo "Blueprint exists. Pulling latest..."
  cd antagna-blueprint
  git pull
  cd ..
fi

# --------------------------------------------------
# 12. Create workspace
# --------------------------------------------------

mkdir -p "$HOME/antagna"

# --------------------------------------------------
# 13. Done
# --------------------------------------------------

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   Antagna bootstrap complete.${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""

echo -e "${CYAN}Next:${NC}"
echo ""
echo "cd $HOME/antagna"
echo "claude"
echo ""

echo -e "${YELLOW}If Docker shows permission denied:${NC}"
echo "Run: newgrp docker"
echo ""
