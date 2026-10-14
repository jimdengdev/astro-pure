---
title: '使用 Cloudflare R2 + PicGo 搭建免费图床，博客写作效率翻倍'
publishDate: '2026-07-06T07:50:00'
description: '手把手教你用 Cloudflare R2 搭建免费图床，配合 PicGo 最新版实现截图即上传、粘贴即引用，彻底告别手动管理图片的繁琐流程。'
tags:
  - 'Cloudflare'
  - 'R2'
  - 'PicGo'
  - '图床'
  - '工具'
comment: true
---

## 痛点：写博客时图片管理的烦恼

写技术博客免不了要插入截图、架构图。以前我的流程是这样的：

1. 截图 → 保存到本地
2. 把图片放到项目的 `public/img/` 目录
3. 在 Markdown 里写相对路径
4. 提交到 Git 仓库

时间长了，Git 仓库越来越臃肿，克隆一次要等半天。而且图片和文章耦合在一起，想换个平台发布还得重新处理图片。一个靠谱的图床是刚需。

## 为什么选 Cloudflare R2 + PicGo

| 方案              | 存储费        | 流量费   | 速度   | 稳定性            |
| ----------------- | ------------- | -------- | ------ | ----------------- |
| 微博图床          | 免费          | 免费     | 快     | ❌ 随时可能挂     |
| GitHub + jsDelivr | 免费          | 免费     | 一般   | ❌ 仓库大小有限制 |
| 阿里云 OSS        | 收费          | 收费     | 快     | ✅                |
| **Cloudflare R2** | **10GB 免费** | **免费** | **快** | **✅**            |

R2 的核心优势是**不收流量费**。对象存储的流量费往往比存储费贵得多，R2 直接免了这笔开销。免费额度包含每月 10GB 存储空间、100 万次 Class A 操作（写入、列举等）和 1000 万次 Class B 操作（读取），并且没有 egress 流量费用，这对于博客图床来说非常友好。

PicGo 是一个开源的图床管理工具，最新版 **v2.5.3**（2026 年 6 月），支持截图自动上传、剪贴板图片上传、自动复制链接到剪贴板。配合 R2 使用，真正实现"截图 → 粘贴"一步到位。

## 第一步：开通 Cloudflare R2

### 1. 注册并绑定支付方式

