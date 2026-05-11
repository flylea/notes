# Dockerfile 优化技巧

## 1. 分层缓存优化

```dockerfile
# ❌ 低效——每次代码变更都重装所有依赖
FROM node:20-alpine
WORKDIR /app
COPY . .              # ← 代码一变，缓存失效
RUN npm ci            # ← 重装全部依赖
RUN npm run build

# ✅ 高效——利用分层缓存
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./  # ← package.json 不变，缓存有效
RUN npm ci             # ← 跳过！
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .               # ← 只有代码变了，重新编译
RUN npm run build      # ← npm ci 被缓存跳过，构建速度大幅提升
```

## 2. 镜像瘦身

```bash
# 查看镜像大小
docker images | grep book-management

# 单阶段构建：通常 600MB-1.2GB
# 多阶段构建：通常 200-400MB
```

```dockerfile
# 更多瘦身技巧
FROM node:20-alpine AS runner

# 只安装生产依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 删除不必要的文件
RUN rm -rf /tmp/* /var/cache/apk/*

# 使用 alpine 版本（而非完整版）
# node:20        → 300MB+
# node:20-alpine → 50MB+
```

## 3. 非 root 用户

```dockerfile
# ❌ 以 root 运行——安全风险
FROM node:20-alpine
# ... 默认 root 用户

# ✅ 创建专门用户
FROM node:20-alpine
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser
USER appuser
```

## 4. 信号处理

```dockerfile
# Node 默认不处理 SIGTERM——Docker stop 需要等 10 秒超时才杀掉
# 使用 dumb-init 或 tini 作为 PID 1 进程

FROM node:20-alpine
RUN apk add --no-cache dumb-init
USER node
CMD ["dumb-init", "node", "dist/main"]
```

```typescript
// src/main.ts——优雅关闭
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();  // ← 关键！监听 SIGTERM/SIGINT

  await app.listen(3000);

  // 收到 SIGTERM 后会：
  // 1. 停止接收新请求
  // 2. 等待现有请求处理完毕
  // 3. 关闭数据库连接
  // 4. 退出进程
}
```

## 5. 多阶段构建——极致分离

```dockerfile
# Stage 1: 安装依赖
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: 编译
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npx prisma generate

# Stage 3: 运行（最小镜像）
FROM node:20-alpine AS runner
WORKDIR /app

# 只复制必需的运行时依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["node", "dist/main"]
```

## 6. 镜像大小对比

```bash
$ docker images

REPOSITORY          TAG       SIZE
book-management     3-stage   185MB
book-management     2-stage   220MB
book-management     single    850MB
book-management     dev-full  1.8GB
```

---

## 参考链接

- [Docker — Best Practices for Node.js](https://docs.docker.com/language/nodejs/)
- [Docker — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
