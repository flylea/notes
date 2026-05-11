# applyDecorators — 组合装饰器

## 问题：重复的装饰器组合

```typescript
// 每个需要管理员权限的接口都要写 4 行
@Post('create')
@UseGuards(AuthGuard, RolesGuard)
@SetMetadata('roles', ['admin'])
@ApiBearerAuth()  // Swagger 需要的
create() {}

@Post('delete')
@UseGuards(AuthGuard, RolesGuard)  // 重复！
@SetMetadata('roles', ['admin'])   // 重复！
@ApiBearerAuth()                   // 重复！
delete() {}
```

20 个接口需要管理员权限 = 60 行重复代码。

## applyDecorators 方案

```typescript
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

// 组合为一个装饰器
export function AdminOnly() {
  return applyDecorators(
    UseGuards(AuthGuard, RolesGuard),
    SetMetadata('roles', ['admin']),
    ApiBearerAuth(),
  );
}

// 使用
@Post('create')
@AdminOnly()  // 一行替代 4 行
create() {}

@Post('delete')
@AdminOnly()
delete() {}
```

## 支持参数

```typescript
// 带参数的组合装饰器
export function RequireAuth(...roles: string[]) {
  return applyDecorators(
    UseGuards(AuthGuard, RolesGuard),
    SetMetadata('roles', roles),
    ApiBearerAuth(),
  );
}

// 使用
@Post('create')
@RequireAuth('admin', 'librarian')  // 需要 admin 或 librarian 角色
create() {}
```

## 实战：图书管理系统装饰器套件

```typescript
// src/common/decorators/auth.decorator.ts
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionGuard } from '../guards/permission.guard';

// ========== 基础装饰器 ==========

export const IS_PUBLIC_KEY = 'isPublic';
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const RequireRole = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// ========== 组合装饰器 ==========

// 需要登录（但不限制角色）
export function RequireLogin() {
  return applyDecorators(UseGuards(AuthGuard));
}

// 需要特定角色
export function RequireRoles(...roles: string[]) {
  return applyDecorators(
    UseGuards(AuthGuard, RolesGuard),
    RequireRole(...roles),
  );
}

// 需要特定权限（RBAC）
export function RequirePermissions(...permissions: string[]) {
  return applyDecorators(
    UseGuards(AuthGuard, PermissionGuard),
    RequirePermission(...permissions),
  );
}

// 管理员专用
export function AdminOnly() {
  return applyDecorators(
    UseGuards(AuthGuard, RolesGuard, PermissionGuard),
    RequireRole('admin'),
    RequirePermission('*'),  // 管理员拥有全部权限
  );
}

// 公开 + 可选登录（有 user 就用，没有也放过）
export function PublicOrAuth() {
  return applyDecorators(
    IsPublic(),
    // Guard 中如果 isPublic = true 就直接放行
    // 但会尝试解析 token 挂载 user（如果不成功也不拦截）
  );
}
```

## Controller 中使用

```typescript
@Controller('book')
export class BookController {
  @Get('list')
  @IsPublic()  // 公开：游客也能看图书列表
  list() {}

  @Get('detail')
  @PublicOrAuth()  // 公开 + 可选登录：登录后能看到自己的借阅状态
  detail() {}

  @Post('create')
  @RequireRoles('admin', 'librarian')  // 需要特定角色
  create() {}

  @Post('delete')
  @AdminOnly()  // 管理员专用
  delete() {}

  @Post('borrow')
  @RequireLogin()  // 只要登录就能借书
  borrow() {}

  @Post('import')
  @RequirePermissions('book:import')  // RBAC 细粒度权限
  import() {}
}
```

## applyDecorators 的原理

```typescript
export function applyDecorators(...decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator>) {
  return <TFunction extends Function, Y>(
    target: TFunction | object,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<Y>,
  ) => {
    for (const decorator of decorators) {
      if (typeof decorator === 'function') {
        // 每个装饰器都是函数，依次执行
        (decorator as MethodDecorator)(target, propertyKey!, descriptor);
      }
    }
  };
}
```

本质就是将多个装饰器"打包"成一个，效果等同于逐行书写。

## applyDecorators 的限制

1. **只能组合同类型的装饰器**：类装饰器只能组合类装饰器，方法装饰器只能组合方法装饰器
2. **顺序敏感**：`applyDecorators(A, B)` 等价于 `@A @B`——越靠后的越先执行
3. **无法条件组合**：所有装饰器都会在你写 `@Xxx()` 时就确定，不能运行时动态决定

> `applyDecorators` 让你的装饰器体系形成"层级化"——从原子装饰器（`@SetMetadata`）→ 基础装饰器（`@IsPublic`）→ 组合装饰器（`@AdminOnly`），每层都对上层隐藏复杂度。

---

## 参考链接

- [NestJS — Custom Decorators](https://docs.nestjs.com/custom-decorators)
- [NestJS — Composing Decorators](https://docs.nestjs.com/custom-decorators#decorator-composition)
- 开源笔记：《Nest 通关秘籍》.doc/12.装饰器.md
