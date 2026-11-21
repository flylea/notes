# Part 00 + Part 01 技术审查报告

> 审查范围：part-00/001–002、part-01/003–028，共 28 章。只读审计，未修改章节。
> 基线时间：2026-11-21。结论以官方 docs.nestjs.com v12、npm registry、@nestjs/schematics 12.0.12 模板实物为准。

## 已核实的外部事实（证据）

- `@nestjs/cli` 最新 **12.0.15**（2026-11-20），12.x 只有 12.0.1–12.0.15；**不存在 12.3.0**（registry 查询：https://registry.npmjs.org/@nestjs/cli）。
- `@nestjs/core` 最新 12.6.0（2026-11-20），确有 12.3.0；`type: "module"`，exports 只有 `.js` → ESM-only 属实。
- `@nestjs/schematics@12.0.12` 的 ts-esm 模板实物（/tmp/schem/package/dist/lib/application/files/ts-esm/）：
  - package.json 脚本含 `deploy: nest deploy`、`lint: oxlint --type-aware src/ test/`、`test: vitest run`、`test:e2e: vitest run --config ./vitest.config.e2e.ts`。
  - devDependencies 含 `@nestjs/testing ^12.0.1`、`vitest ^4.1.2`、`@vitest/coverage-v8`、`oxlint ^1.58.0`、`oxlint-tsgolint`、`typescript ^6.0.2`、`@types/supertest`、`supertest`。
  - tsconfig 关键项：`module/moduleResolution: nodenext`、`emitDecoratorMetadata: true`、`experimentalDecorators: true`、`strict: true`（schema 默认）、`strictPropertyInitialization: false`、`rootDir: "."`、`types: ["vitest/globals","node"]`；tsconfig.build.json `rootDir: "./src"`, include src。
  - 脚手架 main.ts 用 `async function bootstrap()`，顶层 `await bootstrap()`。
  - 脚手架无 `@nestjs/observe` 交互提问（schema 中 observe 无 x-prompt，默认 false）；ESM/CJS 才有交互提示 "Which module system would you like to use?"。
  - tsconfig.build.json 已存在，且排除 `test` → 书中「入口路径 dist/src/main」的修法其实是脚手架默认（ch003 的 tsconfig 漏写 rootDir/types）。
- Node 22.22.3 存在（2026-05-13）；当前 22.x 已到 22.23.5。
- `NEST_DEBUG` 真实存在：`@nestjs/core/injector/helpers/is-debug-mode.util.js` → `!!process.env.NEST_DEBUG`。
- DI 报错文案源码：`@nestjs/core/errors/messages.js:92` 起，结尾为 `is available in the ${contextLabel} module.`（`contextLabel` = moduleName）→ 书中 ch005 的示例文案「available in the UsersModule module.」与实际一致。


## 结论

1. **可以用，但有 3 处硬伤必须先修**：Part 00/01 的 P0 共 3 条——`@nestjs/cli@12.3.0` 这个版本在 npm 上不存在（ch001/ch003，命令直接失败）、ch001 编造了「NestJS Observe 选 No」的交互（脚手架根本不问）、ch017:245 从 `node:http` 导入 `NextFunction`（TS2305，示例编译不过）。
2. **技术准确性整体很高**，尤其 AOP、ExecutionContext、Reflector、ValidationPipe、ExceptionFilter、文件上传、日志这几组，逐条对照 @nestjs/core 12.6.0 源码基本都对；ch016（NodeAdapter）、ch019/020（Nest 12 的 `ArgumentMetadata.schema`、`errorFormat`、`StandardSchemaValidationPipe`）甚至比多数市面教程新。
3. **最大风险不是「写错」而是「版本基线落后一代」**：README 与 ch001/ch003 仍按 Nest 12.3.x + TS 5.9+/6.x +「本期不引入测试」的口径写，而 Nest 12 官方脚手架已经是 vitest 4 + oxlint + `nest deploy` + 可选 `@nestjs/observe`，TypeScript 已 7.0.2 GA（2026-07-08）。part-01 全 28 章里只有 ch004 出现过 `vitest/globals` 字样。
4. **结构性遗漏是「测试」**：286 章规划里没有任何测试章（chapters.tsv 全文无「测试/单测/e2e」条目），而 ch001/ch003 又明写「本期不引入测试」，与官方脚手架默认生成 `test/app.e2e-*.ts` + vitest 直接冲突。这属于全书级缺口，part-01 是唯一合适的落点。
5. **可复现性打折**：全 28 章有 19 处「示例输出（未实测）」免责声明（集中在 ch015–022、ch028），教程里出现虚构的 curl 输出/日志行，读者按书复现会对不上；建议要么实测，要么明确标注「示意」。

## P0 事实错误 / 跑不通

| 章节文件:行号 | 问题 | 证据 / 正确写法 |
| --- | --- | --- |
| part-00/001-开篇词.md:133 | `pnpm dlx @nestjs/cli@12.3.0 new ...`：该版本不存在 | npm registry：`@nestjs/cli` 12.x 只有 12.0.1–12.0.15，latest 12.0.15（2026-11-20），没有 12.3.0 → 命令 ETARGET 失败。改成 `@nestjs/cli@12`（浮动到 12.0.15）或 `@12.0.15`。**同一错误还出现在** part-01/003-快速掌握NestCLI.md:51、57、153、155、196（`nest info` 示例输出里的 CLI 12.3.0 也是编的） |
| part-00/001-开篇词.md:130 | 称脚手架交互里会问「ESM 还是 CJS」「NestJS Observe 选 No」 | `@nestjs/schematics@12.0.12` 的 `application/schema.json`：`observe` 只有描述和默认值 false，**没有 `x-prompt`**；只有 `type`（cjs/esm）有 "Which module system would you like to use?" 交互。正确写法：说明 `--observe` 是可选参数，默认不装；不要写「选 No」 |
| part-01/017-Nest的Middleware.md:245 | `import type { NextFunction, IncomingMessage, ServerResponse } from 'node:http';` | `NextFunction` 不是 `node:http` 的导出（@types/node 24.10.1 `http.d.ts` 零命中），它来自 `express-serve-static-core@5`（`index.d.ts:26 export interface NextFunction`）→ TS2305 编译失败，本章「函数中间件」示例跑不起来。应改为 `import type { NextFunction } from 'express';`（同文件 017:63 就是这么写的） |

## P1 遗漏与深度不足

### 该有未写

