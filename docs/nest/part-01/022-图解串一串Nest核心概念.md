# 第 22 章 图解串一串 Nest 核心概念

同一个请求里的用户查询，在 `TraceGuard` 里做了一次，在 `TraceInterceptor` 里又做了一次。看一条 403 的日志会发现：`1 middleware`、`7 filter` 都在，`3 interceptor before` 根本没出现——被守卫拒绝的请求走不到拦截器。所以在拦截器里查用户，403 时就是白查。

Middleware、Guard、Interceptor、Pipe、ExceptionFilter 单独看都不难，难的是它们在一条请求里谁先谁后、谁把后面的步骤短路掉、异常又从哪条路返回。

先把这五样东西干的事说清楚：它们都不写业务，只负责给业务代码排一条固定通道——请求从哪进、进门前查什么、参数变成什么、返回值包成什么、出错往哪送。通道定好了，Controller 里才只剩业务本身。

这一章不背定义，直接跑一条带编号的 trace，让日志自己把顺序打出来；跑完再回头看分层，哪个词该待在哪一层就清楚了。

## 开机摆一次桌，之后每桌重走一遍

Nest 里很多困惑，来自把“启动时”和“请求时”当成一回事。其实这是两条独立的时间线，像开餐馆：

- **开店前只做一次**：摆桌椅、定菜单、招人。对应 Nest 启动：扫描模块树，实例化 Provider，解决依赖，登记 `method + path → handler`，再把中间件、守卫、拦截器、管道、过滤器挂到对应路由上。
- **每来一桌客人重走一遍**：迎宾、验预约、点单、后厨、上菜。对应每个请求：适配器收包，中间件，路由匹配，守卫，拦截器前半段，管道，handler，拦截器后半段，响应；哪一步抛错，就拐进异常过滤器。

这个区别有个很实际的后果：**Provider 默认在启动时就 new 好了，构造函数执行时还没有任何请求**。所以构造函数里注入不到当前请求，也读不到当前用户。要请求数据，得从 `ExecutionContext`（第 11 章）或 `ArgumentsHost`（第 11 章、第 21 章）里取——这也是守卫、拦截器、过滤器能读到 header、用户、路由 metadata 的原因。

没分清会卡在哪？很常见的两种：在构造函数里想拿当前请求（单例 Provider 里根本还没有请求这回事，硬拿只能拿到空值，或者被迫把整个 Provider 改成 `Scope.REQUEST`）；或者把“当前用户”存进单例 Provider 的实例字段，两个请求同时进来互相串数据。前者是时间线搞错，后者是把单例当成了每请求一份。

```mermaid
flowchart TB
  subgraph S["启动时（一次）"]
    A["扫描模块树"] --> B["实例化 Provider<br/>解决依赖"] --> C["注册路由<br/>method + path → handler"] --> D["绑定增强器"]
  end
  subgraph R["请求时（每次）"]
    E["HTTP 适配器"] --> F["1 Middleware"] --> G{"路由匹配"} --> H["2 Guard"] --> I["3 Interceptor<br/>before"] --> J["4 Pipe"] --> K["5 Handler"] --> L["6 Interceptor<br/>after"] --> M["响应"]
    G -->|未命中| N["7 ExceptionFilter<br/>404"]
    F -. 抛错 .-> N
    H -. 抛错 .-> N
    J -. 抛错 .-> N
    K -. 抛错 .-> N
  end
  D -.-> E
```

图 22-1 启动时装配与请求时执行，以及五类组件在请求链上的位置。

两个顺序最容易记反：

**守卫在管道之前**。这像进演唱会：先验票，再安检。没票的人不该先被搜一遍包；对应到代码，未登录、无权限的请求不该先做一轮参数校验，否则白花 CPU，还可能借校验错误把字段规则泄露给不该看的人。所以 403 的日志里没有 `4 pipe`。

**拦截器的“前半段”在管道之前，“后半段”在 handler 之后**。它像包住 handler 的两片面包：`next.handle()` 之前的代码先跑，之后的代码等 handler 返回了再跑。因此拦截器能统计到包含参数校验在内的总耗时；`map`/`tap` 改的是 handler 返回之后的值。管道失败时，`catchError` 能看见错误，但 handler 根本不会执行。

## 五道岗，手里攥的东西不一样

按请求经过的顺序，一个个说它们是干什么的、没它会怎样：

