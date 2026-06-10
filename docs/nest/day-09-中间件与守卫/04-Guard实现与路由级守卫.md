# Guard 实现 CanActivate 接口

## Guard 的接口定义

```typescript
interface CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean>;
}
```

**唯一的任务**：返回 true（放行）或 false（拦截）。

## 实现模式 1：同步 Guard

最常用——直接返回 bool：

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return !!request.headers.authorization;
  }
}
```

## 实现模式 2：异步 Guard

需要查数据库、验证 JWT 等异步操作：

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) return false;

    try {
      const payload = await verifyToken(token);  // 异步验证
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      request.user = user;  // 挂载用户信息到 request
      return true;
    } catch {
      return false;
    }
  }
}
```

## 实现模式 3：Guard + Reflector

这是企业项目中最常见、最优美的模式——Guard 读取装饰器元数据来做判断。

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. 读取 @Roles() 装饰器设置的元数据
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),  // 方法级别优先
      context.getClass(),    // 类级别兜底
    ]);

    // 2. 没有 @Roles() → 公开接口 → 放行
    if (!requiredRoles) {
      return true;
    }

    // 3. 获取当前用户
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // 4. 检查用户角色是否匹配
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}
```

## 实现模式 4：混合 Guard（组合多个 Guard）

```typescript
@Injectable()
export class CompositeAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Step 1: 检查是否公开接口
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) return true;

    // Step 2: 检查 token
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;

    // Step 3: 验证 token + 权限
    try {
      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch {
      return false;
    }
  }
}
```

## 注册 Guard 的四种方式

```typescript
// 1. 全局（不可注入依赖）
app.useGlobalGuards(new AuthGuard());

// 2. 全局（可注入依赖）— 推荐
// 在 AppModule 中：
providers: [{ provide: APP_GUARD, useClass: AuthGuard }]

// 3. Controller 级别
@Controller('book')
@UseGuards(AuthGuard)
export class BookController {}

// 4. Handler 级别
@Get('profile')
@UseGuards(AuthGuard)
getProfile() {}
```

## 多个 Guard 的执行顺序

```typescript
@UseGuards(AuthGuard, RolesGuard, LogGuard)
@Get('admin')
adminOnly() {}
```

执行顺序：从左到右。任意一个返回 false → 停止后续 Guard，返回 403。

> ⚠️ `APP_GUARD` 和 `@UseGuards()` 同时存在时，执行顺序与注册的"距离"有关：全局 Guard 先执行，然后是 Controller 级别，最后是 Handler 级别。

## 实战：图书管理系统的登录 Guard

```typescript
// src/common/guards/auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.get<boolean>(
      IS_PUBLIC_KEY,
      context.getHandler(),
    );

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('请先登录');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token 已过期');
    }
  }
}
```

---

## 参考链接

- [NestJS — Guards](https://docs.nestjs.com/guards)
- [NestJS — Execution Context](https://docs.nestjs.com/fundamentals/execution-context)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md
