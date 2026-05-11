# PrismaService 完整实现

## 完整代码

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ],
    });

    // 开发环境开启 SQL 日志
    if (process.env.NODE_ENV !== 'production') {
      this.$on('query' as any, (e: any) => {
        this.logger.debug(`Query: ${e.query} (${e.duration}ms)`);
      });
    }
  }

  async onModuleInit() {
    // 应用启动时连接数据库
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    // 应用关闭时断开连接
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
```

## 关键设计点

### 1. extends PrismaClient

```typescript
// PrismaService 继承 PrismaClient
// 所以它拥有 prisma.user, prisma.book 等所有方法
@Injectable()
export class PrismaService extends PrismaClient {}
```

### 2. implements OnModuleInit

```typescript
// Nest 启动时会自动调用 onModuleInit
async onModuleInit() {
  await this.$connect(); // 懒连接→主动连接
}

// PrismaClient 默认是懒连接（第一次查询时才连接）
// 通过 $connect() 在启动时主动连接，能提前发现数据库连接问题
```

### 3. 构造函数中的 SQL 日志

```typescript
constructor() {
  super({
    log: [{ level: 'warn', emit: 'stdout' }],
  });

  // 开发环境通过 $on('query') 监控所有 SQL
  if (isDev) {
    this.$on('query', (e) => {
      logger.debug(`[${e.duration}ms] ${e.query}`);
    });
  }
}
```

## 前端类比

```
PrismaService extends PrismaClient
  ↔  Vue 插件在 install() 中扩展 app 实例

onModuleInit → $connect()
  ↔  Vue Router 在 app.mount() 之前初始化路由

onModuleDestroy → $disconnect()
  ↔  Vue beforeUnmount → 清理定时器、取消订阅
```

---

## 参考链接

- [Prisma — NestJS Integration](https://www.prisma.io/docs/guides/frameworks/nestjs)
- [NestJS — Lifecycle Hooks](https://docs.nestjs.com/fundamentals/lifecycle-events)
- 开源笔记：《Nest 通关秘籍》.doc/151.在Nest里集成Prisma.md
