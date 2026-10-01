# CODEBUDDY.md
This file provides guidance to CodeBuddy when working with code in this repository.

## Overview

Astro Theme Pure — a blog & documentation theme built on Astro 6, UnoCSS, and Bun. The
repository contains **two layers**:

- **Root app (`/`)** — the theme template / demo site. Contains all pages, layouts, content,
  site config, site-specific components, and the Astro/Vite/Prettier/ESLint config.
- **`packages/pure/`** — the reusable, independently published `astro-pure` npm package
  (v1.4.9): the Astro integration, reusable components, utilities, config schemas, and the
  `astro-pure` CLI.

These are **not** a workspace. The root `package.json` has no `workspaces` field; it consumes
`astro-pure` as a normal registry dependency from `node_modules`. Local changes to
`packages/pure/` do **not** affect the root app unless you link the package (see Commands).

Requires Node.js ≥ 22.12.0 (Astro 6); odd-numbered Node versions are unsupported. Bun is the
primary toolchain.

## Commands

Run from the repository root. All scripts are Bun/npm-run scripts.

- **Install**: `bun install` — installs root dependencies. Run separately inside `packages/pure/`
  after changing that package.
- **Dev server**: `bun dev` — starts Astro dev server at `http://localhost:4321` (EN home `/`,
  ZH home `/zh/`). `bun dev:check` runs `astro check --watch` alongside it. `./dev.sh` wraps the
  same flow (checks Bun, installs deps, clears `.vercel/output`/`dist`, then `bun run dev`).
- **Build**: `bun build` — runs `astro-pure check && astro check && astro build`. The first step
  is a no-op unless `BUN_LINK_PKG=true`, in which case it `bun link`s `packages/pure/` so local
  library edits are picked up. Output goes to `./dist`.
- **Type / content sync**: `bun check` (`astro check`), `bun sync` (`astro sync`).
- **Lint**: `bun lint` — `eslint --fix 'src/**/*.{js,ts,jsx,tsx,astro}'`. **Format**:
  `bun format` — Prettier over js/ts/md/mdx/astro.
- **All-in-one**: `bun yijiansilian` — `lint && sync && check && format`. Use before committing.
- **New post**: `bun pure new [options] <title>` — scaffolds a Markdown/MDX draft under
  `src/content/blog/`. Options: `-l/--lang`, `-d/--draft`, `-m/--mdx`, `-f/--folder`.
- **Cache link avatars**: `bun run cache:avatars` — only runs when
  `integ.links.cacheAvatar` is true; downloads `public/links.json` avatars to `public/avatars/`.
- **Clean**: `bun clean` — removes `.astro`, `.vercel`, `dist`.
- **Library local-link**: from the root, `BUN_LINK_PKG=true bun build` (or any script invoking
  `astro-pure check`) links `packages/pure` into `node_modules`.
- **Docker** (`compose.yml`, profiles): `build`, `preview`, `dev`, `new` — e.g.
  `docker compose --profile dev up` or `docker compose --profile new run --rm new`.
- **Tests**: there is no test suite. `packages/pure` defines `"test": "echo ... exit 1"`; do not
  assume `bun test` is meaningful.

## Architecture

### Integration + virtual config (the core mechanism)

`packages/pure/index.ts` exports `AstroPureIntegration(opts)` — the single integration added in
`astro.config.ts`. In `astro:config:setup` it:

1. Validates `opts` against `UserConfigSchema` (`packages/pure/types/user-config.ts`).
2. Auto-registers the built-in integrations if absent: `@astrojs/sitemap`, `@astrojs/mdx`, and
   `UnoCSS({ injectReset: true })`, splicing them right after itself.
3. Injects remark plugins (`remarkReadingTime` always; `remarkAddZoomable` when
   `integ.mediumZoom.enable`) and rehype plugins (`rehypeExternalLinks` always;
   `rehypeImageCaption` when `content.imageCaption`).
