import type { ImageMetadata } from 'astro'

export interface RemoteCover {
  src: string
  width: number
  height: number
}

/**
 * Fallback cover images.
 *
 * Covers are hosted on a remote image CDN (migrated from the former
 * `src/assets/images/cover-*.webp` local pool). Entries are kept in the same
 * lexicographic order as the previous `import.meta.glob` result, so every post
 * keeps its deterministic fallback cover after the migration.
 */

// const coverModules = import.meta.glob<{ default: ImageMetadata }>(
//   '/src/assets/images/*.{png,jpg,jpeg,webp,avif,gif}',
//   { eager: true }
// )
// const covers: ImageMetadata[] = Object.keys(coverModules)
//   .sort()
//   .map((key) => coverModules[key].default)

const covers: RemoteCover[] = [
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721385985_cover-1.webp',
    width: 3000,
    height: 2000
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721385494_cover-10.webp',
    width: 1920,
    height: 1280
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721392975_cover-11.webp',
    width: 4928,
    height: 3264
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721387577_cover-12.webp',
    width: 1920,
    height: 1280
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721390829_cover-13.webp',
    width: 6000,
    height: 4000
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721398325_cover-14.webp',
    width: 4324,
    height: 3243
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721397760_cover-15.webp',
    width: 3506,
    height: 2329
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721390291_cover-16.webp',
    width: 5760,
    height: 3840
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721384702_cover-2.webp',
    width: 1920,
    height: 1080
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721376036_cover-3.webp',
    width: 2400,
    height: 1600
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721382669_cover-4.webp',
    width: 5991,
    height: 4000
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721381421_cover-5.webp',
    width: 5184,
    height: 3456
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721380161_cover-6.webp',
    width: 3000,
    height: 2000
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721381486_cover-7.webp',
    width: 1920,
    height: 1278
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721382748_cover-8.webp',
    width: 5197,
    height: 3465
  },
  {
    src: 'https://jimimg.pages.dev/file/blog_image/1791721386838_cover-9.webp',
    width: 6000,
    height: 4000
  }
]

/**
 * Deterministically pick a cover from the pool.
 *
 * Uses a stable hash of `seed` (usually the post id) so a given post always keeps the
 * same "random" cover across builds and avoids hydration mismatches.
 */
export function getRandomCover(seed: string): RemoteCover | undefined {
  if (covers.length === 0) return undefined
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return covers[hash % covers.length]
}

/**
 * Resolve any cover source — a local `ImageMetadata` or a remote URL string —
 * to a plain URL, e.g. for social card metadata.
 */
export function coverUrl(cover: ImageMetadata | string): string {
  return typeof cover === 'string' ? cover : cover.src
}
