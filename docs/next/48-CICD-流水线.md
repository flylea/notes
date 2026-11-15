# 第 48 章 CI/CD 流水线

这一章讲 teamstack 的持续集成与持续部署：从推分支到生产上线，中间每一步由谁执行、失败时停在哪、怎么回滚。

流水线要解决的问题是发布顺序。手工发布时，构建、迁移、重启、验证由人按记忆执行，漏一步就出现“代码上了、表结构没上”这类故障。流水线把这些步骤固定成有依赖的任务，任何一步失败都停住。

涉及的组件有四个：GitHub Actions 负责调度，GHCR 存放镜像，VPS 上的 compose 负责运行，Supabase 提供数据库。迁移脚本放在仓库的 `supabase/migrations/`，由流水线单独执行。

版本基线：GitHub Actions、Docker 27、pnpm 10、Node.js 22。文中额度与行为以 GitHub 官方文档为准，2026 年 11 月核对。

## 48.1 手工发布的失败模式

手工发布通常是这样：SSH 上服务器，`git pull`，`pnpm build`，`pm2 restart` 或 `docker compose up -d`，迁移看心情跑。四个动作之间没有依赖关系，任何一个忘了都不会报错。

典型结果是代码先上线、迁移没跑。页面报列不存在，接口 500。

```text
QueryFailedError: column "slug" does not exist
```

更麻烦的是两个人同时发布。A 拉代码、构建到一半，B 也拉了同一份，先重启了容器；A 重启时用的镜像其实是旧的。谁最后重启谁生效，中间状态没人知道。

手工流程里的“验证”也不可靠。用浏览器点两下，看到首页正常就认为发布成功，实际上出问题的是某个需要登录才进得去的页面。

```bash
git pull
docker compose build
docker compose up -d
```

跳过迁移是一种常见的“临时处理”。当时页面能开，是因为旧代码还没用到新列；下一次发布就会炸。

```bash
# VPS 上，故意跳过迁移
docker compose pull
docker compose up -d --no-deps app
curl -sS -o /dev/null -w '%{http_code}\n' https://teamstack.example.com
```

还有一种错法是“只改服务器不改仓库”。有人在 VPS 上直接编辑文件、重启容器，线上恢复了，仓库里没有这段改动。下一次发布把它覆盖掉，故障重演。

第四种是“发布到一半”。构建完成、容器重启、迁移没跑，或者迁移跑了、容器还是旧的。这种半成品状态最难查，因为它一半旧一半新，状态说不清。

第三种是环境不一致。本地 Node 22、VPS 上 Node 20，本地构建通过、镜像启动后原生模块报 ABI 不匹配。版本要写在三个地方并保持一致：`package.json` 的 `engines`、Dockerfile 的基础镜像、CI 的 setup-node。

流水线的价值就在这里：把顺序写成依赖，把验证写成命令，把回滚写成脚本。人只负责触发和看结果。

## 48.2 流水线的形状

teamstack 的流水线分成四段：检查、构建、迁移、部署。检查与构建可以并行，迁移必须在构建之后，部署等前两者都成功。

```text
推分支/开 PR
   │
   ├─ check: 安装 → 类型检查 → lint → 单测 → 构建
   │
合入 main
   │
   ├─ build:      构建镜像 → 推 GHCR（tag = commit sha）
   ├─ migrate:    对生产库执行 supabase/migrations（独立 job）
   └─ deploy:     SSH 到 VPS → 拉镜像 → 起容器 → 冒烟 → 失败自动回滚
```

依赖关系写成图更清楚。`deploy` 的 `needs` 同时包含 `build` 和 `migrate`，任何一个失败，部署都不会开始。

```text
build ──┐
        ├─→ deploy
migrate ┘
```

四段各自的职责与失败影响如下。

| 阶段 | 主要动作 | 失败影响 |
| --- | --- | --- |
| 检查 | 安装依赖、类型检查、lint、测试 | 不进构建，不产生镜像 |
| 构建 | 构建镜像并推送到 GHCR | 没有新镜像，旧版本继续服务 |
| 迁移 | 连接生产库执行迁移 | 部署停住，镜像留在仓库但不生效 |
| 部署 | 拉镜像、重启、冒烟 | 自动回滚到上一个镜像 |