| 主题 | 为什么算遗漏 | 建议落点 |
| --- | --- | --- |
| **测试（vitest 4 + @nestjs/testing + supertest）** | Nest 12 脚手架默认生成 `test/app.e2e-spec.ts`、`vitest.config.ts`，脚本有 `test`/`test:e2e`/`test:cov`；chapters.tsv 286 章规划里**没有任何测试章**，ch001/ch003 还明写「本期暂不引入测试」。这是整本书最大的结构性缺口，part-01「核心基础」必须补 | part-01 新增一章（或在 ch003 后用一节打底），讲 `Test.createTestingModule`、`supertest`、vitest 配置 |
| **Nest 12 新工具链：`nest deploy` / `@nestjs/observe` / oxlint** | 脚手架 scripts 已有 `"deploy": "nest deploy"`、`"lint": "oxlint --type-aware src/ test/"`，schema 有 `observe` 选项；part-00/01 全 28 章零覆盖，ch003 讲 `nest add`/`nest upgrade` 却没提 deploy | ch003 补一段「Nest 12 的 CLI 新命令」；ch001 补一段「脚手架默认带什么」 |
| **请求/瞬态作用域完整讲法** | ch005:115 只有一句「默认单例」，`REQUEST`/`TRANSIENT`、注入树冒泡（scope 向上传染）、`ContextIdFactory`/`ModuleRef.resolve`、性能代价都没讲；规划在 ch262，离 part-01 太远，读者写到这里就会踩「注入 request 后整条链变慢」 | ch005 补一小节（或 ch007 后加一节），ch262 只做进阶 |
| **`@nestjs/config` 配置模块** | chapters.tsv 里只有 ch060「如何动态读取不同环境的配置」，没有 ConfigModule（`forRoot({ isGlobal, cache, validationSchema })`、`ConfigService.get` 类型化、命名空间配置）。part-01 已经大量用环境变量，缺这块后面每章都要绕 | part-01 新增一章或并入 ch008 之后 |
| **序列化 / ClassSerializerInterceptor** | ch018 讲 Interceptor 只讲了 `map`/`tap`/`catchError`，没提 `ClassSerializerInterceptor` + `class-transformer`（`@Exclude`/`@Expose`/`@Transform`），而 ch004:388-390 又把 VO 引到 ch22/ch50、规划里在 ch277。part-01 讲「请求模型」缺响应序列化闭环 | ch018 加一节并前向引用 ch277 |
| **优雅关闭的新签名** | ch008 只讲 `enableShutdownHooks()` 无参用法，Nest 12 实际签名是 `enableShutdownHooks(signals: Signals[] = [], options: { useProcessExit?: boolean } = {})`；`useProcessExit` 用于异步 logger 刷 buffer（默认实现是 `process.kill(process.pid, signal)` 重发信号） | ch008 补 2 段：自定义信号列表、`useProcessExit` 的取舍 |

### 讲了但太浅 / 说法不准

| 章节:行号 | 问题 | 说明与建议 |
| --- | --- | --- |
| part-01/016:81 | 「比 FastifyAdapter 多约 5%」没写比较对象 | 官方 FAQ 文字是「NodeAdapter 比裸 Fastify 少 ~3%、比 Hono 多 ~5%、比 Express 多 ~50%」；benchmark 表：Fastify 57.1k / Nest on Node 55.6k / Hono 53.1k / Nest on Fastify 52.6k / Express 37.0k。+5.7% 只在「Nest on Fastify → Nest on Node」口径成立，需补基准表并注明运行条件（Node 24、wrk -t4 -c100） |
| part-01/016:155 | 「`app.use()` 是 Express 的方法，Fastify 实例上根本没有」 | 半错：Nest 的 FastifyAdapter 实现了 `use(...)`（`@nestjs/platform-fastify/adapters/fastify-adapter.js:1155`，内部走 `@fastify/middie`），`app.use()`/函数中间件在 Fastify 下可用。应改成「裸 Fastify 实例没有 `use`；Nest 的 `app.use` 仍可用，Fastify 插件必须 `register()`」 |
| part-01/024:265 | 「Nest 12.3 给 FileTypeValidator 加了 `fallbackToMimetype` 和 `overrideMimeType`」 | 版本归属错误：`fallbackToMimetype` 在 @nestjs/common **11.1.6** 已存在，`overrideMimeType` 至少 **12.0.0** 已有（对照 12.0.0/12.1.0/12.2.0 的 file-type.validator.d.ts）。应写成「Nest 12 的 FileTypeValidator 支持 …」去掉 12.3 限定 |
| part-01/009:100 | 「Part 02 换成 PostgreSQL 17 + Prisma 8」把 Prisma 8 当稳定版 | prisma dist-tags.latest = **8.0.0-rc.34**（仍是 RC，未 GA）；chapters.tsv 第 35/44/56 章标题也写「Prisma 8」。教学书把未 GA 的 ORM 当主线有风险，建议写「Prisma 8（写作时为 RC，正式版发布后需复核 API）」 |
| part-01/020:149、020:381 | 建议用 `@IsEmpty()` 处理「空字符串跳过校验」 | `@IsEmpty()` 语义是「断言值必须为空（''/null/undefined）」，不是「为空则跳过」，配 `@IsString`/`@MaxLength` 会把非空合法值判 400。正确做法：`@ValidateIf((_, v) => v !== '')` 或 `@Transform(({value}) => value === '' ? undefined : value)` |
| part-01/026（全章） | 漏了 Nest 12 的 `NEST_LOG_LEVEL` 环境变量 | `@nestjs/common/services/utils/get-env-log-levels.util.js`（`LOG_LEVEL_ENV_VAR = 'NEST_LOG_LEVEL'`，格式同 `filterLogLevels`，支持 `>=warn`/`warn,error`）在 ConsoleLogger 首次检查级别时读取。ch026 只讲了 `app.useLogger(['error'])` 和 `filterLogLevels`，少了「运维不改代码改日志级别」这条最常用的路 |

### 过时写法

| 章节:行号 | 过时点 | 现况 |
| --- | --- | --- |
| README / part-01/003:97 / 010:9 / 013:142 | 「TypeScript 5.9+/6.x」「TS 5 的 stage 3 装饰器」 | TS 7.0.2 已 GA（2026-07-08）；Nest 12 脚手架实际装 `typescript ^6.0.2`。书基线应至少写 TS 6（7 作为可选升级路径），并说明 stage-3 装饰器 + `emitDecoratorMetadata` 在 6/7 下的行为 |
| part-01/003:61-75（package.json 示例） | 只有 build/format/start/start:dev/start:debug/start:prod，无 `lint`/`test`/`test:e2e`/`deploy` | schematics 12.0.12 模板实际含 `"deploy": "nest deploy"`、`"lint": "oxlint --type-aware src/ test/"`、`"test": "vitest run"`、`"test:e2e": "vitest run --config ./vitest.config.e2e.ts"`，devDeps 含 vitest/@vitest/coverage-v8/oxlint/oxlint-tsgolint/@nestjs/testing/supertest。要么照实写，要么标注「以下为最小示例，脚手架实际内容见 …」 |
| part-01/003:81-95（tsconfig 示例） | 缺 `rootDir`、`types: ["vitest/globals","node"]`、`isolatedModules`，且没标「简化版」 | 与 ch004:315 依赖的 `vitest/globals` 类型冲突；脚手架是 `module/moduleResolution: nodenext` + `rootDir: "."` + `types: [...]`，`tsconfig.build.json` 另设 `rootDir: "./src"` |
| part-00/001:133 `--skip-tests` | 与 vitest 脚手架口径冲突 | 脚手架逻辑是 `spec`（默认 true）决定是否生成 `test/` 与 vitest 配置；`--skip-tests` 传不传都要在正文交代「默认会生成 vitest 测试」，否则读者后面看到 `types: ["vitest/globals"]` 会以为是凭空来的 |
| part-01/011:353 | `void bootstrap()` | 全书其余章（如 003）都是顶层 `await bootstrap()`；脚手架 main.ts 也是顶层 `await`，统一即可 |
| part-01/006:82-83、024:207 | 示例日志行写成 `[UserService] findById...` / `[Nest] LOG [NestApplication]` | Nest Logger 实际格式是 `[Nest] <pid>  - <YYYY/MM/DD HH:mm:ss>     LOG [<context>] <message>`（ch017:234、019:214 写对了，说明是局部不一致）。照实写或标注「省略了前缀」 |
| part-01/023:74 | 固定 `typescript@5.9.3` 做独立 Express 实验 | 可接受（本章不装 Nest），但全书基线已是 TS 6/7，建议注明「此实验刻意用 TS 5.9，避免与 Nest 基线混淆」 |

