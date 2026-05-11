# Docker Compose 多服务编排

## 完整 docker-compose.yml

```yaml
# docker-compose.yml（MySQL 版）
version: '3.8'

services:
  # ==================== MySQL ====================
  mysql:
    image: mysql:8.0
    container_name: book-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: book_management
      MYSQL_CHARSET: utf8mb4
      MYSQL_COLLATION: utf8mb4_unicode_ci
    ports:
      - '3306:3306'
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql  # 初始化脚本
    healthcheck:
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost']
      interval: 10s
      timeout: 5s
      retries: 5

  # ==================== Redis ====================
  redis:
    image: redis:7-alpine
    container_name: book-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 3s
      retries: 5

  # ==================== MinIO ====================
  minio:
    image: minio/minio
    container_name: book-minio
    restart: unless-stopped
    ports:
      - '9000:9000'
      - '9001:9001'
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 30s
      timeout: 20s
      retries: 3

  # ==================== Nest API ====================
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: book-api
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://root:rootpassword@mysql:3306/book_management?charset=utf8mb4
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production}
      JWT_ACCESS_EXPIRES_IN: 30m
      JWT_REFRESH_EXPIRES_IN: 7d
      REDIS_HOST: redis
      REDIS_PORT: 6379
      OSS_ENDPOINT: http://minio:9000
      OSS_ACCESS_KEY: minioadmin
      OSS_SECRET_KEY: minioadmin123
      OSS_BUCKET: book-covers
      OSS_PUBLIC_URL: http://localhost:9000
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    healthcheck:
      test: ['CMD', 'wget', '--spider', 'http://localhost:3000/health']
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  mysql_data:
  redis_data:
  minio_data:
```

## PostgreSQL 版差异

```yaml
# docker-compose.yml（PostgreSQL 版）
services:
  postgres:
    image: postgres:16-alpine
    container_name: book-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_password
      POSTGRES_DB: book_management
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    environment:
      DATABASE_URL: postgresql://postgres:postgres_password@postgres:5432/book_management?schema=public
```

## 启动命令

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f api
docker-compose logs -f mysql

# 进入 API 容器
docker-compose exec api sh

# 运行数据库迁移
docker-compose exec api npx prisma migrate deploy

# 运行种子数据
docker-compose exec api npx prisma db seed

# 停止所有服务
docker-compose down

# 停止并删除数据卷（⚠️ 数据会丢失！）
docker-compose down -v
```

## .env.production 示例

```bash
# .env.production
JWT_SECRET=a1b2c3d4e5f6...  # 64+ 字符的随机密钥
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d

# 数据库密码也可以放这里（docker-compose.yml 中用 ${VAR} 引用）
MYSQL_ROOT_PASSWORD=strong_production_password
```

## 完整的启动流程

```bash
# 1. 克隆项目
git clone <repo-url> && cd book-management-system-backend

# 2. 配置环境变量
cp .env.example .env.production
# 编辑 .env.production，填入真实配置

# 3. 构建并启动
docker-compose up -d --build

# 4. 运行数据库迁移
docker-compose exec api npx prisma migrate deploy

# 5. 初始化种子数据
docker-compose exec api npx prisma db seed

# 6. 验证
curl http://localhost:3000/health
# → "ok"
```

---

## 参考链接

- [Docker Compose — Reference](https://docs.docker.com/compose/compose-file/)
- [Prisma — Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-docker)
