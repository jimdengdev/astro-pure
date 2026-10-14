import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

// =============================================================================
// 时光模块数据层（memos 公开 API，中文模式数据源）
//
// 数据源为外部 memos 实例：未认证请求只会返回 PUBLIC memo（服务端强制过滤），
// 不携带任何 token。本地再次校验 visibility === 'PUBLIC' 双保险，不做标签筛选。
// 页面为 SSR（output: 'server'），数据随请求刷新，建议配合 Astro.cache 控制频率。
// =============================================================================

export const MEMOS_ORIGIN = 'https://memos.kits.de5.net'

const REQUEST_TIMEOUT_MS = 8_000
const MAX_PAGE_SIZE = 100
/** 单次渲染最多向后翻 10 页游标（1000 条封顶，防止极端数据量拖垮响应） */
const MAX_FETCH_PAGES = 10

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
  /** memos 永久链接 */
  sourceUrl: string
}

export class MemosApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'MemosApiError'
    this.status = status
  }
}

function listUrl(pageToken?: string): URL {
  const url = new URL('/api/v1/memos', MEMOS_ORIGIN)
  url.searchParams.set('pageSize', String(MAX_PAGE_SIZE))
  if (pageToken) url.searchParams.set('pageToken', pageToken)
  return url
}

async function fetchMemosPage(pageToken?: string): Promise<MemosListResponseDto> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    // 未认证：memos 只返回 PUBLIC 记录，无需（也不应）携带 token
    const response = await fetch(listUrl(pageToken), {
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

/** 与内容集合时代的摘要逻辑一致：剥离 Markdown 标记后截断 */
function toExcerpt(body: string): string {
  return body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function renderMarkdown(body: string): string {
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

/** 拉取全量时光信息流（新→旧）。失败抛 MemosApiError，由页面层决定呈现方式。 */
export async function listWhispers(): Promise<WhisperView[]> {
  const collected: MemosMemoDto[] = []
  let pageToken: string | undefined
  for (let fetched = 0; fetched < MAX_FETCH_PAGES; fetched++) {
    const data = await fetchMemosPage(pageToken)
    collected.push(...(data.memos ?? []).filter(inFeed))
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return collected.sort((a, b) => b.createTime.localeCompare(a.createTime)).map(toWhisperView)
}

/** 标签统计：按出现次数降序，用于标签云页面 */
export function countWhisperTags(items: WhisperView[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
