# Prisma ↔ MySQL 类型映射

## 完整映射表

| Prisma 类型 | MySQL 默认映射 | @db 原生修饰可用值 |
|------------|--------------|-------------------|
| `String` | `VARCHAR(191)` | `@db.VarChar(n)`, `@db.Text`, `@db.TinyText`, `@db.MediumText`, `@db.LongText`, `@db.Char(n)` |
| `Boolean` | `TINYINT(1)` | — |
| `Int` | `INT` | `@db.TinyInt`, `@db.SmallInt`, `@db.MediumInt`, `@db.UnsignedInt` |
| `BigInt` | `BIGINT` | `@db.UnsignedBigInt` |
| `Float` | `DOUBLE` | `@db.Float` |
| `Decimal` | `DECIMAL(65,30)` | `@db.Decimal(m, n)` |
| `DateTime` | `DATETIME(3)` | `@db.DateTime(n)`, `@db.Timestamp(n)`, `@db.Date`, `@db.Time` |
| `Json` | `JSON` | — |
| `Bytes` | `LONGBLOB` | `@db.Blob`, `@db.MediumBlob`, `@db.TinyBlob` |

## 常用 @db 修饰示例

```prisma
model Product {
  // 字符串长度控制
  title   String @db.VarChar(100)     // 短文本
  content String @db.LongText          // 长文本（最大 4GB）
  code    String @db.Char(6)           // 定长（6个字符）

  // 精确小数
  price   Decimal @db.Decimal(10, 2)  // 10 位总长，2 位小数

  // 整数范围
  age     Int    @db.TinyInt           // -128 ~ 127
  score   Int    @db.SmallInt          // -32768 ~ 32767

  // 日期精度
  logAt   DateTime @db.DateTime(0)     // 精确到秒（不存毫秒）

  @@map("products")
}
```

## 字符集与排序规则

```prisma
// MySQL 可以在 datasource URL 中指定
// mysql://root:password@localhost:3306/mydb?charset=utf8mb4&collation=utf8mb4_unicode_ci
```

---

## 参考链接

- [Prisma — MySQL Connector](https://www.prisma.io/docs/concepts/database-connectors/mysql)
- [Prisma — Native Type Mappings](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#native-types-mapping)
