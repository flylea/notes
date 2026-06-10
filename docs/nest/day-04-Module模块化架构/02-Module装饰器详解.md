# @Module() 装饰器四属性详解

## 基本语法

```typescript
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule {}
```

## controllers — 注册路由处理者

```typescript
@Module({
  controllers: [UserController, AuthController],
})
```

被注册的 Controller 才能被 Nest 识别为路由处理器。Nest 会：
1. 读取 Controller 上的 `@Controller('prefix')` 路由前缀
2. 读取方法上的 `@Get()/@Post()` 等装饰器
3. 注册为完整的路由

> Controller 类必须同时出现在 Module 的 `controllers` 中。只写了 `@Controller()` 但没有在 Module 注册 → 路由无效。

## providers — 注册可注入的服务

```typescript
@Module({
  providers: [
    UserService,
    AuthService,
    { provide: 'CONFIG', useValue: { port: 3000 } },
  ],
})
```

注册到 `providers` 的对象可以被该模块内的所有 Controller 和其他 Provider 注入。它们被 Nest IoC 容器管理。

> 注册顺序不重要——Nest 会自动解析依赖图，确定正确的实例化顺序。

## exports — 导出给其他模块

```typescript
@Module({
  providers: [UserService],
  exports: [UserService],  // 导出后其他模块可以注入
})
```

**一个常见错误**：Provider 注册了但没有 export，导致其他模块注入时报错：

```typescript
// user.module.ts
@Module({
  providers: [UserService],
  // 忘记 exports → BookModule 无法注入 UserService！
})
```

修复：

```typescript
@Module({
  providers: [UserService],
  exports: [UserService],  // 加上这行
})
```

## imports — 引入其他模块

```typescript
@Module({
  imports: [UserModule, ConfigModule.forRoot()],
})
```

`imports` 不是 ES6 的 `import` 语句。它告诉 Nest："我需要使用其他模块导出（exports）的 Provider"。

```typescript
// 在 BookModule 中：
@Module({
  imports: [UserModule],  // 引入 UserModule
  providers: [BookService],
})
export class BookModule {}

// BookService 现在可以注入 UserModule 导出的 Provider：
@Injectable()
export class BookService {
  constructor(private userService: UserService) {}  // ✅ UserModule 已导入
}
```

## 模块的 DAG（有向无环图）

Nest 模块的依赖关系构成一个 DAG：

```
               AppModule
              /    |    \
        UserModule | BookModule
            |      |
      PrismaModule |
                   |
              AuthModule
```

**关键规则**：
- 不能有循环依赖（除非用 `forwardRef()`）
- 子模块不需要重新导入已导入的模块（传递性只存在于 Provider，不存在于 Module 之间）
- 每个 Module 独立管理自己的 Provider

## @Module() 完整示例

```typescript
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,  // 需要 PrismaService
  ],
  controllers: [
    UserController,  // 处理 /users/* 路由
  ],
  providers: [
    UserService,     // 业务逻辑
  ],
  exports: [
    UserService,     // 其他模块（如 AuthModule）需要
  ],
})
export class UserModule {}
```

---

## 参考链接

- [NestJS — Modules](https://docs.nestjs.com/modules)
- [NestJS — Shared Modules](https://docs.nestjs.com/modules#shared-modules)
- 开源笔记：《Nest 通关秘籍》.doc/8. 使用多种 Provider.md
