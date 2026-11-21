# 课程结构 / 覆盖度 / 元数据一致性审计（audit-plan）

- 审计对象：`README.md`（生成物）、`_meta/parts.tsv`、`_meta/chapters.tsv`、`_meta/*.mjs`（生成与门禁）、`STYLE-GUIDE.md`、`_meta/QA-REPORT-1-53.md`、`_meta/status.tsv`
- 审计时间：2026-11-21（Asia/Shanghai），Node v26.13.1，cwd = `/Users/dailei/code/self/notes/docs/nest`
- 外部基线：docs.nestjs.com `sitemap.xml`（lastmod 2026-11-20，**183 页**）+ npm registry 实测（2026-11-21）
- 边界：**只读审计，未修改任何 README / tsv / 章节 / 脚本**；不审逐章技术细节（另有成员负责），结论中的「覆盖」以**章节标题级**匹配为准，正文可能另有零星覆盖，表内已注明。
- 说明：官方文档 2026-11 已重组，**不再有 `techniques/` 目录**，改为 `fundamentals / application / data / http / security / observability / reliability / ai / mcp` 等分组，本审计按新目录核对。

---

## 结论

1. **规划骨架完整度很高（286 章、31 Part、7 篇无缺号、无重号、172 个官方页面对得上），但「完整」是覆盖面意义上的，不是能力意义上的**：Nest 核心、REST/GraphQL/微服务/WebSocket、安全、可观测、可靠性、项目实战都有，属于「广度够、结构脏」。
2. **最大结构性缺口是「测试」与「GraphQL / WebSocket / Microservices 的进阶切面」**：① 测试全期 0 章，而 Nest 12 脚手架默认带 vitest 4 + oxlint + `*.spec.ts`，`STYLE-GUIDE.md:23/90` 明确「不写、不展示 Vitest/Jest」，与脚手架现状和 2026 工程师基线直接冲突；② 官方 GraphQL 18 页只有约 4 页有标题对位（**订阅 subscriptions、scalars、directives、complexity、plugins、CLI plugin、interfaces、unions、mapped-types、sharing-models 全缺**）；③ WebSocket 6 页只覆盖 gateways（**adapter 横向扩展、ws guards/pipes/interceptors/exception-filters 全缺**）；④ 微服务 13 页缺 5 个跨切面页（guards/pipes/interceptors/exception-filters/pre-request-hooks）。
3. **规划内部有 6 类结构性冗余 + 3 处明显错序**：Redis 讲 5 遍（51-53 / 68-70 / 126-129 / 145-147 / 204+266）、MQ 讲 4 遍（122-125 / 169 / 235 / 258-259）、Docker 4 处、ORM 3 处、面试题 6 处、项目「再拆解」与正文章重复（279-281 vs 160-166/183-190）；错序：MongoDB（155-156）塞进 WebSocket Part、Kafka vs RabbitMQ（169）塞进 GraphQL 教育平台 Part、K8s「先部署(178)后讲概念(182)」。Part 编号与章号也整体错位（第 4 篇 07/08/09/11/13/16，第 5 篇 10/12/14/15/17/19），「按序学 286 章」不成立。
4. **元数据层有一批可立即修的硬错误**：README 技能矩阵「章节数」合计 **317≠286**、「已写」合计 **54≠53**（29 章多 domain 重复计数）；`qa-report.mjs` 默认只统计到第 268 章（**269-286 共 18 章永远不进 QA 报告**）；`check-structure.mjs` 三处错误提示仍写死 268/30；`QA-REPORT-1-53.md` 的关键数字与实测不符（平均汉字 3145/3172 vs 实测 3046，累计 166,818 vs 161,443）；原创度门禁因参考小册目录不存在而 **exit 2 不可复现**，报告里「原创度 0 风险」没有证据。
5. **「写法是否最新」在结构层面已经落后**：README 基线 Nest 12.3.x（实测 12.6.0）、@nestjs/graphql 13（实测 14.2.1）、@nestjs/swagger 11（实测 12.1.2）、Prisma 8.0.0-rc.29/rc.21（实测 rc.34/rc.24）；`nest deploy`、`@nestjs/observe`、SWC/Rspack 构建、压测在 286 章里 **0 命中**；同时仍有 Etcd/Nacos/Zookeeper/**Zuul**（Zuul 是 Java 网关，官方早已移除）6 章、PM2 2 章、compodoc 1 章等 2020 时代路线。唯一与基线一致的是「ESM 为 CLI 默认」，可保留。

---

## 门禁实测结果

### 1. 四个门禁的真实输出（exit code 已逐条确认，未用管道吞掉）

| # | 命令 | exit | 真实输出摘要 |
| --- | --- | ---: | --- |
| 1 | `node _meta/validate-chapters.mjs` | **0** | 校验章节 286（已写 53，待写 233）／达标 53／教材腔命中 0／信息量不足 800 汉字 0／按需缺图 0／达标章节平均汉字 **3046**、平均代码块 15.3、有图比例 1.00 |
| 2 | `node _meta/validate-chapters.mjs 1 53` | **0** | 同上，平均汉字 **3046**（范围限定 1-53） |
| 3 | `node _meta/qa-report.mjs` | **0** | 「合计：**268 章（1–268）**，已写 53；平均汉字 3048、代码块 15.3、配图 59；未达标 0 章」 |
| 4 | `node _meta/check-structure.mjs` | **0** | ✅ 286 章 / 31 Part / 已写 53 / 待写 233（0 错误） |
| 5 | `node _meta/check-originality.mjs` | **2** | `[originality] 找不到小册参考目录，可用 NUGGETS_BOOKLET_DIR 环境变量指定`（`/Users/dailei/Documents/nest-nuggets-booklet` 不存在） |

### 2. 脚本自身缺陷（不是「跑不过」，是「跑了也证明不了」）

| 脚本 | 缺陷 | 后果 |
| --- | --- | --- |
| `_meta/qa-report.mjs:12` | `const end = Number(endArg ?? 268);` 默认上界写死 268 | **269-286 共 18 章永远不出现在 QA 报告里**；报告标题「268 章」与 README「286 章」口径冲突，Part 30 整篇（18 章）无 QA 记录 |
| `_meta/check-structure.mjs:47/74/99` | 判定常量是 286/31，但错误文案写死「应为 268 行」「应为 30 行」「应为 268」 | 一旦真的出错，提示会把人引向错误数字，排障成本高 |
| `_meta/validate-chapters.mjs:8` | 帮助注释「`--all` 要求全部 268 章已写」 | 同上，文档与代码不一致 |
| `_meta/check-originality.mjs:57-60` | `chapters.tsv` 读取后**未 `slice(1)`**，表头行被当章节解析（num=NaN，被区间过滤掉，暂不出错） | 潜在脆弱点；且只做 20 字 shingle 重合率，**不校验技术正确性/版本新旧** |
| 全部门禁 | 只校验：字数 ≥800 汉字、模板腔词、按需配图、页脚导航、章号区间、文件存在 | **不校验**：H1 与文件名/tsv 标题一致性、官方文档链接、版本号是否过时、代码能否运行、`domains` 与正文是否匹配。所以 `QA-REPORT-1-53.md` 的「53 章全达标」只等价于「字数与文风达标」 |

### 3. 与 `_meta/QA-REPORT-1-53.md` 的差异（实锤不一致）

| 项 | QA 报告声称 | 本次实测 | 判定 |
| --- | --- | --- | --- |
| `validate 1 53` 平均汉字 | §2 第 18 行 **3145**；§10 第 221 行又写 **3172** | **3046** | 同一门禁三个数，报告数字不可信 |
| 53 章正文汉字合计 | 第 33 行 **166,818** | **161,443** | 差 5,375 字（+3.3% 的虚高） |
| 单章最少 / 中位数 / 最多 | 第 34-36 行 **2,342 / 3,101 / 5,150** | **2,210（第 29 章）/ 2,969 / 4,974（第 35 章）** | 全部不符 |
| 原创度 | 第 24-25 行「对比小册 53 章、候选 405 篇、高风险 0、警告 0」 | 门禁 **exit 2 跑不起来**，小册目录不存在 | 声称无法复现 |
| 复跑路径 | 第 187 行 `cd /Users/dailei/notes/docs/nest` | 实际 `/Users/dailei/code/self/notes/docs/nest` | 旧路径 |
| 未实测标注 | 41 处 | grep 实测 **41 处** | 唯一对得上的数字 |
| 报告自身披露 | 第 119-121 行「所有命令输出都是沿用原稿…没有一条是本次重跑」 | 一致 | 报告已自证「全达标」≠ 正确 |

> 结论：`QA-REPORT-1-53.md` 应标记为「过期/需重跑」，不能作为验收依据；「53 章全部达标」这句话目前只对「字数 + 无教材腔 + 有图 + 页脚」成立。

---

## 规划 vs 官方文档覆盖差集

### 1. 分类覆盖（标题级；官方 183 页按 2026-11 新目录归并）

| 官方分组 | 官方页数 | 标题级有对位 | 缺口要点 |
| --- | ---: | ---: | --- |
| fundamentals | 12 | 10 | 缺 **testing**、**module-ref**（judge：261/262 覆盖 discovery/lazy/injection-scope/async-provider） |
| application | 11 | 11 | 全有（configuration 060、events 236、file-storage 234/269、http-client 232、i18n 233、logger 026-028/223、mail 073、queues 235、serialization 277、task-scheduling 077、validation 019/020） |
| data | 8 | 8（caching 口径分叉） | 无 CacheModule 专章，053 反而论证「不要用 cache-manager」，与官方 `data/caching` 路线分叉 |
| http | 10 | 10 | 全有（compression 230、cookies 229、file-upload 023-025/234、mvc 231、performance 135、sse 079/249、session 054/229、streaming 270、versioning 228、webhooks 227） |
| security | 7 | 7 | 全有（237-239、218、242；CSP 在 Helmet 章内） |
| observability | 10 | 10 | 全有（134、220-225、209/210） |
| reliability | 6 | 6 | 全有（212、127/216、213/214、215/218、219、217） |
| **graphql** | **18** | **≈4** | **167/168/174/256**；缺 subscriptions、scalars、directives、complexity、plugins、cli-plugin、interfaces、unions-and-enums、sharing-models、mapped-types、field-middleware、generating-sdl、extensions、other-features |
| **microservices** | **13** | **≈8** | 缺 exception-filters、guards、interceptors、pipes、pre-request-hooks（跨切面在微服务侧无专章；主干只有应用层） |
| **websockets** | **6** | **≈1** | 只有 gateways（157）；缺 **adapter（Redis adapter 横向扩展，生产必备）**、exception-filters、guards、interceptors、pipes |
| **openapi** | **8** | **≈3** | 071（introduction/decorators）+ 087（security）；缺 **cli-plugin**、mapped-types（276 只算 DTO 技巧）、operations、types-and-parameters、other-features |
| ai | 6 | 4 | 206/208/211/255；缺 agents、ai/testing |
| mcp | 5 | 3 | 209/210；缺 mcp/testing、mcp/migration（transports 在 210 内） |
| cli | 5 | 3 | 003/105/263；缺 **scripts（nest build/start/generate 用法）**、usages 仅 003 部分 |
| devtools | 2 | 1 | 226（ci-cd）；缺 devtools/overview（`@nestjs/devtools` 全仓库 0 命中） |
| faq | 12 | ≈5 | 缺 global-prefix、keep-alive-connections、raw-body、cloudflare-workers；http-adapter/multiple-servers/nest-vs-* 只有 016/034 部分覆盖；versions 靠 286 |
| recipes | 17 | 5 | 有 async-local-storage(236)、cqrs(257)、nextjs(244-250)、passport(130)、repl(082)；缺 **swc**、serve-static、hot-reload、nest-commander、router-module、crud-generator、express/fastify-migration、supabase（aspnet/spring-boot/socket-activation 可判不适用） |
| tutorials | 11 | 10 | 只缺 project-management-api（可由项目一/二替代） |
| 2026 v12 新能力 | — | **0** | **`nest deploy`、SWC/Rspack、`@nestjs/observe`、压测/基准测试** 在 286 章标题中 0 命中 |

### 2. 缺口明细（官方有、规划无；可直接转成补章任务）

| 官方主题 | 是否覆盖 | 章节位置 / 缺口 | 优先级 |
| --- | --- | --- | --- |
| fundamentals/testing（单测 + e2e + `@nestjs/testing`） | ❌ | **全期 0 章**；README:18 / STYLE-GUIDE:23/90 明确「本期不引入」，与 Nest 12 脚手架默认 vitest 4 + oxlint + spec 冲突 | **P0** |
| fundamentals/module-ref（ModuleRef / 模块内取 Provider） | ❌ | 261/262 只到 DiscoveryService/LazyModule/InjectionScope | P2 |
| graphql/subscriptions（含 Redis PubSub 横向扩展） | ❌ | 167-176 无订阅；实时能力只走 WebSocket/SSE | **P1** |
| graphql 其余 12 页（scalars/directives/complexity/plugins/cli-plugin/interfaces/unions/mapped-types/sharing-models/…） | ❌ | 167/168/174/256 四章要撑 18 页，明显不足 | **P1** |
| websockets/adapter（`@socket.io/redis-adapter` 多实例广播） | ❌ | 153-159 只讲单机 gateway；这是生产多副本的必修 | **P1** |
| websockets/guards·pipes·interceptors·exception-filters | ❌ | 同上，只覆盖 gateways | P2 |
| microservices 跨切面 5 页 | ❌ | 104-113/258-259 只讲传输与拆分，未讲微服务侧守卫/管道/拦截器/异常过滤/pre-request hooks | P2 |
| openapi/cli-plugin（编译期自动生成 @ApiProperty） | ❌ | 071/090 手写装饰器，未提 CLI plugin | P1 |
| openapi/mapped-types（PartialType/PickType/OmitType） | ❌ | 276 只做自定义装饰器 | P2 |
| OpenAPI → 客户端代码生成 | ❌ | 246 是手写 TanStack Query client，无 codegen | P2 |
| recipes/swc + 构建链（Rspack/oxlint） | ❌ | `swc` 仅出现在 001/003/024 正文提及；无构建工具专章 | P1 |
| `nest deploy`（v12 CLI 自带部署） | ❌ | 部署章 250/283 只讲 Vercel/Docker/Nginx/阿里云；全仓库 md 仅他人审计文件提到 | P1 |
| 压测 / 负载测试（k6、autocannon、容量基线） | ❌ | 135 是「性能排查与容量规划」，无实测压测章 | P1 |
| `@nestjs/observe`（v12 官方可观测包） | ❌ | 220-225 自建 OpenTelemetry SDK，未提官方 observe 包 | P2 |
| @nestjs/cache-manager（CacheModule/keyv） | ⚠️ 分叉 | 053 主张「用 ioredis 不用 cache-manager」，官方 `data/caching` 是 CacheModule 路线；需在 053 显式写「与官方路线的取舍」 | P2 |
| ai/agents、ai/testing | ❌ | 206-211 是模型/工具/MCP/工程化；缺 agent 编排与 AI 测试 | P2 |
| mcp/testing、mcp/migration | ❌ | 209-210 只到接入 | P2 |
| recipes/serve-static、hot-reload | ❌ | 静态资源/热重载无专章 | P2 |
| cli/scripts、faq/global-prefix·keep-alive·raw-body·cloudflare-workers、devtools/overview | ❌ | 均无标题对位，属「锦上添花但便宜」的补章 | P2 |
| 安全：SSRF / 注入实战 / CSP 细化 | ⚠️ 部分 | 242 OWASP API Top10 覆盖概念，但无 SSRF、SQL 注入实战演练；CSP 藏在 237 Helmet | P2 |
| 多租户 | ✅ | 241（可对齐官方 tutorials/multi-tenant-saas） | — |
| 健康检查 | ✅ | 219（`@nestjs/terminus` 12.2.0 存在，建议点名） | — |

### 3. 规划有、官方 v12 已无或已过时（结构性包袱）

| 内容 | 章节 | 问题 | 建议 |
| --- | --- | --- | --- |
| Etcd / Nacos / Zookeeper / **Zuul** 注册中心 | 106-111（6 章） | 官方 v12 无这些页面；**Zuul 是 Java 网关**，写进 Nest 教程是硬伤；Zookeeper/Nacos 在 Node 生态已非主流 | 压成 1 章「注册中心与配置中心的演进」+ 保留 Nacos 1 章选读，删 Zuul |
| PM2 进程管理 | 034、063 | v12 走 `nest deploy` + 容器编排，PM2 是 2020 方案 | 合并为「进程守护的三种做法」1 章，指向 226/250 |
| compodoc 文档 | 072 | 社区工具，官方已有 devtools | 降为选读或删除 |
| Vue 时代前端页面 | 091-102 中的 6 章 | 与 244-250 的 Next.js 16 技术栈冲突 | 删/改为 API 消费示例（用 Next.js 或纯 fetch） |
| 小册业务 demo（高德地图、王者荣耀、短链、gif 压缩、扫码登录、阿里云短信、PPT） | 069/070/078/080/081/075/272 | 与 Nest 能力主线弱相关，版权/原创风险 | 移出主线，最多留 2 个当「综合练习」 |
| 教程自身元章节 | 284「200 版与 205 版差异复盘」、285「286 主题覆盖清单」 | 讨论的是**教程本身**，不是教学内容；284 直接暴露对掘金小册的依赖 | 删除或移入 `_meta/` 附录 |

---

## 规划内部问题

### 1. 重复（同一主题多次开课，合计约 25 章冗余）

| 主题 | 出现位置 | 判定 |
| --- | --- | --- |
| Redis | 51-53（Part03）／68-70（Part04）／126-129（Part08）／145-147（Part11）／204、266（面试） | 5 处，Part11「Redis 高级应用」3 章与 Part03 三章、Part08 的 126-129 高度重叠；145「关注关系」、146「UV 计数」更像练习题 |
| 消息队列 | 122-125（Part08 原理/选型/RocketMQ/Kafka）／169（Part15 Kafka vs RabbitMQ）／235（Part24 BullMQ）／258-259（Part28 传输层） | 4 处；169 明显错 Part；125「选型」与 121「ORM 对比」同类 |
| Docker | 29-34（Part02）／61-64（Part04 Compose/网络/重启/私有仓库）／144、152、166、189-190（4 个项目部署）／250、283 | 4+ 处；「Dockerfile 5 个技巧」「Docker 是怎么实现的」属原理课，项目部署又各讲一遍 |
| Nginx | 65-67（Part04）／250（Part26「部署 Vercel 与 Docker 与 Nginx」） | 2 处 |
| ORM | 120-121（Sequelize/三大 ORM 对比，Part08）／251-253（TypeORM/Drizzle/MikroORM，Part27）／185、278（博客 ORM、TypeORM 迁移） | 3 处；121 与 251-253 直接撞车；Prisma 还有 44-50 + 114-119 两次「全部命令/全部语法/全部 API」 |
| 面试题 | 147、159、170、202-204、264-267 | 6 处；202-205（Part20）与 264-268（Part29）同为求职内容，中间隔 60 章 |
| 项目复述 | 279 图书系统拆解／280 考试系统／281 聊天室拆解 vs 160-166 聊天室、183-190 博客 | Part30「拆解」与其正文章重复，且 279/280 是全新项目，等于「补写项目」 |
| 分布式可靠性 | 130-136（Part09）vs 212-219（Part22）vs 220-226（Part23）；127 与 216 都是「基于 Redis 的分布式锁」 | 三处大面积重叠 |
| 部署 | 103、144、152、166、178、189、250、283 | 7 个部署章，「整体验收」重复 4 次 |

### 2. 顺序错误（3 处硬错 + 3 处错层）

| 问题 | 证据 | 影响 |
| --- | --- | --- |
| **Part 编号与章号错位** | parts.tsv `section_no`：第 4 篇 = 07/08/09/**11**/**13**/**16**，第 5 篇 = **10**/**12**/**14**/**15**/**17**/**19**，第 6 篇从 **18** 开始 | 读者按章号读到 136 后直接跳 145，137-144 要等 40 章后才出现；README「按序学完全部 286 章」不成立 |
| MongoDB 塞进 WebSocket Part | 155《MongoDB 快速入门》、156《在 Nest 里操作 MongoDB》在 Part13「WebSocket 与实时通信」 | 数据主题错放；且 254 又有 MongoDB 进阶 |
| Kafka vs RabbitMQ 塞进 GraphQL Part | 169 在 Part15「GraphQL 与教育平台」（167/168 GraphQL → 169 MQ 对比 → 170 GraphQL 面试） | 项目 Part 中间插入无关对比 |
| K8s 先部署后讲概念 | 178《部署一套 Kubenetes 环境》早于 182《什么是 Kubenetes》 | 同一 Part 内倒序 |
| 认证主题被切成三段 | 054-059 登录/JWT/Session（Part04）→ 130-131 Passport/SSO（Part09）→ 199-200 OAuth2/扫码（Part19）→ 247 端到端认证（Part26） | Passport 应在 Part04；OAuth2 属认证主线，不该等到 Part19 |
| Docker/Nginx 塞进「Redis 与认证」 | Part04 = 54-70，其中 60 配置、61-64 Docker、65-67 Nginx 共 8 章非该 Part 主题 | Part 标题与内容不符（详见元数据清单） |