四段分开还有一个隐性收益：日志边界清楚。构建失败看 build 日志，迁移失败看 migrate 日志，不用在几百行混合输出里找。

检查段要跑满四项：类型检查、lint、单元测试、构建。少跑一项就等于把问题留给生产；构建尤其不能省，`next build` 会做静态分析和预渲染，很多错误只在这一步暴露。

顺序里有两个不能调换的地方。迁移必须在部署之前，因为新代码依赖新结构；部署必须在迁移成功之后，否则新代码跑在旧结构上。

## 48.3 仓库侧要配的四样东西

分支保护要开四项：禁止直推、要求 PR、要求检查通过、要求至少一个批准。`strict` 打开后，分支落后于 `main` 时必须先更新再合并，避免“合并前通过、合并后失败”。

第一样是分支保护。`main` 只接受 PR 合并，必须通过检查，必须有一个人批准。管理员也不允许直推。

第二样是 Environment。在仓库设置里建一个 `production` 环境，把 VPS 的 SSH 密钥与主机地址放在这个环境里。这样只有引用该环境的 job 才能读到。

第三样是 secrets。需要七项：`VPS_HOST`、`VPS_USER`、`VPS_SSH_KEY`、`SUPABASE_DIRECT_URL`、`GHCR_OWNER`，以及两个公开变量 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。公开变量放 Variables，不放 Secrets，因为它们会被内联进浏览器产物。

Environment 还可以加人工审批。生产部署前要求一个人点批准，适合发布频率低、影响面大的项目；teamstack 每天发布，审批去掉，只保留环境保护。

第四样是 GHCR 的写权限。workflow 里声明 `permissions: packages: write`，用内置的 `GITHUB_TOKEN` 登录，不需要额外的 PAT。

secrets 要定期轮换。SSH 密钥一年一换，数据库密码在人员变动时换；轮换流程本身也要写进文档，避免只有一个人知道怎么换。

生产目录只放三个文件：`compose.yaml`、`.env.production`、`scripts/deploy.sh`。源码不放在 VPS 上，镜像从 GHCR 拉；这样服务器上不存在“改了一半的代码”。

## 48.4 完整的 workflow

整个流水线写在一个文件里。四段用 job 分开，`build` 与 `migrate` 并行，`deploy` 等两者。

```yaml
# .github/workflows/deploy.yml
name: deploy

on:
  push:
    branches: [main]
  pull_request:

# 同一分支同时只跑一个；PR 的新提交可以取消旧的
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read
  packages: write # 推 GHCR 需要

env:
  NODE_VERSION: "22"
  PNPM_VERSION: "9.15.4"
  IMAGE: ghcr.io/${{ vars.GHCR_OWNER }}/teamstack

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test -- --run

      # 构建也放在 check 里：PR 阶段就能发现构建错误，不用等合并
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
          NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: ${{ vars.SERVER_ACTIONS_KEY }}

  build:
    needs: check
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          # sha 用于回滚；latest 只作参考，部署永远用 sha
          tags: |
            ${{ env.IMAGE }}:${{ github.sha }}
            ${{ env.IMAGE }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NEXT_PUBLIC_SUPABASE_URL=${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${{ vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
            NEXT_PUBLIC_APP_URL=https://teamstack.example.com

  migrate:
    needs: check
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      # 迁移只需要 pg，装生产依赖即可
      - run: pnpm install --frozen-lockfile --prod

      - name: run migrations
        run: node scripts/migrate.mjs
        env:
          DIRECT_URL: ${{ secrets.SUPABASE_DIRECT_URL }}
          MIGRATIONS_DIR: supabase/migrations

  deploy:
    needs: [build, migrate]
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: setup ssh
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.VPS_HOST }}" >> ~/.ssh/known_hosts

      - name: deploy
        run: |
          ssh "${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}" \
            "cd /srv/teamstack && GHCR_OWNER=${{ vars.GHCR_OWNER }} IMAGE_TAG=${{ github.sha }} ./scripts/deploy.sh"

      - name: verify from outside
        run: |
          for i in 1 2 3 4 5; do
            if curl -fsS https://teamstack.example.com/api/health | grep -q '"ok":true'; then
              exit 0
            fi
            sleep 5
          done
          echo "public health check failed"
          exit 1
```

