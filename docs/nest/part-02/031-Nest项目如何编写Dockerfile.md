# 第 31 章 Nest 项目如何编写 Dockerfile

第 30 章那个小服务只有两个文件，Dockerfile 怎么写都不太会错。换成真正的 Nest 项目，事情一下子多出四件：TypeScript 要先编译成 JS、pnpm 的依赖分「构建用」和「运行用」、Prisma 8 的契约产物要跟着进镜像、非 root 用户还得有地方写日志。

最直觉的做法是把第 30 章那份 Dockerfile 原样套到 `meeting-booking` 上。它大概率能构建成功，然后你得到两个新问题：镜像 1.9GB，安全扫描报告里躺着三百个来自构建工具链的 CVE；CI 每次构建八分钟，其中六分钟在装 `devDependencies`。

这 1.9GB 里，TypeScript、Nest CLI、测试框架、类型定义占了大头；这六分钟里，装的全是只在「把源码变成 `dist/`」那一刻有用的东西。它们被一起发到了生产环境，而生产环境一行都用不到。

所以这一章要解决的不是「怎么让镜像跑起来」，而是「怎么只把该带的东西带进去」。用的办法叫多阶段构建，第 30 章第一次讲过镜像和层，这里是在层的基础上做减法。

## 先弄清「构建依赖」和「运行依赖」

一个 Node 服务跑起来只需要两样东西：编译后的 JS，和运行时真正 import 的包。

你可以把构建依赖想成装修队：电钻、脚手架、切割机，盖房子时缺一不可，但住户搬进来那天它们必须撤走。运行依赖是家具家电，住户真正要用的。TypeScript、Nest CLI、`@types/*` 就是电钻，`@nestjs/common`、`pg` 这些才是家具。

单阶段 Dockerfile 把两者装进同一个镜像，等于交房时把装修队和脚手架一起锁在屋里。多出来的不只是几百 MB，还有几百个 CVE（公开披露的漏洞编号）——每多一个包，扫描器就多一行要处理的东西。

