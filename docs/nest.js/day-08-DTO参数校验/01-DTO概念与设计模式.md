# DTO 概念与设计模式

## 没有 DTO 的世界

回顾 Day 6 图书管理系统的注册接口，如果不用 DTO：

```typescript
@Post('register')
async register(@Body() body: any) {
  // body 的类型是 any —— 完全不可控
  // 鬼知道前端传了什么字段？
  return this.userService.register(body);
}
```

问题：
- `body` 是 `any` 类型，IDE 没有任何提示
- 前端可以传任何字段（`isAdmin: true`、`balance: 9999999`）
- Service 层不知道 body 里有什么、类型是什么

## DTO 的第一层意义：类型安全

```typescript
// 定义一个 DTO
class RegisterUserDto {
  username: string;
  password: string;
}

@Post('register')
async register(@Body() dto: RegisterUserDto) {
  // dto 的类型是 RegisterUserDto —— IDE 有智能提示
  // dto.username → string
  // dto.password → string
  return this.userService.register(dto);
}
```

> 有了 DTO，TypeScript 编译器就能在写代码阶段帮你检查属性名的拼写和类型。

## DTO 的第二层意义：校验

```typescript
import { IsNotEmpty, MinLength } from 'class-validator';

class RegisterUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @MinLength(6, { message: '密码最少 6 位' })
  password: string;
}
```

配合 `ValidationPipe`，校验变成声明式的——不用在 Controller 里写 `if (!dto.username)`。

## DTO 的第三层意义：白名单过滤

```typescript
// DTO 中只定义了 username 和 password
// ValidationPipe(whitelist: true) 自动剔除 isAdmin 和 balance
// 从源头防止"mass assignment"攻击

POST /user/register
{
  "username": "hacker",
  "password": "123456",
  "isAdmin": true,       // ← 被剔除
  "balance": 9999999      // ← 被剔除
}
```

这比前端表单控制更安全——因为攻击者可以直接 curl 请求，绕过前端页面。

## DTO vs Entity 精确定义

| 层面 | Entity | DTO |
|------|--------|-----|
| 定位 | 数据存储模型 | 数据传输模型 |
| 对应 | 数据库表结构 | API 请求/响应格式 |
| 来源 | DB Schema → Prisma Model | 前端请求 → 后端接收 |
| 字段 | 包含所有持久化字段（含 id、createdAt 等系统字段） | 只包含接口需要的字段 |
| 校验 | 通常无校验（数据来自数据库） | 有 class-validator 装饰器 |

### 实例对比：图书管理系统

```typescript
// Entity — 数据存储模型
export class User {
  id: string;           // 系统生成
  username: string;
  password: string;     // 必须存储
  createdAt: Date;      // 系统生成
  updatedAt: Date;      // 系统生成
}

// DTO — 注册请求
export class RegisterUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  @Length(2, 20, { message: '用户名 2-20 位' })
  username: string;

  @MinLength(6, { message: '密码最少 6 位' })
  password: string;
  // 没有 id — 注册时不存在
  // 没有 createdAt — 服务端生成
}

// DTO — 登录请求
export class LoginUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
  // 和 RegisterUserDto 的校验规则不同——登录时密码不限制长度
}
```

**关键差异**：同一个 Entity，可以对应多个 DTO。注册：需要长度约束；登录：只检查非空。这是 DTO 设计的精髓——**接口层面的校验逻辑，因场景而异**。

## DTO 的第四层意义：接口契约

DTO 是前后端之间的**类型契约**：

```typescript
// 后端定义的 DTO
export class RegisterUserDto {
  username: string;
  password: string;
}

// 前端的等价类型（手动同步 or 通过 OpenAPI 自动生成）
interface RegisterUserDto {
  username: string;
  password: string;
}
```

有了 DTO，配合 Day 24 的 Swagger，可以自动生成前端 TypeScript 类型——前后端类型同步，告别"字段名拼错"的低级 bug。

## Create DTO vs Update DTO 模式

这是企业项目中最常见的 DTO 设计模式：

```typescript
// 创建 — 所有字段必填
export class CreateBookDto {
  @IsNotEmpty() title: string;
  @IsNotEmpty() author: string;
  @IsNotEmpty() isbn: string;
}

// 更新 — 所有字段可选（只更新传了的字段）
export class UpdateBookDto {
  @IsOptional() title?: string;
  @IsOptional() author?: string;
  @IsOptional() isbn?: string;
}
```

Day 8 第五个小节会讲如何用 `PartialType` 一行代码从 `CreateBookDto` 生成 `UpdateBookDto`。

## 前端类比

| Nest DTO | 前端类比 |
|----------|---------|
| DTO 类型定义 | TypeScript interface / GraphQL schema |
| class-validator 装饰器 | VeeValidate 的 `required`、`minLength` 规则 |
| `whitelist: true` | Pinia store 在 mutation 中冻结未知属性 |
| 多个 DTO 对应一个 Entity | 同一个 API 数据在列表页和详情页有不同的 TypeScript 类型 |
| DTO 作为契约 | GraphQL Schema 第一公民的理念 |

> DTO 不是"多写了一层代码"，它是类型安全、校验规则、接口契约三者的集合点。Day 8 的核心任务就是把 DTO 的校验部分彻底掌握。

---

## 参考链接

- [NestJS — Validation](https://docs.nestjs.com/techniques/validation)
- [NestJS — Pipes](https://docs.nestjs.com/pipes)
- [class-validator — Validation Decorators](https://github.com/typestack/class-validator#validation-decorators)
- 开源笔记：《Nest 通关秘籍》.doc/21.如何使用ValidationPipe验证post请求参数.md
