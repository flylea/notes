# Part 02 + Part 03 技术审查（29–53 章）

审计对象：`part-02/029-034`（容器化与进程管理，6 章）+ `part-03/035-053`（PostgreSQL、SQL 与 Prisma 8 数据层，19 章）。
审计方式：逐章通读；SQL 逐条核对 PostgreSQL 17 语义；Prisma 8 断言对照 `@prisma/orm-postgres@8.0.0-rc.24` / `@prisma/orm-family-sql` / `@prisma/orm-toolchain` tarball 里的 `.d.mts` 与官方随包 skill 文档；Docker/Compose/PM2/Nginx 对照官方文档；与 `example/` 逐文件交叉验证。只读审计，未改动章节与 example。

## 结论
1. **Prisma 8 的「骨架」是真的**：`prisma contract emit`、`// use prisma-8`、`postgres({contract,url})`、`definePrismaConfig + definePostgresConfig`、`db.orm.public.<Model>`、`.where({...}).first()`、`.forUpdate()/.forNoKeyUpdate()`、`fns.and/gte/lt`、`create/createAll/updateAll/deleteAll`、`db.transaction(fn)`、`tx.orm.*`、`SqlQueryError.sqlState` 在 rc.24 全部存在，ch43/45/46/47/49/50 抽查未发现编造的 API。**但版本配对已过时**：书中 `prisma@8.0.0-rc.29 + @prisma/orm-postgres@8.0.0-rc.21`，实测最新为 `rc.34 + rc.24`（2026-11-16），且 dist-tags `latest` 仍是 RC——8.0 尚未 GA，书中未交代这一点。
2. **硬错误集中在 5 处**（见 P0）：`conflictOn` 形状（应为数组）、「裸 `DateTime` 需要 Temporal」的因果、ch32 与 ch31 的镜像体积/构建时长自相矛盾、ch41 的 `tx.execute('SET TRANSACTION …')`、ch50 的 `poolOptions` 无 `max` 且默认超时不是无限。除此之外 SQL 语法（PG17）与 Docker/PM2/Nginx 指令没有发现跑不通的写法。
3. **可信度问题比事实错误更多**：ch35–042 全章标「命令未实测」，ch44/48 的 `contract emit`、`db init`、`migration plan` 输出树是手写的，未在任何环境跑过。SQL 抽查全部合法、对账数字也自洽，但**没有一行输出是可复现证据**，这是本 Part 最大的系统性风险（P1）。
4. **完整性缺口**（相对「数据层主线」应有）：迁移回滚/生产迁移策略的实操演练、备份恢复（pg_dump/PITR）、EXPLAIN 调优实战、`pg_stat_statements`、连接池上限的正确配法、RLS/扩展在契约里的表达；Docker 侧缺 compose `depends_on: condition: service_healthy` 落地、多环境 override、CI 构建流水线。其中一部分在后续 Part 已规划，需在 `_part.md` 明确标注「后续 Part 第 N 章」，否则读者会以为漏了。
5. **一致性（读者对照 example 会立刻发现）**：Redis 层（provider 参数、service 状态维护）、缓存 key/TTL（`meeting:` 前缀 + jitter + 60s vs example 内联 `stats:overview` + 30s）、health 目录结构、`src/bookings` vs `src/modules/bookings`、数据库/用户命名（`booking/booking_app` vs example `meeting_booking/meeting`）都不一致；ch32 还把 ch31 的成品镜像当「上一版」重做了一遍。

## P0
| 文件:行号 | 问题 | 证据 / 正确写法 |
| --- | --- | --- |
| part-03/045-Prisma8一对一映射与关联CRUD.md:200 | `conflictOn: { userId }` 形状错误，示例编译不过 | `@prisma/orm-family-sql@rc.24` `orm-client.d.mts:1236`：`readonly conflictOn?: readonly (keyof DefaultModelRow<…> & string)[]`；同文件 JSDoc L1709 `conflictOn: ['email']`。应写 `conflictOn: ['userId']` |
| part-03/045-Prisma8一对一映射与关联CRUD.md:99、266 | 「`DateTime` 会落到 `pg/timestamptz-temporal@1`，Node 22 没 Temporal，第一次读写就报 `RUNTIME.TEMPORAL_UNAVAILABLE`」——因果错误 | 裸 `DateTime` 默认 `as: jsDate` → `pg/timestamptz-date@1`，返回 JS `Date`，**不需要** Temporal（`@prisma/orm-postgres@rc.24` `authoring-BbS0bin5-U9tXyzS6.mjs:499-520`、`887-893` "bare DateTime becomes … read as a JavaScript Date (ADR 279)"；官方 skill `skills/prisma-8/references/contract.md:125` 只有 `*Temporal` 系列才要求 Temporal）。只有显式 `DateTime(as: temporal)` / `TimestamptzTemporal` 才会报那个错 |
| part-02/032-…md:3、7、23、122 ↔ part-02/031-…md:29、105 | 两章对同一镜像/同一次构建给出互相矛盾的数据：ch32 开篇「本地镜像 1.9GB、CI 一次九分钟」，ch31 已写「最终镜像约 220MB」「构建日志 24.1s + 9.8s」 | 031:29 `I["meeting-booking:1.0.0<br/>约 220MB"]`、031:105 `#9 DONE 24.1s`；032:3/23 `1.9GB`、032:122「从 1.9GB 掉到 210MB 左右」。要么把 ch31 的成品改成「未优化版」，要么把 ch32 的基线改成 ch31 的真实数字 |
| part-03/041-PostgreSQL的事务和隔离级别.md:335 | `tx.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')` 写法不成立 | `execute` 在 family-sql 运行时只接受 plan 对象（`execute(plan: SqlOrmPlan, options?)`），**没有接受 SQL 字符串的重载**；正确写法是 `tx.execute(tx.raw.sql\`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE\`.build())`，或升级到 rc.24 用 `db.transaction(fn, { isolationLevel })`（`postgres-members-F9CVSrrN-BFAuNPbW.d.mts:40-42`，`PostgresTransactionOptions { isolationLevel?, timeout? }` 见 `postgres-options-B0YrJID9-YkuL0Mao.d.mts:29-32`）。注意：书中固定的 **rc.21 的 `transaction(fn)` 确实没有第二参**，所以「没有隔离级别参数」在 rc.21 上成立，在 rc.24 上已过时 |
| part-03/050-在Nest里集成Prisma8.md:382、386 | ①「`poolOptions` 里……每个池配 20」无法落地；②「`connectionTimeoutMillis` 一定要设，默认是无限等」错误 | ① `PostgresPoolOptions` 只有 `connectionTimeoutMillis`、`idleTimeoutMillis` 两个字段（`postgres-options-B0YrJID9-YkuL0Mao.d.mts:9-12`），建池时也只透传这两个（`binding-DkfRsUZE-Co5ssUZw.mjs:235-241`），池上限是 `pg` 默认 10；要配最大连接数得传 `pg: new Pool({ max })`（`PostgresBindingOptions.pg?: Pool | Client`）或上 PgBouncer。② 运行时默认是 **20000ms**（同文件 L238 `?? 2e4`）；「无限等」是原生 `pg` 的默认 0，两者被混为一谈 |

## P1
### 过时写法 / 版本
- **版本配对全 Part 过时**（043:295-299、044:43-58、048 版本块、049 版本块）：书中固定在 `prisma@8.0.0-rc.29 + @prisma/orm-postgres@8.0.0-rc.21`，实测 npm `latest` 为 `8.0.0-rc.34`（2026-11-16）+ `8.0.0-rc.24`，且**仍是 RC 未 GA**（dist-tags：latest=rc.34 / next=rc.10 / prev=7.10.1）。应改版本表并补一句「8.0 尚为 RC，生产采用需评估」。
- 「orm-postgres rc.22 与 CLI rc.29 冲突」的**机制成立但示例过时**：`rc.22` 自带 toolchain rc.22，`prisma@rc.29` 需要 toolchain rc.21，两份 toolchain 并存确实会冲突；但现在正确配对是 `rc.34+rc.24`，ch44:63 拿 rc.22 制造冲突的演示已不是读者的现实场景，建议改为「不要手改版本，用 CLI 自带的 pairing」。
- `corepack prepare pnpm@11.2.2 --activate`（031:49）：pnpm 已 12.21.0，且 `corepack prepare` 在较新 Node/corepack 中已被弃用（改 `corepack use pnpm@x`）；Nest 12 脚手架默认 vitest + oxlint + ESM，本书声明「本期不引入测试」，但 ch31/32 的 Dockerfile 未提 `pnpm test/lint` 步骤与脚手架的 oxlint，读者会疑惑。
- `# syntax=docker/dockerfile:1.7`（031:43）：当前用 `docker/dockerfile:1`（1.x latest）更稳，1.7 偏旧但不算错。

