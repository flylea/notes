# example/ 审计报告（可构建性 + API 正确性 + 章节一致性）

> 审计对象：`example/`（会议室预订系统后端，Nest 12 + Prisma 8 RC + PostgreSQL 17 + Redis 8）
> 审计方式：只读仓库；副本 `/tmp/example-audit` 内安装依赖并实测构建/启动；Docker 不可用，数据库启动路径「未验证」。
> 实测环境：node v26.13.1、pnpm 11.8.0、无 docker（`docker: command not found`）、网络可用。
> 时间：2026-11-21。所有「已跑通」均为本机真实输出。

## 结论

**代码本身可构建、可启动、交互接口正确**：`pnpm install`、`pnpm typecheck`、`pnpm build`、`pnpm db:emit` 全部 exit 0，且无 DB 时 `node dist/main.js` 能完整启动并通过 HTTP 实测（路由、Swagger、统一响应、异常、限流头、helmet 头、request-id、DTO 校验全部符合设计）。但**「按 README 从零跑通」目前不成立**：`example/.env.example` 仍是 MySQL 8.4 配置，照 README 第 1 步复制后启动会被 zod 校验直接拦下（错误原文见 P0-1）。数据库相关命令（`db:init`/`db:plan`/`db:migrate`/`db:seed` 成功路径、真实 CRUD、Redis 正常路径）因本机无 Docker 而**未验证**。

## 构建/安装实测记录

副本：`cp -a example/. /tmp/example-audit`（604K）；以下命令均在副本中执行。

| # | 命令 | 结果 | 关键输出 |
| --- | --- | --- | --- |
| 1 | `pnpm install` | ✅ exit 0 | 595 包；解析版本见依赖表；末尾 `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @scarf/scarf@1.4.0, esbuild@0.28.2, workerd@1.20261002.1`（exit 仍 0） |
| 2 | `pnpm typecheck`（`tsc --noEmit`） | ✅ exit 0 | 2.855s，无输出、无错误 |
| 3 | `pnpm build`（`nest build`） | ✅ exit 0 | 5.962s；`dist/` 完整（含 `dist/generated/prisma8/contract.json`），全部 ESM `.js` |
| 4 | `pnpm db:emit`（`prisma contract emit`） | ✅ exit 0 | 写出 `contract.json` + `contract.d.ts`；与仓库已入库产物 `diff -ru` **无漂移（NO DRIFT）**；storageHash `576090a4…43ec4d`、executionHash `96e31689…e8951`、profileHash `3916f444…aa8b2` |
| 5 | `pnpm exec prisma --version` | ✅ | `8.0.0-rc.29`；`contract`/`db`/`migration` 子命令齐全（emit/infer/format/print；init/schema/sign/update/verify/migrate；check/graph/list/log/new/plan/show/status/ref） |
| 6 | `node dist/main.js`（无 DB、无 Redis） | ✅ 启动成功 | 全部 19 条路由映射；`WARN [RedisService] REDIS_URL 未配置，统计缓存将降级为直接查询数据库`；三行 Bootstrap 日志 |
| 7 | `db:seed`（无 DB） | ⚠️ 到连接处失败 | tsx/ESM/JSON 导入/契约加载全部正常，最后在 `verifyMarker` 处 `connect ECONNREFUSED 127.0.0.1:5432`（errno -61）→ 说明 seed 脚本本身可用，仅缺数据库 |
| 8 | `db:init`（无 DB） | ⚠️ 预期失败 | `✘ [DRIVER.CONNECTION_FAILED] Database connection failed / why: connect ECONNREFUSED 127.0.0.1:5432`，exit 2 |
| 9 | `DATABASE_URL=mysql://… node dist/main.js` | ❌ 启动失败 | 见 P0-1 错误原文 |

HTTP 实测（#6 的进程，`PORT=3111`）：