### 3. 必修但排太晚 / 太早

| 主题 | 当前最早出现 | 问题 |
| --- | --- | --- |
| 测试 | **无** | P0，见上 |
| 安全基线（Helmet/CORS/CSRF） | 237-243（第 25 Part，全书约 83% 处） | 认证在 Part04（54-59），安全基线却拖到 237，中间所有项目都在「不安全」状态下写 |
| CI/CD | 226 | Part02 就有 Docker，CI 却排到 226；容器化之后应立即接流水线 |
| Guard | 057-058（ACL/RBAC，Part04） | 官方把 Guards 列为请求生命周期核心；Part01 讲了 Middleware/Interceptor/Pipe/ExceptionFilter 却**唯独没有 Guard 专章**，请求链路在基础篇是断的 |
| 可观测性 | 134（Part09）vs 220-226（Part23） | 同一主题分两处，且 134 之后 86 章才系统讲 |
| GraphQL federation | 256（Part27） | 167-176 讲完 GraphQL 后 80 章才讲联邦，应紧跟 Part15 |
| 压测 | 无 | 135 只讲排查，没有压测方法论 → 性能结论无数据支撑 |

### 4. 粒度问题

- **Part30「实战补遗与经典项目拆解」18 章 = 补丁包**：269 MinIO 与 234 文件存储、270 流式下载与 128/streaming、273 资源监控与 Part23、274 三方登录与 081/200、275 单 token 与 059、276 DTO 与 020、277 序列化与官方 serialization、278 TypeORM 迁移与 251 全部重叠；272「用代码动态生成 PPT」与 Nest 后端主线几乎无关。且 `parts.tsv` 把 part-30 标为 `optional`，但 README 又要求「全部 286 章」。
- **Part05「工程化设施」13 章混杂**：071-072 文档工具、073-075 邮件/短信、076-077 定时任务、078 短链、079 SSE、080 gif 压缩、081 扫码登录、082 REPL、083 Prometheus —— 文档/通知/任务/实时/小工具/监控 6 类主题挤在一个 Part。
- **Part08「Prisma 8、ORM 对比与消息队列」16 章**同时承担 Prisma 深水区（114-119）+ ORM 对比（120-121）+ MQ（122-129）+ Redis 结构（128-129），粒度完全失衡。