- **中间件**是写字楼门口的闸机（第 17 章）：所有人先刷卡进楼，但它不知道你上去找谁。没有它，日志、CORS、body 解析这些“进门就该做”的事得散在几十个路由里。
- **守卫**是前台查预约（第 9 章那张表里排在第 2 位）：它知道你要去哪个房间（路由 metadata），能决定放不放行。没有它，每个 handler 开头都得自己写一遍“登录了没、有权限没”。
- **拦截器**是包在 handler 外面的夹层（第 18 章）：进去之前垫一句，出来之后补一句。没有它，统计耗时、统一包装返回值得在每个 handler 里重复。
- **管道**是安检机（第 19 章）：只管“这个东西能不能带进去、要不要换个形态”，一次处理一个参数。没有它，`@Body()` 拿到的是随便什么形状的 JSON，类型标注只是写给编辑器看的。
- **异常过滤器**是整栋楼的排水口（第 21 章）：哪一层漏水最后都从这儿出去。没有它，404、400、500 会各长各的样子，客户端要写好几套解析。

它们各自能拿到什么，直接决定了能干什么：

| 组件 | 拿到的上下文 | 能做什么 | 不能做什么 |
| --- | --- | --- | --- |
| Middleware | 原始 `req`、`res`、`next` | 改请求头、日志、CORS、body 解析 | 不知道 handler、拿不到路由 metadata |
| Guard | `ExecutionContext`、`Reflector` | 读 metadata、查用户、短路请求 | 改响应体、包装 handler |
| Interceptor | `ExecutionContext`、`CallHandler` | 包裹 handler、改返回值、超时、缓存 | 不知道参数的校验结果 |
| Pipe | `value`、`ArgumentMetadata` | 转换、校验单个参数 | 访问 handler 的业务结果 |
| ExceptionFilter | `exception`、`ArgumentsHost` | 改写错误响应、记录日志 | 恢复业务、重试 |

一句话：**手里有什么，决定你能干什么**。想在中间件里读 `@Roles()`，或者在管道里查数据库判断权限，不是写不出来，是选错了层——拿不到就是拿不到，硬塞只能靠全局变量。

同类组件有多个时，顺序按“范围从大到小”：守卫和拦截器是全局 → 控制器 → 方法；管道是全局 → 控制器 → 方法 → 参数；过滤器只执行第一个匹配的（第 21 章）。拦截器的“大”体现在外层：先注册的包住后注册的，前半段先执行，后半段逆序执行。

## 数据一路换了四次衣服

同一个人，进公司刷工牌、在工位上是员工、报销单上是一行身份证号、对外名片上是头衔。数据也一样，从网络进来到落进数据库，形状换了好几次：

```mermaid
flowchart LR
  C["客户端"] -->|"JSON body"| D["DTO<br/>CreateBookingDto"]
  D --> P["Pipe<br/>校验并转成实例"]
  P --> CT["Controller<br/>取参、调 Service"]
  CT --> S["Service<br/>业务规则"]
  S --> R["Repository / DAO<br/>查询条件"]
  R --> DB[("PostgreSQL<br/>bookings / rooms / users")]
  DB --> PO["PO / Row<br/>BookingRow"]
  PO --> M["Mapper<br/>裁剪、拼关联"]
  M --> VO["VO<br/>响应形状"]
  VO --> CT
  CT --> OUT["响应 JSON"]
```

图 22-2 一次创建预订的调用穿过各层时，数据形状怎么变。

几个词最容易混，放在一起对照：

| 词 | 一句话 | 在 example 里 |
| --- | --- | --- |
| Controller | HTTP 入口，取参、调 Service、交响应 | `src/modules/*/*.controller.ts` |
| Service | 业务规则与流程编排，不认识 HTTP | `src/modules/*/*.service.ts` |
| Provider | 交给 IoC 容器管理的类或值的统称 | 任何 `@Injectable()`；`PRISMA` token |
| DTO | 跨层传数据的载体，不带业务逻辑 | `src/modules/*/dto/*.dto.ts` |
| Entity / PO | 领域对象 / 与表一一对应的行对象 | `Booking` 概念；`BookingRow` |
| VO | 值对象，或给某端消费的裁剪结果 | `PaginatedResult<T>`、`AuthUser` |
| Repository / DAO | 面向聚合根 / 面向表的持久化抽象 | 暂未单独抽，直接用 Prisma 客户端 |
| Mapper | 在以上形状之间搬字段的代码 | `paginate()`、`ResponseInterceptor` |

