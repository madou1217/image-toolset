#!/bin/bash
# ═══════════════════════════════════════════════
#  Image Toolset — 一键部署脚本
#  支持同时部署到多台服务器
# ═══════════════════════════════════════════════

set -e

# ─── 配置 ───
REPO_URL="https://github.com/madou1217/image-toolset.git"
DEPLOY_PATH="/opt/1panel/www/image-toolset"
NGINX_CONF_PATH="/opt/1panel/www/conf.d/image-toolset.conf"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 服务器列表 (user@host)
SERVERS=(
  "ubuntu@155.248.183.169"
  "opc@152.70.105.41"
)

# ─── 颜色 ───
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# ─── 部署到单台服务器 ───
deploy_to_server() {
  local server="$1"
  echo ""
  echo "══════════════════════════════════════"
  echo "  部署到: $server"
  echo "══════════════════════════════════════"

  # 1. 检查连通性
  if ! ssh -o ConnectTimeout=5 "$server" "echo ok" > /dev/null 2>&1; then
    error "无法连接到 $server"
    return 1
  fi
  log "SSH 连接成功"

  # 2. 检查是否已 clone，如果有则 pull，没有则 clone
  ssh "$server" bash -s << REMOTE_SCRIPT
    set -e
    if [ -d "$DEPLOY_PATH/.git" ]; then
      echo "[pull] 更新代码..."
      cd "$DEPLOY_PATH"
      sudo git pull origin main
    else
      echo "[clone] 首次部署..."
      sudo rm -rf "$DEPLOY_PATH"
      sudo git clone "$REPO_URL" "$DEPLOY_PATH"
    fi
REMOTE_SCRIPT
  log "代码同步完成"

  # 3. 部署 nginx 配置
  scp "${SCRIPT_DIR}/nginx.conf" "$server:/tmp/image-toolset-nginx.conf"
  ssh "$server" "sudo cp /tmp/image-toolset-nginx.conf $NGINX_CONF_PATH && rm /tmp/image-toolset-nginx.conf"
  log "Nginx 配置已更新"

  # 4. 测试并重载 nginx
  ssh "$server" "sudo docker exec openresty nginx -t && sudo docker exec openresty nginx -s reload"
  log "OpenResty 已重载"

  log "✅ $server 部署完成!"
}

# ─── 主流程 ───
echo ""
echo "🖼️  Image Toolset — 一键部署"
echo "=================================="

# 先推送本地代码到 GitHub
if git status --porcelain | grep -q .; then
  warn "检测到本地未提交的更改，先推送到 GitHub..."
  git add -A
  git commit -m "chore: deploy update $(date +%Y%m%d-%H%M%S)"
  git push origin main
  log "代码已推送到 GitHub"
else
  log "本地代码已是最新"
fi

# 部署到所有服务器
FAILED=0
for server in "${SERVERS[@]}"; do
  if ! deploy_to_server "$server"; then
    error "$server 部署失败"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "══════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
  log "🎉 全部部署完成! 访问: http://image.meadeo.com"
else
  warn "有 $FAILED 台服务器部署失败"
fi
