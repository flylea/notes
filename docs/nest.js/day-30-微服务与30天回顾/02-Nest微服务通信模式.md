# NestJS 微服务通信模式

## NestJS 微服务架构

Nest 的微服务方案和它的 HTTP 方案结构几乎一样——这是 Nest 最大的设计优势：

```
HTTP 应用（你已熟悉）              微服务应用（结构完全相同）
──────────────────              ──────────────────
@Controller('books')            @Controller('books')   ← 一样的
@Get('list')                    @MessagePattern('list') ← 换了个装饰器
app.listen(3000)                app.connectMicroservice()
                                 app.startAllMicroservices()
```

**Controller/Service/Module 的代码不需要重写**——只需要改通信层的装饰器和启动方式。

> 前端类比：就像 Vue 从 Options API 迁移到 Composition API——组件的 template 部分不变，只改 script 部分的写法。

## 创建微服务项目

```bash
# 在 Monorepo 中创建一个微服务
nest generate app borrow-service

# borrow-service 就是一个独立进程的微服务
```

```typescript
// apps/borrow-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { BorrowServiceModule } from './borrow-service.module';

async function bootstrap() {
  // 不再用 app.listen(3000)，改为 connectMicroservice
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    BorrowServiceModule,
    {
      transport: Transport.TCP,     // ← 传输层：TCP
      options: {
        host: '0.0.0.0',
        port: 3001,
      },
    },
  );

  await app.listen();
}
bootstrap();
```

## 四种内置传输层对比

| 传输层 | 协议 | 适用场景 | 优点 | 缺点 |
|--------|------|---------|------|------|
| **TCP** | TCP | 简单的内部服务调用 | 零依赖、最简单 | 无负载均衡、无重试 |
| **Redis** | Pub/Sub | 一对多广播、简单队列 | 利用现有 Redis 设施 | 消息不持久化 |
| **RabbitMQ** | AMQP | 需要消息确认和持久化 | 消息可靠、功能全面 | 运维复杂 |
| **gRPC** | HTTP/2 | 跨语言、高性能场景 | 类型安全、流式传输 | .proto 文件维护成本 |

## TCP 模式——最简单

```typescript
// ========== 服务端：borrow-service ==========
// main.ts
const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  BorrowServiceModule,
  { transport: Transport.TCP, options: { port: 3001 } },
);

// borrow.controller.ts
@Controller()
export class BorrowController {
  constructor(private readonly borrowService: BorrowService) {}

  // 用 @MessagePattern 替代 @Get/@Post
  @MessagePattern('borrow.create')
  async create(@Payload() data: { userId: number; bookId: number }) {
    return this.borrowService.borrowBook(data.userId, data.bookId);
  }
}
```

```typescript
// ========== 客户端：user-api 调用 borrow-service ==========
// user-api 的某处需要借书时

import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';

@Injectable()
export class UserService {
  private borrowClient: ClientProxy;

  constructor() {
    // 创建 TCP 客户端连接到 borrow-service
    this.borrowClient = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3001 },
    });
  }

  async borrowBook(userId: number, bookId: number) {
    // send() 发送消息——返回 Observable，用 firstValueFrom 转 Promise
    return firstValueFrom(
      this.borrowClient.send('borrow.create', { userId, bookId }),
    );
  }
}
```

```typescript
// 更好的方式：用 @Client() 装饰器
import { Client, ClientProxy, Transport } from '@nestjs/microservices';

@Injectable()
export class UserService {
  @Client({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3001 },
  })
  private borrowClient: ClientProxy;

  async borrowBook(userId: number, bookId: number) {
    return firstValueFrom(
      this.borrowClient.send('borrow.create', { userId, bookId }),
    );
  }
}
```

## @MessagePattern vs @EventPattern

```typescript
@Controller()
export class BorrowController {
  // MessagePattern：请求-响应模式（有返回值）
  @MessagePattern('borrow.create')
  async borrow(@Payload() data: BorrowDto) {
    return { success: true, record: await this.service.borrow(data) };
    // ↑ 调用方等待这个返回值
  }

  // EventPattern：事件模式（无返回值，fire-and-forget）
  @EventPattern('borrow.created')
  async handleBorrowCreated(@Payload() data: BorrowRecord) {
    await this.statsService.incrementBorrowCount();
    // ↑ 调用方不等待，发了就走
  }
}
```

```
MessagePattern：A 问 B → B 回答 A（类似 HTTP Request-Response）
  user-api.send('borrow.create', data) → borrow-service 返回结果 → user-api 拿到结果

EventPattern：A 通知 B → B 自己处理（类似 EventEmitter）
  user-api.emit('borrow.created', data) → borrow-service 异步处理 → user-api 不管结果
```

## Redis 模式——Pub/Sub 广播

```typescript
// 适合一对多广播：一个事件，多个服务同时收到
// main.ts
const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  AppModule,
  {
    transport: Transport.REDIS,
    options: {
      host: 'localhost',
      port: 6379,
    },
  },
);
```

```
emit('user.registered', userData)
  → Redis Pub/Sub 广播
  → user-service 收到（发欢迎邮件）
  → stats-service 收到（统计注册数）
  → point-service 收到（送注册积分）
```

> 注意：Redis Pub/Sub 消息不持久化——如果服务不在线，消息就丢了。需要可靠消息的场景用 RabbitMQ。

## 混合应用——同时提供 HTTP 和微服务

一个 Nest 应用可以**同时**对外提供 HTTP 接口和对内提供微服务通信：

```typescript
// main.ts——混合应用
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 启用微服务——对内通信
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { port: 3001 },
  });

  // 同时监听 HTTP——对外暴露
  await app.startAllMicroservices();
  await app.listen(3000);
}
```

```
            ┌──────────┐
  浏览器 →  │  :3000   │ ← HTTP（对外 API）
            │  Nest    │
  其他服务 →│  :3001   │ ← TCP（对内微服务）
            └──────────┘
```

## 客户端代理模块——更好的封装

把客户端连接封装成 Module，让调用方像用普通 Service 一样调用远程服务：

```typescript
// libs/clients/src/borrow-client.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'BORROW_SERVICE',        // ← 注入令牌
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: 3001 },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class BorrowClientModule {}
```

```typescript
// 使用方注入
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class BookService {
  constructor(
    @Inject('BORROW_SERVICE') private borrowClient: ClientProxy,
  ) {}

  async borrow(userId: number, bookId: number) {
    return firstValueFrom(
      this.borrowClient.send('borrow.create', { userId, bookId }),
    );
  }
}
```

---

## 参考链接

- [NestJS — Microservices Basics](https://docs.nestjs.com/microservices/basics)
- [NestJS — Redis Transport](https://docs.nestjs.com/microservices/redis)
- [NestJS — TCP Transport](https://docs.nestjs.com/microservices/tcp)
- [NestJS — gRPC Transport](https://docs.nestjs.com/microservices/grpc)
