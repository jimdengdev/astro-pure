import { getCollection } from 'astro:content'
import rss from '@astrojs/rss'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { prod } from 'astro-pure/server'
import config from 'virtual:config'

const renderBody = async (body: string | undefined) => {
  if (!body) return undefined
  const file = await unified().use(remarkParse).use(remarkRehype).use(rehypeStringify).process(body)
  return String(file)
}

export async function GET(context: { site?: URL }) {
  // 英文模式（旧数据）：whispers 内容集合
  const all = await getCollection('whispers', ({ data }) => (prod ? !data.draft : true))
  const sorted = all.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
  const site = context.site ?? new URL(import.meta.env.SITE)

  return rss({
    trailingSlash: false,
    xmlns: { h: 'http://www.w3.org/TR/html4/', atom: 'http://www.w3.org/2005/Atom' },
    title: `${config.title} · 时光`,
    description: 'Short notes and life updates',
    site: site.href,
    items: await Promise.all(
      sorted.map(async (entry) => ({
        title: entry.data.title ?? '时光',
        pubDate: entry.data.publishDate,
        link: `/whispers#${entry.id}`,
        description: entry.body?.slice(0, 160),
        content: await renderBody(entry.body)
      }))
    )
  })
}