### 该有未写 / 讲了但太浅
- **Prisma 8 CLI 输出全部未实测**（044:146-198、048 输出块）：「`✔ Emitted contract.json and contract.d.ts`」「`✔ Applied 2 operation(s) across 1 contract space` / `App space`」等文案在 CLI 二进制里检索不到，`prisma_contract.marker` 表名（044:182）也待核实。建议要么实测粘贴，要么统一标「示意」。
- **ch35–042 全章「命令未实测」**（035:19、036:36、037:17、038:9、039:20、040、042:19；041:18/383/419 标注最认真）：SQL 语法经逐条核对在 PG17 全部合法、对账数字自洽，但没有可复现输出来支撑「示例输出」；对一本要读者照着敲的书，这是可信度硬伤。
- **迁移「改坏了怎么办」没写**（048）：有 `migration new/plan/status/list/show/graph/log/check/ref` 命令表，但没有「plan 与库不一致 / 需回滚 / 生产先 dry-run」的完整演练；`--advance-ref`、`--marker-only` 只在命令表出现一次。生产迁移策略（锁表、分批 backfill、双写过渡）缺失。
- **备份恢复缺失**：整个 Part 没有 `pg_dump`/`pg_restore`/PITR/WAL 归档；作为「数据层」主线应有一节（可放后续 Part，但需在 `_part.md` 标注）。
- **EXPLAIN 实战偏浅**：037:284-298、038:168-173 只有单条 EXPLAIN 说明，缺 `EXPLAIN (ANALYZE, BUFFERS)` 读法、`pg_stat_statements`、索引选择性判断；038:168-173「正好用上 idx_user_roles_role」无证据。
- **Docker 工程化缺口**：compose 健康检查写法只在 example 里（`pg_isready`/`redis-cli ping`），ch30–32 正文没有讲 `depends_on: { condition: service_healthy }`；没有多环境 override（`docker-compose.override.yml`）、没有 CI（GitHub Actions + buildx `cache-from/cache-to`）落地示例、没有镜像瘦身后的验收清单（体积、层数、trivy）。
- **连接池上限的正确配法缺失**（050）：见 P0 第 5 条，且「副本数 × pool max」公式没有给出可执行的代码路径。
- **契约与 RLS/扩展**：042:480 说「视图、函数、存储过程、触发器、角色权限都不在契约里」——RLS/policy 在 rc.24 契约里是可表达的（`skills/prisma-8/references/contract.md` 的 policy 章节），应把「真不在契约里」与「可以进契约」分开说。

### 讲了但事实有偏
- 034:101「容器里别写 `max`，它读的是宿主机核数——容器看到的核数来自 cgroup」：PM2 用 `os.cpus().length`，Node 的 `os.cpus()` **不反映 cgroup CPU quota**（返回宿主机核数），所以前半句结论对、后半句解释错。
- 044/048/049 反复出现「example 验证过的组合」，把 example 的 pin 当作最佳实践，而 example 本身也是过时版本。

## P2
- **交叉引用错误**：053:111「第 13 章讲守卫」——`_meta/chapters.tsv` 中 013 是 `013-Metadata和Reflector.md`；17（Middleware）、18（Interceptor）正确。全 Part 未发现 `第 N 章` N>53 的悬空引用。
- **example 一致性**（逐文件核对）：
  - Redis provider：052 书中有 `connectTimeout: 3_000`、`retryStrategy`、`Logger.warn`，`example/src/redis/redis.provider.ts` 只有 `lazyConnect/maxRetriesPerRequest/enableOfflineQueue`。
  - Redis service：052 用 `on('ready')/on('close')` 维护 `available` 并批评「connect 成功后置 true」；`example/src/redis/redis.service.ts:36-44` 恰恰是后者，书中未注明 example 需同步改。
  - 缓存 key/TTL：052 的 `src/redis/cache-keys.ts`、`meeting:` 前缀、`jitter()`、TTL 60 在 example 中不存在；example 用内联 `'stats:overview'`、`OVERVIEW_CACHE_TTL=30`（`example/src/modules/stats/stats.service.ts:21-23、53`）。
  - 052 的 `getMany`（pipeline）、`incrementWithTtl`（Lua）、`booking-events.subscriber`（pub/sub）在 example 中没有，未标「教学扩展」。
  - 目录：034 用 `src/health/health.controller.ts`、`import { db } from '../db/prisma.js'`，example 是 health 在 `src/app.controller.ts`、数据库在 `src/database/prisma.ts`；040/043 用 `src/bookings/...`，example 是 `src/modules/bookings/...`。
  - 命名：035 的 `booking` 库 / `booking_app` 用户 vs example compose 的 `meeting_booking` / `meeting`。
- **示例输出格式**：051/052/053 用 `docker compose exec redis redis-cli` 执行，却输出交互式格式（`"available"`、`(integer) 1`、`1) "userId"`、`(integer) 60`）；非 TTY 下 redis-cli 输出是 raw。052:201 的 MONITOR 时间戳 `1700000000.101` 是 2023 年的时间，容易误读。
- **小事实**：030:255「Docker 28 支持 `--no-cache-filter`」——这是 BuildKit 能力，不属 Docker 28；032:102「BuildKit 是 Docker 的构建引擎，Docker 28 默认就开着」——Docker 23 起 Linux 默认启用；036:455「ILIKE 是 PG 独有」不严谨（MySQL 大小写取决于 collation）；039:156「`= ANY` 里有空值就整条不为真」不精确（命中即短路为真）；038:168-173 索引命中声称无证据；029:123 `psql(17.6)` 小版本待核。
- **可读性/口径**：035/036/037/038/039/040/042 只写「示例输出」不写「未实测」，041 区分了「已实测/未实测」，052/053 又都不标——全 Part 标注口径不统一，建议统一模板。
- 031:38 基线「Nest 12.3.x、pnpm 11」与实测 `@nestjs/core@12.6.0`、`pnpm@12.21.0` 有差；032 的镜像体积表（node:22 1.1GB / slim 200MB / alpine 130MB / distroless 80MB）中 distroless 偏低，待核。

## 逐章问题表
| 章 | 文件 | 主要问题 | 级别 |
| --- | --- | --- | --- |
| 029 | part-02/029-通过Desktop学Docker也太简单了.md | 全章标「未实测」；L62/L64 编造具体版本号；L123 psql 17.6 小版本待核 | P1/P2 |
| 030 | part-02/030-你的第一个Dockerfile.md | 整体正确（USER node、tini exec 形式、ENV/CMD 不增体积）；L255 `--no-cache-filter` 归因 Docker 28 错误 | P2 |
| 031 | part-02/031-Nest项目如何编写Dockerfile.md | 多阶段 4 段、HEALTHCHECK、non-root、.dockerignore 均正确；L49 corepack prepare + pnpm 11.2.2 过时；成品 220MB/24.1s 与 ch32 冲突 | P1 |
| 032 | part-02/032-提升Dockerfile水平的5个技巧.md | L3 与 ch31 数据自相矛盾；L35-82 复述 ch31 多阶段构建；L102 BuildKit 归因 Docker 28；体积表 distroless 待核 | P0/P2 |
| 033 | part-02/033-Docker是怎么实现的.md | namespace/cgroup/overlayfs/runc 主线准确；L62 用 `ipcs` 举例但 alpine 无该命令（需 util-linux） | P2 |
| 034 | part-02/034-为什么Node应用要用PM2来跑.md | 实测数据完整（L94/180-192）；L101 os.cpus() 与 cgroup 解释错误；`src/health`、`../db/prisma.js` 与 example 不一致 | P1/P2 |
| 035 | part-03/035-快速入门PostgreSQL.md | DDL/权限/seed 全合法；全章未实测；`booking/booking_app` 与 example 命名不一致；L210「覆盖索引」术语不严谨 | P1/P2 |
| 036 | part-03/036-SQL查询语句的所有语法和函数PostgreSQL版.md | SQL 全合法（窗口、FILTER、jsonb_agg、MERGE PG15+）；全章未实测；L455 ILIKE 表述不严谨 | P1/P2 |
| 037 | part-03/037-一对一、JOIN查询与级联.md | JOIN/LATERAL/级联动作正确；EXPLAIN 示例浅；L17 未实测 | P2 |
| 038 | part-03/038-一对多、多对多的表设计.md | 设计论证好（连接表、快照价、部分索引）；L168-173 索引命中无证据；表数与 example 只有 3 个 model 不符 | P1/P2 |
| 039 | part-03/039-子查询和EXISTS.md | 语义正确；L156 `= ANY` 与 NULL 表述不精确；L324-330 计划与查询不完全对应 | P2 |
| 040 | part-03/040-SQL综合练习.md | 十道题 SQL 全对、对账数字自洽；路径 `src/bookings` 与 example 不一致 | P2 |
| 041 | part-03/041-PostgreSQL的事务和隔离级别.md | 隔离级别/MVCC/写偏斜/SSI/行锁/EXCLUDE 均正确且标注最认真；**L335 `tx.execute('SET TRANSACTION …')` 不成立**；「无隔离级别参数」在 rc.24 已过时 | P0/P1 |
| 042 | part-03/042-PostgreSQL的视图、存储过程和函数.md | 视图/物化视图/PL-pgSQL/触发器/SECURITY DEFINER 全对；L480「都不在契约里」不准确（RLS 可进契约） | P2 |
| 043 | part-03/043-使用Node操作PostgreSQL的两种方式.md | pg 池/事务/SQLSTATE 正确；`fns.gte`/`forUpdate`/`SqlQueryError.sqlState` 实测存在；版本 rc.29/rc.21 过时；L402 COPY 快一个量级无依据 | P1/P2 |
| 044 | part-03/044-快速掌握Prisma8.md | contract-first 主线正确、definePrismaConfig 签名正确；**版本表与 rc.22 冲突演示过时**；CLI 输出文案检索不到、marker 表名待核 | P1 |
| 045 | part-03/045-Prisma8一对一映射与关联CRUD.md | 错误码/PSL 消息引用准确；**conflictOn 应为数组**、**DateTime 与 Temporal 因果错误** | P0 |
| 046 | part-03/046-Prisma8一对多映射与关联CRUD.md | 关系谓词 `.some()`、include 精化、createAll、聚合均实测存在，质量高 | P2 |
| 047 | part-03/047-Prisma8多对多映射与关联CRUD.md | 隐式 M2M 被拒、必须显式连接模型，与官方 skill 一致；复合 PK/payload 建议正确 | P2 |
| 048 | part-03/048-Prisma8常用命令与迁移工作流.md | 命令/flag/错误码/目录结构全部实测存在，`PLAN_ORIGIN_UNKNOWN` 原文一致；版本块过时；输出未实测；缺回滚演练 | P1 |
| 049 | part-03/049-Prisma8知识点查缺补漏.md | 与 example 的索引/反向关系差异核对准确；版本块过时；`where({})` 空条件与「db 读会跑进 tx」待核实 | P1 |
| 050 | part-03/050-在Nest里集成Prisma8.md | middleware/生命周期/健康检查/close 语义全部正确；**poolOptions 无 max**、**connectionTimeoutMillis 默认 20s** | P0 |
| 051 | part-03/051-快速入门Redis.md | Redis 8 模块、持久化、TTL、淘汰策略全对；只不标未实测；redis-cli 输出格式 | P2 |
| 052 | part-03/052-在Nest里操作Redis.md | ioredis 6 API 全对（named export、status、五个选项）；与 example 三处不一致（provider/service/cache-keys+TTL） | P1/P2 |
| 053 | part-03/053-为什么推荐ioredis而不是cache-manager操作Redis.md | 选型论证好、边界清单准确；L111 交叉引用「第 13 章守卫」错误；未标版本（@nestjs/cache-manager 12.0.5 / cache-manager 7.2.9）；漏 v7 多 store 与 wrap/mget | P2 |