### 5. 已写 53 章的内部缺口（只看标题）

| Part | 已写 | 缺口 |
| --- | ---: | --- |
| part-00 | 2 | 无（开篇/理由） |
| part-01（003-028，26 章） | 26 | 核心链完整（IoC/Provider/AOP/装饰器/中间件/拦截器/管道/异常过滤/上传/日志），但：**无 Guard 专章**；无 ModuleRef/模块进阶；无测试；文件上传 3 章 + 日志 3 章 = 6 章，权重高于「请求生命周期」；016 讲 Express/Fastify 但无 Hono 对比（faq/nest-vs-fastify-express-hono） |
| part-02（029-034，6 章） | 6 | 全是 Docker/PM2；缺 CI/CD、缺 `nest deploy`、缺镜像安全扫描 |
| part-03（035-053，19 章） | 19 | SQL/Prisma 扎实；但 51-53 三章 Redis 与 Part 标题不符、domains 标成「数据库」；缺数据库迁移/备份/连接池生产实践；缺 Prisma 8 与 v12 官方 `data/prisma` 新特性的对照 |
| part-04（054-070，17 章） | 17 | 认证 6 章 + 配置 1 章 + Docker 4 章 + Nginx 3 章 + Redis 3 章；缺 CSRF/CORS/Helmet（在 237）、缺 OAuth2/OIDC（在 199）、缺 Guard 系统讲解（057/058 讲的是 ACL/RBAC 用法） |

