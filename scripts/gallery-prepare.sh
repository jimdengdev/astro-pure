#!/bin/bash
# 相册图片预处理：压缩（长边缩到 2000px、转 webp）→ 可选上传图床 → 输出可直接粘贴进
# src/assets/gallery.json 的 photos 条目
#
# 用法:
#   sh scripts/gallery-prepare.sh <图片目录或文件路径> [更多文件...]
#   sh scripts/gallery-prepare.sh --upload <图片目录或文件路径> [更多文件...]
# 示例:
#   sh scripts/gallery-prepare.sh ~/Desktop/photos            # 仅压缩，输出到 ./gallery-out/
#   sh scripts/gallery-prepare.sh --upload ~/Desktop/photos   # 压缩并上传图床
set -euo pipefail

# ---------- 配置 ----------
AUTH_CODE='imgbed_9cf08d362861f9ec499097bb7e852de31678f99918bdcfa5422ed3152313a5b9'
UPLOAD_CHANNEL='cfr2'
API_BASE='https://jimimg.pages.dev'
MAX_EDGE=2000        # 长边像素
QUALITY=80           # webp 质量
# --------------------------

# ---------- 参数 ----------
UPLOAD=0
if [ "${1:-}" = '--upload' ] || [ "${1:-}" = '-u' ]; then
  UPLOAD=1
  shift
fi
# 本地输出目录（未上传时的落盘位置）
OUT_DIR='./gallery-out'

if [ $# -lt 1 ]; then
  echo "用法: sh scripts/gallery-prepare.sh [--upload] <图片目录或文件路径> [更多文件...]"
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "❌ 需要 macOS 自带的 sips 命令"
  exit 1
fi
# webp 编码优先用 cwebp（sips 不支持写 webp）；缺失时回退输出 JPEG
HAS_CWEBP=0
command -v cwebp >/dev/null 2>&1 && HAS_CWEBP=1
[ "$HAS_CWEBP" -eq 0 ] && echo "⚠️  未安装 cwebp（brew install webp），将回退输出 JPEG"
OUT_EXT=webp
[ "$HAS_CWEBP" -eq 0 ] && OUT_EXT=jpg

# 收集图片文件（支持传目录或多个文件）
FILES=()
for arg in "$@"; do
  if [ -d "$arg" ]; then
    while IFS= read -r f; do
      [ -n "$f" ] && FILES+=("$f")
    done <<EOF
$(find "$arg" -maxdepth 1 -type f \( -iname '*.heic' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) | sort)
EOF
  elif [ -f "$arg" ]; then
    FILES+=("$arg")
  else
    echo "⚠️  跳过：找不到 $arg"
  fi
done

if [ ${#FILES[@]} -eq 0 ]; then
  echo "❌ 未找到可处理的图片（支持 heic/jpg/jpeg/png/webp）"
  exit 1
fi

# 上传模式用临时目录（处理后即删）；本地模式输出到 OUT_DIR 并保留
if [ "$UPLOAD" -eq 1 ]; then
  WORKDIR=$(mktemp -d)
  trap 'rm -rf "$WORKDIR"' EXIT
else
  WORKDIR="$OUT_DIR"
  mkdir -p "$WORKDIR"
fi
URLS=()

for f in "${FILES[@]}"; do
  base=$(basename "$f")
  name="${base%.*}"
  # 文件名 slug 化：小写、空格/特殊字符转 -，避免 URL 编码问题
  slug=$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g')
  [ -z "$slug" ] && slug="photo"
  out="$WORKDIR/$slug.$OUT_EXT"
  # 同名去重
  i=1
  while [ -e "$out" ]; do out="$WORKDIR/${slug}-$i.$OUT_EXT"; i=$((i + 1)); done

  # 1) 压缩：sips 负责解码（支持 HEIC）并按长边缩放；cwebp 负责转 webp
  tmp_png="$WORKDIR/${slug}-src.png"
  sips -Z "$MAX_EDGE" -s format png "$f" --out "$tmp_png" >/dev/null
  if [ "$HAS_CWEBP" -eq 1 ]; then
    cwebp -quiet -q "$QUALITY" "$tmp_png" -o "$out"
  else
    sips -s format jpeg -s formatOptions "$QUALITY" "$tmp_png" --out "$out" >/dev/null
  fi
  rm -f "$tmp_png"
  size_kb=$(($(stat -f%z "$out") / 1024))

  # 2) 上传图床（鉴权码放在 Authorization 请求头）；默认不上传，只本地压缩
  if [ "$UPLOAD" -eq 0 ]; then
    URL="/img/gallery/$(basename "$out")"
    URLS+=("$URL")
    printf '✅ %s → %s %dKB → %s\n' "$base" "$OUT_EXT" "$size_kb" "$out"
    continue
  fi
  if ! RESP=$(curl -fsS -X POST "$API_BASE/upload?uploadChannel=$UPLOAD_CHANNEL" -H "Authorization: $AUTH_CODE" -F "file=@$out" 2>&1); then
    echo "❌ 上传失败 $base：$RESP"
    continue
  fi

  # 3) 解析返回的 URL（兼容 {"src":...} / {"url":...}，相对路径补全域名）
  URL=$(printf '%s' "$RESP" | sed -n 's/.*"src"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  [ -z "$URL" ] && URL=$(printf '%s' "$RESP" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
  case "$URL" in
    http*) ;;
    /*) URL="$API_BASE$URL" ;;
    *) URL='' ;;
  esac

  if [ -z "$URL" ]; then
    echo "⚠️  $base 上传响应无法解析：$RESP"
    continue
  fi

  URLS+=("$URL")
  printf '✅ %s → %s %dKB → %s\n' "$base" "$OUT_EXT" "$size_kb" "$URL"
done

if [ ${#URLS[@]} -eq 0 ]; then
  echo "❌ 没有图片处理成功"
  exit 1
fi

echo ""
if [ "$UPLOAD" -eq 1 ]; then
  echo "📎 上传完成，共 ${#URLS[@]} 张："
else
  echo "📎 压缩完成，共 ${#URLS[@]} 张，已输出到 $OUT_DIR/"
  echo "   （把其中的文件复制到 public/img/gallery/ 即可在本地/构建中使用）"
fi
printf '%s\n' "${URLS[@]}"
echo ""
echo "📋 可直接粘贴到 src/assets/gallery.json 的 photos 数组："
for u in "${URLS[@]}"; do
  printf '        { "src": "%s", "alt": "待补充", "caption": "" },\n' "$u"
done
