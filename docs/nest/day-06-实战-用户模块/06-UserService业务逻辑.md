# UserService 业务逻辑实现

## 完整代码

`src/user/user.service.ts`：

```typescript
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { DbService } from '../db/db.service';
import { User } from './entities/user.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class UserService {
  @Inject(DbService)
  private dbService: DbService;

  async register(dto: RegisterUserDto) {
    // 1. 读取所有用户
    const users: User[] = await this.dbService.read<User>();

    // 2. 检查用户名是否已存在
    const existingUser = users.find(u => u.username === dto.username);
    if (existingUser) {
      throw new BadRequestException('该用户已注册');
    }

    // 3. 创建新用户
    const newUser: User = {
      username: dto.username,
      password: dto.password,  // 明文存储——生产环境必须 hash（Day 20）
    };

    // 4. 保存
    users.push(newUser);
    await this.dbService.write(users);

    // 5. 返回用户信息（不含 password）
    return {
      username: newUser.username,
    };
  }

  async login(dto: LoginUserDto) {
    // 1. 读取所有用户
    const users: User[] = await this.dbService.read<User>();

    // 2. 查找用户
    const user = users.find(u => u.username === dto.username);
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 3. 验证密码
    if (user.password !== dto.password) {
      throw new BadRequestException('密码不正确');
    }

    // 4. 返回用户信息
    return {
      username: user.username,
    };
  }
}
```

## 设计要点

### 1. 业务异常统一用 Nest 内置类

```typescript
throw new BadRequestException('该用户已注册');
```

响应自动变为：
```json
{
  "statusCode": 400,
  "message": "该用户已注册",
  "error": "Bad Request"
}
```

Nest 内置的 `BadRequestException` 对应 HTTP 400。Day 11 会学如何自定义异常。

### 2. 不返回 password

```typescript
return { username: newUser.username };
// 而不是 return newUser
```

即使密码是明文存储的，也不应该在响应中返回。Day 10 会学 `ClassSerializerInterceptor` 自动过滤。

### 3. 属性注入 vs 构造器注入

这里用了属性注入：

```typescript
@Inject(DbService)
private dbService: DbService;
```

如果用构造器注入：

```typescript
constructor(private dbService: DbService) {}
```

两种都可以。属性注入在子类扩展时更方便，构造器注入在单元测试时更方便。

---

## 参考链接

- [NestJS — Exception Filters](https://docs.nestjs.com/exception-filters)
- [NestJS — Built-in HTTP Exceptions](https://docs.nestjs.com/exception-filters#built-in-http-exceptions)
- 开源笔记：《Nest 通关秘籍》.doc/28. 图书管理系统：用户模块后端开发.md