workflow 文件只负责调度，具体动作尽量写进脚本。脚本能在本地跑、能单独调试，出了问题不用重跑整条流水线。

四个 job 的步骤对应清楚。`check` 先 checkout、装 pnpm、装依赖，再依次跑 lint、类型检查、测试。`build` 重复安装动作，登录 GHCR，用 buildx 构建并推送，tag 用提交 sha。`migrate` 只取迁移文件，连生产库执行。`deploy` 通过 SSH 调脚本。

每个 job 都是独立容器，工作目录不共享。`check` 生成的产物不会被 `build` 复用，`build` 推的镜像也不会自动出现在 VPS 上；每一步都要显式传递，传递的载体是镜像 tag 与仓库。

构建期变量通过 build-args 传入。`NEXT_PUBLIC_*` 在构建时被内联进产物，运行期再改不会生效；所以它们必须在构建阶段就确定。

```dockerfile
# Dockerfile 的 builder 阶段
FROM node:22-alpine AS builder
WORKDIR /app

# 构建期变量：NEXT_PUBLIC_* 会被内联进产物
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

COPY . .
RUN pnpm build
```

手动触发用于回滚和补发。`workflow_dispatch` 接受一个 `sha` 输入，不填则用当前分支的最新提交。

```yaml
# .github/workflows/deploy.yml 的触发部分
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
    inputs:
      sha:
        description: "要部署的 commit sha（留空则用当前 main）"
        required: false
```

checkout 要拿到指定的 sha。默认的 checkout 只取触发分支的 HEAD，回滚到旧提交时需要显式指定。

```yaml
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.sha || github.sha }}
```

## 48.5 迁移为什么必须单独一个 job

迁移和部署放在同一个 job 里，会出现“迁移成功、部署失败”之后重跑的问题：迁移已经执行过，再跑一次要么报错，要么重复执行不幂等的语句。

迁移脚本必须幂等或可跳过。执行前查版本表，已经执行过的文件跳过；文件一旦推送就不再修改，要改就加新文件，时间戳前缀保证顺序。

单独一个 job 有三个好处。失败时能单独重跑，不影响已构建的镜像；日志独立，排查快；可以只对 `main` 分支执行，PR 上不碰生产库。

迁移连接必须用 5432 的直连，不能用 6543 的连接池。事务模式的连接池会把同一条迁移的语句分到不同连接上，`BEGIN` 与 `COMMIT` 不在一个会话，迁移脚本里的 advisory lock 也会失效。

迁移之前先备份。部署流水线可以在迁移 job 开头跑一次 `pg_dump`，备份失败就停住；这份备份是当天最近的还原点，比等云端备份快。

迁移失败时不要立刻重跑。先看是哪条语句失败：锁超时要查残留会话，语法错误要改脚本，权限不足要补 grant。盲目重跑可能把一半执行过的迁移再执行一遍。

执行方式有两种。用 `psql -f` 逐个文件执行，适合迁移里有 `CONCURRENTLY` 这类不能在事务里跑的语句；用迁移工具的 `up` 命令，适合需要版本表与回滚记录的场景。teamstack 用前者，版本表自己维护一张。

迁移结束后要验证。查一次 `schema_migrations` 的最新版本，与仓库里最新文件名比对；不一致说明有文件没执行，部署要停。

迁移 job 需要数据库凭据，但不需要 checkout 之外的任何东西。把 `supabase/migrations` 拉下来，用 `psql` 逐个执行，记录已执行的版本。

```yaml
# 迁移 job 的数据库服务（本地演练时用）
services:
  app:
    image: ghcr.io/${GHCR_OWNER}/teamstack:${IMAGE_TAG:?IMAGE_TAG is required}
```