### 外部核实记录

- prisma dist-tags：latest = **8.0.0-rc.34**（2026-11-16T17:14Z）；next=8.0.0-rc.10；prev=7.10.1。仍是 RC，未 GA。
- @prisma/orm-postgres latest = **8.0.0-rc.24**（2026-11-16T16:44Z）。
- 配对关系（解包 package.json）：`prisma@8.0.0-rc.34` → `@prisma/orm-toolchain@8.0.0-rc.24`；`@prisma/orm-postgres@8.0.0-rc.24` → 自身依赖 `orm-toolchain@8.0.0-rc.24`（+ orm-framework/family-sql/target-postgres 全部 rc.24）。**当前正确配对是 rc.34 + rc.24**。
- 书中 rc.29 + rc.21 的配对在 rc.29 发布时是自洽的：`prisma@8.0.0-rc.29` → `orm-toolchain@8.0.0-rc.21`，`orm-postgres@rc.21` → 同为 rc.21。
- 「orm-postgres rc.22 会与 CLI rc.29 冲突」成立：`orm-postgres@rc.22` → `orm-toolchain@rc.22`，而 `prisma@rc.29` → `orm-toolchain@rc.21`，两份 toolchain 并存即版本错配。但该说法**已过时**（当前应为 rc.34+rc.24）。
- `prisma contract` 子命令实测存在：`contract emit|infer|format|print|operations|changes`；迁移命令为 `db init|migrate|schema|update|verify` 与 `migration new|plan|status|list|show|graph|log|check|ref`；**没有** `prisma migrate dev/deploy/seed`、也没有 `prisma db seed`（`db seed` 只在 scaffold 生成的 package.json script 里作为 npm script 名出现）。
- `@prisma/orm-postgres` README（rc.24）确认入口：`/runtime` → `postgres(url)`（实为 `postgres({contract,url})`）、`/config` → **`defineConfig`**（不是 `definePrismaConfig`）、`/static` → `contractFromJson`、`/contract-builder` → `defineContract`；`temporal-polyfill` 是 required peer dep。
- `prisma/config` 导出 **`definePrismaConfig`**（re-export 自 @prisma/cli-engine，`definePrismaConfig<T extends Record<string,unknown>>(config: T): T & {...}`），example/prisma.config.ts 的写法成立。
- orm-framework config 类型确认 `db.connection`（Postgres 为连接串）、`migrations.dir`、`output` 字段。
- orm-postgres runtime 源码确认 `postgres({ contract, url })`，返回对象含 `sql/raw/enums/nativeEnums/toSql/context/contract/stack/connect/close/[Symbol.asyncDispose]`；源码 JSDoc 示例为 `contractFromJson<Contract>(contractJson)` + `import type { Contract } from './contract.d'`。
- 版本面：@nestjs/core latest **12.6.0**；pm2 latest **7.1.2**（2026-11-03）；ioredis latest **6.0.0**；node-redis latest **6.3.1**；typescript latest **7.0.2**（2026-07-08）；pnpm latest **12.21.0**；prisma CLI engines 要求 node ^22.18 || ^24.11 || >=26。
- chapter 029–034 与 035–036 已读（见下方草稿行号记录）。

### 第 029 章（part-02/029-通过Desktop学Docker也太简单了.md）

- L7：整章声明「示例输出，未实测」——对 Docker 基础章可接受，但 L62 输出 `Client Version 28.5.1` 与 L64 `Docker Desktop 4.49.0` 是编造的具体版本号，应标「版本号为示例」或改为真实拉到的版本。
- L108：`postgres:17` 镜像标签建议对；L123 示例输出 `psql (17.6)` 与当前 PG 17 最新小版本可能不符（待核实）。
- L177-179：命名卷/匿名卷、`docker rm -v` 的说明正确；`docker compose down -v` 会删命名卷亦正确。
- L221：`host.docker.internal` + Linux `--add-host` 正确。
- L245：Apple Silicon `--platform linux/amd64` 建议正确。

### 第 030 章（part-02/030-你的第一个Dockerfile.md）

- L104 `FROM node:22-alpine`、L118 `USER node`、L120-121 tini exec 形式：技术正确。
- L174：「`docker history` 里真正占空间的是 FROM 和 RUN apk add；ENV/CMD/EXPOSE 几乎不增加体积」——正确。
- L255：「Docker 28 还支持 `--no-cache-filter=<stage>`」——该选项由 BuildKit 提供（docker buildx/BuildKit 0.11+），并非 Docker 28 专属；且普通 `docker build` 需 BuildKit。表述可更准确（P2）。
- L281：「ARG/ENV 都会留在镜像元数据里」——ARG 会出现在 `docker history` 的构建命令中，属实。
- L297：`sharp`/`bcrypt` Alpine 需注意 musl，正确。

### 第 031 章（part-02/031-Nest项目如何编写Dockerfile.md）

- L38：「Nest 12.3.x、Node 22、ESM、pnpm 11、PostgreSQL 17 + Prisma 8」——@nestjs/core 最新已 **12.6.0**（2026-11-21 npm），且 example/package.json 用 `^12.3.3`（会解析到 12.6）；「12.3.x」作为基线已过时（P2）。
- L43 `# syntax=docker/dockerfile:1.7`：语法指令本身有效，但 1.7 是较旧前端版本（当前 dockerfile frontend 已到 1.1x）；非错误（P2）。
- L49 `corepack prepare pnpm@11.2.2 --activate`：pnpm 最新 **12.21.0**；且 `corepack prepare` 在 Corepack 新版本中被标记弃用，推荐 `corepack use pnpm@x`/`packageManager` 字段（P1，过时写法）。
- L76-77 HEALTHCHECK 用 `wget` 访问 `127.0.0.1:3000/api/health`：node:22-alpine 内有 busybox wget，可跑；但与 example 的全局前缀/健康路由需核对（P2）。
- L220-226：Prisma 8 契约产物说明与真实包一致：`prisma contract emit` 生成 `contract.json` + `contract.d.ts`（解包 toolchain 确认）；`dist` 复制 JSON 需 `resolveJsonModule`，属实。
- L224：「别在 CMD 里塞 `prisma db migrate`」——Prisma 8 CLI 命令确为 `db migrate`（实测 `db migrate` 存在），说法成立。
- 与 example 不一致：L172 连接串用 `postgresql://...`，example `.env.example` 待核对；L184 日志称 AppController 打 health，example 的 health 在 app.controller.ts（待核）。

### 第 032 章（part-02/032-提升Dockerfile水平的5个技巧.md）

- **L3 与第 31 章矛盾（P0/P1）**：L3 说「上一章的镜像已经能跑起来……本地那个 `meeting-booking:1.0.0` 有 1.9GB」「CI 构建一次九分钟」，而第 31 章已经做完多阶段构建，L29 称最终镜像「约 220MB」、L104 构建日志 deps 24.1s + build 9.8s。第 32 章把「多阶段」当成新技巧（L35-82）复述第 31 章内容，章节定位重复且开篇数据自相矛盾。
- L102：「BuildKit 是 Docker 的构建引擎，Docker 28 默认就开着」——BuildKit 自 Docker 23 起默认（Linux 上 23.0），非 28 才默认；表述过时/不准确（P2）。
- L150 `distroless/nodejs22` 体积「80MB」——gcr.io/distroless/nodejs22-debian12 约 100MB+（待核实，P2）。
- L170：「Prisma 8 的 contract 运行时以 JS 为主，但 CLI 和迁移工具仍可能带原生依赖」——rc.24 的 orm-postgres 依赖 `pg`（纯 JS）+ 无引擎二进制，Prisma 7 时代的 query engine 已被移除；该句「可能带原生依赖」缺乏依据（P2）。

