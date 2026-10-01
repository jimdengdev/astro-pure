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

# 启动开发服务器
echo "🚀 启动开发服务器..."
echo "   英文首页: http://localhost:4321/"
echo "   中文首页: http://localhost:4321/zh/"
echo ""
bun run dev