迁移失败必须让部署停住。`needs: [build, migrate]` 已经保证了这一点，但还要注意“迁移 job 被跳过”。跳过与成功在 `needs` 里都算通过，所以不要用 `if` 条件跳过迁移 job，改用独立的环境与手动批准。

## 48.6 部署脚本、冒烟与自动回滚

部署 job 用 SSH 执行远程命令。密钥用 ed25519，私钥存 Environment secret，公钥放 VPS 的 `authorized_keys`；连接串里加 `-o StrictHostKeyChecking=accept-new`，首次连接不阻塞。

部署在 VPS 上执行，由 workflow 通过 SSH 调用。脚本做四件事：记录当前镜像、拉新镜像、启动、冒烟验证。

```sh
# /srv/teamstack/scripts/deploy.sh
#!/bin/sh
set -eu

cd /srv/teamstack

PREV="$(cat .current-image 2>/dev/null || true)"

echo "[deploy] target image: ${IMAGE_TAG}"
echo "[deploy] previous image: ${PREV:-none}"

# 先拉镜像，拉失败不动现有容器
docker compose pull app

# --wait 会等 HEALTHCHECK 通过；超时则命令失败
docker compose up -d --wait --wait-timeout 180 app

# 冒烟：走公网域名，顺便验证反代与证书
ok=0
for i in 1 2 3 4 5; do
  if curl -fsS --max-time 5 https://teamstack.example.com/api/health | grep -q '"ok":true'; then
    ok=1
    break
  fi
  echo "[deploy] health check attempt ${i} failed, retrying"
  sleep 5
done

if [ "$ok" -ne 1 ]; then
  echo "[deploy] smoke test failed, rolling back to ${PREV:-none}"
  docker compose logs --tail=100 app || true
  if [ -n "$PREV" ]; then
    IMAGE_TAG="$PREV" docker compose up -d --wait --wait-timeout 180 app
  fi
  exit 1
fi

echo "$IMAGE_TAG" > .current-image
echo "[deploy] success: ${IMAGE_TAG}"
```

健康检查定义在容器里。`HEALTHCHECK` 打 `/api/health`，该接口查一次数据库；返回非 200 时容器标记为 unhealthy，`--wait` 就会失败。只查进程是否活着的健康检查会漏掉“进程活着但连不上库”。

冒烟要覆盖三类路径：公开页、需要登录的页面、一个写操作。写操作用测试账号，跑完清理；只读冒烟发现不了权限与事务问题。

脚本要能重复执行。上一次部署中断后，直接再跑一遍应当能收敛到目标状态；拉镜像、启容器、冒烟都是幂等的，`docker compose up -d` 本身就满足。

脚本里有两个关键点。启动用 `--wait`，等健康检查通过才算成功，超时默认 180 秒；冒烟走公网域名，顺带验证反代与证书，不只是本地端口。

冒烟失败时用 `.current-image` 回滚。这个文件每次部署前写入当前镜像 tag，回滚就是拿它重新 `up -d`。回滚之后脚本以非零码退出，workflow 显示失败，人工介入。

## 48.7 构建期与运行期：一条分界线

分界线在镜像构建完成那一刻。之前能读到的是 build-args 和环境变量，之后能读到的是容器启动时注入的环境变量。

build-args 会留在镜像历史里。传密钥进去等于把密钥写进镜像，任何人 `docker history` 都能看到；公开变量可以传，密钥一律走运行期环境变量。

`NEXT_PUBLIC_*` 在构建期被替换成字面量，写进 JS 产物。同一份镜像无法通过改环境变量切换 Supabase 项目；要换项目必须重新构建。

服务端密钥只在运行期读取。它们通过 `env_file` 注入容器，不打进镜像，也不出现在 `docker history` 里。

```bash
# 确认镜像里没有密钥
docker history --no-trunc ghcr.io/acme/teamstack:<sha> | grep -i stripe
```

变量改动要留痕。谁改的、改了什么、为什么改，记在发布单里；出了事能追到变更点，不用靠回忆。

VPS 上更新环境变量后要重启容器。`docker compose up -d` 会比对配置哈希，检测到变化时重建容器；只 `restart` 不会重新读 `env_file`。