## P2 一致性与可读性

- **未发现悬空交叉引用**：全 28 章的「第 N 章」/`chapters.tsv` 对照复核后，004:378「第 227 章」确有对应规划（chapters.tsv 第 228 行 = 227-Webhooks签名验签与防重放，part-24），先前「悬空」判断撤销。其余引用也都能在 chapters.tsv 找到对应章；真正的问题是**引用了尚未写的章节而不自知**（227、277 等在 part-24/30），读者点进去只有 `_part.md`，建议在 part-01 统一加一句「第 54 章以后为规划中章节」。
- part-01/004:168「请求体 = POST/PUT」漏 PATCH/DELETE（虽然下文提到 PATCH，表格口径不严）。
- part-01/004:388-390 把 VO/Mapper/DAO 引到「第 22 章、第 50 章」：ch022 是概念串讲、ch050 不在 chapters.tsv 的已写范围（part-03 到 53，但第 50 章标题是 SQL/数据库向），引用不准。
- part-01/009:13、009:25 说「第 1 章讲过元数据/DTO」，但开篇词（第 1 章）没讲，实际在 ch004/ch010。
- part-01/010:116 用 `@Self() logger: Logger` 举例不当：`Logger` 不是 Provider，`@Self()` 用于限定从当前模块解析 token，这个例子会让读者误以为内置 Logger 可注入。
- part-01/010 标题「一网打尽 Nest 全部装饰器」但漏了 `applyDecorators`（ch012 才出现），标题口径过大。
- part-01/021:253「有网关时优先用 APP_FILTER」误导：APP_FILTER 同样进不了 WebSocket 网关（`@nestjs/websockets/context/exception-filters-context.js` 的 `getGlobalMetadata()` 返回 `[]`），网关只能用 `@UseFilters`。前半句「useGlobalFilters() 不覆盖网关和混合应用」是对的。
- part-01/027:206 拼写 `maxsize`，与 ch028 的 `maxSize`（Winston 实际选项名）不一致；027:158「给 transport 加 `handleExceptions: false` 关掉异常元数据」也需复核 winston 3 的正确开关（winston 3 的异常元数据由 `exceptionHandlers` 决定，transport 上的 `handleExceptions` 已不是这个用途）——建议改查 winston 官方 Exception handling 文档后重写。
- part-01/028:102「手动 `app.flushLogs()`」与 `autoFlushLogs` 的关系没讲清：`autoFlushLogs` 是初始化时自动 flush（默认 true），手动 flush 用于自己控制时机，两者不是替代关系。
- part-01/013:142「Nest 12 里默认写法变了」应说明是 schematics 12 的模板变化（旧 CLI 仍生成 `SetMetadata`），否则读者用旧版本会困惑。
- **「未实测」声明共 19 处**（015:351、016:275、017:189、018:167/284、019:207、020:220/234/255/263/361、021:329、022:328、028:313 等）。建议统一策略：能实测的实测；不能实测的改成「示意输出」并删掉具体时间戳/耗时等不可复现数字。
- part-01/024:57「Fastify 下这一组要换成 platform-fastify 版本」不精确：`@nestjs/platform-fastify@12.6.0` 确实导出 `multipart/index` 的 FileInterceptor/FilesInterceptor（需 `@fastify/multipart`），但 `@UploadedFile`/`ParseFilePipe`/`FileTypeValidator` 仍来自 `@nestjs/common`。
- part-01/024 上传章节用 `@nestjs/platform-express`，而 ch016 说 v12.3 起推荐 `@nestjs/platform-node`：若后续按 NodeAdapter 搭建，`FileInterceptor`/`MulterModule` 要从 `@nestjs/platform-node` 导入（官方 Other packages 段），需在 ch016 或 ch024 加一句适配器切换说明。

## 逐章问题表

| 章 | 标题（简） | 主要问题 | 严重度 |
| --- | --- | --- | --- |
| 001 | 开篇词 | CLI `@12.3.0` 不存在（:133）；编造 observe 交互（:130）；`--skip-tests` 与 vitest 冲突；TS 5.9 基线过时 | **P0** |
| 002 | 5 个学习理由 | 质量较好；P2 链接指向 TS5 装饰器手册，已过时 | P2 |
| 003 | Nest CLI | 同样用 `@12.3.0`（:51/57/153/155/196）→P0；package.json/tsconfig 示例与真实脚手架不符、漏 deploy/lint/test 脚本；未提 `nest deploy`/`observe` | **P0** |
| 004 | 5 种 HTTP 数据传输 | 请求体口径漏 PATCH/DELETE（:168）；VO 引到「第 22 章」不准（VO 在 ch277，ch22 只是概念串讲）；Entity 引 ch44/45 正确；`types` 口径与 ch003 冲突 | P2 |
| 005 | IoC 痛点 | 质量高；请求/瞬态作用域仅一句（:115），Part 01 无专章 | P1 |
| 006 | 调试 Nest | 质量高；示例日志缺 `[Nest] pid - 时间` 前缀（:82-83）；pnpm attach 未给直连 node 的替代 | P2 |
| 007 | 多种 Provider | 质量高；`useExisting` 表格「能否注入依赖=否」表述含混（:33） | P2 |
| 008 | 全局模块与生命周期 | 质量高；`enableShutdownHooks` 新签名与 `useProcessExit` 未提 | P1 |
| 009 | AOP | 质量高；Prisma 8 仍为 RC 却当稳定版（:100）；引用「第 1 章」不实 | P1 |
| 010 | 全部装饰器 | 准确；标题漏 `applyDecorators`；`@Self() Logger` 举例不当；「TS 5 标准版」过时 | P2 |
| 011 | ExecutionContext | 质量高；`void bootstrap()` 与全书顶层 await 不一致；锁 `^12.3.0` | P2 |
| 012 | 自定义装饰器 | 优秀且最新；泛型用法前后不一致 | P2 |
| 013 | Metadata/Reflector | 优秀；未说明「默认写法变化」来自 schematics 12 模板 | P2 |
| 014 | 循环依赖 | 质量高；链接标签与目标不符（:17）；`forwardRef` 表格口径偏窄 | P2 |
| 015 | 动态模块 | 质量高；「未实测」（:351）；未提 `setFactoryMethodName` | P2 |
| 016 | Express/Fastify/NodeAdapter | 内容最新（NodeAdapter 属实）；基准数字无比较对象（:81）、`app.use` 说法错（:155） | P1 |
| 017 | Middleware | `NextFunction` 从 node:http 导入 → TS2305（:245）；「未实测」 | **P0** |
| 018 | RxJS/Interceptor | 质量高；「未实测」；缺 ClassSerializerInterceptor/序列化 | P1（遗漏）+P2 |
| 019 | 内置/自定义 Pipe | 质量高（原疑「正则双反斜杠」经 repr 复核为误报，代码正确）；「未实测」 | P2 |
| 020 | ValidationPipe | 优秀且最新（`errorFormat`/`StandardSchemaValidationPipe`/`@Body({schema})` 均属实）；`@IsEmpty` 建议不当；多处「未实测」 | P2 |
| 021 | 自定义 ExceptionFilter | 质量高（过滤器反序/首匹配/`errorCode`/`IntrinsicException` 均与源码一致）；「有网关优先 APP_FILTER」误导 | P2 |
| 022 | 图解串讲 | 质量好；Prisma 第 44 章引用正确；「未实测」；`@12` 浮动非书基线 | P2 |
| 023 | Express + multer | 质量高；TS 5.9.3 固定需注记 | P2 |
| 024 | Nest + multer | 质量高（12.0.4 合并/12.2.0 清理/校验文案全部实核）；版本归属错误（:265）；Fastify 措辞（:57）；日志格式 | P1 |
| 025 | 大文件分片上传 | 无 P0/P1；`app.use` 注册顺序未说明 | P2 |
| 026 | Nest Logger | 质量高（阈值级联/`filterLogLevels`/JSON 字段全对）；漏 `NEST_LOG_LEVEL` | P1 |
| 027 | 为什么用 Winston | 质量高；`maxsize` 拼写、`handleExceptions:false` 待复核 | P2 |
| 028 | Nest 集成 Winston | 最新（nest-winston 2.0.0 / Nest 12 门面签名均属实）；轮转未实测；`flushLogs` 与 `autoFlushLogs` 未区分 | P2 |