多阶段构建（multi-stage build）就是为这件事设计的：一个 Dockerfile 里写多个 `FROM`，每个 `FROM` 开一个新阶段，用 `AS 名字` 命名；前面的阶段负责装依赖、编译，最后一个阶段只 `COPY --from=构建阶段 /app/dist` 和运行时依赖。中间阶段的东西不会进入最终镜像，除非你显式 COPY。等于工地和成品房分开，交房时只把家具搬进去。[Docker 的多阶段构建文档](https://docs.docker.com/build/building/multi-stage/) 有最小例子，[Nest 的部署章节](https://docs.nestjs.com/deployment) 讲运行时该带哪些文件。

```mermaid
flowchart LR
  S["源码 + pnpm-lock.yaml<br/>已提交的 contract.json"] --> D["deps<br/>pnpm install --frozen-lockfile"]
  D --> B["build<br/>校验契约产物 + pnpm build"]
  B --> Dist["dist/main.js<br/>dist/generated/prisma8/"]
  S --> P["prod-deps<br/>pnpm install --prod"]
  Dist --> R["runner<br/>node:22-alpine + USER node"]
  P --> R
  R --> I["meeting-booking:1.0.0<br/>约 220MB"]
```

拆成四段而不是两段，是为了让缓存各管各的：改业务代码只重跑 `build`，改依赖才重跑 `deps` 和 `prod-deps`。如果把 `prod-deps` 合进 `runner`，每次构建都要在最终镜像里再装一遍依赖，层更多，缓存也更难命中。

多阶段构建还有两个容易被忽略的好处。其一，中间阶段的文件系统不会进入最终镜像，所以 `deps` 里那份带完整 devDependencies 的 `node_modules` 不会被「删掉」——它压根不在结果里，也就不存在「删了但层里还有」的问题。其二，可以按阶段调试：`docker build --target build -t meeting-booking:debug .` 会停在 `build` 阶段，进去看编译产物长什么样，不用改 Dockerfile。

体积差多少？`node:22-alpine` 本身约 130MB，生产依赖约 40MB，`dist` 只有几 MB，最终镜像 200MB 上下。单阶段把 TypeScript、Nest CLI、ESLint、测试框架全带上，1GB 起步。差的这 800MB 不只是磁盘，还有每次拉取、每次扫描、每个 CVE 的成本。

先把运行时约定说清楚，后面每个决定都依赖它：Nest 12.3.x、Node 22、ESM（`"type": "module"`）、pnpm 11、PostgreSQL 17 + Prisma 8。`tsconfig.build.json` 把 `rootDir` 固定成 `./src`，所以 `nest build` 的产物是 `dist/main.js`；`src/generated/prisma8/` 下的契约产物已提交，构建时不连数据库、也不重新生成。

## 写 Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN test -f src/generated/prisma8/contract.json \
  || { echo "缺少 Prisma 契约产物：先执行 pnpm db:emit 并提交 src/generated/prisma8/" >&2; exit 1; }
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1
CMD ["node", "dist/main.js"]
```

几个决定值得单独说。

**`base` 阶段只干一件事：把 pnpm 钉住。** `corepack prepare pnpm@11.2.2` 连包管理器版本一起固定，避免「今天构建用 11.2，明天用 11.3」。`COREPACK_ENABLE_DOWNLOAD_PROMPT=0` 是给非交互构建用的——没有它，Corepack 可能停下来等你确认，CI 直接卡死。

**`pnpm-workspace.yaml` 必须复制。** 它不只是 workspace 声明，pnpm 11 的 `minimumReleaseAge`、`onlyBuiltDependencies` 都写在这里。漏了它，Docker 构建可能报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`（本机因为文件在所以一切正常），或者依赖的构建脚本被静默跳过。

**`deps` 和 `prod-deps` 分开装两次。** 不能把 `deps` 的 `node_modules` 复制过来再删 `@nestjs/cli`——pnpm 的 `.pnpm` 目录里全是硬链接和符号链接，手删很容易把运行依赖一起弄坏。重新 `pnpm install --prod` 最干净，代价是多一层缓存。

**`build` 阶段的 `test -f` 是保险。** 契约产物已经在仓库里，`COPY src` 会带进来；但 CI 忘了提交时，这个 `test` 让构建当场失败，并直接告诉你跑 `pnpm db:emit`，而不是等容器启动才报模块找不到。

**runner 只拿三样。** `dist`、生产 `node_modules`、`package.json`。`package.json` 不是为了好看：项目是 ESM，Node 靠 `"type": "module"` 决定 `dist/main.js` 按模块加载，漏了它就报 `SyntaxError: Cannot use import statement outside a module`。源码、`prisma/`、`tsconfig` 都不进运行镜像。

**`USER node` 放在复制之后。** `node` 用户 UID 1000；`COPY --chown=node:node` 让文件属主直接正确。反过来先切用户再复制，`/app` 下很多路径会没有写权限。应用只往 stdout 打日志，不写本地文件，所以只读根文件系统也能跑。

**启动命令可以带 source map。** `CMD ["node", "--enable-source-maps", "dist/main.js"]` 让生产环境的错误堆栈指回 `.ts` 行号。代价是 Node 启动时多读一批 `.map` 文件，`dist` 里也要保留它们（`tsconfig.build.json` 的 `sourceMap` 不能关）。排查线上问题的收益远大于这点开销，建议默认开。

## 构建，先看路径对不对

```bash
docker build --progress=plain -t meeting-booking:1.0.0 .
```

```text
#9  [deps 3/3] RUN pnpm install --frozen-lockfile
#9  DONE 24.1s
#13 [build 5/5] RUN pnpm build
#13 DONE 9.8s
#17 [runner 4/5] COPY --from=build --chown=node:node /app/dist ./dist
#17 DONE 0.1s
#18 exporting to image
#18 => naming to docker.io/library/meeting-booking:1.0.0
```

（示例输出，本机无 Docker，未实测。）

在 Apple Silicon 上构建、部署到 amd64 服务器时，要显式指定平台：`docker build --platform linux/amd64 ...`。不加的话镜像里的 esbuild、Prisma 引擎是 arm64 的，容器起来报 `Exec format error`。多阶段构建里更稳的写法是在 `FROM` 上写 `--platform=$BUILDPLATFORM`，只给命令行加参数在跨平台构建时可能对不上。

构建日志里那行 `transferring context` 也值得看一眼。如果它显示几百 MB，说明 `.dockerignore` 没排干净。Nest 项目的 `.dockerignore` 至少写这些：

```text
node_modules
dist
coverage
.git
.env
.env.*
*.log
```

`node_modules` 一定要排——本地那份是 macOS 的二进制，带进 Linux 镜像既没用，还可能覆盖容器里正确安装的版本。`dist` 也排，镜像里的 `dist` 必须来自当前源码的编译结果，而不是你上次本地构建的残留。

构建完别急着跑，先确认产物路径：

```bash
docker run --rm --entrypoint sh meeting-booking:1.0.0 -c 'ls -1 /app; id -un'
```

```text
dist
node_modules
package.json
node
```

（示例输出，未实测。）

如果这里出现 `src`、`prisma`、`tsconfig.json`，说明 runner 复制多了；如果 `ls /app/dist` 里只有 `src/main.js`，说明 `rootDir` 没收紧。这是 Nest 容器化第一个高频坑：`tsconfig.json` 的 `include` 把 `prisma.config.ts` 这类根目录外的文件也带进来时，TypeScript 会把公共根算成项目根，产物变成 `dist/src/main.js`。修法是给 `tsconfig.build.json` 加 `"rootDir": "./src"`，**不是**把 `CMD` 改成猜出来的路径——那只是把问题藏起来。

顺便验证镜像里没有构建工具：

```bash
docker run --rm --entrypoint sh meeting-booking:1.0.0 \
  -c 'test -d node_modules/@nestjs/cli && echo LEAK || echo clean'
```

```text
clean
```

（示例输出，未实测。）看到 `LEAK` 就是出事了：`prod-deps` 装的是 `--prod`，`@nestjs/cli` 不该在。它出现通常意味着 `NODE_ENV=production` 被提前设进了 base 阶段，pnpm 跳过了 devDependencies——但那样 `pnpm build` 又会因为找不到 `nest` 直接失败。两个现象指向同一个变量，查 `ENV` 的位置就行。

另一个高频坑是 `package.json` 的 `"main"` 指向 `dist/main.js`，但 `nest build` 曾因 `deleteOutDir` 与 watch 冲突留下空目录。构建日志里出现 `dist` 却 `ls` 不到文件时，先看构建日志最后一行有没有 `error TS`。

## 启动，把检查项一次跑完

应用启动时会校验环境变量，`DATABASE_URL` 必填。Prisma 客户端是惰性的，启动阶段不连库，所以先给一个合法连接串就能起来：

```bash
docker run -d --name meeting-booking \
  -p 3000:3000 \
  --add-host=host.docker.internal:host-gateway \
  -e DATABASE_URL=postgresql://meeting:meeting@host.docker.internal:5432/meeting_booking \
  meeting-booking:1.0.0
```

`--add-host` 让容器里的 `host.docker.internal` 指向宿主机，Linux 上必须加，Docker Desktop 默认就能解析。为什么不能写 `localhost`？第 29 章讲过：每个容器有自己的网络空间，`localhost` 指的是容器自己。真实部署时这个值从 Secret 注入，不要打进镜像。

```bash
docker logs --tail 5 meeting-booking
```

```text
[Nest] 1  - 11/06/2026, 3:28:41 PM     LOG [NestApplication] Nest application successfully started
[Nest] 1  - 11/06/2026, 3:28:41 PM     LOG [AppController] health endpoint: http://localhost:3000/api/health
```

（示例输出，未实测。）

```bash
curl -s http://localhost:3000/api/health
```

```text
{"status":"ok","timestamp":"2026-11-06T07:28:52.118Z","uptime":11}
```

再一次性验四件事：

```bash
docker exec meeting-booking id -u
docker exec meeting-booking node -p "process.versions.node.split('.')[0]"
docker inspect --format '{{.State.Health.Status}}' meeting-booking
time docker stop meeting-booking
```

```text
1000
22
healthy

real    0m0.6s
```

（示例输出，未实测。）`1000` 说明 `USER node` 生效；`22` 说明基础镜像和 `engines` 对得上；健康检查在 `start-period` 内显示 `starting`，十几秒后再查；`0.6s` 说明 SIGTERM 到了 Node，`enableShutdownHooks()` 关掉了连接。

如果 `docker stop` 等满 10 秒、退出码 137，说明信号没到 Node。最常见的原因是 `CMD` 写成 shell 形式，或者外面又包了一层 `npm start`（信号和 1 号进程的关系，第 30 章用 tini 讲过）。`HEALTHCHECK` 也要理解边界：它只给容器打个状态标签，Docker 引擎**不会**因为 `unhealthy` 自动重启，采取动作的是外层编排。没有这个标签，编排只能看「进程还在不在」，而事件循环堵死、依赖断开时进程往往还活着——这正是健康检查存在的理由。

## Prisma 8 的契约产物放哪

Prisma 8 是 contract-first：`prisma/contract.prisma` 是唯一事实来源，`pnpm db:emit`（内部跑 `prisma contract emit`）生成 `contract.json` 和 `contract.d.ts`。运行时 `contractFromJson<Contract>(contractJson)` 读的是 JSON，`.d.ts` 只参与编译。于是有三个结论：

- 两个产物提交进 Git，Docker 构建直接用；镜像里不需要 Prisma CLI，`prod-deps` 也把它排除在外。
- 构建阶段只做 `test -f` 校验，不生成。生成放在本机或 CI 的 `pnpm db:emit`，产物过代码评审再提交，构建才可复现。
- 别在 `CMD` 里塞 `prisma db migrate`。运行镜像没有 CLI；多个副本同时启动时迁移会互相打架。迁移是独立 job，用带完整工具链的镜像跑。

`dist` 里为什么会有 `contract.json`？TypeScript 编译时会把 `resolveJsonModule` 导入的 JSON 复制到 `outDir`，`dist/generated/prisma8/contract.json` 就是这么来的。升级 TS 大版本后这个行为若变了，`test -f` 要扩展到 `dist` 再查一次，别等运行时才发现。

## 真会踩的坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `Cannot find module '/app/dist/main.js'` | 产物实际在 `dist/src/main.js` | 收紧 `tsconfig.build.json` 的 `rootDir` |
| `Cannot use import statement outside a module` | runner 漏了 `package.json` | 复制它，保留 `"type": "module"` |
| 构建报 `nest: not found` | `NODE_ENV=production` 设在了 base 阶段 | 只在 runner 设 |
| `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` | 漏了 `pnpm-workspace.yaml` | 加进 `COPY` |
| 写日志报 `EACCES` | `USER node` 对 `/app` 没写权限 | 日志写 stdout，或给目录 `chown` |
| `docker stop` 后退出码 137 | 10 秒内没退，被 SIGKILL | exec 形式 `CMD`，确认关闭钩子 |

再补四条：

- `EXPOSE` 不发布端口，`-p` 才是入口；应用显式 `listen(port, '127.0.0.1')` 时容器外永远访问不到，生产写死 `0.0.0.0`。
- `/api/health` 只是存活检查，不查数据库。要就绪检查用 `@nestjs/terminus` 加数据库 ping，别把「进程还在」当「依赖正常」。
- tag 用 `1.0.0` 这种可追踪版本，别推 `latest` 上生产。要锁死还得固定基础镜像 digest，第 32 章讲。
- `.dockerignore` 至少排除 `node_modules`、`dist`、`.git`、`.env*`；带 token 的 `.npmrc` 不要 `COPY`，用 BuildKit（Docker 的现代构建器，较新版本默认启用）的 secret mount。

镜像能跑、能停、能查健康状态，这条链路就闭合了。下一章不满足于「能跑」，从体积、构建速度、攻击面三个方向再压一轮。


<!-- chapter-nav:start -->
---

← 上一篇：[030 你的第一个Dockerfile](030-你的第一个Dockerfile.md) · [本 Part 目录](_part.md) · 下一篇：[032 提升Dockerfile水平的5个技巧](032-提升Dockerfile水平的5个技巧.md) →
<!-- chapter-nav:end -->