### 第 033 章（part-02/033-Docker是怎么实现的.md）

- 技术主线（namespace/cgroup/overlayfs/runc/shim）准确。
- L62 `ipcs` 在 alpine 需 util-linux（busybox 无 ipcs），实测会 command not found（P2，建议改 `ipcs` 前注明需装 util-linux）。
- L124：`--memory-swap` 语义正确（设为与 memory 相等即禁 swap）。
- L228 `docker info --format '{{.Driver}} / {{.CgroupVersion}} / {{.KernelVersion}}'`：字段存在，但 `.CgroupVersion` 在旧版本为 `""`；可接受。
- L233 输出 `6.10.14-linuxkit` 为具体版本示例，标了未实测，OK。

### 第 034 章（part-02/034-为什么Node应用要用PM2来跑.md）

- L94 标注「实测，PM2 7.1.2 + Node 26」——与仓库基线 Node 22 不一致（Node 26 是当前 latest? 需核实 Node 版本策略），但作为实测说明可接受；PM2 7.1.2 与 npm latest 一致。
- L101：「容器里别写 max，它读的是宿主机核数——容器看到的核数来自 cgroup」——前半句对（PM2 用 os.cpus()，容器内返回宿主核数），后半句错：`os.cpus()` 不读 cgroup quota；Node 直到 v20+ 也未让 os.cpus() 反映 cgroup CPU 限制（P2 事实错误）。
- L224：`import { db } from '../db/prisma.js'` 与 example 实际路径 `src/database/prisma.ts` 不一致；L119-128 的 `src/health/health.controller.ts` 在 example 中不存在（health 在 `src/app.controller.ts`）（P2 一致性）。
- L180-192 reload/restart 实测数据完整，质量高；L253 logrotate 版本 3.0.0 标注清楚。
- L272 示例输出 `Successfully saved in /tmp/pm2-home/dump.pm2` 与正文「写进 ~/.pm2/dump.pm2」不一致（示例用了 PM2_HOME=/tmp），已注明「路径随 PM2_HOME 变」，可接受但易误读（P2）。

### 第 035 章（part-03/035-快速入门PostgreSQL.md）

- L19：「下面所有输出都是示例输出，命令未实测。写作环境里没有真的跑起 PostgreSQL 17」——整章 SQL 未实测；而 Docker 起 PG 17 成本极低，属于可避免的「未实测」（P1 深度/可信度）。
- SQL 正确性：建表/约束/索引/GRANT/INSERT...SELECT/VALUES JOIN 均合法；L166 `gen_random_uuid()` 在 PG 13+ 内置（pgcrypto 不再必需），正确。
- L206：「uuid 代价是 16 字节」正确；L207 timestamptz 说明正确；L208 CHECK 三值逻辑正确。
- L210：「复合索引只能从最左列开始用……第三列 end_time 帮不上过滤，它的价值是让『只取这三列』的查询走覆盖索引」——PG 无「覆盖索引」术语，应为 index-only scan（还需 visibility map）；表述可更准确（P2）。
- L240-247：`\c booking` 后 SHOW timezone 输出正确。
- L256-262：seed 用户 id 形如 `11111111-1111-4111-8111-...` 合法 v4 UUID；L278 `v.id::uuid` 合法。
- L280-293：14 条预订数据与第 36/40 章统计口径需交叉核对（L301 声称 14 条）。
- L367 连接串 `?sslmode=disable`；L370 说明正确。
- L424：pg `numeric` 返回 string 正确。
- L430：引用 example 路径 `src/modules/bookings/bookings.service.ts` 与实际一致（已核）。
- L432：「等第 45 章接入 Prisma，这些 SQL 会被 `db.orm.public.Room` 取代」——需核对第 45 章是否用 `db.orm.public.*`；Prisma 8 API 确为 `db.orm.<schema>.<Model>`（待第 44/45 章核）。
- L438：`bigint GENERATED ALWAYS AS IDENTITY` 正确。
- 与 example 差异：chapter 用 database `booking`/用户 `booking_app`，example compose 用 `meeting_booking`/`meeting`——教程正文与参考实现两套命名并存，需说明（P2）。

### 第 036 章（part-03/036-SQL查询语句的所有语法和函数PostgreSQL版.md）

- L36：「下面的结果都是示例输出，命令未实测」——同 035，整章 SQL 未实测（P1）。
- SQL 正确性抽查：L144-156 generate_series + LEFT JOIN + ON 条件：合法；L180-194 FILTER + coalesce + round：合法，但 `round(numeric, 1)` 需要 numeric；`extract(epoch ...)` 返回 numeric（PG 14+ extract 返回 numeric），除法 3600 得 numeric，round 可跑。**注意**：`coalesce(round(...), 0)` 中 `0` 是 integer，numeric 与 integer 可隐式转换，OK。
- L299-313 窗口 Top-N：合法。L339-346 lag：合法。L362-372 `sum(count(*)) OVER (...)` + GROUP BY 1：合法。
- L393-410 jsonb_agg + FILTER + coalesce：合法；`jsonb_agg(... ORDER BY ...)` 合法。
- L477-491 `(xmax = 0) AS inserted`：合法技巧，L508 已说明实现细节。
- L512：「`MERGE`（PG 15+）」正确。
- L100：「别用 BETWEEN，它对 timestamptz 是闭区间」——正确（BETWEEN 等价 >= AND <=）。
- L246：「GROUP BY u.id 就够了……PG 知道其余列函数依赖于它」——正确（PG 9.1+ 函数依赖）。
- L434：「GIN 索引用 `jsonb_path_ops`，适合包含查询，不适合范围扫描」——正确。
- L472：「`FOREIGN KEY` 不会自动建索引（PG 与 MySQL 的又一处差异）」——正确。
- L455：「ILIKE 是 PG 独有（MySQL 默认排序规则不区分大小写）」——正确但不完整：MySQL 也有 `LIKE` 大小写敏感取决于 collation；「PG 独有」不严谨（P2）。
- L259 `format('%s / %s 人', r.name, r.capacity)`：`format` 的 `%s` 可接受 int，正确。
- 交叉引用：L531「下一章」正常；全 Part 无 >53 章悬空引用（机械检查通过）。

### 第 037 章（part-03/037-一对一、JOIN查询与级联.md）

- L17「下面的输出都是示例输出，命令未实测——写作环境没连 PostgreSQL 17」——同 035/036，整章 SQL 未实测（P1 系统性问题）。
- 技术准确：L29-37 共享主键一对一（room_id PRIMARY KEY REFERENCES rooms ON DELETE CASCADE）正确；L43 独立主键+UNIQUE 提醒正确；L81 一对一 LEFT JOIN 不放大行数正确；L83 `WHERE d.area_sqm <> 20` NULL 三值逻辑正确；L93-95 报错文本 `duplicate key value violates unique constraint "room_details_pkey"` 正确。
- L103-119：`numeric` 返回字符串、`string | null` 类型建议正确；L106 `area_sqm: string | null` 正确。
- L129-137：JOIN 类型 mermaid 表述正确（FULL 保留 5 行、CROSS 20 行）。L150 Nested Loop/Hash/Merge 说明正确。
- L168 `session_replication_role = replica` 能绕过外键（PG 中 FK 由触发器实现）正确；L184 ×N 说明正确。
- L191-213 LEFT JOIN LATERAL + ON true 正确；L215 与窗口函数对比正确。
- L247-251 删陈默后 bookings_left=10（14-4）与第 35 章数据一致（陈默 b1/b4/b8/b14 共 4 条）。
- L263 RESTRICT vs NO ACTION 时机说明正确；L267 ON UPDATE CASCADE 正确；L269 TRUNCATE CASCADE 正确。
- L284-292 EXPLAIN 示例可信（Nested Loop Left Join + room_details_pkey Index Scan，loops=4；估算 rows=2 与实际 4 的差异归因统计信息未 ANALYZE，正确）。
- 唯一小问题：L102/L109 代码路径 `src/rooms/room-detail.repository.ts` 与 example 的 `src/modules/rooms/…` 目录结构不一致（P2，与 034/040 同类）。

### 第 038 章（part-03/038-一对多、多对多的表设计.md）

