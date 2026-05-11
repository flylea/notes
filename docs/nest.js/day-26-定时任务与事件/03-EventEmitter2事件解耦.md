# EventEmitter2 事件解耦

## 为什么需要事件

```
没有事件——模块紧耦合：

  BorrowService.borrowBook() {
    // 借书成功后...
    await this.notificationService.sendNotification();  // 发送通知
    await this.statsService.recordBorrow();              // 记录统计
    await this.auditService.logAction();                 // 审计日志
  }

  BorrowService 需要依赖 NotificationService、StatsService、AuditService
  → 模块耦合严重
  → 新增一个"借书后同步到 Elasticsearch"，又要改 BorrowService


使用事件——模块解耦：

  BorrowService.borrowBook() {
    // 借书成功后...
    this.eventEmitter.emit('book.borrowed', { userId, bookId, record });
  }

  // 各模块独立监听
  NotificationService:  @OnEvent('book.borrowed')  → 发通知
  StatsService:         @OnEvent('book.borrowed')  → 记录统计
  AuditService:         @OnEvent('book.borrowed')  → 审计日志
  SearchSyncService:    @OnEvent('book.borrowed')  → 同步搜索（新增，不用改 BorrowService！）
```

## 前端类比

```
EventEmitter = 前端的 Event Bus / mitt / Vue $emit/$on

Vue:
  this.$emit('book-borrowed', { bookId: 1 })
  this.$on('book-borrowed', (data) => { ... })

Nest:
  this.eventEmitter.emit('book.borrowed', { bookId: 1 })
  @OnEvent('book.borrowed')  handleBookBorrowed(payload) { ... }
```

## 安装和配置

```bash
npm install @nestjs/event-emitter
```

```typescript
// src/app.module.ts
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,                // 启用通配符 * 匹配
      delimiter: '.',                // 分隔符
      newListener: true,              // 是否触发 newListener 事件
      removeListener: true,           // 是否触发 removeListener 事件
      maxListeners: 10,               // 单事件最多监听器数
      verboseMemoryLeak: true,        // 内存泄漏警告
      ignoreErrors: false,            // 事件处理器报错是否忽略
    }),
  ],
})
export class AppModule {}
```

## 发送事件

```typescript
// src/borrow/borrow.service.ts
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class BorrowService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async borrowBook(userId: number, bookId: number) {
    const record = await this.prisma.$transaction(async (tx) => {
      // ... 借书逻辑
      return record;
    });

    // 发送事件——其他模块自行处理
    this.eventEmitter.emit('book.borrowed', {
      userId,
      bookId,
      recordId: record.id,
      timestamp: new Date(),
    });

    return record;
  }
}
```

## 监听事件

```typescript
// src/notification/notification.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  @OnEvent('book.borrowed')
  handleBookBorrowed(payload: { userId: number; bookId: number; recordId: number }) {
    this.logger.log(`用户 ${payload.userId} 借了书 ${payload.bookId}`);
    // 发送站内通知、邮件、短信...
  }

  @OnEvent('book.returned')
  handleBookReturned(payload: any) {
    this.logger.log(`用户 ${payload.userId} 还了书 ${payload.bookId}`);
  }

  // 使用通配符监听——匹配所有 book.* 事件
  @OnEvent('book.*')
  handleAllBookEvents(payload: any) {
    this.logger.debug(`图书事件触发: ${JSON.stringify(payload)}`);
  }
}
```

## 异步事件处理

```typescript
@Injectable()
export class StatsListener {
  constructor(private prisma: PrismaService) {}

  // 异步处理——不会阻塞主流程
  @OnEvent('book.borrowed', { async: true })
  async handleBookBorrowed(payload: any) {
    // 更新统计表（不需要在事务中，可以独立执行）
    await this.prisma.dailyStats.upsert({
      where: { date: new Date().toISOString().slice(0, 10) },
      create: { date: new Date(), borrowCount: 1 },
      update: { borrowCount: { increment: 1 } },
    });
  }
}
```

## 事件命名规范

```
命名格式：资源.动作

book.created      — 新增图书
book.updated      — 更新图书
book.deleted      — 删除图书
book.borrowed     — 图书被借出
book.returned     — 图书被归还

user.registered   — 用户注册
user.login        — 用户登录

borrow.overdue    — 借阅逾期

示例通配符：
  book.*   → 匹配所有图书事件
  *.created → 匹配所有创建事件
  **       → 匹配所有事件
```

---

## 参考链接

- [NestJS — Event Emitter](https://docs.nestjs.com/techniques/events)
- [EventEmitter2 — GitHub](https://github.com/EventEmitter2/EventEmitter2)
