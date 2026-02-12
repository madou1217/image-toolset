#!/bin/bash
# ═══════════════════════════════════════════════
#  快速同步脚本 — 仅拉取最新代码（不更新nginx配置）
#  配置从 .env 读取
# ═══════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── 加载 .env ───
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 未找到 .env 文件！请复制 .env.example 为 .env 并填入配置"
  exit 1
fi
source "$ENV_FILE"

IFS=' ' read -ra SERVER_LIST <<< "$SERVERS"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

cd "$PROJECT_DIR"

# 推送本地更改
if git status --porcelain | grep -q .; then
  echo "推送本地更改到 GitHub..."
  git add -A
  git commit -m "update: $(date +%Y%m%d-%H%M%S)"
  git push origin main
fi

# 同步到所有服务器
for server in "${SERVER_LIST[@]}"; do
  echo -n "同步 $server ... "
  if ssh -o ConnectTimeout=5 "$server" "cd ${DEPLOY_PATH} && sudo git pull origin main" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗${NC}"
  fi
done

echo "Done! → http://$DOMAIN"
