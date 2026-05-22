#!/usr/bin/env bash
# antagna-bootstrap.sh
# Bootstrap script for the Antagna project on Ubuntu.
# نفذ هذا السكربت مرة واحدة على جهاز Ubuntu.
#
# طريقة التشغيل (من Ubuntu، أول مرة):
#   curl -fsSL https://raw.githubusercontent.com/wiqoo/antagna/main/antagna-bootstrap.sh -o ~/antagna-bootstrap.sh
#   bash ~/antagna-bootstrap.sh
#
# هينصب كل الأدوات اللي المشروع محتاجها + يـ clone الـ repo + يجهّز الـ workspace.

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

echo -e "${YELLOW}[1/11] System update + essentials...${NC}"
sudo apt update
sudo apt install -y curl git build-essential ca-certificates gnupg lsb-release unzip jq postgresql-client

# --------------------------------------------------
# 2. Node.js 20 via nvm
# --------------------------------------------------

echo -e "${YELLOW}[2/11] Node.js 20 via nvm...${NC}"
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm alias default 20
echo "Node version: $(node -v)"

# --------------------------------------------------
# 3. pnpm
# --------------------------------------------------

echo -e "${YELLOW}[3/11] pnpm...${NC}"
corepack enable
corepack prepare pnpm@latest --activate
echo "pnpm version: $(pnpm -v)"

# --------------------------------------------------
# 4. Claude Code
# --------------------------------------------------

echo -e "${YELLOW}[4/11] Claude Code...${NC}"
npm install -g @anthropic-ai/claude-code
echo "Claude Code installed."

# --------------------------------------------------
# 5. Supabase CLI
# --------------------------------------------------

echo -e "${YELLOW}[5/11] Supabase CLI...${NC}"
npm install -g supabase
supabase --version

# --------------------------------------------------
# 6. Vercel CLI
# --------------------------------------------------

echo -e "${YELLOW}[6/11] Vercel CLI...${NC}"
npm install -g vercel@latest
vercel --version

# --------------------------------------------------
# 7. Trigger.dev v4 CLI (used via npx; no global needed)
# --------------------------------------------------

echo -e "${YELLOW}[7/11] Trigger.dev v4 CLI sanity check (via npx)...${NC}"
npx --yes trigger.dev@latest --version || echo "(will use npx on demand)"

# --------------------------------------------------
# 8. Docker (required for WhatsApp / WPPConnect)
# --------------------------------------------------

echo -e "${YELLOW}[8/11] Docker...${NC}"
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo -e "${YELLOW}NOTE: log out and back in for docker group to take effect.${NC}"
else
  echo "Docker already installed: $(docker --version)"
fi

# --------------------------------------------------
# 9. Cloudflared (for the WhatsApp tunnel)
# --------------------------------------------------

echo -e "${YELLOW}[9/11] cloudflared (Cloudflare tunnel for WhatsApp bot)...${NC}"
if ! command -v cloudflared &> /dev/null; then
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    | sudo dd of=/usr/share/keyrings/cloudflare-main.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    | sudo tee /etc/apt/sources.list.d/cloudflared.list > /dev/null
  sudo apt update
  sudo apt install -y cloudflared
fi
cloudflared --version || true

# --------------------------------------------------
# 10. GitHub CLI
# --------------------------------------------------

echo -e "${YELLOW}[10/11] GitHub CLI...${NC}"
if ! command -v gh &> /dev/null; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update
  sudo apt install -y gh
fi

# --------------------------------------------------
# 11. Authenticate to GitHub
# --------------------------------------------------

echo ""
echo -e "${CYAN}=== GitHub Authentication ===${NC}"
if ! gh auth status &> /dev/null; then
  gh auth login --git-protocol https --web
fi

# --------------------------------------------------
# 12. Clone the Antagna repo + install workspace
# --------------------------------------------------

echo ""
echo -e "${CYAN}=== Clone the Antagna repo + install ===${NC}"
cd "$HOME"
if [ ! -d "antagna" ]; then
  gh repo clone wiqoo/antagna
else
  echo "antagna folder already exists. Pulling latest..."
  cd antagna && git pull && cd ..
fi

cd "$HOME/antagna"
echo -e "${YELLOW}Installing workspace dependencies (pnpm install)...${NC}"
pnpm install --prefer-offline || pnpm install

# --------------------------------------------------
# 13. .env.local reminder
# --------------------------------------------------

echo ""
if [ ! -f "$HOME/antagna/.env.local" ]; then
  echo -e "${RED}NOTE: .env.local does not exist. The app needs:${NC}"
  echo "  DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,"
  echo "  SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY,"
  echo "  RESEND_API_KEY, GOOGLE_API_KEY, CRON_SECRET, WPP_SECRET_KEY,"
  echo "  ANTAGNA_BASE_URL, SENTRY_DSN, VERCEL_TOKEN"
  echo ""
  echo "Keys + secrets are stored in Claude's memory (~/.claude/projects/...)."
  echo "Ask Claude Code in this repo: 'pull all keys from memory and create .env.local'"
fi

# --------------------------------------------------
# 14. Done
# --------------------------------------------------

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   Antagna bootstrap complete.${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${CYAN}الخطوة الجاية — افتح Claude Code:${NC}"
echo ""
echo "  cd $HOME/antagna"
echo "  claude"
echo ""
echo -e "${CYAN}داخل Claude Code، الـ CLAUDE.md هيتقري تلقائياً. اقرا STATUS.md عشان تعرف اللي بعده:${NC}"
echo ""
cat <<'PROMPT'
─────────────────────────────────────────────────────
اقرأ STATUS.md الأول علشان تعرف الـ phase الحالي والـ next concrete action.
بعدها لو في sprint نشط، نفذ مهامه. لو مفيش، قول لي ايه الـ backlog
المتاح علشان نختار منه.

ملاحظات:
- .env.local لازم يبقى موجود قبل أي pnpm dev/build.
- Trigger.dev v4 (مش v3) — deploy بـ: cd apps/worker && npx trigger.dev@latest deploy
- WhatsApp bot شغّال على Cloudflare tunnel (whatsapp.antagna.me).
─────────────────────────────────────────────────────
PROMPT
echo ""
echo -e "${YELLOW}If Docker shows permission denied: newgrp docker (or log out / back in).${NC}"
echo ""
