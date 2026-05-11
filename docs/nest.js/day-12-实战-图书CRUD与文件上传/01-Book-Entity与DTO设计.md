# Book Entity 与 DTO 设计

## Book Entity

```typescript
// src/book/entities/book.entity.ts
export class Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  price?: number;
  description?: string;
  cover?: string;        // 封面图片 URL（上传后的访问路径）
  status: BookStatus;    // 图书状态
  createdAt: string;
  updatedAt: string;
}

export enum BookStatus {
  AVAILABLE = 'available',
  BORROWED = 'borrowed',
}
```

## CreateBookDto

```typescript
// src/book/dto/create-book.dto.ts
import {
  IsNotEmpty,
  Length,
  Min,
  Max,
  IsOptional,
  IsISBN,
  IsEnum,
  Transform,
} from 'class-validator';
import { BookStatus } from '../entities/book.entity';

export class CreateBookDto {
  @IsNotEmpty({ message: '书名不能为空' })
  @Length(1, 100, { message: '书名 1-100 字' })
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsNotEmpty({ message: '作者不能为空' })
  @Length(1, 50, { message: '作者名 1-50 字' })
  author: string;

  @IsOptional()
  @IsISBN('13', { message: 'ISBN 格式不正确（需 13 位数字）' })
  isbn?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(0, { message: '价格不能是负数' })
  @Max(99999, { message: '价格不能超过 99999' })
  price?: number;

  @IsOptional()
  @Length(0, 500, { message: '简介最多 500 字' })
  description?: string;

  @IsOptional()
  @IsEnum(BookStatus, { message: '状态值不合法' })
  status?: BookStatus;
}
```

## UpdateBookDto

使用 Mapped Types 一行生成：

```typescript
// src/book/dto/update-book.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateBookDto } from './create-book.dto';

export class UpdateBookDto extends PartialType(CreateBookDto) {}
```

等价于 CreateBookDto 的所有字段都变为可选。

## QueryBookDto — 列表查询 + 分页

```typescript
// src/book/dto/query-book.dto.ts
import { IsOptional, Min, Max, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class QueryBookDto {
  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: '页码从 1 开始' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1, { message: '每页最少 1 条' })
  @Max(100, { message: '每页最多 100 条' })
  size?: number = 10;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  keyword?: string;  // 搜索关键字（模糊匹配书名和作者）
}
```

## Entity vs DTO 的职责回顾

```
Entity: 数据库的映射（或 JSON 文件的映射）
  - id: 系统生成
  - createdAt: 系统生成
  - status: 有默认值 'available'

CreateBookDto: 创建时的输入
  - title: 必填 + 1-100 字
  - author: 必填 + 1-50 字
  - isbn: 可选 + 格式校验
  - 没有 id、createdAt、status（由系统生成）

UpdateBookDto: 更新时的输入
  - 全部字段可选（只传要更新的）
  - 通过 PartialType 自动生成

QueryBookDto: 查询时的输入
  - 分页参数 + 模糊搜索关键字
  - 与 Create/Update 完全不同的结构
```

> DTO 本质是为不同的 API 场景设计不同的"门面"。同一个 Book Entity，面对创建、更新、查询这三个场景需要三种不同的校验规则。Day 8 学的 PartialType、PickType、IntersectionType 在这里全部落地。

---

## 参考链接

- [NestJS — Validation](https://docs.nestjs.com/techniques/validation)
- [@nestjs/mapped-types](https://github.com/nestjs/mapped-types)
- 开源笔记：《Nest 通关秘籍》.doc/28.图书管理系统：用户模块后端开发.md
