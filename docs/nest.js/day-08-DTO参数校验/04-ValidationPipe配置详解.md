# ValidationPipe 配置详解

## ValidationPipe 完整的配置项

```typescript
import { ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    // ========== 核心配置 ==========

    whitelist: true,
    // true → 自动剔除 DTO 中未定义的属性
    // 场景：防止前端恶意传 isAdmin/balance 等字段

    forbidNonWhitelisted: true,
    // true → 如果请求中有非白名单属性，直接返回 400（比 whitelist 更严格）
    // whitelist 只是"静默剔除"，forbidNonWhitelisted 直接报错
    // ⚠️ 依赖 whitelist: true

    transform: true,
    // true → 自动将普通 JS 对象转为 DTO 类实例
    // 1. Query string 中 '1' → number 1
    // 2. @Type(() => Number) → 类型转换
    // 3. @Transform() → 自定义转换逻辑执行

    // ========== 错误处理 ==========

    disableErrorMessages: false,
    // true → 不返回具体错误消息（生产环境安全建议）
    // 返回 { statusCode: 400, message: 'Bad Request', error: 'Bad Request' }
    // 而不是 { message: ['用户名不能为空', '密码最少 6 位'] }

    errorHttpStatusCode: 400,
    // 校验失败时返回的 HTTP 状态码（默认 400）

    exceptionFactory: (errors: ValidationError[]) => {
      // 完全自定义错误响应
      return new BadRequestException({
        code: -1,
        errors: errors.map(e => ({
          field: e.property,
          violations: Object.values(e.constraints || {}),
        })),
      });
    },

    // ========== 校验控制 ==========

    stopAtFirstError: false,
    // true → 遇到第一个错误就停止（不继续校验其他字段）
    // 默认 false → 返回所有字段的错误

    skipMissingProperties: false,
    // true → 跳过 DTO 中没有传的属性（用于 partial update 场景）

    skipNullProperties: false,
    // true → 跳过值为 null 的属性

    skipUndefinedProperties: false,
    // true → 跳过值为 undefined 的属性

    // ========== 高级 ==========

    validationError: {
      target: false,   // 不在错误中暴露原始 DTO 对象（安全）
      value: false,    // 不在错误中暴露用户输入的非法值（安全）
    },

    enableDebugMessages: false,
    // true → 开发环境显示更详细的错误

    transformOptions: {
      enableImplicitConversion: true,
      // true → 启用隐式类型转换（字符串 → 数字/布尔等）
      // 不需要手动写 @Type(() => Number)
    },
  }),
);
```

## 三个最重要的配置项

### whitelist: true（安全基础）

```typescript
// DTO
class CreateUserDto {
  username: string;
  password: string;
}

// 请求
POST /user/register
{ "username": "john", "password": "123456", "isAdmin": true }

// 无 whitelist → Controller 收到完整对象，isAdmin 被传入 Service
// 有 whitelist → isAdmin 被自动剔除，Controller 收不到这个字段
```

### transform: true（类型转换利器）

```typescript
// DTO
class PaginationDto {
  page: number;
  size: number;
}

// 请求：GET /users?page=1&size=10
// page 和 size 在 Query String 中永远是 string

// 无 transform → page = '1' (string)，size = '10' (string)
// 有 transform → page = 1 (number)，size = 10 (number)
```

`transform: true` 内部通过 `class-transformer` 实现，会调用 `plainToInstance()` 将普通对象转为类实例。

### forbidNonWhitelisted（严格模式）

```typescript
// 企业项目推荐：开发阶段用 forbidNonWhitelisted
// 让前端快速发现拼写错误

// POST /user/register
// { "userName": "john" }   ← 前端拼成了 userName（驼峰），后端是 username

// whitelist: true → 静默剔除 userName → 注册时 username 为空 → 校验失败"用户名不能为空"
// forbidNonWhitelisted: true → 直接报错：property userName should not exist
// 前端能更快定位到拼写错误
```

> 生产环境建议用 `whitelist: true` 就够了，`forbidNonWhitelisted` 可能过于严格（比如不同版本的前端传不同字段时）。

## 环境差异化配置

```typescript
// main.ts
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const isProduction = configService.get('NODE_ENV') === 'production';

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: !isProduction,  // 开发环境严格模式
      disableErrorMessages: isProduction,    // 生产环境不暴露错误详情
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  await app.listen(3000);
}
```

## class-transformer 常用操作

`transform: true` 依赖 `class-transformer`。以下是常用的配合装饰器：

```typescript
import { Type, Transform, Exclude, Expose } from 'class-transformer';

export class QueryBookDto {
  @Type(() => Number)     // 强制转为 number
  page: number;

  @Type(() => Number)
  size: number;

  @Transform(({ value }) => value?.trim())  // 自定义转换
  keyword: string;

  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  available: boolean;
}
```

> `@Type(() => Number)` 是处理 Query String 类型转换的标准写法。Day 8-06 会讲 Nest 内置的 ParseIntPipe，提供另一种方案。

---

## 参考链接

- [NestJS — Validation](https://docs.nestjs.com/techniques/validation)
- [class-validator — Validation Options](https://github.com/typestack/class-validator#passing-options)
- [class-transformer — Usage](https://github.com/typestack/class-transformer#classtoplain)
- 开源笔记：《Nest 通关秘籍》.doc/21.如何使用ValidationPipe验证post请求参数.md
