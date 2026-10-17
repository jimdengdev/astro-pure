import { getCollection } from 'astro:content'

import { isEnglishPost } from '@/i18n'
import { prod } from 'astro-pure/server'
import { renderMarkdown, toExcerpt, type WhisperView } from './memos'

/**
 * 时光的本地兜底数据源：memos 实例不可用（5xx / 超时 / 长时间无数据）时，
 * 用 src/content/whispers/ 下的静态文档顶上，避免整个时光区块空白。
 *
 * 与上游数据的差异：
 * - 无外部原文链接（sourceUrl 留空，组件不渲染「查看原文」箭头）
 * - 正文按同一套 Markdown + 消毒规则渲染，保证样式一致
 */
export async function listLocalWhispers(lang?: string): Promise<WhisperView[]> {
  const all = await getCollection('whispers', ({ data }) => (prod ? !data.draft : true))
  // lang 缺省按中文站处理：排除 language: English 的条目
  const filtered = lang === 'en' ? all.filter(isEnglishPost) : all.filter((e) => !isEnglishPost(e))

  return filtered
    .sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf())
    .map((entry) => {
      const body = entry.body?.trim() ? entry.body : null
      return {
        id: entry.id,
        publishDate: entry.data.publishDate,
        updatedDate: entry.data.updatedDate,
        description: entry.data.description ?? (body ? toExcerpt(body) : ''),
        body,
        html: body ? renderMarkdown(body) : '',
        images: entry.data.images,
        tags: entry.data.tags
      }
    })
}