---

## 元数据与 README 不一致清单（可直接修）

> 全部为实测；行号为当前文件行号。生成物（README/`_part.md`）的修法应是「先改 tsv → 跑 `build-structure.mjs` → 跑 `check-structure.mjs`」。

| # | 位置 | 现状 | 应为 / 建议 |
| --- | --- | --- | --- |
| 1 | `README.md:3,9` | 「NestJS **12.3.x**」 | 12.6.x（npm 实测 12.6.0）；改 tsv/模板后重生成 |
| 2 | `README.md:11`、`STYLE-GUIDE.md:13` | TypeScript「5.9+ / 6.x」 | 统一为 **6.0.x**（`@nestjs/graphql@14.2.1` 的 peer 仅 `^5.5.0 || ^6.0.0`，**不要写 7.x**，TS 7.0.2 目前会与 GraphQL 包冲突） |
| 3 | `STYLE-GUIDE.md:20` | @nestjs/graphql **13** + Apollo Server 5 | **14.2.1**（peer：graphql ^16.11||^17）；「Apollo Server 5」建议改为「以 @nestjs/graphql 14.2.x 官方兼容表为准」，避免写死 |
| 4 | `STYLE-GUIDE.md:21` | @nestjs/swagger **11**（OpenAPI 3.1） | **12.1.2**（example 已用 ^12.1.0，但 README 基线表**缺 swagger 行**，应补） |
| 5 | `README.md:13`、`STYLE-GUIDE.md:17` | `prisma@8.0.0-rc.29` + `@prisma/orm-postgres@8.0.0-rc.21` | **rc.34 / rc.24**；同时说明「GA 后只升级这两个包」的承诺需要复核（rc 版本跳过 5 个） |
| 6 | `README.md:18`、`STYLE-GUIDE.md:23,90` | 「测试 本期暂不引入」「不要求、不展示 Vitest/Jest」 | 与 Nest 12 脚手架默认（vitest 4 + oxlint + `*.spec.ts`）冲突；至少改为「第 3 章说明脚手架自带测试/oxlint 如何取舍，测试专章见 Part X」 |
| 7 | `README.md:49` 技能矩阵 | 47 行，「章节数」合计 **317**、「已写」合计 **54** | 317 = 286 + 31（29 章多 domain，其中 114/211 各 3 个 domain）；54 = 53 + 1（第 9 章 domains=架构/Nest 双计）。列名改「覆盖条目数（可重复）」或按章去重；「项目一~五/导学/复盘/面试题与总结」等非技术域移出矩阵 |
| 8 | `_meta/qa-report.mjs:12` | 默认 end=268 | 改 286（否则 269-286 这 18 章永不进报告） |
| 9 | `_meta/check-structure.mjs:47/74/99`、`_meta/validate-chapters.mjs:8` | 错误文案/注释写死 268、30 | 改 286、31，或从 parts.tsv/chapters.tsv 动态取数 |
| 10 | `_meta/QA-REPORT-1-53.md` | 平均汉字 3145/3172、合计 166,818、min/mid/max 2,342/3,101/5,150、旧路径、原创度 0 风险 | 标注「过期，2026-11-21 复跑结果见审计」；数字改为 3046、161,443、2,210/2,969/4,974；原创度结论删除或补跑 |
| 11 | `_meta/status.tsv` | **只有表头**（part/range/status/author/date） | 与 `STYLE-GUIDE.md:160`「每写完一个 part 追加一行」冲突；补录 part-00~03 四行，或删除该要求 |
| 12 | `README.md:26` | 承诺「每章文末给出官方文档链接」 | 实测 **35/53 章正文无 docs.nestjs.com 链接**；回填或改承诺为「相关概念处给出行内链接」 |
| 13 | `README.md:30-33` 学习路线 | 路线 A 跳过第 4 篇全部（07/08/09/11/13/16 共 49 章分布式与云原生）；路线 B「Part 00 → Part 30 按序」与 Part/章号错位矛盾 | 路线 A 补进 07/09/11（或注明「求职路线不要求分布式」）；路线 B 改「按章号 1→286」并先修 Part 顺序 |
| 14 | `_meta/parts.tsv` 第 4/5/6 篇分组 | 第 4 篇 = 07,08,09,11,13,16；第 5 篇 = 10,12,14,15,17,19；第 6 篇 = 18,20-29 | 按章号重排 Part 编号（第 4 篇 07-12、第 5 篇 13-18、第 6 篇 19-28、第 7 篇 29-30），同步 chapters.tsv 的 part 列；或改 section 归属使章号单调 |
| 15 | `_meta/parts.tsv:part-03` | 标题「PostgreSQL、SQL 与 Prisma 8 数据层」 | 含 51-53 三章 Redis（domains 却写「数据库」）；改标题加「与 Redis 入门」或把 51-53 移到 Part04 |
| 16 | `_meta/parts.tsv:part-04` | 标题「Redis 基础与认证鉴权」，54-70 共 17 章 | 其中 060 配置、061-064 Docker、065-067 Nginx 共 8 章非本主题；拆出「容器与 Nginx 进阶」或移入 Part02 |
| 17 | `_meta/parts.tsv:part-05` | 「工程化设施」13 章 | 含邮件/短信/短链/SSE/gif/扫码等 demo；建议拆「文档与通知」「后台任务与实时」两部分 |
| 18 | `_meta/parts.tsv:part-13` | 「WebSocket 与实时通信」153-159 | 含 155/156 MongoDB（domains=数据库）；移出到 Part27（254 附近） |
| 19 | `_meta/parts.tsv:part-15` | 「GraphQL 与教育平台」167-176 | 含 169 Kafka vs RabbitMQ（domains=消息队列）；移到 Part08/24 |
| 20 | `_meta/parts.tsv:part-16` | 「全文检索与云原生」177-182 | 178 部署 K8s 早于 182 什么是 K8s；对调 |
| 21 | `_meta/parts.tsv:part-20` | 「面试题与总结」202-205 | 202-204 domains=数据库/求职（SQL 执行流程/索引优化/Redis 三连问），205「小册总结」；与 Part29（264-268）重复，建议合并为 1 个「面试与求职」Part |
| 22 | `_meta/parts.tsv:part-30` | `required=optional`，18 章 | README 称「全部 286 章」；要么改 required，要么在 README 标「第 7 篇可选」；284/285 元章节建议删除 |
| 23 | `_meta/chapters.tsv` domains 列 | 29 章多值（114/211 为 3 值）；混入「项目一~五」「导学」「基础」「复盘」「求职冲刺」「面试题与总结」等非技术域；Redis 章（51-53）标「数据库」，而 145-147 标「Redis 高级应用」 | 统一词表（技术域 ≤1 个主域 + 可选副域），项目/篇名不进 domains；Redis 统一为 `Redis` |
| 24 | `STYLE-GUIDE.md:119` | 同一行既写「Part 26 的 Next.js 前端」又写「React 19 + Vite + TanStack Query + Ant Design」 | 自相矛盾；按 README:41 与 244-250 章节标题统一为 **Next.js 16（App Router/RSC）+ shadcn** |
| 25 | `example/package.json` | `@nestjs/common/core` ^12.3.3、swagger ^12.1.0、config ^12.1.0、jwt ^12.0.3、throttler ^6.7.1、prisma rc.29/rc.21、TS ~6.0.2、engines `>=22.12.0`；无 test 依赖 | 升到 12.6.x / config 12.1.1 / jwt 12.0.5 / throttler 6.8.0 / prisma rc.34+rc.24；TS 固定 6.0.x；engines 与 README「CLI 需 v22.22.3+」对齐（改 `>=22.22.3`）；补 `vitest`/`oxlint` 或明确不装 |
| 26 | `README.md:41` 项目地图 | 「会议室预订系统前端 244–250」 | 244-250 实际是 Next.js 16 通用全栈章节（RSC/TanStack/认证/SSE），不是会议室前端；应改为「前端技术栈章节」或补真正的会议室前端章节 |
| 27 | `README.md` 项目地图 | 教育平台 167-176 含 169 的 MQ 章 | 与上表 #19 同修 |
| 28 | `_meta/build-structure.mjs:76-82` | projectInfo 硬编码章节区间（'meeting-booking-web': '244–250' 等） | 与 chapters.tsv 双源维护，易漂移；建议从 chapters.tsv 的 project 列反推区间 |

