import galleryData from '@/assets/gallery.json'

export interface GalleryPhoto {
  src: string
  alt: string
  caption?: string
  /** English caption (optional; falls back to `caption` on English routes) */
  captionEn?: string
}

export interface GalleryAlbum {
  slug: string
  title: string
  /** English title (optional; falls back to `title` on English routes) */
  titleEn?: string
  description: string
  /** English description (optional; falls back to `description` on English routes) */
  descriptionEn?: string
  date: string
  location?: string
  /** English location (optional; falls back to `location`) */
  locationEn?: string
  tags: string[]
  cover: string
  comments?: boolean
  photos: GalleryPhoto[]
}

const albums = (galleryData as { albums: GalleryAlbum[] }).albums

/** Get all albums sorted by date (newest first) */
export function getAlbums(): GalleryAlbum[] {
  return [...albums].sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** Get all unique tags across albums */
export function getAlbumTags(): string[] {
  return [...new Set(albums.flatMap((a) => a.tags))]
}

/** Find a single album by its slug */
export function findAlbumBySlug(slug: string): GalleryAlbum | undefined {
  return albums.find((a) => a.slug === slug)
}

/**
 * Localized album view: English fields (titleEn/descriptionEn/locationEn/captionEn)
 * take priority on English routes; missing fields fall back to the original
 * (Chinese) content — same fallback semantics as blog posts.
 */
export function localizeAlbum(album: GalleryAlbum, lang: 'zh' | 'en') {
  if (lang === 'zh') return album
  return {
    ...album,
    title: album.titleEn || album.title,
    description: album.descriptionEn || album.description,
    location: album.locationEn || album.location,
    photos: album.photos.map((p) => ({ ...p, caption: p.captionEn || p.caption }))
  }
}