## 参考来源

- npm registry：https://registry.npmjs.org/@nestjs/cli 、https://registry.npmjs.org/@nestjs/core 、https://registry.npmjs.org/@nestjs/schematics 、https://registry.npmjs.org/@nestjs/platform-express 、https://registry.npmjs.org/@nestjs/platform-fastify 、https://registry.npmjs.org/nest-winston 、https://registry.npmjs.org/prisma
- 官方文档：https://docs.nestjs.com/http/performance#choosing-an-adapter （NodeAdapter/benchmark）、https://docs.nestjs.com/techniques/logger 、https://docs.nestjs.com/exception-filters 、https://docs.nestjs.com/pipes 、https://docs.nestjs.com/techniques/file-upload 、https://docs.nestjs.com/fundamentals/lifecycle-events 、https://docs.nestjs.com/fundamentals/dynamic-modules 、https://docs.nestjs.com/middleware
- 源码核对（@nestjs/core@12.6.0 / @nestjs/common@12.6.0）：`injector/injector.js:383-385`（forwardRef）、`errors/messages.js:92`（DI 报错文案，结尾为 “available in the ${contextLabel} module.”，书中写法正确）、`exceptions/exceptions-handler.js`、`router/router-exception-filters.js`、`helpers/context-creator.js`、`exceptions/intrinsic.exception.js`、`interceptors/interceptors-consumer.js`、`services/reflector.service.d.ts`、`pipes/parse-uuid.pipe.js`、`pipes/validation.pipe.d.ts`、`pipes/standard-schema-validation.pipe.js`、`exceptions/http.exception.js`、`services/logger.service.d.ts`、`services/utils/get-env-log-levels.util.js`、`services/utils/filter-log-levels.util.js`、`module-utils/interfaces/configurable-module-async-options.interface.d.ts`
- @nestjs/schematics@12.0.12：`dist/lib/application/schema.json`、`dist/lib/application/files/ts-esm/`（package.json / tsconfig / main.ts / vitest 配置）
- @nestjs/platform-fastify@12.6.0：`adapters/fastify-adapter.js:1155`（use）、`multipart/index.js`
- 本地实测：path-to-regexp v8 通配符匹配、zod 4.6.7 API、@types/node 24.10.1 `http.d.ts` 无 `NextFunction`

---

# 附录：逐章详细记录（ch001–ch028）

### （工作记录，ch001–ch006）

#### ch001 开篇词
- P0 `part-00/001-开篇词.md:133`：`pnpm dlx @nestjs/cli@12.3.0 new ...` —— CLI 12.3.0 不存在（最新 12.0.15），命令必失败。
- P0 `part-00/001-开篇词.md:130`：「交互里选 ESM，NestJS Observe 选 No」—— schematics schema 中 observe 无交互提问（默认 false），不存在这个选项。
- P1 `part-00/001-开篇词.md:119`：「CLI 生成器要求 22.22.3 起」需核实；22.22.3 是某时点版本，硬编码过时。
- P1 `part-00/001-开篇词.md:133`：`--skip-tests` 与 Nest 12 vitest 脚手架口径不一致；后文 ch004:315 又出现 `vitest/globals`，说明 template 带 vitest，书里从未解释「为什么跳过、怎么补」。
- P2 `part-00/001-开篇词.md:216`：「接下来的二十八章」实际本节+Part01 共 28 章，但「接下来」从 ch1 起算易误解。
- 正确项：ESM `.js` 后缀说明、`ERR_MODULE_NOT_FOUND`、`type: module`、`node dist/main.js`、`NEST_DEBUG` 均与实物一致。

#### ch002 五个理由
- P1 `part-00/002-给你5个学习Nest的理由，你会心动么.md:163`：「脚手架默认开了 emitDecoratorMetadata」属实，但同时说「design:paramtypes 元数据」在新 TS/ESM 下成立，需注意 `@Injectable()` 仍依赖 legacy decorators；可接受。
- P2 图 2-1「四入口共用容器」说法正确。
- 代码 `QuotesService.random()` 返回 `Quote` 但 `this.quotes[...]` 可能 undefined，已判空；TS 严格下 OK。
- 引用 TypeScript 装饰器文档为 TS5 手册，未提 TS 6/7 基线（README 5.9+/6.x，实际 TS 7 GA）→ 全局版本基线问题，见总表。

