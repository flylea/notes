# --create-only 与手动修改

## 为什么需要 `--create-only`

`prisma migrate dev` 默认会**自动生成 SQL 并立即执行**。但在某些场景下，你需要：

1. **审查生成的 SQL**：确认没有意外的数据丢失操作
2. **手动修改 SQL**：添加 Prisma 不支持的数据库特性
3. **在指定时间执行迁移**：与业务低峰期对齐

```bash
# 只生成 migration 文件，不应用到数据库
npx prisma migrate dev --name add-phone --create-only
```

## 工作流

```
npx prisma migrate dev --name add-phone --create-only
    │
    ▼
prisma/migrations/
└── 20240101120000_add_phone/
    └── migration.sql    ← 只生成文件，未执行
    │
    ▼
你手动 review migration.sql
    │
    ▼
你觉得没问题，执行：
npx prisma migrate dev     ← 应用所有未执行的 migration
```

## 审查 migration.sql

```sql
-- prisma/migrations/20240101120000_add_phone/migration.sql

-- Prisma 自动生成的迁移 SQL
ALTER TABLE "user" ADD COLUMN "phone" VARCHAR(20);
```

审查清单：

```
□ 字段类型是否正确？
□ 有无 NOT NULL 但没有 DEFAULT 的字段？（会导致迁移失败）
□ 删除表/字段的操作是否是预期的？
□ 外键的 ON DELETE 行为是否正确？（CASCADE 会级联删除！）
□ 重命名字段是否被识别为 DROP + ADD？（正确的应该是 RENAME）
```

## 常见的手动修改场景

### 场景 1：添加 NOT NULL 字段需要默认值

```sql
-- Prisma 可能生成这样：
ALTER TABLE "user" ADD COLUMN "role" VARCHAR(10) NOT NULL;
-- ❌ 如果 user 表已有数据，这行会失败！（没有默认值）

-- 手动修改为：
ALTER TABLE "user" ADD COLUMN "role" VARCHAR(10) NOT NULL DEFAULT 'USER';
-- ✅ 已有行会被赋予 'USER' 作为默认值
```

### 场景 2：重命名字段

```sql
-- Prisma 检测不到重命名，会生成：
ALTER TABLE "user" DROP COLUMN "name";     -- ❌ 数据丢失！
ALTER TABLE "user" ADD COLUMN "username" VARCHAR(50);

-- 手动修改为：
ALTER TABLE "user" RENAME COLUMN "name" TO "username";  -- ✅ 数据保留
```

### 场景 3：添加数据库原生特性

```sql
-- Prisma Schema 不支持的数据库特性，手动添加到 migration.sql

-- MySQL：添加表的注释
ALTER TABLE "book" COMMENT '图书信息表';

-- PostgreSQL：使用 BRIN 索引（适合大表的顺序数据）
CREATE INDEX "book_created_at_brin_idx" ON "book" USING BRIN ("created_at");

-- PostgreSQL：设置列的默认表达式
ALTER TABLE "borrow_record"
ALTER COLUMN "due_date" SET DEFAULT (CURRENT_DATE + INTERVAL '30 days');
```

### 场景 4：数据迁移（先改数据再改结构）

```sql
-- 场景：book 表原来的 price 是 INT（分），现在改为 DECIMAL（元）

-- Step 1：添加新列
ALTER TABLE "book" ADD COLUMN "price_new" DECIMAL(10,2);

-- Step 2：迁移数据（分转元）
UPDATE "book" SET "price_new" = "price" / 100.0;

-- Step 3：删除旧列
ALTER TABLE "book" DROP COLUMN "price";

-- Step 4：重命名新列
ALTER TABLE "book" RENAME COLUMN "price_new" TO "price";
```

## 给 migration.sql 添加安全检查

```sql
-- 在 migration.sql 开头添加事务保护

-- PostgreSQL
BEGIN;

-- 你的 migration SQL
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20);

COMMIT;

-- MySQL
-- MySQL 的 DDL 是隐式提交的，无法用事务包裹
-- 可以用存储过程做条件检查
```

## Prisma 支持的数据库特性 vs 需要手动添加的

| 特性 | Schema 声明 | 需要手动 |
|------|:---------:|:------:|
| 基本字段类型 | ✅ | |
| 关系（FK） | ✅ | |
| 默认值 | ✅ | |
| 唯一约束 | ✅ | |
| 普通索引 | ✅（@@index） | |
| 自动递增 | ✅ | |
| CHECK 约束 | ✅（PostgreSQL） | MySQL 需手动 |
| 表/列注释 | | ✅ |
| 触发器 (Trigger) | | ✅ |
| 存储过程 | | ✅ |
| 分区表 | | ✅ |
| 全文索引 | | ✅ |
| 部分索引 (WHERE) | | ✅ |
| 数据库视图 (View) | | ✅ |

## 实战：手动创建 CHECK 约束（MySQL）

```sql
-- MySQL 的 Prisma 不支持 CHECK 约束
-- 在 migration.sql 中手动添加

-- 确保借阅记录的借出时间不晚于归还时间
ALTER TABLE "borrow_record"
ADD CONSTRAINT "borrow_record_dates_check"
CHECK ("borrowedAt" <= "returnedAt"
       OR "returnedAt" IS NULL);
```

对应的 Prisma Schema（PostgreSQL 原生支持）：

```prisma
model BorrowRecord {
  // ... 其他字段

  // PostgreSQL 原生支持 CHECK
  // MySQL 需要手动在 migration.sql 中添加
}
```

## 迁移的安全性检查清单

```
开发阶段每次 migrate 前：
□ 有哪些表被创建？
□ 有哪些字段被删除？（确认数据可以丢弃）
□ 有哪些字段改为 NOT NULL？（确认有默认值）
□ 有哪些字段类型改变？（确认兼容）

生产部署前：
□ 备份数据库
□ 在 staging 环境验证 migration
□ 评估锁表时间（大表 ALTER 可能锁很久）
□ 确认回滚方案
```

## 回滚 Migration

Prisma 没有原生的 `migrate down` 命令，但你可以：

```bash
# 方法 1：创建回滚 migration
npx prisma migrate dev --name revert-add-phone --create-only
# 然后手动编辑 migration.sql，写反向操作
# ALTER TABLE "user" DROP COLUMN "phone";

# 方法 2：使用 migrate resolve（生产环境不推荐）
npx prisma migrate resolve --rolled-back 20240101120000_add_phone

# 方法 3：数据库快照恢复（最安全）
# 前提：迁移前做了备份
```

> 推荐：在开发阶段，如果发现 migration 有问题，直接 `migrate reset` 重新来。生产环境请提前做好备份和 staging 验证。

---

## 参考链接

- [Prisma — Customizing Migrations](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate/customizing-migrations)
- [Prisma — Production Troubleshooting](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
- [Prisma — Prisma Migrate Limitations](https://www.prisma.io/docs/concepts/components/prisma-migrate/limitations-and-known-issues)
