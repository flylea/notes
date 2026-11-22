# NestJS 教程笔记审计报告

- **审计对象**：`/Users/dailei/code/self/notes/docs/nest`（规划 286 章 / 31 Part / 7 篇，已成稿 53 章 + `example/` 参考实现 + 元数据与门禁脚本）
- **审计时间**：2026-11-21（Asia/Shanghai）
- **审计方式**：4 路并行只读审计（Part 00–01 技术、Part 02–03 技术、`example/` 实跑、结构/覆盖度/元数据），叠加 Lead 独立核验（npm registry、tarball 解包、官方文档、门禁复跑）。**未修改任何章节与 example 源码**。
- **外部事实基线**：npm registry 实测（2026-11-21）、`docs.nestjs.com/sitemap.xml`（183 页，lastmod 2026-11-20）、`@nestjs/schematics@12.0.12` 模板实物、`@nestjs/core@12.6.0` 源码、Prisma 8 RC 包内 `.d.mts` 与官方随包 skill 文档、PostgreSQL 17 / Docker / PM2 / Redis / ioredis 官方文档。
- **子报告**（可追溯行号级证据）：`_meta/audit/audit-core.md`（001–028）、`audit-data.md`（029–053）、`audit-example.md`（example 实跑与一致性）、`audit-plan.md`（结构/覆盖/元数据）。

---

## 一、总体结论

**这套笔记的技术底子明显高于「掘金小册改编」的平均线，问题不在「讲错」，而在三件事：版本基线落后一代、结构性缺口（测试/进阶切面/项目正文）、以及「全达标」的自我验收不可信。**

| 维度 | 评分 | 依据 |
| --- | ---: | --- |
| 技术准确性（已写 53 章） | 8.5 / 10 | 逐条对照 `@nestjs/core@12.6.0`、Prisma 8 rc.24 `.d.mts`、PG17 文档，绝大多数机制/API/源码引用成立；仅 8 处 P0 级硬错（见第二节） |
| 已写章节的完整度 | 7.5 / 10 | 请求生命周期（除 Guard）、装饰器、AOP、动态模块、上传、日志、Docker、SQL、Prisma 8 骨架都成体系；缺 ConfigModule、作用域、序列化、测试 |
| 全 286 章规划的覆盖度 | 6.5 / 10 | 官方 183 页中约 140 页有标题级对位；GraphQL 18→约 4、WebSocket 6→约 1、微服务缺 5 个跨切面页、测试 0 章 |
| 写法时效性 | 5.5 / 10 | 基线写 Nest 12.3.x / TS 5.9+ / graphql 13 / swagger 11 / Prisma rc.29+rc.21；实测 12.6.0 / TS 7.0.2（但需停 6.x）/ 14.2.1 / 12.1.2 / rc.34+rc.24；`nest deploy`、`@nestjs/observe`、SWC/Rspack、压测在 286 章标题中 **0 命中** |
| 可复现性 | 6 / 10 | `example/` 能 install/typecheck/build/启动（实测），但 `.env.example` 仍是 MySQL；正文章节 41 处「未实测」，Docker 6 章与 SQL 全 Part 无一条可复现输出 |
| 工程/元数据可信度 | 5 / 10 | QA 报告数字与实测不符、原创度门禁 exit 2、技能矩阵 317≠286、`qa-report.mjs` 默认只统计到 268 章、Part 编号与章号错位 |

一句话版本：**「把 Nest 12 的 API 讲对了 90%，但把 2026 年的 Nest 教程写成了 2025 年的版本，且在第 50 章之后与自己的参考实现分了叉。」**

---

## 二、P0：必须先修（不修则「照着做会失败」）

| # | 位置 | 问题 | 证据 / 正确写法 |
| --- | --- | --- | --- |
| P0-1 | `part-00/001-开篇词.md:133`、`part-01/003-快速掌握NestCLI.md:51,57,153-155,196` | `pnpm dlx @nestjs/cli@12.3.0 new ...` —— **该版本不存在** | `@nestjs/cli` 12.x 只有 12.0.1–12.0.15，latest 12.0.15；`pnpm view` 直接 `ERR_PNPM_PACKAGE_NOT_FOUND`。ch003 的 `nest info` 输出里「CLI 12.3.0」也是编的。改为 `@nestjs/cli@12`（或 `@12.0.15`） |
| P0-2 | `part-00/001-开篇词.md:130` | 称脚手架交互会问「NestJS Observe 选 No」 | `@nestjs/schematics@12.0.12` 的 `application/schema.json` 中 `observe` **没有 x-prompt**（默认 false，只能用 `--observe` 传）；只有 ESM/CJS 有交互提示。真实交互还多一步 **agent skills 选择**（`--skills all\|agents\|claude\|cursor\|none`、`--skip-skills`） |
| P0-3 | `part-01/017-Nest的Middleware.md:245` | `import type { NextFunction } from 'node:http'` | `NextFunction` 不是 `node:http` 的导出（`@types/node@24` 零命中），来自 `express-serve-static-core@5` → **TS2305 编译不过**。同文件 017:63 已写对，应统一 `from 'express'` |
| P0-4 | `example/.env.example:11-24` | 仍是 **MySQL 8.4 + `mysql://…:3306`**，而 compose 是 `postgres:17`、`env.validation` 强制 `postgres://` | 照 README 第 5 步 `cp .env.example .env` 后启动即报「环境变量校验失败: DATABASE_URL 必须是 postgres:// 或 postgresql:// 开头的连接串」；`DB_*`/`DB_SYNCHRONIZE` 是 TypeORM 残留、代码不读 |
| P0-5 | `part-03/045-Prisma8一对一映射与关联CRUD.md:200` | `conflictOn: { userId }` 形状错 | `@prisma/orm-family-sql@rc.24` `orm-client.d.mts:1236`：`readonly conflictOn?: readonly (keyof … & string)[]`；官方 JSDoc 示例 `conflictOn: ['email']` → 应为 `conflictOn: ['userId']`，现写法编译不过 |
| P0-6 | `part-03/045:99、266` | 「裸 `DateTime` 落到 `timestamptz-temporal@1`，Node 22 没 Temporal，第一次读写就报 `RUNTIME.TEMPORAL_UNAVAILABLE`」 | 因果错：裸 `DateTime` 默认 `as: jsDate` → `pg/timestamptz-date@1`，返回 JS `Date`，**不需要 Temporal**（`orm-postgres rc.24` `authoring-*.mjs:499-520`；官方 skill `references/contract.md:125` 只有 `*Temporal` 系列才要求 Temporal） |
| P0-7 | `part-02/032:3,7,23,122` ↔ `part-02/031:29,105` | ch32 说「上一版镜像 1.9GB、CI 九分钟」，ch31 已交付「约 220MB」「#9 DONE 24.1s」；ch32 L35-82 又把多阶段构建当新技巧复述一遍 | 同一镜像两套互斥数据，读者不知道哪个是真的。要么改 ch31 为「未优化版」，要么把 ch32 基线换成 ch31 的真实数字，并把 ch32 重新定位（它现在是 ch31 的复述） |
| P0-8 | `part-03/041-PostgreSQL的事务和隔离级别.md:335` | `tx.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')` | `execute(plan: SqlOrmPlan, options?)` 只收 plan 对象，无字符串重载。正确写法 `tx.execute(tx.raw.sql\`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE\`.build())`；或升级到 rc.24 用 `db.transaction(fn, { isolationLevel })`（书中固定的 rc.21 确实没有第二参，所以「无隔离级别参数」在 rc.21 成立、在 rc.24 已过时） |
| P0-9 | `part-03/050-在Nest里集成Prisma8.md:382、386` | ①「`poolOptions` 每个池配 20」；②「`connectionTimeoutMillis` 默认无限等」 | ① `PostgresPoolOptions` 只有 `connectionTimeoutMillis`/`idleTimeoutMillis` 两个字段，**没有 max**（池上限是 `pg` 默认 10）；要配上限须传 `pg: new Pool({ max })` 或上 PgBouncer。② 运行时默认 **20000ms**（`binding-*.mjs:238` `?? 2e4`），「无限等」是原生 `pg` 的默认 0，两者被混为一谈 |
| P0-10 | 全书结构（`README.md:18`、`STYLE-GUIDE.md:23,90`、`chapters.tsv`） | **测试 0 章**，且明写「本期不引入测试/不展示 Vitest/Jest」 | Nest 12 脚手架默认生成 `vitest@4` + `oxlint` + `test/app.e2e-*.ts` + `test`/`test:e2e` 脚本，`@nestjs/testing@^12.0.1` 已在 devDeps；ch004:315 甚至自己引用了 `types: ["vitest/globals","node"]`。这是官方 fundamentals 12 页里唯一的整页缺口，也是求职硬需求 |
| P0-11 | `_meta/QA-REPORT-1-53.md` + 门禁脚本 | 「53 章全达标 / 原创度 0 风险」不可复现 | QA 报告平均汉字 3145/3172 vs 实测 **3046**；合计 166,818 vs **161,443**；min/mid/max 2,342/3,101/5,150 vs **2,210/2,969/4,974**；`check-originality.mjs` **exit 2**（参考小册目录不存在）；`qa-report.mjs:12` 默认 end=268（269–286 共 18 章永不进报告）；报告自己写着「所有命令输出沿用原稿」。门禁只验字数/文风/配图，不验技术正确性、版本、链接、可运行性 |

