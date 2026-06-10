# Prisma vs TypeORM 全面对比

## 两种哲学

| | Prisma | TypeORM |
|---|---|---|
| 数据建模 | **Schema DSL** — 独立的 `.prisma` 文件 | **Entity Class** — TypeScript class + 装饰器 |
| 类型生成 | 自动生成专用 TypeScript 类型 | 使用 class 自身作为类型 |
| 迁移管理 | 内置 `prisma migrate` | `typeorm migration:generate` |
| 关联处理 | 声明式 relation | `@OneToMany` / `@ManyToOne` 装饰器 |
| 查询方式 | PrismaClient API (方法链) | Repository / QueryBuilder |
| 学习曲线 | 先学 DSL，后学 API | 先学装饰器，后学 Repository |
| Active Record 模式 | ❌ | ✅ `user.save()` |

## Schema 设计对比

### 同一个 User 模型的两种写法

```prisma
// Prisma Schema (schema.prisma)
model User {
  id        BigInt   @id @default(autoincrement())
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  books     Book[]
}
```

```typescript
// TypeORM Entity (user.entity.ts)
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Book, book => book.owner)
  books: Book[];
}
```

## CRUD 操作对比

### 查询

```typescript
// Prisma
const users = await prisma.user.findMany({
  where: { username: { contains: 'john' } },
  include: { books: true },
  orderBy: { createdAt: 'desc' },
  take: 10,
});

// TypeORM
const users = await userRepository.find({
  where: { username: Like('%john%') },
  relations: { books: true },
  order: { createdAt: 'DESC' },
  take: 10,
});
```

### 创建

```typescript
// Prisma
const user = await prisma.user.create({
  data: { username: 'john', password: 'hashed' },
});

// TypeORM
const user = userRepository.create({ username: 'john', password: 'hashed' });
await userRepository.save(user);
// 或 Active Record: const user = new User(); user.username = 'john'; await user.save();
```

## 关键差异

| 维度 | Prisma | TypeORM | 谁更好 |
|------|--------|---------|--------|
| 类型安全 | ⭐⭐⭐⭐⭐ 自动生成精确类型 | ⭐⭐⭐ Class 自身当类型 | Prisma |
| Migration | ⭐⭐⭐⭐⭐ 集成、直观 | ⭐⭐⭐ 需要手动配置 | Prisma |
| 复杂查询 | ⭐⭐⭐ `$queryRaw` 兜底 | ⭐⭐⭐⭐ QueryBuilder | TypeORM |
| 学习曲线 | ⭐⭐⭐⭐ DSL 简单 | ⭐⭐⭐ 装饰器多 | Prisma |
| 生态成熟度 | ⭐⭐⭐⭐ 快速成长 | ⭐⭐⭐⭐⭐ 更久远 | TypeORM |
| 社区 | 122k+ GitHub Stars | 35k+ GitHub Stars | Prisma 更火 |
| Nest 集成 | 官方推荐 + 专用模块 | @nestjs/typeorm 成熟封装 | 都很好 |

## 为什么本教程选 Prisma？

1. **类型安全最高**：Prisma Client 对每个查询生成精确的返回类型，TypeORM 靠 class 推断类型不够准确
2. **Schema DSL 更现代**：独立的声明式 Schema 文件比装饰器散落在 class 中更清晰
3. **NestJS 官方推荐**：Nest 文档中 Prisma 是推荐的 ORM
4. **前端友好**：DSL → 自动类型生成 → IDE 提示 → 不需要背 SQL
5. **社区增长快**：GitHub Stars 已经是 TypeORM 的 3 倍多

> 如果你从 TypeORM 迁移到 Prisma，核心 API 的使用直觉是相似的。Day 16 会完全展开 Prisma 的 CRUD API。

---

## 参考链接

- [Prisma vs TypeORM](https://www.prisma.io/docs/concepts/more/comparisons/prisma-and-typeorm)
- [NestJS — Prisma](https://docs.nestjs.com/recipes/prisma)
- [NestJS — TypeORM](https://docs.nestjs.com/techniques/database)
