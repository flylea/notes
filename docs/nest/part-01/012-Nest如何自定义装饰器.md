# 第 12 章 Nest 如何自定义装饰器

## 先弄懂：装饰器到底是什么

**装饰器（decorator）**是 TypeScript 的一个语法特性：一个函数，用 `@` 贴在类、方法、参数或属性前面，在类定义阶段就被调用。它本身不承载业务逻辑：方法/类装饰器通常只把一段信息（也就是第 13 章要讲的元数据）写到目标上，参数装饰器则留下一个“这个参数从哪来”的解析函数。你天天用的 `@Controller('/bookings')`、`@Get('mine')`、`@Body()` 都是装饰器，只是写的人不同。

Nest 的整套声明式写法就建立在三件东西上：TypeScript 装饰器负责“写”，元数据负责“存”，反射负责“运行时读”。第 10 章已经按作用对象把装饰器分成六组，这里只收回一句：装饰器是声明，真正干活的是读它的人——路由装饰器由启动时的扫描器读，参数装饰器由请求进入 handler 前的参数解析器读，`@SetMetadata()` 写的东西由守卫或拦截器用 `Reflector`（第 13 章的主角）读。读的人没写，或者读错了位置，装饰器不会报错，只会安静地不生效。

**自定义装饰器**就是框架没提供、你自己写的那些。常见的有两类：参数装饰器换掉参数的来源（比如 `@CurrentUser()` 从 `req.user` 取值，替代每个 handler 手写 `@Req()`），方法或类装饰器把多个声明打包（比如 `@Audited()` 同时写元数据、挂拦截器）。没有它行不行？能跑，但同一段取值逻辑会抄进每个 handler，字段一改名就漏掉一片——这正是下面这个事故的来路。

