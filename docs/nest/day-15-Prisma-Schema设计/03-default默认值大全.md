# @default() 全部可用值

## 自动生成函数

```prisma
model Book {
  id        Int      @id @default(autoincrement())  // 自增整数
  uuid      String   @id @default(uuid())            // UUID v4
  cuid      String   @id @default(cuid())            // CUID
  createdAt DateTime @default(now())                 // 创建时的时间戳
}

// autoincrement() — 仅 Int/BigInt，依赖数据库的自增机制
// uuid() — 生成 UUID v4 字符串（推荐用于分布式系统）
// cuid() — Collision-resistant ID，比 UUID 短且排序友好
// now() — 仅 DateTime，取记录创建时的当前时间
```

## 标量默认值

```prisma
model Book {
  title    String  @default("未命名图书")     // 字符串
  price    Float   @default(0)                // 数字
  isActive Boolean @default(true)             // 布尔
  status   String  @default("available")      // 枚举值（用 String 代替）
  tags     Json    @default("[]")             // JSON 空数组
  count    Int     @default(1)                // 整数
}
```

## 枚举默认值

```prisma
enum BookStatus {
  AVAILABLE
  BORROWED
  RESERVED
}

model Book {
  status BookStatus @default(AVAILABLE)  // 使用枚举成员
}
```

## @updatedAt — 自动更新时间

```prisma
model Book {
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt  // 每次 update 自动设为 now()
}
```

> ⚠️ `@updatedAt` 只对 Prisma Client 的 update 操作生效。如果手动在数据库执行 UPDATE，不会触发。

## 完整的使用示例

```prisma
model User {
  id        BigInt   @id @default(autoincrement())
  uuid      String   @unique @default(uuid())         // 对外暴露用 UUID
  username  String   @unique
  role      Role     @default(USER)
  isActive  Boolean  @default(true)
  loginAt   DateTime?                                  // 可选，无默认值
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  USER
  ADMIN
}
```

---

## 参考链接

- [Prisma — Default Values](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#default)
- [Prisma — @updatedAt](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#updatedat)
