# VPS 企业级演练手册（6C/6G · Ubuntu 26 · 100G · 国内 .net 域名）

> 目的：用你自己的服务器把 `example/`（会议室预订 API）**真正部署、压测、备份、回滚、加固**一遍，顺带把审计报告里 8 条「企业就绪」验收项跑成实测。
> 全程由你在服务器上执行；每一步都给了「预期输出」和「失败怎么办」。
> 原则：**先只读勘察 → 再隔离部署 → 每一步可回退**。不要动服务器上已有的服务。

---

## 0. 先做 3 个决策（决定后面怎么走）

| 决策 | 选项 | 建议 |
| --- | --- | --- |
| **对外暴露方式** | A. 已备案 → 80/443 直连；B. 未备案 → 8443 + Cloudflare；C. 先不暴露 → 只用 `IP:8080` 做演练 | **先 C，再 B/A**。域名和 TLS 放到阶段 5，别在第一天卡在备案上 |
| **代码怎么上服务器** | A. `git clone`（仓库私有，需要 PAT 或部署密钥）；B. 本地 `rsync/scp` 上传 `example/` | 演练用 **B** 最快；要练 CI 再配 A |
| **镜像从哪拉** | Docker Hub 国内可能拉不动 → 配镜像加速 / 用 `docker.m.daocloud.io` 前缀 / 或只拉 `node:24-bookworm-slim`、`postgres:17-alpine`、`redis:8-alpine`、`nginx:1.27-alpine` | 先测 `docker pull hello-world`，拉不动再配 |

> 备案说明：国内服务器 + 未备案域名，运营商会在入口拦 80/443。`.net` 域名本身可以备案（需域名实名 + 服务器接入商提交，约 1–20 个工作日）。**没备案不影响演练**：阶段 0–4 用 IP + 8080 端口就能全部完成。

---

## 1. 阶段 0：只读勘察（5 分钟，不改任何东西）

```bash
# 系统与资源
uname -a && cat /etc/os-release | head -5
nproc && free -h && df -h / && timedatectl
# 已在跑什么、占了哪些端口
ss -lntp
systemctl list-units --type=service --state=running --no-pager | head -30
command -v docker && docker version --format '{{.Server.Version}}' || echo NO_DOCKER
command -v nginx || echo NO_NGINX
# 防火墙 / 云厂商安全组（安全组只能在控制台看）
sudo ufw status verbose 2>/dev/null || echo NO_UFW
```

**把输出贴给我**，我判断：能不能装 Docker、6G 该怎么分给 PG/Node、有没有端口冲突、Ubuntu 26 的 Docker 源是否可用。

**预期**：空机器通常只有 sshd + systemd 相关服务；80/443 空闲。

---

## 2. 阶段 1：主机加固（15 分钟）

```bash
# 2.1 建普通用户（别用 root 跑应用）
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh && sudo chmod 700 /home/deploy/.ssh

# 2.2 把你 Mac 上的公钥装上（在 Mac 上执行）
#   cat ~/.ssh/id_ed25519.pub | ssh root@你的IP "cat >> /home/deploy/.ssh/authorized_keys"
sudo chown -R deploy:deploy /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys

# 2.3 SSH 加固（确认密钥能登录后再做！先开一个新终端验证，别把自己锁外面）
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload ssh

# 2.4 时区、基础包、swap（6G 内存给 2G swap 兜底）
sudo timedatectl set-timezone Asia/Shanghai
sudo apt update && sudo apt install -y curl ca-certificates gnupg git ufw fail2ban htop jq unzip
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 2.5 防火墙（Ubuntu 26 用 ufw 即可；先只开 SSH，等应用起来再加端口）
sudo ufw default deny incoming && sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw --force enable && sudo ufw status verbose

# 2.6 fail2ban 防爆破
sudo systemctl enable --now fail2ban && sudo fail2ban-client status sshd
```

**安全组**：在云厂商控制台放行 22（你的 IP）、8080（阶段 2）、80/443 或 8443（阶段 5）。

