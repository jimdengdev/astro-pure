---
title: '博客仓库是 copy 来的？手把手带你同步上游主题更新'
link: sync-upstream-theme
publishDate: '2026-09-06T02:30:00'
updatedDate: '2026-09-06T02:30:00'
description: 'GitHub 博客仓库是直接 copy 别人的主题仓库，没有共同 git 历史，如何安全同步上游新功能？本文记录从添加 upstream、分类处理 185 个合并冲突到构建排错的完整实战过程。'
tags:
  - 'Git'
  - 'GitHub'
  - 'Astro'
  - '博客'
  - '随笔'
draft: false
comment: true
---

## 问题：我的仓库和上游"没有血缘关系"

我的博客基于 [astro-koharu](https://github.com/cosZone/astro-koharu) 主题搭建。当初图省事，直接下载代码重新 `git init` 建了仓库，而不是 GitHub 上点 Fork。

这个决定埋了一颗雷。

半年后上游主题从 4.1.0 迭代到了 6.3.0，新增了一堆功能，我想同步过来，结果发现：**我的仓库根提交是一个 squash 出来的 "Initial commit"，和上游没有任何共同祖先**。直接 `git pull upstream main` 只会得到一句冰冷的：

```plain
fatal: refusing to merge unrelated histories
```

更麻烦的是，我在这半年里加了相册、日记、GA4 统计等自定义功能，不少改动直接碰了主题源码。这不是简单的"拉取更新"，而是一场需要精细排雷的合并。

## 三种方案怎么选

| 方案                                     | 原理                              | 适合场景                 |
| ---------------------------------------- | --------------------------------- | ------------------------ |
| `koharu update`                          | 主题自带 CLI，自动备份 + 冲突分类 | 主题提供了更新工具的情况 |
| 手动 `merge --allow-unrelated-histories` | 直接绕过共同祖先限制              | 想完全掌控合并过程       |
| `koharu update --clean`                  | 上游文件整体覆盖 + 还原用户内容   | 冲突太多想推倒重来       |

我的选择是第一种作为入口，冲突部分手动处理。因为我清楚自己的改动分布，一刀切的覆盖会把我的 200 多行自定义样式全部冲掉。

## 核心：把冲突分成三类再动手

合并启动后，185 个文件进入冲突状态。直接逐个看会看吐，正确姿势是**先分类，再批量处理**。

### 第一类：我没碰过、上游演进了（158 个）

上游迭代了这些文件，我压根没动过。无脑取上游：

```bash
git checkout --theirs -- <file>
git add <file>
```

### 第二类：基础设施（5 个）

`package.json`、`pnpm-lock.yaml`、`astro.config.mjs` 这些配置文件，上游改动更大，取上游后重新 `pnpm install` 即可。

### 第三类：我改过、上游也改了（22 个）—— 真正需要决策的

这里有个精确定位的技巧：**用 blob SHA 比对，而不是靠肉眼**。

```bash
# 拿上游每个文件的 blob SHA
gh api 'repos/OWNER/REPO/git/trees/main?recursive=1' \
  --jq '.tree[] | select(.type=="blob") | .path + " " + .sha' > upstream-blobs.txt

# 拿我初始提交的 blob SHA
git ls-tree -r <initial-commit> | awk '{print $4 " " $3}' > initial-blobs.txt

# 我改过 + 上游也改过 = 真冲突；我改过但上游没动 = 无冲突
```

22 个真冲突里，我的处理逻辑很简单：

| 判断标准                                       | 处理                           |
| ---------------------------------------------- | ------------------------------ |
| 属于我的核心自定义（相册、日记、主题色、路由） | `git checkout --ours` 保留我的 |
| 上游改动与我的功能无关，且上游更完善           | 取上游                         |
| i18n 翻译文件，双方都加了 key                  | 写脚本做 key 级合并            |

i18n 的合并值得一提。我的 `en.ts`/`zh.ts` 里加了相册相关的翻译 key，上游也加了 90 多个新 key，两边都不能丢。写了个 Node 脚本：以我的版本为基线，把上游独有的 key 追加进来，同 key 冲突时保留我的值。三行核心逻辑，比手动复制粘贴可靠得多。

## 踩坑记录：合并完成不等于结束

### 坑 1：迁移检查拦截构建

上游新增了 `koharu migrate --check`，会在构建前扫描内容。结果它报了 14 个"同一语言下存在重复链接"——我的 `ja/ko` 目录下的示例文章被当成了中文（因为 `site.yaml` 的 i18n 配置里没启用这两个语言）。

这些是上游的示例翻译，我根本不用。直接删除 `en/ja/ko` 三个示例目录 + 修正两篇真实文章里复制忘改的 `link` 字段，检查通过。

### 坑 2：合并时保留了旧引用，新依赖没跟上

构建报错 `Cannot read properties of undefined (reading 'enabled')`，定位到 `live.config.ts` 里引用了上游新增的 `momentsConfig`——而我合并时保留了旧版 `site-config.ts`，没有这个导出。

这类问题的本质是：**合并冲突时"保留我的版本"的决策，可能切断上游代码内部的新依赖链**。既然我暂时不用上游的 Moments 功能，直接把 live collection 置空：

```ts
export const collections = {} as unknown as ReturnType<typeof defineLiveCollection>
```

### 坑 3：我的组件引用了上游没有的依赖

`@vercel/analytics/astro` 解析失败——Vercel Analytics 是我自己加的组件，但 `package.json` 取了上游的版本，依赖清单里没有它。权衡后我直接删掉了 Vercel Analytics 组件（GA4 已经覆盖统计需求），顺带清理了配置。

一个原则：**同步时是精简依赖的好时机，别急着把缺的依赖都装回来**。

## 长期策略：让下次同步不再痛苦

1. **自定义改动收敛到 `config/` 和 `src/content/blog/`**。这两个区域是"用户内容"，所有更新工具都会保护它们。
2. **必须改主题源码时，考虑用 patch 文件管理**，而不是直接改。合并后重新应用 patch，冲突一目了然。
3. **每次更新前先备份**。`pnpm koharu backup` 或至少打个 git tag，出事可以回滚。
4. **合并前用 `git diff --stat` 盘点自己的改动分布**。知道改了什么，才知道冲突时该保什么。

这次合并最终落地：331 个文件变更，`+27695 / -9173` 行，主题版本 4.1.0 → 6.3.0，所有自定义功能完好。下一个大版本再来时，流程已经跑通了。
