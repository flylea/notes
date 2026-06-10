# Nest DI 实现：@Injectable 和 IoC 容器的工作原理

## @Injectable() — 声明"我可以被注入"

```typescript
@Injectable()
export class UserService {
  findAll() { /* ... */ }
}
```

`@Injectable()` 做的事情非常简单：**给类打上一个标记，告诉 Nest "这个类可以被 IoC 容器管理"**。

如果没有这个装饰器，Nest 不会把这个类当作 Provider——即使你在 Module 的 `providers` 中声明了它，也会报错。

> TypeScript 的装饰器在运行时会被转换成元数据。`@Injectable()` 本质上是调用 `Reflect.defineMetadata('design:paramtypes', [...], UserService)`，记录构造器参数的类型。Nest 的 IoC 容器在运行时读取这些元数据，确定应该注入什么。

## 构造器注入 vs 属性注入

### 构造器注入（推荐）

```typescript
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}
  // userService 和 authService 都通过构造器注入
}
```

**优点**：
- 依赖明确：看构造器签名就知道这个类需要什么
- 类型安全：IDE 有完整类型提示
- 便于测试：`new UserController(mockUserService, mockAuthService)` 轻松 mock
- 不可变：`readonly` 保证不会在方法中被意外替换

### 属性注入（不推荐，但有场景）

```typescript
import { Inject } from '@nestjs/common';

@Controller('users')
export class UserController {
  @Inject(UserService)
  private readonly userService: UserService;

  @Inject('OPTIONS')
  private readonly options: Record<string, any>;
}
```

**什么时候必须用属性注入？**
- 需要在子类中声明 Provider（构造器中无法使用 `super` 注入）
- 使用字符串 Token 时（`@Inject('OPTIONS')`）更容易书写

> 在绝大多数情况下，使用构造器注入。属性注入只是补充手段。

## Token 机制 — 容器如何识别依赖

Nest IoC 容器通过 **Token** 来识别和匹配依赖：

```typescript
// Token 类型 1：类本身（最常用）
@Module({
  providers: [UserService],  // Token = UserService class
})

// 消费者通过 Token 匹配
constructor(private userService: UserService) {}  // Nest：找 Token 为 UserService 的实例

// Token 类型 2：字符串（用于常量、配置值）
@Module({
  providers: [
    { provide: 'DATABASE_URL', useValue: 'mysql://...' }
  ],
})

// Token 类型 3：Symbol（避免命名冲突）
export const DB_TOKEN = Symbol('DB_TOKEN');

@Module({
  providers: [
    { provide: DB_TOKEN, useClass: MysqlDatabase }
  ],
})
```

## Nest DI 容器的递归解析流程

以这个 Controller 为例：

```typescript
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: LoggerService,
  ) {}
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
}

@Injectable()
export class PrismaService {
  // 无依赖
}

@Injectable()
export class ConfigService {
  // 无依赖
}
```

Nest 容器处理首次请求 `GET /users` 时的解析流程：

```
1. 查找路由 → 需要 UserController
   检查容器：UserController 有实例吗？没有。

2. 读取 UserController 构造器元数据：
   → 需要 UserService 和 LoggerService

3. 递归解析 UserService：
   → 容器中无 → 创建 UserService
   → 需要 PrismaService 和 ConfigService
   → PrismaService 无依赖 → 创建
   → ConfigService 无依赖 → 创建
   → UserService 创建完成（PrismaService + ConfigService 注入）

4. 递归解析 LoggerService：
   → 容器中无 → Nest 内置 LoggerService 作为回退 → 注入

5. UserController 创建完成 → 调用 findAll() → 返回响应

6. 下一次请求 GET /users 时：
   → UserController 已有实例（单例）→ 直接复用，跳过 2-5
```

**关键点**：
- 所有依赖都是单例（默认），所以只会创建一次
- 解析是**深度优先**的：先解析最深处的依赖，再逐层返回
- 如果一个依赖是另一个 Provider 的依赖，容器会自动解决——不需要在 Module 中手动排序

## Module 的 providers 注册

```typescript
@Module({
  controllers: [UserController],   // Controller 也会自动成为 Provider
  providers: [UserService, PrismaService],
})
export class UserModule {}
```

`providers: [UserService]` 是一种**简写**，完整形式是：

```typescript
providers: [
  { provide: UserService, useClass: UserService }
]
```

这意味着：
- **Token** = `UserService`（类本身）
- **实现** = `UserService`（同一个类）

大多数时候简写就够了。当需要自定义时（如用工厂创建、注入值、注入不同实现），再用完整形式。

---

## 参考链接

- [NestJS — Providers](https://docs.nestjs.com/providers)
- [NestJS — Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS — Injection Scopes](https://docs.nestjs.com/fundamentals/injection-scopes)
- [TypeScript — Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)
- 开源笔记：《Nest 通关秘籍》.doc/6. IoC 解决了什么痛点问题？.md