**验收**：新开终端 `ssh deploy@IP` 能进；`sudo ufw status` 显示 active；`free -h` 有 2G swap。

---

## 3. 阶段 2：装 Docker + 目录规划（10 分钟）

```bash
# 3.1 装 Docker（Ubuntu 26 的 docker-ce 源可能还没跟上，两个方案）
# 方案 A：官方源（若 apt-cache policy 为空则换 B）
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt-cache policy docker-ce | head -5
# ↑ 如果显示 "Candidate: (none)"，改用方案 B
# 方案 B：Ubuntu 自带
# sudo apt install -y docker.io docker-compose-v2

# 3.2 官方脚本兜底（最省事，自动识别发行版）
# curl -fsSL https://get.docker.com | sudo sh

sudo systemctl enable --now docker
sudo usermod -aG docker deploy     # 重新登录生效
docker run --rm hello-world

# 3.3 Docker 日志轮转（不配的话 /var/lib/docker 迟早把 100G 吃满）
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "3" },
  "live-restore": true
}
EOF
sudo systemctl restart docker && docker info --format '{{.LoggingDriver}}'

# 3.4 目录规划（应用与数据分离，备份好做）
sudo mkdir -p /srv/meeting-booking/{app,backup,nginx,archive}
sudo chown -R deploy:deploy /srv/meeting-booking
```

**验收**：`docker compose version` 有输出；`docker info` 的 LoggingDriver 是 `json-file`；`docker stats` 能耗尽 CPU（说明 cgroup 正常）。

---

## 4. 阶段 3：上传代码 + 写 Dockerfile（20 分钟）

```bash
# 4.1 上传（在 Mac 上执行；仓库私有就别用 git clone）
rsync -avz --exclude node_modules --exclude .env \
  /Users/dailei/code/self/notes/docs/nest/example/ deploy@你的IP:/srv/meeting-booking/app/

# 4.2 进服务器
ssh deploy@你的IP && cd /srv/meeting-booking/app
```

**Dockerfile**（`example/` 现在没有，这是补上的；注意 Node 用 24 slim，不是书里的 22-alpine）：

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
# Prisma 8：先按 contract 生成运行时产物，再编译
RUN pnpm db:emit && pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=1024 \
    PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma ./prisma
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
```

`.dockerignore`（必须有，否则把 `node_modules`、`.env` 全塞进构建上下文）：

```
node_modules
dist
.env
.env.*
!.env.example
*.log
.git
```

**构建**：

```bash
docker build -t meeting-booking-api:1.0.0 .
docker images | grep meeting-booking
```

**失败怎么办**：
- `pnpm install` 卡住 → `.npmrc` 里加 `registry=https://registry.npmmirror.com`
- `pnpm db:emit` 报版本不匹配 → 书里 rc.29 + rc.21 是配对的；若你升级其中一个，必须成对升
- `corepack enable` 报错 → `npm i -g pnpm@11`

---

## 5. 阶段 4：Compose 起 PG17 + Redis 8 + API（20 分钟）

**先修 P0-4**：`example/.env.example` 还是 MySQL，直接复制会启动失败。

```bash
# 5.1 生成生产用 .env（密钥用 openssl 现生成，别用示例值）
cat > .env <<EOF
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://你的域名,http://你的IP:8080
DATABASE_URL=postgres://meeting:$(openssl rand -hex 16)@postgres:5432/meeting_booking
DIRECT_URL=postgres://meeting:SAME_PASSWORD@postgres:5432/meeting_booking
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=$(openssl rand -base64 48)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_EXPIRES_IN=7d
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
EOF
chmod 600 .env
```

> ⚠️ `DATABASE_URL` 和 `DIRECT_URL` 的密码要一致（上面 `SAME_PASSWORD` 要替换成同一个值）。`env.validation.ts` 只认 `postgres://`/`postgresql://` 开头，且 `DB_*` 系列它根本不读（TypeORM 残留，删掉）。

**`docker-compose.prod.yml`**：

