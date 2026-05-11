# Docker 核心概念

## 三个核心对象

```
Image（镜像）—— 类似前端的 npm 包 / 类定义
  - 一个只读的模板，包含运行应用所需的文件和配置
  - 例如：node:20-alpine, nginx:1.25

Container（容器）—— 类似前端的 new 类 / 实例
  - 从镜像创建的运行实例
  - 每个容器相互隔离，有自己的文件系统、网络

Volume（数据卷） —— 类似外挂硬盘
  - 容器删除后数据不会丢失
  - 用于数据库文件、上传文件等持久化数据
```

## 前端类比

```
Docker Image  = npm 包（node_modules 里的 react/）
Docker Container = npm 安装后在项目中使用 react
Docker Volume = 外挂的 static 文件夹（部署时挂载到 CDN）

docker run     = npm install + npm start
docker build   = npm publish
docker-compose = 前端的 package.json scripts（一键启动多个服务）
```

## 基本命令

```bash
# 镜像操作
docker images                         # 列出所有镜像
docker pull node:20-alpine            # 拉取镜像
docker build -t my-app:v1 .           # 构建镜像

# 容器操作
docker run -d -p 3000:3000 my-app    # 运行容器（后台 + 端口映射）
docker ps                             # 列出运行中的容器
docker logs -f container_id           # 查看日志
docker exec -it container_id sh      # 进入容器 shell
docker stop container_id              # 停止容器
docker rm container_id                # 删除容器

# 清理
docker system prune -a                # 清理未使用的镜像/容器/网络
```

## Docker 架构

```
┌─────────────────────────────────────────────┐
│                                               │
│  docker run my-app                            │
│    │                                          │
│    ▼                                          │
│  ┌──────────────────────────────┐             │
│  │     Docker Container          │             │
│  │                               │             │
│  │  端口 3000 (内部)              │             │
│  │  ┌───────────────────────┐    │             │
│  │  │  NestJS 应用            │    │             │
│  │  │  Node.js 运行时         │    │             │
│  │  │  node_modules          │    │             │
│  │  │  dist/ 编译文件         │    │             │
│  │  └───────────────────────┘    │             │
│  └──────────────┬───────────────┘             │
│                 │                              │
│  -p 3000:3000   │ 端口映射                      │
│                 │                              │
│  ┌──────────────▼───────────────┐             │
│  │        宿主机                  │             │
│  │  http://localhost:3000        │             │
│  └──────────────────────────────┘             │
└─────────────────────────────────────────────┘
```

## 为什么需要 Docker

```
没有 Docker：
  - "我本地能跑啊" → 服务器 Node 版本不对
  - 新成员入职 → 装 MySQL、Redis、MinIO...半天没了
  - 部署 → scp dist/ + npm install + pm2 restart（手动容易出错）

有了 Docker：
  - 镜像包含一切依赖 → "我本地能跑 = 服务器也能跑"
  - docker-compose up → 一键启动全部服务（MySQL/PG + Redis + MinIO + Nest）
  - 部署 → CI/CD 自动构建镜像 → 滚动更新
```

---

## 参考链接

- [Docker — Get Started](https://docs.docker.com/get-started/)
- [Docker — Overview](https://docs.docker.com/get-started/overview/)
