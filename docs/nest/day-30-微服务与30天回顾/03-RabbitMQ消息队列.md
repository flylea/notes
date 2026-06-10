# RabbitMQ 消息队列

## 为什么需要消息队列

```
没有消息队列：
  用户借书 → API 处理（创建借阅记录+扣减库存+发短信+记日志+更新统计）
           → 响应时间 800ms（大部分时间在等短信/日志/统计）
           → 用户等得不耐烦

有了消息队列：
  用户借书 → API 处理（创建借阅记录+扣减库存）→ 100ms 返回
                ↓ 发一条消息到队列
           ┌────────────────────────────┐
           │ 消费者 1：发短信              │ ← 异步处理
           │ 消费者 2：记日志              │ ← 不用用户等
           │ 消费者 3：更新统计            │
           └────────────────────────────┘
```

**核心思想**：把"必须立刻做完的事"和"可以晚点做的事"分开。用户的等待时间只取决于前者。

> 前端类比：就像 `Promise.all` vs `await`——`await` 一个一个等很慢，但把不相互依赖的任务并行或者放到队列里异步执行，主流程就快了。

## RabbitMQ 核心概念

```
┌───────────────────────────────────────┐
│              RabbitMQ Broker           │
│                                       │
│  ┌─────────┐     ┌─────────┐          │
│  │ Exchange│     │ Exchange│          │
│  │ (交换机) │     │ (交换机) │          │
│  └────┬────┘     └────┬────┘          │
│       │               │               │
│       ▼               ▼               │
│  ┌─────────┐     ┌─────────┐          │
│  │  Queue  │     │  Queue  │          │
│  │ (队列)  │     │ (队列)  │          │
│  └─────────┘     └─────────┘          │
│                                       │
└───────────────────────────────────────┘
         ▲               ▲
    生产者发送        消费者接收
```

| 概念 | 说明 | 类比 |
|------|------|------|
| **Producer** | 发送消息的应用 | 发件人 |
| **Consumer** | 接收消息的应用 | 收件人 |
| **Queue** | 存储消息的缓冲区 | 快递仓库 |
| **Exchange** | 接收消息并按规则路由到队列 | 快递分拨中心 |
| **Routing Key** | 路由规则 | 快递地址 |
| **Binding** | Exchange 和 Queue 的绑定关系 | 分拨中心的路线表 |

## Exchange 的四种类型

```
1. Direct Exchange——精确匹配 routing key
   routing key = "book.created" → 只发给绑定了 "book.created" 的队列

2. Fanout Exchange——广播（忽略 routing key）
   所有绑定的队列都收到消息

3. Topic Exchange——通配符匹配
   routing key = "book.created.china"
   绑定规则 "book.#" 匹配（# 匹配任意多级）
   绑定规则 "book.*.usa" 不匹配（* 只匹配一级）

4. Headers Exchange——按消息头匹配
   不常用，忽略
```

## NestJS + RabbitMQ

### 启动 RabbitMQ（Docker）

```yaml
# docker-compose.yml 中加入
rabbitmq:
  image: rabbitmq:3-management-alpine
  container_name: rabbitmq
  ports:
    - '5672:5672'    # AMQP 协议端口
    - '15672:15672'  # 管理面板
  environment:
    RABBITMQ_DEFAULT_USER: admin
    RABBITMQ_DEFAULT_PASS: admin123
```

访问 `http://localhost:15672` 进入管理面板，用户/密码 `admin/admin123`。

### 生产者（发送消息）

```typescript
// apps/user-api/src/main.ts——混合应用
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 连接 RabbitMQ
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://admin:admin123@localhost:5672'],
      queue: 'book_events',           // 队列名
      queueOptions: { durable: true }, // 持久化（重启不丢消息）
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}
```

```typescript
// 发送消息
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class BookService {
  constructor(
    @Inject('RMQ_SERVICE') private rmqClient: ClientProxy,
  ) {}

  async create(dto: CreateBookDto) {
    const book = await this.prisma.book.create({ data: dto });

    // 发送事件——不等待结果，fire-and-forget
    this.rmqClient.emit('book.created', {
      id: book.id,
      title: book.title,
      author: book.author,
      timestamp: new Date(),
    });

    return book;
  }
}
```

### 消费者（接收消息）

```typescript
// apps/stats-service/src/main.ts
const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  StatsModule,
  {
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://admin:admin123@localhost:5672'],
      queue: 'book_events',
      queueOptions: { durable: true },
      // 手动确认模式
      noAck: false,
    },
  },
);
```

```typescript
// apps/stats-service/src/stats.controller.ts
import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';

@Controller()
export class StatsController {
  @EventPattern('book.created')
  async handleBookCreated(
    @Payload() data: { id: number; title: string; timestamp: Date },
    @Ctx() context: RmqContext,
  ) {
    // 处理统计逻辑
    console.log(`新书入库：《${data.title}》`);

    // 手动确认——告诉 RabbitMQ 处理成功
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    channel.ack(originalMsg);
  }

  @EventPattern('borrow.created')
  async handleBorrowCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    // 更新借阅排行榜
    const channel = context.getChannelRef();
    channel.ack(context.getMessage());
  }
}
```

## 消息确认（ACK）与重试

RabbitMQ 的消息可靠性靠 ACK 机制保障：

```
正常流程：
  Producer → Exchange → Queue → Consumer → 处理成功 → ACK → 消息删除

异常流程：
  Producer → Exchange → Queue → Consumer → 处理失败 → NACK → 重回队列
                                                         → 或进入死信队列
```

```typescript
// 消费失败时拒绝并重新入队
channel.nack(originalMsg, false, true);  // requeue=true

// 消费失败且不重新入队（进入死信队列）
channel.nack(originalMsg, false, false);
```

## 实际应用场景

```
场景 1：削峰填谷
  秒杀活动：瞬时 10000 个借书请求
  → 请求先进队列，消费者按自己能处理的速度慢慢消费
  → 数据库不会被冲垮

场景 2：异步解耦
  用户注册后：
  - 发欢迎邮件（可以晚 1 分钟）
  - 初始化书架（可以晚 1 分钟）
  - 送注册积分（可以晚 1 分钟）
  → 三条消息进三个队列，互不阻塞

场景 3：最终一致性
  book-service 改了书名
  → 发消息到队列
  → search-service 消费消息，更新搜索索引
  → 有短暂延迟（几百毫秒），但最终一致
```

## RabbitMQ vs Redis Pub/Sub

| 维度 | RabbitMQ | Redis Pub/Sub |
|------|----------|---------------|
| 消息持久化 | 支持（磁盘） | 不支持（内存） |
| 消息确认（ACK） | 支持 | 不支持 |
| 死信队列 | 支持 | 不支持 |
| 延迟消息 | 支持（插件） | 不支持 |
| 消费者不在线 | 消息保留 | 消息丢失 |
| 运维复杂度 | 高 | 低 |
| 适用场景 | 业务消息（借书、下单） | 缓存失效通知 |

---

## 参考链接

- [NestJS — RabbitMQ Transport](https://docs.nestjs.com/microservices/rabbitmq)
- [RabbitMQ — Tutorials](https://www.rabbitmq.com/tutorials)
- [RabbitMQ — AMQP 0-9-1 Model](https://www.rabbitmq.com/tutorials/amqp-concepts)