```yaml
name: meeting-booking

services:
  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: meeting_booking
      POSTGRES_USER: meeting
      POSTGRES_PASSWORD: ${PG_PASSWORD:?set PG_PASSWORD}
      TZ: Asia/Shanghai
    command:
      - postgres
      - -c
      - shared_buffers=1GB
      - -c
      - effective_cache_size=3GB
      - -c
      - work_mem=16MB
      - -c
      - maintenance_work_mem=256MB
      - -c
      - max_connections=100
      - -c
      - log_min_duration_statement=200
    volumes:
      - pgdata:/var/lib/postgresql/data
      - /srv/meeting-booking/archive:/archive
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U meeting -d meeting_booking']
      interval: 5s
      timeout: 5s
      retries: 20

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: ['redis-server', '--appendonly', 'yes', '--maxmemory', '512mb', '--maxmemory-policy', 'allkeys-lru']
    volumes:
      - redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 10

  migrate:
    build: { context: ., target: builder }
    profiles: ['tools']
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
    command: >
      sh -c "pnpm db:init &&
             pnpm db:plan &&
             pnpm db:migrate &&
             pnpm db:seed"

  api:
    build: { context: ., target: runner }
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    ports: ['8080:3000']          # 阶段 5 会改成只让 nginx 访问
    read_only: true
    tmpfs: ['/tmp']
    security_opt: ['no-new-privileges:true']
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 3s
      start_period: 20s
      retries: 3

volumes:
  pgdata:
  redisdata:
```

**启动顺序（关键）**：

```bash
# 5.2 先起基础设施
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml ps        # 两个都 healthy 再往下

# 5.3 跑迁移 + seed（一次性容器）
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate

# 5.4 起 API
docker compose -f docker-compose.prod.yml up -d api
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

**验收（照抄，输出应逐条对得上）**：

```bash
curl -s http://127.0.0.1:8080/api/health | jq
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/rooms          # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/bookings       # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'content-type: application/json' -d '{}'                                    # 400（DTO 校验）
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/docs           # 200 或 404（生产应关闭）
# 限流：连打 120 次看 429
for i in $(seq 1 120); do curl -s -o /dev/null -w '%{http_code} ' http://127.0.0.1:8080/api/rooms; done | tr ' ' '\n' | sort | uniq -c
```

**这一步同时验证了审计里的 P0-4**（`.env` 换成 PG 后能启动）和书里 050 章声称的健康检查——你会发现 `health` 只报 uptime，不查 DB（审计已指出）。

---

## 6. 阶段 5：Nginx + 域名 + TLS（30–60 分钟）

> 未备案就走 B 方案，别硬等备案。

### A. 已备案（80/443 可用）

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
# 先放 http 配置，再签证书
sudo tee /etc/nginx/sites-available/meeting-booking >/dev/null <<'EOF'
server {
  listen 80;
  server_name nest.你的域名;
  client_max_body_size 20m;
  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
  }
}
EOF
sudo ln -sf /etc/nginx/sites-available/meeting-booking /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d nest.你的域名 --redirect --agree-tos -m 你的邮箱
curl -sI https://nest.你的域名/api/health | head -3
```

### B. 未备案（Cloudflare 代理 + 8443）

1. Cloudflare 加站点，DNS 加 `nest` A 记录指向你的 IP，**开启橙色云朵（Proxied）**。
2. SSL/TLS 模式选 **Full (strict)**；源站证书用 Cloudflare 的 **Origin Certificate**（15 年）。
3. 源站 Nginx 监听 **8443**（Cloudflare 支持的 HTTPS 端口：443/2053/2083/2087/2096/8443）。
4. `docker-compose.prod.yml` 的 `api` 端口改成 `127.0.0.1:8080:3000`，Nginx 用 `proxy_pass http://127.0.0.1:8080`。
5. Cloudflare 加密模式 + 源站 8443，浏览器访问 `https://nest.你的域名`。

### 可选：证书自动续期（DNS-01，不需要 80 端口）

```bash
sudo apt install -y certbot python3-certbot-dns-cloudflare
# /root/.secrets/cloudflare.ini: dns_cloudflare_api_token = 你的token
sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d nest.你的域名 -m 你的邮箱 --agree-tos -n
```