- L9 只说「示例输出」，未声明是否实测（标注不统一，P2）。
- 技术准确：L102-118 roles/user_roles 建表正确（小表 `smallint GENERATED ALWAYS AS IDENTITY` 合法；复合主键 + role_id 反向索引，最左前缀说明 L122 正确）；L124 SET NULL 语义正确；L146-151 `array_agg(ro.code ORDER BY ro.id)` + `GROUP BY u.id, u.name` + `ORDER BY u.email` 在 PG 下合法（u.id 为主键，函数依赖）。
- L163「LEFT JOIN 后数组会得到 {NULL}」正确。
- **L168-173 有一处过度声称**：「反方向查每个身份有几个人，正好用上 idx_user_roles_role」——但查询是 `FROM roles LEFT JOIN user_roles`，roles 仅 4 行，规划器极可能整表扫描 user_roles（14 行级别），不会用该索引；「正好用上」无 EXPLAIN 证据（P2）。
- L210-229 `unnest($2::smallint[])` + ON CONFLICT DO NOTHING 的 TS 事务代码正确；L218 参数顺序 `[userId, roleIds, grantedBy]` 与 SQL `$1,$2,$3` 对应正确。
- L245-251 booking_services 快照价 + CHECK 正确；L276-292 汇总 450/120/300=870 与第 40 章 L460「服务收入 870.00」一致；L305-306 现价 18×30=540 正确。
- L326-385 ER 图与 8 张表一致；L402 物化视图 CONCURRENTLY 需唯一索引 + 默认锁整视图，正确。
- L406 索引成对规则正确；L411-416 部分索引 `WHERE status IN (...)` 正确；L416 `CREATE INDEX CONCURRENTLY` 失败留 INVALID 索引正确；L418 `pg_stat_user_indexes.idx_scan = 0` 正确。
- **结构性问题（与 example 对照）**：本章/37/35 章建立的 8 张表（room_details、roles、user_roles、services、booking_services）在 `example/prisma/contract.prisma`（仅 User/Room/Booking 三个 model，L7-53）里没有对应模型；教程 SQL 层与参考实现的数据模型不一致，且 chapters 44+ 的 Prisma 章节若只映射 3 个模型，则第 38 章的多对多设计在 example 中无落点（P1/P2，需在第 44/48 章核）。

### 第 039 章（part-03/039-子查询和EXISTS.md）

- L20 仅「示例输出」，未标未实测（P2 标注不统一）。
- 技术准确：L29 标量子查询多行报错正确；L36 报错文本正确；L64 空集 count=0 说明正确；L78 SubPlan 成本解释正确；L116 LEFT JOIN 变 Hash Right Join 正确；L156 空集 ANY 假/ALL 真（vacuous truth）正确。
- **L156 有一处不精确**：「`x = ANY (集合)` 里只要有一个空值参与比较，整条就不为真」——`1 = ANY (ARRAY[1,NULL])` 为 true（命中即短路为真）；只有「无任何元素匹配且集合含 NULL」时才为 unknown。表述应修正（P2）。
- L174 `NOT IN (SELECT granted_by …)` 遇 NULL 返回 0 行正确；L176 hashed SubPlan 说明正确。
- L225-232 Hash Anti Join 计划示例合理；L234「NOT IN 在可空列上通常保留子计划」正确。
- L276-284 cancel_pct 数据核对一致（A302 25.0、B201 50.0、C101 空）；L289 `::numeric` 避免整数除法正确。
- L291 CTE PG12+ 单次引用默认内联、MATERIALIZED 扩展正确；L293 `WITH RECURSIVE` 存在正确。
- L324-330 LATERAL 计划示例中 `Index Only Scan Backward using idx_bookings_room_time` 与索引 (room_id,start_time,end_time) 一致，但前提是 SELECT 只取索引内列；第 37 章 L189 的 LATERAL 查询还 select 了 `status`（不在该索引中），严格说应回表、不会是 Index Only Scan——示例与上文查询不完全对应（P2）。

### 第 040 章（part-03/040-SQL综合练习.md）

- L9 仅「示例输出」，未标未实测（P2）。
- 数据自洽性核对全部通过：L67-74 空档 10:30/11:00/11:30；L103-109 b7/b8 占用；L134-142 周报 A301 5h/12.5%、A302 3 条 4h、B202 4h、B201 1h、C101 0；L169-177 取消率 周雨 33.3、陈默 25.0；L203-209 Top3 A301 5.0/A302 4.0/B202 4.0；L277-281 C101 唯一从未被订；L317-325 周四 16 格、B202 12 格；L348-353 服务收入 B202 750、A302 120；L395-399 重叠 1 对；L460 四个对账数（有效预订 11、总时长 14h、服务收入 870、冲突 1 对）与明细一致。
- L302-310 `count(*) FILTER (WHERE NOT EXISTS (…))` 语法合法（FILTER 接受含子查询的布尔表达式）。
- L387 自连接 `a.id < b.id` 去重正确（uuid 支持 `<`）。
- L424-441 TS 代码 `pool.query` 返回 `rows.map(r => r.slot_start as Date)`：pg 对 timestamptz 返回 JS Date，正确。
- **与 example 不一致（P2）**：代码路径 `src/bookings/dto/availability-query.dto.ts`、`src/bookings/bookings.repository.ts` 与 example 的 `src/modules/bookings/…` 目录不同；且 example 未采用原生 `pg` 查询层（用 Prisma 8），本章「Repository 用 pool」在 example 中无对应实现。

### 第 041 章（part-03/041-PostgreSQL的事务和隔离级别.md）

- L18 标注清晰（示例输出 + 双会话 transcript 标注），是 Part 03 里标注最认真的一章。
- 技术准确：L182-189 隔离级别表正确（PG 的 READ UNCOMMITTED 等同 RC；RR 防幻读；Serializable=SSI + 40001）；L204-208 MVCC/xmin/xmax/ctid/VACUUM/long transaction 说明正确；L208 `idle_in_transaction_session_timeout` 正确；L226-232 RR 并发更新报 40001 正确。
- L244 写偏斜（write skew）解释正确；L248-254 SSI + 重试幂等说明正确；L256 RR 下 FOR UPDATE 后普通 SELECT 仍用旧快照——正确（重要且少见的好细节）。
- L286-293 行锁四模式与 KEY SHARE 冲突矩阵正确；L295 外键检查自动加 KEY SHARE、FOR UPDATE 冲突导致排队正确。
- L299 `pg_advisory_xact_lock(hashtextextended($1,0))` 正确。
- **L303-333 Prisma 8 代码需外部核验**：`db.transaction(async (tx) => …)`、`tx.orm.public.Room.where({id}).forNoKeyUpdate().first()`、`tx.orm.public.Booking.where((row,{fns}) => fns.and(...)).first()`、`.create({...})`——`forNoKeyUpdate()`/`fns`/回调式 where/`.first()` 是否在 rc.24 中存在待核实（P0 候选，正在查包）。
- L335「Prisma 8 的 db.transaction 没有隔离级别参数，用 tx.execute 执行 SET TRANSACTION ISOLATION LEVEL」——`tx.execute` 与「无隔离级参数」待核实（P0 候选）。
- L343-357 EXCLUDE USING gist + `WHERE (status IN (...))` 部分排他约束：语法需核（PG 官方文档确认 EXCLUDE 支持 WHERE 谓词）；L346 `CREATE EXTENSION btree_gist` 正确；L360 `tstzrange(start_time,end_time,'[)')` 正确。L383 已诚实标注「未在真实 PG 17 实测」——可接受。
- L372-375 报错文本、L377 错误码 23P01 正确；L379 EXCLUDE 不支持 ADD CONSTRAINT USING INDEX 正确。
- L387 deadlock_timeout 默认 1s 正确；L397-398 DETAIL 文本格式与 PG 实际输出一致；L419 已标注双会话未实测。
- L408-414 pg_stat_activity / pg_blocking_pids 查询正确；L417 三个超时（lock_timeout/statement_timeout/idle_in_transaction_session_timeout）正确。
- 小问题：L88-94「第二条失败后整个事务 aborted」正确，但未给 `SAVEPOINT` 之外的恢复路径；L94 提到 release 不会回滚——正确且重要。

### 第 042 章 part-03/042-PostgreSQL的视图、存储过程和函数.md
- L19 标注「示例输出」未标未实测（与 35/36/37 章标注不统一，P2）。
- SQL 抽查正确：L41-58 视图（LEFT JOIN 条件写在 ON 里，L61 解释正确）、L95-110 物化视图 WITH NO DATA + 唯一索引 + REFRESH、L118-121 两种刷新锁差异与「CONCURRENTLY 不能在事务块内」正确、L126-130 pg_cron、L140-159 SQL 函数 least/greatest 裁剪 + STABLE 论证正确、L195-243 book_room PL/pgSQL（PERFORM ... FOR UPDATE 锁 rooms、IF NOT FOUND、RAISE ... USING ERRCODE/HINT）、L278-282 SQLSTATE 22023/P0002/23P01 映射正确、L304-322 存储过程 GET DIAGNOSTICS ROW_COUNT + COMMIT 语义（L341）正确、L350-376 触发器 AFTER UPDATE OF status + IS DISTINCT FROM 正确、L399-401 只授视图、L418 PG15 security_invoker 正确、L423-441 SECURITY DEFINER + REVOKE ... FROM PUBLIC + search_path=public,pg_temp 正确。
- L286-295 `ALTER TABLE ... ADD CONSTRAINT ... EXCLUDE USING gist (...) WHERE (status IN (...))` 可用（PG 支持部分排他约束，配合 btree_gist）；表述无问题。
- **P2** L480「视图、函数、存储过程、触发器、角色权限都不在契约里」：RLS/policy 其实可在 contract 里表达（Prisma 8 `@@rls` + `policy_select` 等，见 @prisma/orm-postgres rc.24 skills/prisma-8/references/contract.md L430/L461/L509）；视图/函数/触发器/角色授权确实不在契约里，需走迁移 rawSql。

