# Nest 项目 Dockerfile

## 单阶段构建（简单版）

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main"]
```

```bash
docker build -t book-management:v1 .
docker run -d -p 3000:3000 --env-file .env book-management:v1
```

## 多阶段构建（推荐）

```dockerfile
# Dockerfile
# ==================== Stage 1: 构建阶段 ====================
FROM node:20-alpine AS builder

WORKDIR /app

# 分层缓存依赖
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# 生成 Prisma Client
RUN npx prisma generate

# 复制源码并编译
COPY . .
RUN npm run build

# ==================== Stage 2: 运行阶段 ====================
FROM node:20-alpine AS runner

WORKDIR /app

# 安全：使用非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# 只复制运行时需要的文件
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# 创建日志目录
RUN mkdir -p logs && chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

# 启动前运行 migration deploy
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
```

## .dockerignore

```
node_modules
dist
.git
.env
.env.local
logs
uploads
*.md
.gitignore
Dockerfile
docker-compose.yml
```

## 构建和运行

```bash
# 构建
docker build -t book-management:latest .

# 运行
docker run -d \
  --name book-api \
  -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e JWT_SECRET="prod-secret-key" \
  -e REDIS_HOST="redis" \
  book-management:latest

# 查看日志
docker logs -f book-api
```

## 使用 docker-compose 管理环境变量

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    container_name: book-api
    ports:
      - '3000:3000'
    env_file:
      - .env.production
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    restart: unless-stopped
```

## 生产环境注意事项

```
1. 不要把 .env 打进镜像——docker-compose 或 docker run 注入
2. 使用 secrets 管理敏感信息（Docker Swarm / K8s Secrets）
3. 上传文件用 Volume 挂载或 OSS——容器重启不丢数据
4. 健康检查——让编排工具知道容器是否健康
```

```dockerfile
# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

---

## 参考链接

- [Node.js — Dockerizing Guide](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Prisma — Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
