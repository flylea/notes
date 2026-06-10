# 全部 Migration 命令

## 命令总览

```bash
npx prisma migrate <command> [options]
```

| 命令 | 用途 | 开发 | 生产 |
|------|------|:---:|:---:|
| `dev` | 开发时：检测变更 → 生成 migration → 应用 → generate | ✅ | ❌ |
| `deploy` | 生产部署：只应用已有 migration，不生成新的 | ❌ | ✅ |
| `reset` | 清空数据库 + 重新应用所有 migration + 运行 seed | ✅ | ❌ |
| `status` | 检查 migration 记录与数据库是否一致 | ✅ | ✅ |
| `diff` | 对比两个状态并输出差异（实验性） | ✅ | ❌ |
| `resolve` | 手动标记某个 migration 的应用状态 | ✅ | ✅ |

## `prisma migrate dev`

```bash
# 基本用法
npx prisma migrate dev --name <描述>

# 完整选项
npx prisma migrate dev \
  --name add-user-phone          # 迁移名称（必填）
  --create-only                  # 只生成 migration 文件，不应用到数据库
  --skip-seed                    # 跳过 seed 脚本
  --skip-generate                # 跳过 prisma generate
```

```bash
# 命名规范
npx prisma migrate dev --name add-user-phone        # 添加字段
npx prisma migrate dev --name create-book-table     # 创建表
npx prisma migrate dev --name add-category-relation # 添加关系
npx prisma migrate dev --name remove-deprecated-col # 删除字段

# 命名风格：动词-名词-描述，小写，用连字符分隔
```

## `prisma migrate deploy`

```bash
# 生产环境专用
npx prisma migrate deploy

# 做了什么：
# 1. 查找 prisma/migrations/ 下所有 migration
# 2. 检查 _prisma_migrations 表，找出尚未应用的
# 3. 按时间戳顺序执行未应用的 migration.sql
# 4. 不生成新 migration，不检测 drift，不重置数据库
```

```yaml
# 典型 CI/CD 配置
deploy:
  script:
    - npm ci
    - npm run build
    - npx prisma generate
    - npx prisma migrate deploy   # 应用数据库变更
    - npm run start:prod
```

## `prisma migrate reset`

```bash
# ⚠️ 仅开发环境！
npx prisma migrate reset

# 等价于：
# DROP DATABASE → CREATE DATABASE → 应用所有 migration → npx prisma db seed

# 选项
npx prisma migrate reset --force   # 跳过确认提示（CI 中可用）
npx prisma migrate reset --skip-seed  # 跳过 seed
```

> ⚠️ 再次强调：**绝对不要在生产环境运行 `migrate reset`**。它会清空所有数据。

## `prisma migrate status`

```bash
npx prisma migrate status

# 正常输出：
# Status of migrations in "./prisma/migrations"
# Following migration(s) have not yet been applied:
# (none)
# All migrations have been successfully applied.

# 异常输出 1：有未应用的 migration
# Following migration(s) have not yet been applied:
# 20240101120000_add_phone

# 异常输出 2：database drift
# Drift detected: Your database schema is not in sync
# with your migration history.
```

## `prisma db push`——migrate dev 的轻量替代

```bash
npx prisma db push
```

| | `prisma migrate dev` | `prisma db push` |
|---|---|---|
| 生成 migration.sql | ✅ | ❌ |
| 应用 Schema 到数据库 | ✅ | ✅ |
| 版本管理 | ✅（migration 文件） | ❌（数据库直接改） |
| 可回滚 | ✅ Git 回滚 + 重新部署 | ❌ 只能手动改回 |
| 适用场景 | 正规项目 | 原型/学习/快速验证 |
| 生成 Prisma Client | ✅ | ❌（需单独 `prisma generate`） |

```bash
# 快速验证时使用 db push
npx prisma db push

# 正式开发使用 migrate dev
npx prisma migrate dev --name xxx
```

> 建议：学习阶段可以用 `db push` 快速迭代。一旦进入团队协作，必须切换到 `migrate dev`。

## `prisma migrate diff`（实验性）

```bash
# 对比两个数据库 URL 之间的差异
npx prisma migrate diff \
  --from-url "mysql://user:pass@localhost:3306/db_old" \
  --to-url "mysql://user:pass@localhost:3306/db_new"

# 对比 schema 文件和数据库
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-url "mysql://user:pass@localhost:3306/db"

# 输出 SQL 差异脚本
npx prisma migrate diff \
  --from-url "..." \
  --to-schema-datamodel prisma/schema.prisma \
  --script > diff.sql
```

## `prisma migrate resolve`

```bash
# 场景：生产环境中某个 migration 失败，但你已手动修复
# 手动标记该 migration 为"已应用"

npx prisma migrate resolve --applied 20240101120000_add_phone

# 或标记为"已回滚"
npx prisma migrate resolve --rolled-back 20240101120000_add_phone
```

> ⚠️ `migrate resolve` 只修改 `_prisma_migrations` 表的记录，不实际修改数据库结构。请确认数据库状态与标记一致后再使用。

## 完整对照表

```
┌───────────────────────────────────────────────────────────┐
│  你的需求                        →  应该用什么命令           │
├───────────────────────────────────────────────────────────┤
│  在本地开发，改了 Schema          →  migrate dev             │
│  快速测试一个 Schema 想法          →  db push                 │
│  想从零重建开发数据库               →  migrate reset           │
│  想查看数据库是否与 migration 一致  →  migrate status          │
│  部署到生产环境                    →  migrate deploy           │
│  生成 migration.sql 但不执行       →  migrate dev --create-only│
│  手动标记 migration 状态           →  migrate resolve         │
│  查看两个数据库之间的差异           →  migrate diff             │
│  查看可视化数据库数据              →  prisma studio            │
└───────────────────────────────────────────────────────────┘
```

## 常见的 Operation 类型

当你运行 `migrate dev` 时，Prisma 自动生成的 SQL 包含以下常见操作：

```sql
-- 创建表
CREATE TABLE "book" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    PRIMARY KEY ("id")
);

-- 添加字段
ALTER TABLE "user" ADD COLUMN "phone" TEXT;

-- 修改字段类型
ALTER TABLE "book" ALTER COLUMN "price" TYPE DECIMAL(10,2);

-- 添加外键
ALTER TABLE "borrow_record"
ADD CONSTRAINT "borrow_record_bookId_fkey"
FOREIGN KEY ("bookId") REFERENCES "book"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- 创建索引
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- 添加 NOT NULL 约束（需要先设置默认值）
ALTER TABLE "book" ALTER COLUMN "status" SET NOT NULL;
```

---

## 参考链接

- [Prisma — CLI Command Reference](https://www.prisma.io/docs/reference/api-reference/command-reference)
- [Prisma — db push vs migrate dev](https://www.prisma.io/docs/concepts/components/prisma-migrate/db-push)
- [Prisma — Patching & Resolving](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
