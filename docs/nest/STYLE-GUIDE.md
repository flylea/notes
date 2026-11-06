# 《NestJS 12 全栈实战通关教程》写作规范

本文件是所有章节作者（人或 AI）必须遵守的写作与代码规范。目标：**268 章 / 30 个 Part / 六篇，覆盖从核心原理到企业级全栈交付与求职的完整路径；每一章都能独立读懂、代码能跑、结论有官方文档依据。**

结构由 `_meta/chapters.tsv`（8 列）与 `_meta/parts.tsv`（12 列）描述，`README.md`、各 Part 的 `_part.md`、章节页脚由 `_meta/build-structure.mjs` 生成——**不要手改这些生成物**。改结构时先改 tsv，再跑 `build-structure.mjs` 与 `check-structure.mjs`。

## 1. 版本与技术栈（2026-11 基线）

| 组件 | 版本/选型 | 备注 |
| --- | --- | --- |
| NestJS | 12.3.x | 官方文档 v12；CLI 默认 ESM |
| Node.js | 22 LTS（推荐）/ 24 LTS | 运行需 v20.19+；`nest new` 需 v22.22.3+/v24.15+/v26+ |
| TypeScript | 5.9+ 或 6.x | 脚手架默认 `strict: true` |
| 包管理 | pnpm 11（示例项目） | 命令同时给 npm 等价写法 |
| Lint/Format | oxlint + Prettier | Nest 12 脚手架默认 |
| **数据库** | **PostgreSQL 17** | 主库统一 PostgreSQL，不再使用 MySQL |
| **ORM** | **Prisma 8（RC）** | `prisma@8.0.0-rc.29` + `@prisma/orm-postgres@8.0.0-rc.21`（版本必须配对，rc.22 会与 CLI rc.29 冲突） |
| 缓存/队列 | Redis 8 + ioredis；RabbitMQ 4、Kafka 4、RocketMQ 5 | 章节内注明镜像 tag |
| 实时通信 | ws 8、socket.io 4 | |
| GraphQL | @nestjs/graphql 13 + Apollo Server 5 | |
| 文档 | @nestjs/swagger 11（OpenAPI 3.1） | |
| 部署 | Docker 28 / Compose v2、Nginx 1.27、Kubernetes 1.33 | |
| **测试** | **本期不引入** | 不写单测/e2e/压测专题，也不在章节里展开 Vitest/Jest 测试示例 |

> 原则：**以官方最新文档为准**。本地已备好 v12 文档源文档（见 §5），写作前先查，不确定的 API 宁可标注版本差异也不要臆造。
>
> Prisma 8 用法速记：`contract.prisma` 首行 `// use prisma-8`；`pragma contract emit` 生成 `contract.json`/`contract.d.ts`；运行时 `postgres({ contract, url })`，模型访问 `db.orm.public.User`，链式 `.where/.select/.orderBy/.limit/.all/.create/.createAll/.updateAll/.deleteAll`；配置在根 `prisma.config.ts`（`definePrismaConfig` + `@prisma/orm-postgres/config`）。约定写法见 `example/`。

## 2. 叙事结构（像掘金小册那样讲，必读）

每章是一篇能一口气读下去的讲解，不是参考文档，也不是课程讲义。判定标准：**一个会 JS/TS、懂基础 HTTP、但没碰过 Nest 的人，从头读到尾不需要跳出去查资料**。

推荐节奏（可自然变化，不要求小标题整齐对齐）：