#### ch003 快速掌握NestCLI
- P0 `part-01/003-快速掌握NestCLI.md:51,57,153-155,196`：`@nestjs/cli@12.3.0` 不存在（4 处），`nest info` 输出 CLI 12.3.0 为伪造样例。
- P1 `part-01/003-快速掌握NestCLI.md:61-75`：给出的 package.json 与真实 Nest 12 脚手架不符：缺 `deploy`/`lint`/`test`/`test:e2e` 脚本与 vitest/oxlint/@nestjs/testing devDeps；`engines` 与 `packageManager` 字段非模板内容。
- P1 `part-01/003-快速掌握NestCLI.md:81-95`：tsconfig 示例漏 `types: ["vitest/globals","node"]`、`rootDir`、`isolatedModules` 等；而 ch004:315 又假定 `types` 里有 vitest/globals，前后矛盾。且书中未说这是「简化版」。
- P1 `part-01/003-快速掌握NestCLI.md:97`：「TS 5 里还有一套 stage 3 装饰器」——基线已是 TS 6/7，措辞过时。
- P1 `part-01/003-快速掌握NestCLI.md:147`：讲 `nest add`/`nest upgrade` 却完全没提 Nest 12 新增 `nest deploy`、`@nestjs/observe`、`@nestjs/mau`（模板 devDeps 有 mau）；CLI 章节漏 Nest 12 新能力。
- P2 `part-01/003-快速掌握NestCLI.md:165`：`pnpm start:dev` 日志断言、`--watch` 不监听 `.env`/`tsconfig` 基本正确。
- P2 `part-01/003-快速掌握NestCLI.md:172-185`：`dist/src/main` 解释正确，但没提脚手架 tsconfig.build.json 默认已解决此问题。

#### ch004 5 种 HTTP 数据传输方式
- P2 `part-01/004-5种HTTP数据传输方式.md:378`：引用「第 227 章」Webhook —— chapters.tsv 第 228 行确有「227-Webhooks签名验签与防重放」，**不是悬空引用**（先前判断撤销）；但 227 章尚未写，读者点击只有占位，建议标注「规划中」。
- P1 `part-01/004-5种HTTP数据传输方式.md:388-390`：VO/Mapper「第 22 章细讲」、DAO/Repository「第 22、50 章」——ch022 是概念串讲，需核对是否真讲；ch050 是 Prisma 集成。疑似引用错误。
- P2 `part-01/004-5种HTTP数据传输方式.md:315-326`：提到脚手架 `types: ["vitest/globals","node"]` 与 ch003 展示的 tsconfig 冲突（见 ch003）。
- P2 `part-01/004-5种HTTP数据传输方式.md:168`：「请求体就是 POST/PUT 请求里」忽略 PATCH/DELETE body，小瑕疵。
- 其余准确：Content-Type/body parser、100KB JSON 限制、路由顺序、multipart boundary、`@types/multer` 报错 `TS2694`。
- 注意 `004:293` `Array<Express.Multer.File>` 需 `@types/multer`，书中已补。

#### ch005 IoC
- P1 `part-01/005-IoC解决了什么痛点问题.md:277`：报错文案「available in the UsersModule module.」——需核对 v12 实际为 "context."；若是 module 则为细节错（待源码确认）。
- P1 `part-01/005-IoC解决了什么痛点问题.md:115`：请求作用域/瞬态只一句带过，Part 01 无专章；官方 Injection scopes 是核心基础，规划到 ch262（Part 28）太晚，建议 Part 01 补。
- P2 `005:204` import vs import type 注入的说明正确且重要。
- P2 `005:286` useClass 不做类型兼容检查 — 正确。
- 其余：Provider/token/consumer、模块作用域、单例、DIP 讲得扎实。

#### ch006 调试
- P1 `part-01/006-如何调试Nest项目.md:82-83`：示例日志 `[UserService] findById ...` 与 Nest 实际输出格式（`[Nest] pid - date LOG [UserService] ...`）不符，示例输出失真。
- P1 `part-01/006-如何调试Nest项目.md:120-127`：`runtimeExecutable: "pnpm"` + `autoAttachChildProcesses` 组合在部分平台不稳，未给「直接 node dist/main.js」的替代 launch 配置（只在正文一句带过）。
- P2 `006:203` `NEST_DEBUG` 属实。
- P2 `006:9` inspect/inspect-brk、source map、9229 正确；`--debug [host:port]` 正确。
- 其余质量高。

### （工作记录，ch007–ch013）

#### ch007 多种 Provider
- 质量高，机制/边界/验证都对。`useClass` vs `useExisting` 双实例对照实验写得好。
- P2 `007:33` 表格 `useExisting` 列「工厂/值能否注入依赖=否」表述含混（别名目标自身可以是工厂产物），不影响结论。
- 正确项：类/抽象类/字符串/Symbol 四种 token、interface 编译后消失、`@Inject` 覆盖 `design:paramtypes`、`inject` 按位置传、异步工厂、`useValue` 共享引用。
- 小瑕疵：`007:246` 示例出参 `version:"locale-zh-CN"` 依赖工厂逻辑，正文已解释，可接受。

#### ch008 全局模块与生命周期
- 质量高。P1 遗漏：Nest 12 的 `enableShutdownHooks(signals?, options?)` 新签名与 `options.useProcessExit`（为 Pino 等异步日志刷 buffer）完全没提；证据 `/tmp/nestcore/package/nest-application-context.js:207-212`：`enableShutdownHooks(signals = [], options = {})`，关闭后默认 `process.kill(process.pid, signal)`，`useProcessExit` 时 `process.exit(0)`。ch026–028 讲 Winston/Pino 时也没回扣这个开关。
- 正确项：五钩子顺序/逆序、`@Global()` 只改可见性、默认不启用关闭钩子、`app.close()` 不退出进程、`forceCloseConnections`、请求作用域无模块钩子、Windows 无 SIGTERM。
- P2 `008:313-318`、`008:336-341` 示例日志缺 `[Nest] pid - date LOG` 前缀（与 ch006 同类），但正文声明「只看顺序」，可接受。

#### ch009 AOP
- 质量高，五层切面边界、洋葱顺序、APP_INTERCEPTOR 容器注册、`tap` vs `finalize`、`hrtime` 都正确。
- P1 `009:100`「Part 02 会整体换成 PostgreSQL 17 + Prisma 8」：Prisma 8 截至 2026-11-21 仍是 RC（npm `prisma` dist-tags.latest = `8.0.0-rc.34`），chapters.tsv 第 56 章标题也写 Prisma8；教学基线选未 GA 大版本有风险，应标注 RC 或回落 7.x。
- P2 `009:24` Guard「不能改响应体」严格说 Guard 可注入 res 改头，但作为定位建议可接受。
- P2 `009:417-420` 示例日志同样缺 Nest 前缀。
- 正确项：`009:446` Express 未匹配路由由 finalhandler 处理、全局过滤器接不到；Express/Fastify 差异提示（ch016 回扣）。
- 交叉引用：`009:13`「第 1 章讲过」元数据、`009:25`「DTO 第 1 章讲过」——第 1 章是开篇词，元数据/DTO 实际首次出现在第 4/10 章，引用不准（P2）。

