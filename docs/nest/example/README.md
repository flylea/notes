# 会议室预订系统 · NestJS 12 + Prisma 8 参考实现

《NestJS 12 全栈实战通关教程》配套的可运行后端。覆盖 ESM、Prisma 8（contract-first）+ PostgreSQL 17、可选 Redis 缓存、JWT 双 token、Swagger、统一响应/异常、限流与 RBAC。

> 本目录是**独立项目**，不是仓库根 pnpm workspace 的成员。安装依赖请使用 `pnpm install --ignore-workspace`。

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 框架 | NestJS 12.3.x，ESM（`"type": "module"`，`module: nodenext`） |
| 运行时 | Node.js ≥ 22.12，pnpm 11 |
| 数据库 | PostgreSQL 17 |
| ORM | Prisma 8（`prisma@8.0.0-rc.29` + `@prisma/orm-postgres@8.0.0-rc.21`），contract-first |
| 缓存 | Redis 8 + ioredis 6（可选，未配置自动降级） |
| 认证 | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`，access/refresh 双 token |
| 文档 | `@nestjs/swagger` 12.1（Swagger UI 挂载在 `/api/docs`） |
| 校验 | `class-validator` / `class-transformer` + zod 校验环境变量 |
| 工具链 | TypeScript 6.0、Nest CLI 12、tsx、helmet、`@nestjs/throttler` |

本期示例**不包含自动化测试**：验收方式是 `pnpm build`、`pnpm typecheck` 与真实 HTTP 请求（见文末命令）。

## 数据层：contract-first

Prisma 8 不再从数据库 introspection 生成 schema，而是以契约文件为唯一事实来源：

```text
prisma/contract.prisma  ──pnpm db:emit──▶  src/generated/prisma8/{contract.json,contract.d.ts}
        │                                            │
        └──pnpm db:plan / db:migrate──▶ prisma/migrations/
```

- `prisma/contract.prisma`：模型、枚举、索引、表名（`@@map`）都在这里定义，首行 `// use prisma-8`。
- `src/generated/prisma8/`：`prisma contract emit` 的产物，**已入库**，不要手改。
- `prisma.config.ts`：契约路径、产物目录、迁移目录与 `DATABASE_URL` 的 CLI 配置；会显式加载 `.env.local` / `.env`（Prisma CLI 默认只读 `.env`）。
- `src/database/prisma.ts`：用 `contractFromJson` 读取生成的 `contract.json`，`postgres({ contract, url })` 惰性单例；`DATABASE_URL` 缺失时不会在 import 阶段连接，只有真正查询时才报错。

## 快速开始

```bash
cd example

# 1. 准备环境变量（DATABASE_URL / DIRECT_URL / REDIS_URL）
cp .env.example .env

# 2. 启动 PostgreSQL 17 + Redis 8
docker compose up -d
docker compose ps          # 等待 postgres healthy

# 3. 安装依赖（不要省略 --ignore-workspace）
pnpm install --ignore-workspace

# 4. 生成 Prisma 8 契约产物
pnpm db:emit

# 5. 第一次初始化数据库（二选一）
pnpm db:init                       # 原型期：直接把契约同步到空库
# 或者走迁移：
# pnpm db:plan --name init
# pnpm db:migrate

# 6. 写入演示数据
cp .env.example .env       # 已存在则跳过
pnpm db:seed

# 7. 构建 / 开发
pnpm build
pnpm start:dev
```

启动后：

- API 根地址：<http://localhost:3000/api>
- 健康检查：<http://localhost:3000/api/health>
- Swagger UI：<http://localhost:3000/api/docs>

`pnpm db:seed` 会写入两个账号：

| 角色 | 邮箱 | 密码 |
| --- | --- | --- |
| ADMIN | `admin@example.com` | `Admin123456` |
| USER | `user@example.com` | `User123456` |

### 没有 Docker？

连接本机已有的 PostgreSQL 17：创建数据库 `meeting_booking` 与用户 `meeting/meeting`，然后按需修改 `.env` 的 `DATABASE_URL` / `DIRECT_URL`。Redis 可留空，统计接口会自动改为直接查库。

### 没有数据库 / Redis 时

- `pnpm build`、`pnpm typecheck`、`pnpm db:emit` 不依赖数据库，也不会在 import 阶段建立连接。
- `pnpm start:dev` **需要** PostgreSQL；Redis 是可选的。
- 未设置 `DATABASE_URL` 时应用会在启动时被 zod 配置校验拦下，并打印具体字段错误。

## 目录结构