| 请求 | 实测结果 |
| --- | --- |
| `GET /api` | 200 `{"data":{"name":"meeting-booking-api","version":"1.0.0","docs":"/api/docs"}}` |
| `GET /api/health` | 200 `{"data":{"status":"ok","timestamp":"…","uptime":6}}` |
| `GET /api/docs` / `/api/docs-json` | 200；doc 内 19 条 path 全部带 `/api` 前缀（`/api/rooms`、`/api/bookings/{id}/approve`…） |
| `GET /api/users/me`（无 token） | 401 `{"statusCode":401,"message":"Unauthorized","error":"Unauthorized","requestId":"…"}` |
| `GET /api/rooms?status=BAD` | 400 `["status must be one of the following values: AVAILABLE, MAINTENANCE"]` → `@IsEnum(as const 对象)` 在 class-validator 0.15 下真实有效 |
| `GET /api/rooms?page=abc` | 400 `["page must not be less than 1","page must be an integer number"]` → `enableImplicitConversion:false` + `@Type` 行为正确 |
| `POST /api/auth/login {"email":"x"}` | 400 `["email must be an email","password must be shorter than or equal to 72 characters","password must be a string"]` |
| `GET /api/rooms`（DB 不通） | 500 且内部错误被隐藏（`message:"Internal Server Error"`）；响应头含 helmet 全套、`x-request-id`、`X-RateLimit-Limit:100 / Remaining:99 / Reset:60` |
| `GET /api/health` + `x-request-id: test-123` | 响应头回写 `x-request-id: test-123`，并 expose |
| 带不可达 `REDIS_URL=redis://127.0.0.1:6399` 启动 | 应用正常启动、降级告警；但日志反复打印 `[ioredis] Unhandled error event: Error: connect ECONNREFUSED 127.0.0.1:6399`（见 P1-2） |

**未验证（因无 Docker / 无 PG）**：`db:init`、`db:plan`、`db:migrate` 成功路径；seed 成功路径；真实 CRUD、JWT 全链路、Redis 正常缓存、统计接口返回值。**不能把「应该能跑」写成「已跑通」。**

## P0（跑不通 / API 错误）

### P0-1 `.env.example` 是 MySQL 8.4 配置，与 PostgreSQL 17 的现实冲突 → README 快速开始必卡死

- 位置：`example/.env.example:11` 注释「数据库（MySQL 8.4）」；`:13` `DATABASE_URL=mysql://meeting:meeting@127.0.0.1:3306/meeting_booking`；`:15-24` 还留着 `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME/DB_SYNCHRONIZE/DB_LOGGING`（TypeORM 时代残留，代码不读）。
- 对照：`example/docker-compose.yml` 起的是 `postgres:17`（5432）、`src/config/env.validation.ts:17-19` 要求「DATABASE_URL 必须是 postgres:// 或 postgresql:// 开头」、`example/README.md:44` 直接让用户 `cp .env.example .env`。
- 实测错误原文（复制 .env.example 后启动）：
  ```
  ERROR [ExceptionHandler] Error: 环境变量校验失败: DATABASE_URL: DATABASE_URL 必须是 postgres:// 或 postgresql:// 开头的连接串
      at Object.validateEnv [as validate] (dist/config/env.validation.js:31:15)
      at ConfigModule.loadEnv (.../@nestjs/config/dist/config.module.js:135:48)
  ```
- 后果：新读者按 README 走到第 5/6 步（`db:init`、`db:seed`）或 `pnpm start:dev` 全部失败；`db:seed` 用同一个 URL 直接抛驱动连接错误。教程最关键的「跑起来」体验在这里断掉。
- 正确写法：`DATABASE_URL=postgresql://meeting:meeting@127.0.0.1:5432/meeting_booking`；删掉 `DB_*`（尤其 `DB_SYNCHRONIZE`）；按 `README.md:43` 的承诺补 `DIRECT_URL`（可同值）；注释改成 PostgreSQL 17。

## P1（章节与 example 不一致 / 漏讲 / 工程隐患）