### 第 043 章 part-03/043-使用Node操作PostgreSQL的两种方式.md
- pg 部分正确：L47-55 Pool 参数（max/idleTimeoutMillis 10s/connectionTimeoutMillis 默认 0/statement_timeout 57014/query_timeout/application_name）、L99 pool.on('error') 必要性、L161 rowCount number|null、L167 pool.query('BEGIN') 错误论证、L171-192 withTransaction + release 在 finally、L218 release(error) 销毁连接、L222-252 SQLSTATE 映射、L268-282 40001/40P01 重试、L285 25P02 正确。
- **P1 过时** L295-299、L45-51（第 44 章同样）固定 prisma@8.0.0-rc.29 + @prisma/orm-postgres@8.0.0-rc.21；实测最新 dist-tags：prisma 8.0.0-rc.34（2026-11-16）、orm-postgres 8.0.0-rc.24（2026-11-16）。正确配对现为 rc.34+rc.24（rc.34→orm-toolchain rc.24；orm-postgres rc.24→全 rc.24）。书中「rc.22 与 CLI rc.29 冲突」在发布时成立（rc.22→toolchain rc.22 vs CLI rc.29→toolchain rc.21），但已过时。
- Prisma 8 用法核对（@prisma/orm-postgres rc.24 实测）：L304-305 两个 import 与 example/prisma.config.ts 完全一致；L307-314 definePrismaConfig({ orm: definePostgresConfig({...}) }) 一致；L317-329 contract 首行 + Room model 一致；L332-333 `prisma contract emit`/`db init` 命令存在；L340-343 `postgres`/`contractFromJson` 来自正确入口；L360-363 `.where((room,{fns}) => fns.gte(...))` — fns.gte 存在（orm-family-sql rc.24 expression d.mts:34，签名 `gte(a,b)`）；L370 `.where({id}).forUpdate().first()` 存在（orm-client.d.mts forUpdate/forNoKeyUpdate/forShare/forKeyShare，需 capabilities `sql.forUpdate`+`sql.lockOf`；example contract.json 已含）；L375-380 create 用模型字段名正确。
- **P2** L384 错误形态：`SqlQueryError` 确有 `sqlState`（orm-family-sql rc.24 errors.d.mts:9-12），但包还导出 `isUniqueConstraintViolation` 与 `UNIQUE_VIOLATION_SQLSTATE`（同文件 L65），书中手写类型守卫可简化；且 `SqlQueryError.is(error)` 静态守卫存在。
- P2 L402「COPY FROM STDIN 比 ORM 快一个量级」未给依据；P2 L412 PgBouncer transaction pooling 与命名 prepared statement 说明正确。

### 第 044 章 part-03/044-快速掌握Prisma8.md
- 事实主线正确：contract-first、emit 两产物提交、无 PrismaClient/引擎、db init/db update/migration plan/db migrate 分工（L168-198）与官方 skill 文档一致。
- **P1 过时**：L43-58 版本表与「^/~ 会升到 rc.22 冲突」；L49/L55 rc.29、L50/L54 rc.21、L89/L93 同；L63 rc.22 冲突现场示例已过时（见上）。
- **P1 未实测/编造输出**：L153 emit 输出 `✔ Emitted contract.json and contract.d.ts`、L175-180 db init 输出 `✔ Applied 2 operation(s) across 1 contract space / App space / ├─ Create table "rooms"` — 在 rc.24/rc.34 的 cli-engine、orm-toolchain dist 中未检索到这些字符串（仅 CONFIG_UNKNOWN_SECTION 命中），标注为「示例输出」却写成确定形态，需实测或改成描述性文字。
- L182 声称 `prisma_contract.marker` 表 —— 未在已解包包中检索到该表名（待核实；marker 机制真实存在）。
- L117「顶层只能有 composer、orm、skills 三个 section」+ `[CLI.CONFIG_UNKNOWN_SECTION]` — 错误码字符串在 cli-engine dist 中存在，三 section 说法待核对（可能漏 composer 之外的 section）。
- L166 `--output-path` 正确（旧文档 --out 弃用）；L142 `// use prisma-8` 首行必要性说明正确。

### 第 045 章 part-03/045-Prisma8一对一映射与关联CRUD.md
- 错误码核对全部准确：`PSL_NON_UNIQUE_BACKRELATION`（orm-family-sql rc.24 interpreter-CVd521dx-PDiCxDLC.mjs:467，实际消息与书中引文几乎一致）、`PSL_GENERATOR_IN_DEFAULT`（psl-field-resolution-GN4iup8d-BSjTCYks.mjs:533，消息为 `${subject}: ${call} is a value the client generates, and @default sets a database default only. Write @onCreate(${call}) instead.`，书中一致）、`RUNTIME.TEMPORAL_UNAVAILABLE`（target-postgres rc.24 errors-C4-Dp3gI-B5jY5eJj.mjs:38 存在）。
- `temporal.UpdatedAtString` 有效：contract-builder-Drywaj7K.mjs:763 规范键 `temporal.updatedAtString` → 写入 `pg/timestamptz-string@1` + onUpdate(now())，与书中「负责刷新 updated_at、读写 ISO 字符串」一致；`TimestamptzString` → `pg/timestamptz-string@1` 也是字符串类型，正确。
- **P0**：`Profile.upsert({ create, update, conflictOn: { userId } })` 的 `conflictOn` 形状错误。实测签名 orm-client.d.mts:1236 `readonly conflictOn?: readonly (keyof DefaultModelRow<TContract, ModelName> & string)[]`，官方 JSDoc 示例 L1709 `conflictOn: ['email']` → 应为 `conflictOn: ['userId']`；写成对象通不过类型检查。
- **P0（事实错误）**：「别改回 `DateTime`：它会落到 `pg/timestamptz-temporal@1`，Node 22 没有内置 Temporal，第一次读写就报 `RUNTIME.TEMPORAL_UNAVAILABLE`」——裸 `DateTime` 默认 `as: jsDate`，落到 `pg/timestamptz-date@1`，返回 JavaScript `Date`，**不需要 Temporal**（target-postgres rc.24 authoring-BbS0bin5-U9tXyzS6.mjs:499-520 定义 `DateTime: {args: as: jsDate|temporal|string, default jsDate}`，L887-893 注释「on the type bare DateTime becomes: a timestamptz(3) column read as a JavaScript Date (ADR 279)」）。只有 `DateTime(as: temporal)` / `TimestamptzTemporal` 才触发 `RUNTIME.TEMPORAL_UNAVAILABLE`（官方 skill contract.md:125 明确）。坑表最后一行「读写时间字段报 RUNTIME.TEMPORAL_UNAVAILABLE → 用了 DateTime」同样错误，应为「用了 timestamptz-temporal 系列类型」。
- 其余正确：`@unique` 是单值反向字段的前提、`onDelete` 四种动作表、`SetNull` 要求外键可空、`update` 无匹配返回 null、`select('id','name').include('profile', cb)` 链式（select 变参签名 orm-client.d.mts:1394-1395）、`transaction` 内不得混用外层 db。

### 第 046 章 part-03/046-Prisma8一对多映射与关联CRUD.md
- 技术点核对通过：关系谓词 `user.bookings.some((booking) => booking.status.eq(...))` 存在（orm-client.d.mts:407-408 `RelationFilterAccessor.some(predicate?)`）；`createAll`（orm-client.d.mts:1717，返回 AsyncIterableResult，await 后为数组）；`aggregate((a) => ({ total: a.count() }))`（L1214，`AggregateResult`）；include 精化回调 `.where/.select/.orderBy/.limit` 与「limit 是每父行三条」的语义正确；深 offset → keyset 的建议正确。
- 质量高，未见 P0。**P2 待核实**：L189-190「include 不会退化成 N+1，官方实现是在同一条 SQL 里用相关子查询」——rc.24 官方 skill 未明说相关子查询实现，属实现断言（可弱化为「官方文档称不产生逐行查询」）。
- **P2**：L184 提到「rc.29 的类型细节」——与全书固定的 rc.29 一致，但升级 rc.34 后该版本号会再次过时。

### 第 047 章 part-03/047-Prisma8多对多映射与关联CRUD.md
- 核对通过（引用官方 skill）：rc.24 `skills/prisma-8/references/contract.md:170` 与 `:530` 明确「Implicit Prisma-ORM many-to-many（两侧裸列表、无连接模型）被 SQL interpreter 拒绝，必须显式声明连接模型」；错误码 `PSL_ORPHANED_BACKRELATION` 存在（interpreter-CVd521dx-PDiCxDLC.mjs:446）。复合主键 `@@id([bookingId, serviceId])`、payload 不进主键、`@@index([serviceId])`、`onDelete Cascade/Restrict`、payload 关系写入需直连连接模型、N+1 用 `in` 批量查连接行——均正确，未见 P0。
- **P2**：「include 仍然是一条 SQL，ORM 按契约生成 join」为方向性描述（join 与相关子查询形态未实测），建议不改判。