```text
example/
├── docker-compose.yml          # PostgreSQL 17 + Redis 8
├── prisma.config.ts            # Prisma 8 CLI 配置（契约 / 产物 / 迁移 / 连接串）
├── prisma/
│   ├── contract.prisma         # 契约：唯一事实来源
│   ├── migrations/             # db:plan / db:migrate 产物
│   └── seed.ts                 # 演示数据（tsx 运行）
├── src/
│   ├── main.ts                 # 全局前缀、helmet、CORS、ValidationPipe、Swagger
│   ├── app.module.ts           # 全局守卫/拦截器/过滤器装配
│   ├── generated/prisma8/      # db:emit 产物（contract.json / contract.d.ts）
│   ├── config/                 # zod 环境变量校验 + 分层配置 + loadEnvFiles
│   ├── database/               # Prisma 8 客户端单例与 DatabaseModule（不在 import 时连接）
│   ├── redis/                  # 可选 Redis 客户端与降级封装
│   ├── common/
│   │   ├── decorators/         # @Public @Roles @CurrentUser
│   │   ├── dto/                # 分页 DTO/通用分页结果
│   │   ├── enums.ts            # 与契约枚举一一对应的运行时取值
│   │   ├── filters/            # 统一异常响应
│   │   ├── guards/             # JwtAuthGuard / RolesGuard
│   │   ├── interceptors/       # { data, meta? } 响应包装
│   │   ├── middleware/         # x-request-id
│   │   └── types/
│   └── modules/
│       ├── auth/               # 注册/登录/刷新/登出/JwtStrategy
│       ├── users/              # 用户查询/资料更新
│       ├── rooms/              # 会议室 CRUD（写操作仅 ADMIN）
│       ├── bookings/           # 预订创建（冲突校验）/列表/审批/驳回/取消
│       └── stats/              # 总览 / 房间使用率 / 预订趋势（Redis 缓存）
```

## 数据模型

模型名 PascalCase，表名由 `@@map` 映射为复数小写；主键均为 UUID（`Uuid @id @onCreate(uuid())`），时间列为 `TimestamptzString`。

- `users`：`id, name, email(unique), password_hash, role(ADMIN|USER), avatar_url, created_at, updated_at`
  - `passwordHash` 默认不出现在查询里：服务层统一用 `select(...)` 显式列字段，登录时才额外带出。
- `rooms`：`id, name, capacity, location, equipment(String[] → text[]), status(AVAILABLE|MAINTENANCE), created_at, updated_at`
- `bookings`：`id, user_id, room_id, start_time, end_time, status, remark, created_at, updated_at`
  - 状态：`PENDING | APPROVED | REJECTED | CANCELLED`
  - 联合索引 `(room_id, start_time, end_time)` 支撑冲突查询。
  - 关系：`user`（`onDelete: Cascade`）、`room`（`onDelete: Restrict`）。

### 时间冲突规则

采用半开区间 `[startTime, endTime)`：

```text
已有预订.start < 新预订.end  且  已有预订.end > 新预订.start  → 冲突
```

相邻时段（10:00–11:00 与 11:00–12:00）不算冲突。`PENDING` 与 `APPROVED` 都会占用时间；`REJECTED`、`CANCELLED` 不占用。审批通过时会**再次**检查冲突，避免等待审批期间被其他预订抢占。

其他业务规则：开始时间必须晚于当前时间、结束时间必须晚于开始时间、单次预订不超过 8 小时、维护中的会议室不可预订。

## API 一览

统一前缀 `/api`。除标注 `@Public` 的接口外，均需 `Authorization: Bearer <accessToken>`。

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| POST | `/auth/register` | 公开 | 注册并返回双 token |
| POST | `/auth/login` | 公开 | 邮箱密码登录 |
| POST | `/auth/refresh` | 公开 | 用 refreshToken 换新 token（rotation） |
| POST | `/auth/logout` | 登录 | 登出并撤销 refreshToken |
| GET | `/users/me` | 登录 | 当前用户资料 |
| PATCH | `/users/me` | 登录 | 修改 name/avatarUrl |
| GET | `/users` | ADMIN | 分页 + role/keyword 过滤 |
| GET / PATCH | `/users/:id` | ADMIN | 用户详情 / 修改角色 |
| GET | `/rooms` | 公开 | 分页 + keyword/status/minCapacity |
| GET | `/rooms/:id` | 公开 | 会议室详情 |
| POST / PATCH / DELETE | `/rooms`、`/rooms/:id` | ADMIN | 增改删；有预订记录时禁止删除 |
| POST | `/bookings` | 登录 | 创建预订（时间冲突校验） |
| GET | `/bookings` | 登录 | 普通用户仅自己的；ADMIN 可按 userId 过滤 |
| GET | `/bookings/:id` | 登录 | 本人或 ADMIN |
| PATCH | `/bookings/:id/approve` | ADMIN | 审批通过（再次查冲突） |
| PATCH | `/bookings/:id/reject` | ADMIN | 驳回，可带 `remark` |
| PATCH | `/bookings/:id/cancel` | 本人/ADMIN | 取消 PENDING/APPROVED |
| GET | `/stats/overview` | ADMIN | 用户/会议室/预订总数，缓存 30s |
| GET | `/stats/rooms/usage` | ADMIN | 房间使用率，支持 `from`/`to`（≤90 天） |
| GET | `/stats/bookings/trend` | ADMIN | 最近 N 天预订趋势，`days` 1–90 |

