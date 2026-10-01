---
title: "newapi、sub2api、cpa三件套同数据库部署"
publishDate: "2026-07-06T07:02:00"
description: "在一台 Linux 服务器上，使用 Docker Compose 一键部署 New-API、Sub2API、CPA 三个 AI API 服务，共享同一个 PostgreSQL 和 Redis 实例，并通过 Caddy 实现域名反向代理和自动 HTTPS 证书，解决迁移备份难题。"
tags:
  - "Caddy"
  - "newapi"
  - "sub2api"
  - "CPA"
  - "笔记"
  - "后端"
comment: true
---


## 背景

最近需要在服务器上部署一套 AI API 服务，涉及 [New-API](https://github.com/Calcium-Ion/new-api)（AI API 管理分发系统）、[Sub2API](https://github.com/weishaw-wu/sub2api)（订阅转换服务）和 [CPA](https://github.com/Calcium-Ion/cpa)（API 计费面板）三个组件。它们都需要 PostgreSQL 和 Redis，如果各自部署一套数据库会很浪费资源，并且备份会很麻烦，所以想让这三者共用一套存储。

本文记录如何用 Docker Compose 将它们整合在一起，共享基础设施，并通过 Caddy 统一反代。

## 架构概览

```plain
┌──────────────────────────────────────────────┐
│                   Caddy                       │
│          (HTTPS 反向代理 + 自动证书)           │
│                                               │
│  sub.example.com     → localhost:28080        │
│  newapi.example.com  → localhost:13000        │
│  cpa.example.com     → localhost:8317         │
│  http:// (IP直连)    → 403 Forbidden          │
└──────────────┬───────────────────────────────┘
               │
┌──────────────▼───────────────────────────────┐
│          Docker Network: ai-net               │
│                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ New-API  │ │ Sub2API  │ │   CPA    │      │
│  │  :13000  │ │  :28080  │ │  :8317   │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       │            │            │             │
│       └────────────┼────────────┘             │
│                    │                          │
│       ┌────────────┴────────────┐             │
│       │  PostgreSQL 16-Alpine   │             │
│       │  Redis 7-Alpine         │             │
│       └─────────────────────────┘             │
└───────────────────────────────────────────────┘
```

几个关键设计决策：

- 所有应用端口只绑定 `127.0.0.1`，不直接暴露到公网
- Redis 使用不同 DB 隔离（New-API 用 DB0，Sub2API 用 DB1）
- Caddy 自动申请 Let's Encrypt 证书

## 环境准备

### 服务器要求

- Linux 服务器（本文以 Ubuntu 22.04 为例）
- Docker + Docker Compose v2
- 域名已解析到服务器 IP

### 创建项目目录

```bash
mkdir -p /opt/ai-services/pg-init
cd /opt/ai-services
```

## 配置文件

### `.env` 环境变量

```bash
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_strong_password

# Redis
REDIS_PASSWORD=your_redis_password

# 数据库名
SUB2API_DB=sub2api

# 服务端口
NEW_API_PORT=13000
SUB2API_PORT=28080
CPA_PORT=8317
```

### PostgreSQL 初始化脚本

`pg-init/01-init.sql`：

```sql
-- 创建 sub2api 数据库
CREATE DATABASE sub2api;

-- 对 public schema 授权（PostgreSQL 15+ 需要）
\c sub2api
GRANT ALL ON SCHEMA public TO newapi;
```

### `docker-compose.yml`

```yaml
version: "3.8"

services:
  # ==================== 基础设施 ====================
  postgres:
    image: postgres:16-alpine
    container_name: postgres
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "127.0.0.1:54321:5432"
    volumes:
      - ./pgdata:/var/lib/postgresql/data
      - ./pg-init:/docker-entrypoint-initdb.d
    networks:
      - ai-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - ./redisdata:/data
    networks:
      - ai-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ==================== 应用服务 ====================
  new-api:
    image: calciumion/new-api:latest
    container_name: new-api
    restart: always
    ports:
      - "127.0.0.1:${NEW_API_PORT}:3000"
    environment:
      SQL_DSN: "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/postgres"
      REDIS_CONN_STRING: "redis://:${REDIS_PASSWORD}@redis:6379/0"
      SESSION_SECRET: "change-me-to-random-string"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - ai-net

  sub2api:
    image: weishaw/sub2api:latest
    container_name: sub2api
    restart: always
    ports:
      - "127.0.0.1:${SUB2API_PORT}:28080"
    environment:
      DATABASE_TYPE: postgres
      DATABASE_HOST: postgres
      DATABASE_PORT: "5432"
      DATABASE_USER: ${POSTGRES_USER}
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD}
      DATABASE_NAME: ${SUB2API_DB}
      REDIS_HOST: redis
      REDIS_PORT: "6379"
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      REDIS_DB: "1"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - ai-net

  cpa:
    image: calciumion/cpa:latest
    container_name: cpa
    restart: always
    ports:
      - "127.0.0.1:${CPA_PORT}:8317"
    environment:
      PORT: "8317"
      SQL_DSN: "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/postgres"
      REDIS_CONN_STRING: "redis://:${REDIS_PASSWORD}@redis:6379/0"
      SESSION_SECRET: "change-me-to-random-string"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - ai-net

networks:
  ai-net:
    driver: bridge
```

> **注意**：Sub2API 的端口映射是 `28080:28080`，因为容器内部实际监听 28080 端口（初始化向导会将端口持久化到数据库）。如果写成 `28080:8080`，初始化完成后会连接不上。

## 启动服务

```bash
cd /opt/ai-services
docker compose up -d
```

查看服务状态：

```bash
docker compose ps
```

预期所有服务状态为 `Up` 且 `healthy`。

## Sub2API 初始化向导

1. 浏览器访问 `http://服务器IP:28080`
2. 按照向导填写数据库信息（服务名 `postgres`，端口 `5432`）和 Redis 信息（服务名 `redis`，端口 `6379`，DB `1`）
3. 完成初始化后，容器重启并监听 28080 端口

> 如果初始化超时，刷新页面重新填写即可，数据已存入数据库不会丢失。

## Caddy 反向代理

### 安装 Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Caddyfile 配置

```text
# 禁止 IP 直连访问
http:// {
    respond "Forbidden" 403
}

# Sub2API
sub.example.com {
    reverse_proxy localhost:28080
}

# New-API
newapi.example.com {
    reverse_proxy localhost:13000
}

# CPA
cpa.example.com {
    reverse_proxy localhost:8317
}
```

> **重要**：不要使用 `*.example.com` 通配符块，这会让 Caddy 尝试申请通配符 SSL 证书，而 HTTP-01 挑战不支持通配符证书，会导致证书申请失败。

重载配置：

```bash
caddy validate --config /etc/caddy/Caddyfile
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy reload --config /etc/caddy/Caddyfile
```

开放 80/443 端口：

```bash
ufw allow 80/tcp
ufw allow 443/tcp
```

## 踩坑实录

### 1. Redis 连接超时

**现象**：`context deadline exceeded`

**原因**：防火墙阻止了 Docker 网络段访问 Redis。Docker 默认使用 `172.x.x.x` 网段，而 `ufw` 默认只放行 `127.0.0.1`。

**解决**：

```bash
ufw allow from 172.16.0.0/12 to any port 5432 proto tcp
ufw allow from 172.16.0.0/12 to any port 6379 proto tcp
```

### 2. Sub2API 初始化后 Connection reset

**现象**：初始化向导完成后，访问页面时出现 `Connection reset by peer`。

**原因**：容器内部实际监听 28080 端口（初始化时写入数据库），但端口映射写成了 `28080:8080`。容器内根本没有进程监听 8080，自然连接被重置。

**诊断**：

```bash
docker exec sub2api netstat -tlnp
# 输出显示：tcp  0  0 :::28080  :::*  LISTEN
```

确认容器内监听的是 28080 后，将端口映射改为 `"${SUB2API_PORT}:28080"` 即可。

### 3. CPA 显示端口为 `:0`

**原因**：CPA 容器未正确读取端口配置。

**解决**：在 CPA 的 environment 中添加 `PORT: "8317"` 环境变量。

### 4. Caddy 通配符证书申请失败

**错误日志**：

```plain
could not get certificate from issuer ... *.example.com
```

**原因**：Caddyfile 中写了 `*.example.com` 通配符域名，Let's Encrypt 的 HTTP-01 挑战不支持通配符证书。

**解决**：删除通配符块，改用 `http://` 块返回 403 来禁止 IP 直连。

### 5. PostgreSQL 数据库初始化失败

**原因**：PostgreSQL 15+ 默认不授予 public schema 权限。

**解决**：在 `01-init.sql` 中添加 `GRANT ALL ON SCHEMA public TO newapi;`。

## 维护命令速查

```bash
# 查看所有容器状态
docker compose ps

# 查看指定容器日志
docker logs -f new-api
docker logs -f sub2api
docker logs -f cpa

# 重启单个服务
docker compose restart sub2api

# 停止所有服务
docker compose down

# 更新镜像并重启
docker compose pull
docker compose up -d

# 进入容器 shell
docker exec -it postgres psql -U postgres
docker exec -it sub2api sh

# 备份数据库
docker exec postgres pg_dump -U postgres sub2api > sub2api_backup.sql

# Caddy 日志
journalctl -u caddy -f
```

## 安全建议

1. **修改默认密码**：所有服务的 Session Secret / JWT Secret 务必修改为随机字符串
2. **防火墙**：仅开放 80/443 端口，应用端口只绑定 127.0.0.1
3. **数据库密码**：生产环境使用更强的 `POSTGRES_PASSWORD` 和 `REDIS_PASSWORD`
4. **定期备份**：定期执行 `pg_dump` 备份，或挂载持久化 volume
5. **证书自动续签**：Caddy 会自动续签 Let's Encrypt 证书，无需手动干预

## 总结

这套方案的核心思路是 **共享基础设施，隔离应用数据**。通过 Docker Compose 管理所有服务，PostgreSQL 和 Redis 只各启动一个实例，用不同的数据库/DB 号隔离开三个应用的数据库。Caddy 作为统一入口处理 HTTPS 和反向代理，配置简洁且证书自动管理。

整套部署完成后，三个服务各自有独立域名、自动 HTTPS，IP 直连被拒绝，数据库和缓存共享同一套基础设施，运维成本很低。
