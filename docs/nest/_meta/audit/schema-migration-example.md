# example/ 校验层迁移到 Standard Schema（zod 4）实测报告

- 日期：2026-11-22
- 环境：node v26.13.1、pnpm 11.8.0、macOS；无 docker（PostgreSQL/Redis 起不来）
- 范围：只改 `example/`；验收在副本 `/tmp/example-final` 从零跑，不污染仓库
- 依据：`_meta/audit/STANDARD-SCHEMA-MIGRATION.md`

## 结论

迁移完成，副本从零安装到无 DB 启动**全绿**：

| 命令 | 退出码 | 说明 |
| --- | --- | --- |
| `pnpm install` | **0** | 595 包，25.9s；class-validator / class-transformer 不再安装 |
| `pnpm typecheck`（tsc --noEmit） | **0** | 无输出 |
| `pnpm db:emit`（prisma contract emit） | **0** | 产物与仓库已入库文件 **NO DRIFT**，storageHash 不变 |
| `pnpm build`（nest build） | **0** | dist 完整 |
| `node dist/main.js`（无 DB/Redis） | 启动成功 | 19 条路由；`GET /api/health` 200 |

- 19 个 `*.dto.ts` → 21 个 `*.schema.ts`（16 个请求/查询/通用 schema + 5 个响应 schema）；
- `class-validator` / `class-transformer` 已从依赖、代码、README 中移除；
- **无需升级 Nest**：example 现有 `@nestjs/common@12.3.3`、`@nestjs/swagger@12.1.0` 已内置 `StandardSchemaValidationPipe` 与 `standardSchema` 文档支持（规格 §0 的 12.6.0/12.1.2 只是"最新版"，不是最低要求）；
- 顺手修复了审计 P1：`pnpm-workspace.yaml` 的 `allowBuilds` 是模板占位文本，导致 `pnpm install` 退出码 1（`ERR_PNPM_IGNORED_BUILDS`），改成布尔后安装 exit 0；
- **未验证**：真实 PostgreSQL/Redis 下的 CRUD 成功路径（docker 不可用）；Swagger UI 页面仅验 `docs-json`，未人工点开。

## 改动清单

### 依赖与配置

| 文件 | 改动 |
| --- | --- |
| `example/package.json` | 删除 `class-validator`、`class-transformer`；保留 `zod ^4.6.7` |
| `example/pnpm-lock.yaml` | 重新生成：importer 去掉两个依赖；`node_modules` 不再安装它们（`ls node_modules/class-validator` 为空） |
| `example/pnpm-workspace.yaml` | `allowBuilds` 由占位文本改为布尔：`@scarf/scarf: false`、`esbuild: true`、`workerd: false` |

> lockfile 说明：pnpm 在旧 lock 基础上解析时，`@nestjs/common` 的 **optional peer** 仍会留下 `class-transformer@0.5.1` / `class-validator@0.15.1` 的解析条目（`optional: true`），但不会安装。要彻底清掉必须删 lock 重新解析，那会把 `^12.3.3` 解析到 `@nestjs/common@12.6.0` 等最新版（大 diff），本次不做。

### 文件改名 / 新增（21 个 schema）

```text
src/common/dto/pagination.schema.ts          # paginationSchema / pageMetaSchema / paginatedSchema / wrappedSchema / paginate
src/modules/auth/dto/register.schema.ts      login.schema.ts      refresh-token.schema.ts   logout.schema.ts
src/modules/auth/dto/auth-response.schema.ts
src/modules/users/dto/update-profile.schema.ts   update-user.schema.ts   query-users.schema.ts   user-response.schema.ts
src/modules/rooms/dto/create-room.schema.ts      update-room.schema.ts   query-rooms.schema.ts   room-response.schema.ts
src/modules/bookings/dto/create-booking.schema.ts  query-bookings.schema.ts  reject-booking.schema.ts  booking-response.schema.ts
src/modules/stats/dto/stats-range-query.schema.ts  trend-query.schema.ts  stats-response.schema.ts
```

- 删除原 19 个 `*.dto.ts`；
- 每个文件导出「schema 常量 + `z.infer` 类型」；请求类型命名 `*Input`；
- 响应包装：`wrappedSchema(x)` → `{ data: x }`，`paginatedSchema(x)` → `{ data: x[], meta }`，与 `ResponseInterceptor` 的摊平行为一致。

### 代码