---

## 版本基线升级建议表

> npm registry 实测 2026-11-21；peer 约束也实测。原则：**能升的升，会被 peer 卡的写明原因**。

| 组件 | 文档现写（README/STYLE-GUIDE） | 最新实测 | 建议动作 |
| --- | --- | --- | --- |
| @nestjs/core / common / platform-express | 12.3.x（example ^12.3.3） | **12.6.0**（engines node >= 20） | 基线改 12.6.x；example 升 ^12.6.0；正文版本号片段同步 |
| @nestjs/graphql | 13（STYLE-GUIDE:20） | **14.2.1** | 升 14.2.x；peer 要求 graphql ^16.11\|\|^17、TS ^5.5\|\|^6，写作时按 14.2 的 code-first API 重写 167/168/174/256 |
| @nestjs/swagger | 11（STYLE-GUIDE:21） | **12.1.2** | 升 12.1.x；README 基线表补一行（现在没有） |
| @nestjs/config | 未列（example ^12.1.0） | **12.1.1** | example 升 ^12.1.1；基线表补行 |
| @nestjs/jwt | 未列（example ^12.0.3） | **12.0.5** | example 升 ^12.0.5 |
| @nestjs/throttler | 未列（example ^6.7.1） | **6.8.0** | example 升 ^6.8.0 |
| @nestjs/terminus | 正文只出现一次（031 Dockerfile） | **12.2.0** | 219 章点名 terminus 12.2.x，给健康检查代码 |
| @nestjs/cache-manager | 053 主张「不用 cache-manager」 | **12.0.5** | 保留 053 的取舍，但补一句「官方 CacheModule 路线见 data/caching」，避免被判「与官方文档相反」 |
| Prisma | 8.0.0-rc.29 + @prisma/orm-postgres rc.21 | **rc.34 + rc.24** | 升并重跑 example；RC 已跨 5 个小版本，建议加「GA 迁移检查清单」 |
| TypeScript | 5.9+ / 6.x（example ~6.0.2） | **7.0.2** | **不升 7**（@nestjs/graphql@14.2.1 peer 仅 ^5.5\|\|^6）；统一写「6.0.x」并注明原因 |
| Node.js | 运行 v20.19+；CLI 需 v22.22.3+/v24.15+/v26+ | 与 core engines(>=20) 一致 | 保留；但 example `engines` 从 `>=22.12.0` 改为 `>=22.22.3` 与 README 对齐 |
| 测试 / lint | 「本期不引入」 | 脚手架默认 **vitest 4 + oxlint** | 改为「脚手架自带 vitest/oxlint，教程在第 3 章说明如何保留或关闭；测试专章 P0 补齐」 |
| 部署 | Docker/Compose、Nginx、K8s、Vercel | v12 CLI 自带 **`nest deploy`** | 基线表加 `nest deploy` 行；250/283 增加一节（或新章） |
| 可观测 | 自建 OpenTelemetry（220） | 官方 **@nestjs/observe 0.3.27**（peer 支持 core 12、bullmq 6、graphql 14） | 220-225 增补「官方 observe 包 vs 手写 SDK」对比小节；基线表加可选行 |
| 构建 | 未提 | **SWC/Rspack + oxlint**（官方 recipes/swc） | 基线表加「构建：SWC（可选 Rspack）」并补 P1 章节 |
| 前端 | README：Next.js 16 + shadcn；STYLE-GUIDE:119：React 19+Vite+AntD | — | 二选一，统一 Next.js 16（与 244-250 一致） |

