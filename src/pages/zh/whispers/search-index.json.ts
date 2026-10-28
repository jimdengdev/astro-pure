/**
 * 时光搜索索引（懒加载）：时间线首屏只拉 20 条，不再内嵌全量索引；
 * 用户在搜索框里提交时，客户端才请求本端点获取全量轻量索引（≤300 条）。
 *
 *   GET /zh/whispers/search-index.json → WhisperIndexItem[]
 */
import { getLocalePath } from '@/i18n'
import { listWhispers } from '@/lib/memos'

import type { WhisperIndexItem } from '@/components/WhisperSearch.astro'

export const prerender = false

export async function GET() {
  // listWhispers 内部带快照/退避/本地兜底，不会抛出
  const items = await listWhispers({ lang: 'zh' })
  const index: WhisperIndexItem[] = items.map((item) => ({
    id: item.id,
    iso: item.publishDate.toISOString(),
    excerpt: item.description,
    tags: item.tags,
    tagBase: getLocalePath('zh', '/whispers/tags'),
    detailBase: getLocalePath('zh', '/whispers/m')
  }))

  return new Response(JSON.stringify(index), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // 与标签云/RSS 等聚合视图同频：CDN 缓存 5 分钟
      'Cache-Control': 's-maxage=300, stale-while-revalidate=30'
    }
  })
}
