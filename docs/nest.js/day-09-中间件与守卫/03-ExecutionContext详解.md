# ExecutionContext 详解

## 它是什么

`ExecutionContext` 是 Nest 中 Guard、Interceptor、ExceptionFilter 都能拿到的核心参数。它继承了 `ArgumentsHost`，提供了更丰富的上下文信息。

```typescript
interface ExecutionContext extends ArgumentsHost {
  getClass<T = any>(): Type<T>;      // 获取当前 Controller 类
  getHandler(): Function;            // 获取当前被调用的 handler 方法
}
```

## 为什么 Middleware 拿不到它？

```
Middleware：只知道 req/res → 不知道调的是哪个 Controller 的哪个方法
Guard / Interceptor / Pipe / Filter：通过 ExecutionContext 知道精确到方法级别
```

这是 Nest 把 AOP 分成多个切面的核心原因——ExecutionContext 提供了"方法级别的元信息"。

## 三合一：HTTP、WebSocket、RPC

ExecutionContext 支持三个上下文切换：

```typescript
canActivate(context: ExecutionContext): boolean {
  // HTTP 上下文
  const http = context.switchToHttp();
  http.getRequest();   // Express Request
  http.getResponse();  // Express Response
  http.getNext();      // Express NextFunction

  // WebSocket 上下文
  const ws = context.switchToWs();
  ws.getClient();      // WebSocket Client
  ws.getData();        // 消息体

  // RPC 上下文（用于微服务）
  const rpc = context.switchToRpc();
  rpc.getContext();    // RPC Context
  rpc.getData();       // 消息体

  return true;
}
```

## getHandler() — 获取调用的方法

```typescript
@Injectable()
export class LoggingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    // handler 就是 Controller 中被调用的方法
    // 比如 BookController.findById
    console.log(handler.name);  // 'findById'
    return true;
  }
}
```

结合 Reflector，可以从方法上读取元数据：

```typescript
canActivate(context: ExecutionContext): boolean {
  const handler = context.getHandler();
  const roles = this.reflector.get<string[]>('roles', handler);
  // 读取方法上 @SetMetadata('roles', ['admin']) 的值
  return true;
}
```

## getClass() — 获取 Controller 类

```typescript
canActivate(context: ExecutionContext): boolean {
  const cls = context.getClass();
  // cls 就是 Controller 类本身
  // 比如 BookController
  console.log(cls.name);  // 'BookController'

  // 也可以从类级别读取元数据
  const defaultRole = this.reflector.get<string>('role', cls);
  return true;
}
```

## getClass() vs getHandler() 的优先级

```typescript
@Controller('book')
@SetMetadata('role', 'user')       // 类级别：默认 role = 'user'
export class BookController {
  @Post('create')
  @SetMetadata('role', 'admin')    // 方法级别：role = 'admin'（覆盖类级别）
  create() {}
}

canActivate(context: ExecutionContext): boolean {
  // 优先读方法级别，如果方法没有，读类级别
  const role = this.reflector.getAllAndOverride('role', [
    context.getHandler(),
    context.getClass(),
  ]);
  // create 方法的请求 → role = 'admin'
  // list 方法的请求 → role = 'user'（来自类级别）
}
```

## Reflector 四个方法

```typescript
constructor(private reflector: Reflector) {}

// 1. 只读 handler 级别
this.reflector.get('roles', context.getHandler());

// 2. 读 handler 和 class 级别，合并为数组
this.reflector.getAllAndMerge('roles', [
  context.getHandler(),
  context.getClass(),
]);
// handler ['admin'] + class ['user'] → ['admin', 'user']

// 3. 读 handler 和 class 级别，handler 覆盖 class
this.reflector.getAllAndOverride('roles', [
  context.getHandler(),
  context.getClass(),
]);
// handler ['admin'] 覆盖 class ['user'] → 'admin'

// 4. 只读一个，不指定 handler 或 class
this.reflector.get('roles', target);
```

## 实战：执行上下文中的信息提取工具

```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ContextHelper {
  /**
   * 从 ExecutionContext 提取 Express Request
   */
  static getRequest(context: ExecutionContext): Request {
    return context.switchToHttp().getRequest();
  }

  /**
   * 从 ExecutionContext 提取当前登录用户
   */
  static getUser(context: ExecutionContext): any {
    return this.getRequest(context).user;
  }

  /**
   * 从 ExecutionContext 提取请求的 IP
   */
  static getIp(context: ExecutionContext): string {
    return this.getRequest(context).ip;
  }

  /**
   * 从 ExecutionContext 提取请求方法名
   */
  static getHandlerName(context: ExecutionContext): string {
    return context.getHandler().name;
  }
}
```

---

## 参考链接

- [NestJS — Execution Context](https://docs.nestjs.com/fundamentals/execution-context)
- [NestJS — Reflection and Metadata](https://docs.nestjs.com/fundamentals/reflection-and-metadata)
- 开源笔记：《Nest 通关秘籍》.doc/23.图解核心概念.md