```bash
# VPS 上
chmod 600 /srv/teamstack/.env.production
chown deploy:deploy /srv/teamstack/.env.production
```

运行期变量的作用域要写清楚。`DATABASE_URL` 只在 app 容器里，caddy 不需要；`TURNSTILE_SECRET` 只在 app 里。变量按需注入，泄一个不影响其他。

密钥轮换要按“先加后删”的顺序。新密钥加入环境变量并重启，确认旧会话仍可用；再删旧密钥。反过来的顺序会让在线用户立刻掉线。

## 48.8 发布节奏、hotfix 与回滚演练

发布窗口要避开业务高峰。团队协作工具的使用高峰在工作日上午，发布放在午休或傍晚；数据库迁移尤其要避开，锁表会卡住在线请求。

常规发布的节奏是：功能分支合并到 `main`，流水线自动跑，合并后十分钟内上线。一天多次发布是正常的，不需要攒版本。

hotfix 走同一条流水线。从 `main` 拉分支，改完提 PR，合并后自动发布；紧急时允许一个人批准，但不允许直推。

```bash
# hotfix
git switch main && git pull --ff-only
git switch -c fix/session-cookie-expiry
# 改代码、加测试
git commit -m "fix: session cookie 过期时间少了 60 秒"
git push -u origin HEAD
```

回滚优先用镜像回退，不用 `git revert`。revert 会产生一次新的构建和部署，慢几分钟，而且中间还要经过迁移；镜像回退是秒级的。

```bash
# 回滚演练：VPS 上
# VPS 上，先记下当前版本
cat /srv/teamstack/.current-image

# 手动部一个两周前的 sha（从 GHCR 的 tag 列表里挑）
cd /srv/teamstack
GHCR_OWNER=acme IMAGE_TAG=<old-sha> ./scripts/deploy.sh

# 验证：外网 200、能登录、关键页面正常
curl -sS https://teamstack.example.com/api/health

# 演练完回到最新版
GHCR_OWNER=acme IMAGE_TAG=<latest-sha> ./scripts/deploy.sh
```

回滚的时间目标要写下来。镜像回退在 30 秒内完成；如果超过两分钟，说明拉镜像慢或健康检查太长，要优化。

回滚演练每季度做一次。挑一个两周前的镜像，启动、冒烟、看日志，确认旧代码能读新结构；演练记录写进运维文档。

回滚不等于撤销迁移。已经执行的迁移不回滚，数据库结构保持新版本；旧代码必须能读写新结构，这是迁移策略要保证的。

## 48.9 失败点与定位

失败点按阶段分，每段的排查入口不同。

| 失败点 | 典型报错 | 排查入口 |
| --- | --- | --- |
| 依赖安装 | `ERR_PNPM_OUTDATED_LOCKFILE` | 本地跑 `pnpm install --frozen-lockfile` |
| 类型检查 | TS 错误码与文件行号 | 本地 `pnpm tsc --noEmit` |
| 镜像构建 | `failed to solve` | 构建日志最后 50 行 |
| 推送镜像 | `denied: permission_denied` | 检查 `packages: write` |
| 迁移 | `advisory lock ... timeout` | 是否有并发迁移 |
| 部署 | `no such image` | GHCR 上是否有该 tag |
| 冒烟 | HTTP 状态码非 200 | VPS 上 `docker compose logs` |

通知要能落到人。发到群里比发邮件有效，邮件容易被归档；通知内容只带链接与结论，细节留给人点进去看。

失败通知走 workflow 的 `if: failure()`。通知里带运行链接、分支、提交 sha，不带日志正文。

```yaml
      - name: notify failure
        if: failure()
        run: |
          curl -sS -X POST "${{ secrets.NOTIFY_WEBHOOK }}" \
            -H 'content-type: application/json' \
            -d '{"text":"teamstack deploy failed: ${{ github.sha }}"}'
```

本地复现 CI 的步骤固定：`rm -rf node_modules`、`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm tsc --noEmit`、`pnpm test --run`、`pnpm build`。能在这六条里复现的，就不用去 CI 上试。

