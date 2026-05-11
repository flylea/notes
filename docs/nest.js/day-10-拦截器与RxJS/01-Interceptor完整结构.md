# Interceptor 完整结构

## NestInterceptor 接口

```typescript
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

interface NestInterceptor<T = any, R = any> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<R>;
}
```

- `T`：Controller 返回值的类型（输入）
- `R`：Interceptor 处理后返回给客户端的类型（输出）
- `next.handle()`：返回 `Observable<T>`——Controller 的返回值被包装在其中

## 完整生命周期

```typescript
@Injectable()
export class FullLifecycleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // ============ 阶段 1：Controller 执行前 ============
    console.log('1. Before Controller execution');

    const request = context.switchToHttp().getRequest();
    request.startTime = Date.now();

    return next.handle().pipe(
      // ============ 阶段 2：Controller 执行后，响应序列化前 ============
      // data = Controller 的返回值（原始对象）
      tap(data => console.log('2. After Controller, data:', data)),

      // ============ 阶段 3：修改响应（在 JSON 序列化之前）============
      map(data => ({
        code: 0,
        data,
        message: 'ok',
      })),

      // ============ 阶段 4：序列化后（用于日志，不影响响应）============
      tap(() => {
        console.log(`3. Request completed in ${Date.now() - request.startTime}ms`);
      }),
    );
  }
}
```

## 洋葱模型确认

```typescript
// 全局注册：AInterceptor
// Controller 级别：BInterceptor
// Handler 级别：CInterceptor

// 执行顺序：
// C.before → B.before → A.before → Controller → A.after → B.after → C.after
```

**越接近 Handler 的 Interceptor，越晚进入，越早退出。** 这是标准的洋葱模型。

## next.handle() 的关键理解

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  // ⚠️ 关键：next.handle() 返回的是一个 Observable
  // 这个 Observable 在 Controller 执行完成后才 emit 值

  const stream$ = next.handle();

  // 在 stream$ 上 pipe，就是在 Controller 执行完成后对数据做变换
  return stream$.pipe(
    tap(data => console.log(data)),  // data = Controller 的返回值
  );
}
```

## 可以做的事

| 时机 | 能做的事 | 示例 |
|------|---------|------|
| `next.handle()` 之前 | 请求预处理 | 记录开始时间、缓存命中返回 |
| `next.handle().pipe(tap())` | 副作用（不改变返回值） | 记录日志、监控耗时 |
| `next.handle().pipe(map())` | 修改返回值 | 统一响应格式包装 |
| `next.handle().pipe(catchError())` | 异常捕获 | 降级处理、错误日志 |
| `next.handle().pipe(timeout())` | 超时控制 | 接口超时自动取消 |
| 直接 `return of(data)` | 跳过 Controller | 缓存命中直接返回 |

## 跳过 Controller（缓存模式）

```typescript
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const key = request.url;

    const cached = this.cache.get(key);
    if (cached) {
      // 直接返回缓存，跳过 Controller
      return of(cached);
    }

    return next.handle().pipe(
      tap(data => {
        this.cache.set(key, data);  // 缓存结果
      }),
    );
  }
}
```

## 关键限制

Interceptor 无法修改**已经被序列化的 JSON**：

```typescript
// Controller 返回：{ username: 'john' }
// Nest 自动执行 JSON.stringify()
// Interceptor map 收到的 data = { username: 'john' }（对象，未序列化）
// map 返回 { code: 0, data: { username: 'john' } }
// Nest 将这个新对象 JSON 序列化
```

所以 `map` 是在序列化**之前**执行的——它改变的是要序列化的对象，而不是 JSON 字符串。这是正确理解 Interceptor 行为的关键。

---

## 参考链接

- [NestJS — Interceptors](https://docs.nestjs.com/interceptors)
- [RxJS — Observable](https://rxjs.dev/guide/observable)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md、doc/24.RxJS中常用操作符.md
