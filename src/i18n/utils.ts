import { defaultLang, translations, type Lang } from './translations'

/**
 * Get locale from URL path
 */
export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/')
  if (lang in translations) return lang as Lang
  return defaultLang
}

const ENGLISH_LANG_VALUES = new Set(['en', 'english'])

/** 判断文章是否为英文（frontmatter language: "English"/"en"） */
export function isEnglishPost(post: { data: { language?: string } }): boolean {
  return ENGLISH_LANG_VALUES.has((post.data.language || '').toLowerCase())
}

/**
 * 文章路由 slug：frontmatter `link` 字段优先，回退到文件名（post.id）。
 * 用于对齐同一篇文章多语言版本的路由名，如：
 *   sync-upstream-theme.md (link: sync-upstream-theme)     → /zh/blog/sync-upstream-theme
 *   sync-upstream-theme-en.md (link: sync-upstream-theme)  → /blog/sync-upstream-theme
 */
export function getPostSlug(post: { id: string; data?: unknown }): string {
  const link = (post.data as { link?: string } | undefined)?.link
  return (typeof link === 'string' && link) || post.id
}

/**
 * 获取指定语言的博客文章：
 * - en: 仅 language 标注为英文的文章
 * - zh: 其余文章（未标注 language 视为中文）
 */
export async function getBlogByLang(lang: Lang) {
  const { getBlogCollection } = await import('astro-pure/server')
  const posts = await getBlogCollection()
  return lang === 'en' ? posts.filter(isEnglishPost) : posts.filter((p) => !isEnglishPost(p))
}

/**
 * Create a translation function for the given language
 */
export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof translations)[typeof defaultLang]): string {
    return translations[lang][key] || translations[defaultLang][key] || key
  }
}

/**
 * Get localized path: add /zh prefix for Chinese, keep as-is for English (default)
 */
export function getLocalePath(lang: Lang, path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (lang === defaultLang) return cleanPath
  // Avoid double slash / trailing slash when path is home ('/')
  if (cleanPath === '/') return `/${lang}`
  return `/${lang}${cleanPath}`
}

/**
 * Get the alternate language path for language switching.
 *
 * Every blog post slug is generated under both /blog/<slug> and /zh/blog/<slug>
 * (the route without a real translation falls back to the original content),
 * so a plain prefix swap always resolves to an existing page.
 */
export function getAlternatePath(currentUrl: URL): { lang: Lang; path: string } {
  const currentLang = getLangFromUrl(currentUrl)
  const targetLang: Lang = currentLang === 'en' ? 'zh' : 'en'

  let pathname = currentUrl.pathname
  // Remove current lang prefix if present
  if (currentLang !== defaultLang) {
    pathname = pathname.replace(`/${currentLang}`, '') || '/'
  }
  // Normalize home path to '' to avoid trailing slash when concatenating
  // (site uses trailingSlash: 'never', so '/zh/' would 404 — must be '/zh')
  const normalizedPath = pathname === '/' ? '' : pathname
  const targetPath = targetLang === defaultLang ? normalizedPath || '/' : `/${targetLang}${normalizedPath}`

  return { lang: targetLang, path: targetPath }
}
