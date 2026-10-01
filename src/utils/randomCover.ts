import type { ImageMetadata } from 'astro'

/**
 * Fallback cover images.
 *
 * Any image dropped into `src/assets/images/` is picked up automatically and can be
 * used as a cover for posts that do not declare their own `heroImage`.
 */
const coverModules = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/images/*.{png,jpg,jpeg,webp,avif,gif}',
  { eager: true }
)

const covers: ImageMetadata[] = Object.keys(coverModules)
  .sort()
  .map((key) => coverModules[key].default)

/**
 * Deterministically pick a cover from the pool.
 *
 * Uses a stable hash of `seed` (usually the post id) so a given post always keeps the
 * same "random" cover across builds and avoids hydration mismatches.
 */
export function getRandomCover(seed: string): ImageMetadata | undefined {
  if (covers.length === 0) return undefined
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return covers[hash % covers.length]
}
