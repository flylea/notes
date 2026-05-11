# Schema 文件三部分详解

## 完整结构

```prisma
// ========== 1. 数据源配置 ==========
datasource db {
  provider = "mysql"           // 数据库类型
  url      = env("DATABASE_URL") // 连接字符串
}

// ========== 2. 代码生成器配置 ==========
generator client {
  provider = "prisma-client-js" // JavaScript/TypeScript 客户端
  output   = "../src/generated/prisma" // 可选：自定义输出路径
}

// ========== 3. 数据模型 ==========
model User {
  id       Int      @id @default(autoincrement())
  username String   @unique
  // ...
}
```

## Datasource — 数据源

```prisma
// MySQL
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  // DATABASE_URL="mysql://root:password@localhost:3306/mydb"
}

// PostgreSQL
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // DATABASE_URL="postgresql://postgres:password@localhost:5432/mydb?schema=public"
}

// SQLite (开发/测试用)
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// 多数据源（高级用法）
datasource primary {
  provider = "postgresql"
  url      = env("PRIMARY_DB_URL")
}
datasource analytics {
  provider = "mysql"
  url      = env("ANALYTICS_DB_URL")
}
```

## Generator — 代码生成器

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]  // 启用预览功能
}

// 也可以使用其他 Provider
generator erd {
  provider = "prisma-erd-generator"  // 生成 ER 图
}
```

重要：每次修改 Schema 后必须运行 `npx prisma generate` 重新生成 Prisma Client。

## Model — 数据模型

```prisma
model User {
  // 字段
  id        Int      @id @default(autoincrement())
  username  String   @unique @db.VarChar(50)  // 原生类型修饰
  email     String?  // ? = 可选
  role      Role     @default(USER)

  // 关联
  books     Book[]

  // 属性（Attributes）
  @@unique([username, email])  // 复合唯一
  @@index([role])              // 索引

  // 枚举
  enum Role {
    USER
    ADMIN
  }
}
```

## 三大组成部分的关系

```
datasource db                → 告诉 Prisma 连哪个数据库
  ↓
generator client             → 告诉 Prisma 生成什么语言的客户端
  ↓
model User { ... }           → 告诉 Prisma 数据库里有哪些表、什么结构
  ↓
npx prisma migrate dev       → Prisma 读取 Model → 生成 SQL → 在数据库中建表
npx prisma generate          → Prisma 读取 Model → 生成类型安全的 JS/TS 客户端
```

---

## 参考链接

- [Prisma — Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma — Data Sources](https://www.prisma.io/docs/concepts/components/prisma-schema/data-sources)
- [Prisma — Generators](https://www.prisma.io/docs/concepts/components/prisma-schema/generators)
