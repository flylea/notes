# 第 18 章 RxJS 与 Interceptor

## 先弄懂：Observable、RxJS 和拦截器

**RxJS** 是 JavaScript 的响应式流库。它把“未来陆续到达的值”抽象成 **Observable**：一个可以发出 0 个、1 个或多个值的流，还能用 `map`、`filter`、`catchError` 这些操作符在流上接管道。你可以把它想成一条传送带：值还没到，但加工规则可以先装好；等有人订阅，整条线才启动。

Nest 为什么用它？handler 的返回值不一定是单个值：普通接口是一个对象，SSE（服务器推送）会持续推消息，WebSocket 可能一次返回多条。把返回值统一看成流，拦截器就能用同一套写法做包装、超时、重试和错误转换，而不用为每种返回类型写分支。代价是签名里多了一层 `Observable`，不熟悉流式写法的人第一次看会绕。

**拦截器（interceptor）**是包在 handler 外面的 AOP（面向切面编程）组件：它拿得到“这次命中了哪个方法”（`ExecutionContext`），也拿得到继续执行 handler 的开关（`CallHandler`）。`next.handle()` 返回的就是那个流；你在流上挂操作符，等于在 handler 返回之后、响应发出之前插一段逻辑。没有它行不行？能跑，但统一响应、超时、缓存这些横跨所有 handler 的规则，只能复制到每个 Controller 里。