1. **第 50 章的「生产化改造」没有落地到 example**。`part-03/050-在Nest里集成Prisma8.md:43` 明说「example 里现在的写法是这样」，随后给出 `useFactory(ConfigService)`、`DatabaseLifecycle`（`onApplicationShutdown` 里 `db.close()`）、`slow-query.middleware.ts`、`TransactionService`、`HealthModule`（`select 1`）五块代码，但 example 里一个都没有：`src/database/` 只有 `prisma.ts`、`database.constants.ts`、`database.module.ts`，`database.module.ts:11` 仍是 `{ provide: PRISMA, useValue: db }`，`src/modules/` 下没有 health 模块，`src/app.controller.ts:20-27` 健康检查仍只返回 uptime（不查库）。全 `part-03` 只有第 50 章提到这些类名（grep 证实）。读者照章改写后代码与「参考实现」分叉，且第 50 章末尾没有「example 已同步 / 留给读者练习」的说明。
2. **example 的 ioredis 没有挂 `error` 监听，而第 52 章明确要求挂**。`src/redis/redis.provider.ts:19-23` 只 `new Redis(url,{lazyConnect,maxRetriesPerRequest:1,enableOfflineQueue:false})`；`part-03/052-在Nest里操作Redis.md:58,67,377` 写着「`client.on('error', …)` 不是可选的日志装饰」「监听要在 `connect()` 之前挂上」，故障表还写「未挂 error 监听 → 应用随机重启」。实测（不可达 Redis）：进程没崩（ioredis 6 内部兜底），但每 2s 刷一条 `[ioredis] Unhandled error event: Error: connect ECONNREFUSED …`，且无限重连；章节里「随机重启」的说法与 ioredis 6 实际行为也不一致。
3. **`DIRECT_URL` 只在 seed 里生效，迁移链路并没有用它，文档却写「迁移/seed 走直连」**。`src/config/env.validation.ts:36` 注释「运行时连 DATABASE_URL，迁移 / seed 优先用 DIRECT_URL」、`part-03/049-…:287`「迁移和 seed 走直连」、`example/README.md:43` 承诺 `.env.example` 含 `DIRECT_URL`；实际 `prisma.config.ts:12-14` 只有 `connection: process.env.DATABASE_URL ?? ''`，`prisma/seed.ts` 才是 `DIRECT_URL ?? DATABASE_URL`，而 `.env.example` 根本没有 `DIRECT_URL`。连到 PgBouncer / 需要直连迁移时，配置会悄悄走池化连接。
4. **README 里的 `pnpm db:check` / `pnpm db:verify` 不存在**。`example/README.md:223` 写「已有迁移时检查漂移 `pnpm db:check` / `pnpm db:verify`」，但 `package.json:18-23` 只有 `db:emit/db:plan/db:migrate/db:init/db:update/db:seed`；第 48 章自己的表格反而写「直接用 `pnpm prisma db verify`」。照 README 复制会得到 `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL / Command "db:check" not found`。
5. **`pnpm-workspace.yaml:7-10` 的 `allowBuilds` 是未填模板文本**（`'@scarf/scarf': set this to true or false` 等三个），不是布尔。实测每次 `pnpm install` 都打印 `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: …`（exit 0），esbuild/workerd 的 postinstall 被跳过；读者极易把这条 `ERR_` 当成安装失败。正确写法是真布尔，例如 `esbuild: true`（或删掉这三行改用 `onlyBuiltDependencies`）。
6. **JWT 开发默认密钥会随「能启动」一起进生产**。`src/config/env.validation.ts:44,46` 给 `JWT_ACCESS_SECRET/JWT_REFRESH_SECRET` 设了 `min(16)` + 默认值 `dev-…-change-me`，且不区分 `NODE_ENV`；只要 `DATABASE_URL` 合法，生产环境漏配这两个变量也能正常启动并签发 token。文件头注释（`:25-27`）只是提醒，不是校验。
7. **预订冲突是「先查后写」的应用层判断，存在并发双订**。`src/modules/bookings/bookings.service.ts:61,80-97` 先 `hasConflict()`（SELECT count）再 `create()`，两步之间没有事务/行锁/数据库排他约束；`prisma/contract.prisma` 只有普通 `@@index([roomId,startTime,endTime])`。第 41 章恰好教了 PG 的 `EXCLUDE USING gist` 解决「同一房间时间不重叠」，example 没用。两个并发请求可同时通过冲突检查并各自插入（静态推理，未实测）。这是本项目最核心的业务规则，建议 example 用 `db.transaction` + 锁，或契约中加排他约束并在文中说明取舍。
8. **项目一 84-103 章正文为 0（20 章全 ⬜）**，example 的 rooms/bookings/stats 模块与所有接口目前**没有任何章节正文覆盖**；part-03 只在 Prisma 章节里引用了 example 片段（044/045/046/049/050 的代码块）。也就是说「example 已实现但教程没讲」的漏讲是系统性的，而不是个别接口。根 README:41 把 example 标为项目一（84-103）的实现，但该 Part 尚未开写。

## P2（可读性 / 规范）

1. `src/main.ts:16-17` 为 Swagger UI 全局关闭 helmet CSP（注释已解释），生产可只对 `/api/docs` 放开，业务接口保留 CSP。
2. `src/config/env.validation.ts` 与 `src/config/configuration.ts` 对同一份 env 做了两遍 zod parse（`validate` 一次、`configuration()` 一次），可合并为一个 schema，避免两处默认值漂移。
3. `README.md:63` 在快速开始第 6 步又写了一次 `cp .env.example .env`（第 1 步已复制），属冗余。
4. `README.md:5,50` 强调「必须 `--ignore-workspace`」，但仓库根目录没有 `pnpm-workspace.yaml`，实测不带该参数安装也成功；example 自身带 `pnpm-workspace.yaml`，与「不是 workspace 成员」的表述容易让读者困惑。
5. 统计接口在应用层聚合（README 已知限制）；`roomUsage` 在房间/预订多时全量拉取，后续可改 SQL GROUP BY（章节里已有伏笔，属预期）。
6. `AllExceptionsFilter` 把 5xx 的 message 统一改成状态文案（`src/common/filters/all-exceptions.filter.ts:60-66`），排障依赖 `requestId`；第 50 章已解释，建议 README 排障一节提示「用 requestId 搜日志」。
7. `db:seed` 失败时只抛驱动的完整对象（Node 栈），对新手不够友好；可 catch 后提示「先 docker compose up -d / 检查 DATABASE_URL」。
8. `.gitignore` 未忽略 `src/generated/prisma8/`，与 `README.md:34`「产物已入库、不要手改」一致，**不是问题**，但需在项目一章节里说明「提交生成物」的理由，否则读者会照常规习惯忽略它。