**验收**：`curl -sI https://nest.你的域名/api/health` 返回 200；`curl -s http://你的IP:8080` 从外网不通（只留 443/8443）。

---

## 7. 阶段 6：备份与恢复演练（企业就绪第 5 条，30 分钟）

```bash
# 7.1 备份（custom 格式，可并行、可选择性恢复）
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U meeting -d meeting_booking -Fc > /srv/meeting-booking/backup/base-$(date +%F-%H%M).dump

# 7.2 记录时间点：往库里写一条标记数据
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U meeting -d meeting_booking -c "INSERT INTO \"Booking\" (id, \"userId\", \"roomId\", \"startAt\", \"endAt\", \"createdAt\") VALUES (gen_random_uuid(), 'x', 'y', now(), now()+interval '1h', now()) ON CONFLICT DO NOTHING;" || true

# 7.3 恢复到新库（不覆盖生产）
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U meeting -d postgres -c 'DROP DATABASE IF EXISTS meeting_booking_restore;'
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U meeting -d postgres -c 'CREATE DATABASE meeting_booking_restore;'
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U meeting -d meeting_booking_restore --no-owner < /srv/meeting-booking/backup/base-*.dump

# 7.4 对比两库行数（应完全一致）
for db in meeting_booking meeting_booking_restore; do
  echo "== $db"
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U meeting -d $db -Atc "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY 1;"
done
```

**记录 RTO**：从「决定恢复」到「新库可用」用了多久；**RPO**：最后一次 dump 到故障点丢了多少数据（=`备份间隔`）。

**定时备份（cron，每天 3 点，保留 7 天）**：

```bash
cat > /srv/meeting-booking/backup.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd /srv/meeting-booking
STAMP=$(date +%F-%H%M)
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U meeting -d meeting_booking -Fc > backup/base-$STAMP.dump
find backup -name 'base-*.dump' -mtime +7 -delete
EOF
chmod +x /srv/meeting-booking/backup.sh
( crontab -l 2>/dev/null; echo '0 3 * * * /srv/meeting-booking/backup.sh >> /srv/meeting-booking/backup/cron.log 2>&1' ) | crontab -
```

**加分项（PITR）**：在 compose 里给 postgres 加
`- -c archive_mode=on -c archive_command=test ! -f /archive/%f && cp %p /archive/%f`，
做一次 `pg_basebackup`，然后恢复到 `recovery_target_time`。这一项能写进简历。

---

## 8. 阶段 7：压测与容量结论（第 6 条，30 分钟）

> **别在 VPS 上跑 k6 压自己**（CPU 打架，数据无意义）。在本机跑：

```bash
# Mac 上
brew install k6
```

`load-test.js`：

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m',  target: 100 },
    { duration: '1m',  target: 300 },
    { duration: '30s', target: 0 },
  ],
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<800'] },
};
const BASE = 'https://nest.你的域名/api';
export default function () {
  const list = http.get(`${BASE}/rooms`);
  check(list, { 'rooms 200': (r) => r.status === 200 });
  sleep(0.2);
}
```

```bash
k6 run load-test.js
# 压测期间另开终端观察瓶颈
ssh deploy@IP "docker stats --no-stream; ss -s; docker compose -f /srv/meeting-booking/docker-compose.prod.yml exec -T postgres psql -U meeting -d meeting_booking -c \"SELECT state, count(*) FROM pg_stat_activity GROUP BY 1 ORDER BY 2 DESC;\""
```

**产出结论（写进你的笔记/简历）**：
- 300 并发下 P95 = ?ms、错误率 ?%、CPU ?%、PG 连接数 ?/100。
- 先到瓶颈的是什么：Node CPU / PG 连接 / 网络 / Nginx。
- 扩容动作：加 Node 副本 + Nginx upstream、PG 连接池（PgBouncer）、加 Redis 缓存。
- 这正好补上书里 135/264 章缺的「容量规划」实测。

---

## 9. 阶段 8：CI + 安全基线（第 7、8 条，2–3 小时）

### 8.1 GitHub Actions（仓库已有 `git@github.com:flylea/notes.git`）

`.github/workflows/example-ci.yml`：

```yaml
name: example-ci
on:
  push: { paths: ['docs/nest/example/**'] }
  pull_request: { paths: ['docs/nest/example/**'] }
