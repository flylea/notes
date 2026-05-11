# RxJS 四大核心 Operator 在 Nest 中的应用

## RxJS 在 Nest 中的角色

Nest 的 Interceptor 基于 RxJS 的 Observable 管道模型。但你不需要学完整个 RxJS——Nest 中 90% 的场景只用到 4 个 operator。

## 1. tap — 副作用操作

**做什么**：观察数据流中的值，但不改变它。类似 Vue 的 `watch`。

```typescript
import { tap } from 'rxjs/operators';

next.handle().pipe(
  tap(data => {
    console.log('返回值:', data);
    // data 不变，不影响最终响应
  }),
);
```

### tap 支持三种回调

```typescript
next.handle().pipe(
  tap({
    next: (data) => {
      // Controller 正常返回时执行
      console.log('成功:', data);
    },
    error: (err) => {
      // Controller 抛出异常时执行
      console.error('异常:', err.message);
      // ⚠️ 这里只是观察，不会阻止异常继续传播
    },
    complete: () => {
      // Observable 完成时执行（数据已经发送）
      console.log('请求处理完成');
    },
  }),
);
```

### 典型场景：记录请求耗时

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const start = Date.now();
  return next.handle().pipe(
    tap(() => {
      console.log(`耗时: ${Date.now() - start}ms`);
    }),
  );
}
```

## 2. map — 数据转换

**做什么**：改变返回值。类似 Axios 的响应拦截器。

```typescript
import { map } from 'rxjs/operators';

next.handle().pipe(
  map(data => ({
    code: 0,
    data,
    message: 'ok',
  })),
);
```

```
Controller 返回:  { username: 'john' }
       ↓ map()
客户端收到:       { code: 0, data: { username: 'john' }, message: 'ok' }
```

### 按接口类型包装

```typescript
next.handle().pipe(
  map(data => {
    // 如果 Controller 已经返回了自定义格式，就不重复包装
    if (data && data.code !== undefined) {
      return data;
    }
    return { code: 0, data, message: 'ok' };
  }),
);
```

## 3. catchError — 异常捕获与处理

**做什么**：在 Interceptor 层面捕获异常，可以做降级处理或重新抛出。

```typescript
import { catchError, throwError, of } from 'rxjs';

next.handle().pipe(
  catchError(err => {
    console.error('Interceptor caught:', err.message);

    // 方案 A：降级返回（不抛异常）
    return of({ code: -1, data: null, message: '服务暂时不可用' });

    // 方案 B：重新抛出（让 ExceptionFilter 处理）
    // return throwError(() => err);

    // 方案 C：包装异常
    // return throwError(() => new InternalServerErrorException('服务器错误'));
  }),
);
```

### catchError vs ExceptionFilter 的选择

| | Interceptor catchError | ExceptionFilter |
|---|---|---|
| 执行时机 | ExceptionFilter 之前 | 所有切面之后 |
| 能否降级返回 | ✅ `return of(data)` | ❌ 只能返回错误响应 |
| 能否修改异常 | ✅ 包装后重新抛出 | ⚠️ 可以，但晚了 |
| 典型场景 | 服务降级、缓存兜底 | 统一错误格式 |

## 4. timeout — 超时控制

**做什么**：超过指定时间自动取消请求。

```typescript
import { timeout, catchError, throwError } from 'rxjs';

next.handle().pipe(
  timeout(5000),  // 5 秒超时
  catchError(err => {
    if (err.name === 'TimeoutError') {
      return throwError(
        () => new GatewayTimeoutException('请求超时，请稍后重试'),
      );
    }
    return throwError(() => err);
  }),
);
```

## RxJS Operator 组合实战

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const request = context.switchToHttp().getRequest();
  const start = Date.now();

  return next.handle().pipe(
    // 1. 超时控制（5 秒）
    timeout(5000),

    // 2. 异常捕获（将 TimeoutError 转为业务异常）
    catchError(err => {
      if (err.name === 'TimeoutError') {
        return throwError(() => new GatewayTimeoutException('请求超时'));
      }
      return throwError(() => err);
    }),

    // 3. 数据包装
    map(data => ({
      code: 0,
      data,
      message: 'ok',
    })),

    // 4. 日志记录（最后，不影响返回值）
    tap(() => {
      console.log(
        `[${request.method} ${request.url}] ${Date.now() - start}ms`,
      );
    }),
  );
}
```

## 前端类比

| RxJS Operator | 前端类比 |
|--------------|---------|
| `tap` | Vue `watch` / React `useEffect`（观察数据，不改变） |
| `map` | `Array.prototype.map` / Axios response interceptor |
| `catchError` | try-catch / Axios error interceptor |
| `timeout` | Axios `timeout: 5000` / fetch AbortController |
| `of` | `Promise.resolve()` — 创建一个立即 emit 值的 Observable |

> 不用担心 RxJS 学不完——Nest 中就用这 4 个 operator，15 分钟就能上手。

---

## 参考链接

- [RxJS — tap](https://rxjs.dev/api/operators/tap)
- [RxJS — map](https://rxjs.dev/api/operators/map)
- [RxJS — catchError](https://rxjs.dev/api/operators/catchError)
- [RxJS — timeout](https://rxjs.dev/api/operators/timeout)
- [Learn RxJS](https://www.learnrxjs.io/)
- 开源笔记：《Nest 通关秘籍》.doc/24.RxJS中常用操作符.md
