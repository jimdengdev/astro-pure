#!/bin/bash
# 停止 astro-pure 本地开发/预览服务
#
# 用法:
#   ./scripts/stop.sh          # 停止本项目 4321 端口上的服务
#   ./scripts/stop.sh 4322     # 指定端口
#
# 只会结束后台残留的 astro 进程，不影响其他项目。

set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
PORT="${1:-4321}"

stopped=0
handled=" "            # 已处理过的 PID，避免重复
self=" $$ $PPID "      # 本脚本及其父进程，永不结束

# 结束单个进程：先 SIGTERM 优雅退出，超时再 SIGKILL
kill_pid() {
  local pid="$1" reason="$2"
  case "$self" in *" $pid "*) return 0 ;; esac
  case "$handled" in *" $pid "*) return 0 ;; esac
  handled="$handled$pid "
  kill -0 "$pid" 2>/dev/null || return 0
  echo "⏹  停止 PID $pid  ($reason)"
  kill "$pid" 2>/dev/null
  for _ in $(seq 1 10); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.3
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "    -> 无响应，强制结束"
    kill -9 "$pid" 2>/dev/null
  fi
  stopped=$((stopped + 1))
}

# 取进程的工作目录，用于确认它属于本项目
pid_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

# 1) 占用目标端口的「监听」进程
#    只取 LISTEN 状态，避免误杀连接到该端口的浏览器/客户端
for pid in $(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true); do
  cmd="$(ps -o command= -p "$pid" 2>/dev/null | head -1)"
  case "$cmd" in
    *astro* | *vite* | *bun* | *node*)
      kill_pid "$pid" "占用端口 $PORT: ${cmd:0:60}"
      ;;
    *)
      echo "⚠️  端口 $PORT 被非 astro 进程占用，已跳过: ${cmd:0:60}"
      ;;
  esac
done

# 2) 本项目目录下的 astro dev / preview / check --watch 进程（含端口之外的残留）
for pid in $(pgrep -f 'astro (dev|preview)|astro check --watch' 2>/dev/null || true); do
  cwd="$(pid_cwd "$pid")"
  case "$cwd" in
    "$ROOT"*) kill_pid "$pid" "astro 进程（$cwd）" ;;
  esac
done

# 3) 结果确认
sleep 0.5
if lsof -ti tcp:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "❌ 端口 $PORT 仍被监听:"
  lsof -i tcp:"$PORT" -sTCP:LISTEN 2>/dev/null
  exit 1
fi

if [ "$stopped" -eq 0 ]; then
  echo "✅ 没有正在运行的服务（端口 $PORT 空闲）"
else
  echo "✅ 已停止 $stopped 个进程，端口 $PORT 已释放"
fi