jobs:
  build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: docs/nest/example } }
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
        with: { version: 11 }
      - uses: actions/setup-node@v5
        with: { node-version: 24, cache: pnpm, cache-dependency-path: docs/nest/example/pnpm-lock.yaml }
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:emit
      - run: pnpm typecheck
      - run: pnpm build
```

> 注意路径：工作流在仓库根，`example/` 在 `docs/nest/example/`（按你仓库实际结构调整）。
> 想让它真正「拦住坏代码」，下一步是加测试（现在 `example/` 里 **0 个测试文件**，CI 只能拦类型和构建错误）。

### 8.2 安全基线

```bash
# 镜像漏洞扫描
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image meeting-booking-api:1.0.0

# 依赖审计
cd /srv/meeting-booking/app && pnpm audit --prod || true

# 确认密钥没进镜像
docker run --rm --entrypoint sh meeting-booking-api:1.0.0 -c 'ls -a /app | grep -E "^\.env" || echo OK_NO_ENV'

# 容器内不是 root
docker compose -f docker-compose.prod.yml exec api id

# ufw 收口：只留 22 + 443(或 8443)
sudo ufw delete allow 8080/tcp 2>/dev/null || true
sudo ufw allow 443/tcp    # 或 8443/tcp
sudo ufw status verbose
```

**对照 OWASP API Top 10 自查**（书里 242 章规划了但没写，这里先做）：
- API1 越权：用一个用户的 token 访问别人的 booking（用 `users` 接口造两个账号试试）
- API2 认证：`/api/docs` 生产是否暴露、JWT 过期/刷新是否可用
- API4 资源消耗：上传接口是否有大小/频率限制（`client_max_body_size` + throttler）
- API5 功能级授权：无 `RolesGuard` 的接口是否裸奔
- API8 配置：`NODE_ENV=production` 时错误栈是否外泄、Helmet 头是否齐全

---

## 10. 阶段 9：把实测回填成章节（这才是最终目的）

每完成一个阶段，把「命令 + 真实输出 + 踩坑」记下来，直接能补掉书里这些「未实测」：

| 你的实测 | 对应书里章节 |
| --- | --- |
| Dockerfile 多阶段构建、镜像大小 | 030/031/032（顺便把 `node:22-alpine` 换成 24/26） |
| compose 编排、网络、健康检查 | 061/062/063 |
| Nginx 反代 + TLS | 065/066/067 |
| 迁移与 seed 全链路 | 048/050 |
| 备份恢复 + PITR | 041 延伸（新的「数据可靠性」章） |
| k6 压测与容量 | 135/264 |
| CI + 镜像扫描 + OWASP | 226/242 |
| journald/ss/docker stats 排查 | 新的「Linux 最小可用」章 |

---

## 11. 一页速查：常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `环境变量校验失败: DATABASE_URL 必须是 postgres://...` | `.env` 还是 MySQL | 按阶段 4 改；删掉 `DB_*` |
| `pnpm db:emit` 报 contract 版本错 | prisma 与 orm-postgres rc 版本不成对 | 成对用 rc.29/rc.21 或 rc.34/rc.24 |
| 镜像 build 卡在 install | 国内拉 npm 慢 | `.npmrc` 加 `registry=https://registry.npmmirror.com` |
| `docker pull` 超时 | Docker Hub 被限速 | 配镜像加速或用 `docker.m.daocloud.io/library/xxx` |
| PG 启动 `memory` 类告警 | 6G 给 PG 太大 | `shared_buffers=1GB` 足够，别照抄 4G |
| 容器起来但 health 失败 | 应用监听 127.0.0.1 而非 0.0.0.0 | 检查 `main.ts` 的 `app.listen(port, '0.0.0.0')` |
| 80/443 不通、域名打不开 | 未备案被拦 | 走 Cloudflare + 8443 |
| 磁盘涨满 | Docker 日志/镜像没清 | `docker system df` + `docker image prune -af` + 日志轮转（阶段 3.3） |

