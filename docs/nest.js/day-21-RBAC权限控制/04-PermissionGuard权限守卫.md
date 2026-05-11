# PermissionGuard 完整实现

## 核心思路

```
AuthGuard 执行完毕 → request.user = { sub, username, role }
                            │
                            ▼
PermissionGuard 执行：
  1. 读取接口的 @RequirePermission(...) metadata
  2. 查询当前用户的角色和权限
  3. 判断用户权限是否满足接口要求
  4. 满足 → 放行 / 不满足 → 403 Forbidden
```

## 完整实现

```typescript
// src/auth/permission.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. 获取接口声明的权限
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 没有声明权限 → 不需要权限 → 放行
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 2. 获取当前用户
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未认证');
    }

    // 3. 查询用户的权限列表
    const userPermissions = await this.getUserPermissions(user.sub);

    // 4. 判断是否满足（用户权限中是否包含任一所需权限）
    const hasPermission = requiredPermissions.some(permission =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `需要权限: ${requiredPermissions.join(' 或 ')}`,
      );
    }

    return true;
  }

  private async getUserPermissions(userId: number): Promise<string[]> {
    // 查询用户 → 角色 → 权限
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles) {
      return [];
    }

    // 提取所有权限码（去重）
    const permissions = new Set<string>();

    for (const userRole of userWithRoles.roles) {
      for (const rp of userRole.role.permissions) {
        permissions.add(rp.permission.code);
      }
    }

    return Array.from(permissions);
  }
}
```

## 注册顺序很重要

```typescript
// app.module.ts
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,        // 先执行 AuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,  // 再执行 PermissionGuard
    },
  ],
})
export class AppModule {}
```

> 多个 `APP_GUARD` 的执行顺序：先注册的先执行。AuthGuard 必须先于 PermissionGuard，因为 PermissionGuard 依赖 `request.user`。

## 执行流程

```
POST /book/delete
Authorization: Bearer eyJxxx...
    │
    ▼
┌─────────────────────────────┐
│  AuthGuard.canActivate()    │
│  - 提取 Token               │
│  - 验证签名                 │
│  - request.user = payload   │
│  - return true ✅           │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  PermissionGuard            │
│    .canActivate()           │
│  - 读取 @RequirePermission  │
│    → ['book:delete']       │
│  - 查询用户权限             │
│    → ['book:read',          │
│        'book:borrow',       │
│        'book:return']       │
│  - 匹配判断                 │
│    'book:delete' 不在列表中  │
│  - throw 403 ❌             │
└─────────────────────────────┘
```

## 优化：避免每次请求都查数据库

```typescript
// 优化版 PermissionGuard——带缓存

@Injectable()
export class PermissionGuard implements CanActivate {
  // 内存缓存（5 分钟 TTL）
  private cache = new Map<number, { permissions: string[]; expireAt: number }>();

  private async getUserPermissions(userId: number): Promise<string[]> {
    // 检查缓存
    const cached = this.cache.get(userId);
    if (cached && cached.expireAt > Date.now()) {
      return cached.permissions;
    }

    // 查询数据库
    const permissions = await this.loadPermissionsFromDB(userId);

    // 写入缓存（5 分钟过期）
    this.cache.set(userId, {
      permissions,
      expireAt: Date.now() + 5 * 60 * 1000,
    });

    return permissions;
  }

  // 清除缓存的方法（角色/权限变更时调用）
  clearUserCache(userId: number) {
    this.cache.delete(userId);
  }
}
```

> 内存缓存适用于单实例部署。多实例部署时需要用 Redis 共享缓存（Day 27 的 Redis 专题）。

## 区分认证失败 vs 授权失败

```typescript
// AuthGuard → 认证失败
throw new UnauthorizedException('Token 无效');
// HTTP 401 Unauthorized

// PermissionGuard → 授权失败
throw new ForbiddenException('没有权限');
// HTTP 403 Forbidden

// 前端根据状态码做不同处理：
// 401 → Token 过期/无效 → 尝试刷新或跳登录
// 403 → 用户权限不足 → 提示"没有操作权限"
```

---

## 参考链接

- [NestJS — Guards](https://docs.nestjs.com/guards)
- [NestJS — Execution Context](https://docs.nestjs.com/fundamentals/execution-context)
- [HTTP 403 vs 401](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403)
