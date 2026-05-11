# SQL CRUD 速查（MySQL + PostgreSQL 对照）

## INSERT — 插入数据

```sql
-- 基础插入
INSERT INTO books (title, author, price) VALUES ('Nest 实战', '张三', 79.00);

-- 批量插入
INSERT INTO books (title, author, price) VALUES
  ('Nest 实战', '张三', 79.00),
  ('Prisma 指南', '李四', 59.00),
  ('PostgreSQL 深入', '王五', 89.00);

-- 忽略重复（MySQL）
INSERT IGNORE INTO users (username, password) VALUES ('john', '123456');

-- 冲突时更新（PostgreSQL）
INSERT INTO users (username, password) VALUES ('john', '123456')
ON CONFLICT (username) DO UPDATE SET password = '123456';
-- MySQL 等价：INSERT ... ON DUPLICATE KEY UPDATE password = '123456';
```

## SELECT — 查询数据

```sql
-- 全量查询（⚠️ 生产环境永远加 LIMIT）
SELECT * FROM books LIMIT 10;

-- 条件查询
SELECT * FROM books WHERE price > 50 AND status = 'available';

-- 模糊搜索
-- MySQL & PG 通用：
SELECT * FROM books WHERE title LIKE '%Nest%';
-- PostgreSQL 专属（大小写不敏感）：
SELECT * FROM books WHERE title ILIKE '%nest%';

-- 排序 + 分页
SELECT * FROM books
WHERE status = 'available'
ORDER BY created_at DESC
LIMIT 10 OFFSET 20;   -- 第 3 页（每页 10 条）

-- 聚合函数
SELECT COUNT(*) as total FROM books;
SELECT AVG(price) FROM books;
SELECT status, COUNT(*) FROM books GROUP BY status;

-- 关联查询（JOIN）
SELECT b.title, b.author, u.username AS borrower
FROM books b
LEFT JOIN borrow_records br ON b.id = br.book_id
LEFT JOIN users u ON br.user_id = u.id
WHERE b.id = 1;
```

## UPDATE — 更新数据

```sql
-- 更新单条（⚠️ 永远带 WHERE，否则全表更新）
UPDATE books SET price = 89.00, updated_at = NOW() WHERE id = 1;

-- 条件更新
UPDATE books SET status = 'borrowed' WHERE id = 1 AND status = 'available';
```

## DELETE — 删除数据

```sql
-- 删除（⚠️ 永远带 WHERE）
DELETE FROM books WHERE id = 100;

-- 软删除（推荐）
UPDATE books SET deleted_at = NOW() WHERE id = 100;
-- 查询时过滤：SELECT * FROM books WHERE deleted_at IS NULL;
```

## MySQL vs PostgreSQL 差异速查

| 操作 | MySQL | PostgreSQL |
|------|-------|-----------|
| 自增主键 | `INT AUTO_INCREMENT` | `SERIAL` 或 `INT GENERATED AS IDENTITY` |
| 限制查询 | `LIMIT 10 OFFSET 20` | 同 MySQL |
| 当前时间 | `NOW()` | `NOW()` 或 `CURRENT_TIMESTAMP` |
| 字符串拼接 | `CONCAT(a, b)` | `a \|\| b` 或 `CONCAT(a, b)` |
| 大小写敏感 | `LIKE`（不敏感） | `LIKE`（敏感），`ILIKE`（不敏感） |
| 冲突更新 | `ON DUPLICATE KEY UPDATE` | `ON CONFLICT ... DO UPDATE` |
| 数据类型转换 | `CAST(x AS CHAR)` | `x::TEXT` |

## 前端视角类比

| SQL 操作 | Vue/React 类比 |
|----------|---------------|
| `SELECT WHERE` | `array.filter()` |
| `SELECT LIKE` | `string.includes()` |
| `ORDER BY` | `array.sort()` |
| `LIMIT / OFFSET` | `array.slice(start, end)` |
| `INSERT` | `array.push()` |
| `UPDATE` | 找到 index → 修改属性 |
| `DELETE` | `array.splice(index, 1)` |
| `LEFT JOIN` | 两个数组按外键做 `find() + map()` |
| `GROUP BY + COUNT` | `array.reduce()` |

---

## 参考链接

- [MySQL — SQL Syntax](https://dev.mysql.com/doc/refman/8.0/en/sql-statements.html)
- [PostgreSQL — SQL Commands](https://www.postgresql.org/docs/16/sql-commands.html)