1. **先弄懂概念，再进入具体问题**：如果本章要引入读者还没学过的概念（尤其是 TypeScript 的装饰器、元数据、反射，或 Nest 的模块、Provider、IoC/DI、管道、守卫、拦截器、ORM、Docker 等），先用 2–5 段白话讲清「它是什么、为什么需要、没有它行不行」，并给出官方文档链接（TypeScript 概念给 TypeScript 官网，Nest 概念给 docs.nestjs.com），然后才进入具体问题（1–2 段，用大白话把这一章要解决的事讲清楚）。读者已经在前文章节学过的概念可以直接用，但没解释过的名词不能直接出现在开场场景里。不要罗列名词清单或写技术背景综述，也不要一上来甩报错、日志或代码。
2. **边做边解释**：每讲到一个新概念（DTO、IoC、拦截器……），就地用一两句话说明"它是什么、解决什么问题、和最容易混的那个有什么区别"，紧接着给一个最小可用的例子或请求，让读者马上看到效果。
3. **一步一步推进**：每一步都是「是什么 → 怎么用 → 真跑一遍看结果」。命令、请求、返回结果尽量贴真实执行过的内容；暂时没法跑的内容明确标注"未实测"。
4. **遇到坑立即展开**：某个写法会踩坑、某个默认值反直觉，就在那一步讲清楚，不要攒到最后。
5. **收尾**：用一张对比表或一段话把本章讲的东西串起来，自然过渡到下一章；官方文档链接放最后一行小字。

禁止出现教材式小节与句式：`本章目标`、`前置知识`、`练习`、`延伸阅读`、`小结`、`学完你将`、`本章将`、`我们将会` 等；也不要"对应小册：第 N 章"这类学案式抬头，文档出处放文末一行小字即可。

**术语要求**：关键术语第一次出现时用一两句人话解释（是什么 + 为什么 + 和相近概念的区别），不要提前集中罗列成词典；后续章节再出现时一句话复述、指向首次解释的章节即可。读者会 JavaScript/TypeScript 与基础 HTTP，但不熟 Nest、ORM、后端分层架构和运维术语，任何专有名词都不能默认他已经会。`_meta/GLOSSARY.md` 是术语速查表，写作时可对口径，但**不要**把里面的条目搬成章节开头的术语清单。

**链接要求（链接不是解释）**：官方文档、博客等外链只能作为延伸阅读，**不许**用「详见官方文档」+裸链接代替正文解释。必须先把概念在正文用中文讲透（是什么、为什么、没有它行不行），再给链接；每条链接前用一句话说明它补充什么、对应哪一节或哪个 API。文末的官方文档行同样不能是唯一解释——正文没有讲清的内容不许只靠链接交付。

**语气**：第二人称"你"，像资深同事当面讲：直接、具体、有判断，短句为主；不写空洞过渡（"在本章中我们将……"），不堆网络梗，不端着、不卖萌。

**说人话（红线）**：解释任何概念都先用一句大白话或生活化类比，再给术语和定义；不要用英文名词串解释另一个英文名词，也不要把文档原文搬过来当解释。判断标准：一个没接触过后端的人顺着读，不需要停下来查资料。写完自己读一遍，哪段像在背文档，就重写成大白话。

**篇幅**：由内容决定，**不凑字数**——讲清一个问题就收尾，不做注水扩写。参考区间：概念章通常 1500–2500 汉字，实操/项目章 2000–3500 汉字；内容需要可以更长，前提是每一段都有新信息。

**配图**：架构、流程、原理、协议、时序、关系、部署、生命周期、数据流、可靠性、可观测这类主题用 Mermaid 画一张图（图给一句题注即可）；其他章节有图更好，不强制。**不要写「这张图在说什么」这类解读段**，图后直接进入正文。图不能替代文字解释。

## 2.1 原创表达与配图（必读，优先级同红线）

**取其精华、去其糟粕**：小册只提供「学习路径、问题清单、章节顺序」；正文必须用自己的语言重讲：
- 先给直觉或类比，再给定义，最后落到代码与验证；不要照抄小册的引言、段落结构和例子。
- 明确指出小册中的过时写法（Nest 9/10/11、旧 TypeORM/class-validator/配置 API、无 ESM、旧的测试方式等），给出 Nest 12 的替代方案——这就是「去其糟粕」。
- 每章先讲清需要的新概念（若读者没学过），再从一个具体场景或故障切入，写出自己的判断与生产经验，不要复述小册的引入方式。
- 代码示例放在真正需要的地方：讲清一个概念/一次操作/一个坑即可；不要为凑数贴代码，也不要整页堆砌。