## 依赖版本核对表（declared vs 安装解析 vs npm 最新，2026-11-21 实测）

| 包 | package.json 声明 | 实际安装 | npm 最新（pnpm view） | 结论 |
| --- | --- | --- | --- | --- |
| @nestjs/common | ^12.3.3 | 12.3.3 | 12.6.0 | 可用；落后 3 个 minor |
| @nestjs/core | ^12.3.3 | 12.3.3 | 12.6.0 | 同上 |
| @nestjs/platform-express | ^12.3.3 | 12.3.3 | 12.6.0 | 同上（传递带 express 5.3.0） |
| @nestjs/config | ^12.1.0 | 12.1.0 | 12.1.1 | 可用；落后 patch |
| @nestjs/swagger | ^12.1.0 | 12.1.0 | 12.1.2 | 可用；落后 patch |
| @nestjs/throttler | ^6.7.1 | 6.7.1 | 6.8.0 | 可用；落后 minor |
| @nestjs/jwt | ^12.0.3 | 12.0.3 | 12.0.5 | 可用；落后 patch |
| @nestjs/passport | ^12.0.0 | 12.0.0 | 12.0.2 | 可用；落后 patch |
| @nestjs/cli（dev） | ^12.0.11 | 12.0.11 | 12.0.13 | 可用 |
| @prisma/orm-postgres | 8.0.0-rc.21（精确） | 8.0.0-rc.21 | 8.0.0-rc.24 | 可用且与 CLI rc.29 配对成功（emit/typecheck/build 全过）；但已落后 3 个 RC |
| prisma（dev） | 8.0.0-rc.29（精确） | 8.0.0-rc.29 | 8.0.0-rc.34 | 同上；精确锁定是刻意设计（第 44 章解释过版本错配会导致 `typeChoice` 解析崩溃） |
| typescript（dev） | ~6.0.2 | 6.0.3 | 7.0.2 | 可用；`~6.0.2` 解析到 6.0.3，未跟到 TS 7 |
| ioredis | ^6.0.0 | 6.0.0 | 6.0.0 | 最新，可用 |
| zod | ^4.6.7 | 4.6.7 | 4.6.7 | 最新 |
| class-validator | ^0.15.1 | 0.15.1 | 0.15.1 | 最新；`@IsEnum(as const 对象)` 实测有效 |
| helmet | ^8.3.0 | 8.3.0 | 8.3.0 | 最新 |
| bcryptjs | ^3.0.3 | 3.0.3 | 未查 | 可用（seed/注册均用 10 rounds） |
| @types/node（dev） | ^24.0.0 | 24.19.2 | 未查 | 与 node 26 运行时略有代差，仅类型 |
| tsx（dev） | 4.23.15（精确） | 4.23.15 | 未查 | 可用（seed 实测能加载 ESM+JSON） |

**版本结论**：声明的组合**真实存在且互相兼容**；`prisma@8.0.0-rc.29` + `@prisma/orm-postgres@8.0.0-rc.21` 这对 RC 能跑通 `contract emit`（无漂移）和无 DB 启动/构建。全书统一「锁定 RC 组合、发布前不追最新」是可以接受的教学取舍，但 README/依赖表应写明「2026-11 时最新为 rc.34/rc.24、TS 7」并说明为何不升，否则读者会以为是漏更新。

## 附：本次审计未覆盖的内容

- Docker 相关：`docker compose up -d`、PostgreSQL 17/Redis 8 容器、`db:init/db:plan/db:migrate/db:seed` 成功路径、真实 CRUD/JWT/统计返回值 —— 全部**未验证**（本机 `docker: command not found`）。
- `example/.npmrc`：读取被沙箱规则拦截（`secret.basename.npmrc`），未审计；安装行为未受影响。
- 外部资料核对：版本与 API 结论来自本机 npm registry 实测 + 已安装包的类型/行为；Prisma 8 官方文档仅通过 CLI 帮助文本与类型定义交叉验证，**未逐条抓取官网页面**。
