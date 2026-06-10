# Prisma 生成的类型体系

## `@prisma/client` 导出了什么

运行 `npx prisma generate` 后，`@prisma/client` 包含了：

```typescript
import { Prisma, PrismaClient, User, Book, BookStatus } from '@prisma/client';
```

## 八大类型分类

### 1. Model 类型（实体）

```typescript
// 直接导入用作返回类型
import { User, Book, BorrowRecord } from '@prisma/client';

@Injectable()
export class UserService {
  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
```

### 2. Enum 类型

```typescript
import { BookStatus } from '@prisma/client';

// BookStatus 就是 prisma/schema.prisma 中定义的枚举
if (book.status === BookStatus.BORROWED) {
  throw new BadRequestException('该书已借出');
}
```

### 3. CreateInput 类型（创建 DTO 校验用）

```typescript
import { Prisma } from '@prisma/client';

// Prisma.UserCreateInput 包含 User 所有字段（含必选）
async register(dto: Prisma.UserCreateInput) {
  // dto 的类型：{ username: string; password: string; nickname?: string; avatar?: string; ... }
  return this.prisma.user.create({ data: dto });
}
```

### 4. UpdateInput 类型

```typescript
// Prisma.UserUpdateInput: 所有字段可选
async update(id: number, dto: Prisma.UserUpdateInput) {
  return this.prisma.user.update({ where: { id }, data: dto });
}
```

### 5. WhereInput 类型

```typescript
// Prisma.BookWhereInput: 所有可能的查询条件
async search(where: Prisma.BookWhereInput) {
  return this.prisma.book.findMany({ where });
}
```

### 6. Select 类型

```typescript
// Prisma.BookSelect: 所有可选字段
const bookSelect = {
  id: true,
  title: true,
  author: true,
} satisfies Prisma.BookSelect;
```

### 7. Include 类型

```typescript
// Prisma.BookInclude: 所有可包含的关联
const bookInclude: Prisma.BookInclude = {
  borrows: true,
  categories: true,
};
```

### 8. 组合返回值类型

```typescript
import { Prisma } from '@prisma/client';

// 精确的类型推断
type BookWithBorrows = Prisma.BookGetPayload<{
  include: { borrows: { include: { user: true } } };
}>;

// BookWithBorrows 类型：
// Book & { borrows: (BorrowRecord & { user: User })[] }
```

## Generate vs 手动维护

```
Prisma 的哲学：Schema 是唯一真相来源 (Single Source of Truth)

prisma/schema.prisma
    ↓ npx prisma generate
自动生成 TypeScript 类型
    ↓
在 Service 中使用类型安全的 API
    ↓ 有任何字段变动
只需修改 schema.prisma → prisma generate → TypeScript 报错指引你改所有引用
```

这和前端 TypeScript + OpenAPI 生成类型是同一套思路——类型从 Schema 自动派生，杜绝手写。

---

## 参考链接

- [Prisma — Generated Types](https://www.prisma.io/docs/concepts/components/prisma-client/advanced-type-safety)
- [Prisma — Prisma Client Type Hints](https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/generating-types)
