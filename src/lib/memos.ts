import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

// =============================================================================
// 时光模块数据层（memos 公开 API，中文模式数据源）
//
// 数据源为外部 memos 实例：未认证请求只会返回 PUBLIC memo（服务端强制过滤），
// 不携带任何 token。本地再次校验 visibility === 'PUBLIC' 双保险，不做标签筛选。
// 页面为 SSR（output: 'server'），数据随请求刷新，建议配合 Astro.cache 控制频率。
//
// 拉取策略（分页游标，不做全量）：
// - 时间线首屏：listWhispersPage() 单次请求最新 20 条（WHISPERS_PAGE_SIZE）
// - 滑动加载：/zh/whispers/more?pageToken=… 每次取下一页 20 条（游标翻页）
// - 聚合视图（标签云 / RSS / 搜索索引 / 详情页）：仍走 listWhispers 全量快照
//   （100 条/页 × 最多 10 页，封顶 300 条，60s 实例内复用）
// =============================================================================

export const MEMOS_ORIGIN = 'https://memos.kits.de5.net'

const REQUEST_TIMEOUT_MS = 4_000
/** 全量拉取的总时限：Serverless（如 Vercel Hobby 默认 10s）必须在函数超时前返回 */
const TOTAL_BUDGET_MS = 6_000
/** 全量拉取（标签云 / RSS / 搜索索引等聚合视图）的单页步长 */
const MAX_PAGE_SIZE = 100
/** 单次渲染最多向后翻 10 页游标（1000 条封顶，防止极端数据量拖垮响应） */
const MAX_FETCH_PAGES = 10
/** 单次渲染保留的条目上限（聚合视图封顶） */
const MAX_ITEMS = 300
/** 时光时间线单页条数：首屏与滚动翻页共用（用户要求一次拉最新 20 条） */
export const WHISPERS_PAGE_SIZE = 20
/** 游标页的实例内复用时长：滚动触发的重复请求不再回源 */
const PAGE_CACHE_TTL_MS = 60_000
/** 游标页缓存条数上限（含首屏页，防内存无限增长） */
const PAGE_CACHE_MAX = 32
/** 成功快照的复用时长：实例内重复请求（首页/列表/标签）不再打上游 */
const CACHE_TTL_MS = 60_000
/** 上游失败后的退避窗口：期间直接用旧快照，避免每次请求都白等一次超时 */
const COOLDOWN_MS = 30_000

interface MemosAttachmentDto {
  name?: string
  filename?: string
  externalLink?: string
  type?: string
  size?: string
}

interface MemosMemoDto {
  name: string
  createTime: string
  updateTime?: string
  content?: string
  visibility?: string
  tags?: string[]
  pinned?: boolean
  attachments?: MemosAttachmentDto[]
}

interface MemosListResponseDto {
  memos?: MemosMemoDto[]
  nextPageToken?: string
}

/** 时光条目视图（供列表 / 搜索 / RSS / 首页使用，与内容集合解耦） */
export interface WhisperView {
  id: string
  publishDate: Date
  updatedDate?: Date
  /** 纯文本摘要（列表行与搜索索引用） */
  description: string
  /** 原始 Markdown */
  body: string | null
  /** 渲染并消毒后的 HTML */
  html: string
  /** 附件图片（绝对地址） */
  images: string[]
  tags: string[]
  /** 外部原文链接；本地兜底条目没有原文，组件据此不渲染「查看原文」箭头 */
  sourceUrl?: string
}

export class MemosApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'MemosApiError'
    this.status = status
  }
}

function listUrl(pageToken?: string, pageSize: number = MAX_PAGE_SIZE): URL {
  const url = new URL('/api/v1/memos', MEMOS_ORIGIN)
  url.searchParams.set('pageSize', String(pageSize))
  if (pageToken) url.searchParams.set('pageToken', pageToken)
  return url
}

async function fetchMemosPage(
  pageToken?: string,
  pageSize: number = MAX_PAGE_SIZE
): Promise<MemosListResponseDto> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    // 未认证：memos 只返回 PUBLIC 记录，无需（也不应）携带 token
    const response = await fetch(listUrl(pageToken, pageSize), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    })
    if (!response.ok) {
      throw new MemosApiError(
        `memos API ${response.status} ${response.statusText}`,
        response.status
      )
    }
    return (await response.json()) as MemosListResponseDto
  } catch (error) {
    if (error instanceof MemosApiError) throw error
    throw new MemosApiError(
      `memos API request failed: ${error instanceof Error ? error.message : String(error)}`,
      503
    )
  } finally {
    clearTimeout(timer)
  }
}

