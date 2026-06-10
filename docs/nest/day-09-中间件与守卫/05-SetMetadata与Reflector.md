# @SetMetadata + Reflector 声明式权限控制

## 核心思想

Nest 的权限系统依赖两个关键要素：

1. `@SetMetadata()` — 在 Controller/Handler 上"声明"这个接口需要什么权限
2. `Reflector` — 在 Guard 中"读取"这些声明，并做判断

这是 Nest 最优雅的设计之一——权限规则写在代码旁边，清晰可见。

## @SetMetadata 的基本用法

```typescript
import { SetMetadata } from '@nestjs/common';

@Controller('book')
export class BookController {
  @Post('create')
  @SetMetadata('roles', ['admin'])  // 声明：create 需要 admin 角色
  create() {}

  @Post('delete')
  @SetMetadata('roles', ['admin'])
  delete() {}

  @Get('list')
  // 没有 @SetMetadata → 不需要权限 → 公开接口
  list() {}
}
```

## 封装自定义装饰器

`@SetMetadata` 不太语义化——`@RequireRole('admin')` 更直观：

```typescript
import { SetMetadata } from '@nestjs/common';

// 角色装饰器
export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
```

使用：

```typescript
@Post('delete')
@RequireRole('admin')  // 比 @SetMetadata('roles', ['admin']) 更清晰
delete() {}
```

## Reflector 读取元数据

```typescript
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    // 没有 @RequireRole → 公开接口
    if (!requiredRoles) return true;

    // 检查用户角色
    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.some(role => user?.roles?.includes(role));
  }
}
```

## 三层元数据读取

| 优先级 | 位置 | 读取方式 |
|--------|------|---------|
| 1（最高） | Handler 方法 | `this.reflector.get(key, context.getHandler())` |
| 2 | Controller 类 | `this.reflector.get(key, context.getClass())` |
| 3（兜底） | 无（undefined） | 视为公开接口 |

```typescript
@Controller('book')
@RequireRole('user')  // 类级别：book 模块默认需要 user 角色
export class BookController {
  @Get('list')
  list() {}  // 没有显式声明 → 继承类级别的 'user'

  @Post('create')
  @RequireRole('admin')  // 方法级别 → 覆盖类级别的 'user'
  create() {}
}
```

```typescript
// Guard 中读取（含优先级逻辑）
const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
  context.getHandler(),   // 先读方法级别
  context.getClass(),     // 没有则读类级别
]);
// list → ['user']（来自类级别）
// create → ['admin']（方法级别覆盖了类级别）
```

## 典型声明式权限体系

```typescript
// src/common/decorators/auth.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

```typescript
// Controller 使用
@Controller('book')
export class BookController {
  @Get('list')
  @IsPublic()  // 公开接口
  list() {}

  @Post('create')
  @RequireRole('admin', 'librarian')  // 需要 admin 或 librarian 角色
  create() {}

  @Post('delete')
  @RequirePermission('book:delete')  // 需要 book:delete 权限（RBAC 细粒度）
  delete() {}
}
```

## 前端类比

| Nest | Vue Router |
|------|-----------|
| `@RequireRole('admin')` | `meta: { requiresAuth: true, roles: ['admin'] }` |
| `Guards` | `router.beforeEach((to) => { ... })` |
| `Reflector.get()` | `to.matched.some(record => record.meta.requiresAuth)` |
| `@IsPublic()` | `meta: { requiresAuth: false }`（或者不写 meta） |

完全一样的模式：
1. 在路由定义处声明权限要求（装饰器 / meta 字段）
2. 在拦截处读取并判断（Guard / beforeEach）

## 图书管理系统权限体系实战

```typescript
// src/common/decorators/auth.decorator.ts
import { SetMetadata, applyDecorators } from '@nestjs/common';

// 公开接口
export const IS_PUBLIC_KEY = 'isPublic';
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);

// 需要登录（但不限制角色）
export const RequireLogin = () => SetMetadata('requireLogin', true);

// 需要特定角色
export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// 需要特定权限（RBAC）
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...perms: string[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

// 组合装饰器：需要 admin 角色且需要 book:create 权限
export const AdminOnly = () =>
  applyDecorators(RequireRole('admin'), RequirePermission('book:manage'));
```

```typescript
// Controller 使用
@Controller('book')
export class BookController {
  @Get('list')
  @IsPublic()
  list() {}

  @Post('create')
  @RequireRole('admin', 'librarian')
  create() {}

  @Post('delete')
  @AdminOnly()  // 等价于 @RequireRole('admin') + @RequirePermission('book:manage')
  delete() {}

  @Post('borrow')
  @RequireLogin()  // 只要登录就能借书
  borrow() {}
}
```

> `@SetMetadata` + `Reflector` 是 Nest 权限系统的基石。Day 21 会在这个基础上构建完整的 RBAC 权限模型。

---

## 参考链接

- [NestJS — Reflection and Metadata](https://docs.nestjs.com/fundamentals/reflection-and-metadata)
- [NestJS — Guards](https://docs.nestjs.com/guards)
- [NestJS — Custom Decorators](https://docs.nestjs.com/custom-decorators)
- 开源笔记：《Nest 通关秘籍》.doc/13.如何使用Reflector读取SetMetadata.md
