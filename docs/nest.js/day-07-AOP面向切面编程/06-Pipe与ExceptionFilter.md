# Pipe 和 ExceptionFilter 详解

## Pipe 的定位

Pipe 是 Nest 的**参数处理层**。它有两个核心职责：

1. **类型转换（transformation）**：将请求的原始值（Query String 传过来的永远都是 `string`）转为目标类型（`number`、`boolean` 等）
2. **数据校验（validation）**：检查输入是否合法（字段是否为空、长度是否符合、格式是否正确）

## Pipe 的基本结构

```typescript
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class MyPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    // value：请求传来的原始值
    // metadata：{ type, metatype, data } — 描述这个参数的信息

    if (!value) {
      throw new BadRequestException('值不能为空');
    }

    return value;  // 返回的值会传给 Controller
  }
}
```

### ArgumentMetadata 结构

```typescript
interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  // @Body() → 'body'
  // @Query() → 'query'
  // @Param('id') → 'param'

  metatype?: any;
  // @Body() dto: RegisterUserDto → RegisterUserDto 类（构造函数）

  data?: string;
  // @Query('keyword') → 'keyword'
  // @Param('id') → 'id'
}
```

## Nest 内置的 7 个 Pipe

| Pipe | 作用 | 示例 |
|------|------|------|
| `ValidationPipe` | 基于 class-validator 自动校验 DTO | `@Body() dto` |
| `ParseIntPipe` | 将 string 转为 number | `@Param('id', ParseIntPipe) id: number` |
| `ParseFloatPipe` | 将 string 转为 float | `@Query('price', ParseFloatPipe) price: number` |
| `ParseBoolPipe` | 将 string 转为 boolean | `@Query('active', ParseBoolPipe) active: boolean` |
| `ParseArrayPipe` | 将 string 转为 array | `@Query('ids', ParseArrayPipe) ids: string[]` |
| `ParseUUIDPipe` | 验证 UUID 格式 | `@Param('id', ParseUUIDPipe) id: string` |
| `DefaultValuePipe` | 当值为空时提供默认值 | `@Query('page', new DefaultValuePipe(1)) page: number` |

### 内置 Pipe 使用示例

```typescript
@Get(':id')
findOne(
  @Param('id', ParseIntPipe) id: number,  // '1' → 1
) {
  // id 现在是 number 类型，不是 string
  return this.service.findOne(id);
}

@Get('list')
list(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('size', new DefaultValuePipe(10), ParseIntPipe) size: number,
) {
  // 前端没传 page → 默认值 1
  // 前端没传 size → 默认值 10
  return this.service.paginate(page, size);
}
```

## ValidationPipe 深入

在 Day 6 我们已经在图书管理系统中使用了 `ValidationPipe`。这里补充它的内部原理：

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // 剔除 DTO 中未定义的属性
  forbidNonWhitelisted: true, // 有未定义属性 → 直接 400
  transform: true,            // 将普通对象转为 DTO 实例
  disableErrorMessages: false, // 显示具体错误消息
}));
```

### ValidationPipe 的执行流程

```
1. transform: true → class-transformer 将普通 JS 对象 → DTO class 实例
2. class-validator 检查所有装饰器约束
3. 校验通过 → 返回转换后的值 → Controller
4. 校验失败 → 抛出 BadRequestException → ExceptionFilter
```

### 自定义校验错误格式

```typescript
app.useGlobalPipes(new ValidationPipe({
  exceptionFactory: (errors: ValidationError[]) => {
    // 自定义错误格式
    return new BadRequestException({
      code: 400,
      message: errors.map(e => ({
        field: e.property,
        errors: Object.values(e.constraints || {}),
      })),
    });
  },
}));
```

响应会变为：
```json
{
  "code": 400,
  "message": [
    { "field": "username", "errors": ["用户名不能为空"] },
    { "field": "password", "errors": ["密码最少 6 位"] }
  ]
}
```

## 自定义 Pipe 实战：密码强度校验

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class PasswordStrengthPipe implements PipeTransform {
  transform(value: any) {
    const password = typeof value === 'object' ? value.password : value;

    if (!password) return value;

    // 必须包含大小写字母和数字
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasDigit) {
      throw new BadRequestException(
        '密码必须包含大小写字母和数字',
      );
    }

    return value;
  }
}

// 使用
@Post('register')
register(
  @Body(PasswordStrengthPipe) dto: RegisterUserDto,  // 先执行 PasswordStrengthPipe，再执行 ValidationPipe
) {}
```

## ExceptionFilter 的定位

ExceptionFilter 是 Nest 请求管道的**最后一环**——当前面任何阶段（Guard、Pipe、Interceptor、Controller）抛出异常，最终都会在这里被捕获和组织。

## ExceptionFilter 的基本结构

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 确定状态码
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 确定错误消息
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal Server Error';

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

## Nest 内置异常类速查

| 异常类 | HTTP 状态码 | 有参构造（message） |
|--------|-----------|-------------------|
| `BadRequestException` | 400 | `new BadRequestException('参数错误')` |
| `UnauthorizedException` | 401 | `new UnauthorizedException('未登录')` |
| `ForbiddenException` | 403 | `new ForbiddenException('无权限')` |
| `NotFoundException` | 404 | `new NotFoundException('资源不存在')` |
| `ConflictException` | 409 | `new ConflictException('冲突')` |
| `InternalServerErrorException` | 500 | `new InternalServerErrorException('服务器内部错误')` |
| `ServiceUnavailableException` | 503 | `new ServiceUnavailableException('服务暂不可用')` |

Day 11 将深入自定义业务异常和完整的 ExceptionFilter 设计。

## 前端类比

| Nest | 前端 |
|------|------|
| `ValidationPipe` | Vue VeeValidate / React Hook Form 的校验规则 |
| `ParseIntPipe` | `parseInt(value, 10)` — 类型转换 |
| `DefaultValuePipe` | Vue Props `default: () => 1` |
| `ExceptionFilter` | Vue `app.config.errorHandler` / React Error Boundary |

## 实战：图书管理系统中的 Pipe 和 Filter

回顾 Day 6 的项目代码，我们已经同时使用了这两者：

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,    // ← Pipe 在工作：剔除未知字段
  transform: true,    // ← Pipe 在工作：转为 DTO 实例
}));
```

```typescript
// user.service.ts
throw new BadRequestException('该用户已注册');
// ← 抛出的异常最终被 Nest 内置的 ExceptionFilter 捕获
// 自动生成：
// { statusCode: 400, message: '该用户已注册', error: 'Bad Request' }
```

> Pipe 在入口处校验输入，ExceptionFilter 在出口处统一错误格式——这两者一前一后，共同保证了 API 的输入输出规范性。

---

## 参考链接

- [NestJS — Pipes](https://docs.nestjs.com/pipes)
- [NestJS — Validation](https://docs.nestjs.com/techniques/validation)
- [NestJS — Exception Filters](https://docs.nestjs.com/exception-filters)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md、doc/21.如何使用ValidationPipe.md