定位顺序是固定的：先看哪个 job 红了，再看该 job 的最后 50 行，最后复现。能在本地复现的，不在 CI 上猜。

## 48.10 缓存、耗时与 Actions 额度

一次完整流水线大约 6–10 分钟：检查 2 分钟、构建 3 分钟、迁移 10 秒、部署 1 分钟、冒烟 30 秒。缓存能把构建压到 2 分钟以内。

耗时的大头通常在依赖安装。pnpm  store 命中时 20 秒，不命中要 2 分钟；把 store 缓存住，收益比缓存构建产物更稳。

缓存两层。依赖层用 `actions/setup-node` 的 `cache: pnpm`；构建层缓存 `.next/cache`，键里带 lockfile 哈希与源码哈希。

```yaml
      - uses: actions/cache@v4
        with:
          path: .next/cache
          key: nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('src/**/*.ts', 'src/**/*.tsx') }}
          restore-keys: |
            nextjs-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}-
```

公开仓库的 Actions 分钟数不限，私有仓库每月 2,000 分钟。按每天发布五次、每次 8 分钟算，一个月约 1,200 分钟，够用；加上 PR 触发的检查，接近上限时要合并提交或减少触发。

并发数也要限制。同一个 PR 连续推三次，取消前两次能省两倍时间；`cancel-in-progress: true` 只对同一分支生效，不会误伤别的分支。

`concurrency` 要配。同一分支同时只跑一个流水线，新提交取消旧运行，能省掉大量无意义构建。

## 48.11 镜像保留与清理

保留策略要覆盖回滚范围。回滚通常只回一两个版本，留 20 个已经足够；留几百个除了占空间，还会让 `docker images` 难以阅读。

GHCR 的存储也计入额度。每次发布产生一个新 tag，不清理的话一年就是上千个镜像。

保留策略按时间：留最近 20 个，或最近 90 天。用官方 action 删除旧版本，配置 `min-versions-to-keep` 防止把正在用的删掉。

```yaml
# .github/workflows/cleanup-images.yml
name: cleanup-images

on:
  schedule:
    - cron: "0 3 * * 0"
  workflow_dispatch:

permissions:
  packages: write

jobs:
  prune:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/delete-package-versions@v5
        with:
          package-name: teamstack
          package-type: container
          min-versions-to-keep: 20
          delete-only-untagged-versions: false
```

清理任务本身也可能失败。权限不足时 action 报 403，Tag 列表为空时报错退出；把失败通知接上，别让磁盘悄悄涨满。

VPS 上的旧镜像也要清。`docker image prune` 只删悬空镜像，带 tag 的要按时间筛。保留最近 10 个，回滚范围足够。

不要在 VPS 上跑 `docker system prune -a`。它会删掉所有未被容器使用的镜像，包括你准备回滚的那个。

流水线跑顺之后，发布变成一件不需要记住步骤的事：合并、等结果、看冒烟。人的注意力可以放到改动本身，操作顺序交给流水线。

## 48.12 边界与失败模式

流水线的失败很少来自单个步骤，多来自步骤之间的顺序与状态。

1. `needs` 写错，迁移先于构建执行。新迁移配旧镜像，schema 领先代码一个版本。检查依赖图，迁移必须同时依赖构建产物与代码版本。
2. 迁移成功，部署失败。数据库已改，线上还是旧代码。此时不能重跑迁移，只能修部署；修不好就按回滚流程退回上一个镜像并评估兼容性。
3. 脚本缺少 `set -e`。中间命令失败，后续命令继续执行，job 显示成功但服务没更新。部署脚本第一行固定写 `set -euo pipefail`。
4. 两个发布同时进行。后触发的覆盖前一个，镜像 tag 与线上实例不一致。用 `concurrency` 分组，同分支只允许一个部署在跑。
5. 回滚只回镜像，不回配置。新版本加了环境变量，旧镜像读不到，启动即失败。环境变量与镜像版本一起纳入发布记录。
6. 构建缓存命中旧产物，页面引用已删除的 action ID。清掉 `.next/cache` 重跑，或让缓存键包含提交 sha。

