# 全局模块 @Global()：使用场景与注意事项

## 什么是全局模块

```typescript
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

加了 `@Global()` 之后，**任何模块都不需要在 `imports` 中显式引入这个模块**，就可以注入其 exports。

## 为什么要全局模块

假设没有 `@Global()`：

```typescript
// 每个用到 PrismaService 的模块都要 imports
@Module({ imports: [PrismaModule] })
export class UserModule {}

@Module({ imports: [PrismaModule] })
export class BookModule {}

@Module({ imports: [PrismaModule] })
export class AuthModule {}

@Module({ imports: [PrismaModule] })
export class BorrowModule {}

// ... 10 个模块就要写 10 次
```

用了 `@Global()`：

```typescript
// AppModule 引入一次
@Module({ imports: [PrismaModule] })
export class AppModule {}

// 其他所有模块不需要任何 imports
@Module({})  // 干净！
export class UserModule {}
```

## 什么适合做全局模块

| 适合 | 不适合 |
|------|--------|
| 数据库连接（PrismaService） | 业务模块（UserModule） |
| 配置服务（ConfigService） | 功能模块（BookModule） |
| 日志服务（Winston） | 任何"不是所有模块都需要"的模块 |
| 缓存服务（Redis） | |
| 全局异常过滤器 | |

## 什么不适合做全局模块

```typescript
// ❌ 错误：不要把业务模块设成全局
@Global()
@Module({ /* ... */ })
export class UserModule {}
```

原因：
- `@Global()` 会隐藏模块的真实依赖关系。看一个 Module 的 `imports` 看不出它到底需要什么
- 测试变得困难——你不知道需要 mock 哪些全局依赖
- 代码可读性降低——新人在 BookModule 中看到 `userService` 的注入，却不知道它从哪来的

## 全局模块的原理

`@Global()` 在 Nest IoC 容器层面做了一件事：将模块的 exports 注册到**全局 scope** 中。当容器解析一个依赖时，查找顺序是：

1. 当前模块的 providers
2. 当前模块 imports 的模块的 exports
3. **全局模块的 exports** ← 全局模块在这里
4. 没找到 → 报错

## 最佳实践

1. **仅基础设施层用 `@Global()`**：数据库、配置、日志、缓存
2. **业务模块永远不用 `@Global()`**
3. **一个项目最多 3-5 个全局模块**

```typescript
// ✅ 好：PrismaModule 全局
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

// ✅ 好：ConfigModule 全局
ConfigModule.forRoot({ isGlobal: true })

// ✅ 好：UserModule 不全局
@Module({
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

---

## 参考链接

- [NestJS — Global Modules](https://docs.nestjs.com/modules#global-modules)
- [NestJS — Module Reference](https://docs.nestjs.com/fundamentals/module-ref)
- 开源笔记：《Nest 通关秘籍》.doc/9. 全局模块和生命周期.md