/** 双保险：即使实例未来放开未认证可见性，也只接受 PUBLIC 记录 */
function inFeed(memo: MemosMemoDto): boolean {
  if (memo.visibility !== undefined && memo.visibility !== 'PUBLIC') return false
  return true
}

function attachmentUrl(attachment: MemosAttachmentDto): string | null {
  const externalLink = attachment.externalLink?.trim()
  if (externalLink) return externalLink
  if (!attachment.name) return null
  const segments = attachment.name
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const filename = encodeURIComponent(attachment.filename ?? '')
  return new URL(`/file/${segments}/${filename}`, MEMOS_ORIGIN).href
}

function toImageList(memo: MemosMemoDto): string[] {
  return (memo.attachments ?? []).flatMap((attachment) => {
    if (!(attachment.type ?? '').toLowerCase().startsWith('image/')) return []
    const url = attachmentUrl(attachment)
    return url ? [url] : []
  })
}

/** 与内容集合时代的摘要逻辑一致：剥离 Markdown 标记后截断（本地兜底复用） */
export function toExcerpt(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/** Markdown → 已消毒 HTML（本地兜底复用同一套白名单） */
export function renderMarkdown(body: string): string {
  const rawHtml = marked.parse(body, { async: false })
  return sanitizeHtml(rawHtml, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'nofollow noopener noreferrer',
        target: '_blank'
      })
    }
  })
}