官方文档（先看懂正文再点）：
- [Observable](https://rxjs.dev/guide/observable)：流是什么、为什么订阅后才开始跑，对应开头“传送带”那个比喻。
- [Operators](https://rxjs.dev/guide/operators)：`map`、`tap`、`catchError` 怎么串起来，对应后面两段改造。
- [Interceptors](https://docs.nestjs.com/interceptors)：官方的 `CallHandler` 与 `next.handle()`，对应“拦截器接的是 handler 的返回值”。

现在看一个真实事故。

周五傍晚，前端在群里发来一张截图：同一个列表页，调 `/api/rooms` 拿到的是裸数组，调 `/api/bookings` 拿到的是 `{ items, meta }`，到了统计接口又变成 `{ data: ... }`。他们只好写了一个 `const list = res.data ?? res.items ?? res` 的兼容函数，每接一个接口就补一层。

另一件事更急。数据库连接池打满的那几分钟，`GET /api/bookings` 一直挂着，浏览器转圈到 30 秒，网关先返回了 504。用户以为按钮没点，又点了一次，等连接池恢复，重复预订就来了。

这两个问题都不该由每个 Controller 自己解决。响应长什么样、一次请求最多等多久，是横跨所有 handler 的规则。复制到几十个方法里，改一次就要动几十处。拦截器就是 Nest 留给这层规则的位置：它包在 handler 外面，拿得到 `ExecutionContext`，也拿得到 handler 的返回值。

它和中间件不是一回事。中间件在路由匹配之前执行，只看得到原始请求；拦截器在 handler 前后执行，能拿到“最终命中了哪个方法”，还能改写返回给客户端的数据。代价是你得接受它用 RxJS 的 `Observable` 组织，而不是直接返回一个值。

## 拦截器接的是 handler 的返回值

一个拦截器就是一个带 `@Injectable()`、实现 `NestInterceptor` 的类，必须实现 `intercept()`：

```ts
intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>
```

`next.handle()` 是“继续往下走，执行 handler”的开关。它返回一个 `Observable`，handler 的返回值会从这个流里出来；你在流上挂操作符，等于在 handler 返回之后、响应发出之前插一段逻辑。如果 `intercept()` 里根本没调用 `next.handle()`，handler 一次都不会执行——这是实现缓存拦截器时常用的技巧，也是忘记调用时接口“莫名其妙返回空”的原因。

多个拦截器叠在一起时是洋葱模型：先注册的在外层，它的前置代码最先执行，它的 `map` 最后执行。图 18-1 里 `ResponseInterceptor` 在外、`TimeoutInterceptor` 在内，所以超时只包住 handler，不会把外层包装响应的耗时也算进去。

> **图 18-1** 两个拦截器套在 handler 外面的执行顺序。

```mermaid
flowchart LR
  A["请求"] --> B["ResponseInterceptor<br/>进入"]
  B --> C["TimeoutInterceptor<br/>启动 3s 计时"]
  C --> D["Handler"]
  D --> E["TimeoutInterceptor<br/>取消计时"]
  E --> F["ResponseInterceptor<br/>map 成 { data }"]
  F --> G["响应"]
  D -. "TimeoutError" .-> H["catchError<br/>转 408"]
  H -.-> I["ExceptionFilter"]
```

## 先把 Observable 这件事说清楚

RxJS 是 JavaScript 的响应式流库，核心抽象是 `Observable`：一段未来会推送零到多个值的序列。它可以像数组一样被 `map`、`filter`，也可以被 `catchError` 接管错误。这里的 `.pipe()` 只是把操作符串起来，和 Nest 的 Pipe 组件同名不同物，后者第 19 章讲。

关键性质是**冷的**：定义 `next.handle().pipe(map(...))` 只是把管道搭好，不会执行 handler；只有被订阅时，整条流才开始跑。Nest 在拿到 `intercept()` 的返回值后负责订阅，所以你要做的是“组装管道”，不是“启动管道”。在拦截器里手动 `subscribe()`，等于自己启动了第一次，Nest 再订阅一次，handler 就会执行两遍，日志也会出现两行。

这一章只需要五个操作符：

| 操作符 | 作用 | 什么时候用 |
| --- | --- | --- |
| `map` | 把流里的值换成另一个值 | 包装响应、裁剪字段 |
| `tap` | 看一眼值，不改变它 | 记日志、打点 |
| `catchError` | 捕获错误，换一条流继续 | 把底层错误翻译成 HTTP 异常 |
| `timeout` | 超过时限没发出值就报错 | 给 handler 设上限 |
| `finalize` | 成功、失败、取消都执行 | 清理计时器、关闭连接 |

`tap` 的 `next` 回调只在成功时触发，handler 抛错时不会进去。要在错误路径也执行，用 `finalize`，或者给 `tap` 传一个带 `error` 回调的观察者对象。

## 第一步：把成功响应收成一种形状

打开 `meeting-booking` 的 `src/common/interceptors/response.interceptor.ts`，参考实现里已经有这一版：

```ts
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { PageMeta } from '../dto/paginated.dto.js';

export interface ApiResponse<T> {
  data: T;
  meta?: PageMeta;
}

interface PaginatedPayload {
  items: unknown[];
  meta: PageMeta;
}

const isPaginatedPayload = (value: unknown): value is PaginatedPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<PaginatedPayload>;
  return (
    Array.isArray(candidate.items) &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null
  );
};

@Injectable()
export class ResponseInterceptor
  implements NestInterceptor<unknown, ApiResponse<unknown>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<unknown>> {
    return next.handle().pipe(
      map((payload: unknown) => {
        if (isPaginatedPayload(payload)) {
          return { data: payload.items, meta: payload.meta };
        }

        return { data: payload };
      }),
    );
  }
}
```

`map` 的回调接收 handler 的返回值。普通接口直接包成 `{ data }`；分页接口的 service 返回 `{ items, meta }`，这里把它拆成 `{ data: items, meta }`。类型守卫 `isPaginatedPayload` 不是装饰，它让“分页”和“普通对象”在运行时也能区分——只靠 `typeof payload === 'object'` 会把任何对象都当成可分页数据。

拦截器写完后，用 `APP_INTERCEPTOR` 注册成全局拦截器：

```ts
// src/app.module.ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

@Module({
  // 其余 imports/providers 省略
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
})
export class AppModule {}
```

`useClass` 让 Nest 通过容器创建实例，拦截器就能注入 `ConfigService`、`Logger` 这类 Provider。对比 `app.useGlobalInterceptors(new ResponseInterceptor())`：后者也能生效，但实例是你在模块外 `new` 的，注入不进去，测试时也不好替换。

跑起来看两个接口。下面的响应是示例输出，未在本地起服务实测：

```bash
curl -s http://localhost:3000/api/health | jq
```

```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-11-06T18:42:07.318Z",
    "uptime": 37
  }
}
```

再看不带 token 的预订列表：

```bash
curl -s http://localhost:3000/api/bookings | jq
```

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "requestId": "d3a91f0c-7b52-4e18-9a64-1f0c8b2d7e51"
}
```

成功响应被包成了 `{ data }`，401 没有。这不是漏了：错误走的是异常过滤器那条路，`map` 只处理成功值，抛出的异常不会经过它。错误结构该由异常过滤器统一，硬把 401 也包成 `{ data }`，前端反而要多判断一层。异常过滤器在第 21 章细讲。

还有一种情况会让包装失效：handler 用了 `@Res()` 自己 `res.json()`。此时 Nest 把响应控制权交给了你，拦截器改不了已经写出去的响应。要么改用 `@Res({ passthrough: true })`，让 Nest 继续处理返回值；要么别用 `@Res()`。

## 第二步：给 handler 加一条时间上限

超时不能靠 `setTimeout` 加一个 `res.end()`。那样只是让客户端早点断开，handler 还在跑，数据库连接也不会释放。RxJS 的 `timeout` 至少会取消订阅，让上游知道没人要结果了：

```ts
// src/common/interceptors/timeout.interceptor.ts
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  TimeoutError,
  catchError,
  throwError,
  timeout,
  type Observable,
} from 'rxjs';

const HANDLER_TIMEOUT_MS = 3000;

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      timeout({ each: HANDLER_TIMEOUT_MS }),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException('处理超时，请稍后重试'),
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
```

`timeout({ each: 3000 })` 的语义是“距离上一次发出值超过 3 秒就报错”。普通 JSON 接口只发一次值，所以它等于给 handler 设了 3 秒上限；如果拿它包 SSE，`each` 限制的是两条消息之间的最大间隔，不是总时长。要分别限制首字节和后续间隔，写 `timeout({ first: 1000, each: 3000 })`。

`catchError` 里最后那行 `return throwError(() => error)` 是整段代码最贵的一行。少了它，404、400、数据库错误会全部变成 408，前端会以为所有失败都是超时。只有 `error instanceof TimeoutError` 时才翻译，其余原样抛回给异常过滤器。

把它注册在 `ResponseInterceptor` 后面：

```ts
providers: [
  { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
],
```

先注册的在外层。响应包装在外，超时在内，超时预算只覆盖 handler，不覆盖后面的序列化。

## 跑起来，看 408 和 404 的分界

在 `AppController` 里临时加两个公开路由，一个慢、一个抛 404：

```ts
import { NotFoundException } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';

@Public()
@Get('slow')
async slow(): Promise<{ finishedAt: string }> {
  await delay(5000);
  return { finishedAt: new Date().toISOString() };
}

@Public()
@Get('missing')
async missing(): Promise<never> {
  await delay(50);
  throw new NotFoundException('这条记录不存在');
}
```

先请求慢接口：

```bash
curl -s -o /tmp/slow-18.json -w '%{http_code} %{time_total}\n' \
  http://localhost:3000/api/slow
```

```text
408 3.004
```

```bash
python3 -m json.tool /tmp/slow-18.json
```

```json
{
  "statusCode": 408,
  "message": "处理超时，请稍后重试",
  "error": "Request Timeout",
  "requestId": "6c1d0a3e-5b74-4f92-8e10-7a3c9d5b2f68"
}
```

3 秒左右返回，不是 5 秒；多出来的几毫秒是连接和序列化。再请求会抛 404 的接口：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/missing
```

```text
404
```

404 没有被改写成 408，说明 `catchError` 的分支判断生效了。如果这里也返回 408，先检查 `TimeoutError` 是不是从 `rxjs` 导入的——从别的路径导入会导致 `instanceof` 判断失败，然后检查 `catchError` 里是不是漏了原样抛回。

超时响应同样不会被包成 `{ data }`。它走的是异常过滤器，结构是 `{ statusCode, message, error, requestId }`，和 401 一致。成功和失败各用一种结构，前端只需要判断 HTTP 状态码，不需要在成功结构里再找 `error` 字段。

验证完把 `slow` 和 `missing` 两个路由删掉。它们只是用来确认边界的，留在生产代码里没有意义。

## 拦截器的三种挂法

- **方法级**：`@UseInterceptors(LoggingInterceptor)` 写在 handler 上，只影响这一个方法。
- **控制器级**：写在 Controller 类上，影响这个控制器下的所有 handler。
- **全局**：`APP_INTERCEPTOR` 或 `app.useGlobalInterceptors()`。前者能注入依赖，后者不能，项目里优先用前者。

方法级适合一次性逻辑，比如某个导出接口要禁用缓存；全局适合响应包装、超时这种所有接口都要的规则。不要把业务判断塞进全局拦截器，再靠 URL 前缀区分——那会把全局拦截器变成第二个路由表。

## 生产里真正会踩的坑

| 现象 | 原因 | 怎么处理 |
| --- | --- | --- |
| 接口一直不返回，也没有日志 | `intercept` 忘了 `return next.handle()`，或返回了裸值 | 必须返回 Observable；先确认 `next.handle()` 被调用 |
| handler 执行两次，日志重复 | 拦截器里手动 `subscribe()`，Nest 又订阅了一次 | 只组装管道，订阅交给框架 |
| 所有 404 都变成 408 | `catchError` 没有区分错误类型 | 用 `instanceof TimeoutError` 判断，其余原样抛 |
| 返回值没被包装 | handler 用了 `@Res()` 自己发送响应 | 改用 `@Res({ passthrough: true })`，或去掉手动发送 |
| 超时后数据库还在执行 | `timeout` 只取消订阅，不会自动回滚下游 | 把 `AbortSignal` 传进 `fetch`/驱动，在事务层处理取消 |
| SSE 连接几秒就断 | 把 `each` 当成总时长用 | 流式接口用 `each` 限制消息间隔，用 `first` 单独限制首字节 |
| 拦截器顺序和预期相反 | 先注册的在外层，`map` 最后执行 | 用洋葱模型推一遍；全局拦截器别堆太多层 |
| 所有 Controller 都变成请求作用域 | 全局拦截器注入了 `REQUEST` 作用域的 Provider | 能从 `ExecutionContext` 拿的请求数据就别注入 |

还有两个边界，排障时很容易忽略：

- **408 的语义并不完美**。HTTP 里的 408 原本表示“服务端等客户端发送请求超时”，不是“handler 执行超时”。应用内部用 408 很常见，但前面有网关时，网关更常用 504 表示上游超时。选一个，在错误码文档里写清楚，别让前端同时猜 408 和 504。
- **`timeout` 不会自动把取消信号传下去**。它只是不再等结果；handler 里的 Promise、数据库查询、下游 HTTP 请求仍在跑。生产里要把 `AbortSignal` 从请求一路传到这些调用，否则超时只是把问题从客户端挪到了服务端。

响应结构收口之后，入口还有一个更隐蔽的问题：`@Param('id') id: number` 这句类型标注在运行时完全不存在，`id` 仍然是字符串。下一章从这个问题开始，把内置 `Parse*` 管道和自定义管道拆开讲清楚。

想更深入的话，官方文档里有这几页可以接着看：[Interceptors](https://docs.nestjs.com/interceptors)（官方拦截器的三种挂法和 `CallHandler` 用法，对照超时那段）、[Operators](https://rxjs.dev/guide/operators)（RxJS 操作符总览，对应把响应包成统一形状的写法）、[timeout](https://rxjs.dev/api/operators/timeout)（`timeout` 接受什么参数、抛什么错误，对应 408 从哪来）。

<!-- chapter-nav:start -->
---

← 上一篇：[017 Nest的Middleware](017-Nest的Middleware.md) · [本 Part 目录](_part.md) · 下一篇：[019 内置Pipe和自定义Pipe](019-内置Pipe和自定义Pipe.md) →
<!-- chapter-nav:end -->
