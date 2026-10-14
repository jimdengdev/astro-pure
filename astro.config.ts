import { rehypeHeadingIds } from '@astrojs/markdown-remark'
import vercel from '@astrojs/vercel'
import AstroPureIntegration from 'astro-pure'
import { defineConfig, fontProviders, svgoOptimizer } from 'astro/config'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'

// Local integrations
import rehypeAutolinkHeadings from './src/plugins/rehype-auto-link-headings.ts'
// Shiki
import {
  addCollapse,
  addCopyButton,
  addLanguage,
  addTitle,
  updateStyle
} from './src/plugins/shiki-custom-transformers.ts'
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerRemoveNotationEscape
} from './src/plugins/shiki-official/transformers.ts'
import config from './src/site.config.ts'

// https://astro.build/config
export default defineConfig({
  // [Basic]
  site: 'https://jimdeng.com',
  trailingSlash: 'never',

  // [i18n]
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      prefixDefaultLocale: false
    }
  },
  // root: './my-project-directory',
  server: { host: true },
  // IDE WebView 预览环境用不到开发工具栏，禁用可避免 entrypoint.js 加载报错
  devToolbar: { enabled: false },
  // https://docs.astro.build/en/guides/prefetch/
  prefetch: {
    // prefetchAll: true,
    defaultStrategy: 'viewport'
  },

  // [Adapter]
  // https://docs.astro.build/en/guides/deploy/
  // maxDuration：SSR 路由（时光页）需访问外部 memos API，放宽函数时限避免冷启动+网络延迟触发平台超时
  adapter: vercel({ imageService: true, maxDuration: 30 }),
  output: 'server',
  // Local (standalone)
  // adapter: node({ mode: 'standalone' }),
  // output: 'server',

  // [Assets]
  image: {
    responsiveStyles: true,
    service: { entrypoint: 'astro/assets/services/sharp' },
    // domains: ['ghchart.rshah.org'],
    remotePatterns: [{ protocol: 'https' }]
  },
  // Enable font preloading and optimization
  // https://docs.astro.build/en/guides/fonts/
  fonts: [
    {
      provider: fontProviders.fontshare(),
      name: 'Satoshi',
      cssVariable: '--font-satoshi',
      // Default included:
      // weights: [400],
      // styles: ["normal", "italics"],
      // subsets: ["cyrillic-ext", "cyrillic", "greek-ext", "greek", "vietnamese", "latin-ext", "latin"],
      // fallbacks: ["sans-serif"],
      styles: ['normal', 'italic'],
      weights: [400, 500],
      subsets: ['latin']
    }
  ],

  // [Vite]
  // `astro-pure/utils` re-exports `./date`, which imports the virtual module
  // `virtual:config` provided by the astro-pure integration. Exclude the package
  // from esbuild dependency pre-bundling: otherwise the optimizer cannot resolve
  // `virtual:config` and the generated client entry fails to load in the browser.
  vite: {
    optimizeDeps: {
      exclude: ['astro-pure']
    },
    ssr: {
      // sanitize-html（CJS）会 require ESM-only 的 htmlparser2，
      // Vercel Serverless 运行时不支持 require(ESM)，会抛 ERR_REQUIRE_ESM 导致 500。
      // 强制打包进 bundle，由构建期 esbuild 处理 CJS/ESM 互操作。
      noExternal: [
        'sanitize-html',
        'marked',
        'htmlparser2',
        'domhandler',
        'domutils',
        'dom-serializer',
        'domelementtype',
        'launder',
        'entities',
        'boolbase',
        'postcss',
        'nanoid',
        'picocolors',
        'source-map-js',
        'deepmerge',
        'is-plain-object',
        'parse-srcset',
        'escape-string-regexp'
      ]
    }
  },

  // [Markdown]
  markdown: {
    // 注意：Markdown 中的远程图片请直接写 <img src="https://...">，
    // 不要用 ![alt](https://...) 语法——Astro 渲染时会在服务端抓取远程图片
    // 推断尺寸（inferSize），网络受限或图床失效会导致整页渲染失败。
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [rehypeKatex, {}],
      rehypeHeadingIds,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { className: ['anchor'] },
          content: { type: 'text', value: '#' }
        }
      ]
    ],
    // https://docs.astro.build/en/guides/syntax-highlighting/
    shikiConfig: {
      // `infographic` / `mermaid` 代码块由客户端渲染为图形（ExpressDiagrams），
      // Shiki 只需按纯文本输出源码，别名避免 "language doesn't exist" 警告
      langAlias: { infographic: 'text' },
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      },
      transformers: [
        // Two copies of @shikijs/types (one under node_modules
        // and another nested under @astrojs/markdown-remark → shiki).
        // Official transformers
        // @ts-ignore this happens due to multiple versions of shiki types
        transformerNotationDiff(),
        // @ts-ignore this happens due to multiple versions of shiki types
        transformerNotationHighlight(),
        // @ts-ignore this happens due to multiple versions of shiki types
        transformerRemoveNotationEscape(),
        // Custom transformers
        // @ts-ignore this happens due to multiple versions of shiki types
        updateStyle(),
        // @ts-ignore this happens due to multiple versions of shiki types
        addTitle(),
        // @ts-ignore this happens due to multiple versions of shiki types
        addLanguage(),
        // @ts-ignore this happens due to multiple versions of shiki types
        addCopyButton(2000), // timeout in ms
        // @ts-ignore this happens due to multiple versions of shiki types
        addCollapse(15) // max lines that needs to collapse
      ]
    }
  },

  // [Integrations]
  integrations: [
    // astro-pure will automatically add sitemap, mdx & unocss
    // sitemap(),
    // mdx(),
    AstroPureIntegration(config)
  ],

  // [Experimental]
  experimental: {
    // Allow compatible editors to support intellisense features for content collection entries
    // https://docs.astro.build/en/reference/experimental-flags/content-intellisense/
    contentIntellisense: true,
    // Enable SVGO optimization for SVG assets
    // https://docs.astro.build/en/reference/experimental-flags/svg-optimization/
    svgOptimizer: svgoOptimizer(),
    // Enables pre-rendering your prefetched pages on the client in supported browsers.
    // https://docs.astro.build/en/reference/experimental-flags/client-prerender/
    clientPrerender: true,
    // https://docs.astro.build/en/reference/experimental-flags/queued-rendering/
    queuedRendering: {
      enabled: true
    }
  }
})