表里有两个词要补一句。**聚合根**是领域驱动设计里“作为一个整体来改的根对象”：一张订单和它的明细是一个整体，不能只改订单不改明细，Repository 通常围着它建。**Prisma** 是第 44 章要讲的 ORM（对象关系映射）工具，现在先把它当成直接操作数据库的客户端。

顺带把最容易和 Service 混的两个也说清：**Repository** 是仓库管理员，你告诉它要哪批货，它不关心这批货最后摆成什么盘；**Mapper** 是分拣工，把从仓库取出来的原箱拆成给客人看的样子。Service 决定“要不要取、取来干什么”，Repository 只管“怎么取”，Mapper 只管“怎么换形状”。

判断 Controller 和 Service 的标准很硬：**这段代码需不需要 HTTP 才能成立**。要 `@Body()`、`@Param()`、`@Res()`，要拼状态码，它在 Controller；只吃普通参数、只吐普通对象，它在 Service。Service 里出现 `Request`、`Response` 或任何 HTTP 装饰器，就是越界了。同一条“创建预订”的规则，将来要被定时任务、CLI、消息消费者复用，那些入口都没有 HTTP 请求对象。

DTO 和 Entity/PO 的区别在方向：DTO 面向接口契约，字段可以裁剪、组合、改名；PO 面向表，字段跟列一一对应。方向搞反的代价很具体——拿 PO 直接当响应，`users` 表加一列密码哈希，接口就多泄露一个字段；拿请求 DTO 当响应，客户端传的 `isAdmin` 会原样回来。另外 DTO 必须是 `class` 而不是 `interface`，因为 `ValidationPipe`（第 20 章）要靠运行时还存在的类找规则，`interface` 编译后会被擦成 `Object`。

Service 和 Provider 也不是一回事：Service 是**角色**，Provider 是**容器概念**。像公司花名册——不管你是开发、保安还是外包，只要挂在册子上就都算员工。`@Injectable()` 标记的类进 IoC 容器，容器里托管的一切都叫 Provider：Service、Guard、Repository、工厂都是。`{ provide: PRISMA, useValue: db }` 也在这本册子上，但它不是 Service，连类都不是。

VO 在中文技术圈有两个来源：领域驱动里的 Value Object 没有唯一标识、以值相等判断；分层里的 View Object 是为某一端裁剪的返回结构。example 里后者更多：`ResponseInterceptor` 包 `{ data, meta }`，`AuthUser` 是认证后的视图。判断方法：**这个类型有没有业务不变量**。有，它是值对象或实体；没有，只是为了“让某一端好消费”，它是视图对象。

## 把五层写进一个 trace.ts

```bash
pnpm dlx @nestjs/cli@12 new trace-lab --package-manager pnpm --strict --skip-git
```

CLI 问模块系统时选 **ESM**，相对导入带 `.js`。这一章不装新依赖，用 Nest 自带的 `Logger`。

```ts
// src/trace/trace.ts
import {
  ArgumentsHost,
  BadRequestException,
  CallHandler,
  CanActivate,
  Catch,
  Controller,
  DefaultValuePipe,
  ExceptionFilter,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpException,
  Injectable,
  Logger,
  NestMiddleware,
  NestInterceptor,
  PipeTransform,
  Query,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

const logger = new Logger('Trace');

@Injectable()
export class TraceMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    logger.log(`1 middleware ${req.method} ${req.originalUrl}`);
    next();
  }
}

@Injectable()
export class TraceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    logger.log(`2 guard ${request.method} ${request.originalUrl}`);
    if (request.header('x-trace-block') === '1') {
      throw new ForbiddenException('trace blocked');
    }
    return true;
  }
}

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    logger.log(`3 interceptor before ${request.originalUrl}`);
    return next.handle().pipe(
      tap(() => logger.log(`6 interceptor after ${request.originalUrl}`)),
      catchError((error: unknown) => {
        logger.warn(`6 interceptor error ${request.originalUrl}`);
        return throwError(() => error);
      }),
    );
  }
}

@Injectable()
export class TracePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    logger.log(`4 pipe ${value}`);
    if (value === 'blocked') {
      throw new BadRequestException('name is blocked');
    }
    return value.trim();
  }
}

@Catch()
export class TraceFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const message = exception instanceof HttpException ? exception.message : 'Internal server error';
    logger.warn(`7 filter ${status}`);
    this.adapterHost.httpAdapter.reply(ctx.getResponse(), { statusCode: status, message }, status);
  }
}

@Controller('trace')
export class TraceController {
  @Get('ok')
  ok(@Query('name', new DefaultValuePipe('guest'), TracePipe) name: string): { name: string } {
    logger.log('5 handler ok');
    return { name };
  }

  @Get('fail')
  fail(): never {
    logger.log('5 handler fail');
    throw new Error('demo failure');
  }
}
```

