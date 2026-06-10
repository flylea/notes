# UserController 路由实现

## 完整代码

`src/user/user.controller.ts`：

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() dto: RegisterUserDto) {
    return this.userService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginUserDto) {
    return this.userService.login(dto);
  }
}
```

## UserModule 装配

`src/user/user.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    DbModule.register({ path: 'users.json' }),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
```

## AppModule 注册

`src/app.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';

@Module({
  imports: [UserModule],
})
export class AppModule {}
```

## 完整请求链路回顾

```
POST /user/register
Body: { "username": "john", "password": "123456" }
      ↓
ValidationPipe
  ├── transform: true → Body 转为 RegisterUserDto 实例
  ├── @IsNotEmpty() username → ✓
  └── @MinLength(6) password → ✓ (长度 ≥ 6)
      ↓
UserController.register(@Body() dto)
  → this.userService.register(dto)
      ↓
UserService.register(dto)
  ├── dbService.read<User>() → 从 users.json 读取
  ├── users.find(u => u.username === dto.username) → 查重
  ├── users.push(newUser) → 添加
  ├── dbService.write(users) → 写入 users.json
  └── return { username: 'john' }
      ↓
Nest 自动序列化 → 200 OK
{ "username": "john" }
```

> 从请求到响应，代码路径清晰——这就是分层架构的好处。

---

## 参考链接

- [NestJS — Controllers](https://docs.nestjs.com/controllers)
- 开源笔记：《Nest 通关秘籍》.doc/28. 图书管理系统：用户模块后端开发.md