## 48.13 检查点

1. 推一个分支并开 PR，检查 job 自动运行。判据：Actions 页面出现该分支的运行记录。
2. 合并到 `main`，构建与迁移都成功后部署开始。判据：`deploy` job 的日志里出现 `deploy.sh` 输出。
3. 故意让一个迁移失败（改错 SQL 后推分支到测试环境），确认部署没有开始。判据：`deploy` job 状态是 skipped 或不存在。
4. 在 VPS 上执行 `docker compose ps`，app 与 caddy 都是 `Up (healthy)`。判据：健康状态而非仅运行。
5. `curl -sSI https://teamstack.example.com/api/health` 返回 200。判据：反代、证书、应用三层都通。
6. 回滚一次：`IMAGE_TAG=<旧 sha> docker compose up -d --no-deps app`，再访问首页。判据：返回旧版本页面，无 502。

六条检查覆盖四段：PR 触发、合并部署、迁移失败停住、容器健康、公网可达、回滚可用。任何一条不通过，都说明流水线还缺东西。

检查点要连续三天手动过一遍。流水线的问题通常在头几天暴露，比如缓存键写错导致每次全量安装、并发配置没生效导致重复构建。

## 48.14 常见错误

**1. `ERR_PNPM_OUTDATED_LOCKFILE`**

现象是 CI 安装依赖失败，本地正常。原因是 lockfile 与 `package.json` 不一致，本地用了 `pnpm install` 而 CI 用 `--frozen-lockfile`。改法是本地重新安装并提交 lockfile。

**2. `denied: permission_denied: write_package`**

现象是推送镜像被拒。原因是 workflow 没有 `packages: write` 权限，或 `GITHUB_TOKEN` 未登录 GHCR。改法是补 `permissions` 段并 `docker login ghcr.io`。

**3. `advisory lock 7214001 timeout`**

现象是迁移卡住几十秒后失败。原因是上一次迁移异常退出，锁没释放，或两个迁移并发执行。改法是确认没有并行运行，必要时手动查 `pg_locks` 并终止残留会话。

**4. 部署报 `no such image`**

现象是 `docker compose up` 找不到 tag。原因是镜像推送失败但构建 job 显示成功，或 tag 拼错。改法是看 `build` job 的推送日志，核对 `IMAGE_TAG` 与 GHCR 上的 tag 列表。

**5. `input IMAGE_TAG is required`**

现象是 compose 启动前就退出。原因是 `compose.yaml` 里用了 `${IMAGE_TAG:?}`，环境变量没传。改法是在 `deploy.sh` 里显式导出 `IMAGE_TAG`。

**6. 冒烟通过但用户报 500**

现象是首页 200，登录后某些页面 500。原因是冒烟只测了公开页，没测需要登录的路径。改法是冒烟里加一条带会话的请求，或至少查一次 `/api/health` 的数据库连通性。

镜像 tag 只用 sha，不用 `latest`。`latest` 在回滚时指向不明，也无法判断线上跑的是哪个提交；sha 与 git 记录一一对应，排查时直接 `git show`。

这一章涉及的工具都可以替换：Actions 换成 GitLab CI、GHCR 换成其他镜像仓库、compose 换成 systemd。不变的是四段的顺序与失败处理。

## 48.15 这一章在做什么

这一章把发布拆成四个有依赖的阶段，并把每段的失败处理写死。检查与构建并行，迁移在部署之前，部署失败自动回滚。

它建立三条判断。第一，发布顺序比发布速度重要：迁移先于代码，验证先于宣布成功。第二，迁移必须与部署分开，失败时才能单独重跑。第三，回滚靠镜像回退，迁移不回滚，旧代码要兼容新结构。

这一章不覆盖多环境（staging）、蓝绿发布、金丝雀。单台 VPS 的滚动重启已经在第 46 章讲过；多台机器时，部署脚本要改成逐台重启并等待健康检查。

下一章讲备份与账号注销。发布保证了“能上线”，备份保证“出事能回来”，两者合起来才是可运维的系统。