| 文件 | 改动 |
| --- | --- |
| `src/main.ts` | 删 `ValidationPipe`（whitelist/transform），改 `app.useGlobalPipes(new StandardSchemaValidationPipe())` |
| 6 个 controller | `@Body({ schema })` / `@Query({ schema })` / `@Param('id', { schema: z.uuid() })`；`@ApiOkResponse({ standardSchema })` / `@ApiCreatedResponse({ standardSchema })`；`ParseUUIDPipe` 全部删除 |
| `auth/users/rooms/bookings/stats` service | 参数类型改为 `*Input`，返回类型改为 `*Response`；删除 `query.page ?? 1` / `query.pageSize ?? 10` / `query.days ?? 14` 兜底（默认值已在 schema） |
| `src/common/interceptors/response.interceptor.ts` | `PageMeta` 改从 `pagination.schema.js` 导入 |
| `src/common/enums.ts` | 注释里「class-validator 的 @IsEnum」改为「zod 的 z.enum()」 |
| `example/README.md` | 技术栈「校验」行、目录树 main.ts/common/dto 注释、安全与工程化「ValidationPipe」条目同步 |

### 关键写法

```ts
// 分页参数：coerce + default，service 直接用 query.page
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

// 邮箱：trim/小写后再校验，同时让 Swagger 拿到 format: email（见「坑 4」）
email: z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.email().max(191),
),

// 控制器
@Post()
@ApiCreatedResponse({ standardSchema: wrappedSchema(roomResponseSchema) })
create(@Body({ schema: createRoomSchema }) dto: CreateRoomInput) { ... }

@Get(':id')
findOne(@Param('id', { schema: z.uuid() }) id: string) { ... }
```

## 命令实测记录（副本 /tmp/example-final）

```text
$ rm -rf /tmp/example-final && cp -R example /tmp/example-final && cd /tmp/example-final
$ pnpm install
Progress: resolved 595, reused 595, downloaded 0, added 595, done
Done in 25.9s using pnpm v11.8.0            # 退出码 0

$ pnpm typecheck
$ tsc --noEmit                              # 退出码 0，无输出

$ pnpm db:emit
✔ Emitted contract.json and contract.d.ts
storageHash:    576090a4b7dca44e504bf4b32988da8503d0727daa8d503091a3a5fe7243ec4d
executionHash:  96e31689a41b17c439796dc219a92a7bda12789c946dd3b91275b35d396e8951
profileHash:    3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2
# 与仓库 example/src/generated/prisma8 diff -rq 无差异（NO_DRIFT）

$ pnpm build
$ nest build                                # 退出码 0

$ PORT=3114 DATABASE_URL=postgres://meeting:meeting@127.0.0.1:5432/meeting_booking node dist/main.js
# 无 DB/Redis 启动成功，19 条路由
```

HTTP 实测：

```text
GET  /api/health                  → 200 {"data":{"status":"ok","timestamp":"...","uptime":5}}
GET  /api                          → 200 {"data":{"name":"meeting-booking-api","version":"1.0.0","docs":"/api/docs"}}

POST /api/auth/register  {}       → 400
{"statusCode":400,"message":["name: Invalid input: expected string, received undefined",
 "email: Invalid input: expected string, received undefined",
 "password: Invalid input: expected string, received undefined"],"error":"Bad Request","requestId":"..."}

POST /api/auth/login     {}       → 400 message:["email: ...","password: ..."]

GET  /api/rooms?status=BAD        → 400 message:["status: Invalid option: expected one of \"AVAILABLE\"|\"MAINTENANCE\""]
GET  /api/rooms?page=abc          → 400 message:["page: Invalid input: expected number, received NaN"]
GET  /api/rooms/not-a-uuid        → 400 message:["Invalid UUID"]

POST /api/rooms          {}       → 401 {"statusCode":401,"message":"Unauthorized"}   # 见「验收对照 2」
```

`/api/docs-json`（19 条 path，与迁移前一致）实测：

```text
POST /api/rooms requestBody.required = true
  schema.required   = ["name","capacity","location"]
  schema.properties = ["name","capacity","location","equipment","status"]
  name: {type:string, minLength:2, maxLength:100} / capacity: {type:integer, minimum:1, maximum:500}
  status: {type:string, enum:["AVAILABLE","MAINTENANCE"]}
POST /api/rooms 201  → { data: { ...roomResponse, id: {format:uuid} } }
GET  /api/rooms 200  → { data: [room], meta: {...} }
GET  /api/rooms parameters = page(default 1), pageSize(default 10), keyword, status, minCapacity
GET  /api/stats/bookings/trend parameters = days(default 14, min 1, max 90)
POST /api/auth/register email = {type:string, maxLength:191, format:"email", pattern:"^..."}
GET  /api/users/me 200 → { data: {...} }
```