4. Adds the Vite plugin `vitePluginUserConfig` and updates Astro config
   (`scopedStyleStrategy: 'where'`, default prefetch).
5. On `astro:build:done`, builds the Pagefind search index into `dist/pagefind/` when
   `integ.pagefind` is enabled.

`packages/pure/plugins/virtual-user-config.ts` serializes the validated config into **virtual
modules** consumed via bare imports:

- `virtual:config` → the whole parsed user config (most common).
- `virtual:project-context` → root/srcDir/build/trailingSlash.
- `virtual:user-css` → imports each path in `theme.customCss`.
- `virtual:collection-config` → re-exports `collections` from the user's `content.config.ts`.

Because the config is JSON-serialized, functions (e.g. `integ.quote.target`) must be restored
with `new Function` at the consumption site. Types for these modules are declared in
`packages/pure/virtual.d.ts` and `src/type.d.ts`.

### Config system

- **User config**: `src/site.config.ts` exports `theme` (`ThemeUserConfig`), `integ`
  (`IntegrationUserConfig`), `terms`, and a default `config = { ...theme, integ }`. This is the
  file users edit to customize the site.
- **Schema**: `packages/pure/types/*` composes Zod schemas from `packages/pure/schemas/*`
  (favicon, header, locale, logo, social, links, etc.). `user-config.ts` extends the theme schema
  with `integ` and enforces that `pagefind` defaults to `prerender` and can't be enabled without
  prerendering.
- **Flow**: `astro.config.ts` → `AstroPureIntegration(config)` → validated → `virtual:config` →
  components/utilities (`import config from 'virtual:config'`).

### Content collections

Defined in `src/content.config.ts` using Astro's `glob` loader:

- `blog` ← `src/content/blog/**/*.{md,mdx}`; requires `title` (≤60), `description` (≤160),
  `publishDate`; optional `updatedDate`, `heroImage`, `tags` (deduped/lowercased), `language`,
  `draft`, `pin`, `comment`.
- `docs` ← `src/content/docs/**/*.{md,mdx}`; requires `title`, `description`; optional
  `publishDate`, `updatedDate`, `tags`, `draft`, `order` (default 999).

`packages/pure/schemas/` holds **config** schemas (not collection schemas).

### Routing & i18n

Astro file-based routing under `src/pages/`. i18n is configured in `astro.config.ts`
(`locales: ['en','zh']`, `prefixDefaultLocale: false`, `trailingSlash: 'never'`), so English lives
at the root and Chinese mirrors under `src/pages/zh/`. Helpers in `src/i18n/utils.ts`
(`getLangFromUrl`, `getLocalePath`, `getAlternatePath`, `getBlogByLang`) plus
`src/i18n/translations.ts` drive language switching and post filtering by frontmatter `language`.

Notable endpoints: `rss.xml.ts` (site RSS via `@astrojs/rss`), `robots.txt.ts`,
`docs/rss.xml.ts`, `search/index.astro` (Pagefind UI). Blog list/detail, tags, archives, links,
projects, about, terms, and docs each have their own page directory.

### Layouts

Composition chain: `BaseLayout` → `ContentLayout` → { `BlogPost`, `CommonPage` }, with
`IndividualPage` also built on `BaseLayout`.

- `BaseLayout.astro` — outer HTML skeleton: `BaseHead`, `ThemeProvider`, `Header`/`Footer`
  (from `astro-pure/components/basic`), global styles, lang from URL.
- `ContentLayout.astro` — article/doc two-column shell: sidebar slot, `data-pagefind-body`
  article, mobile sidebar toggle JS.
- `BlogPost.astro` — adds `TOC`, `Hero`, `Copyright`, `ArticleBottom`, comments, `MediumZoom`,
  KaTeX CSS.
- `IndividualPage.astro` — standalone md/mdx pages (TOC, meta, pagefind body).
- `CommonPage.astro` — lightweight wrapper with optional TOC/comment.

