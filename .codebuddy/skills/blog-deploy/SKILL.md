---
name: blog-deploy
description: 一键部署博客到 GitHub，触发 Vercel 自动构建部署。提供博客标题即可完成 git add、commit、push 全流程。使用场景：部署博客、发布文章、推送上线、deploy blog、publish post。
---

# Blog Deploy Skill

一键将 astro-pure 博客变更推送到 GitHub（`jimdengdev/astro-pure` → `main`），触发 Vercel 自动构建部署。

## 快速使用

当用户说"部署博客"、"发布文章"、"推送上线"、"deploy"、"publish"等时，执行部署脚本。

### 方式一：使用部署脚本（推荐）

```bash
./scripts/deploy-blog.sh "博客标题"
```

脚本会自动完成：
1. `git add .` — 暂存所有变更
2. `git commit -m "feat: 博客标题"` — 提交（feat: 前缀）
3. `git push origin main` — 推送到 main 分支

标题可省略，脚本会自动从最近变更的文章文件名提取。推送成功后 Vercel 自动触发构建部署。

### 方式二：手动执行

如果用户有特殊需求（如修改提交信息格式），可以逐步手动执行：

```bash
git add .
git commit -m "feat: 博客标题"
git push origin main
```

## 部署前检查（可选但推荐）

```bash
npx astro build   # 本地构建验证（schema 错误、断链等会在此时暴露）
```

注意：本项目 `.vercel/output` 构建产物目录较大，IDE 安全删除机制可能拦截重复构建时的清理——如遇 `[safe-delete]` 报错，先手动删除 `.vercel/output` 和 `dist` 再构建。

## 执行前检查

1. **确认有变更**：脚本会自动检测，无变更时跳过推送
2. **确认分支**：默认推送到 `origin main`（远程 `https://github.com/jimdengdev/astro-pure.git`）
3. **确认远程仓库**：确保 `git remote -v` 正确配置

## 你的任务

当用户请求部署博客时：

1. **获取博客标题**：如果用户未提供，从最近创建的博文中提取标题，或询问用户
2. **执行脚本**：运行 `./scripts/deploy-blog.sh "标题"`
3. **确认结果**：告知用户推送结果

## 示例对话

**用户**：部署博客

**助手**：执行 `./scripts/deploy-blog.sh "Docker Compose 多服务部署实战"`，完成后告知推送成功、Vercel 构建已触发。

**用户**：把文章推送上线，标题是"React Hooks 最佳实践"

**助手**：执行 `./scripts/deploy-blog.sh "React Hooks 最佳实践"`。
