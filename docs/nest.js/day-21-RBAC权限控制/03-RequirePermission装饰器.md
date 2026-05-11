# @SetMetadata 声明接口所需权限

## 方式 1：基础 @SetMetadata

```typescript
import { SetMetadata } from '@nestjs/common';

// 直接在 Controller 中使用
@Controller('book')
export class BookController {
  @Post('create')
  @SetMetadata('permissions', ['book:create'])
  async create(@Body() body: Prisma.BookCreateInput) {
    return this.bookService.create(body);
  }

  @Post('delete')
  @SetMetadata('permissions', ['book:delete'])
  async delete(@Body('id') id: string) {
    return this.bookService.remove(parseInt(id, 10));
  }
}
```

## 方式 2：自定义装饰器（推荐）

```typescript
// src/auth/permission.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// 支持单个权限
// @RequirePermission('book:create')
// 或多个权限（OR 关系，满足任一即可）
// @RequirePermission('book:create', 'book:update')
```

### 在 Controller 中使用

```typescript
@Controller('book')
export class BookController {
  @Post('create')
  @RequirePermission('book:create')
  async create(@Body() body: Prisma.BookCreateInput) {
    return this.bookService.create(body);
  }

  @Post('update')
  @RequirePermission('book:update')
  async update(@Body() body: Prisma.BookUpdateInput) {
    return this.bookService.update(body);
  }

  @Post('delete')
  @RequirePermission('book:delete')  // 只允许有删除权限的用户
  async delete(@Body('id') id: string) {
    return this.bookService.remove(parseInt(id, 10));
  }
}
```

## 权限判断逻辑

```
接口声明：@RequirePermission('book:create', 'book:update')

用户权限：['book:read', 'book:borrow', 'book:return']

判断逻辑：
  用户权限列表中是否包含 'book:create' 或 'book:update'？
  → 不包含任何一个 → 返回 403 Forbidden

接口声明：@RequirePermission('book:read')

用户权限：['book:read', 'book:borrow', 'book:return']

判断逻辑：
  用户权限列表中是否包含 'book:read'？
  → 包含 → 放行 ✅
```

## 声明式权限 vs 硬编码判断

```typescript
// ❌ 硬编码判断（权限逻辑散落在业务代码中）
@Post('delete')
async delete(@Body('id') id: string, @Req() req: Request) {
  const user = await this.userService.findById(req.user.sub);
  if (!user.roles.some(r => r.permissions.includes('book:delete'))) {
    throw new ForbiddenException('没有权限');
  }
  // 业务逻辑...
}

// ✅ 声明式权限（业务代码干净，权限统一在 Guard 处理）
@Post('delete')
@RequirePermission('book:delete')
async delete(@Body('id') id: string) {
  return this.bookService.remove(parseInt(id, 10));
}
```

> 声明式权限的核心优势：权限逻辑和业务逻辑完全分离，修改权限策略不需要改业务代码。

---

## 参考链接

- [NestJS — SetMetadata](https://docs.nestjs.com/fundamentals/execution-context#reflection-and-metadata)
- [NestJS — Custom Decorators](https://docs.nestjs.com/custom-decorators)
