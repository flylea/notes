# Middleware 详解

## Middleware 在 Nest 中的定位

Middleware 是 Nest 请求管道的**第一道关卡**。它位于所有切面之前，可以访问原始的 Request 和 Response 对象。

**核心特征**：
- 调用时机最早（比 Guard 还早）
- 只能拿到 req/res，不知道后续调的是哪个 handler
- 与 Express 中间件完全兼容——可以直接复用 Express 生态
- 适合做请求层面的"增强"：body-parser、CORS、cookie-parser、session

## Nest Middleware 的两种写法

### 写法 1：Class 形式（推荐）

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  }
}
```

### 写法 2：Function 形式

```typescript
import { Request, Response, NextFunction } from 'express';

export function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
}
```

### 什么时候用哪种？

| | Class 形式 | Function 形式 |
|---|---|---|
| 能否注入依赖 | ✅ `@Injectable()` | ❌ 纯函数无法注入 |
| 适合场景 | 需要访问 DB/Config 等依赖 | 简单逻辑（日志/CORS） |
| 代码量 | 稍多 | 更简洁 |

> 如果你的中间件不需要注入依赖，函数形式更轻量。但 Class 形式更符合 Nest 风格，且扩展性更好。

## 注册 Middleware

在 Module 中通过 `configure()` 方法注册：

```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';

@Module({
  imports: [UserModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');  // 所有路由都经过这个中间件
  }
}
```

> 注意：被注册的 Module 必须实现 `NestModule` 接口，否则 `configure()` 不会执行。

### 指定匹配路由

```typescript
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(LoggerMiddleware)
    .forRoutes(
      'user',                    // 匹配 /user 及其子路由
      { path: 'book', method: RequestMethod.POST },  // 只匹配 POST /book
      BookController,            // 匹配该 Controller 的所有路由
    );
}
```

### 排除某些路由

```typescript
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(LoggerMiddleware)
    .exclude(
      { path: 'health', method: RequestMethod.GET },  // 健康检查不打日志
    )
    .forRoutes('*');
}
```

### 应用多个 Middleware（顺序执行）

```typescript
configure(consumer: MiddlewareConsumer) {
  consumer
    .apply(CorsMiddleware, SessionMiddleware, LoggerMiddleware)
    .forRoutes('*');
  // 执行顺序：CorsMiddleware → SessionMiddleware → LoggerMiddleware
}
```

## 常用 Middleware 实战

### 1. Body 解析（内置）

Nest 默认已经开启了 `body-parser`，不需要手动配置。如果需要调整限制：

```typescript
// main.ts
const app = await NestFactory.create(AppModule);
app.use(express.json({ limit: '50mb' }));         // JSON body 上限
app.use(express.urlencoded({ extended: true }));   // form-urlencoded
```

### 2. CORS

```typescript
// main.ts — 全局启用
app.enableCors({
  origin: ['https://my-frontend.com', 'http://localhost:5173'],
  credentials: true,  // 允许携带 cookie
});
```

也可以作为 Middleware：

```typescript
import * as cors from 'cors';

consumer
  .apply(cors({ origin: 'http://localhost:5173' }))
  .forRoutes('*');
```

### 3. Helmet（安全头）

```bash
npm install helmet
```

```typescript
import * as helmet from 'helmet';

// main.ts
app.use(helmet());
// 自动添加 X-XSS-Protection、X-Frame-Options、Content-Security-Policy 等安全响应头
```

### 4. 自定义请求日志（图书管理系统实战）

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    // 监听响应完成事件
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      console.log(
        `[Request] ${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip}`,
      );
    });

    next();
  }
}
```

输出示例：
```
[Request] POST /user/register 201 45ms - ::1
[Request] GET /book/list 200 3ms - ::1
```

## Middleware 的局限性

Middleware 虽然强大，但有两个关键限制：

1. **无法获取路由元数据**：Middleware 只知道 `req.url`，不知道 `@Post('register')` 上的装饰器信息——它分不清这个请求会走到哪个 handler。

2. **职责不明确**：如果所有通用逻辑都用 Middleware 实现，很快就会变成"上帝中间件"——日志、权限、校验、Session……大家混在一起。

这就是为什么 Nest 在 Middleware 之后引入了 Guard、Pipe、Interceptor 这些更精细的切面——它们通过 `ExecutionContext` 可以精确知道调的是哪个 handler、上面有哪些装饰器。

> Middleware 的黄金法则：只做**请求层面的底层处理**（解析 cookie、修改 req/res、设置 CORS），不做**业务相关的鉴权和校验**——那是 Guard 和 Pipe 的事。

---

## 参考链接

- [NestJS — Middleware](https://docs.nestjs.com/middleware)
- [Express Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [Express cors](https://github.com/expressjs/cors)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md
