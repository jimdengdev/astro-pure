import type { CollectionEntry } from 'astro:content'

import { getUniqueTagsWithCount } from 'astro-pure/server'
import seriesData from '@/assets/series.json'

export interface SeriesMeta {
  /** URL 与 frontmatter `series` 字段使用的唯一标识 */
  slug: string
  title: string
  /** English title (optional; falls back to `title` on English routes) */
  titleEn?: string
  description: string
  /** English description (optional; falls back to `description` on English routes) */
  descriptionEn?: string
  /** 封面图；为空时回退到图床随机封面池（getRandomCover） */
  cover?: string
}

const series = (seriesData as { series: SeriesMeta[] }).series

/** Get all configured series (order as defined in series.json) */
export function getSeries(): SeriesMeta[] {
  return series
}

/** Find a single series by its slug */
export function findSeriesBySlug(slug: string): SeriesMeta | undefined {
  return series.find((s) => s.slug === slug)
}

/**
 * Localized series view: English fields (titleEn/descriptionEn) take priority on
 * English routes; missing fields fall back to the original (Chinese) content —
 * same fallback semantics as gallery albums.
 */
export function localizeSeries(meta: SeriesMeta, lang: 'zh' | 'en'): SeriesMeta {
  if (lang === 'zh') return meta
  return {
    ...meta,
    title: meta.titleEn || meta.title,
    description: meta.descriptionEn || meta.description
  }
}

/** Posts belonging to a series (frontmatter `series` matches slug) */
export function getSeriesPosts(
  posts: CollectionEntry<'blog'>[],
  slug: string
): CollectionEntry<'blog'>[] {
  return posts.filter((post) => post.data.series === slug)
}

export interface SeriesStats {
  postCount: number
  /** 频率最高的前 N 个 tag（getUniqueTagsWithCount 已按频率降序） */
  topTags: string[]
}

export function getSeriesStats(
  posts: CollectionEntry<'blog'>[],
  slug: string,
  maxTags = 6
): SeriesStats {
  const seriesPosts = getSeriesPosts(posts, slug)
  const topTags = getUniqueTagsWithCount(seriesPosts)
    .slice(0, maxTags)
    .map(([tag]) => tag)
  return { postCount: seriesPosts.length, topTags }
}