---

## 优先级建议

### P0（不修则教程「不成立」，先做这 6 项）

1. **补测试体系**（约 4 章，插在 Part01 末尾或新 Part）：`@nestjs/testing` 单测、vitest 4 + oxlint 现状、supertest e2e、覆盖率与 CI 集成。同时把 README:18 / STYLE-GUIDE:23/90 的「本期不引入、不展示」改为明确取舍。理由：官方 fundamentals 12 页唯一缺口 + 脚手架默认 + 求职硬需求。
2. **修版本基线**（README:3/9/11/13/18 + STYLE-GUIDE:11-23 + example/package.json），否则每写一章都在复制落后版本。按上表执行，TS 停在 6.x。
3. **修 Part/章号错位**：按章号重排 31 个 Part 的编号与 section 归属，重生成 README/`_part.md`，让「按序学 286 章」成立；顺带修 155/156、169、178/182 的错放错序。
4. **修门禁口径**：`qa-report.mjs` 默认 268→286；`check-structure.mjs`/`validate-chapters.mjs` 的 268/30 文案；`check-originality.mjs` 无小册目录时给出「跳过（degraded）」而非 exit 2（或文档化 `NUGGERS_BOOKLET_DIR` 的获取方式）。
5. **修技能矩阵口径**：317/54 的重复计数与「项目名当技术域」；并把 `status.tsv` 回填或删掉该要求。
6. **重跑并标注 QA 报告**：`QA-REPORT-1-53.md` 数字与实测不符、原创度不可复现，应标「过期」并用本次实测值替换。

