#!/bin/bash
# ═══════════════════════════════════════════════
#  快速同步脚本 — 仅拉取最新代码（不更新nginx配置）
#  用于日常代码更新
# ═══════════════════════════════════════════════

set -e

DEPLOY_PATH="/opt/1panel/www/image-toolset"

SERVERS=(
  "ubuntu@155.248.183.169"
  "opc@152.70.105.41"
)

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# 先推送本地更改
if git status --porcelain | grep -q .; then
  echo "推送本地更改到 GitHub..."
  git add -A
  git commit -m "update: $(date +%Y%m%d-%H%M%S)"
  git push origin main
fi

# 同步到所有服务器
for server in "${SERVERS[@]}"; do
  echo -n "同步 $server ... "
  if ssh -o ConnectTimeout=5 "$server" "cd $DEPLOY_PATH && sudo git pull origin main" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${RED}✗${NC}"
  fi
done

echo "Done!"
