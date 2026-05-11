# 实现 ExceptionFilter 接口

## ExceptionFilter 接口

```typescript
import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';

interface ExceptionFilter<T = any> {
  catch(exception: T, host: ArgumentsHost): any;
}
```

- `exception`：捕获到的异常对象
- `host`：ArgumentsHost（提供 HTTP/WS/RPC 上下文切换）

## 最简单实现：统一 HttpException 响应格式

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)  // 只捕获 HttpException 及其子类
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response.status(status).json({
      code: status,
      data: null,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

响应示例：
```json
{
  "code": 400,
  "data": null,
  "message": "该用户已注册",
  "path": "/user/register",
  "timestamp": "2026-05-10T14:30:00.000Z"
}
```

## @Catch() 参数详解

```typescript
// 1. 只捕获特定异常
@Catch(HttpException)
export class HttpExceptionFilter {}

// 2. 捕获多个异常类型
@Catch(HttpException, TypeError)
export class MultiExceptionFilter {}

// 3. 捕获所有异常（不传参数或传 Error）
@Catch()  // 或 @Catch(Error)
export class AllExceptionsFilter {}
```

## 处理 ValidationPipe 的错误

`ValidationPipe` 抛出的 `BadRequestException` 的 `message` 是数组格式：

```typescript
throw new BadRequestException([
  '用户名不能为空',
  '密码最少 6 位',
]);
```

所以 ExceptionFilter 需要兼容两种情况：

```typescript
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();

    // 处理 ValidationPipe 的数组消息
    let message: string;
    let errors: any[] | undefined;

    if (
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const msg = (exceptionResponse as any).message;
      if (Array.isArray(msg)) {
        message = '参数校验失败';
        errors = msg.map((m: string) => ({ message: m }));
      } else {
        message = typeof msg === 'string' ? msg : '请求失败';
      }
    } else {
      message = exception.message;
    }

    response.status(status).json({
      code: status,
      data: null,
      message,
      errors,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

响应：
```json
{
  "code": 400,
  "data": null,
  "message": "参数校验失败",
  "errors": [
    { "message": "用户名不能为空" },
    { "message": "密码最少 6 位" }
  ],
  "path": "/user/register",
  "timestamp": "..."
}
```

## 生产环境安全配置

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly isProduction: boolean,  // 通过构造器注入环境标志
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 确定状态码和消息
    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      message = typeof resp === 'string' ? resp : (resp as any).message || '请求失败';
      if (Array.isArray(message)) message = '参数校验失败';
    } else {
      // 未知异常 → 500
      status = HttpStatus.INTERNAL_SERVER_ERROR;

      if (this.isProduction) {
        message = '服务器内部错误';  // 生产环境不暴露异常详情
      } else {
        message = (exception as Error).message || '未知错误';  // 开发环境暴露详情
        console.error('[Unexpected Error]', exception);  // 日志记录完整异常
      }
    }

    response.status(status).json({
      code: status,
      data: null,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

## ArgumentsHost 详解

```typescript
catch(exception: unknown, host: ArgumentsHost) {
  // HTTP 上下文
  const httpCtx = host.switchToHttp();
  const req = httpCtx.getRequest<Request>();
  const res = httpCtx.getResponse<Response>();
  const next = httpCtx.getNext();

  // 也可以通过 getArgs 获取原始参数
  const [req2, res2, next2] = host.getArgs();

  // 获取异常发生的控制器类型
  const controllerType = host.getType();  // 'http'

  // RPC 上下文（微服务）
  // host.switchToRpc().getData();

  // WebSocket 上下文
  // host.switchToWs().getClient();
}
```

> ExceptionFilter 是请求管道的最后一环。它必须在所有异常产生后返回**规范的 JSON**，而不是 Nest 默认的 `{ statusCode, message, error }` 格式——这个格式和你的 TransformInterceptor 包装的 `{ code: 0, data }` 格式不一致，前端需要处理两种不同的响应格式。

---

## 参考链接

- [NestJS — Exception Filters](https://docs.nestjs.com/exception-filters)
- [NestJS — ArgumentsHost](https://docs.nestjs.com/fundamentals/execution-context#argumentshost-class)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md、doc/23.图解核心概念.md
