---
name: blog-writer
description: 帮助用户按照 astro-pure 博客的规范创建新博文。自动生成正确的 frontmatter 结构、路由 slug、多语言版本对齐，并提供 Markdown 内容框架建议。使用场景：写一篇博文、创建新文章、写文章、写博客、new post、create blog post。
---

# Blog Writer Skill

帮助用户按照 astro-pure 博客的规范创建新博文。

## 项目规范速览

- **内容目录**：`src/content/blog/`（**平铺结构**，所有 `.md` 文件直接放此目录，不建分类子目录）
- **语言架构**：默认英文站（`/blog/...`），中文站（`/zh/blog/...`）；通过 frontmatter `language` 字段区分文章语言
- **无分类概念**：只有 `tags` 承载分类信息（如"笔记/后端"等直接作为标签）
- **Schema 校验**：`src/content.config.ts` 用 Zod 严格校验，超长/缺失字段会直接报错

## 你的任务

当用户请求创建新博文时：

1. **收集必要信息**（如果用户未提供）：
   - 文章标题
   - 文章语言（中文 or 英文，默认中文）
   - 文章主题/关键词（用于生成标签和描述）
   - 是否有对应的其他语言版本（用于路由对齐）

2. **生成 frontmatter**（严格遵守以下 schema）：

   ```yaml
   ---
   title: "文章标题"            # 必填，最多 60 字符（中文也算 60 个）
   link: url-slug              # 可选，自定义路由名（优先于文件名）
   publishDate: "2026-09-30T10:00:00"  # 必填，ISO 格式字符串（带引号！）
   updatedDate: "2026-09-30T10:00:00"  # 可选，同上格式
   description: "一句话描述，50-100 字"  # 必填，最多 160 字符
   tags:                       # 可选，承载分类语义
     - "笔记"
     - "后端"
     - "Go"
   language: "English"         # 可选！仅英文文章需要标注；中文文章不写此字段
   draft: false                # 可选，默认 false
   pin: false                  # 可选，置顶
   comment: true               # 可选，默认 true
   ---
   ```

   **关键约束（Zod 校验，违反即构建失败）**：
   - `title` ≤ 60 字符；`description` ≤ 160 字符且**必填**
   - `publishDate`/`updatedDate` 必须是**带引号的 ISO 字符串**（`"2026-09-30T10:00:00"`），不能写 `2026-09-30 10:00:00`（会被 YAML 解析为 Date 对象导致类型错误）
   - 不支持的字段会被忽略：`categories`、`keywords`、`catalog`、`comments`（注意单复数）等旧字段不要写

3. **多语言文章的路由对齐（link 字段核心用法）**：

   同一篇文章的中英文版本使用**相同的 `link`**，路由自动对齐，语言切换器直达对应版本：

   | 文件 | frontmatter | 路由 |
   | --- | --- | --- |
   | `my-post.md`（中文） | 无 `language` 字段 | `/zh/blog/my-post` |
   | `my-post-en.md`（英文） | `language: "English"` + 同样的 `link: my-post` | `/blog/my-post` |

   **规则**：
   - 中文文章：不写 `language`，文件名即默认 slug
   - 英文文章：**必须**写 `language: "English"`，文件名建议加 `-en` 后缀
   - 有双语版本时：两个文件都写相同的 `link`
   - 单语言文章切换语言时系统自动兜底（同 slug 的另一语言路由渲染原文内容，不 404）

4. **确定文件路径**：
   - 统一放 `src/content/blog/<link 或语义文件名>.md`
   - 文件名规范：英文小写、短横线分隔（如 `react-hooks-guide.md`）
   - 英文版本加 `-en` 后缀（如 `react-hooks-guide-en.md`）

5. **生成 Markdown 内容框架**：见下方内容建议

## 封面图

- 文章无 `heroImage` 时，系统从 `src/assets/images/cover-1.webp` ~ `cover-16.webp` 中按文章 ID 哈希**确定性**选取随机封面
- 需要指定封面时，把图片放文章旁并用相对路径：
  ```yaml
  heroImage:
    src: ./thumbnail.jpg
    color: '#4891B2'   # 可选，卡片主题色
  ```

## 标签建议

常用标签体系（替代旧分类系统）：
- 一级语义：`笔记`、`工具`、`随笔`、`周刊`
- 技术：`Go`、`Python`、`Docker`、`Cloudflare`、`Astro` 等
- 标签会自动去重并转小写（英文标签），中文标签原样保留

## 内容建议

### 技术文章结构

```markdown
## 背景/问题

[描述要解决的问题或技术背景]

## 解决方案

[详细说明解决方法]

### 关键技术点

[技术细节和代码示例]

## 实践效果

[实际应用效果、性能对比等]

## 总结

[总结要点和经验]
```

### 工具/指南类文章结构

```markdown
## 简介
## 安装/准备
## 基本使用
## 高级功能
## 实用技巧
## 总结
```

## Infographic 使用建议

根据文章类型，建议使用信息图的场景：

- **列表信息**（技术栈、功能特性）→ `list-grid-badge-card`
- **流程步骤**（安装步骤、开发流程）→ `sequence-zigzag-steps-underline-text`
- **对比分析**（技术对比、优缺点）→ `compare-binary-horizontal-simple-fold`
- **统计数据**（性能对比、用量统计）→ `chart-column-simple` 或 `chart-bar-plain-text`
- **层级结构**（目录结构、知识体系）→ `hierarchy-tree-tech-style-capsule-item`

## 最后步骤

创建完博文后：

1. **运行检查**：
   - `bun run dev` 本地预览（默认 `http://localhost:4321/`）
   - 中文文章访问 `/zh/blog/<link>` 验证路由
   - 英文文章访问 `/blog/<link>` 验证路由
   - 有双语版本时验证语言切换器双向可达

2. **格式检查**：`bun run lint`（ESLint）

3. **后续建议**：
   - 提醒用户可以使用 infographic skills 添加信息图
   - 提醒部署可使用 blog-deploy skill

## 示例对话

### 示例 1：创建中文文章

**用户**：写一篇关于 Docker Compose 部署的文章

**你应该**：

1. 生成文件 `src/content/blog/docker-compose-deploy.md`
2. frontmatter（无 `language` 字段）：
   ```yaml
   ---
   title: "Docker Compose 多服务部署实战"
   publishDate: "2026-09-30T10:00:00"
   description: "使用 Docker Compose 在单机部署多个服务，共享数据库与反向代理的完整方案。"
   tags:
     - "笔记"
     - "Docker"
     - "部署"
   ---
   ```
3. 提供文章结构框架
4. 提示：如需英文版，创建 `docker-compose-deploy-en.md` 并加 `language: "English"` + 相同 `link: docker-compose-deploy`

### 示例 2：创建双语文章

**用户**：给 sync-upstream-theme 写个英文版

**你应该**：

1. 读取中文版 frontmatter，提取相同的 `link: sync-upstream-theme`
2. 创建 `src/content/blog/sync-upstream-theme-en.md`：
   ```yaml
   ---
   title: "Syncing Upstream Theme Updates After a Repo Copy"   # ≤60 字符
   link: sync-upstream-theme
   language: "English"
   publishDate: "2026-09-05T18:30:00"
   description: "..."   # ≤160 字符
   tags:
     - "Git"
     - "Astro"
   ---
   ```
3. 验证 `/blog/sync-upstream-theme` 与 `/zh/blog/sync-upstream-theme` 双路由可达、切换器互指
