# 容器重启策略 vs PM2

## Docker 重启策略

```yaml
# docker-compose.yml
services:
  api:
    restart: unless-stopped  # 推荐

# 四种策略：
# no              — 从不自动重启（默认）
# always          — 总是重启（即使手动 stop 的，docker daemon 重启后也会启动）
# on-failure:N    — 只在退出码非 0 时重启（最多 N 次）
# unless-stopped  — 总是重启，除非手动 docker stop（推荐）
```

## 为什么容器中不需要 PM2

```
传统部署（无容器）：
  node dist/main → 进程崩溃 → 服务中断
  需要 PM2 来守护进程、自动重启、多核负载均衡

Docker 部署：
  Docker 本身就是进程管理器
  docker run --restart=unless-stopped → 容器崩溃自动重启
  docker-compose scale api=3 → 水平扩展（多实例）
  Docker Swarm / K8s → 更高级的编排和自愈

容器中运行 PM2 反而引入了额外复杂度：
  - 容器中套进程管理器（PM2 是 PID 1, Node 是 PID 2）
  - 信号传递复杂
  - 与编排系统（K8s）的 Liveness Probe 冲突
```

## 多核利用

```bash
# 没有 PM2，如何利用多核 CPU？
# 方案 1：docker-compose 扩展实例
docker-compose up -d --scale api=4
# 然后 Nginx 反向代理做负载均衡（Day 29）

# 方案 2：K8s 中增加 replicas
# replicas: 4
```

## 容器时代的最佳实践

```
传统服务器的观念：          容器时代的观念：
─────────────────        ─────────────────
PM2 守护进程              Docker restart policy
多核用 cluster mode      多实例水平扩展
服务挂了 PM2 重启        容器挂了编排系统重启
在服务器上手动操作        一切通过文件声明（Dockerfile / docker-compose / k8s yaml）

原则：一个容器一个进程
  - 不要在一个容器中跑多个应用
  - 不要用 PM2 / nodemon 在生产环境
```

## 开发环境保留 nodemon

```dockerfile
# Dockerfile.dev——开发专用
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# 开发环境用 nodemon 热重载
CMD ["npx", "nest", "start", "--watch"]
```

```yaml
# docker-compose.dev.yml
services:
  api:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - .:/app           # 挂载源码目录（代码变更即时生效）
      - /app/node_modules
    command: npx nest start --watch
```

> 总结：Docker 负责进程管理（重启策略 + 水平扩展），开发环境用 `--watch` 做热重载。不需要 PM2。

---

## 参考链接

- [Docker — Restart Policies](https://docs.docker.com/config/containers/start-containers-automatically/)
- [12 Factor App — Processes](https://12factor.net/processes)