## 验收对照（Lead 指定的 4 条）

1. `/api/health` 200 —— ✅ 实测 200。
2. `POST /api/rooms` 空 body 返回 400 —— ⚠️ **实测 401**，不是本次迁移的问题：全局 `APP_GUARD` 顺序是 `ThrottlerGuard → JwtAuthGuard → RolesGuard`，**守卫先于管道执行**，`POST /api/rooms` 需要 ADMIN token；无 DB/无 token 时永远到不了 schema 校验。等价的证据：
   - 公开端点的 body 校验：`POST /api/auth/register {}`、`POST /api/auth/login {}` → 400；
   - `POST /api/rooms` 的 schema 已被 Swagger 正确消费（requestBody.required/properties 见上）；要拿到该路由的 400，需要带有效 ADMIN token 且数据库可用。
3. 400 的 `message` 是带路径的数组 —— ✅ 见上（`name: ...` / `status: ...` / `page: ...`）。
4. `docs-json` 里 `POST /api/rooms` 的 requestBody 有 required/properties —— ✅ 见上。

## 遇到的坑

1. **Prisma 8 row 类型 `equipment: readonly string[]` 与 zod infer 的 `string[]` 不兼容**。最初把 service 的 `RoomRow/UserRow/BookingRow` 别名成 zod infer 类型，typecheck 报 6 个 TS2322：
   `The type 'readonly string[]' is 'readonly' and cannot be assigned to the mutable type 'string[]'.`
   最终方案：响应 schema 只作 Swagger 文档用，service 保留原 row interface（`readonly string[]`），两者形状靠约定一致。
2. **`StandardSchemaValidationPipe` 必须全局注册**。`@Body({ schema })` 只是把 schema 写进 `ROUTE_ARGS_METADATA`，由管道读取；漏注册 main.ts 的 `useGlobalPipes` 会**静默不校验**（Swagger 仍照常生成文档，很难发现）。这是代码层面确认的，未做"删除管道"对照实验。
3. **守卫先于管道**：受保护路由的 400 要先过鉴权，无 DB 时无法演示；写测试脚本时不要把它当回归。
4. **`.pipe(z.email())` 会让 OpenAPI 丢 `format: email`**：`z.string().max(191).trim().toLowerCase().pipe(z.email())` 的 `~standard.jsonSchema.input` 只输出 `{"type":"string"}`。改为 `z.preprocess(v => v.trim().toLowerCase(), z.email().max(191))` 后，既保留 trim/小写行为，OpenAPI 又输出 `format:"email"` + `pattern`。
5. **API 版本基线**：无需按规格 §0 升到 `@nestjs/common@12.6.0` / `@nestjs/swagger@12.1.2`；example 的 12.3.3 / 12.1.0 已具备全部所需 API（`standard-schema-validation.pipe.d.ts`、`ApiResponseCommonMetadata.standardSchema`、`StandardSchemaOpenApiConverter`）。升级会引入大 diff，本次不做。
6. **`pnpm install` 退出码 1 的既有缺陷**：`pnpm-workspace.yaml` 的 `allowBuilds` 写的是 `set this to true or false` 占位文本，pnpm 报 `ERR_PNPM_IGNORED_BUILDS` 并以 1 退出（其实包已装完）。已改成布尔（`esbuild: true` 后 postinstall Done），install 变为 exit 0。**这条与审计报告 P1 同源，建议在 audit-example.md 里标为已修。**
7. **默认值下沉到 schema**（Lead 追加要求）：`trend-query.schema.ts` 的 `days` 改为 `.default(14)` 并删掉 `stats.service.ts:122` 的 `query.days ?? 14`；分页 `page/pageSize` 原本就是 `.default(1)`/`.default(10)`，service 里已无 `?? 1` / `?? 10`（全仓 grep 只剩业务语义的日期默认，不在 query 参数上）。docs-json 已显示 `days default 14`、`page default 1`、`pageSize default 10`。

## 未验证 / 剩余风险

- 真实 PostgreSQL 下的 `db:init/db:plan/db:migrate/db:seed` 与 CRUD 成功路径（docker 不可用）；
- Redis 相关分支（refresh 黑名单、stats 缓存）在无 Redis 时走降级，未做有 Redis 的对照；
- Swagger UI 只验了 `docs-json`，未人工过一遍页面；
- 书稿/章节未改（本任务只允许改 example/ 与本报告），章节里若还有 `*.dto.ts` 文件名、`ValidationPipe`、`class-validator` 主写法，需要后续按规格 §9 统一改。
