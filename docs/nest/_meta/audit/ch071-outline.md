# 第 071 章（拆两章）《API 文档：从 Swagger 到契约交付》纲要

> 背景：现有规划只有 `071-用Swagger自动生成api文档.md` 一章，已写 53 章里只有 5 处顺带提到 Swagger（002/010/016/020/021），**0 章正文**；全库 0 命中 Scalar / Redoc / RapiDoc / Stoplights / Apifox / YApi。
> 结论：缺的不是「美化」，而是整层「**API 契约交付**」——生成 → 美化 → 协作 → codegen → 版本化。
> 落点建议：071A 讲生成与规范（留 part-05）；071B 讲文档 UI 与契约消费（留 part-05，紧随其后）；090 项目章补「接口文档当验收物」一节。

---

## 071A · 用 Swagger 12 生成接口文档（Nest 侧）

### 要解决的痛点（开场）
手写 Markdown 接口文档必然腐化：代码改了、文档没改、前端照着旧字段写，联调时才发现。Swagger 的价值不是「有个网页看」，而是**文档由代码生成，代码是唯一事实来源**。

### 结构
1. **最小可用**：`pnpm add @nestjs/swagger@12.1.x` + `SwaggerModule.createDocument` + `setup('api/docs')`；一个 controller 跑出第一版 UI。
2. **DocumentBuilder 该配什么**：title/description/version、`addBearerAuth()`（JWT 双 token 怎么标）、`addServer()`（本机 / 预发 / 生产三个入口）、`addTag()` 分组。
3. **装饰器分层**：`@ApiTags`（按模块）、`@ApiOperation`/`@ApiResponse`（状态码、错误结构）、`@ApiProperty`（DTO 字段、example、enum、format）、`@ApiPropertyOptional` vs `required`、`@ApiHideProperty`（不泄漏 password/hash）。
4. **Nest 12 的重点：CLI plugin**（官方 openapi/cli-plugin）。默认要手写 `@ApiProperty`，漏一个就少一个字段；开 `plugins: ['@nestjs/swagger/plugin']` 后，编译器从 TS 类型推导（含 `PartialType`/`PickType` 等 mapped types）。要给「开/不开」的差异对比 + `tsconfig`/`nest-cli.json` 配置 + 常见坑（`dtoFileNameSuffix`、`introspectComments`）。
5. **OpenAPI 3.1**：`@nestjs/swagger` 12 默认 3.1，说明与 3.0 的差异（`nullable` → `type: ['string','null']`、JSON Schema 2020-12），前端/网关工具链的兼容性。
6. **文档即契约的纪律**：错误响应统一形状、分页参数统一、枚举与状态机与 Prisma schema 对齐（`enum` 从生成物取，不手抄）。

### checkpoint
- `curl -s localhost:3000/api/docs-json | jq '.paths | keys'` → 列出全部路由
- 打开 `/api/docs` 用 Bearer 授权后成功调一次受保护接口
- 改一个 DTO 字段 → 不重启（`--watch`）刷新文档 → 字段自动出现（证明 CLI plugin 生效）

---

## 071B · 文档前端与契约交付（选型 + codegen）

### 先给结论（对比表，读者按场景选）

| 工具 | 形态 | 强项 | 代价 | 适合 |
| --- | --- | --- | --- | --- |
| Swagger UI | 官方默认 | 零配置、调试友好 | 2018 年的观感、大文档卡 | 内部快速验证 |
| **Scalar** | 现代 UI（`@scalar/nestjs-api-reference`） | 观感最好、支持 OpenAPI 3.1、代码示例多语言、可嵌 Next.js | 生态较新、要额外包 | 对外开发者文档（推荐） |
| Redoc | 三栏静态文档 | 大文档性能好、可离线 | 交互弱（可配 Redocly 增强） | 只读的 API 参考 |
| RapiDoc | Web Component | 单文件、轻、可定制主题 | 社区小 | 嵌入现有站点 |
| Stoplight Elements | React 组件 | 设计系统一致、可拆分模块 | 引入 React 依赖 | 已有 React 文档站 |
| Apifox / YApi | 协作平台 | Mock、测试、团队权限、中文生态 | 要导入导出、非纯代码生成 | 团队协作（国内常见） |
| Knife4j | Java 生态 | 国内 Java 团队常见 | **Nest 不适用**，只作认知 | 读别人的文档 |

### 结构
1. **换 UI 不动文档**：OpenAPI JSON 是契约，UI 只是渲染层。演示「同一个 `/api/docs-json` 分别喂给 Swagger UI 与 Scalar」。
2. **Scalar 接入**（Nest 具体写法）：装包 → 在 `main.ts` 用其 Nest 集成把 OpenAPI 文档挂到 `/reference` → 主题/侧边栏/代码示例配置。**写正文前核实当前包名与版本**（`@scalar/nestjs-api-reference`），并在 `example/` 实测。
3. **Redoc / RapiDoc 静态化**：CI 里导出 `openapi.json` → 生成静态站点 → 随文档站发布（不依赖应用进程）。
4. **codegen：把契约变成前端类型**：`openapi-typescript` 生成 `schema.d.ts`；`orval` 直接生成 TanStack Query hooks（呼应第 246 章）。演示「后端改字段 → 前端 `tsc` 报错」这条闭环。
5. **协作平台路线**：`openapi.json` 导入 Apifox/YApi 做 Mock 与用例，说明「代码为准 + 平台为辅」的同步策略（CI 里 diff 契约，变更要 PR 说明）。
6. **契约版本化**：`/api/v1`、breaking change 判定（删字段/改类型/改枚举）、`deprecated: true` 与迁移期双版本并存。

### checkpoint
- 同一份 `openapi.json` 在 Scalar 与 Redoc 都能打开
- `pnpm openapi:types` 生成 `schema.d.ts` → 前端故意写错字段 → `tsc` 报错（截图/日志）
- 契约 diff：改一个 `required` 字段，CI 输出 breaking change 提示

---

## 090 项目章要补的一节《接口文档也是验收物》

- 每个模块交付时同时交：路由、DTO、错误码表、示例请求/响应、鉴权要求。
- 用文档做验收：对照 OpenAPI 逐项过（路径、方法、状态码、字段必填性、示例值）。
- 反面清单：`any` 类型字段、无 `example` 的枚举、`password` 出现在响应 schema、错误响应没统一形状。

---

## 写作硬约束
- 每条命令给预期输出；Scalar/Redoc 的截图用真实运行结果，不贴官方宣传图。
- 版本写清楚：`@nestjs/swagger@12.1.x`、Scalar 包版本实测后填；不写「最新版」。
- 不写「本章目标/小结」；结尾指向 072（compodoc 代码文档）与项目章 090。
- 与 ch020（ValidationPipe）、ch050（Prisma 集成）、ch246（TanStack Query）互相引用并核对标题。

## 待核实/待实测
| 项 | 说明 |
| --- | --- |
| Scalar 的 Nest 集成包名与版本 | 写正文前 `pnpm view` 核实，并在 `example/` 实测 `/reference` 路由 |
| Nest 12 CLI plugin 在 ESM + `nest build` 下的行为 | 需实测：`nest-cli.json` 的 `plugins` 与 `tsc`/SWC 两种构建器下的差异 |
| `openapi-typescript` / `orval` 版本与 OpenAPI 3.1 兼容性 | 实测生成结果，避免 3.0 时代教程直接套用 |
| 文档产物的 CI 门禁 | 可在 `check-structure` 之外加一个「openapi.json 可生成且 diff 有说明」的检查 |