**配图（按需）**：架构、流程、原理、协议、时序、关系、部署、生命周期、数据流、可靠性、可观测这类主题必须有图；其他章节有图更好，不强制。
- 优先 Mermaid（GitHub / VS Code 可渲染）：`flowchart`、`sequenceDiagram`、`classDiagram`、`stateDiagram-v2`、`erDiagram`，放在正文对应位置。
- 空间/形象类概念可用生成插图：存放 `assets/part-XX/NN-slug.png`，命名如 `assets/part-01/009-aop-order.png`；正文用 `![题注](<assets/part-01/009-aop-order.png>)` 引用相对路径。
- 生成插图前先读 `agnes-image` skill（DSH 图像生成）；一次只生成必要的一张，控制成本。
- 每张图给一句题注即可（只是说明图是什么）；**不要写「这张图在说什么」这类解读段**，图后直接进入正文；图不能替代文字解释。

## 3. 代码规范

- **ESM**：相对导入必须带 `.js` 后缀（`import { AppService } from './app.service.js'`），tsconfig 为 `module: nodenext`。
- **入口**：Nest 12 脚手架使用 top-level await：
  ```ts
  const bootstrap = async (): Promise<void> => {
    const app = await NestFactory.create(AppModule);
    await app.listen(process.env.PORT ?? 3000);
  };
  void bootstrap();
  ```
- **类型**：`strict` 下不写 `any`；DTO 用 `class-validator`/`class-transformer`；接口返回值显式声明；禁止 `as` 掩盖类型错误（确需时注释原因）。
- **Nest 惯用法**：构造器注入；`@Injectable()`；模块按业务拆分；全局 `ValidationPipe({ whitelist: true, transform: true })`；异常统一走 `HttpException` 家族 + 全局过滤器。
- **数据库（Prisma 8）**：`prisma/contract.prisma` 是唯一 schema 真相；每改一次 contract 必须 `pnpm prisma contract emit` 并提交 `contract.json`/`contract.d.ts`；迁移用 `prisma migration plan` + `prisma db migrate`；禁止手写 SQL 迁移（教学演示除外）。查询统一经 `lib/db` 客户端（`db.orm.public.X`），禁止在组件里散落连接。
- **配置**：`@nestjs/config` + `ConfigModule.forRoot({ isGlobal: true, validationSchema })`；不散落 `process.env`。
- **日志**：`Logger`/`nestjs-pino`；禁止 `console.log` 输出敏感信息。
- **安全**：示例必须展示 `helmet`、CORS 白名单、限流、输入校验；JWT secret 从配置注入，禁止硬编码。
- **验证方式（无测试）**：命令（`pnpm build`、`prisma contract emit`、`curl`、`docker compose`）、预期返回 JSON/日志、PostgreSQL 查询结果。章节中不要求、不展示 Vitest/Jest 单测。
- **版本固定**：命令与 `package.json` 片段写明确版本（如 `@nestjs/common@12.3.3` 或 `^12.3.0`）。

## 4. 内容质量红线