#### ch010 全部装饰器
- 总体准确。`@Version`/`enableVersioning`/`VERSION_NEUTRAL`/`setGlobalPrefix` 语义、`@Header` 只收字符串、`@Res()` 抢响应、`@RawBody` 需 `rawBody:true`、`@Session` 适配器差异均正确。
- P2 标题「全部装饰器」但漏 `@ApplyDecorators`（Nest 内置，ch012 才出现）；`@WebSocketGateway`/`@MessagePattern` 等按后续 Part 规划可接受，但应声明「本章只覆盖 HTTP/REST 核心」。
- P2 `010:116` `@Self() logger: Logger` 举例不当：`Logger` 不是可注入 Provider。
- P2 `010:9`「TS 5 的标准版」措辞过时（基线 TS 6/7）。
- 待核：`010:286` 「VERSION_NEUTRAL 在 URI 版本化下只挂无版本地址，/api/v1/... 也 404」——与官方文档描述一致，未实测。

#### ch011 ExecutionContext
- 质量高，`getArgs()` 四传输层形状、`getType` 泛型只是编译期、`never` 兜底、hybrid app、`startAllMicroservices()` 在 `listen()` 前均正确。
- P2 `011:353` 用 `void bootstrap()`，与全书「顶层 await bootstrap()」口径不一致（其他章为 `await bootstrap();`）。
- P2 `011:78` 固定 `^12.3.0` 安装 websockets/microservices/platform-socket.io：这些包 12.x 已到 12.6.0，锁 12.3.x 与 README「12.3.x」一致，但与 registry 最新差 3 个小版本，应说明基线锁定策略。
- 待核：`011:311`「`@SubscribeMessage` 写进普通 Controller 不会报错但永远不会被调用」——@nestjs/websockets 的 `socket-module.js:45` 用 `metadataKeys.includes(GATEWAY_METADATA)` 判网关，Controller 无该元数据故不会被订阅，结论成立。
- 其余：socket.io client/ack、`@ConnectedSocket`、namespace、`ClientProxyFactory.create` 均正确。

#### ch012 自定义装饰器
- 优秀且最新：`createParamDecorator` 工厂「定义期跑一次」、`@CurrentUser` 取值、`applyDecorators` 打包、`Reflector` 注入均正确。
- 正确项（已核对 @nestjs/common 12.6.0 源码）：`StandardSchemaValidationPipe` 真实存在并顶层导出；`validateCustomDecorators` 默认 false；`createParamDecorator` 返回的装饰器支持 `(data, options?)`，`options.schema` 走 `ParameterDecoratorOptions`，源码 `decorators/http/create-route-param-metadata.decorator.js` 明确处理 schema/options。
- P2 `012:62` 代码未用 `createParamDecorator<keyof AuthUser>` 泛型，而 `012:155` 又建议加泛型，前后小不一致。
- P2 `012:189` 从 `@nestjs/common` 导入 `StandardSchemaValidationPipe` 正确（pipes/index.js 导出）。
- 提示：`z.email()` 为 Zod 4 API，书中 `zod@^4.6.7` 一致。

#### ch013 Metadata 和 Reflector
- 优秀且准确。`Reflector.createDecorator`、`get/getAll/getAllAndOverride/getAllAndMerge` 语义、`[handler, class]` 顺序、空数组算「已定义」、`nest g decorator` 新模板均正确。
- 正确项（源码核对）：`@nestjs/core/services/reflector.service.d.ts` 的 `getAllAndOverride(decorator, targets)` 重载存在，`getAllAndMerge` 对数组 concat、对象浅合并；@nestjs/schematics 12.0.12 `decorator` 模板实物就是 `export const <%= classify(name) %> = Reflector.createDecorator<string[]>();`。
- P2 `013:142`「Nest 12 里默认写法变了」——应说明是 schematics 12 模板变化，读者若用旧版本 `nest g decorator` 仍是 `SetMetadata`。
- 正确项：`013:391` 合并顺序 `bookings,mine,v1` 与 `[handler, class]` 一致。

### （工作记录，ch014–ch016）

#### ch014 循环依赖
- 质量高，且是少见地把 ESM 求值层与 Nest 容器层分开讲清的一章。三层错误（可见性/模块实例/ESM TDZ）的拆解准确。
- 正确项（源码核对）：`@Inject(forwardRef(() => STRING_TOKEN))` 合法——`@nestjs/core/injector/injector.js:383-385` 对任意 param 先判 `'forwardRef' in param` 再 `return param.forwardRef()`，字符串令牌同路径。`ModuleRef.get(token,{strict:false})` 查全局容器、取不到 request/transient 需 `resolve` + `ContextIdFactory`，均与官方一致。`useExisting` 令牌别名 + `exports` 双导出正确。
- P2 `014:17` 链接标签写 "Modules"，URL 指向 `typescriptlang.org/docs/handbook/2/modules.html`，标签与目标不符。
- P2 `014:378` 表格「`forwardRef` 只维护 CJS 项目」过于绝对：ESM 下无运行时环（import type + 令牌）时仍可能只剩容器环需要 forwardRef，正文其实讲对了，表格口径偏窄。

#### ch015 动态模块
- 质量高：`register`/`forRoot`/`forFeature` 命名约定、DynamicModule 必填 `module`、`forRootAsync` 的 `imports`/`inject` 语义、`ConfigurableModuleBuilder`、`setExtras`、`MODULE_OPTIONS_TOKEN` 全部正确。
- 正确项（源码核对）：`ConfigurableModuleOptionsFactory<Options, 'create'>` 是真实导出类型（`@nestjs/common/module-utils/interfaces/configurable-module-async-options.interface.d.ts:9`：`Record<`${FactoryClassMethodKey}`, () => Promise<ModuleOptions> | ModuleOptions>`，经 `index.d.ts` → `module-utils/index.d.ts` → `export type *` 暴露），`import type` 可用。`setExtras` 默认值 + transform 写法与官方示例一致。`015:90`「每次 forRoot 生成独立模块节点」在 v12 默认按引用生成模块标识的前提下成立。
- P2 `015:351`「以上是示例输出（未实测）」——章节其它段落都声称跑过，唯独这里声明未实测，口径不一致；且这类 curl 状态码输出没有「未实测」的必要。
- P2 未提 `setFactoryMethodName`（异步工厂方法名）与 `forRootAsync` 的 `useExisting` 分支细节，属可接受的取舍。

