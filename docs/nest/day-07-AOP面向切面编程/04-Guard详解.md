# Guard 详解

## Guard 的定位

Guard 是**权限控制层**——它回答一个问题："当前用户是否有权访问这个路由？"

在 Nest 的五切面体系中，Guard 是第一个可以访问 `ExecutionContext` 的切面。这意味着它能看到哪个 Controller 的哪个方法被调用，以及方法上的装饰器元数据。

## Guard 的基本结构

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 检查 Authorization header
    const token = request.headers.authorization;

    if (!token) {
      // Day 11 会学自定义异常：throw new UnauthorizedException('请先登录');
      return false;  // 返回 false = 拒绝访问 → 自动 403
    }

    // 验证 token...（Day 20 会学 JWT）
    return true;  // 返回 true = 放行
  }
}
```

**返回值规则**：
- `true` → 放行，请求继续进入下一切面
- `false` → 拒绝，Nest 自动返回 HTTP 403 Forbidden
- `Promise<boolean>` → 支持异步（比如查数据库验证 token）
- `Observable<boolean>` → 支持响应式

> 注意：如果 Guard 中抛出了异常（如 `throw new UnauthorizedException()`），Nest 会跳过 403 的行为，直接进入 ExceptionFilter。Day 11 详讲。

## ExecutionContext 详解

`ExecutionContext` 是 Guard 最重要的参数——它是 `ArgumentsHost` 的子类，提供了更丰富的上下文信息。

```typescript
canActivate(context: ExecutionContext): boolean {
  // 1. 获取被调用的 handler（即 Controller 中的方法）
  const handler = context.getHandler();
  // 比如：BookController.findById

  // 2. 获取 handler 所属的 class（即 Controller 类）
  const cls = context.getClass();
  // 比如：BookController

  // 3. 切换到 HTTP 上下文
  const http = context.switchToHttp();
  const request = http.getRequest<Request>();     // Express Request
  const response = http.getResponse<Response>();  // Express Response
  const next = http.getNext();                    // Express NextFunction

  // 4. 也支持 WebSocket 和 RPC 上下文
  // const ws = context.switchToWs();
  // const rpc = context.switchToRpc();

  return true;
}
```

有了 `getHandler()` 和 `getClass()`，Guard 就能结合 `Reflector` 读取装饰器元数据，实现声明式权限控制。

## 权限控制的最佳实践：Reflector + Guard

### Step 1：定义权限装饰器

```typescript
import { SetMetadata } from '@nestjs/common';

// 自定义装饰器：@RequirePermission(...permissions)
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
```

### Step 2：在 Controller 上声明所需权限

```typescript
@Controller('book')
export class BookController {
  @Post('create')
  @RequirePermission('book:create')  // ← 声明：这个接口只有拥有 book:create 权限的人能访问
  async create(@Body() dto: CreateBookDto) {
    return this.bookService.create(dto);
  }

  @Post('delete')
  @RequirePermission('book:delete')  // ← 声明：需要 book:delete 权限
  async delete(@Body() dto: DeleteBookDto) {
    return this.bookService.delete(dto);
  }

  @Get('list')
  // 没有 @RequirePermission → 不需要权限 → 公开接口
  async list() {
    return this.bookService.findAll();
  }
}
```

### Step 3：实现 Guard 读取元数据

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. 从 Reflector 中读取 @RequirePermission 设置的元数据
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),  // 优先方法级别
    );

    // 如果没有 @RequirePermission 装饰器 → 公开接口 → 放行
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 2. 获取当前用户及其权限
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;  // 假设 AuthGuard 已挂载 user

    if (!user) {
      return false;
    }

    // 3. 检查用户是否有所需权限
    const userPermissions: string[] = user.permissions || [];
    const hasPermission = requiredPermissions.some(p =>
      userPermissions.includes(p),
    );

    return hasPermission;
  }
}
```

> ⚠️ `Reflector.get()` 读取的元数据必须在 Guard 注册**之前**通过装饰器设置。因为有 DI 容器参与，Reflector 需要 `@Injectable()` 才能注入。

## Guard 的注册方式

### 方式 1：全局注册（main.ts）

```typescript
const app = await NestFactory.create(AppModule);
app.useGlobalGuards(new AuthGuard());
```

全局 Guard 对**所有路由**生效。但全局 Guard 不能注入依赖（因为它不在 Module 的 Provider 中）。

### 方式 2：全局注册（DI 方式）

```typescript
// 在 AppModule 中
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,  // 通过 DI 实例化，可以注入依赖
    },
  ],
})
```

### 方式 3：Controller 级别

```typescript
@Controller('book')
@UseGuards(AuthGuard)  // 该 Controller 下所有路由都需要登录
export class BookController {}
```

### 方式 4：Handler 级别

```typescript
@Get('profile')
@UseGuards(AuthGuard)  // 只对这个 Handler 生效
getProfile() {
  return { message: 'This is protected' };
}
```

### 注册优先级

Handler 级别 > Controller 级别 > Module 级别（APP_GUARD）> 全局级别（useGlobalGuards）

更具体的级别**覆盖**全局级别。

## 实战：图书管理系统的 AuthGuard

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// 标记公开接口的装饰器
export const IS_PUBLIC_KEY = 'isPublic';
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. 如果是公开接口，直接放行
    const isPublic = this.reflector.get<boolean>(
      IS_PUBLIC_KEY,
      context.getHandler(),
    );
    if (isPublic) return true;

    // 2. 检查 token
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) return false;

    // 3. 验证 token，挂载 user 到 request
    try {
      const user = verifyToken(token);  // Day 20 详讲 JWT
      request.user = user;
      return true;
    } catch {
      return false;
    }
  }
}
```

```typescript
// 使用
@Controller('user')
export class UserController {
  @Post('register')
  @IsPublic()  // ← 注册接口不需要登录
  register(@Body() dto: RegisterUserDto) {}

  @Post('login')
  @IsPublic()  // ← 登录接口不需要登录
  login(@Body() dto: LoginUserDto) {}

  @Get('profile')
  // 没有 @IsPublic() → 需要登录
  getProfile() {}
}
```

## Guard vs Middleware 选择指南

| 场景 | 用哪个 | 原因 |
|------|-------|------|
| 解析 Cookie/Session | Middleware | 底层请求处理，不需要知道 handler |
| 设置 CORS 头 | Middleware | 与业务逻辑无关 |
| 检查用户是否登录 | Guard | 需要知道哪些路由是公开的（通过装饰器） |
| 检查用户是否有某权限 | Guard | 需要读取 `@RequirePermission` 装饰器的元数据 |
| 全局请求日志 | Middleware | 不需要区分 handler，所有请求都要打 |
| 接口级别的限流 | Guard | 不同接口限流策略不同（登录 3次/分钟，查书 无限制） |

> 核心原则：如果需要根据"调的是哪个接口"来做出不同处理 → Guard。如果对所有请求一个套路 → Middleware。

---

## 参考链接

- [NestJS — Guards](https://docs.nestjs.com/guards)
- [NestJS — Execution Context](https://docs.nestjs.com/fundamentals/execution-context)
- [NestJS — Reflection and Metadata](https://docs.nestjs.com/fundamentals/reflection-and-metadata)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md
