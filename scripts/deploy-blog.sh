#!/bin/bash
# 一键部署 astro-pure 博客到 GitHub（jimdengdev/astro-pure → main）
# 推送后 Vercel 自动构建部署

set -e
cd "$(dirname "$0")/.."

TITLE="${1:-}"

# 无标题时从最近修改的文章提取
if [ -z "$TITLE" ]; then
  TITLE=$(git status --porcelain src/content/blog/ | head -1 | sed 's|.*blog/||; s|\.md.*||; s|-en$||')
  [ -z "$TITLE" ] && TITLE="update blog"
fi

# 检查变更
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ 没有需要部署的变更"
  exit 0
fi

echo "📦 暂存并提交: feat: $TITLE"
git add .
git commit -m "feat: $TITLE"

echo "🚀 推送到 origin/main..."
git push origin main

echo "✅ 部署完成，Vercel 将自动构建"
