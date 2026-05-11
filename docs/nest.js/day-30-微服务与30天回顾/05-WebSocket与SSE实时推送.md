# WebSocket 与 SSE 实时推送

## 实时通信的三种方式

```
轮询（Polling）：
  客户端："有新消息吗？"（每 2 秒）
  服务端："没有。"（99% 是废话）
  → 浪费带宽和连接

SSE（Server-Sent Events）：
  客户端："有什么新消息随时告诉我。"
  服务端："新消息1" → "新消息2" → "新消息3" ...
  → 单向推送，服务端 → 客户端

WebSocket：
  客户端 ⇄ 服务端
  → 双向实时通信
```

> 前端类比：`setInterval`（轮询）→ `EventSource`（SSE）→ `new WebSocket()`（WebSocket）。你作为前端开发者，这三种 API 都接触过，Nest 是它们的后端实现。

## SSE（Server-Sent Events）

SSE 最简单、场景最明确：**服务端单向推送**。

### Nest SSE 实现

```typescript
// src/notification/notification.controller.ts
import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller('notification')
export class NotificationController {
  // @Sse() 装饰器——返回 Observable<MessageEvent>
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    // 每 5 秒推送一次
    return interval(5000).pipe(
      map((count) => ({
        data: {
          message: `这是第 ${count + 1} 条通知`,
          timestamp: new Date().toISOString(),
          unreadCount: count + 1,
        },
        id: String(count + 1),
        event: 'notification',        // 事件类型
        retry: 3000,                  // 断线重连间隔
      })),
    );
  }
}
```

**前端接收**：

```javascript
// 浏览器端——原生 API，不需要任何库
const eventSource = new EventSource('/notification/stream');

eventSource.addEventListener('notification', (event) => {
  const data = JSON.parse(event.data);
  console.log('收到通知：', data);
  updateUnreadBadge(data.unreadCount);
});

eventSource.onerror = () => {
  // SSE 自动重连，这里做额外处理
  console.log('连接异常，等待重连...');
};
```

### SSE 的实战场景——借阅到期提醒

```typescript
import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable, from, timer, switchMap } from 'rxjs';

@Controller('notification')
export class NotificationController {
  constructor(private prisma: PrismaService) {}

  @Sse('overdue-reminder')
  overdueReminder(@Query('userId') userId: string): Observable<MessageEvent> {
    // 每 30 秒检查一次是否有即将到期的借阅
    return timer(0, 30000).pipe(
      switchMap(async (count) => {
        const overdueBooks = await this.prisma.borrowRecord.findMany({
          where: {
            userId: Number(userId),
            returnedAt: null,
            dueDate: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }, // 3 天内到期
          },
          include: { book: true },
        });

        return {
          data: overdueBooks.map((r) => ({
            bookTitle: r.book.title,
            dueDate: r.dueDate,
            daysLeft: Math.ceil(
              (r.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            ),
          })),
        } as MessageEvent;
      }),
    );
  }
}
```

## WebSocket

WebSocket 提供双向通信，适合聊天室、协作编辑、实时状态同步。

### Nest WebSocket 实现

```typescript
// 安装
// npm i @nestjs/websockets @nestjs/platform-socket.io socket.io

// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map<string, string>(); // socketId → username

  // 客户端连接时
  handleConnection(client: Socket) {
    console.log(`用户连接：${client.id}`);
  }

  // 客户端断开时
  handleDisconnect(client: Socket) {
    const username = this.onlineUsers.get(client.id);
    this.onlineUsers.delete(client.id);
    // 广播：有人离开
    this.server.emit('user-left', { username, socketId: client.id });
  }

  // 处理"加入聊天"事件
  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { username: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.onlineUsers.set(client.id, data.username);

    // 广播欢迎消息（发给所有人）
    this.server.emit('user-joined', {
      username: data.username,
      onlineCount: this.onlineUsers.size,
      onlineUsers: Array.from(this.onlineUsers.values()),
    });

    return { success: true, onlineCount: this.onlineUsers.size };
  }

  // 处理"发送消息"事件
  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: { content: string; to?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const username = this.onlineUsers.get(client.id);

    const message = {
      content: data.content,
      from: username,
      timestamp: new Date(),
    };

    if (data.to) {
      // 私聊——只发给目标用户
      this.server.to(data.to).emit('message', message);
    } else {
      // 广播——发给所有人（除了发送者）
      client.broadcast.emit('message', message);
    }
  }

  // 从服务端主动推送
  sendSystemAnnouncement(content: string) {
    this.server.emit('message', {
      content,
      from: '系统管理员',
      timestamp: new Date(),
    });
  }
}
```

### 在 Service 中注入 Gateway

```typescript
// src/book/book.service.ts
import { Injectable } from '@nestjs/common';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class BookService {
  constructor(
    private prisma: PrismaService,
    private chatGateway: ChatGateway,   // ← 注入 Gateway
  ) {}

  async create(dto: CreateBookDto) {
    const book = await this.prisma.book.create({ data: dto });

    // 新书上架，通知所有在线用户
    this.chatGateway.server.emit('book-created', {
      title: book.title,
      author: book.author,
    });

    return book;
  }
}
```

### 前端连接

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat');

socket.on('connect', () => {
  socket.emit('join', { username: 'Alice' });
});

socket.on('user-joined', (data) => {
  updateOnlineUsers(data.onlineUsers);
});

socket.on('message', (msg) => {
  appendMessage(msg);
});

// 发送消息
socket.emit('message', { content: '大家好！' });
```

## SSE vs WebSocket 速查

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 方向 | 服务端 → 客户端（单向） | 双向 |
| 协议 | HTTP（标准） | WS（独立协议） |
| 断线重连 | 内置自动重连 | 需要手动实现 |
| 浏览器支持 | 所有现代浏览器 | 所有现代浏览器 |
| 二进制数据 | 不支持 | 支持 |
| 消息推送 | 只推送 | 推送 + 接收 |
| 负载均衡兼容性 | 好（就是 HTTP） | 需要 sticky session |
| 适用场景 | 通知、状态更新、进度条 | 聊天、协作、游戏 |

**一句话选择**：
- 只需要服务端推客户端 → 选 SSE（简单、自动重连）
- 需要双向通信 → 选 WebSocket

---

## 参考链接

- [NestJS — WebSocket Gateways](https://docs.nestjs.com/websockets/gateways)
- [Socket.IO — Server API](https://socket.io/docs/v4/server-api/)
- [MDN — Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [MDN — WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