> 其中 P0-1、P0-2、P0-3、P0-5、P0-6、P0-7、P0-8、P0-9 是「照抄会报错/自相矛盾」，P0-4 是「照 README 从零跑不通」，P0-10/P0-11 是「体系/验收层面不成立」。

---

## 三、P1：决定「够不够 2026 水平」

### A. 结构性缺口（该有未写）

| 主题 | 现状 | 建议落点 |
| --- | --- | --- |
| **测试体系** | 286 章规划里 0 条（`chapters.tsv` 全文无「测试/单测/e2e」） | Part01 末尾补 2–4 章：`Test.createTestingModule`、supertest e2e、vitest 4 + oxlint、覆盖率与 CI |
| GraphQL 进阶 | 官方 18 页只有 167/168/174/256 约 4 页对位；**subscriptions/scalars/directives/complexity/plugins/cli-plugin/interfaces/unions/mapped-types/sharing-models 全缺** | 167–176 重排为「基础 3 + 进阶 4 + 教育平台 3」 |
| WebSocket 生产化 | 官方 6 页只覆盖 gateways；**adapter（`@socket.io/redis-adapter` 多实例广播）、guards/pipes/interceptors/exception-filters 全缺** | Part13 补 2 章，生产多副本必备 |
| 微服务跨切面 | 13 页缺 exception-filters/guards/interceptors/pipes/pre-request-hooks | Part07/28 补 1–2 章 |
| OpenAPI 工程化与文档交付 | 规划里只有 **071「用Swagger自动生成api文档」**（+ 090 项目内一节）；已写 53 章只有 5 处顺带提及（002/010/016/020/021），**0 章正文**。全库 **0 命中** Scalar / Redoc / RapiDoc / Stoplight Elements / Apifox / YApi / Knife4j；另缺 Nest 12 的 CLI plugin（编译期自动生成 `@ApiProperty`）、mapped-types、OpenAPI 3.1 配置、文档→前端 client codegen | 把 071 拆 2 章：**071A** Swagger 12 基础与 CLI plugin（DocumentBuilder、`@ApiProperty`/`@ApiTags`、mapped-types、OpenAPI 3.1）；**071B** 文档前端与契约交付（Scalar / Redoc / RapiDoc / Elements / Apifox 对比选型 + `openapi-typescript`/`orval` codegen，接 246 的 TanStack Query）；090 补「接口文档作为验收物」一节 |
| Guard | **part-01 讲了 Middleware/Interceptor/Pipe/ExceptionFilter，唯独没有 Guard 专章**（Guard 排到 057-058 的 ACL/RBAC） | part-01 补 1 章，否则「请求生命周期」在基础篇是断的 |
| `@nestjs/config` | 已写章节里只有 015/017/024/050/052 偶然出现，无专章 | part-01 补 1 章（`isGlobal/cache/validationSchema`、`ConfigService` 类型化） |
| 注入作用域 | ch005:115 只有一句「默认单例」；REQUEST/TRANSIENT、scope 冒泡、`ContextIdFactory` 排到 262 | ch005 或 ch007 后补一节 |
| 序列化 | ch018 讲 Interceptor 没提 `ClassSerializerInterceptor` + `class-transformer` | ch018 补一节，前向引用 ch277 |
| **CI/CD 与制品** | 286 章只有 **226「CICD从GitHubActions到发布」这 1 章**，还塞在 part-23「可观测性」里；已写 53 章 **0 章**涉及。**Jenkins 全仓库 0 命中**（README/STYLE-GUIDE/parts.tsv/chapters.tsv/53 章正文都没有）；GitLab CI、Argo CD/GitOps、镜像仓库（Harbor/GHCR）与发布回滚全缺 | **按用户决定暂不扩展（2026-11-21）**：Jenkins 不单独成章，只在选型对比表里出现。若日后补，优先 1 章 GitHub Actions 实战（可直接拿 example 跑通 lint→typecheck→db:emit→build→镜像→部署→回滚）；ch226 保留为「发布与回滚」 |
| v12 新能力 | `nest deploy`、`@nestjs/observe`、SWC/Rspack、压测在 286 章标题 **0 命中**；`enableShutdownHooks(signals?, options.useProcessExit)` 新签名未提；`NEST_LOG_LEVEL` 未提 | ch003（CLI 新命令）、ch008（关闭钩子）、ch026（日志级别环境变量）、Part09/23（observe 对比、压测） |

### B. 写法过时 / 版本落后