官方文档（先看懂正文再点）：
- [Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)：装饰器就是贴在类或方法前、在类定义那一刻执行的函数，对应开头“装饰器到底是什么”整段。
- [emitDecoratorMetadata](https://www.typescriptlang.org/tsconfig/#emitDecoratorMetadata)：打开后编译器会把参数类型也存成元数据，对应“装饰器负责写、元数据负责存”那句。
- [Custom decorators](https://docs.nestjs.com/custom-decorators)：官方给的 `createParamDecorator` 和 `SetMetadata` 示例，对照 `@CurrentUser()` 与 `@Audited()` 两段。

现在看一个真实事故。

上一章末尾留了个尾巴：每个 handler 都要先 `switchToHttp().getRequest()`，再从 `req.user` 里掏字段。真写业务时，更常见的写法是下面这样，还带着一分侥幸——`req.user` 是 Passport（Node 的认证中间件，后面接入登录时会用到）塞进去的，TypeScript 看它是 `any`。

```ts
@Get('mine')
findMine(@Req() req: Request) {
  return this.bookingsService.findMine(req.user.id);
}
```

十几个接口都这么写。后来用户模型把 `id` 改成 `userId`，编译器没吭声，上线后这批接口统一返回空数组，日志里只有 `userId=undefined`。

问题不在改名，在于同一段取值逻辑被抄了十几份。把它收进一个装饰器，handler 就只剩声明：

```ts
@Get('mine')
findMine(@CurrentUser() user: AuthUser) {
  return this.bookingsService.findMine(user.id);
}
```

Nest 内置的 `@Body()`、`@Query()`、`@Param()` 也是这个形状，只是框架替你写好了。

## 先写一个能跑的 @CurrentUser()

**参数装饰器（param decorator）**是挂在 handler 参数前面的 `@Xxx()`，它不参与业务计算，只回答一个问题：这个参数的值从哪里来。`@Body()` 说从请求体来，`@Query('page')` 说从查询串来，我们的 `@CurrentUser()` 说从 `req.user` 来。

自己造一个，用 `createParamDecorator(factory)`：

```ts
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../types/auth-user.js';

interface RequestWithUser {
  user?: AuthUser;
  headers: Record<string, string | undefined>;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();

    // 演示期用请求头冒充登录态；接入 JWT 后删掉这段，只读 request.user
    const user: AuthUser =
      request.user ??
      {
        id: request.headers['x-user-id'] ?? '',
        email: request.headers['x-user-email'] ?? '',
        name: request.headers['x-user-name'] ?? '',
        role: request.headers['x-user-role'] === 'ADMIN' ? 'ADMIN' : 'USER',
      };

    return data === undefined ? user : user[data];
  },
);
```

工厂的两个入参位置固定，名字随便起：第一个是你写在括号里的值，这里叫 `data`；第二个是第 11 章的 `ExecutionContext`。`data` 为 `undefined` 时返回整个用户对象，传 `'email'` 时只返回邮箱。

注意 `request.headers['x-user-id']` 全是小写。Node 在解析请求时已经把请求头名转成了小写，如果你习惯性写成 `request.headers['X-User-Id']`，取到的是 `undefined`，而且不报错——这是自定义取头逻辑最常见的事故来源。

把装饰器挂到控制器上：

```ts
// src/bookings/bookings.controller.ts（节选）
import { Controller, Get, Version } from '@nestjs/common';
import type { AuthUser } from '../common/types/auth-user.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('bookings')
@Version('1')
export class BookingsController {
  @Get('mine')
  findMine(@CurrentUser() user: AuthUser) {
    return { userId: user.id, email: user.email, role: user.role };
  }
}
```

跑起来：

```bash
pnpm start:dev

curl -s http://localhost:3000/api/v1/bookings/mine \
  -H 'x-user-id: 7c9e6679-7425-40de-944b-e07fc1f90ae7' \
  -H 'x-user-email: dev@example.com' \
  -H 'x-user-name: Dev' \
  -H 'x-user-role: USER'
# 示例输出：
# {"userId":"7c9e6679-7425-40de-944b-e07fc1f90ae7","email":"dev@example.com","role":"USER"}
```

把请求头全去掉，返回的是空字符串组成的对象，不是 401。这符合分工：**装饰器只负责取值，认证是 Guard 的事**。真实项目里 `req.user` 由 `JwtAuthGuard` 写入，装饰器那一行兜底代码删掉，`request.user` 为空时应该由守卫提前拒绝，而不是让 handler 拿到一个假用户。

`@Get('mine')` 要写在 `@Get(':id')` 前面。路由按声明顺序匹配，`mine` 先撞上 `:id`，会被 `ParseUUIDPipe` 判成非法 UUID 直接返 400，看起来像装饰器坏了，其实是路由顺序。

## 工厂只在类定义时跑一次

`createParamDecorator` 的工厂不是每个请求执行一次。模块加载时它执行一次，返回一个“取值函数”；之后每个请求进来，Nest 调用的是这个返回值。

```ts
// 只在启动时打印一次，不是每次请求
export const CurrentUser = createParamDecorator((data, ctx) => {
  console.log('factory');
  return ctx.switchToHttp().getRequest().user;
});
```

> **图 12-1** 装饰器在定义期登记，在请求期取值。

```mermaid
flowchart TB
  subgraph DEF["模块加载时，只跑一次"]
    A["@CurrentUser()"] --> B["createParamDecorator 工厂"]
    B --> C["返回取值函数"]
    C --> D["登记进 handler 的参数元数据"]
  end
  subgraph REQ["每次请求"]
    E["路由匹配"] --> F["调用取值函数<br/>读 req.user / req.headers"]
    F --> G["Pipe 校验 schema"]
    G --> H["handler 拿到参数"]
  end
  D -.-> F
```

这条时间线解释了一个高频报错：在装饰器工厂里写 `this.configService.get(...)`，启动就报 `Cannot read properties of undefined`；或者用 `@Inject()` 注入了依赖，拿到的还是 `undefined`。工厂执行时容器还没建好，装饰器也没有实例，`this` 根本不指向任何东西。

**参数装饰器只取数据，不承载依赖。** 需要 `ConfigService`、`Logger`、数据库的逻辑，放进 Guard 或 Interceptor——它们由容器实例化，构造函数注入正常可用。

顺带把 `data` 的类型收紧。`createParamDecorator<keyof AuthUser>` 能让 `@CurrentUser('emial')` 在编译期报错，而不是运行时拿到 `undefined`。但泛型只约束 `data`，返回值签名仍要自己写，别指望它自动收窄成 `string`。

## 取值顺手校验：Nest 12 的 schema 选项

参数装饰器只负责取，值合不合法是 Pipe 的事（第 19 章细讲，这里先知道它专门做校验和转换）。Nest 12 给参数装饰器加了 `schema` 选项，自定义装饰器也支持：传一个 Standard Schema（Zod、Valibot、ArkType 都实现了这套接口），由 `StandardSchemaValidationPipe` 消费。

```bash
pnpm add zod@^4.6.7
```

在 handler 上只取邮箱，并当场校验：

```ts
import { z } from 'zod';

@Get('mine')
findMine(
  @CurrentUser() user: AuthUser,
  @CurrentUser('email', { schema: z.email() }) email: string,
) {
  return { userId: user.id, email, role: user.role };
}
```

`@CurrentUser('email', { schema: z.email() })` 干了两件事：从用户对象里取 `email`，再把 `z.email()` 挂到这个参数的元数据上。注意 `schema` 不会传进工厂，工厂仍然只收到 `'email'`；Nest 把它单独记下来，留给 Pipe。

Pipe 要注册，而且必须打开 `validateCustomDecorators`：

```ts
// src/app.config.ts（在 configureApp 里追加）
import { StandardSchemaValidationPipe, ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, transform: true }),
  new StandardSchemaValidationPipe({ validateCustomDecorators: true }),
);
```

`validateCustomDecorators` 默认是 `false`。这是刻意的：自定义装饰器取出来的可能是对象、数组，甚至不是请求里的东西，默认不校验避免误伤。不打开它，`z.email()` 就是个摆设，`abc` 会一路进到 handler。

重启后发一个非法邮箱：

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/v1/bookings/mine \
  -H 'x-user-id: 7c9e6679-7425-40de-944b-e07fc1f90ae7' \
  -H 'x-user-email: abc'

# 400，响应体（示例输出）：
# {"message":["Invalid email address"],"error":"Bad Request","statusCode":400}
```

这个 400 是 `StandardSchemaValidationPipe` 抛的，不是你手写的。要改错误结构，给它传 `exceptionFactory`；要换状态码，传 `errorHttpStatusCode`。

## 把“写元数据 + 挂拦截器”打包

还有一种重复不在参数上，在方法头上。审计要求每个写接口都记一条“谁在什么时候做了什么”，于是每个 handler 上面都叠着 `@SetMetadata('audit', '...')` 和 `@UseInterceptors(AuditInterceptor)`，改一个动作名要动三行。

`applyDecorators` 可以把多个装饰器合成一个：

```ts
// src/common/audit/audit.constants.ts
export const AUDIT_ACTION = 'audit:action';

// src/common/decorators/audited.decorator.ts
import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { AUDIT_ACTION } from '../audit/audit.constants.js';
import { AuditInterceptor } from '../interceptors/audit.interceptor.js';

export const Audited = (action: string) =>
  applyDecorators(
    SetMetadata(AUDIT_ACTION, action),
    UseInterceptors(AuditInterceptor),
  );
```

`applyDecorators` 没有隐藏语义，它只是把几个装饰器依次应用到同一个目标上。`@Audited('booking.list.mine')` 展开后就是两件事：给 handler 写一条元数据，给 handler 挂一个拦截器。

`SetMetadata` 只负责写，读取方得自己写。拦截器里注入 `Reflector`：

```ts
// src/common/interceptors/audit.interceptor.ts
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { AUDIT_ACTION } from '../audit/audit.constants.js';

interface RequestWithUser {
  user?: { id: string };
  headers: Record<string, string | undefined>;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string>(AUDIT_ACTION, context.getHandler());
    if (action === undefined) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id ?? request.headers['x-user-id'] ?? 'anonymous';
    this.logger.log(`action=${action} user=${userId}`);

    return next.handle();
  }
}
```

挂到路由上：

```ts
@Get('mine')
@Audited('booking.list.mine')
findMine(@CurrentUser() user: AuthUser) {
  return { userId: user.id };
}
```

拦截器必须能在容器里解析。`UseInterceptors(AuditInterceptor)` 传的是类，Nest 会向容器要实例，所以它要么在 `providers` 里，要么直接 `new` 一个不依赖注入的版本：

```ts
// src/bookings/bookings.module.ts
@Module({
  controllers: [BookingsController],
  providers: [BookingsService, AuditInterceptor],
})
export class BookingsModule {}
```

忘了注册，启动直接报 `Nest can't resolve dependencies of the AuditInterceptor`。这个错误信息比运行时静默失效好排查得多。

请求一次，终端里会出现审计日志：

```bash
curl -s http://localhost:3000/api/v1/bookings/mine \
  -H 'x-user-id: 7c9e6679-7425-40de-944b-e07fc1f90ae7'

# 应用终端（示例输出）：
# [AuditInterceptor] action=booking.list.mine user=7c9e6679-7425-40de-944b-e07fc1f90ae7
```

没有 `@Audited` 的 handler 不会打日志，因为 `reflector.get` 返回 `undefined`，拦截器直接 `next.handle()` 放行。存储从日志换成数据库、再加字段、改成消息队列，都只改这一个拦截器。

## 几个容易踩反的地方

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 装饰器里注入的依赖是 `undefined` | 工厂在类定义期执行，容器还没建好 | 依赖逻辑移到 Guard / Interceptor |
| `@CurrentUser('email')` 拿到整个对象 | 工厂没判断 `data` | `data === undefined ? user : user[data]` |
| `{ schema }` 不生效 | 没注册 `StandardSchemaValidationPipe`，或没开 `validateCustomDecorators` | 两处同时配好 |
| `/bookings/mine` 返回 400 | 被 `@Get(':id')` 抢占 | 静态路由写在参数路由之前 |
| 取到的请求头是 `undefined` | Node 把请求头名转成了小写 | 统一用小写 key |
| 审计日志打两遍 | `@Audited` 和全局 `APP_INTERCEPTOR` 各注册了一次 | 只留一种 |

还有三件事值得记住：

- **装饰器只声明意图**。取值和副作用分开，`@Audited()` 才可能被替换、复用、独立演进。
- **身份来源要写清楚**。示例从 `x-user-*` 取身份，前提是这些头由网关注入、外部伪造不进来。服务直接对公网时，必须改成守卫验完 JWT 写 `req.user`，装饰器只读 `req.user`。
- **元数据 key 用常量**。`'audit'` 和 `'audit:action'` 混用，`Reflector` 只会安静地返回 `undefined`，不会报错。

装饰器写完，问题就变成“元数据写给谁看”。`SetMetadata` 存进去的东西、`Reflector` 怎么读、方法级和类级冲突时听谁的，这些是下一章的内容。

想更深入的话，官方文档里有这几页可以接着看：[Custom decorators](https://docs.nestjs.com/custom-decorators)（官方怎么把参数装饰器和元数据封到一起，对照正文那两颗自定义装饰器的写法）、[Schema-based validation](https://docs.nestjs.com/application/validation#schema-based-validation)（Nest 12 用 schema 校验参数的新路，对应“取值顺手校验”一节）、[Pipes](https://docs.nestjs.com/pipes)（管道为什么只做转换和校验、不负责取值，对应“取值顺手校验”开头那句）。

<!-- chapter-nav:start -->
---

← 上一篇：[011 ExecutionContext：切换不同上下文](011-ExecutionContext：切换不同上下文.md) · [本 Part 目录](_part.md) · 下一篇：[013 Metadata和Reflector](013-Metadata和Reflector.md) →
<!-- chapter-nav:end -->
