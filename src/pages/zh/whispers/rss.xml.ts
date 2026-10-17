import rss from '@astrojs/rss'
import { listWhispers, type WhisperView } from '@/lib/memos'

import config from 'virtual:config'

export const prerender = false

export async function GET(context: { site?: URL }) {
  let items: WhisperView[]
  try {
    items = await listWhispers({ lang: 'zh' })
  } catch {
    // 失败原因已由 listWhispers 统一记录；无快照可降级，只能返回 503
    return new Response('memos feed unavailable', { status: 503 })
  }
  const site = context.site ?? new URL(import.meta.env.SITE)

  return rss({
    trailingSlash: false,
    xmlns: { h: 'http://www.w3.org/TR/html4/', atom: 'http://www.w3.org/2005/Atom' },
    title: `${config.title} · 时光`,
    description: '来自 memos 的公开备忘（时光）',
    site: site.href,
    items: items.map((item) => ({
      title: item.description.slice(0, 40) || '时光',
      pubDate: item.publishDate,
      // 指向博客详情页（/zh/whispers/m/{id}）
      link: `/zh/whispers/m/${item.id}`,
      description: item.description.slice(0, 160),
      content: item.html
    }))
  })
}