进入 [Cloudflare 控制台](https://dash.cloudflare.com)，左侧菜单存储与数据库找到「R2 对象存储」。首次使用需要绑定信用卡或 PayPal，**这只是身份验证，不会自动扣费**。

### 2. 创建存储桶

点击「创建存储桶」：

- **名称**：自定义，如 `blog-images`（全局唯一）
- **位置**：国内用户选「亚太地区(APAC)」，兼顾国内外选「北美西部(WNAM)」
- **存储类**：标准（Standard）

### 3. 配置公开访问（关键）

存储桶创建后，默认是私有的，需要手动开启公开访问。

**方式一：r2.dev 子域名（仅测试用）**

设置 → R2.dev 子域 → 允许访问，输入 `allow`。

会得到一个 `https://pub-xxxxx.r2.dev` 的公开地址，但有速率限制，不适合生产。

**方式二：自定义域名（推荐）**

如果你已经有托管在 Cloudflare 上的域名，强烈建议绑定自定义域名（如 img.yourdomain.com）。
操作步骤：进入存储桶的 Settings → Custom Domains → 点击 Connect Domain，输入你的子域名（如 img.yourdomain.com），Cloudflare 会自动生成对应的 DNS 记录。配置完成后，等待 DNS 生效，即可通过该域名直接访问桶内的图片资源。

这样所有图片的访问 URL 就是 `https://img.yourdomain.com/xxx.png`。

### 4. 创建 API 令牌

R2 概述页 → 右上角「管理 R2 API 令牌」→ 创建 API 令牌：

- 权限选择「**对象读和写**」
- 创建后立即保存三个关键信息（只显示一次）：
  - **Access Key ID**：访问密钥 ID
  - **Secret Access Key**：访问密钥
  - **S3 API 端点**：格式 `https://xxxxx.r2.cloudflarestorage.com`

## 第二步：安装配置 PicGo

### 1. 安装 PicGo

从 [GitHub Release](https://github.com/Molunerfinn/PicGo/releases) 或[官网](https://molunerfinn.com/PicGo/)下载最新版（当前 v2.5.3），macOS、Windows、Linux 都支持。

> 进阶用户可考虑 [PicList](https://github.com/Kuingsmile/PicList)，在 PicGo 基础上增加了图片管理、批量压缩、水印等功能。

### 2. 安装 S3 插件

R2 兼容 AWS S3 API，PicGo 通过 S3 插件来对接。

打开 PicGo → 插件设置 → 搜索 `s3` → 安装 **picgo-plugin-s3**。

### 3. 配置 S3 图床参数

进入「图床设置」→「Amazon S3」，填写以下参数：

| 参数        | 填写内容                               | 说明                      |
| ----------- | -------------------------------------- | ------------------------- |
| 应用密钥 ID | R2 的 Access Key ID                    | 短字符串，别和 Key 搞混   |
| 应用密钥    | R2 的 Secret Access Key                | 长字符串                  |
| 桶          | `blog-images`                          | 你创建的存储桶名称        |
| 文件路径    | `{year}/{month}/{md5}.{extName}`       | 按年月分类，MD5 防重名    |
| 自定义节点  | `https://xxx.r2.cloudflarestorage.com` | S3 API 端点，带 https://  |
| 自定义域名  | `https://img.yourdomain.com`           | 公开访问域名，带 https:// |
| 区域        | `auto`                                 | R2 会忽略此参数           |
| 上传方式    | **路径式**                             | 必须选此项                |

> ⚠️ 文件路径开头**不要加 `/`**，正确写法：`{year}/{month}/{md5}.{extName}`，错误写法：`/{year}/{month}/{md5}.{extName}`

保存后设为默认图床，拖一张测试图片到上传区，上传成功后浏览器打开链接验证。

## 第三步：博客写作流程图床使用

配置好之后，写博客的流程就简化为：

```plain
截图 → 自动上传 → 粘贴链接 → 继续写作
```

具体操作：

1. **快捷键截图**（macOS: `Cmd+Shift+4` / Windows: `Win+Shift+S`），PicGo 会自动检测剪贴板并上传
2. 上传成功后链接自动复制到剪贴板
3. 回到编辑器，直接 `Cmd+V` 粘贴 Markdown 图片语法

PicGo 支持自定义链接格式，在「PicGo 设置」→「自定义链接格式」中改为：

```plain
![{$fileName}]({$url})
```

这样粘贴出来直接就是 Markdown 图片语法，不用手动加 `![]()`。

## 进阶优化

### 1. 缓存策略（减少请求）

Cloudflare 控制台 → 你的域名 → 规则 → 缓存规则：

- 匹配 `img.yourdomain.com/*`
- 边缘缓存 TTL：6 个月
- 浏览器缓存 TTL：1 个月

图片基本不会变，长缓存能大幅减少 R2 读取请求。

### 2. 防盗链

Cloudflare → WAF → 创建规则，阻止非自己域名的 Referer 请求：

```plain
(http.referer ne "https://jimdeng.com") and (http.referer ne "")
```

### 3. 常见问题

**403 上传失败** → 检查 Access Key ID 和 Secret Key 是否填反、令牌权限是否包含读写。

**上传成功但无法访问** → 检查公开访问或自定义域名是否配置正确、URL 是否带了 `https://`。

**插件安装失败** → 确保已安装 Node.js，或尝试更换网络、管理员权限运行。

## 总结

整套方案投入 30 分钟配置，之后写博客再也不需要手动管理图片文件：

1. Cloudflare R2 做存储 — 10GB 免费、无流量费
2. PicGo 做上传客户端 — 截图即上传、粘贴即引用
3. 自定义域名 + 长缓存 — 访问速度快、稳定性高

Git 仓库瘦身、写作流程简化，一举两得。
