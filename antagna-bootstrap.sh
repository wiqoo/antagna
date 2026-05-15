#!/usr/bin/env bash
# antagna-bootstrap.sh
# Bootstrap script for the Antagna project on Ubuntu.
# نفذ هذا السكربت مرة واحدة على جهاز Ubuntu.
#
# طريقة التشغيل (من Ubuntu، أول مرة):
#   curl -fsSL https://raw.githubusercontent.com/wiqoo/antagna-blueprint/main/antagna-bootstrap.sh -o ~/antagna-bootstrap.sh
#   bash ~/antagna-bootstrap.sh
#
# هينصب كل الأدوات اللي Pillar 1 محتاجها + يـ clone الـ blueprint من GitHub.

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}=== Antagna Bootstrap on Ubuntu ===${NC}"
echo ""

# 1. System update + essentials
echo -e "${YELLOW}[1/9] System update + essentials...${NC}"
sudo apt update
sudo apt install -y curl git build-essential ca-certificates gnupg lsb-release unzip jq

# 2. Node.js 20 via nvm
echo -e "${YELLOW}[2/9] Node.js 20 via nvm...${NC}"
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 20
nvm alias default 20
echo "Node version: $(node -v)"

# 3. pnpm
echo -e "${YELLOW}[3/9] pnpm...${NC}"
corepack enable
corepack prepare pnpm@latest --activate
echo "pnpm version: $(pnpm -v)"

# 4. Claude Code
echo -e "${YELLOW}[4/9] Claude Code...${NC}"
npm install -g @anthropic-ai/claude-code
echo "Claude Code installed."

# 5. Supabase CLI
echo -e "${YELLOW}[5/9] Supabase CLI...${NC}"
npm install -g supabase
supabase --version

# 6. Vercel CLI
echo -e "${YELLOW}[6/9] Vercel CLI...${NC}"
npm install -g vercel
vercel --version

# 7. Trigger.dev CLI
echo -e "${YELLOW}[7/9] Trigger.dev CLI...${NC}"
npm install -g @trigger.dev/cli@latest || echo "Trigger.dev CLI: will use npx instead"

# 8. Docker (للـ local Postgres تطوير + lo whatsapp-gateway)
echo -e "${YELLOW}[8/9] Docker...${NC}"
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  echo -e "${YELLOW}NOTE: log out and back in for docker group to take effect.${NC}"
else
  echo "Docker already installed: $(docker --version)"
fi

# 9. GitHub CLI (للـ clone الـ private blueprint repo)
echo -e "${YELLOW}[9/9] GitHub CLI...${NC}"
if ! command -v gh &> /dev/null; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
  sudo apt update
  sudo apt install -y gh
fi

# 10. Authenticate to GitHub
echo ""
echo -e "${CYAN}=== GitHub Authentication ===${NC}"
if ! gh auth status &> /dev/null; then
  echo "Login to GitHub (browser will open OR you'll get a code)..."
  gh auth login --git-protocol https --web
fi

# 11. Clone the blueprint
echo ""
echo -e "${CYAN}=== Clone the Antagna Blueprint ===${NC}"
cd "$HOME"
if [ ! -d "antagna-blueprint" ]; then
  gh repo clone wiqoo/antagna-blueprint
else
  echo "antagna-blueprint folder already exists. Pulling latest..."
  cd antagna-blueprint && git pull && cd ..
fi

# 12. Create the code folder (empty for now — Claude Code fills it)
mkdir -p "$HOME/antagna"

# 13. Done
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  خلاص! كل حاجة جاهزة.${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${CYAN}الخطوة الجاية — افتح Claude Code في فولدر الكود:${NC}"
echo ""
echo "  cd $HOME/antagna"
echo "  claude"
echo ""
echo -e "${CYAN}داخل Claude Code، انسخ والصق هذه الـ prompt:${NC}"
echo ""
cat <<'PROMPT'
─────────────────────────────────────────────────────
أنا Mohammed Ghareeb (مؤسس Volt Production و Antagna).

الـ blueprint كامل موجود في $HOME/antagna-blueprint.
اقرأ بالترتيب:
  1. README.md
  2. decisions-log.md
  3. pillar-01-foundations.md
  4. pillar-16-hardening.md

أنا في فولدر فاضي $HOME/antagna هنبني فيه الكود.

عايزك تنفذ Pillar 1 (Foundations) خطوة-خطوة:
  - بيئة الـ monorepo (pnpm + Turborepo)
  - apps/web (Next.js 15)
  - apps/worker (Trigger.dev v3)
  - packages/db (Drizzle)
  - packages/ai (Anthropic + OpenAI)
  - packages/shared

قبل كل خطوة فيها قرار أو install كبير، استأذن.

التحقق: استخدم Acceptance Checklist في pillar-01-foundations.md §19.

ابدأ بسؤالي عن الحسابات السحابية الجاهزة (Vercel, Supabase, Anthropic, OpenAI, Trigger.dev, Sentry, Google Cloud).
─────────────────────────────────────────────────────
PROMPT
echo ""
echo -e "${YELLOW}ملاحظة: لو Docker قال permission denied، عمل logout/login مرة واحدة (أو شغل: newgrp docker)${NC}"
echo ""