### P1（决定教程「够不够 2026 水平」，建议下一轮迭代）

1. **GraphQL 补齐**：subscriptions（含 Redis PubSub）、scalars/enums/unions/interfaces、directives、complexity/depth limiting、plugins + **cli-plugin**、mapped-types、sharing-models；可把 167-176 重排为「GraphQL 基础 3 章 + 进阶 4 章 + 教育平台 3 章」。
2. **WebSocket 生产化**：adapter（`@socket.io/redis-adapter` 多实例广播）+ ws guards/pipes/interceptors/exception-filters，各 1 章或合 2 章。
3. **构建与部署现代化**：SWC/Rspack 构建、`nest deploy`、CI/CD 前移（Part02 之后）、压测/基准测试（k6 或 autocannon + 容量结论）。
4. **OpenAPI 工程化**：CLI plugin、mapped-types、OpenAPI → 前端客户端 codegen（接 246）。
5. **清理 2020 时代内容**：Etcd/Nacos/Zookeeper/**Zuul** 6 章压成 1-2 章、PM2 合并、compodoc 降级、Vue 前端章节改 Next.js、教程自身元章节（284/285）删除。
6. **削重复**：Redis 5 处→2 处、MQ 4 处→2 处、Docker/Nginx 各 1 处、ORM 对比 1 处、面试题合并到 1 个 Part、项目「拆解」不再复述正文。
7. **学习路线重写**：路线 A 补第 4 篇核心；路线 B 改为「按章号 1→286」；Part30 标可选。

### P2（锦上添花，随时可加）

ModuleRef、微服务跨切面 5 页、serve-static、hot-reload、cli/scripts、nest-commander、router-module、crud-generator、faq（global-prefix/keep-alive/raw-body/cloudflare-workers）、devtools/overview、`@nestjs/observe` 对比、ai/agents + ai/testing、mcp/testing + mcp/migration、Kafka 事务、gRPC streaming（先核对 113 正文）、SSRF/注入实战。

---

## 附：本次审计用到的可复现命令

```bash
cd /Users/dailei/code/self/notes/docs/nest
node _meta/validate-chapters.mjs; echo "exit=$?"
node _meta/validate-chapters.mjs 1 53; echo "exit=$?"
node _meta/qa-report.mjs; echo "exit=$?"
node _meta/check-structure.mjs; echo "exit=$?"
node _meta/check-originality.mjs; echo "exit=$?"
curl -sS https://docs.nestjs.com/sitemap.xml | grep -o '<loc>[^<]*' | sed 's|<loc>||' | sort   # 183 页
node -e '...'   # 分别核对：章节连续性/slug 唯一、parts 区间自洽、技能矩阵求和、domains 频次、H1、官方链接数
for p in @nestjs/core @nestjs/graphql @nestjs/swagger @nestjs/terminus @nestjs/cache-manager; do
  curl -sS "https://registry.npmjs.org/${p/\//%2F}/latest" | node -e '...'   # 版本/engines/peerDependencies
done
```