几个刻意的写法：

- **中间件用 `req.originalUrl`**，不是 `req.url`。后者在挂载点下可能被裁剪，带不上全局前缀 `/api`。
- **守卫抛 `ForbiddenException`**，不是直接 `return false`。两者都能短路，但抛异常能带消息，也会进入统一过滤器（第 21 章的出口）。
- **拦截器用 `tap` 记成功、`catchError` 记失败**。`tap` 只在 `next` 正常时执行；错误路径由 `catchError` 接管，所以 `6` 有两种形态。
- **管道只挂在 `@Query('name')` 上**。全局管道会作用到每个参数，反而看不清编号。

## 注册：全局的归全局，具体的归具体

```ts
// src/app.module.ts
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
  TraceController,
  TraceFilter,
  TraceGuard,
  TraceInterceptor,
  TraceMiddleware,
} from './trace/trace.js';

@Module({
  controllers: [TraceController],
  providers: [
    { provide: APP_GUARD, useClass: TraceGuard },
    { provide: APP_INTERCEPTOR, useClass: TraceInterceptor },
    { provide: APP_FILTER, useClass: TraceFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes(
      { path: 'trace/ok', method: RequestMethod.GET },
      { path: 'trace/fail', method: RequestMethod.GET },
    );
  }
}
```

`APP_GUARD`、`APP_INTERCEPTOR`、`APP_FILTER` 是全局增强器，`TracePipe` 只挂在参数上。中间件这里绑的是两个具体路由。`main.ts` 照旧 `app.setGlobalPrefix('api')`、监听 3000。

中间件的绑定范围值得单独说：`forRoutes(TraceController)` 不是“这个控制器下面的前缀通配”。Nest 会扫描该控制器的每个 handler，逐条展开成 `trace/ok`、`trace/fail`，所以 `/api/trace/nope` 同样不会执行 `1`。只有 `forRoutes('*splat')` 这类通配符，才能让 404 也先经过中间件。

## 跑五条路径，让日志自己对号

```bash
pnpm start:dev

curl -s 'http://localhost:3000/api/trace/ok?name=alice'
# 200 {"name":"alice"}

curl -s 'http://localhost:3000/api/trace/ok?name=blocked'
# 400 {"statusCode":400,"message":"name is blocked"}

curl -s 'http://localhost:3000/api/trace/fail'
# 500 {"statusCode":500,"message":"Internal server error"}

curl -s -H 'x-trace-block: 1' 'http://localhost:3000/api/trace/ok?name=alice'
# 403 {"statusCode":403,"message":"trace blocked"}

curl -s 'http://localhost:3000/api/trace/nope'
# 404 {"statusCode":404,"message":"Cannot GET /api/trace/nope"}
```

终端日志是五种序列（省略 Nest 的日志前缀）：

```text
# 成功
1 middleware GET /api/trace/ok?name=alice
2 guard GET /api/trace/ok?name=alice
3 interceptor before /api/trace/ok?name=alice
4 pipe alice
5 handler ok
6 interceptor after /api/trace/ok?name=alice

# 管道失败
1 middleware ...
2 guard ...
3 interceptor before ...
4 pipe blocked
6 interceptor error ...
7 filter 400

# handler 抛错
1 middleware ...
2 guard ...
3 interceptor before ...
4 pipe alice
5 handler fail
6 interceptor error ...
7 filter 500

# 守卫拒绝
1 middleware ...
2 guard ...
7 filter 403

# 路由不存在
7 filter 404
```

> 示例输出（未实测）。trace-lab 的过滤器只保留 `statusCode` 和 `message`，重点在顺序；真实项目用第 21 章那份完整契约。

管道失败和 handler 抛错都会打 `6 interceptor error`，区别在前者没有 `5`、后者有；守卫拒绝连 `3` 都没有。**不是每个请求都会经过每一层**，这就是短路——前面一道岗摆手，后面的人根本不知道有人来过。

