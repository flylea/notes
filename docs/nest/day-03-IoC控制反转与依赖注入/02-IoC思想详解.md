# IoC 思想详解：从主动创建到被动等待

## "控制反转"到底反转了什么？

先看一段没有 IoC 的代码：

```typescript
class UserService {
  private db: Database;

  constructor() {
    // 主动控制：UserService 自己决定用什么 Database、如何创建
    this.db = new MysqlDatabase({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '123456',
    });
  }

  async findById(id: number) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }
}
```

**UserService 控制了 3 件事**：
1. 用什么实现（`MysqlDatabase`，不是 `PostgresDatabase` 也不是 `MockDatabase`）
2. 怎么创建（`new` 操作符，配置参数硬编码）
3. 什么生命周期（什么时候创建、什么时候销毁）

"反转"之后：

```typescript
class UserService {
  // 不再控制：只是声明"我需要一个 Database"
  constructor(private db: Database) {}

  async findById(id: number) {
    return this.db.query('SELECT * FROM users WHERE id = ?', [id]);
  }
}
```

**控制权交给了容器**：
1. 用什么实现 → 容器根据注册决定（可能是 Mysql，也可能是 Mock）
2. 怎么创建 → 容器负责（读取配置、管理连接池）
3. 什么生命周期 → 容器管理（单例/瞬态/请求作用域）

这就是**控制反转**：**对象的创建和依赖管理，从由对象自己控制，变为由外部容器控制。**

## IoC 的三种实现方式

### 方式一：依赖注入（DI — Dependency Injection）

```typescript
// 外部"注入"依赖（Nest 采用的方式）
class UserService {
  constructor(private db: Database) {}  // 依赖由构造器传入
}
```

### 方式二：服务定位器（Service Locator）

```typescript
// 主动向"定位器"索取依赖
class UserService {
  private db = ServiceLocator.get<Database>('Database');
}
```

### 方式三：工厂模式（Factory Pattern）

```typescript
// 通过工厂间接创建
class UserService {
  private db = DatabaseFactory.create('mysql');
}
```

**Nest 为什么选择 DI？**

| 方式 | 优点 | 缺点 |
|------|------|------|
| DI | 依赖明确（看构造器就知道）、易测试（传 Mock 即可） | 需要容器支持 |
| Service Locator | 实现简单 | 依赖隐藏（不知道哪个方法会取什么）、难测试 |
| Factory | 封装了创建逻辑 | 引入了额外的工厂类、依赖仍然隐藏 |

DI 的核心优势：**看构造器签名就能知道这个类的所有依赖，不需要读方法体。**

## DI 的三个角色

```
┌──────────────┐     注册      ┌──────────────┐     注入      ┌──────────────┐
│   Provider   │ ───────────→ │  IoC Container │ ───────────→ │   Consumer   │
│  (提供依赖)   │              │   (容器)       │              │  (消费依赖)   │
└──────────────┘              └──────────────┘              └──────────────┘
     Database                     Nest IoC                    UserService
```

### 角色 1：Provider（提供者）

注册到容器的可注入对象：

```typescript
@Injectable()
export class UserService {}     // UserService 是一个 Provider

@Module({
  providers: [UserService],     // 注册到容器
})
```

### 角色 2：IoC Container（容器）

Nest 在应用启动时创建。它：
- 维护一个"注册表"（哪个 Token 对应哪个类/值/工厂）
- 递归解析依赖（UserService → Database → ConfigService → ...）
- 管理生命周期（创建、缓存、销毁）
- 检测循环依赖并报错

### 角色 3：Consumer（消费者）

声明依赖的类：

```typescript
@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}  // 声明：我需要 UserService
}
```

## Nest IoC 容器的解析过程（简化版）

当 Nest 收到一个请求 `GET /users`：

```
1. Nest 查看路由表 → 需要调用 UserController.findAll()

2. Nest 查看 IoC 容器 → UserController 有实例吗？
   ├── 有 → 直接用
   └── 没有 → 创建 UserController 实例
              ├── 查看构造器：constructor(private userService: UserService)
              ├── 需要 UserService → 递归：UserService 有实例吗？
              │   ├── 有 → 直接用
              │   └── 没有 → 创建 UserService 实例
              │              ├── 查看构造器：constructor(private db: Database)
              │              ├── 需要 Database → 递归...
              │              └── Database 有实例 → 注入到 UserService
              └── UserService 注入到 UserController → UserController 创建完成

3. 调用 controller.findAll() → 返回响应
```

**关键规则**：
- 默认情况下，所有 Provider 是**单例**（整个应用生命周期只创建一次）
- 容器在**首次需要时**才创建实例（懒加载），不是在应用启动时全部创建
- 如果依赖链中有循环（A → B → A），容器会检测到并抛出错误

## 一段极简 DI 容器的实现

理解了原理，实现一个最简单版的 DI 容器：

```typescript
class Container {
  private registry = new Map<any, any>();

  // 注册 Provider
  register<T>(token: any, factory: () => T): void {
    this.registry.set(token, factory);
  }

  // 获取实例
  get<T>(token: any): T {
    const factory = this.registry.get(token);
    if (!factory) throw new Error(`No provider for: ${token.name}`);
    return factory();
  }
}

// 使用
const container = new Container();
container.register(Database, () => new MysqlDatabase());
container.register(UserService, () => new UserService(container.get(Database)));

const userService = container.get(UserService);
```

Nest 的 DI 容器比这复杂得多——支持装饰器、单例/瞬态/请求生命周期、循环依赖检测、动态模块等——但**核心思想完全一致**。

> 试着手写一个 20 行的 DI 容器（如上面），你就能理解 Nest 的 IoC 是如何工作的了。

---

## 参考链接

- [NestJS — Providers](https://docs.nestjs.com/providers)
- [Wikipedia — Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection)
- [Martin Fowler — Inversion of Control Containers and the Dependency Injection Pattern](https://martinfowler.com/articles/injection.html)
- 开源笔记：《Nest 通关秘籍》.doc/6. IoC 解决了什么痛点问题？.md