- **基线整体落后**：README/STYLE-GUIDE 写 Nest **12.3.x**（实测 12.6.0）、TS **5.9+/6.x**（实测 7.0.2 已 GA，但**不能升 7**：`@nestjs/graphql@14.2.1` peer 仅 `^5.5||^6`，应统一写 6.0.x 并注明原因）、`@nestjs/graphql` **13**（实测 14.2.1）、`@nestjs/swagger` **11**（实测 12.1.2，且 README 基线表缺 swagger 行）、Prisma **rc.29+rc.21**（实测 **rc.34+rc.24**，且 **8.0 仍是 RC 未 GA**，书中当稳定版用）。
- Docker：`FROM node:22-alpine` 贯穿 030/031/032/033（Node 26 已是 LTS，2026-11）；`corepack prepare pnpm@11.2.2 --activate`（pnpm 已 12.21.0，`corepack prepare` 已弃用）；`# syntax=docker/dockerfile:1.7`（现用 `docker/dockerfile:1`）；「BuildKit 是 Docker 28 默认」「`--no-cache-filter` 是 Docker 28 特性」归因错（BuildKit 自 Docker 23 起默认）。
- ch003:97 / ch010:9 仍写「TS 5 的 stage 3 装饰器」「TS 5 标准版」；ch003 package.json / tsconfig 示例与真实脚手架不符（缺 deploy/lint/test 脚本、缺 `rootDir`/`types`/`isolatedModules`），与 ch004:315 冲突。
- 规划层过时内容：Etcd/Nacos/Zookeeper/**Zuul**（Java 网关）6 章、PM2 2 章、compodoc、6 章 Vue 前端、284/285 元章节（讨论教程自身，暴露小册依赖）、「ORM 讲 3 遍/Redis 讲 5 遍/MQ 讲 4 遍/面试题 6 处」。

### C. 可复现性 / example 一致性

- `example/` 实测：`pnpm install`（595 包）/`typecheck`/`build`/`db:emit` 全 exit 0，`storageHash 576090a4…` 与入库产物 NO DRIFT；无 DB 启动成功，19 条路由、`/api`、`/api/health`、`/api/docs` 200，401/400/DTO 校验/限流/helmet/x-request-id 实测正确。**骨架是能跑的**。
- 但「按 README 从零跑通」不成立（P0-4），且 `db:init/plan/migrate/seed` 成功路径、真实 CRUD、Redis 正常路径未验证（本机无 Docker）。
- **第 50 章整章「生产化改造」在 example 里一行都没落地**：`example/src/database/database.module.ts:11` 仍是 `useValue`、`app.controller.ts:20-27` health 只报 uptime；读者照章改写就与参考实现分叉，章末无「与 example 同步」说明。
- **预订冲突是「先查后写」**（`example/src/bookings/bookings.service.ts:61/80`），无事务/锁/`EXCLUDE` 约束，并发可双订——而 ch041 恰好教过 PG 排他约束，这是核心业务规则的漏讲。
- 第 52 章要求 ioredis 挂 `error` 监听，example 没挂（实测刷屏 `[ioredis] Unhandled error event`）；`DIRECT_URL` 只有 seed 用、`prisma.config.ts:13` 迁移只用 `DATABASE_URL`；README:223 的 `pnpm db:check/db:verify` 在 package.json 不存在；`pnpm-workspace.yaml:7-10` `allowBuilds` 是未填模板；JWT dev secret 有默认值。
- **示例输出不可复现**：41 处「未实测/未验证」；Docker 6 章全篇未实测（029 还编了 `Client Version 28.5.1`/`Docker Desktop 4.49.0`）；ch035–042 整章「命令未实测」；ch044/048 的 Prisma CLI 成功输出文案在 CLI 二进制里检索不到；051–053 用 `docker compose exec` 却写交互式 `redis-cli` 输出格式。
- 正文与 example 的路径/命名不一致：`src/health/health.controller.ts`、`src/db/prisma.js`、`src/bookings/...`（example 是 `src/app.controller.ts`、`src/database/prisma.ts`、`src/modules/bookings/...`）；库名 `booking/booking_app` vs `meeting_booking/meeting`；ch052 的 `cache-keys.ts`/`meeting:` 前缀/jitter/TTL 60 在 example 中不存在（example 内联 `stats:overview` + 30s）。
- ch050 的另一个方向性问题：第 38 章设计出的 8 张表（room_details/roles/user_roles/services/booking_services…）在 `example/prisma/contract.prisma`（只有 User/Room/Booking 三个 model）里没有落点，SQL 层与 Prisma 层的数据模型不一致。

### D. 结构与元数据（生成物必须先修根数据）

| 问题 | 证据 | 影响 |
| --- | --- | --- |
| **Part 编号与章号错位** | `parts.tsv` 第 4 篇 section_no = 07/08/09/**11**/**13**/**16**，第 5 篇 = **10**/**12**/**14**/**15**/**17**/**19**，第 6 篇从 **18** 起 | 读者按章号读到 136 后直接跳 145；README「按序学完全部 286 章」不成立 |
| 章节错放 / 错序 | 155-156 MongoDB 塞进 WebSocket Part；169 Kafka vs RabbitMQ 塞进 GraphQL Part；178 部署 K8s 早于 182 什么是 K8s | 数据/消息主题割裂 |
| Part 标题与内容不符 | part-03「PostgreSQL、SQL 与 Prisma」含 51-53 三章 Redis；part-04「Redis 基础与认证鉴权」含 060 配置 + 061-064 Docker + 065-067 Nginx 共 8 章 | 读者按 Part 找内容找不到 |
| 技能矩阵 | `README.md:49` 「章节数」合计 **317≠286**、「已写」**54≠53**（29 章多 domain 重复计数；项目名/篇名被当技术域） | 统计失去意义 |
| 门禁脚本 | `qa-report.mjs:12` end=268；`check-structure.mjs:47/74/99` 错误文案写死 268/30；`validate-chapters.mjs:8` 注释 268；`check-originality.mjs:57-60` 未 `slice(1)` | 269-286 永不进 QA；报错误导 |
| 链接承诺 | `README.md:26` 承诺「每章文末给官方文档链接」，实测 **35/53 章**无 `docs.nestjs.com` 链接 | 与承诺不符 |
| `status.tsv` | 只有表头（从未回填），与 `STYLE-GUIDE.md:160` 要求冲突 | 进度无从追踪 |
| 学习路线 | 路线 A 跳过第 4 篇全部 49 章；路线 B「Part 00→30 按序」与 Part/章号错位矛盾；part-30 标 optional 但 README 要「全部 286 章」 | 路线不可执行 |
| STYLE-GUIDE | `:119` 同一行既写「Next.js 前端」又写「React 19+Vite+AntD」；`:20/:21` 版本落后 | 与 README 打架 |

### E. 深度：偏薄与「有骨架没血肉」