---

## 12. 时间预算

| 阶段 | 内容 | 时间 |
| --- | --- | --- |
| 0 | 只读勘察 | 5 分钟 |
| 1 | 主机加固 | 15 分钟 |
| 2 | Docker + 目录 | 10 分钟 |
| 3 | 上传 + Dockerfile + build | 20 分钟 |
| 4 | Compose + 迁移 + 验收 | 20–40 分钟 |
| 5 | Nginx + TLS | 30–60 分钟 |
| 6 | 备份恢复 | 30 分钟 |
| 7 | 压测容量 | 30 分钟 |
| 8 | CI + 安全 | 2–3 小时 |
| **合计** | **第一阶段（0–4）** | **约 1.5 小时** |
| | **全流程** | **约 1–2 天** |

先做 0–4，把「能跑起来」变成「跑在真服务器上」；再决定要不要一口气做到 8。

---

## 附录 A：本机实测勘察（2026-11-21）与计划调整

**实测事实**

| 项 | 实测值 | 对计划的影响 |
| --- | --- | --- |
| 系统 | Ubuntu 26.04.1 LTS（codename **resolute**），kernel 7.0.0-31-generic | 阶段 2 的「装 Docker」已不需要 |
| 资源 | 6 vCPU / 5.8 GiB / 96G（93G 可用）/ 已有 3G swap | PG 用 1G shared_buffers 足够，无需再加 swap |
| Docker | **已装：Engine 29.9.3、containerd 2.4.2、runc 1.5.2**，`docker.service` running | 跳过安装；改为「验证 compose 插件 + 配 daemon.json 日志轮转」 |
| 面板 | **1Panel 已装**（`1panel-core`/`1panel-agent` running，监听 36852） | 机器不是裸机：已有站点/应用/防火墙可能被面板管着，**先查再用** |
| SSH | **端口 51733**（不是 22），root 可登录 | ufw 里不能只放行 OpenSSH（那是 22），要显式放行 51733 |
| 防火墙 | **无 ufw**（`NO_UFW`） | 不要盲装 ufw（可能与 1Panel/nftables 打架、把自己锁外面）；先用 `nft list ruleset` / 面板防火墙看现状 |
| 时区 | UTC（NTP 已同步） | 建议宿主机保持 UTC（更好的实践），容器内用 `TZ=Asia/Shanghai` 与书一致 |
| 系统精简 | 提示 `unminimize` 可还原被裁掉的包 | 先确认 `curl/git/jq/rsync` 是否存在，缺了就 `apt install` |

**调整后的执行顺序**

1. **阶段 0.5（新增，只读）**：查已有容器/卷/网络、80/443/8080/5432/6379 占用、nftables 规则、1Panel 已装应用、必备命令是否存在。
2. 阶段 1 改法：**不装 ufw**，改用「云厂商安全组 + 1Panel 防火墙」；SSH 端口写 **51733**；确认密钥登录后再禁密码。
3. 阶段 2 改法：跳过安装，只做 `docker compose version` 验证 + `daemon.json` 日志轮转 + `docker info` 检查。
4. 若 1Panel 里已有站点/容器：新应用一律用独立 compose project（`name: meeting-booking`）和 `127.0.0.1` 绑定端口，避免抢 80/443/5432/6379。

---

## 附录 B：命令行优先路径（阶段 0.5–2 修正版）

> 用户要求：全部走命令行、1Panel 保留但不去点它、备案延后。以下每步都写「查什么 / 为什么 / 怎么判读」。
>
> **口径**：这本手册分两层——「方法论」进书稿（怎么查、怎么判读、踩什么坑，与具体机器无关）；「本机事实」只影响我们自己的操作（端口号、1Panel 占位），不写进章节正文。所以 0.5 的输出不必现在拿，写到 `103-会议室预订系统-项目部署和整体验收.md` 那天再跑一次即可。

