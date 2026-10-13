import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

function removeDupsAndLowerCase(array: string[]) {
  if (!array.length) return array
  const lowercaseItems = array.map((str) => str.toLowerCase())
  const distinctItems = new Set(lowercaseItems)
  return Array.from(distinctItems)
}

// Define blog collection
const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Required
  schema: ({ image }) =>
    z.object({
      // Required
      title: z.string().max(80),
      description: z.string().max(160),
      publishDate: z.coerce.date(),
      // Optional
      updatedDate: z.coerce.date().optional(),
      heroImage: z
        .object({
          src: image(),
          alt: z.string().optional(),
          inferSize: z.boolean().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          color: z.string().optional()
        })
        .optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      language: z.string().optional(),
      draft: z.boolean().default(false),
      pin: z.boolean().optional(),
      // Custom route slug, takes priority over the filename (post.id).
      // Used to align route names across language versions of the same post,
      // e.g. sync-upstream-theme.md & sync-upstream-theme-en.md both use
      // link: sync-upstream-theme → /blog/... and /zh/blog/...
      link: z.string().optional(),
      // 系列归属：值需与 src/assets/series.json 中某个条目的 slug 一致
      series: z.string().optional(),
      // Special fields
      comment: z.boolean().default(true)
    })
})

// Define docs collection
const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      title: z.string().max(60),
      description: z.string().max(160),
      publishDate: z.coerce.date().optional(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      draft: z.boolean().default(false),
      // Special fields
      order: z.number().default(999)
    })
})

// Define whispers (moments) collection — 短动态/碎碎念，独立于博客
const whispers = defineCollection({
  loader: glob({ base: './src/content/whispers', pattern: '**/*.{md,mdx}' }),
  schema: () =>
    z.object({
      // Optional: most whispers are short notes without a title
      title: z.string().max(80).optional(),
      // Optional one-line summary (falls back to the body excerpt)
      description: z.string().max(160).optional(),
      publishDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      // Remote image URLs (image CDN)
      images: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
      language: z.string().optional(),
      draft: z.boolean().default(false)
    })
})

export const collections = { blog, docs, whispers }
