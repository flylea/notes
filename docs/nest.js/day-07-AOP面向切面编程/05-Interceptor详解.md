# Interceptor 详解

## Interceptor 的定位

Interceptor 是功能**最强大**的切面——它在 Controller 方法调用的**前后**都可以执行逻辑，甚至可以将 Controller 的返回值完全替换掉。

**核心特征**：
- 可以拿到 `ExecutionContext`（知道哪个 handler 被调用）
- 基于 RxJS Observable 管道——可以在数据返回的流上做变换
- 功能最全面：日志、缓存、超时控制、响应包装、性能监控

## Interceptor 的基本结构

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    // ====== Controller 调用前 ======
    console.log('Before...');

    const now = Date.now();

    // next.handle() 返回 Observable — 代表 Controller 的返回值流
    return next.handle().pipe(
      // ====== Controller 调用后 ======
      tap(() => console.log(`After... ${Date.now() - now}ms`)),
    );
  }
}
```

**执行流程**：

```
Interceptor: Before...           ← Controller 执行前
  ↓
Controller: return bookService.findAll()
  ↓
Interceptor: tap() 中的回调执行    ← Controller 执行后（响应已被序列化）
  ↓
HTTP 响应发送给客户端
```

## 四大 RxJS Operator 应用

Nest 的 Interceptor 基于 RxJS Observable，以下是最常用的 4 个 operator：

### 1. tap — 副作用操作（不打乱数据流）

```typescript
import { tap } from 'rxjs/operators';

// 记录请求日志（不改变返回值）
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const request = context.switchToHttp().getRequest();
  const start = Date.now();

  return next.handle().pipe(
    tap({
      next: (data) => {
        console.log(`[${request.method} ${request.url}] ${Date.now() - start}ms`);
        // data 就是 Controller 返回的数据，tap 只看不改
      },
      error: (err) => {
        console.error(`[${request.method} ${request.url}] ERROR:`, err.message);
      },
    }),
  );
}
```

`tap` 就像 Vue 的 `watch`——观察数据变化但不改变它。

### 2. map — 数据转换（改变返回值）

```typescript
import { map } from 'rxjs/operators';

// 统一响应格式
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  return next.handle().pipe(
    map(data => ({
      code: 0,
      data: data,      // Controller 返回的原始数据
      message: 'ok',
      timestamp: new Date().toISOString(),
    })),
  );
}
```

```
Controller 返回: { username: 'john' }
       ↓ map()
客户端收到:     { code: 0, data: { username: 'john' }, message: 'ok', timestamp: '...' }
```

> ⚠️ `map` 后返回的对象会**完全替代** Controller 的原始返回值。JSON 序列化发生在 map 之后。

### 3. catchError — 异常捕获与替换

```typescript
import { catchError, throwError } from 'rxjs';

intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  return next.handle().pipe(
    catchError(err => {
      // 自定义错误处理
      console.error('Caught in interceptor:', err.message);

      // 可以返回一个"降级"值（不抛异常）
      // return of({ code: -1, message: 'Service unavailable' });

      // 也可以重新抛出（让 ExceptionFilter 处理）
      return throwError(() => err);
    }),
  );
}
```

### 4. timeout — 超时控制

```typescript
import { timeout } from 'rxjs/operators';

intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  return next.handle().pipe(
    timeout(5000),  // 超过 5 秒自动取消请求
  );
}
```

如果 Controller 方法在 5 秒内没有返回值，会抛出 `TimeoutError`。

## 实战 1：统一响应格式 Interceptor（图书管理系统）

这是企业项目中最常见的 Interceptor——所有接口的响应统一包装为 `{ code, data, message }` 格式：

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => ({
        code: 0,
        data,
        message: 'ok',
      })),
    );
  }
}
```

全局注册：

```typescript
// main.ts
app.useGlobalInterceptors(new TransformInterceptor());
```

效果：

```json
// 之前
{ "username": "john" }

// 之后
{
  "code": 0,
  "data": { "username": "john" },
  "message": "ok"
}
```

## 实战 2：请求耗时监控 Interceptor

```typescript
@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Performance');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        if (duration > 1000) {
          // 慢查询预警
          this.logger.warn(
            `SLOW: ${request.method} ${request.url} — ${duration}ms`,
          );
        }
      }),
    );
  }
}
```

## Controller 级别和 Handler 级别的 Interceptor

```typescript
// Controller 级别
@Controller('book')
@UseInterceptors(TransformInterceptor)  // 整个 BookController 都经过包装
export class BookController {}

// Handler 级别
@Get('list')
@UseInterceptors(CacheInterceptor)  // 只对 list 接口做缓存
list() {
  return this.bookService.findAll();
}
```

## 拦截器链的执行顺序

如果全局注册了 `AInterceptor`，Controller 级别注册了 `BInterceptor`，Handler 级别注册了 `CInterceptor`：

```
请求 → C.before → B.before → A.before → Controller → A.after → B.after → C.after → 响应
```

**洋葱模型**：先注册后执行（与 Koa 的中间件模型一致）。

## 前端类比

| Nest Interceptor | 前端类比 | 相似之处 |
|-----------------|---------|---------|
| `tap` 记录日志 | Vue `watch` | 观察数据，不改变 |
| `map` 包装响应 | Axios `response.interceptors` 的 `response => response.data` | 在拿到数据后变换 |
| `catchError` | Axios `response.interceptors` 的 `error => {}` | 统一处理错误 |
| `timeout` | Axios `timeout: 5000` | 超时取消 |
| 洋葱模型 | Koa 中间件 | 嵌套执行 |

> Interceptor 是 Nest 的瑞士军刀——掌握它，你能用极少的代码覆盖大量通用需求。Day 10 会深入更多 RxJS Operator 和序列化技巧。

---

## 参考链接

- [NestJS — Interceptors](https://docs.nestjs.com/interceptors)
- [RxJS — tap](https://rxjs.dev/api/operators/tap)
- [RxJS — map](https://rxjs.dev/api/operators/map)
- [RxJS — catchError](https://rxjs.dev/api/operators/catchError)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md
