#!/bin/bash
# astro-pure 本地预览脚本
cd "$(dirname "$0")"

# 检查 bun
if ! command -v bun &>/dev/null; then
  echo "❌ 未安装 bun，请先运行: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

# 检查依赖
if [ ! -d node_modules ]; then
  echo "📦 安装依赖..."
  bun install
fi

# 清理旧构建缓存（避免 safe-delete 问题）
rm -rf .vercel/output dist 2>/dev/null

# 检查 4321 端口占用：展示占用进程信息并关闭，避免 Astro 自动顺延到 4322 等端口
PORT=4321
PIDS=$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "⚠️  端口 $PORT 已被占用，占用进程信息："
  lsof -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null
  echo ""
  echo "🧹 正在关闭占用进程: $PIDS"
  kill $PIDS 2>/dev/null
  sleep 1
  # 进程未退出则强制结束
  REMAIN=$(lsof -nP -iTCP:$PORT -sTCP:LISTEN -t 2>/dev/null)
  if [ -n "$REMAIN" ]; then
    echo "⚠️  进程未响应，强制结束: $REMAIN"
    kill -9 $REMAIN 2>/dev/null
    sleep 1
  fi
  echo "✅ 端口 $PORT 已释放"
  echo ""
fi

# 启动开发服务器
echo "🚀 启动开发服务器..."
echo "   英文首页: http://localhost:4321/"
echo "   中文首页: http://localhost:4321/zh/"
echo ""
bun run dev
