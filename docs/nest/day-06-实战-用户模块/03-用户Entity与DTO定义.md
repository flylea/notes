# Entity 与 DTO 定义

## User Entity

`src/user/entities/user.entity.ts`：

```typescript
export class User {
  username: string;
  password: string;
}
```

> Entity 描述"一个用户长什么样"。这里字段很少是因为我们还没引入数据库——Day 15 会有完整的 Prisma Schema。

## RegisterUserDto

`src/user/dto/register-user.dto.ts`：

```typescript
import { IsNotEmpty, MinLength } from 'class-validator';

export class RegisterUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码最少 6 位' })
  password: string;
}
```

### 装饰器说明

| 装饰器 | 规则 | 自定义消息 |
|--------|------|-----------|
| `@IsNotEmpty()` | 不能是 `''` / `null` / `undefined` | `用户名不能为空` |
| `@MinLength(6)` | 最少 6 个字符 | `密码最少 6 位` |

## LoginUserDto

`src/user/dto/login-user.dto.ts`：

```typescript
import { IsNotEmpty, MinLength } from 'class-validator';

export class LoginUserDto {
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码最少 6 位' })
  password: string;
}
```

> RegisterUserDto 和 LoginUserDto 目前字段一样。Day 8 会学 `@nestjs/mapped-types` 来复用 DTO。

## 为什么要区分 Entity 和 DTO？

| | Entity | DTO |
|------|--------|-----|
| 用途 | 描述持久化数据结构 | 描述接口输入/输出 |
| 位置 | 内部使用（Service ↔ Repository） | 边界使用（客户端 ↔ Controller） |
| 变化原因 | 数据库表结构变化 | 接口需求变化 |
| 示例 | `User { id, username, password, createdAt }` | `RegisterUserDto { username, password }` |

> DTO 和 Entity 分开是后端的重要设计原则——**内部数据结构和对外接口解耦**。数据库加了一个字段不需要强迫客户端也传这个字段。

## Nest CLI 生成

也可以直接用 CLI 生成：

```bash
nest g resource user --no-spec
```

这会自动生成 DTO、Entity、Module、Controller、Service。然后手动修改生成的文件为我们要的内容。

---

## 参考链接

- [NestJS — Pipes](https://docs.nestjs.com/pipes)
- [class-validator Documentation](https://github.com/typestack/class-validator)
- 开源笔记：《Nest 通关秘籍》.doc/21. 如何使用 ValidationPipe 验证 post 请求参数.md