#### ch016 Nest 与 Express/Fastify（含 NodeAdapter）
- 重要结论：`@nestjs/platform-node` 真实存在（12.3.0 发布于 2026-10-27，最新 12.6.0），导出 `NodeAdapter`/`NestNodeApplication`/`NodeRequest`/`NodeResponse`/multer 拦截器；官方 v12.3 起推荐 NodeAdapter、v13 将设为默认（https://docs.nestjs.com/http/performance#choosing-an-adapter）。本章不是幻觉，反而是全书最新的部分。
- P1 `016:81` 基准数字口径：「比 FastifyAdapter 多约 5%」与官方 FAQ 文字（NodeAdapter 比裸 Fastify 少约 3%、比 Hono 多约 5%、比 Express 多约 50%）易冲突；官方 benchmark 表：Fastify 57.1k / Nest on Node 55.6k / Hono 53.1k / Nest on Fastify 52.6k / Express 37.0k。若比较「Nest on Fastify(52.6k) → Nest on Node(55.6k)」则 +5.7%，书中结论勉强成立，但正文没写「和谁比」，读者会误读，应补基准表口径。证据 https://docs.nestjs.com/http/performance#performance 。
- P1 `016:155`「`app.use()` 是 Express 的方法，Fastify 实例上根本没有」：Nest 的 `app.use()` 在 Fastify 适配器下是支持的（`@nestjs/platform-fastify/adapters/fastify-adapter.js:1155` `use(...args)` 经 `@fastify/middie` 包装注册）。正确说法是「裸 Fastify 实例没有 `use`，Nest 的 `app.use`/中间件仍可用；Fastify 插件必须走 `register()`」。
- 正确项：`NestFastifyApplication` 泛型、`listen(port,'0.0.0.0')`（Fastify 默认 localhost）、`@Redirect` 两个适配器都生成 302+Location、`trustProxy` 传数字＝不信任任何代理（Fastify 文档 trustProxy 条目：number 的 hop-count-only 已被禁用）均正确。
- 正确项：NodeAdapter 的 Express 兼容边界 `res.render()/res.download()/res.format()/req.accepts()` 不可用，官方 Express compatibility 列表一致；`res.status/json/send/sendFile/redirect/cookie/type` 等确实存在（`adapters/node-request.d.ts:199-272`）。路由按具体度匹配、大小写敏感、返回字符串按 `text/plain` 也与官方一致。
- P2 `016:124` 说 NodeAdapter「常见 helmet、compression、cookie-parser 可以直接用」正确（官方列了同一批），但没提 NodeAdapter 下文件上传要从 `@nestjs/platform-node` 导入 `FileInterceptor`/`MulterModule`（ch023/ch024 讲上传时若仍写 `platform-express` 会与本章冲突，待核）。

## 逐章问题（工作记录，ch017–ch028）

### ch017 Middleware
- **P0 `017:245`**：`import type { NextFunction, IncomingMessage, ServerResponse } from 'node:http';` —— `NextFunction` 不在 `node:http`（@types/node 24.10.1 `http.d.ts` 零命中），来自 `express-serve-static-core@5 index.d.ts:26`；TS2305，函数中间件示例编译失败。应 `import type { NextFunction } from 'express';`（017:63 已正确）。另：把 `(IncomingMessage, ServerResponse)` 传给 Express 的 `app.use` 在 strictFunctionTypes 下也可能报参数不兼容，建议直接用 `Request, Response`。
- 正确项：函数版 vs 类版、`app.use` 拿不到 DI、`configure()`/`forRoutes`/`exclude`、exclude 路径不含全局前缀（017:183）均对；日志格式（017:234）含 `[Nest] pid - 日期 LOG`，全书写对的一处。
- 本地实测 path-to-regexp v8：`*splat` 可编译；`{*splat}` 允许空；裸 `*` 抛 `Missing parameter name at index 1`；`health/*splat` 至少吃一段、不匹配 `/health` → 017:274-275 两条建议准确。
- P2 `017:189`「示例输出，未在本地起服务实测」。

### ch018 RxJS 和 Interceptor
- 质量高：Observable 冷/热、只组装不订阅、`timeout({each,first})`、`catchError` 原样 rethrow、`@Res({passthrough})` 正确。
- 源码核对：`@nestjs/core/interceptors/interceptors-consumer.js` `subscribeLevel(0, subscriber)` + `interceptors[i].intercept(context, createHandler(i+1))` → index 0 最外层，018:73「先注册的在外层、map 最后执行」正确。
- P1 遗漏：没讲 `ClassSerializerInterceptor` + class-transformer（`@Exclude/@Expose/@Transform`），响应序列化在 part-01 没有落点（规划在 ch277）。
- P2 `018:167/284`「未实测」；021/028 也有，全书共 19 处。

### ch019 内置 Pipe 和自定义 Pipe
- 质量高，无 P0/P1。**原疑点撤诉**：019:347 `!/^\d+$/.test(raw)` 经 python repr 复核文件里是单反斜杠（`^\d+$`），正则正确，`page=2` 不会误 400；先前「双反斜杠」判断为误读。
- 正确项（源码核对）：`ParseUUIDPipe` 正则覆盖 v1–8+all+Nil/Max；`UUIDVersion` 数字 1–8 自 12.1.2 起支持（12.1.1 仍是 `'3'|'4'|'5'|'7'`）→ 019:283 精确；`DefaultValuePipe` 每次复制数组/普通对象 → 019:68/285 正确；`ParseDatePipe` 用 `new Date` + `hasDayPastMonthEnd` 拒 2026-02-30、空串报 `Validation failed (no Date provided)` → 019:284 正确；`ArgumentMetadata.schema` 在 12.6.0 存在、11.1.6 不存在 → 019:46「Nest 12 新增」正确；启动日志格式（019:214）正确。
- P2 `019:207`「示例输出，未在本地起服务实测」（该段还带启动日志，声明后读者没法核对）。

### ch020 ValidationPipe
- 优秀且最新：`errorFormat: 'list'|'grouped'` 真实（validation.pipe.d.ts:12，默认 'list'）；`StandardSchemaValidationPipe` 真实（`transform` 默认 true、`validateCustomDecorators` 默认 false）；`@Body({ schema })` 真实（`create-route-param-metadata.decorator.js` 的 isDataOptions 分支；`ParameterDecoratorOptions{schema,pipes}` 见 route-params.decorator.d.ts:8-18）；zod 4.6.7 实测：`z.iso.datetime({offset:true})` 拒 2026-02-30、`z.email`/`z.uuid` 顶层函数、`z.strictObject` 报 `Unrecognized key: "isAdmin"`、`z.object` 剥键、`z.looseObject` 保留。
- P2 `020:149/381` 建议 `@IsEmpty()` 不当（`@IsEmpty` 断言必须为空，不是「为空则跳过」；配 `@IsString` 会误杀合法值），应 `@ValidateIf((_, v) => v !== '')`。
- P2 `020:220/234/255/263/361` 五处「示例输出（未实测）」。

### ch021 自定义 ExceptionFilter
- 质量高。源码核对：`@nestjs/core/router/router-exception-filters.js` `create()` 里 `exceptionHandler.setCustomFilters(filters.reverse())`，`helpers/context-creator.js` 产生 `[...global, ...class, ...method]` → 反序后方法级最先 → 021:83「方法级覆盖全局」正确；`@nestjs/common/utils/select-exception-filter-metadata.util.js` 用 `filters.find(...)` 只取首个匹配 → `@UseFilters(CatchAll, HttpFilter)` 反序后具体类型先命中、其余落 CatchAll，021:85 正确。
- 正确项：`HttpExceptionOptions.errorCode` + `initErrorCode()` 仅在有值时设置、`createBody` 仅在 errorCode 真值时加字段 → 021:50/53/228「不传就没有」正确；`IntrinsicException` 真实且 `HttpException extends IntrinsicException`，`BaseExceptionFilter.handleUnknownError` 对 IntrinsicException 不打日志 → 021:48 正确。
- P2 `021:253`：前半「`useGlobalFilters()` 不覆盖 WebSocket 网关和混合应用」正确（`@nestjs/websockets/context/exception-filters-context.js` `getGlobalMetadata(){ return []; }`）；后半「有网关时优先 APP_FILTER」误导，APP_FILTER 同一路径也进不了网关，网关必须 `@UseFilters`。
- P2 `021:329`「示例输出（未实测）」。

