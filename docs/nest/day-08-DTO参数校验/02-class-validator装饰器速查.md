# class-validator 装饰器速查表

## 概述

`class-validator` 是一个基于装饰器的校验库。它的核心理念：**在 DTO 的 class 属性上声明校验规则，由 ValidationPipe 自动执行**。

```bash
npm install class-validator class-transformer
```

## 常用装饰器分类速查

### 一、字符串校验

| 装饰器 | 作用 | 示例 |
|--------|------|------|
| `@IsNotEmpty()` | 非空（`''`、`null`、`undefined` 都不行） | `@IsNotEmpty({ message: '不能为空' })` |
| `@IsString()` | 必须是字符串 | `@IsString()` |
| `@Length(min, max)` | 字符串长度 | `@Length(2, 20)` |
| `@MinLength(n)` | 最小长度 | `@MinLength(6)` |
| `@MaxLength(n)` | 最大长度 | `@MaxLength(100)` |
| `@IsEmail()` | 邮箱格式 | `@IsEmail()` |
| `@IsUrl()` | URL 格式 | `@IsUrl()` |
| `@Contains(sub)` | 必须包含子串 | `@Contains('hello')` |
| `@IsAlpha()` | 只含字母 | `@IsAlpha()` |
| `@IsAlphanumeric()` | 只含字母和数字 | `@IsAlphanumeric()` |
| `@Matches(pattern)` | 正则匹配 | `@Matches(/^[a-zA-Z0-9]+$/)` |

### 二、数字校验

| 装饰器 | 作用 | 示例 |
|--------|------|------|
| `@IsNumber()` | 必须是数字 | `@IsNumber()` |
| `@IsInt()` | 必须是整数 | `@IsInt()` |
| `@IsPositive()` | 必须是正数 | `@IsPositive()` |
| `@IsNegative()` | 必须是负数 | `@IsNegative()` |
| `@Min(n)` | 最小值 | `@Min(0)` |
| `@Max(n)` | 最大值 | `@Max(100)` |
| `@IsDivisibleBy(n)` | 被 n 整除 | `@IsDivisibleBy(5)` |

### 三、布尔和日期

| 装饰器 | 作用 | 示例 |
|--------|------|------|
| `@IsBoolean()` | 必须是布尔值 | `@IsBoolean()` |
| `@IsDate()` | 必须是 Date 实例 | `@IsDate()` |
| `@IsDateString()` | 必须是 ISO 日期字符串 | `@IsDateString()` |

### 四、枚举和常量

| 装饰器 | 作用 | 示例 |
|--------|------|------|
| `@IsEnum(Entity)` | 必须是枚举的成员 | `@IsEnum(BookStatus)` |
| `@IsIn(values)` | 必须在数组中 | `@IsIn(['admin', 'user'])` |
| `@IsNotIn(values)` | 不能在数组中 | `@IsNotIn(['root', 'super'])` |

### 五、数组

| 装饰器 | 作用 | 示例 |
|--------|------|------|
| `@IsArray()` | 必须是数组 | `@IsArray()` |
| `@ArrayMinSize(n)` | 数组最小长度 | `@ArrayMinSize(1)` |
| `@ArrayMaxSize(n)` | 数组最大长度 | `@ArrayMaxSize(10)` |
| `@ArrayNotEmpty()` | 数组不能为空 | `@ArrayNotEmpty()` |
| `@ArrayContains(values)` | 数组必须包含指定值 | `@ArrayContains(['admin'])` |

### 六、特殊校验

| 装饰器 | 作用 | 示例 |
|--------|------|------|
| `@IsOptional()` | 字段可选（跳过所有校验） | `@IsOptional()` |
| `@IsEmpty()` | 必须为空（常用于 id） | `@IsEmpty()` |
| `@Equals(comparison)` | 严格相等（常用于确认密码） | `@Equals('password')` |
| `@ValidateIf(condition)` | 条件校验 | `@ValidateIf(o => o.role === 'admin')` |
| `@ValidateNested()` | 校验嵌套对象 | `@ValidateNested()` |

## 核心装饰器深入

### @IsOptional() 的正确用法

```typescript
import { IsOptional, IsString } from 'class-validator';

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  title?: string;  // 不传 title → 校验通过；传了但为空字符串 → 校验失败

  @IsOptional()
  @Min(0)
  price?: number;
}
```