### 第 048 章 part-03/048-Prisma8常用命令与迁移工作流.md
- 高度准确，抽查逐项命中：
  - `MIGRATION.PLAN_ORIGIN_UNKNOWN` 的报错原文与书中引文完全一致：`Cannot determine the plan origin: migrations exist but no origin is named`（orm-toolchain rc.24 caught-errors-Cll-zcA1-MXR0HE1V.mjs:353）。
  - 错误码存在：`MIGRATION.MARKER_MISMATCH`、`MIGRATION.HASH_NOT_IN_GRAPH`、`CLI.CONSENT_REQUIRED`、`CLI.COMMAND_MOVED`、`CLI.UNKNOWN_COMMAND`、`CLI.UNEXPECTED`。
  - flag 存在：`--schema-only`、`--marker-only`、`--strict`、`--advance-ref`、`--no-advance-ref`、`--show`、`--to`、`--from`、`--rename`、`--delete`、`--convert`、`--backfill`、`--allow`。
  - 目录/文件命名正确：`migration.json`、`migration.ts`、`ops.json`、`refs/`、`snapshots/`。
  - 全部输出均标注「示例输出，本机没有可连的 PostgreSQL，未实测」——标注诚实（P2 好评）。
- **P1 过时**：L?? 版本块再次固定 `@prisma/orm-postgres 8.0.0-rc.21` + `prisma 8.0.0-rc.29`（实测最新 rc.34/rc.24，配对 rc.34+rc.24）；「CLI.UNEXPECTED Cannot use 'in' operator to search for 'kind' in typeChoice」的版本错配报错描述在 rc.22 冲突已不存在后不再典型。
- **P2 待核实**：退出码 0/2/4 的具体语义（书中「2=没跑起来、4=完整性/漂移失败」）未逐一实测；`db init` 只做 additive 的说法与官方 skill（db init 建表；`db sign` 采用已有库）方向一致但未逐条验证。

### 第 049 章 part-03/049-Prisma8知识点查缺补漏.md
- 术语表与事故复盘主线扎实；核对通过：`.cursor({ createdAt })` 需在 orderBy 之后（orm-client.d.mts:1402/1466）、`include('bookings', (r) => r.count())`（L654）、`returnsRow({...}).build()` + `db.query(plan)`（queries-postgres.md:682）、`forNoKeyUpdate` 存在。
- 与 example 一致性核对：`Booking` 契约确实只有 `@@index([roomId, startTime, endTime])`（map idx_bookings_room_time）+ `@@index([userId])`，**没有 createdAt 索引**，而列表按 createdAt 排序——书中「这就是 504 根因之一」成立；`Room` 确实没有反向 `bookings`，书中「这条查询暂时用不上」诚实。
- **P1 说服力/正确性待核实**：L173-180「在单连接客户端上，db 的普通读会悄悄跑进同一个事务；而单行 update/delete、带关联写入的 create、嵌套 transaction 需要自己连接，会一直等 tx 占着的连接」——rc.24 官方 skill 只说「回调里每条语句都走它」，未描述这种隐式复用/排队行为，属高风险断言，建议改为「事务内一律用 tx」的规范建议。
- **P2**：`seed` 示例 `db.orm.public.Booking.where({}).deleteAll()`——`where({})` 空条件是否被允许（会不会被类型/运行时当成无条件删全表）需实测；`createDatabase(url)`、`loadEnvFiles()`、`Role/RoomStatus` 枚举导入与 example `src/database/prisma.ts`（`export const createDatabase = (url: string) => postgres({ contract, url })`）一致 ✓。
- **P1 过时**：L?? 再次出现「prisma@8.0.0-rc.29 配 @prisma/orm-postgres@8.0.0-rc.21 是当前 example 验证过的组合」（latest 已 rc.34/rc.24）。

### 第 050 章 part-03/050-在Nest里集成Prisma8.md
- 与 example 当前状态核对一致：`src/app.controller.ts` 健康检查确实只返回 `{status,timestamp,uptime}`；`main.ts` 确有 `app.enableShutdownHooks()`；`src/database/database.constants.ts` 是 `export const PRISMA = Symbol('PRISMA')`；`src/database/` 确实只有 prisma.ts / database.module.ts / database.constants.ts 三个文件（书中「三个文件拼起来的接法」属实）；`createDatabase = (url) => postgres({ contract, url })` 与 example/src/database/prisma.ts:18 一致。
- Prisma API 核对通过：`PostgresOptions<TContract>` 从 `@prisma/orm-postgres/runtime` 导出且含 `middleware`/`log`/`poolOptions`（runtime.d.mts:25-28、famsql index-ChmxRptH.d.mts:258-263 `RuntimeExecutionOptions { middleware?: readonly SqlMiddleware[]; log?: RuntimeLog }`）；`SqlMiddleware` 可从 `@prisma/orm-postgres/family-runtime` 导入（ormpg family-runtime.d.mts:1 `export * from "@prisma/orm-family-sql/runtime"`）；钩子签名 `beforeEncode?(plan, ctx, params?)`、`activityEnded?(activity, result, ctx)` 与书中代码一致（famsql index-ChmxRptH.d.mts:59-94）；`ctx.log`、`ctx.state(key)` 存在（orm-framework runtime-BocJkRg4.d.mts:397-416）；`result.kind === 'statement'` 时才收窄出 `latencyMs`/`source`（同文件 L423-429）——书中「这个判断不能省」正确；`PostgresTransactionContext<TContract>` 泛型可用（postgres-members-F9CVSrrN-BFAuNPbW.d.mts:20），`PostgresTransactionContext<Contract>` 合法；`db.close()` 语义与官方 JSDoc 完全一致（famsql index-ChmxRptH.d.mts:280：等待 in-flight、拒绝新 work 报 `DRIVER.NOT_CONNECTED`、每次调用返回同一 promise=幂等）。
- **P1（API 事实错误）**：L?? 「`poolOptions` 里最容易拍脑袋的是最大连接数……每个池配 20」——`PostgresPoolOptions` 只有 `connectionTimeoutMillis` 和 `idleTimeoutMillis` 两个字段（orm-postgres rc.24 postgres-options-B0YrJID9-YkuL0Mao.d.mts:9-12），池的构造也只透传这两个（binding-DkfRsUZE-Co5ssUZw.mjs:235-241 → `createPgPool({connectionString, connectionTimeoutMillis ?? 2e4, idleTimeoutMillis ?? 3e4})`），**没有 max 选项**，池上限是 pg 默认 10。要配最大连接数必须传 `pg: new Pool({ max })`（`PostgresBindingOptions.pg?: Pool | Client`，runtime.d.mts:20-24）或上 PgBouncer；书中建议在当前 API 下无法落地。
- **P1（事实错误）**：L?? 「`connectionTimeoutMillis` 一定要设，默认是无限等」——orm-postgres 运行时默认是 **20000ms**（binding-DkfRsUZE-Co5ssUZw.mjs:238 `?? 2e4`），不是无限；「无限等」是原生 `pg` 的默认（0）。书中把两者混为一谈。
- **P2 佳**：慢查询中间件「不传 log 事件会被丢弃」、liveness/readiness 分开、探针 timeout 与连接池对齐、DI 单例 vs Scope.REQUEST、PgBouncer 提示均正确；示例输出处已标「本机未实测」。

### 第 051 章 part-03/051-快速入门Redis.md
- 事实核对通过：Redis 8 主发行版已并入原 Redis Stack 的 JSON/Search/TimeSeries/Bloom（`JSON.SET`/`FT.SEARCH` 可用）；命令执行单线程、网络 IO 多线程；过期策略为「惰性 + 定期抽样」；`TTL` 返回 -1=永不过期、-2=不存在；普通 `SET` 覆盖会清掉原 TTL；RDB 默认三个 save 点（3600s/1、300s/100、60s/10000）；`appendfsync everysec` 最多丢约 1 秒；`maxmemory-policy` 默认 `noeviction`；`--appendonly yes` 时 RDB+AOF 同时开着——全部正确。
- 与 example/docker-compose.yml L? redis 服务 `command: ['redis-server','--appendonly','yes']`、`image: redis:8`、healthcheck `redis-cli ping` 一致。
- **P2（示例输出与实际终端不符）**：L?~L? 用 `docker compose exec redis redis-cli ...` 执行，但输出写成交互式 redis-cli 的格式——`"available"`（带引号）、`(integer) 1`、`1) "userId"`、`(integer) -1`。非 TTY 下 redis-cli 输出是 raw：`available`、`1`、逐行 `userId`/`u_1`…、`-1`。建议统一改成非交互输出或改用 `docker compose exec ... redis-cli -t` 之类的说明。
- **P2**：本章自称「（以上为示例输出，本机没有运行 Redis 容器，未实测。）」标注诚实，但章节内其他命令段（`ttl` 两次、`config get appendonly`、`info persistence`）未重复标注，全章可信度口径不统一。

