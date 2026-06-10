# AuthGuard：解析 Token 并挂载用户信息

## Guard 的作用

从 HTTP 请求的 Authorization Header 中提取 Bearer Token，验证有效性，并将用户信息挂载到 `request.user`。

```
用户请求（带 Token） → AuthGuard → 验证通过 → request.user = { sub, username, role }
                                   → 验证失败 → 401 Unauthorized
```

## 完整实现

```typescript
// src/auth/auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

// 定义 JWT Payload 的类型
export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 检查是否标记为公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;  // 公开接口直接放行
    }

    // 2. 获取请求对象
    const request = context.switchToHttp().getRequest<Request>();

    // 3. 提取 Token
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('未提供认证 Token');
    }

    // 4. 验证 Token
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        // 验证选项
        // issuer: 'book-management-api',
        // audience: 'book-management-app',
      });

      // 5. 挂载用户信息到 request
      request.user = payload;

      return true;
    } catch (error) {
      // 区分不同的 Token 错误
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token 已过期，请重新登录');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Token 无效');
      }
      throw new UnauthorizedException('认证失败');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    // Authorization: Bearer <token>
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

## Bearer Token 规范

```
Authorization 头的标准格式：

Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

└─────────────┬─────────┘ └──┬──┘ └─────────┬─────────┘
              │              │              │
          Header 名      认证类型     Token 字符串
                       (schema)

认证类型可以是：Bearer, Basic, Digest, ...
Bearer 是最常用的，表示"持有此 Token 者即为用户"
```

## 注册 AuthGuard

### 方式 1：全局注册（推荐）

```typescript
// src/app.module.ts 或 main.ts
import { APP_GUARD } from '@nestjs/core';

// 在 AppModule 中
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

```typescript
// 或在 main.ts 中
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalGuards(new AuthGuard(jwtService, reflector));
  // ⚠️ 问题：useGlobalGuards 不在 DI 容器中，无法注入 JwtService
}
```

> 推荐使用 `APP_GUARD` token 方式，因为它在 DI 容器内，可以注入其他依赖。

### 方式 2：Controller 级别

```typescript
@Controller('book')
@UseGuards(AuthGuard)
export class BookController {}
```

### 方式 3：路由级别

```typescript
@Controller('book')
export class BookController {
  @Get('list')
  @UseGuards(AuthGuard)
  async list() {}
}
```

## 在 Controller 中使用 request.user

```typescript
// src/borrow/borrow.controller.ts
import { Controller, Post, Body, Req } from '@nestjs/common';
import { BorrowService } from './borrow.service';
import { Request } from 'express';

@Controller('borrow')
export class BorrowController {
  constructor(private readonly borrowService: BorrowService) {}

  @Post('borrow')
  async borrow(
    @Body('bookId') bookId: string,
    @Req() req: Request,  // 获取请求对象
  ) {
    const userId = req.user!.sub;  // 从 Token 中提取 userId

    return this.borrowService.borrowBook(userId, parseInt(bookId, 10));
  }

  // 改造：借书不需要前端传 userId 了
  // 旧接口：POST /borrow/borrow  body: { userId, bookId }
  // 新接口：POST /borrow/borrow  body: { bookId }
  // userId 自动从 Token 中提取——更安全！
}
```

## 创建 @CurrentUser 装饰器

避免在每个 Controller 方法中写 `req.user`，封装一个参数装饰器：

```typescript
// src/auth/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './auth.guard';

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    // 如果传了 data 参数，返回指定字段
    // @CurrentUser('sub') → 返回 user.sub
    // @CurrentUser() → 返回整个 user 对象
    return data ? user?.[data] : user;
  },
);
```

### 使用 @CurrentUser

```typescript
@Controller('borrow')
export class BorrowController {
  constructor(private readonly borrowService: BorrowService) {}

  @Post('borrow')
  async borrow(
    @Body('bookId') bookId: string,
    @CurrentUser('sub') userId: number,  // ← 直接拿到 userId
  ) {
    return this.borrowService.borrowBook(userId, parseInt(bookId, 10));
  }

  @Get('my-borrows')
  async myBorrows(@CurrentUser() user: JwtPayload) {
    return this.borrowService.getMyBorrows(user.sub);
  }
}
```

## 改造 BookController 使用 @CurrentUser

```typescript
// 改造前后对比

// 改造前：所有操作都需要前端传 userId
@Post('create')
async create(@Body() body: any) {
  // 没有认证——谁都能创建
  return this.bookService.create(body);
}

// 改造后：创建操作从 Token 获取操作人
@Post('create')
async create(
  @Body() body: Prisma.BookCreateInput,
  @CurrentUser() user: JwtPayload,
) {
  // 可以记录是谁创建的，做审计
  console.log(`用户 ${user.username}(ID:${user.sub}) 新增了图书`);
  return this.bookService.create(body);
}
```

## AuthGuard 决策流程

```
请求到达
    │
    ▼
┌──────────────┐    是    ┌──────────┐
│ @IsPublic()? │────────→│ 直接放行  │
└──────┬───────┘          └──────────┘
       │ 否
       ▼
┌──────────────┐    否    ┌──────────────┐
│ 有 Bearer    │────────→│ 401 未提供   │
│ Token?       │          │ Token       │
└──────┬───────┘          └──────────────┘
       │ 是
       ▼
┌──────────────┐   失败   ┌──────────────┐
│ verify(Token)│────────→│ 401 Token    │
│              │          │ 无效/过期    │
└──────┬───────┘          └──────────────┘
       │ 成功
       ▼
┌──────────────┐
│ request.user │
│ = payload    │
│ 放行          │
└──────────────┘
```

---

## 参考链接

- [NestJS — Guards](https://docs.nestjs.com/guards)
- [NestJS — Custom Route Decorators](https://docs.nestjs.com/custom-decorators)
- [JWT — Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