注册/登录示例：

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"张三","email":"zhangsan@example.com","password":"Password123"}'
```

### 响应结构

成功（拦截器统一包装；分页接口把 `items` 摊平为 `data`，`meta` 单独返回）：

```json
{ "data": { "id": "...", "name": "..." } }
```

```json
{
  "data": [{ "id": "..." }],
  "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
}
```

失败（全局异常过滤器）：

```json
{
  "statusCode": 409,
  "message": "该时间段与已有预订冲突，请选择其他时间",
  "error": "Conflict",
  "requestId": "8f2c1f50-..."
}
```

`requestId` 优先复用请求头 `x-request-id`（长度 ≤128），否则生成 UUID，并写回响应头。5xx 不会把内部堆栈返回给客户端。

## Prisma 8 工作流

| 场景 | 命令 |
| --- | --- |
| 改完契约，生成运行时产物 | `pnpm db:emit`（`prisma contract emit`） |
| 生成迁移（离线，不连库） | `pnpm db:plan --name <改动>`（`prisma migration plan`） |
| 应用迁移 | `pnpm db:migrate`（`prisma db migrate --advance-ref db`） |
| 原型期直接同步空库 | `pnpm db:init` |
| 已有迁移时检查漂移 | `pnpm db:check` / `pnpm db:verify` |
| 演示数据 | `pnpm db:seed` |

规则：**先改契约，再 emit，再 plan，再 migrate**。`prisma/migrations/` 与 `src/generated/prisma8/` 都要提交，不要手改生成物。

## 安全与工程化

- **JWT 双 token**：access 15m、refresh 7d（可由 `.env` 调整），payload 中 `type` 区分用途，refresh token 不能当 access token 用。
- **refresh rotation**：刷新时签发新 token，并把旧 `jti` 写入 Redis 黑名单直至过期。Redis 不可用时退化为“旧 token 到期才失效”（见「已知限制」）。
- **RBAC**：全局 `JwtAuthGuard` + `RolesGuard`，路由用 `@Public()` / `@Roles(Role.ADMIN)` 声明。
- **ValidationPipe**：`whitelist: true`、`transform: true`；未声明字段会被剔除。
- **Throttler**：默认每 60s 每 IP 100 次，可通过 `THROTTLE_TTL`/`THROTTLE_LIMIT` 调整。
- **helmet + CORS 白名单**：CORS 来源由 `CORS_ORIGINS` 控制，默认允许本地 5173/4173/3000。
- **密码**：bcryptjs，cost 10；接口响应中永不返回 `passwordHash`。
- **配置校验**：zod 在启动时校验全部环境变量，失败直接阻止启动并打印字段错误。
- **无 import 副作用**：Prisma 客户端只有第一次查询时才创建连接，保证 build 在无数据库环境通过。

## 已知限制 / 下一步

1. **统计在应用层聚合**：房间使用率与趋势目前把区间内预订拉回内存计算，数据量大时应改成 SQL `GROUP BY` + 合适索引。
2. **Redis 降级语义**：未配置 Redis 时，refresh token 撤销列表失效，旧 token 只能等自然过期；统计缓存也退化为直查。
3. **未实现**：邮箱验证、找回密码、会议室图片上传、审批通知、可选设备筛选。
4. **本期不含自动化测试**：示例只保留构建 / 类型检查 / curl 验收；需要回归时可另起测试工程，避免把测试依赖带进教材示例。
5. **Swagger 版本**：教程正文按 `@nestjs/swagger` 11 编写；本示例因 Nest 12 peer 依赖使用 **12.1.0**（API 用法一致，仅版本差异）。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm install --ignore-workspace` | 安装依赖（避免被仓库根 workspace 接管） |
| `pnpm build` | Nest CLI 编译到 `dist/`（ESM） |
| `pnpm start:dev` | 监听模式开发 |
| `pnpm start:prod` | 运行 `node dist/main.js`（先 build） |
| `pnpm typecheck` | 仅类型检查 |
| `pnpm db:emit` | 生成 `src/generated/prisma8/` |
| `pnpm db:init` / `pnpm db:update` | 空库引导 / 原型期直接同步 |
| `pnpm db:plan --name <改动>` / `pnpm db:migrate` | 生成 / 应用迁移 |
| `pnpm db:seed` | 写入演示数据 |
| `docker compose up -d` / `down` | 启停 PostgreSQL 17 + Redis 8 |