1. **不得逐字复制小册**：小册只作学习路径与问题清单参考；正文必须用自己的话重写，并补充最新 API、生产实践与验证步骤。原文摘录最多引用一两句并注明出处。
2. **不得写"玩具 Demo"**：所有示例按生产可用标准（校验、错误处理、安全、日志、部署）展开。
3. **以官方文档为准**：涉及 API 签名、配置项、默认值时，先查 §5 本地文档；冲突时以最新 v12 文档为准，并说明旧版差异。
4. **可验证**：每章必须给出可执行的验证方式（命令 + 预期输出/返回码），不要求固定小节名；不能只贴代码。
5. **企业级视角**：每个技术点都要回答"生产环境怎么用/有什么坑"，避免只讲语法。
6. **本期不含测试内容**：不要写单元测试、e2e、压测章节或测试代码示例；"整体测试"相关章节按"部署与整体验收"写。
7. **禁止教材腔**：不得出现 `本章目标`、`前置知识`、`练习`、`延伸阅读`、`小结` 等小节标题，也不得使用"学完你将能够""本章将带你"这类讲义句式；不要小册学案式抬头。
8. **概念先于场景**：读者没学过的概念/术语必须先解释再使用（TypeScript 装饰器/元数据/反射等概念给 TypeScript 官网链接；Nest 概念给官方 docs.nestjs.com 链接）；不得用未解释的名词（Reflector、元数据、装饰器、IoC、DTO、ORM、迁移……）直接开场；已经在前文章节解释过的概念，一句话复述并指向对应章节即可。

## 5. 本地资料与检索

- **官方文档（v12 源 markdown）**：`.cache/nest-refs/docs-site/content/<page>.md`（162 篇）。
- **小册参考（合并版）**：`/Users/dailei/Documents/nest-nuggets-booklet/合并版/`。先看 `205版-较新目录/`（目录最新；其中 110 章有正文、95 章为“暂未写作”占位）；占位章节用关键词去 `200版-完整正文/` 检索（200 章全有正文）。两版编号顺序不一致，**不要按编号硬对应**。
- **awesome-nestjs**：`.cache/nest-refs/awesome-nestjs/README.md`。
- **章节清单**：`_meta/chapters.tsv`（8 列：chapter / part / part_title / file / slug / domains / project / status，268 章）与 `_meta/parts.tsv`（12 列，30 个 Part，含 section/goal/outcome）。
- 检索示例：
  ```bash
  grep -ril "ValidationPipe" .cache/nest-refs/docs-site/content/ | head
  grep -rln "守卫\|Guard" .cache/nest-refs/docs-site/content/ | head
  ```
- 官方文档在线路径前缀：`https://docs.nestjs.com/`（页面路径即 docs-site 的 content 相对路径去掉 `.md`，如 `content/guards.md` → `https://docs.nestjs.com/guards`）。

## 6. 项目章节约定（与 example 保持一致）

- 参考项目：`example/`，主线为 **会议室预订系统**（Part 06 后端 + Part 26 的 Next.js 前端）（Nest 12 + ESM + **PostgreSQL 17 + Prisma 8** + Redis 8 + JWT + Swagger + Docker Compose），前端在 `example/meeting-booking-web/`（React 19 + Vite + TanStack Query + Ant Design）。
- 统一命名：
  - 模块：`AuthModule`、`UsersModule`、`RoomsModule`、`BookingsModule`、`StatsModule`、`UploadsModule`、`CommonModule`。
  - 数据模型：`User`、`Room`、`Booking`（表名 `users`/`rooms`/`bookings`），Prisma contract 中使用 PascalCase 模型名 + `@@map`。
  - 角色：`Role.ADMIN` / `Role.USER`；预订状态：`PENDING/APPROVED/REJECTED/CANCELLED`。
  - API 前缀 `/api`，响应包装 `{ data, meta? }`，错误 `{ statusCode, message, error, requestId }`。
- 项目章节的每个代码片段都要能在 `example/` 找到对应文件；文件名与路径在正文中标注。
- `example/` 本期不包含测试代码与测试依赖。

## 7. Skill 方法论（写章节前先读并执行）

本教程的写作与代码审校已接入三个已安装 skill，作者必须按它们的方法执行：