### 阶段 0.5 · 只读体检（**非前置阻塞**：等真要执行部署、或要写部署章节那天再跑，10 分钟）

```bash
docker compose version
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker volume ls; docker network ls
ss -lntp | grep -E ':(80|443|8080|8443|3000|5432|6379)\b' || echo PORTS_FREE
nft list ruleset 2>/dev/null | head -60 || iptables -S 2>/dev/null | head -40
1pctl version 2>/dev/null; ls /opt/1panel/apps 2>/dev/null; ls /opt/1panel/www/sites 2>/dev/null
command -v curl git jq rsync make htop || true
systemctl list-units --type=service | grep -Ei 'nginx|postgres|redis|mysql' || echo NO_DB_SERVICES
df -i /
```

判读标准：
- `docker ps` 若已有容器 → 新应用必须换 compose project 名 + 端口，且尽量 `127.0.0.1:` 绑定。
- 80/443 被占 → 说明 1Panel 自带的 OpenResty/Nginx 已在前面，我们的 Nginx 换 8080/8443（或直接复用 1Panel 的反代）。
- `nft list ruleset` 有 `DOCKER-USER` / 面板规则 → 防火墙由 1Panel 管，**不要装 ufw**；放行端口走面板防火墙或云安全组。
- 缺 `curl/jq/git` → `apt update && apt install -y curl git jq`（被 minimized 裁掉了）。

### 阶段 1 · 主机加固（修正：不用 ufw，SSH 51733）

```bash
adduser --gecos "" deploy && usermod -aG sudo,docker deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
# 把 Mac 的公钥贴进 authorized_keys（在 Mac 上：cat ~/.ssh/id_ed25519.pub）
vim /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
# 验证（先新开一个终端！）：ssh -p 51733 deploy@<IP>
grep -nE '^(#)?(Port|PermitRootLogin|PasswordAuthentication|PubkeyAuthentication)' /etc/ssh/sshd_config
```

为什么这样改：SSH 在 51733，`ufw allow OpenSSH`（默认 22）完全无效，所以要么显式放行 51733、要么根本不用 ufw；`PermitRootLogin no` 和 `PasswordAuthentication no` 必须在**密钥登录验证成功之后**再改，顺序错了就把自己锁在外面。

### 阶段 2 · Docker 验证（已装，跳过安装）

```bash
docker compose version            # 需要 v2.x 插件
docker info --format '{{json .}}' | jq '{ServerVersion,LoggingDriver,DockerRootDir,CgroupVersion}'
cat /etc/docker/daemon.json 2>/dev/null || echo NO_DAEMON_JSON
```

要加的最小 daemon.json（日志轮转，防止容器日志吃满盘）：

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" },
  "live-restore": true
}
```

`systemctl reload docker` 不生效会丢容器，改完用 `systemctl restart docker` 前先确认没有正在跑的业务容器。

### 关键差异（为什么不能照搬网上教程）
1. **不能装 ufw**：这台机器上防火墙很可能由 1Panel 的 nftables 链接管（`NO_UFW` 只是没装 ufw，不代表没防火墙）。装 ufw 会生成第二套规则，最坏情况是把自己 SSH 锁掉。放行端口优先走云安全组；其次用面板防火墙。
2. **SSH 不是 22**：所有 `ufw allow OpenSSH`、`fail2ban` 默认 jail、云厂商「一键放行 22」的教程全部不适用。先确认 51733 能连，再动认证方式。
3. **Docker 归属 1Panel**：1Panel 的应用商店用 `docker run`/compose 装东西，`docker ps` 里可能已有它的容器。新项目用独立 compose project 才不会互相干扰。

### 与书的差异要自己意识到
书里 Docker 章节基于 Docker 28，本机是 **29.9.3**；`--no-cache-filter`、BuildKit 默认、`docker compose` v2 子命令这些在 29 上依然成立，但「版本号」本身已经过时——这正是审计报告里「时效 5.5/10」的那一项。