- 53 章合计 **161,443** 汉字，均值 **3,046**，区间 2,210（ch29）–4,974（ch35）；代码块均 15.3、每章约 1 张 Mermaid。
- 相对偏薄（< 2,700 汉字）：**029（Docker Desktop）、030（第一个 Dockerfile）、006（调试）、027（Winston 选型）、031（Nest Dockerfile）、033（Docker 原理）、047（多对多）、019（Pipe）、007（Provider）、003（CLI）、028（集成 Winston）、015（动态模块）、012（自定义装饰器）、024（Nest multer）**——其中 027/033/006/019 属「概念章本可以更厚」，029/030/031 属「实操章但缺实测与验收」。
- 外部链接极少（ch007/012/024 为 0 条），与「每章给官方文档出处」的承诺不符；这直接影响读者「验证与继续学」的路径。

### F. 讲了但事实有偏（逐条已在子报告给出源码/文档依据）

ch016:155「`app.use()` 是 Express 方法，Fastify 实例根本没有」（Nest FastifyAdapter 经 `@fastify/middie` 支持 `app.use`）；ch016:81 基准数字无比较对象（官方：Fastify 57.1k / Nest on Node 55.6k / Hono 53.1k / Nest on Fastify 52.6k / Express 37.0k）；ch008:74-78「同一模块内多个 Provider 钩子顺序没有稳定契约」（v12 迁移指南：hooks now called by component hierarchy level）；ch006:82-83、024:207 示例日志缺 `[Nest] pid - 时间` 前缀；ch020:149/381 用 `@IsEmpty()` 处理「空串跳过」语义错误（应 `@ValidateIf`/`@Transform`）；ch024:265 把 `fallbackToMimetype`（11.1.6 已有）/`overrideMimeType`（12.0.0 已有）归给 12.3；ch021:253「有网关时优先 APP_FILTER」（网关只能用 `@UseFilters`）；ch038:168-173「正好用上 idx_user_roles_role」无 EXPLAIN 证据；ch039:156「`= ANY` 有空值就不为真」不精确（命中即 true）；ch034:101 `os.cpus()` 不读 cgroup；ch036:455「ILIKE 是 PG 独有」不严谨；ch042:480「视图/函数/权限都不在契约里」不准确（RLS/policy 可进契约）；ch052 把「未来重构」写成「项目现状」；ch053:111「第 13 章讲守卫」错（013 是 Metadata/Reflector）。

---

## 四、逐章速查表（53 章）

> 级别：P0=照做会失败/自相矛盾；P1=影响 2026 可用性；P2=打磨。

| 章 | 标题 | 主要问题 | 级别 |
| ---: | --- | --- | --- |
| 001 | 开篇词 | CLI `@12.3.0` 不存在(:133)；编造 Observe 交互(:130)；`--skip-tests` 与 vitest 脚手架冲突 | **P0** |
| 002 | 5 个学习理由 | 质量较好；引用 TS5 装饰器手册已过时 | P2 |
| 003 | 快速掌握 NestCLI | 同 `@12.3.0`（:51/57/153/155/196）；package.json/tsconfig 与真实脚手架不符；漏 `nest deploy`/observe/skills | **P0** |
| 004 | 5 种 HTTP 数据传输 | 唯一悬空引用「第 227 章」(:378)；请求体漏 PATCH/DELETE；VO 引用 ch22/ch50 不准 | P2 |
| 005 | IoC 痛点 | 质量高；请求/瞬态作用域仅一句(:115)，Part01 无专章 | P1 |
| 006 | 如何调试 | 示例日志缺 Nest 前缀(:82-83)；pnpm attach 无直连替代方案；篇幅偏薄 | P1/P2 |
| 007 | 多种 Provider | 质量高；`useExisting` 表格表述含混(:33)；外链 0 | P2 |
| 008 | 全局模块/生命周期 | 漏 `enableShutdownHooks(signals?, {useProcessExit})` 新签名；示例日志缺前缀 | P1 |
| 009 | AOP | Prisma 8 当稳定版(:100)；「第 1 章」引用不准 | P1/P2 |
| 010 | 全部装饰器 | 漏 `applyDecorators`；`@Self() logger: Logger` 举例不当；「TS 5」过时 | P2 |
| 011 | ExecutionContext | `void bootstrap()` 与全书口径不一；锁 `^12.3.0` | P2 |
| 012 | 自定义装饰器 | 优秀且最新（StandardSchemaValidationPipe 属实）；泛型前后不一致 | P2 |
| 013 | Metadata/Reflector | 优秀；未说明默认写法变化来自 schematics 12 模板 | P2 |
| 014 | 循环依赖 | 质量高；链接标签与 URL 不符；`forwardRef` 表格口径窄 | P2 |
| 015 | 动态模块 | 质量高；「未实测」口径不一；未提 `setFactoryMethodName` | P2 |
| 016 | Express/Fastify/NodeAdapter | 内容最新（NodeAdapter 属实）；基准口径(:81)与 `app.use` 说法(:155)错 | P1 |
| 017 | Middleware | `NextFunction` 从 `node:http` 导入 → TS2305(:245) | **P0** |
| 018 | RxJS/Interceptor | 质量高；缺 `ClassSerializerInterceptor`/序列化 | P1/P2 |
| 019 | 内置/自定义 Pipe | 质量高；「未实测」；篇幅偏薄 | P2 |
| 020 | ValidationPipe | 优秀且最新（`errorFormat`/StandardSchema 属实）；`@IsEmpty` 建议不当 | P2 |
| 021 | 自定义 ExceptionFilter | 质量高；「有网关优先 APP_FILTER」误导 | P2 |
| 022 | 图解串讲 | 质量好；`@12` 浮动非基线；「未实测」 | P2 |
| 023 | Express + multer | 质量高；固定 TS 5.9.3 需注记 | P2 |
| 024 | Nest + multer | 质量高（12.0.4 合并/校验文案实核）；版本归属(:265)、Fastify 措辞(:57)、日志格式 | P1/P2 |
| 025 | 大文件分片上传 | 无 P0/P1；`app.use` 注册顺序未说明；偏薄 | P2 |
| 026 | Nest Logger | 质量高；漏 `NEST_LOG_LEVEL` 环境变量 | P1 |
| 027 | 为什么用 Winston | 质量高；`maxsize` 拼写、`handleExceptions:false` 待复核；偏薄 | P2 |
| 028 | 集成 Winston | 最新（nest-winston 2.0.0 属实）；轮转未实测；`flushLogs`/`autoFlushLogs` 未区分 | P2 |
| 029 | Docker Desktop | 全章未实测；编造 `Client Version 28.5.1`/Desktop 4.49.0；偏薄 | P1/P2 |
| 030 | 第一个 Dockerfile | 技术正确；`--no-cache-filter` 归因 Docker 28 错；`node:22-alpine` 过时 | P2 |
| 031 | Nest Dockerfile | 多阶段/HEALTHCHECK/non-root 正确；`corepack prepare`+pnpm 11.2.2 过时；成品数字与 ch32 冲突 | P1 |
| 032 | Dockerfile 5 技巧 | L3 与 ch31 数据互斥；复述多阶段；BuildKit 归因错；体积表待核 | **P0**/P2 |
| 033 | Docker 怎么实现 | namespace/cgroup/overlayfs/runc 准确；`ipcs` 在 alpine 需 util-linux；偏薄 | P2 |
| 034 | 为什么用 PM2 | 实测数据完整；`os.cpus()` 与 cgroup 解释错；路径与 example 不一致 | P1/P2 |
| 035 | 快速入门 PG | DDL/权限/seed 全合法；全章未实测；命名与 example 不一致 | P1/P2 |
| 036 | SQL 语法与函数 | SQL 全合法；全章未实测；「ILIKE 是 PG 独有」不严谨 | P1/P2 |
| 037 | 一对一/JOIN/级联 | 正确；EXPLAIN 偏浅；未实测 | P2 |
| 038 | 一对多/多对多设计 | 设计论证好；索引命中无证据；8 张表在 example 只有 3 个 model | P1/P2 |
| 039 | 子查询/EXISTS | 语义正确；`= ANY` 与 NULL 表述、计划与查询不对应 | P2 |
| 040 | SQL 综合练习 | 十题 SQL 全对、对账自洽；路径与 example 不一致 | P2 |
| 041 | 事务与隔离级别 | 隔离级别/MVCC/写偏斜/行锁/EXCLUDE 正确且标注最认真；`tx.execute('SET TRANSACTION')` 不成立(:335) | **P0**/P1 |
| 042 | 视图/存储过程/函数 | 全对；「都不在契约里」不准确（RLS 可进契约） | P2 |
| 043 | Node 操作 PG 两种方式 | pg 池/事务/SQLSTATE 正确；版本过时；COPY 快一个量级无依据 | P1/P2 |
| 044 | 快速掌握 Prisma 8 | contract-first 主线正确、`definePrismaConfig` 正确；版本表与「rc.22 冲突」演示过时；CLI 输出文案检索不到 | P1 |
| 045 | Prisma8 一对一 CRUD | `conflictOn` 形状错(:200)；DateTime→Temporal 因果错(:99/266) | **P0** |
| 046 | Prisma8 一对多 CRUD | 关系谓词/include 精化/createAll/聚合均存在，质量高 | P2 |
| 047 | Prisma8 多对多 CRUD | 隐式 M2M 被拒与官方 skill 一致；复合 PK/payload 建议正确 | P2 |
| 048 | Prisma8 命令与迁移 | 命令/flag/错误码/目录结构实测存在；版本块过时；输出未实测；缺回滚演练 | P1 |
| 049 | Prisma8 查缺补漏 | 与 example 差异核对准确；版本过时；「db 读跑进 tx」属高风险断言 | P1 |
| 050 | 在 Nest 集成 Prisma8 | middleware/生命周期/健康检查/close 语义正确；`poolOptions` 无 max、默认超时 20s 理解错 | **P0** |
| 051 | 快速入门 Redis | Redis 8 模块/持久化/TTL/淘汰全对；未实测；redis-cli 输出格式 | P2 |
| 052 | Nest 操作 Redis | ioredis 6 API 全对；与 example 三处不一致（provider/service/cache-keys+TTL）；教学扩展未标注 | P1/P2 |
| 053 | ioredis vs cache-manager | 选型论证好、边界准确；「第 13 章守卫」引用错(:111)；未标版本；漏 cache-manager v7 多 store/wrap | P2 |

