# Migration 完整工作流

## 什么是 Migration

数据库迁移（Migration）是用**代码管理数据库 Schema 版本变更**的方案。类似前端的 git 管理代码版本，Migration 管理数据库结构版本。

```
前端领域类比：

Git 管理代码变更：
  git commit → 记录谁、什么时候、改了什么
  git log    → 查看所有变更历史
  git push   → 同步到远程

Prisma Migration 管理 Schema 变更：
  prisma migrate dev  → 生成迁移文件并应用
  prisma migrate status → 查看迁移状态
  prisma migrate deploy → 在生产环境应用迁移
```

## 为什么需要 Migration

```typescript
// ❌ 没有 Migration 的噩梦：
// 开发环境改了 user 表加了 phone 字段
// 生产环境忘了加 → 接口报错 column "phone" does not exist
// 同事本地数据库还是旧结构 → 你的代码在他机器上跑不起来

// ✅ 有 Migration：
// 1. 你修改 schema.prisma，添加 phone 字段
// 2. 运行 prisma migrate dev → 生成 migration.sql
// 3. 提交 migration.sql 到 Git
// 4. 同事 pull 代码后运行 prisma migrate dev → 自动同步
// 5. 部署时运行 prisma migrate deploy → 生产环境同步
```

## 开发阶段工作流

```
┌──────────────────────────────────────────────────┐
│  Step 1：修改 prisma/schema.prisma                │
│                                                   │
│  model User {                                      │
│    id       Int     @id @default(autoincrement())  │
│    username String  @unique                        │
│    password String                                 │
│    + phone   String?  // 新增字段                  │
│  }                                                 │
│                                                    │
│  Step 2：运行迁移命令                               │
│  $ npx prisma migrate dev --name add-phone         │
│                                                    │
│  Step 3：自动产物                                   │
│  ├── prisma/migrations/                            │
│  │   └── 20240101000000_add_phone/                 │
│  │       └── migration.sql   ← 生成的 SQL           │
│  └── node_modules/.prisma/client/                  │
│      └── index.d.ts          ← 重新生成的类型       │
│                                                    │
│  Step 4：提交到 Git                                 │
│  $ git add prisma/migrations/20240101000000_add_phone│
│  $ git commit -m "feat: add phone field to User"   │
└──────────────────────────────────────────────────┘
```

## `migrate dev` 做了什么

```
npx prisma migrate dev --name add-phone

    │
    ▼
┌─────────────────────────────────────┐
│ 1. 创建一个临时的 shadow database    │
│    用于检测 Schema 变更              │
├─────────────────────────────────────┤
│ 2. 在 shadow database 重放所有      │
│    已有 migration 文件              │
├─────────────────────────────────────┤
│ 3. 计算当前 schema 与 shadow         │
│    database 之间的差异              │
├─────────────────────────────────────┤
│ 4. 生成新的 migration.sql           │
│    ALTER TABLE users               │
│    ADD COLUMN phone VARCHAR(20);   │
├─────────────────────────────────────┤
│ 5. 应用 migration 到开发数据库       │
│    （执行 migration.sql）           │
├─────────────────────────────────────┤
│ 6. 重新生成 Prisma Client           │
│    （npx prisma generate）          │
└─────────────────────────────────────┘
```

## 生产部署工作流

```
开发环境                       生产环境
────────                      ────────
                              ┌──────────────────────┐
                              │  CI/CD Pipeline:      │
                              │  $ npm run build      │
git push → main               │  $ npx prisma generate│
                              │  $ npx prisma migrate │
                              │    deploy             │
                              │  $ npm run start:prod │
                              └──────────────────────┘
```

```yaml
# .github/workflows/deploy.yml（示例）
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Prisma Generate
        run: npx prisma generate
      - name: Prisma Migrate Deploy
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Start
        run: npm run start:prod
```

## `migrate deploy` vs `migrate dev`

| | `migrate dev` | `migrate deploy` |
|---|---|---|
| 用途 | **开发阶段** | **生产环境** |
| 生成新 migration | ✅ | ❌ |
| Shadow database | ✅ | ❌ |
| 重置数据库 | ✅（如果检测到 drift） | ❌（不会，安全第一） |
| 失败时的行为 | 提示重置 | 报错退出（保护数据） |
| CI/CD 中使用 | ❌ | ✅ |

```bash
# 开发时——本地使用
npx prisma migrate dev --name describe-your-change

# 部署时——CI/CD 中使用
npx prisma migrate deploy
```

## 团队协作工作流

```
┌──────────────────────────────────────────────────┐
│                                                   │
│  同事 A                   同事 B                   │
│  ──────                   ──────                   │
│  修改 schema              修改 schema               │
│  生成 migration A          生成 migration B         │
│  git push                  git push                │
│       │                        │                    │
│       └────────┬───────────────┘                    │
│                │                                    │
│                ▼                                    │
│          Git 合并两个 migration                      │
│                │                                    │
│                ▼                                    │
│          按时间戳顺序应用                             │
│          (migrations/ 文件夹内按名称排序)            │
│                                                    │
└──────────────────────────────────────────────────┘
```

> ⚠️ 如果两人的 migration 修改了同一个字段，合并后 `prisma migrate dev` 会检测到 drift 并报错，需要手动解决。

## 处理 Schema Drift

```
Schema Drift = 数据库实际结构 与 migration 记录不一致

常见原因：
  - 有人在数据库手动改了结构（ALTER TABLE）
  - migration 文件被手动删除或修改
  - 生产数据库被非 Prisma 工具修改过

解决方法：
```

```bash
# 查看当前状态
npx prisma migrate status

# 输出示例：
# Database schema is up to date.
# 或
# Drift detected: Your database schema is not in sync
# with your migration history.

# 如果开发环境出现 drift：
npx prisma migrate reset   # ⚠️ 清空数据库并重新应用所有 migration
                            # 仅在开发环境使用！

# 如果生产环境出现 drift：
# 1. 不要用 migrate reset！
# 2. 手动修复数据库结构，使其与 migration 一致
# 3. 或创建新的 migration 来弥补差异
```

## `prisma migrate reset` 适用场景

```bash
# ⚠️ 开发环境专用——会删除所有数据！
npx prisma migrate reset

# 做了什么：
# 1. DROP DATABASE（如果可能）或删除所有表
# 2. 重新 CREATE DATABASE
# 3. 按时间顺序应用所有 migration
# 4. 运行 seed 脚本（如果配置了）

# 适用场景：
# - 开发初期，频繁修改 Schema
# - 想从零开始重建数据库
# - 数据库出现了难以修复的 drift

# 绝对不要在生产环境使用！
```

## 给 Nest 项目的 package.json 添加脚本

```json
{
  "scripts": {
    "db:migrate:dev": "npx prisma migrate dev",
    "db:migrate:deploy": "npx prisma migrate deploy",
    "db:migrate:reset": "npx prisma migrate reset",
    "db:migrate:status": "npx prisma migrate status",
    "db:generate": "npx prisma generate",
    "db:seed": "npx prisma db seed",
    "db:studio": "npx prisma studio"
  }
}
```

---

## 参考链接

- [Prisma — Migration Overview](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma — Migrate dev](https://www.prisma.io/docs/reference/api-reference/command-reference#prisma-migrate-dev)
- [Prisma — Migrate deploy](https://www.prisma.io/docs/reference/api-reference/command-reference#prisma-migrate-deploy)
- [Prisma — Production Deployment](https://www.prisma.io/docs/guides/deployment/deploy-database-changes-with-prisma-migrate)
