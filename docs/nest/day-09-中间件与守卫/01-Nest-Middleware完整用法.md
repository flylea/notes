# Nest Middleware 完整用法

## Middleware 两种定义方式

### Class 形式（推荐）

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  }
}
```

### Function 形式

```typescript
import { Request, Response, NextFunction } from 'express';

export function logger(req: Request, res: Response, next: NextFunction) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
}
```

选择标准：需要注入依赖用 Class，不需要用 Function。

## Module 中注册

```typescript
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');  // 所有路由
  }
}
```

## 路由匹配详解

### 通配符匹配

```typescript
// 匹配所有路由
.forRoutes('*')

// 匹配 /user 及其所有子路由
.forRoutes('user')
// 匹配 /user, /user/profile, /user/settings

// 匹配 /book/list, /book/detail/123 但不匹配 /user
.forRoutes('book/*')
```

### 按 HTTP 方法匹配

```typescript
consumer
  .apply(LoggerMiddleware)
  .forRoutes(
    { path: 'book', method: RequestMethod.POST },    // 只匹配 POST /book
    { path: 'user', method: RequestMethod.GET },      // 只匹配 GET /user
    { path: '*', method: RequestMethod.ALL },         // 所有方法的根路由
  );
```

### 按 Controller 类匹配

```typescript
consumer
  .apply(LoggerMiddleware)
  .forRoutes(BookController);  // BookController 中定义的所有路由
```

## 排除某些路由

```typescript
consumer
  .apply(AuthMiddleware)
  .exclude(
    { path: 'user/register', method: RequestMethod.POST },
    { path: 'user/login', method: RequestMethod.POST },
    { path: 'health', method: RequestMethod.GET },
  )
  .forRoutes('*');
// 除了注册、登录、健康检查，其他所有路由都需要 AuthMiddleware
```

## 多个中间件的顺序

```typescript
consumer
  .apply(CorsMiddleware, SessionMiddleware, LoggerMiddleware, AuthMiddleware)
  .forRoutes('*');

// 执行顺序（从上到下）：
// CorsMiddleware → SessionMiddleware → LoggerMiddleware → AuthMiddleware
```

> 中间件的执行顺序就是 `apply()` 中的参数顺序——先传入的先执行。

## MiddlewareConsumer 完整 API

```typescript
interface MiddlewareConsumer {
  apply(...middleware): MiddlewareConfigProxy;
}

interface MiddlewareConfigProxy {
  exclude(...routes): MiddlewareConfigProxy;
  forRoutes(...routes): void;
}
```

## 实战：图书管理系统的中间件配置

```typescript
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import * as cors from 'cors';
import * as helmet from 'helmet';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      // 1. CORS — 允许跨域（最先执行）
      .apply(cors({ origin: 'http://localhost:5173', credentials: true }))

      // 2. 安全头
      .apply(helmet())

      // 3. Session 解析（Day 20 详讲）
      .apply(SessionMiddleware)

      // 4. 请求日志
      .apply(RequestLogMiddleware)

      // 以上应用到所有路由
      .forRoutes('*');

    // 5. 限流中间件单独配置——只针对用户模块
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes(
        { path: 'user/register', method: RequestMethod.POST },
        { path: 'user/login', method: RequestMethod.POST },
      );
  }
}
```

## Middleware 中修改 req/res

```typescript
@Injectable()
export class EnrichRequestMiddleware implements NestMiddleware {
  use(req: any, res: Response, next: NextFunction) {
    // 给 req 挂载额外信息
    req.requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    req.startTime = Date.now();

    // 给 res 添加自定义响应头
    res.setHeader('X-Request-Id', req.requestId);

    next();
  }
}
```

之后在 Interceptor 或 Controller 中可以读到 `req.requestId` 和 `req.startTime`。

## 全局 Middleware

如果不想在 `configure()` 中注册，可以在 `main.ts` 中用 Express 的方式：

```typescript
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  await app.listen(3000);
}
```

`app.use()` 注册的中间件对所有路由生效，且无法排除。

> 推荐用 `configure()` 注册，因为它提供了路由级别的精确控制。

---

## 参考链接

- [NestJS — Middleware](https://docs.nestjs.com/middleware)
- [Express — Using Middleware](https://expressjs.com/en/guide/using-middleware.html)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md