| 路径 | 已执行 | 未执行 | 响应 |
| --- | --- | --- | --- |
| 正常 | 1 → 2 → 3 → 4 → 5 → 6 | — | 200 |
| 守卫拒绝 | 1 → 2 → 7 | 3、4、5、6 | 403 |
| 管道失败 | 1 → 2 → 3 → 4 → 6(error) → 7 | 5 | 400 |
| handler 抛错 | 1 → 2 → 3 → 4 → 5 → 6(error) → 7 | — | 500 |
| 路由不存在 | 7（当前绑定下 1–6 全未执行） | 1–6 | 404 |

`6(error)` 是拦截器的 `catchError` 分支，不是 `tap` 的成功分支。它执行完会把错误继续抛出去，所以后面还有 `7`。

把中间件改成 `forRoutes('*splat')`，404 会多一行 `1 middleware`，但 `2–6` 仍然不会执行。**中间件的绑定范围只决定 `1` 出不出现，不决定守卫、拦截器、管道是否执行**；后面那些由路由有没有命中决定。

## 生产里真正会踩的坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 守卫里拿不到 `request.user` | 认证中间件还没执行，或守卫顺序不对 | 认证放中间件/守卫链前；守卫只读已挂载的用户 |
| 鉴权没执行，管道却已校验参数 | 守卫没有全局注册，或被路由排除 | 检查 `APP_GUARD` / `@UseGuards()` 的绑定范围 |
| 拦截器里 `next.handle()` 没执行 | 提前 `return of(cached)` 或忘记返回 | 明确缓存命中与正常路径的分支 |
| 404 返回框架默认结构 | 全局过滤器没注册，或只挂在控制器/方法上 | 用 `APP_FILTER` 兜底 |
| 过滤器拿到的 `response` 已发送 | 用了 `@Res()` 并手动 `json()` | 检查 `isHeadersSent`，或统一用 `passthrough` |
| 全局管道把 `@Req()` 也校验了 | 全局管道作用于所有参数 | 用参数级管道，或自定义装饰器 + `validateCustomDecorators` |
| 拦截器顺序与预期相反 | 先注册的在外层，后半段逆序执行 | 按洋葱模型推一遍，只保留必要的全局拦截器 |
| 以为 404 不会跑中间件 | 当前只绑了具体路由；`forRoutes(TraceController)` 同样展开为精确路由 | 要覆盖 404，用 `forRoutes('*splat')` |
| 中间件抛错没被方法级过滤器接住 | 方法级/控制器级过滤器不覆盖中间件 | 用全局 `APP_FILTER` |
| Service 里出现 `@Req()`、`Request` 类型 | HTTP 上下文漏进了业务层 | Controller 取参后传普通值，Service 只认 DTO 和领域类型 |

几条边界，越早定越好：

- **全局增强器要有清单**。`APP_GUARD`、`APP_INTERCEPTOR`、`APP_PIPE`、`APP_FILTER` 分散在各模块时，新人很难还原执行顺序。集中注册，或维护一张表。
- **性能开销在全局层被放大**。全局守卫每请求一次鉴权查询、全局管道每参数一次校验、全局拦截器每响应一次序列化，都会随 QPS（每秒查询数）放大。热点路径用缓存、采样和逃生口。
- **可观测性只做一次**。请求 ID 在中间件生成，异常过滤器带出，日志里贯穿；不要在五层各生成一个 ID，否则链路对不上。
- **选层看上下文，不看习惯**。需要原始 socket/headers 用中间件；需要用户身份与路由 metadata 用守卫；需要包裹返回值或统计 handler 耗时用拦截器；需要参数格式用管道；需要统一错误用过滤器。

跑通这条 trace 之后，再遇到“这个逻辑放哪”的问题，先问它需要什么上下文，而不是先找拦截器。分层解决“写在哪”，图 22-1 这条链路解决“什么时候执行”，两个维度合起来，一个需求落到代码里就有位置了。

下一部分进入数据持久化与鉴权：守卫做 JWT（JSON Web Token，登录令牌）校验，拦截器做响应脱敏，过滤器兜住数据库异常——三件事都能在图 22-1 上找到自己的位置。


<!-- chapter-nav:start -->
---

← 上一篇：[021 如何自定义ExceptionFilter](021-如何自定义ExceptionFilter.md) · [本 Part 目录](_part.md) · 下一篇：[023 Express如何使用multer实现文件上传](023-Express如何使用multer实现文件上传.md) →
<!-- chapter-nav:end -->