| Skill | 位置 | 在本教程中的用法 |
| --- | --- | --- |
| `developer-tutorial` | `~/.agents/skills/developer-tutorial/SKILL.md` | 每章当作一个「tutorial 单元」：先写可验证学习目标 → 概念阶梯（每步只引入一个新概念）→ 每 3–5 步一个 checkpoint（命令 + 精确预期输出 + 失败恢复路径）→ 引导渐隐（早期给完整文件，中段只给改动行并标插入位置，后期只给需求 + 预期输出）→ 结尾确认"你现在能……" |
| `doc-coauthoring` | `~/.agents/skills/doc-coauthoring/SKILL.md` | 采用其「Reader Testing」思想：每批章节完成后，由无上下文读者视角的 reviewer 模拟阅读并提问，找出盲点、歧义与假设；作者按反馈修补 |
| `nestjs-best-practices` | `~/.agents/skills/nestjs-best-practices/SKILL.md` | 代码审校 checklist：`arch-` / `di-` / `error-` / `security-` / `perf-` / `db-` / `api-` / `micro-` / `devops-` 前缀规则逐条对照（`test-` 分类本期暂缓）；"企业级落地要点"必须能对应到具体规则 |

### 7.1 每章必须包含的 tutorial 元素
- **能力承诺**：先用 2–4 段交代背景与本章涉及的关键术语（是什么、为什么需要、和相近概念的区别），再进入场景，让读者知道"学完能解决什么"；**不要**写成"本章目标"小节（见 §2 去教材腔红线），也不要一上来就甩报错/代码。
- **步骤化动手实现**：小标题用祈使句（"创建 Prisma contract 文件"），一个步骤只做一件事。
- **checkpoint**：每个关键阶段给出「命令 → 预期输出 → 不符时怎么办」；预期输出必须是真实跑过的结果，不写 "something like this"。
- **概念阶梯**：一次只引入一个新概念；后续步骤复用已学内容。
- **引导渐隐**：后续章节比前面章节给更少完整代码（完整文件 → 改动行 → 需求 + 预期输出）。
- **结尾**：确认能力 + 指向下一章/官方 how-to/reference。

### 7.2 NestJS 代码审校最小清单（写代码时逐条对照）
- `arch-feature-modules`：按业务模块组织（auth/users/rooms/bookings），不按技术层平铺。
- `di-prefer-constructor-injection`：构造器注入，不用属性注入/服务定位器。
- `error-use-exception-filters` + `error-throw-http-exceptions`：统一异常过滤器 + 语义化 HTTP 异常。
- `security-validate-all-input` + `security-use-guards`：DTO 校验 + Guard 授权，JWT secret 走配置。
- `db-use-migrations` + `db-use-transactions`（Prisma 8：`migration plan` + `db migrate`，事务用 `db.transaction`）。
- `api-use-dto-serialization` + `api-use-interceptors`：响应包装与序列化，不直接泄漏实体。
- `perf-use-caching`：Redis 缓存要写失效与降级策略。
- `devops-use-config-module` + `devops-use-logging` + `devops-graceful-shutdown`：配置、结构化日志、优雅停机。

## 8. 交付与状态

- 只写自己负责的章节文件；不要修改 `_meta/chapters.tsv`、`_meta/parts.tsv`、`README.md`、`_part.md`、`STYLE-GUIDE.md` 以及别人的章节（结构类文件统一由 Lead 用脚本生成）。
- 写完一个 part 后在 `_meta/status.tsv` 追加一行（若无该文件则创建）：`part<TAB>章节范围<TAB>状态<TAB>作者<TAB>日期`。
- 若发现规范冲突或缺失依赖版本，先在章节"说明"里记录，不要臆造。

## 9. 结构变更流程（v7）

- 增删/重排章节：只改 `_meta/chapters.tsv`（8 列）与 `_meta/parts.tsv`（12 列），然后：
  1. `node _meta/build-structure.mjs`（重生成 README / Part hub / 章节页脚）
  2. `node _meta/check-structure.mjs`（0 错误才算过）
- 字数不是验收指标：validate 只兜底"信息量下限 800 汉字"与"按需必须有图"，不设上限、不设目标。
- 新增章节文件命名：`NNN-章节标题（无空格/斜杠）.md`，编号 3 位；Part 目录 `part-NN`。