### ch022 图解串一串 Nest 核心概念
- 质量好：trace 顺序（middleware→guard→interceptor→pipe→handler→interceptor→filter）、守卫短路、pipe 抛错能被 `catchError` 看见、`forRoutes(TraceController)` 展开为精确路由、`forRoutes('*splat')` 覆盖 404 均与 Nest 内部一致。
- 正确项：022:104「Prisma 是第 44 章」正确（chapters.tsv 第 44 行 =「快速掌握Prisma8」）；022:119 `@nestjs/cli@12` 解析到 12.0.15 可用（仅 ch001/ch003 的 `@12.3.0` 是 P0）。
- P2 `022:328`「示例输出（未实测）」；P2 022:119 用 `@12` 浮动安装，与书基线 12.3.x 口径不一致（应写 `@12.0.15` 并说明）。

### ch023 Express + multer
- 质量高：multipart boundary/body parser 跳过、multer 四件事、`fileFilter` 先于落盘、`limits` 边读边称、diskStorage UUID 命名、魔数检测（PNG 8 字节 / JPEG `ff d8 ff` / WebP `RIFF`+`WEBP`）、MulterError→413/415、Express 5 async rejection 自动转错误中间件、`express.static` XSS 警告均正确。
- P2 `023:74` 固定 `typescript@5.9.3` 做独立实验可接受，但需注记与全书 TS 6/7 基线不同。
- P2 `023:370` 示例 JSON 里 `\\"file\\"` 双重转义（显示层问题，读者照抄会看到 `\\"`）。

### ch024 Nest + multer
- 质量高，关键版本声明逐条实核 @nestjs/platform-express：`mergeMulterOptions` 确在 **12.0.4** 引入（12.0.3 的 `file.interceptor.js` 仍是 `{...options,...localOptions}` 整体替换）→ 024:160 正确；`removeFilesOnPipeRejection`/`REJECTED_BY_PIPES` 确在 **12.2.0** 出现（12.1.6 无）→ 024:195 正确；`FileTypeValidator` 错误文案与 12.6.0 `buildErrorMessage` 完全一致 → 024:78/88 正确；`memoryStorage` 默认、`ParseFilePipe`/`FileTypeValidator` 导入正确。
- **P1 `024:265`**：「Nest 12.3 给 FileTypeValidator 加了 `fallbackToMimetype` 和 `overrideMimeType`」错误——`fallbackToMimetype` 在 @nestjs/common 11.1.6 已有，`overrideMimeType` 至少 12.0.0 已有。
- P2 `024:57`：Fastify 下「这一组要换成 platform-fastify 版本」不精确；`@nestjs/platform-fastify@12.6.0` 有 `multipart/index`（FileInterceptor 等，需 `@fastify/multipart`），但 `@UploadedFile`/`ParseFilePipe`/`FileTypeValidator` 仍来自 `@nestjs/common`。
- P2 `024:207` 日志 `[Nest] LOG [NestApplication]` 缺 pid/时间；P2 全书 `platform-express` 与 ch016「v12.3 起推荐 platform-node」未衔接（NodeAdapter 下 FileInterceptor 要从 platform-node 导入）。

### ch025 大文件分片上传
- 无 P0/P1：`totalChunks = ceil(size/chunkSize)`、最后一片用减法公式、tmp+rename 原子落盘、`express.raw` type octet-stream limit 略大于 chunkSize、Range 只用于下载、分片索引即幂等键、状态查询只数文件名，全部正确。
- P2 `025:139` 未说明 `app.use(express.raw(...))` 的注册顺序（应在 Nest 默认 body parser 之前/或在 controller 级用 `@RawBody`），否则不同版本下行为不稳。

### ch026 Nest 里如何打印日志
- 质量高，已实核 @nestjs/common 12.6.0：`isLogLevelEnabled` 阈值级联（LOG_LEVEL_VALUES verbose0/debug1/log2/warn3/error4/fatal5，取传入数组最大值为阈值，target>=阈值即开）→ 026:106「传 ['log'] 会连 warn/error/fatal 一起开」正确；`filterLogLevels` 真实且从 @nestjs/common 根导出（`services/utils/filter-log-levels.util.js`，支持 `'>=warn'`/`'warn,error'`/`'warn'`）→ 026:108 正确；JSON 字段 `level/pid/timestamp/message/params/flattenParams`（+可选 context）见 `console-logger.service.js:265-289` → 026:133 正确；`bufferLogs`/`autoFlushLogs` 正确。
- **P1 遗漏**：Nest 12 新增 `NEST_LOG_LEVEL` 环境变量（`services/utils/get-env-log-levels.util.js`，格式同 filterLogLevels，ConsoleLogger 首次检查级别时读取），ch026 完全未提——这是生产最常用的「不改代码切日志级别」手段。
- P2 `026:194`「Nest 12.4.0 实跑」与书基线 12.3.x 不一致（可接受，但全书版本口径需统一）。

### ch027 为什么 Node 里要用 Winston
- 质量高：`format.errors({stack:true})` 必须在 `json()` 前、meta 摊平到根、level 是过滤阈值、`child()` 浅合并、`exceptionHandlers`/`rejectionHandlers`/`exitOnError` 边界、崩溃日志不保证 100% 落盘、Winston vs pino 选型均正确。
- P2 `027:206` 拼写 `maxsize`，与 ch028 `maxSize` 及 winston-daily-rotate-file 实际选项名不一致；`maxFiles` 不配会无限切不删的说法正确。
- P2 `027:158`「给 transport 加 `handleExceptions: false` 关掉异常元数据」需复核 winston 3：异常元数据由 logger 的 `exceptionHandlers` 决定，transport 上的 `handleExceptions` 不是这个用途（winston 3 文档 Exception handling）。
- P2 027:81/111 示例 JSON 里 `\n` 是单反斜杠转义（正确），不是问题。

### ch028 Nest 集成日志框架 Winston
- 质量高且最新：nest-winston 最新 **2.0.0**（2026-09-14），书中「nest-winston 2.0」准确；已核 @nestjs/common 12.6.0 `LoggerService` 接口是 `log(message: any, ...optionalParams: any[])`，`Logger` 类重载为 `log(message:any, ...optionalParams:[...any, string?])` → 028:132/135「Nest 12 门面签名末尾字符串才是 context」与类定义一致；适配器「把 optionalParams 当 context」「`error: message` → `{}`」「`stack: [...]` 数组」三处分析成立。
- P2 `028:102` `flushLogs()` 与 `autoFlushLogs` 关系没讲清（`autoFlushLogs` 是初始化自动 flush，默认 true；手动 flush 用于自己控制时机）。
- P2 `028:313`「未实测轮转效果」：目录结构是编的（跨天未跑），建议标注为示意或实测。
