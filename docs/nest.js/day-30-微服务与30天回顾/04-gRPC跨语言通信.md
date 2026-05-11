# gRPC 跨语言通信

## 什么是 gRPC

gRPC 是 Google 开源的远程过程调用框架，基于 HTTP/2 和 Protocol Buffers：

```
REST (你一直用的)：              gRPC：
───────────────────            ──────────────
POST /book/create               rpc CreateBook(CreateBookRequest) returns (Book);
Body: JSON                      序列化：Protobuf（二进制）
Content-Type: application/json  Content-Type: application/grpc+proto
                                HTTP/2 多路复用
```

**核心差异**：
- REST 用 JSON 文本传输 → gRPC 用 Protobuf 二进制
- REST 用 HTTP/1.1 → gRPC 用 HTTP/2（多路复用、流式传输）
- REST 的 API 定义是口头约定 → gRPC 的 .proto 文件是强类型契约

> 前端类比：就像 JSON vs MessagePack——JSON 可读但体积大，MsgPack 二进制体积小但需要工具查看。Protobuf 就是后端的 MessagePack。

## gRPC 四种通信模式

```
1. 一元 RPC（Unary）——请求-响应，最常用
   Client → 发送一个请求 → 收到一个响应

2. 服务端流式（Server Streaming）——客户端发一次，服务端持续推送
   Client → 请求"大盘数据" → [数据1, 数据2, 数据3, ...]

3. 客户端流式（Client Streaming）——客户端持续发，服务端最后回应
   Client → [分片1, 分片2, 分片3] → Server 回复 "上传成功"

4. 双向流式（Bidirectional）——双向持续通信
   Client ⇄ Server（像 WebSocket，但是结构化数据）
```

## .proto 文件——接口定义

```protobuf
// protos/book.proto
syntax = "proto3";

package book;

// 定义服务——相当于 Controller
service BookService {
  // 一元 RPC
  rpc CreateBook (CreateBookRequest) returns (Book);

  // 一元 RPC
  rpc GetBook (GetBookRequest) returns (Book);

  // 一元 RPC
  rpc ListBooks (ListBooksRequest) returns (ListBooksResponse);

  // 服务端流式——一次请求，服务端持续推送
  rpc StreamNewBooks (StreamNewBooksRequest) returns (stream Book);
}

// 定义消息——相当于 DTO
message CreateBookRequest {
  string title = 1;
  string author = 2;
  string isbn = 3;
}

message GetBookRequest {
  int32 id = 1;
}

message ListBooksRequest {
  int32 page = 1;
  int32 size = 2;
  string keyword = 3;
}

message ListBooksResponse {
  repeated Book list = 1;   // repeated = 数组
  int32 total = 2;
  int32 page = 3;
  int32 size = 4;
}

message Book {
  int32 id = 1;
  string title = 2;
  string author = 3;
  string isbn = 4;
  string status = 5;
  string created_at = 6;
}

message StreamNewBooksRequest {
  int32 limit = 1;
}
```

**字段编号 `= 1, = 2, ...` 的作用**：Protobuf 在二进制层面用编号标识字段，不是用字段名。这让你可以随意重命名字段而不破坏兼容性，但**不能修改或删除已有编号**。

## NestJS 集成 gRPC

### 服务端

```typescript
// apps/book-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'book',                             // ← proto 中的 package
        protoPath: join(__dirname, '../../protos/book.proto'),
        url: '0.0.0.0:50051',                       // ← gRPC 端口
      },
    },
  );
  await app.listen();
}
```

```typescript
// apps/book-service/src/book/book.controller.ts
import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Metadata, ServerUnaryCall } from '@grpc/grpc-js';

@Controller()
export class BookController {
  constructor(private readonly bookService: BookService) {}

  // GrpcMethod 的参数：(service 名, rpc 方法名)
  @GrpcMethod('BookService', 'CreateBook')
  async createBook(
    data: { title: string; author: string; isbn?: string },
    metadata: Metadata,
    call: ServerUnaryCall<any, any>,
  ) {
    return this.bookService.create(data);
  }

  @GrpcMethod('BookService', 'GetBook')
  async getBook(data: { id: number }) {
    return this.bookService.findById(data.id);
  }

  @GrpcMethod('BookService', 'ListBooks')
  async listBooks(data: { page: number; size: number; keyword: string }) {
    const result = await this.bookService.list(data);
    return {
      list: result.list,
      total: result.total,
      page: result.page,
      size: result.size,
    };
  }
}
```

### 客户端

```typescript
// apps/user-api/src/book-client/book-client.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'BOOK_SERVICE_GRPC',
        transport: Transport.GRPC,
        options: {
          package: 'book',
          protoPath: join(__dirname, '../../protos/book.proto'),
          url: 'localhost:50051',
        },
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class BookClientModule {}
```

```typescript
// apps/user-api/src/book-client/book-client.service.ts
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { Observable } from 'rxjs';

// 从 .proto 推导的接口类型
interface BookServiceClient {
  createBook(data: any): Observable<any>;
  getBook(data: { id: number }): Observable<any>;
  listBooks(data: any): Observable<any>;
}

@Injectable()
export class BookClientService implements OnModuleInit {
  private bookServiceClient: BookServiceClient;

  constructor(
    @Inject('BOOK_SERVICE_GRPC') private client: ClientGrpc,
  ) {}

  onModuleInit() {
    // 获取 gRPC 客户端——Service 名和 .proto 中一致
    this.bookServiceClient =
      this.client.getService<BookServiceClient>('BookService');
  }

  async getBook(id: number) {
    // gRPC 返回 Observable，转成 Promise
    return firstValueFrom(this.bookServiceClient.getBook({ id }));
  }

  async listBooks(dto: { page: number; size: number; keyword: string }) {
    return firstValueFrom(this.bookServiceClient.listBooks(dto));
  }
}
```

## gRPC vs REST vs 消息队列

| 维度 | REST | gRPC | 消息队列 (RabbitMQ) |
|------|------|------|-------------------|
| 通信方式 | 同步请求-响应 | 同步请求-响应 | 异步发送-消费 |
| 数据格式 | JSON 文本 | Protobuf 二进制 | 自定义（JSON/Buffer） |
| 传输协议 | HTTP/1.1 | HTTP/2 | AMQP |
| 性能 | 一般 | 高（快 3-7 倍） | 取决于消费者 |
| 类型安全 | 无（口头约定） | 强（.proto） | 无 |
| 流式传输 | 不支持 | 支持 | 天然支持 |
| 浏览器兼容 | 原生支持 | 需要 grpc-web | 需要 WebSocket 桥接 |
| 跨语言 | 天然支持 | 天然支持 | 天然支持 |
| 学习成本 | 低 | 中 | 中-高 |

## gRPC 什么时候用

```
✅ 内部微服务间的高频调用
✅ 需要跨语言通信（Go 服务 ↔ Nest 服务）
✅ 对性能有极致要求（每秒万级调用）
✅ 需要服务端推送（Server Streaming）
✅ 有统一的 protos 仓库管理接口定义

❌ 浏览器直接调用（需要 grpc-web，多一层）
❌ 对外公开 API（REST + Swagger 文档更好）
❌ 小团队、简单项目（增加的复杂度不划算）
```

---

## 参考链接

- [gRPC — Official Documentation](https://grpc.io/docs/)
- [Protocol Buffers — Language Guide](https://protobuf.dev/programming-guides/proto3/)
- [NestJS — gRPC Transport](https://docs.nestjs.com/microservices/grpc)
- [gRPC Web — Browser Support](https://github.com/grpc/grpc-web)
