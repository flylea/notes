# PostgreSQL 速览与对比

## PostgreSQL 是什么

PostgreSQL（简称 PG）是全球最先进的开源关系型数据库。它以对 SQL 标准的严格遵守、强大的扩展能力和高并发处理闻名。

## MySQL vs PostgreSQL 核心差异

| 维度 | MySQL | PostgreSQL |
|------|-------|-----------|
| 架构层级 | Database → Table | Database → Schema → Table |
| 自增主键 | `AUTO_INCREMENT` | `SERIAL` / `GENERATED AS IDENTITY` |
| 布尔类型 | `TINYINT(1)` / `BOOLEAN` | 原生 `BOOLEAN` |
| JSON 支持 | `JSON` (5.7+) | `JSONB` (比 JSON 快，支持索引) |
| 数组类型 | ❌ 不支持 | ✅ `TEXT[]`, `INT[]` 等 |
| 全文搜索 | 基本支持 | 强大的 `tsvector` / `tsquery` |
| 并发控制 | MVCC (InnoDB) | MVCC (更先进的实现) |
| GIS 支持 | 基本空间索引 | PostGIS 扩展（业界标准） |
| 默认隔离级别 | REPEATABLE READ | READ COMMITTED |
| 许可证 | GPL | PostgreSQL License (MIT-like) |

## PostgreSQL 建表示例

```sql
-- PostgreSQL 中 Schema 组织
CREATE SCHEMA library;

-- 用户表（与 MySQL 对比）
CREATE TABLE library.users (
  id SERIAL PRIMARY KEY,                          -- 自增
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  roles TEXT[] DEFAULT '{user}',                  -- 数组类型！MySQL 没有
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 图书表
CREATE TABLE library.books (
  id SERIAL PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  author VARCHAR(50) NOT NULL,
  isbn VARCHAR(13),
  price DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  cover VARCHAR(255),
  status VARCHAR(20) DEFAULT 'available'
    CHECK (status IN ('available', 'borrowed')),  -- CHECK 约束代替 ENUM
  metadata JSONB,                                 -- 比 MySQL JSON 更高效
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## PostgreSQL 的独特优势

### 1. 数组类型（MySQL 没有）

```sql
-- 给用户打标签
ALTER TABLE library.users ADD COLUMN tags TEXT[] DEFAULT '{}';
UPDATE library.users SET tags = '{typescript,nestjs,senior}';

-- 查询包含特定标签的用户
SELECT * FROM library.users WHERE 'nestjs' = ANY(tags);
```

### 2. JSONB（比 MySQL JSON 更强）

```sql
-- MySQL: SELECT * FROM books WHERE JSON_EXTRACT(metadata, '$.lang') = 'zh';
-- PG: SELECT * FROM books WHERE metadata->>'lang' = 'zh';
-- PG 的 JSONB 支持索引，查询速度是 MySQL JSON 的 10-100 倍
```

### 3. CHECK 约束（MySQL 8.0.16+ 才支持）

```sql
-- MySQL: 只能用 ENUM 或触发器
-- PG: 直接在列上定义约束
price DECIMAL(10,2) CHECK (price >= 0),
status VARCHAR(20) CHECK (status IN ('available', 'borrowed', 'reserved'))
```

## 选型建议

```
选用 MySQL 的场景：
├── 团队已有 MySQL 经验
├── 主从复制、读写分离需求明确
├── 使用常见的 PHP/Node.js 生态（WordPress、Magento）
└── 对 GIS、数组、JSONB 无需求

选用 PostgreSQL 的场景：
├── 复杂的查询需求（CTE、窗口函数、LATERAL JOIN）
├── 需要数组、JSONB、GIS 等高级数据类型
├── 对数据完整性和 SQL 标准有高要求
├── 需要高并发一致性（PG 的 MVCC 更先进）
└── 团队有 Java/Go/Python 背景（这些语言社区偏爱 PG）
```

## 本教程的策略

Day 14-19 同时覆盖 MySQL 和 PostgreSQL：
- Prisma Schema 语法完全一致（只需改 `provider` 和连接串）
- 数据库特定的配置会标注 `-- MySQL` / `-- PostgreSQL`
- 项目代码默认用 MySQL，但切换到 PostgreSQL 只需改一行

> 无论选择哪种数据库，Prisma 屏蔽了大部分底层差异。你写的 `prisma.user.findMany()` 对 MySQL 和 PostgreSQL 是完全一样的。

---

## 参考链接

- [PostgreSQL Documentation](https://www.postgresql.org/docs/16/)
- [MySQL vs PostgreSQL](https://www.postgresql.org/about/)
- [Prisma — MySQL](https://www.prisma.io/docs/concepts/database-connectors/mysql)
- [Prisma — PostgreSQL](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
