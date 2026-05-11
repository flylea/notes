# Provider 的 4 种写法

Nest 提供了 4 种 Provider 定义方式，每种适用不同的场景。

## 1. useClass — 提供类的实例（默认，最常用）

```typescript
@Module({
  providers: [
    UserService,  // 简写 = { provide: UserService, useClass: UserService }
  ],
})
```

**完整写法**（当 Token 和实现类不同时）：

```typescript
@Module({
  providers: [
    {
      provide: UserService,      // Token：用这个类名注入
      useClass: UserService,     // 实现：实际创建这个类的实例
    },
  ],
})
```

**什么时候用完整形式？** 当你有多套实现时：

```typescript
// 开发环境用 Mock 数据库，生产用真实数据库
@Module({
  providers: [
    {
      provide: Database,
      useClass: process.env.NODE_ENV === 'dev' ? MockDatabase : MysqlDatabase,
    },
  ],
})
```

> useClass 创建的实例是**单例**（默认）。每次注入拿到的是同一个对象。

## 2. useValue — 提供固定值

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE_URL',
      useValue: 'mysql://localhost:3306/book_system',
    },
    {
      provide: 'APP_CONFIG',
      useValue: {
        port: 3000,
        cors: true,
        logLevel: 'debug',
      },
    },
  ],
})
```

**何时使用**：
- 配置常量
- Mock 数据（测试环境）
- 外部库的实例（如 `ioredis` 的 `Redis` 实例）

> 注入 useValue 时必须用 `@Inject` 装饰器，因为值没有类型（不是 class）：

```typescript
@Injectable()
export class AppService {
  constructor(
    @Inject('DATABASE_URL') private readonly dbUrl: string,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}
}
```

## 3. useFactory — 动态创建（最灵活）

```typescript
@Module({
  providers: [
    {
      provide: 'DATABASE',
      useFactory: (config: ConfigService, logger: LoggerService) => {
        logger.log('Creating database connection...');
        if (config.get('DB_TYPE') === 'mysql') {
          return new MysqlDatabase(config.get('DB_URL'));
        }
        return new PostgresDatabase(config.get('DB_URL'));
      },
      inject: [ConfigService, LoggerService],  // 工厂的依赖
    },
    ConfigService,
    LoggerService,
  ],
})
```

**`inject` 参数**：声明工厂函数需要注入哪些依赖。这些依赖会被传递给工厂函数的参数（按顺序）。

**何时使用**：
- 创建对象前需要异步操作（如等待数据库连接建立）
- 需要条件判断（根据配置决定返回哪个实现）
- 需要包装或增强现有服务（如加日志、加缓存）

```typescript
// 实际例子：根据环境变量动态选择缓存实现
{
  provide: 'CACHE',
  useFactory: (config: ConfigService) => {
    const cacheType = config.get('CACHE_TYPE');
    if (cacheType === 'redis') {
      return new RedisCache(config.get('REDIS_URL'));
    }
    return new MemoryCache();
  },
  inject: [ConfigService],
}
```

> useFactory 也可以返回 Promise，Nest 会等待异步工厂完成后再创建依赖它的其他 Provider。

## 4. useExisting — 别名

```typescript
@Module({
  providers: [
    UserService,
    {
      provide: 'USER_SERVICE_ALIAS',
      useExisting: UserService,  // 指向同一个 UserService 实例
    },
  ],
})
```

**何时使用**：
- 给已有 Provider 起别名（字符串 Token ↔ Class Token 互指）
- 兼容旧代码（保留旧 Token，指向新实现）

## 4 种方式总结

| 方式 | 用途 | 创建时机 | 典型场景 |
|------|------|---------|---------|
| `useClass` | 提供类的实例 | 首次注入时懒创建 | **默认方式，90% 的场景** |
| `useValue` | 提供固定值 | 模块初始化时 | 配置常量、Mock 值、外部实例 |
| `useFactory` | 动态创建 | 首次注入时懒创建 | 条件创建、异步初始化、包装 |
| `useExisting` | 别名 | 指向已有实例 | Token 兼容、旧代码迁移 |

---

## 参考链接

- [NestJS — Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS — Asynchronous Providers](https://docs.nestjs.com/fundamentals/async-providers)
- 开源笔记：《Nest 通关秘籍》.doc/8. 使用多种 Provider，灵活注入对象.md
