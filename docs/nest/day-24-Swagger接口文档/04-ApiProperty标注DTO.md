# @ApiProperty 标注 DTO

## 为什么需要标注 DTO

没有 `@ApiProperty` 时，Swagger 看到的 DTO 只是空壳：

```typescript
// 没加 @ApiProperty——Swagger 不知道字段信息
export class CreateBookDto {
  title: string;
  author: string;
  isbn?: string;
}
// Swagger UI 显示：CreateBookDto { } ← 空的！
```

加上后：

```typescript
// 加了 @ApiProperty——Swagger 显示完整字段信息
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookDto {
  @ApiProperty({ description: '书名', example: 'NestJS 实战', maxLength: 200 })
  title: string;

  @ApiProperty({ description: '作者', example: '张三', maxLength: 100 })
  author: string;

  @ApiPropertyOptional({ description: 'ISBN 编号', example: '978-7-111-10001' })
  isbn?: string;

  @ApiPropertyOptional({ description: '图书简介', example: '从入门到精通...' })
  description?: string;

  @ApiPropertyOptional({ description: '价格', example: 79.0 })
  price?: number;
}
```

## @ApiProperty 完整参数

```typescript
@ApiProperty({
  // 基本信息
  description: '字段说明',           // 描述文字
  example: '示例值',                // 单个示例
  examples: ['示例1', '示例2'],      // 多个示例
  required: true,                   // 是否必填（默认 true）
  deprecated: false,                // 是否废弃

  // 类型和格式
  type: String,                     // 显式指定类型
  format: 'email',                  // 格式：email, uri, date-time, uuid
  enum: BookStatus,                 // 枚举值
  enumName: 'BookStatus',          // 枚举名称

  // 验证规则
  minLength: 1,
  maxLength: 200,
  minimum: 0,
  maximum: 99999,
  pattern: '^[a-zA-Z0-9]+$',

  // 默认值
  default: '默认值',

  // 敏感字段
  writeOnly: true,                  // 只在请求中出现（如 password）
  readOnly: true,                   // 只在响应中出现（如 id、createdAt）

  // 关联类型
  isArray: true,                    // 是否数组
  nullable: true,                   // 是否可为 null
})
```

## @ApiPropertyOptional

```typescript
// 等价于 @ApiProperty({ required: false })
@ApiPropertyOptional({ description: '昵称', example: 'Alice' })
nickname?: string;
```

## 完整的 DTO 示例

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookStatus } from '@prisma/client';

export class CreateBookDto {
  @ApiProperty({ description: '书名', example: 'NestJS 从入门到实践', maxLength: 200 })
  title: string;

  @ApiProperty({ description: '作者', example: '张三', maxLength: 100 })
  author: string;

  @ApiPropertyOptional({ description: 'ISBN 编号', example: '978-7-111-10001-1' })
  isbn?: string;

  @ApiPropertyOptional({ description: '图书描述', example: '一本全面介绍 NestJS 的教程' })
  description?: string;

  @ApiPropertyOptional({ description: '价格', example: 79.0 })
  price?: number;

  @ApiPropertyOptional({
    description: '分类 ID',
    example: 1,
  })
  categoryId?: number;
}

export class UpdateBookDto {
  @ApiProperty({ description: '图书 ID', example: 1 })
  id: number;

  @ApiPropertyOptional({ description: '书名', example: 'NestJS 从入门到实践（修订版）' })
  title?: string;

  @ApiPropertyOptional({ description: '作者', example: '张三' })
  author?: string;

  @ApiPropertyOptional({ description: 'ISBN 编号' })
  isbn?: string;

  @ApiPropertyOptional({ description: '图书状态', enum: BookStatus })
  status?: BookStatus;

  @ApiPropertyOptional({ description: '价格', example: 89.0 })
  price?: number;
}

export class BookListResponse {
  @ApiProperty({ description: '图书列表', isArray: true })
  list: Book[];

  @ApiProperty({ description: '总数', example: 100 })
  total: number;

  @ApiProperty({ description: '当前页码', example: 1 })
  page: number;

  @ApiProperty({ description: '每页条数', example: 10 })
  size: number;
}
```

## @ApiHideProperty——隐藏字段

```typescript
import { ApiHideProperty } from '@nestjs/swagger';

export class UserEntity {
  @ApiProperty({ description: '用户名', example: 'alice' })
  username: string;

  @ApiHideProperty()   // Swagger 文档中不显示
  password: string;
}
```

---

## 参考链接

- [NestJS — OpenAPI Types and Parameters](https://docs.nestjs.com/openapi/types-and-parameters)
- [NestJS — OpenAPI Mapped Types](https://docs.nestjs.com/openapi/mapped-types)