> ⚠️ `@IsOptional()` 的意思是"如果值为 `undefined` 或 `null`，跳过该字段的所有校验"。但如果传了值（比如空字符串），后面的 `@IsString()` 仍然会执行。

### @ValidateNested() — 校验嵌套对象

```typescript
import { Type } from 'class-transformer';
import { ValidateNested, IsString, IsNotEmpty } from 'class-validator';

// 嵌套 DTO
class AuthorDto {
  @IsNotEmpty() name: string;
  @IsEmail() email: string;
}

class CreateBookDto {
  @IsNotEmpty() title: string;

  @ValidateNested()      // 校验嵌套 DTO
  @Type(() => AuthorDto) // 必须：否则 class-transformer 不知道目标类型
  author: AuthorDto;
}
```

请求示例：
```json
{
  "title": "Nest 实战",
  "author": {
    "name": "张三",
    "email": "invalid"     // ← 校验失败：不是邮箱格式
  }
}
```

没有 `@Type(() => AuthorDto)`，`author` 只是一个普通对象，class-validator 不会爬入内部校验。

### @ValidateIf() — 条件校验

```typescript
export class RegisterUserDto {
  @IsNotEmpty()
  username: string;

  @MinLength(6)
  @ValidateIf(o => o.source === 'app')
  // 只有 source === 'app' 时，密码才要求 6 位以上
  // source === 'wechat' 时，允许短密码（微信登录不需要密码）
  password: string;

  source: 'app' | 'wechat';
}
```

> `o` 是当前 DTO 的整个对象，可以访问任何已定义的属性。

### @Transform() — 数据预处理

```typescript
import { Transform } from 'class-transformer';

export class CreateBookDto {
  // trim 掉前后空格
  @Transform(({ value }) => value?.trim())
  @IsNotEmpty()
  title: string;

  // 将逗号分隔的字符串转为数组
  @Transform(({ value }) => value?.split(',').map(Number))
  @IsArray()
  categoryIds: number[];
}
```

`@Transform` 在 `@IsNotEmpty()` 之前执行——先转换，再校验。这个顺序很重要。

## 错误消息自定义

每个装饰器都支持 `message` 参数：

```typescript
export class CreateBookDto {
  @IsNotEmpty({ message: '书名不能为空' })
  @Length(1, 100, { message: '书名字数在 $constraint1 到 $constraint2 之间' })
  // $constraint1 = 1, $constraint2 = 100 ，class-validator 自动替换
  title: string;

  @Min(0, { message: '价格必须是正数' })
  @Max(99999, { message: '价格不能超过 $constraint1 元' })
  price: number;
}
```

参数占位符：
| 占位符 | 含义 |
|--------|------|
| `$property` | 属性名（title） |
| `$value` | 用户输入的值 |
| `$target` | 目标类名 |
| `$constraint1` | 第一个约束参数 |
| `$constraint2` | 第二个约束参数 |

## 图书管理系统 DTO 完整示例

```typescript
// src/book/dto/create-book.dto.ts
import {
  IsNotEmpty,
  Length,
  Min,
  Max,
  IsOptional,
  IsISBN,
  Transform,
} from 'class-validator';

export class CreateBookDto {
  @IsNotEmpty({ message: '书名不能为空' })
  @Length(1, 100, { message: '书名 1-100 字' })
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsNotEmpty({ message: '作者不能为空' })
  @Length(1, 50, { message: '作者名 1-50 字' })
  author: string;

  @IsOptional()
  @IsISBN('13', { message: 'ISBN 格式不正确（需 13 位）' })
  isbn?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @Min(0, { message: '价格不能是负数' })
  @Max(99999, { message: '价格不能超过 $constraint1' })
  price?: number;
}
```

> 装饰器从上到下声明，但执行顺序是：`@Transform` 先执行（class-transformer），然后 class-validator 从上到下校验。

---

## 参考链接

- [class-validator — All Validation Decorators](https://github.com/typestack/class-validator#validation-decorators)
- [class-validator — Custom Validation Classes](https://github.com/typestack/class-validator#custom-validation-classes)
- [NestJS — Validation](https://docs.nestjs.com/techniques/validation)
- 开源笔记：《Nest 通关秘籍》.doc/21.如何使用ValidationPipe验证post请求参数.md
