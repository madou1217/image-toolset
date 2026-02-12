#!/bin/bash
# ═══════════════════════════════════════════════
#  Image Toolset — 一键部署脚本
#  配置从 .env 读取，避免敏感信息泄露
# ═══════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── 加载 .env ───
ENV_FILE="$PROJECT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ 未找到 .env 文件！请复制 .env.example 为 .env 并填入配置"
  echo "   cp .env.example .env"
  exit 1
fi
source "$ENV_FILE"

# ─── 验证配置 ───
if [ -z "$SERVERS" ] || [ -z "$DOMAIN" ]; then
  echo "❌ .env 配置不完整，请检查 SERVERS 和 DOMAIN"
  exit 1
fi

IFS=' ' read -ra SERVER_LIST <<< "$SERVERS"

# ─── 颜色 ───
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# ─── 生成 nginx 配置（用 .env 中的域名替换） ───
generate_nginx_conf() {
  sed "s/server_name .*/server_name ${DOMAIN};/" "$SCRIPT_DIR/nginx.conf"
}

# ─── 部署到单台服务器 ───
deploy_to_server() {
  local server="$1"
  echo ""
  echo "══════════════════════════════════════"
  echo "  部署到: $server"
  echo "══════════════════════════════════════"

  if ! ssh -o ConnectTimeout=5 "$server" "echo ok" > /dev/null 2>&1; then
    error "无法连接到 $server"
    return 1
  fi
  log "SSH 连接成功"

  # 同步代码
  ssh "$server" bash -s <<REMOTE_SCRIPT
    set -e
    if [ -d "${DEPLOY_PATH}/.git" ]; then
      echo "[pull] 更新代码..."
      cd "${DEPLOY_PATH}"
      sudo git pull origin main
    else
      echo "[clone] 首次部署..."
      sudo rm -rf "${DEPLOY_PATH}"
      sudo git clone "${REPO_URL}" "${DEPLOY_PATH}"
    fi
REMOTE_SCRIPT
  log "代码同步完成"

  # 部署 nginx 配置
  generate_nginx_conf | ssh "$server" "sudo tee ${NGINX_CONF_PATH} > /dev/null"
  log "Nginx 配置已更新"

  # 重载 OpenResty
  ssh "$server" "sudo docker exec openresty nginx -t && sudo docker exec openresty nginx -s reload"
  log "OpenResty 已重载"

  log "✅ $server 部署完成!"
}

# ─── 主流程 ───
echo ""
echo "🖼️  Image Toolset — 一键部署"
echo "=================================="
echo "域名: $DOMAIN"
echo "服务器: ${SERVER_LIST[*]}"
echo ""

cd "$PROJECT_DIR"

# 推送本地代码到 GitHub
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
for server in "${SERVER_LIST[@]}"; do
  if ! deploy_to_server "$server"; then
    error "$server 部署失败"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "══════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
  log "🎉 全部部署完成! 访问: http://$DOMAIN"
else
  warn "有 $FAILED 台服务器部署失败"
fi
