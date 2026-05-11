# Mapped Types — DTO 复用

## 问题：重复的 DTO

在图书管理系统中，`CreateBookDto` 和 `UpdateBookDto` 几乎一样，只是更新时所有字段都可选：

```typescript
// 不好的做法：两个独立的 DTO，重复定义
export class CreateBookDto {
  @IsNotEmpty() title: string;
  @IsNotEmpty() author: string;
  @IsOptional() @IsISBN() isbn?: string;
  @IsOptional() @Min(0) price?: number;
}

export class UpdateBookDto {
  @IsOptional() @IsNotEmpty() title?: string;     // 重复！
  @IsOptional() @IsNotEmpty() author?: string;    // 重复！
  @IsOptional() @IsISBN() isbn?: string;          // 重复！
  @IsOptional() @Min(0) price?: number;           // 重复！
}
```

如果以后加一个字段 `publisher`，要改 2 个 DTO——这明显不对。

## 解决方案：@nestjs/mapped-types

```bash
npm install @nestjs/mapped-types
```

Nest 提供了 4 个 Mapped Types 辅助函数，基于 `class-transformer` 和 `class-validator`：

## 1. PartialType — 全部可选

最常用的——从 Create DTO 生成 Update DTO：

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto';

export class UpdateBookDto extends PartialType(CreateBookDto) {}
// UpdateBookDto 自动继承 CreateBookDto 的所有字段，且全部变为可选
```

等价于手写：
```typescript
export class UpdateBookDto {
  @IsOptional() @IsNotEmpty() title?: string;
  @IsOptional() @IsNotEmpty() author?: string;
  @IsOptional() @IsISBN() isbn?: string;
  @IsOptional() @Min(0) price?: number;
  @IsOptional() @Length(1, 500) description?: string;
  // ... 全部字段 × @IsOptional()
}
```

**一行代码替代 50 行重复定义。**

## 2. PickType — 挑选部分字段

```typescript
import { PickType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto';

// 只用于修改书名的小接口
export class UpdateBookTitleDto extends PickType(CreateBookDto, [
  'title',
] as const) {}
```

等价于手写：
```typescript
export class UpdateBookTitleDto {
  @IsOptional() @IsNotEmpty() title?: string;
}
```

## 3. OmitType — 排除某些字段

```typescript
import { OmitType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto';

// 创建时不需要 isbn（后台自动分配）
export class CreateBookWithoutIsbnDto extends OmitType(CreateBookDto, [
  'isbn',
] as const) {}
```

等价于手写：
```typescript
export class CreateBookWithoutIsbnDto {
  @IsNotEmpty() title: string;
  @IsNotEmpty() author: string;
  @IsOptional() @Min(0) price?: number;
  // isbn 被排除
}
```

## 4. IntersectionType — 合并多个 DTO

```typescript
import { IntersectionType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto';
import { PaginationDto } from './pagination.dto';

// 列表查询接口：搜索条件 + 分页
export class QueryBookDto extends IntersectionType(
  CreateBookDto,
  PaginationDto,
) {}
```

等价于手写：
```typescript
export class QueryBookDto {
  @IsOptional() @IsNotEmpty() title?: string;
  @IsOptional() @IsNotEmpty() author?: string;
  @IsOptional() @IsISBN() isbn?: string;
  @IsOptional() @Min(0) price?: number;
  @Type(() => Number) page: number;
  @Type(() => Number) size: number;
}
```

## Mapped Types 对比表

| 函数 | 作用 | 典型场景 |
|------|------|---------|
| `PartialType(dto)` | 所有字段 → 可选 | CreateDto → UpdateDto |
| `PickType(dto, ['a', 'b'])` | 只保留指定的字段 | 拆分大类为小类 |
| `OmitType(dto, ['a', 'b'])` | 排除指定的字段 | 去掉 id / createdAt 等系统字段 |
| `IntersectionType(A, B)` | 合并两个 DTO | 搜索条件 + 分页 |

## 实战：图书管理系统 DTO 设计

```typescript
// ========== src/book/dto/create-book.dto.ts ==========
import { IsNotEmpty, Length, Min, IsOptional, IsISBN, Transform } from 'class-validator';

export class CreateBookDto {
  @IsNotEmpty({ message: '书名不能为空' })
  @Length(1, 100, { message: '书名 1-100 字' })
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsNotEmpty({ message: '作者不能为空' })
  @Length(1, 50, { message: '作者名 1-50 字' })
  author: string;

  @IsOptional()
  @IsISBN('13', { message: 'ISBN 格式不正确' })
  isbn?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(0)
  price?: number;

  @IsOptional()
  @Length(0, 500, { message: '简介最多 500 字' })
  description?: string;
}

// ========== src/book/dto/update-book.dto.ts ==========
import { PartialType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto';

export class UpdateBookDto extends PartialType(CreateBookDto) {}

// ========== src/book/dto/query-book.dto.ts ==========
import { IntersectionType } from '@nestjs/mapped-types';

// 分页 DTO
class PaginationDto {
  @Type(() => Number) @Min(1) page: number;
  @Type(() => Number) @Min(1) @Max(100) size: number;
}

// 搜索 + 分页 = 列表查询 DTO
export class QueryBookDto extends IntersectionType(
  PartialType(CreateBookDto),
  PaginationDto,
) {}
```

> `@nestjs/mapped-types` 让 DTO 的设计产生了"继承树"——改一处，所有变体自动更新。这比在每个文件里重复声明好一个数量级。

---

## 参考链接

- [NestJS — Mapped Types](https://docs.nestjs.com/techniques/validation#mapped-types)
- [@nestjs/mapped-types — Github](https://github.com/nestjs/mapped-types)
- 开源笔记：《Nest 通关秘籍》.doc/22.如何使用class-validator和class-transformer.md
