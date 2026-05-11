# Prisma ↔ PostgreSQL 类型映射

## 完整映射表

| Prisma 类型 | PostgreSQL 默认映射 | @db 原生修饰可用值 |
|------------|-------------------|-------------------|
| `String` | `TEXT` | `@db.VarChar(n)`, `@db.Char(n)`, `@db.Uuid` |
| `Boolean` | `BOOLEAN` | — |
| `Int` | `INTEGER` | `@db.SmallInt` |
| `BigInt` | `BIGINT` | — |
| `Float` | `DOUBLE PRECISION` | `@db.Real` |
| `Decimal` | `DECIMAL(65,30)` | `@db.Decimal(m, n)` |
| `DateTime` | `TIMESTAMP(3)` | `@db.Timestamp(n)`, `@db.Date`, `@db.Time(n)` |
| `Json` | `JSONB` | `@db.Json`（普通 JSON，不推荐） |
| `Bytes` | `BYTEA` | — |
| `String[]` | `TEXT[]` | ✅ **MySQL 不支持** |

## PostgreSQL 独有的 @db 修饰

```prisma
model Product {
  id       String @id @default(uuid()) @db.Uuid  // UUID 主键
  tags     String[]                               // 数组列
  metadata Json                                   // 默认 JSONB
  price    Decimal @db.Decimal(10, 2)
  status   String  @db.VarChar(20)

  @@map("products")
}
```

## MySQL vs PostgreSQL 类型选择差异

| 场景 | MySQL | PostgreSQL |
|------|-------|-----------|
| 主键 | `Int @default(autoincrement())` | `Int @default(autoincrement())` 或 `@db.Uuid` |
| 长文本 | `@db.LongText` | `String`（默认 TEXT，无需修饰） |
| 标签数组 | ❌ 需要中间表 | `String[]` 直接存储 |
| JSON 字段 | `Json`（JSON 类型） | `Json`（JSONB 类型，可索引） |
| 布尔值 | `Boolean` → `TINYINT` | `Boolean` → `BOOLEAN` |
| 真假值 | `true` = 1, `false` = 0 | 原生 `true` / `false` |

## Prisma 屏蔽了差异

```typescript
// 下面这行代码在 MySQL 和 PostgreSQL 中完全相同：
const books = await prisma.book.findMany({
  where: { price: { gt: 50 } },
  take: 10,
});

// Prisma 自动根据 datasource provider 生成对应的 SQL：
// MySQL: SELECT ... WHERE price > 50 LIMIT 10
// PG:    SELECT ... WHERE price > 50 LIMIT 10  (完全一样)
```

> `@db.*` 是 Prisma 的高级功能——大多数情况下你不需要它。只有在需要精确控制数据库列类型时才使用。

---

## 参考链接

- [Prisma — PostgreSQL Connector](https://www.prisma.io/docs/concepts/database-connectors/postgresql)
- [Prisma — Native Type Mappings](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#native-types-mapping)