function toWhisperView(memo: MemosMemoDto): WhisperView {
  const id = memo.name.replace(/^memos\//, '')
  const body = memo.content?.trim() ? memo.content : null
  const publishDate = new Date(memo.createTime)
  const updatedDate =
    memo.updateTime && memo.updateTime > memo.createTime ? new Date(memo.updateTime) : undefined
  return {
    id,
    publishDate,
    updatedDate,
    description: body ? toExcerpt(body) : '',
    body,
    html: body ? renderMarkdown(body) : '',
    images: toImageList(memo),
    tags: memo.tags ?? [],
    sourceUrl: new URL(`/memos/${encodeURIComponent(id)}`, MEMOS_ORIGIN).href
  }
}

/** 拉取全量时光信息流（新→旧）。失败抛 MemosApiError，由页面层决定呈现方式。
 * 仅供聚合视图（标签云 / RSS / 搜索索引 / 详情页邻近条目）使用。 */
async function fetchAll(): Promise<WhisperView[]> {
  const deadline = Date.now() + TOTAL_BUDGET_MS
  const collected: MemosMemoDto[] = []
  let pageToken: string | undefined
  for (let fetched = 0; fetched < MAX_FETCH_PAGES; fetched++) {
    // 总时限内尽量多取；超时则返回已取到的部分，避免函数被平台强制中断
    if (Date.now() > deadline) break
    if (collected.length >= MAX_ITEMS) break
    const data = await fetchMemosPage(pageToken)
    collected.push(...(data.memos ?? []).filter(inFeed))
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return collected
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
    .slice(0, MAX_ITEMS)
    .map(toWhisperView)
}

/** 游标分页的一页结果：条目 + 下一页游标（无下一页则省略） */
export interface WhispersPage {
  items: WhisperView[]
  nextPageToken?: string
}

/** 游标页缓存与并发去重：同一游标的并发/重复请求只打一次上游 */
const pageCache = new Map<string, { page: WhispersPage; at: number }>()
const pageInflight = new Map<string, Promise<WhispersPage>>()

/**
 * 按游标拉取一页时光（一次 20 条，新→旧）：
 * - 首屏不传 pageToken，拉最新一页；滑动加载传上一页返回的 nextPageToken
 * - 结果在实例内缓存 60s，滚动重复请求不回源
 * - 失败抛 MemosApiError，由调用万（时间线页 / more 端点）决定降级方式
 */
export async function listWhispersPage(pageToken?: string): Promise<WhispersPage> {
  const key = pageToken ?? ''
  const hit = pageCache.get(key)
  if (hit && Date.now() - hit.at < PAGE_CACHE_TTL_MS) return hit.page

  const pending = pageInflight.get(key)
  if (pending) return pending

  const task = (async () => {
    const data = await fetchMemosPage(pageToken, WHISPERS_PAGE_SIZE)
    const items = (data.memos ?? [])
      .filter(inFeed)
      .sort((a, b) => b.createTime.localeCompare(a.createTime))
      .map(toWhisperView)
    const page: WhispersPage = { items, nextPageToken: data.nextPageToken || undefined }

    pageCache.set(key, { page, at: Date.now() })
    if (pageCache.size > PAGE_CACHE_MAX) {
      // Map 按插入序迭代，首键即最旧
      const oldest = pageCache.keys().next().value
      if (oldest !== undefined) pageCache.delete(oldest)
    }
    return page
  })().finally(() => pageInflight.delete(key))

  pageInflight.set(key, task)
  return task
}

/** 最近一次成功的上游快照（模块级，实例内共享） */
let snapshot: WhisperView[] | null = null
let snapshotAt = 0
/** 失败退避截止时间戳，在此期间不再打上游 */
let cooldownUntil = 0
/** 并发请求共享同一次上游调用，避免同时穿透 */
let inflight: Promise<WhisperView[]> | null = null
/** 本地兜底结果缓存（按 lang），避免每次请求都重读内容集合 */
const localFallback = new Map<string, WhisperView[]>()

function take(items: WhisperView[], limit?: number): WhisperView[] {
  return limit === undefined ? items : items.slice(0, limit)
}

function warnUnavailable(error: unknown, fallback: string): void {
  // 只记一行摘要，不打印 stack：上游抖动属可预期降级
  const message =
    typeof error === 'string' ? error : error instanceof Error ? error.message : String(error)
  console.warn(`[whispers] memos feed unavailable (${message}); serving ${fallback}`)
}

/**
 * 本地兜底：读 src/content/whispers/ 的静态文档。
 * 动态载入，避免正常路径（上游可用时）与 astro:content 产生耦合。
 */
async function loadLocalFallback(lang?: string): Promise<WhisperView[]> {
  const key = lang ?? 'zh'
  const cached = localFallback.get(key)
  if (cached) return cached
  let items: WhisperView[] = []
  try {
    items = await (await import('./whispers-local')).listLocalWhispers(lang)
  } catch (error) {
    warnUnavailable(error, 'no local content')
  }
  localFallback.set(key, items)
  return items
}

export interface ListWhispersOptions {
  /** 只返回前 N 条（首页只要 5 条，不必渲染全量 Markdown） */
  limit?: number
  /** 兜底到本地文档时的语言过滤，默认非英文 */
  lang?: string
}

/**
 * 拉取时光信息流（新→旧）。
 * - 60s 内复用上游快照，并发调用共享同一次上游请求
 * - 上游 5xx/超时：进入 30s 退避；已有快照则先降级返回旧数据（用户无感）
 * - 上游无数据或不可用且没有快照：兜底读本地 src/content/whispers/ 文档
 * - 上游与本地都无数据时返回空数组（页面显示空态提示）
 */
export async function listWhispers(options: ListWhispersOptions = {}): Promise<WhisperView[]> {
  const { limit, lang } = options
  const now = Date.now()
  const inCooldown = now < cooldownUntil
  // 上游旧快照优于本地兜底
  if (snapshot && (inCooldown || now - snapshotAt < CACHE_TTL_MS)) {
    return take(snapshot, limit)
  }
  // 退避窗口内已有兜底结果：不再打扰上游
  if (inCooldown) {
    const local = localFallback.get(lang ?? 'zh')
    if (local) return take(local, limit)
  }
  // 轻量路径：只要 ≤ 一页（20 条）时，单次请求取最新一页，不做全量翻页。
  // 首页（5 条）与时光线首屏（20 条）都走这里，避免每次渲染都拉全量 300 条。
  if (limit !== undefined && limit <= WHISPERS_PAGE_SIZE) {
    try {
      const first = await listWhispersPage()
      if (first.items.length > 0) return take(first.items, limit)
      // 上游可达但无内容：落入下方全量路径，统一按「无数据」走本地兜底
    } catch (error) {
      cooldownUntil = Date.now() + COOLDOWN_MS
      warnUnavailable(error, 'local content')
      const local = await loadLocalFallback(lang)
      return take(local, limit)
    }
  }
  const pending = (inflight ??= fetchAll().finally(() => {
    inflight = null
  }))
  try {
    const fresh = await pending
    if (fresh.length > 0) {
      snapshot = fresh
      snapshotAt = Date.now()
      cooldownUntil = 0
      return take(fresh, limit)
    }
    // 上游连上了但没有内容：按「无数据」处理，走本地兜底
    const local = await loadLocalFallback(lang)
    warnUnavailable('memos API returned no memo', local.length > 0 ? 'local content' : 'empty')
    return take(local, limit)
  } catch (error) {
    cooldownUntil = Date.now() + COOLDOWN_MS
    if (snapshot) {
      warnUnavailable(error, 'stale snapshot')
      return take(snapshot, limit)
    }
    const local = await loadLocalFallback(lang)
    warnUnavailable(error, local.length > 0 ? 'local content' : 'no content')
    return take(local, limit)
  }
}

/** 标签统计：按出现次数降序，用于标签云页面 */
export function countWhisperTags(items: WhisperView[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