---

## 五、覆盖度矩阵（官方 183 页 vs 规划 286 章）

| 官方分组 | 页数 | 标题有对位 | 缺口要点 |
| --- | ---: | ---: | --- |
| fundamentals | 12 | 10 | 缺 **testing**、module-ref |
| application | 11 | 11 | 全有（configuration 仅 1 章、logger 3 章偏重） |
| data | 8 | 8 | 无 CacheModule 专章；053 与官方 caching 路线相反但未显式写取舍 |
| http | 10 | 10 | 全有 |
| security | 7 | 7 | 全有（CSP 藏在 Helmet 内） |
| observability | 10 | 10 | 全有，但未提官方 `@nestjs/observe` |
| reliability | 6 | 6 | 全有 |
| **graphql** | 18 | ≈4 | subscriptions/scalars/directives/complexity/plugins/cli-plugin/interfaces/unions/mapped-types/sharing-models 全缺 |
| **microservices** | 13 | ≈8 | 缺 exception-filters/guards/interceptors/pipes/pre-request-hooks |
| **websockets** | 6 | ≈1 | 缺 adapter（Redis 横向扩展）/guards/pipes/interceptors/exception-filters |
| **openapi** | 8 | ≈3 | 缺 cli-plugin/mapped-types/operations/types-and-parameters |
| ai / mcp | 6 / 5 | 4 / 3 | 缺 agents、ai/testing、mcp/testing、mcp/migration |
| cli / devtools | 5 / 2 | 3 / 1 | 缺 scripts、devtools overview（`@nestjs/devtools` 全仓库 0 命中） |
| faq / recipes | 12 / 17 | ≈5 / 5 | 缺 global-prefix/keep-alive/raw-body/cloudflare；swc/serve-static/hot-reload/nest-commander/router-module/crud-generator |
| tutorials | 11 | 10 | 只缺 project-management-api |
| **2026 v12 新能力** | — | **0** | `nest deploy`、SWC/Rspack、`@nestjs/observe`、压测/基准测试 |