### Components: template vs library

- **Reusable (in `packages/pure/components/`)**, grouped and re-exported via the package exports
  map: `astro-pure/user` (atoms: Card, Tabs, Steps, Timeline, Button, Icon, …),
  `astro-pure/components/basic` (Header, Footer, ThemeProvider),
  `astro-pure/components/pages` (TOC, Paginator, PostPreview, Hero, Copyright, PFSearch, …),
  `astro-pure/advanced` (Quote, GithubCard, LinkPreview, QRCode, MediumZoom). Also exported:
  `astro-pure/utils`, `astro-pure/server`, `astro-pure/types`, `astro-pure/libs`.
- **Template-specific (in `src/components/`)**: `BaseHead`, `Header` (custom i18n nav),
  `PostPreview`, and folders `about/`, `home/`, `projects/`, `links/`, `waline/` (comment
  widgets). These are not part of the published package.

### Styling & theming

- Root `uno.config.ts` uses `presetMini` + `presetTypography`, with custom rules (`sr-only`,
  `line-clamp-n`, …) and a `safelist`. It imports `integ` from `src/site.config.ts` to tune
  typography at config time.
- Theme colors map to CSS variables (`hsl(var(--primary) …)`, etc.) defined in
  `src/assets/styles/app.css` (`:root` and `.dark`); `src/assets/styles/global.css` holds
  scrollbar/Shiki variables. `.dark` is toggled by `ThemeProvider`.
- The library injects UnoCSS + reset automatically; a project using `astro-pure` standalone must
  provide UnoCSS.

### Markdown / syntax highlighting

Handled in `astro.config.ts`: `remarkMath` + `rehypeKatex`, `rehypeHeadingIds`,
`rehypeAutolinkHeadings`, and a Shiki pipeline with two theme states
(`github-light`/`github-dark`). Custom transformers live in `src/plugins/` — `shiki-custom-
transformers.ts` (title, language badge, copy button, line collapse, style) and
`shiki-official/` (diff/highlight/notation). Note the `@ts-ignore` comments caused by duplicate
`@shikijs/types` copies.

### CLI

`packages/pure/scripts/index.js` (bin `astro-pure`, aliased as `bun pure`) dispatches:
`check` → `scripts/check.mjs` (conditional `bun link`), `new` → `scripts/new.mjs` (post
scaffolding into `src/content/blog/`), plus `info` and `help`.

### Deployment

`astro.config.ts` uses `adapter: vercel({ imageService: true })` with `output: 'server'`. The
`Dockerfile` builds on `oven/bun:debian` (installs `fontconfig`, runs `bun install
--frozen-lockfile`, exposes 4321). `compose.yml` provides `build`/`preview`/`dev`/`new` profiles.
There is no CI workflow in `.github/` (only issue templates and `FUNDING.yml`).

## Conventions

- **Path aliases** (`tsconfig.json`): `@/assets/*`, `@/components/*`, `@/layouts/*`,
  `@/utils`, `@/plugins/*`, `@/pages/*`, `@/types`, `@/site-config`, `@/i18n` — all mapped to the
  root `src/`.
- **Prettier** (`prettier.config.ts`): no semicolons, single quotes, `printWidth: 100`,
  `trailingComma: 'none'`, plus `prettier-plugin-astro` and import sorting via
  `@ianvs/prettier-plugin-sort-imports`. Respect the `importOrder` groups
  (`astro` → `@astrojs/*` → third-party → `astro-pure/*` → `@/…` aliases → `virtual:*` → relative).
- **ESLint**: flat config using `eslint-plugin-astro` recommended; ignores `public/scripts/*`,
  `scripts/*`, `.astro/`, `src/env.d.ts`.
- **`preset/`** contains design assets (icons, signature component, avatar-cache script) — not
  runtime code.
