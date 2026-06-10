# 登录接口签发 Token

## 创建 AuthService

```typescript
// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    // 1. 查找用户
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 2. 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 3. 签发 Token
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // 4. 返回 Token + 用户信息
    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken,
      user: userWithoutPassword,
    };
  }
}
```

## Payload 设计说明

```typescript
// JWT Payload 标准设计
const payload = {
  sub: user.id,          // subject——JWT 标准字段，标识"主体"
  username: user.username, // 自定义字段——用于日志和 UI 展示
  role: user.role,        // 自定义字段——用于简单权限判断（Day 21 升级）
};

// 不要在 Payload 中放：
// ❌ 密码、手机号、邮箱等敏感信息
// ❌ 大段文本（如用户简介）
// ❌ 动态数据（如借阅数量——会变！）
// ❌ 完整权限列表（如果权限多，Token 会很大）
```

## 修改 UserController 登录接口

```typescript
// src/user/user.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,  // ← 注入 AuthService
  ) {}

  @Post('register')
  async register(@Body() body: { username: string; password: string }) {
    return this.userService.register(body);
  }

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    // 从返回 Token + 用户信息
    return this.authService.login(body.username, body.password);
  }
}
```

## 创建 AuthModule

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from './jwt.module';  // 我们自定义的全局 JwtModule

@Module({
  imports: [JwtModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

## 更新 AppModule

```typescript
// src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // JwtModule 已经是 @Global()，不需要显式 import
    AuthModule,    // ← 新增
    UserModule,
    BookModule,
    BorrowModule,
  ],
})
export class AppModule {}
```

## 登录接口返回示例

```json
// POST /user/login { "username": "alice", "password": "123456" }
// → 200
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsInVzZXJuYW1lIjoiYWxpY2UiLCJyb2xlIjoiVVNFUiIsImlhdCI6MTcwNTMxMjAwMCwiZXhwIjoxNzA1MzE5MjAwLCJpc3MiOiJib29rLW1hbmFnZW1lbnQtYXBpIiwiYXVkIjoiYm9vay1tYW5hZ2VtZW50LWFwcCJ9.xxx",
  "user": {
    "id": 2,
    "username": "alice",
    "nickname": "Alice",
    "avatar": null,
    "role": "USER",
    "borrowCount": 2,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

## 前端登录流程

```
┌──────────────────────────────────────────────┐
│  Vue/React 前端                               │
│                                              │
│  1. 用户输入用户名密码，点击登录                  │
│  2. POST /user/login                         │
│  3. 收到 { accessToken, user }               │
│  4. localStorage.setItem('token', accessToken)│
│  5. 跳转到首页                                │
│                                              │
│  后续请求：                                    │
│  axios 拦截器自动在 Header 中加上               │
│  Authorization: Bearer <accessToken>         │
└──────────────────────────────────────────────┘
```

## 后端 JWT 验证流程（预览）

```
客户端请求                                       服务器
─────────                                       ──────
                                                ┌─────────────────────┐
GET /borrow/my-borrows?userId=1                 │                     │
Authorization: Bearer eyJxxx.yyyy.zzz  ─────────→│ 1. AuthGuard 拦截   │
                                                │                     │
                                                │ 2. 提取 Bearer Token │
                                                │                     │
                                                │ 3. jwtService.verify │
                                                │    签名正确? ✅      │
                                                │    未过期? ✅        │
                                                │                     │
                                                │ 4. 解析 payload:    │
                                                │    { sub: 2,        │
                                                │      username:       │
                                                │      "alice" }      │
                                                │                     │
                                                │ 5. 挂载到 request:  │
                                                │    req.user =       │
                                                │    payload          │
                 200 { ... }  ←─────────────────│                     │
                                                │ 6. 放行到 Controller│
                                                └─────────────────────┘
```

> 下一节实现 AuthGuard，让这个流程跑通。

---

## 参考链接

- [NestJS — JWT Authentication](https://docs.nestjs.com/security/authentication#implementing-the-sign-in-endpoint)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