> 顺带：规划有、官方 2026 已无的内容 6 类 —— Etcd/Nacos/Zookeeper/**Zuul**（Java 网关，硬伤）6 章、PM2 2 章、compodoc、Vue 前端 6 章、小册 demo 6 章、284/285 元章节。

---

## 六、版本基线升级表（建议直接替换 README/STYLE-GUIDE 基线表）

| 组件 | 现写 | 实测（2026-11-21） | 建议 |
| --- | --- | --- | --- |
| @nestjs/core/common/platform-express | 12.3.x | **12.6.0** | 基线 12.6.x；example 升 `^12.6.0` |
| @nestjs/graphql | 13 | **14.2.1** | 升 14.2.x（peer graphql `^16.11\|\|^17`、TS `^5.5\|\|^6`） |
| @nestjs/swagger | 11（README 无此行） | **12.1.2** | 升 12.1.x 并补行 |
| @nestjs/config / jwt / throttler | 未列 | 12.1.1 / 12.0.5 / 6.8.0 | 补行；example 同步 |
| @nestjs/terminus | 仅 ch031 提一次 | **12.2.0** | ch219 点名并给代码 |
| Prisma | 8.0.0-rc.29 + orm-postgres rc.21 | **rc.34 + rc.24** | 升配对；补一句「8.0 仍为 RC，GA 后需复核 API」 |
| TypeScript | 5.9+ / 6.x | **7.0.2 GA** | **不升 7**（graphql peer 卡 ^5.5\|\|^6），统一写 6.0.x 并注明原因 |
| Node.js | 运行 20.19+/22.12+；CLI 22.22.3+ | 一致 | 保留；example `engines` 改 `>=22.22.3` |
| 测试/lint | 「本期不引入」 | 脚手架 vitest 4 + oxlint | 改为「脚手架自带，第 3 章说明取舍，测试专章 P0 补齐」 |
| 部署 | Docker/Nginx/K8s/Vercel | v12 CLI 自带 **`nest deploy`** | 基线表加行；250/283 增一节 |
| 可观测 | 自建 OpenTelemetry | 官方 **@nestjs/observe 0.3.27** | 220-225 增补对比小节 |
| 构建 | 未提 | **SWC / Rspack + oxlint** | 基线表加行并补 1 章 |
| 前端 | README: Next.js 16；STYLE-GUIDE:119: React19+Vite+AntD | — | 二选一，统一 Next.js（与 244-250 一致） |

---

## 七、建议的修复顺序（含工作量估算）

**第 1 周（P0，约 2–3 天）**
1. 全局替换 `@nestjs/cli@12.3.0` → `@nestjs/cli@12`；ch001 重写「脚手架实际会问什么」（ESM/CJS、agent skills、`--observe/--minimal`）；ch003 的 package.json/tsconfig 换成脚手架实物并说明 `--skip-tests` 的后果。
2. 修 ch017:245 导入；ch045:200 `conflictOn: ['userId']`；ch045:99/266 改 Temporal 因果；ch041:335 改 `tx.raw.sql…build()` 或升级说明；ch050:382/386 改 pool 上限与默认超时。
3. 修 `example/.env.example` 为 Postgres 并删 TypeORM 残留；实测 `db:init → migration plan → db:migrate → db:seed` 全链路；README 补 `db:check/db:verify` 或删之。
4. ch031/ch032 统一镜像数据并重新分工（ch31 = 可跑；ch32 = 优化，不重复多阶段）。
5. 门禁：`qa-report.mjs` end→286、check-structure/validate 文案改 286/31、`check-originality` 缺参考目录时降级为警告；重跑并标注 `QA-REPORT-1-53.md` 过期。

**第 2–4 周（P1，约 2 周写作量）**
6. 基线表全套替换（第六节）+ example 依赖升级 + 全仓库版本号 grep 替换。
7. 补测试 4 章（`@nestjs/testing` + vitest 4 + supertest + CI），并改 README/STYLE-GUIDE 的「不引入测试」口径。
8. 补 6 个基础缺口章：Guard、ConfigModule、注入作用域、序列化、CLI 新命令（deploy/observe/skills）、Docker 现代化（node:26-slim、corepack use、compose healthcheck/override/CI）。
9. 第 50 章与 example 对齐：useFactory + `DatabaseLifecycle` + 慢查询中间件 + health 查库 + 预订并发用 `EXCLUDE`/事务；ch052 的 ioredis `error` 监听与 `cache-keys.ts` 落到 example 或标注「教学扩展」。
10. 修 Part 编号/章号错位与 155/156、169、178/182 错放错序；顺带削重复（Redis 5→2、MQ 4→2、面试题合并）。
11. 重跑所有「未实测」章（Docker 6 章 + ch035–042 + ch044/048 的 CLI 输出），能实测的就实测，不能的改「示意输出」并删具体时间戳。

**第 5 周起（P1 覆盖度 + P2，长期）**
12. GraphQL 进阶 4 章、WebSocket 生产化 2 章、微服务跨切面 1–2 章、OpenAPI CLI plugin/codegen 1 章、性能压测 1 章。
13. 元数据收尾：技能矩阵按章去重、`status.tsv` 回填、35 章补官方链接、学习路线重写、清理 Zuul/PM2/compodoc/Vue/284-285。
14. P2 逐条打磨（见第四节表格 + 各子报告 P2 清单）：交叉引用、日志格式、拼写、示例输出格式、术语（覆盖索引→index-only scan、ILIKE 表述等）。

---

## 八、附录

### A. 关键外部事实（可复现命令见子报告）
- `@nestjs/cli`：12.0.1–12.0.15（latest 12.0.15，2026-11-20），**无 12.3.0**；`@nestjs/core` 12.6.0（2026-11-20，ESM-only）。
- `@nestjs/schematics@12.0.12` ts-esm 模板：`type:module`、`module/moduleResolution:nodenext`、`strict`、`@nestjs/testing ^12.0.1`、`vitest ^4.1.2`、`oxlint ^1.58.0`+`oxlint-tsgolint`、`supertest ^7`、`@nestjs/mau ^0.2.6`；scripts 含 `deploy/lint/test/test:e2e`；生成 `vitest.config.ts`、`.oxlintrc.json`、`AGENTS.md`。
- 官方文档 183 页（lastmod 2026-11-20），分组与缺口见第五节。
- Prisma：`prisma@8.0.0-rc.34`（latest，仍未 GA）+ `@prisma/orm-postgres@8.0.0-rc.24` 为当前正确配对；书中 rc.29+rc.21 在发布时自洽，但已过时；`prisma contract emit` / `db init|migrate|update|verify` / `migration plan|status|…` 真实存在，**没有** `prisma migrate dev/deploy/seed`、`prisma db seed`。
- Nest 12 发布要点：ESM-first、`nest upgrade`、`nest deploy`、CJS/ESM 二选一（ESM→Vitest+oxlint / CJS→Jest+eslint）、Rspack 取代 webpack（monorepo 默认）、Standard Schema（`@Body({schema})` + `StandardSchemaValidationPipe`）、结构化日志（`flattenParams`）、`HttpExceptionOptions.errorCode`、路由冲突策略、`@nestjs/observe`、NATS v3、graphql-ws、请求作用域 WebSocket 网关。

### B. 子报告索引
- `_meta/audit/audit-core.md`：001–028 逐章 + P0/P1/P2 表 + 源码核对清单（136→251 行，最终版）。
- `_meta/audit/audit-data.md`：029–053 逐章 + 5 条 P0 + example 一致性 + Prisma/PG/Docker 官方依据（334 行）。
- `_meta/audit/audit-example.md`：`example/` 实跑记录、P0 `.env.example`、章节与代码分叉、预订并发、ioredis、依赖表（112 行）。
- `_meta/audit/audit-plan.md`：结构/覆盖度/元数据 28 条修复清单、门禁实测、版本升级表、P0/P1/P2 路线（285 行）。

### C. 审计边界
- 只读：未修改任何章节、`example/` 源码、README/tsv/脚本；本报告与 4 份子报告是唯一新增文件。
- 本机无 Docker，`example/` 的 DB/Redis 成功路径、`db:init/plan/migrate/seed` 未验证；Docker/PM2 章的实测结论以官方文档 + 代码审阅为准（子报告已标注「未实测」处）。
- 覆盖度以「章节标题级」匹配为主，正文可能另有零星覆盖（子报告已注明）。

---

## 九、最终复查（终检，2026-11-21 21:20）

> 本节是「首轮四份子报告 + Lead 独立核验」之后的**最后一次全面复查**，目的是查首轮自身有没有漏项，而不是重抄结论。方法：①不依赖 QA-REPORT，独立重算全部量化指标；②补做首轮没做的 8 组静态扫描；③Lead 直接精读此前只由子报告覆盖的章节（018/025/049）；④复核首轮被判为问题的条目（防误报）。

### 9.1 通过项（干净，可放行）

| 检查 | 结果 |
| --- | --- |
| 文件 ↔ `chapters.tsv` 对齐 | **53/53 双向一致**，无「已写无文件」也无「有文件未标已写」 |
| 代码围栏配对 | 0 例外（53 章全部成对；首轮机读的「奇数围栏」是行内 `#` 注释造成的误报，已排除） |
| 标题结构 | 每章唯一 H1；无重复 H2；无 `本章目标/小结/前置知识/练习` 等教材腔小节（0 命中） |
| 章节交叉引用 | 全部落在 1–286；无越界、无悬空（ch004:378 引「第 227 章」经 chapters.tsv 复核存在） |
| 占位/未完成标记 | 无 `TODO/FIXME/待补/待写`（`<!-- chapter-nav -->` 是生成标记，非占位） |
| 跨章重复 | 最高相似度 0.023（043↔044，Prisma 相关段落），无大段复制；031↔032 属「结构复述」而非逐字重复，维持首轮 P0-7 结论 |
| Prisma 8 写法一致性 | `db.orm.public.` 39 处、`contract emit` 17 处、`postgres({…})` 8 处、`createAll` 8 处、`deleteAll` 3 处；全库仅 1 处 `execute('SET TRANSACTION')`（即首轮 P0-8），说明那是孤例不是系统性写法 |
| 深度抽读（018/025/049） | 达到「概念先于场景 + 可运行代码 + 生产坑」标准：018 用类型守卫解决分页/普通响应判别；025 讲清 `Range` 只支持下载、最后一片长度用减法不用取余、分片索引即幂等键；049 用「504 事故 → 词表 → 一条 SQL 查了几次」组织，含 `forNoKeyUpdate`/outbox/codec 等生产词 |
| 误报排除 | ch010 的 `@Inject(BOOKING_CLOCK) private readonly clock` 是构造器参数属性，合规，不算属性注入 |

### 9.2 首轮漏掉、本轮新增的 5 条（均非 P0）

| # | 问题 | 证据 | 级别 |
| --- | --- | --- | --- |
| 1 | **8 章没有可直接粘贴的命令块**（只有 `ts`/`sql` 片段） | 026、036、037、038、039、040、041、047 | P2：与 §4「可验证：命令+预期输出」不完全对齐，读者要自己拼 `psql` 命令 |
| 2 | **外链分布极不均**：35/53 章无 `docs.nestjs.com` 链接；最多的一章只有 6 条，004/007/008/012/024/040/049/050 为 0 条 | 与 README:26「每章文末官方链接」承诺矛盾（首轮只写了「35/53 章无链接」，没量化到章节名） | P1（并入元数据修复） |
| 3 | `dto` / `DTO` 大小写混用 8 章 | 004、009、010、019、020、022、035、040 | P2 术语统一 |
| 4 | ch028 有 2 处 `any` | 与 STYLE-GUIDE §3 strict TS 要求冲突 | P2 |
| 5 | Node 22 基础镜像合计 **21 处** | 030×4、031×4、032×12、033×1 | 已并入 P1-B「Docker 现代化」 |

### 9.3 终检结论

- **本轮未发现新的 P0**；首轮 11 条 P0 全部成立（其中 3 条属于「照做会失败」：`@nestjs/cli@12.3.0`、ch017 `NextFunction` 导入、`example/.env.example` 仍是 MySQL）。
- 结构/元数据面：除首轮已列缺陷外干净，可以放行。
- 内容面：53 章达到「**可发布但需先修 3 处硬伤**」的水准；框架层 8.5 / 后端工程层 6–6.5 / 计算机基础层 2–3 的评分不变。
- 剩余系统性风险按优先级：①版本基线整体落后（README/STYLE-GUIDE 的 12.3.x、TS 5.9/6.x、swagger 11、graphql 13、prisma rc.29+rc.21、Docker 28 与 node:22）②约 41 处「未实测」输出 ③35 章缺官方链接 + 8 章缺可执行命令 ④测试 0 章（规划层，需在 README 明确取舍）。
- Jenkins：按用户决定**不补**；CI/CD 现状（仅 226 一章）记录在案，不列为本次修复项。

### 9.4 修复执行记录（2026-11-21 21:35）

按「先修 3 处硬伤 → 补 ch103 纲要 → 换版本基线」的顺序已执行：

| 项 | 改动 | 文件 |
| --- | --- | --- |
| P0-1 版本不存在 | `@nestjs/cli@12.3.0` → `@nestjs/cli@12`，并补 `--type esm --no-observe --skip-tests`；`nest info` 示例输出改为真实值（CLI 12.0.15 / core 12.6.0） | `part-00/001-开篇词.md:131-136,209`、`part-01/003-快速掌握NestCLI.md:51,55-57,153-154,196` |
| P0-2 编造交互 | 改为「CLI 会问模块格式与 agent skills，可用参数提前答掉」，不再声称「交互里选 Observe 选 No」 | 同上 |
| P0-3 类型导入错 | `NextFunction/IncomingMessage/ServerResponse` 从 `node:http` → `express` 的 `Request/Response/NextFunction`，并注明 `app.use` 属 Express 适配器 | `part-01/017-Nest的Middleware.md:245-252` |
| P0-4 环境变量模板错 | `example/.env.example` 的 MySQL 段改为 PostgreSQL 17（`postgresql://meeting:meeting@127.0.0.1:5432/meeting_booking` + 可选 `DIRECT_URL`），删掉 TypeORM 残留 `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME/DB_SYNCHRONIZE` | `example/.env.example:11-17` |
| 基线替换 | README 生成器模板、STYLE-GUIDE §1、WRITER-BRIEF 统一为 Nest 12.6.x / Node 22·24·26 LTS / TS 6.0.x（注明不升 7 的原因）/ Prisma rc.34+rc.24 / swagger 12.1.x / graphql 14.2.x / Docker 29；README 已重新生成 | `_meta/build-structure.mjs:126-140`、`STYLE-GUIDE.md:11-23,91`、`_meta/WRITER-BRIEF.md:49-50`、`README.md`（生成物） |
| ch103 纲要 | 8 节结构 + 硬约束 + 真机回填清单 + 验收标准，已落盘待写正文 | `_meta/audit/ch103-outline.md` |

校验：`validate-chapters` exit 0（53 达标 / 教材腔 0 / 缺图 0，平均汉字 3049）、`check-structure` exit 0（286/31/53）；`build-structure` 重新生成 README 成功。**未改**：其余章节正文、`chapters.tsv`/`parts.tsv`、`example/` 业务代码。

### 9.5 章节拆分：286 → 287（2026-11-21 21:44）

按用户决定把 API 文档拆成两章，并同步全部元数据与门禁：

| 项 | 变更 |
| --- | --- |
| `_meta/chapters.tsv` | 在 071 后插入 **072「用Scalar、Redoc美化API文档与契约交付」**；其后 215 章整体 +1（072 compodoc → 073，…，286 → 287）；共 **287 行** |
| `_meta/parts.tsv` | Part 05 **71–84（14 章）**、Part 06 **85–104**、…、Part 30 **270–287**；区间/count 由 chapters.tsv 重算 |
| `_meta/check-structure.mjs` | 硬编码 `286→287`、错误文案 `268→287`、`30→31` |
| 章节交叉引用 | `part-01/004-5种HTTP数据传输方式.md` 的「第 227 章 Webhook」→「第 228 章」（唯一受影响的引用） |
| README / `_part.md` | `node _meta/build-structure.mjs` 重新生成（287 章 / 31 Part / 已写 53） |
| 校验 | `check-structure` exit 0（287 章 / 31 Part / 已写 53 / 待写 234）、`validate-chapters` exit 0（53 达标） |
| 纲要 | `_meta/audit/ch071-outline.md` 已按「071A / 071B / 090 补一节」拆分，071A 对应 071，071B 对应 072 |

### 9.6 方法论修正：覆盖度必须双基线（2026-11-21 21:46）

**问题**：首轮覆盖度矩阵只拿「官方 docs 183 页」做对位，这是一个**封闭基线**。Scalar / Jenkins / Apifox 这类**第三方工具生态**不在官方文档里，因此无论扫多少遍都不可能被发现——用户自己发现的 Scalar 缺口，是我方法的必然结果，不是偶发失误。

**修正**：覆盖度改为**双基线交叉**——
1. 官方文档页覆盖率（原有，衡量「框架 API 是否讲全」）；
2. **生态工具反查**（新增，衡量「生产工具链是否讲全」）：按 19 类工具族 × ≈150 关键词，对 `chapters.tsv` 标题级 + 已写 53 章正文做双向命中扫描。

**执行结果**：`_meta/audit/ECOSYSTEM-SWEEP.md`。结论摘要：

- **标题级点名（下界，标题没写≠内容没有，如 074 标题「Node如何发邮件」实讲 Nodemailer）**：
  - 有规划：Swagger、GitHub Actions、Prometheus、OpenTelemetry、Winston、RabbitMQ/Kafka/RocketMQ/NATS/BullMQ/MQTT、PG/MySQL/MongoDB/Prisma/TypeORM/Drizzle/MikroORM/Sequelize/pgvector、Redis、Elasticsearch、MinIO/OSS、Passport/OAuth2/RBAC、支付宝/微信支付、Nginx、Docker/Compose/Helm、Next.js/TanStack Query、多租户/CQRS、微服务/gRPC、helmet/CSRF/CORS/限流/OWASP/加密。
  - **全库未规划的关键工具族（按教学价值排序）**：①测试与压测（Vitest/Jest/Supertest/Playwright/k6）②CI/CD 其余（Jenkins/GitLab CI/Argo CD/Terraform/Ansible）③代码质量（oxlint/ESLint/Prettier/Biome/Husky）④观测纵深（Grafana/OTel Collector/Jaeger/Sentry/Loki/Terminus）⑤文档 UI 与 codegen（RapiDoc/Stoplight/Apifox/YApi/Postman/openapi-typescript/orval）⑥身份协议（OIDC/Keycloak/Casdoor/CASL/2FA）⑦对象存储协议（S3 协议/对象存储概念）⑧搜索（OpenSearch/Meilisearch/Typesense）⑨任务调度（cron/Temporal）⑩架构（DDD/事件驱动/六边形）⑪支付（Stripe/银联）⑫网关（Traefik/Caddy/OpenResty）⑬云原生（Kubernetes 在标题级完全未点名）。
- **对报告结论的影响**：首轮「覆盖度 6.5 分」偏乐观——官方文档覆盖好，**生态工具覆盖中等偏弱**；建议按「新增 6–8 章 + 多处注入现章」处理（见 ECOSYSTEM-SWEEP.md 修复建议）。


### 9.7 决定记录：不涉及测试（2026-11-21 21:53）

- 用户决定（m00717）：「测试和压测好像不是我这个开发该关注的事情吧，目前暂时还是先不要涉及测试」。
- 处理：①从规划新增清单撤销测试/压测 2 章；②`ECOSYSTEM-SWEEP.md` 第 1 项标记「按用户决定不补」，修复建议总数由 292 → **290 章（+3：代码质量、Kubernetes、企业身份）**；③`part-00/001-开篇词.md` 把「这一期不写测试」改成明确的取舍说明（脚手架默认带 Vitest 与 `*.spec.ts`，去掉 `--skip-tests` 即有骨架，未来团队要求覆盖率时接口与业务代码不用改）。
- 保留的事实陈述（不入正文）：后端岗位 JD 与 CI 门禁通常要求测试能力，本书以「能交付、能上线」为主线，测试作为读者后续自补项；此口径已在 WRITER-BRIEF 覆盖度纪律相邻位置记录。
- 状态：290 章方案**待用户批准后执行**（届时需再跑一次 chapters.tsv/parts.tsv 重编号与 README 生成）。

### 9.8 结构重排执行记录（2026-11-22 13:5x）

- 用户决定（m01043）：取消 `part-NN` 目录 + 三位节号的平铺结构，改为「章」为阅读单元、章内节号 `NN.MM`；层级形态选「保留 4 部」。
- 结果：**287 节 → 264 节 / 21 章 / 4 部**。三个项目章做了合并（ch12 由旧 85–104 的 20 节并为 8 节；ch13 由 138–145 + 149–153 并为 10 节；ch14 由 161–167 + 172–177 + 184–191 并为 13 节），其余只做重排、不合并。旧节号 → 新节号全量映射在 `_meta/MAPPING.tsv`。
- 目录：`book/ch-NN-<章名>/NN.MM-<节标题>.md`；每章新增 `_chapter.md`（定位 / 知识地图 Mermaid / 验收清单 / 节清单 / 学时）；每节 H1 统一为 `# NN.MM 标题`，页脚改为「上一节 · 本章目录 · 下一节」。
- 脚本：新增 `_meta/restructure.mjs`（SPEC + `--dry-run` + 覆盖率断言，保证 1–287 每节恰好分配一次）；`build-structure.mjs`、`check-structure.mjs`、`validate-chapters.mjs`、`qa-report.mjs` 全部改用新表（`BOOK-OUTLINE.tsv` 10 列 + `chapters.tsv` 10 列）。
- 已写 63 节的 `第 N 章` 交叉引用改为 `第 X 章（NN.MM）`（280 处）；修复 055/059 两节缺 H1 的历史问题；旧 `part-*` 目录与 `_meta/parts.tsv` 已移除（`_part.md` 内容由章导读取代）。
- 验收：`check-structure` exit 0（4 部 / 21 章 / 264 节 / 已写 63 / 待写 201）；`validate-chapters` exit 0（63 节达标、平均 3,033 汉字、代码块 15.5、有图 1.00）；相对链接 388 条、断链 0；`build-structure` 二次运行无差异（幂等）；全库无 `part-NN` 目录引用（仅 04.03 上传分片的示例数据 `# part-01 6291456` 属内容）。
- 回滚点：git tag `pre-restructure`（提交 66d0078 的快照）。