### 第 052 章 part-03/052-在Nest里操作Redis.md
- ioredis 6.0.0 实测：named export 存在（`built/index.d.ts:1-2` `export { default } from "./Redis"; export { default as Redis } from "./Redis";`）→ `import { Redis } from 'ioredis'` 正确；`RedisStatus = "wait" | "reconnecting" | "connecting" | "connect" | "ready" | "close" | "end"`（`built/Redis.d.ts:16`）→ 书中列出的 6 个状态成立（漏了初始 `wait`，不算错）；选项 `lazyConnect`/`enableOfflineQueue`/`maxRetriesPerRequest`/`connectTimeout`/`retryStrategy` 均在 `built/redis/RedisOptions.d.ts`（L212/L195/L170/L152/L16）✓。
- **与 example 不一致（P1 一致性问题，非错误）**：书中 `redis.provider.ts` 版本额外加了 `connectTimeout: 3_000`、`retryStrategy: times => Math.min(times*200, 2_000)`、`Logger` 与 `logger.warn('REDIS_URL 未配置…')`；example/src/redis/redis.provider.ts 实际只有 `lazyConnect/maxRetriesPerRequest/enableOfflineQueue` 三项、无 Logger、无 connectTimeout/retryStrategy。书中未注明「本章在 example 基础上补充」。
- **与 example 不一致（P1，且书中论点自相矛盾）**：书中 `RedisService.onModuleInit` 改为 `on('ready')`/`on('close')` 驱动 `available`，并批评「只在 connect() 成功后置 true」有 bug；但 example/src/redis/redis.service.ts:36-44 正是后者（`await this.client.connect(); this.available = true;`）。书中把 example 现有实现当作反例却不点明「example 需要照此修改」，读者对照仓库会困惑。
- 正确性：`enableOfflineQueue: false` + `maxRetriesPerRequest: 1` 的「快速失败」组合解释准确；`error` 事件不监听会升级为未捕获异常（导致 exit 1）的 Node 语义正确；`quit()` vs `disconnect()` 与 `status` 判断正确；`app.enableShutdownHooks()` 前提与 example/src/main.ts 一致；cache-aside「写后删而非改」正确。
- **与 example 不一致（P1 一致性）**：L152/L167-176/L201-203 用 `meeting:stats:overview` 前缀与 `jitter()`，并称「key 散在各个 service 里，早晚会撞名，集中到一个文件 `src/redis/cache-keys.ts`」；但 example/src 里**没有** cache-keys.ts，StatsService 用内联字符串 `'stats:overview'`、TTL 常量 30（stats.service.ts:22、53），无前缀、无抖动。章节把「未来的重构」写成「项目现状」。
- **P1（该标注未标注）**：L? getMany（pipeline）、incrementWithTtl（Lua/EVAL）、booking-events.subscriber（pub/sub）在 example 中都不存在，属教学扩展；未说明「example 未实现」，读者对照仓库找不到。
- 技术正确：`pipeline.exec()` 返回 `[error, result][] | null`、单条失败不抛异常；pipeline 非事务；`eval(script, numkeys, k, arg)` 参数顺序；`duplicate()` 才能订阅；集群下 hash tag `{user:42}` 与 CROSSSLOT；`defineCommand` 走 EVALSHA 而非每次传脚本——均准确。
- **P2（示例输出格式）**：L201-203 MONITOR 时间戳 `1700000000.101` 是 2023-11-14 的样例时间（正文写作时间 2026-11，读者会以为是实时输出）；且与 ch51 同一问题——`docker compose exec` 下 redis-cli 输出格式与交互模式不同。

### 第 053 章 part-03/053-为什么推荐ioredis而不是cache-manager操作Redis.md
- 选型论证质量高，概念准确：cache-manager 是键值缓存抽象（后端可为内存/Redis/SQLite），不是 Redis 客户端；`CacheModule` 负责 DI、`CacheInterceptor` 负责缓存 GET 响应；Keyv 是底层多后端抽象；`@CacheTTL` 单位为毫秒；拦截器默认 key 是请求 URL；`@CacheKey()` 会绕过「只缓存 GET」；注入 `@Res()` 不生效；内存 store 返回同一引用；执行顺序 Middleware → Guard → Interceptor → Pipe → Handler；`retryStrategy`/`enableOfflineQueue`/`maxRetriesPerRequest` 属 ioredis 侧——均与 Nest 官方 caching 文档一致。
- **P2（版本未标注）**：全章未给 cache-manager / @nestjs/cache-manager 版本；当前实测 `@nestjs/cache-manager=12.0.5`、`cache-manager=7.2.9`、`@keyv/redis=6.1.0`、`keyv=6.1.0`。「未命中 `get()` 当前返回 `undefined`，cache-manager v6 返回 `null`」这句随版本易错，建议标注版本或直接写「两种都当未命中」。
- **P2（交叉引用错误）**：L111「（第 17 章讲中间件、**第 13 章讲守卫**、第 18 章讲拦截器）」——`_meta/chapters.tsv` 中 013 是 `013-Metadata和Reflector.md`，不是守卫章；17/18 正确。
- **P2（示例输出）**：L219 `# (integer) 60` 同样是交互式格式，`docker compose exec` 下应为 `60`；L180 的 `jitter(60)` 与 example 实际 TTL 30 不一致（同 ch52）。
- **P1（遗漏）**：对比表未提 cache-manager v7 的 `stores` 多后端（可同时挂内存+Redis 做多级缓存）与 `Cache` 的 `wrap`/`mget` 能力，也没提 Nest 官方 caching 文档里 `CacheModule.registerAsync` 的用法——选型判断里「cache-manager 只能 get/set/del」略绝对。

## 参考来源
- npm registry 实测（2026-11-21）：`https://registry.npmjs.org/prisma`（dist-tags latest=8.0.0-rc.34，2026-11-16T17:14Z）、`https://registry.npmjs.org/@prisma%2Form-postgres`（latest=8.0.0-rc.24）、`@prisma/orm-family-sql`、`@prisma/orm-toolchain`、`@prisma/orm-framework`、`@nestjs/core`（12.6.0）、`pm2`（7.1.2）、`ioredis`（6.0.0）、`redis`（6.3.1）、`typescript`（7.0.2）、`pnpm`（12.21.0）、`@nestjs/cache-manager`（12.0.5）、`cache-manager`（7.2.9）、`@keyv/redis`/`keyv`（6.1.0）。
- Prisma 8 包内证据（解包 tarball）：`@prisma/orm-postgres/dist/runtime.d.mts`（PostgresOptions/Binding/PoolOptions/TransactionContext）、`dist/postgres-options-B0YrJID9-YkuL0Mao.d.mts`、`dist/postgres-members-F9CVSrrN-BFAuNPbW.d.mts`、`dist/binding-DkfRsUZE-Co5ssUZw.mjs`、`dist/family-runtime.d.mts`、`dist/authoring-BbS0bin5-U9tXyzS6.mjs`、`dist/errors-C4-Dp3gI-B5jY5eJj.mjs`（RUNTIME.TEMPORAL_UNAVAILABLE）；`@prisma/orm-family-sql/dist/orm-client.d.mts`（conflictOn、forUpdate、first、cursor、createAll）、`dist/index-ChmxRptH.d.mts`（SqlMiddleware、ActivityContext、RuntimeExecutionOptions、close 语义）、`dist/interpreter-CVd521dx-PDiCxDLC.mjs`（PSL_NON_UNIQUE_BACKRELATION/PSL_ORPHANED_BACKRELATION）、`dist/psl-field-resolution-GN4iup8d-BSjTCYks.mjs`（PSL_GENERATOR_IN_DEFAULT）；`@prisma/orm-toolchain/dist/caught-errors-Cll-zcA1-MXR0HE1V.mjs`（MIGRATION.PLAN_ORIGIN_UNKNOWN 原文）；`@prisma/cli-engine/dist/index.d.ts`（definePrismaConfig）。
- Prisma 8 官方随包 skill 文档：`@prisma/orm-postgres/skills/prisma-8/SKILL.md` 及 `references/{quickstart,contract,migrations,migration-model,migration-review,runtime,queries,queries-postgres}.md`（含 `// use prisma-8`、`contract emit`、`tx.execute(tx.raw.sql…build())`、`conflictOn: ['email']`、RLS policy、隐式 M2M 被拒）。
- Prisma 官方文档：`https://www.prisma.io/docs/orm/prisma-client/queries/transactions`、`https://www.prisma.io/docs/orm/prisma-schema/data-model/relations`、`https://www.prisma.io/docs/orm/prisma-client/queries/pagination`。
- PostgreSQL 17 文档：`https://www.postgresql.org/docs/17/sql-select.html`（LATERAL/MERGE/FILTER/窗口）、`https://www.postgresql.org/docs/17/sql-createindex.html`（部分索引/排除约束）、`https://www.postgresql.org/docs/17/transaction-iso.html`、`https://www.postgresql.org/docs/17/runtime-config-locks.html`（deadlock_timeout/40P01）、`https://www.postgresql.org/docs/17/errcodes-appendix.html`（22023/23P01/40001/25P02/57014/23505）。
- Docker / Compose / PM2：`https://docs.docker.com/build/building/multi-stage/`、`https://docs.docker.com/build/cache/`、`https://docs.docker.com/compose/compose-file/05-services/#healthcheck`、`https://docs.docker.com/compose/compose-file/05-services/#depends_on`、`https://docs.docker.com/reference/cli/docker/buildx/build/#cache-to`、`https://pm2.keymetrics.io/docs/usage/cluster-mode/`、`https://pm2.keymetrics.io/docs/usage/restart-strategies/`（max_memory_restart）、`https://nginx.org/en/docs/http/ngx_http_proxy_module.html`。
- Redis / ioredis / Nest caching：`https://redis.io/docs/latest/`、`https://redis.io/docs/latest/develop/using-commands/pipelining/`、`https://redis.io/docs/latest/develop/programmability/eval-intro/`、`https://github.com/redis/ioredis`（README 与 `built/redis/RedisOptions.d.ts`）、`https://docs.nestjs.com/techniques/caching`、`https://github.com/jaredwray/cacheable/tree/main/packages/cache-manager`、`https://keyv.org/docs/`。
