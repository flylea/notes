# Reflector 四个方法详解

## Reflector 是什么

`Reflector` 是 Nest 对 `Reflect.getMetadata()` 的高级封装，提供了智能的合并和覆写策略。它主要用于 Guard 和 Interceptor 中读取装饰器元数据。

```typescript
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
}
```

## 四个方法的区别

### get — 精确读取

```typescript
// 只读取 handler 级别的元数据
const roles = this.reflector.get<string[]>('roles', context.getHandler());
// 如果 handler 上没有 @SetMetadata('roles', ...)，返回 undefined
// 不会去 class 级别查找
```

### getAllAndMerge — 合并读取

```typescript
// 同时读取 handler 和 class 级别，合并为数组
const roles = this.reflector.getAllAndMerge<string[]>('roles', [
  context.getHandler(),
  context.getClass(),
]);

// handler 有 ['admin']，class 有 ['user']
// → 合并结果：['admin', 'user']

// handler 有 ['admin']，class 没有
// → 合并结果：['admin']

// handler 没有，class 有 ['user']
// → 合并结果：['user']
```

### getAllAndOverride — 覆写读取

```typescript
// handler 级别覆写 class 级别
const roles = this.reflector.getAllAndOverride<string[]>('roles', [
  context.getHandler(),
  context.getClass(),
]);

// handler 有 ['admin']，class 有 ['user']
// → 覆写结果：['admin']（class 被忽略）

// handler 没有，class 有 ['user']
// → 覆写结果：['user']

// 都没有 → undefined
```

### getAll — 批量读取

```typescript
// 从多个对象上读取，各自独立
const results = this.reflector.getAll<string[]>('roles', [
  method1,
  method2,
  method3,
]);
// 返回：['admin', undefined, undefined]（每个对象独立读取）
```

## 四个方法对比

| 方法 | 行为 | 典型用途 |
|------|------|---------|
| `get(key, target)` | 精确读取单个 target | 读取 handler 级别的单一配置 |
| `getAllAndMerge(key, targets)` | 合并所有 target 的值 | 角色权限——handler 权限 + class 权限一起验证 |
| `getAllAndOverride(key, targets)` | 第一个有值的覆盖后面的 | 缓存开关——handler 级别 > class 级别 |
| `getAll(key, targets)` | 分别读取 | 注册多个 Guard，各自独立读取元数据 |

## 实战应用场景

### 场景 1：角色权限（getAllAndMerge）

```typescript
@Controller('book')
@RequireRole('user')  // 类级别：需要 user 角色
export class BookController {
  @Post('create')
  @RequireRole('admin')  // 方法级别：需要 admin 角色
  create() {}
}

// Guard 中：
const roles = this.reflector.getAllAndMerge<string[]>('roles', [
  context.getHandler(),
  context.getClass(),
]);
// create 方法 → ['admin', 'user'] → 满足 admin 或 user 都可以
```

### 场景 2：公开接口（getAllAndOverride）

```typescript
@Controller('book')
@UseGuards(AuthGuard)  // 类级别：需要登录
export class BookController {
  @Get('list')
  @IsPublic()  // 方法级别：不需要登录（Override 类级别）
  list() {}

  @Post('create')
  create() {}  // 没有 @IsPublic() → 需要登录
}

// Guard 中：
const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
  context.getHandler(),
  context.getClass(),
]);
// list → true（handler 覆盖 class）
// create → undefined → 需要鉴权
```

### 场景 3：缓存 TTL（get）

```typescript
@Get('list')
@CacheTTL(60)  // 缓存 60 秒
list() {}

// Interceptor 中：
const ttl = this.reflector.get<number>('cacheTTL', context.getHandler());
// 只有 handler 级别有意义——缓存策略不需要继承 class 级别
```

## 选型决策

```
需要 handler 完全覆盖 class 吗？
├── 是 → getAllAndOverride（如 @IsPublic 覆盖 @UseGuards）
├── 否 → 需要合并吗？
│   ├── 是 → getAllAndMerge（如角色权限合并）
│   └── 否 → get（单一级别精确读取）
```

> `getAllAndOverride` 是最常用的——90% 的"声明式权限控制"场景都是 handler 级别覆盖 class 级别。

---

## 参考链接

- [NestJS — Reflection and Metadata](https://docs.nestjs.com/fundamentals/reflection-and-metadata)
- [NestJS — Reflector API](https://docs.nestjs.com/guards#role-based-authentication)
- 开源笔记：《Nest 通关秘籍》.doc/13.如何使用Reflector读取SetMetadata.md
