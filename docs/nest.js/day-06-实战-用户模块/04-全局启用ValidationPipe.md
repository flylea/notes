# 全局启用 ValidationPipe

## 为什么需要 ValidationPipe

如果不启用 ValidationPipe，`@Body()` 拿到的是一个**普通的 JavaScript 对象**，DTO 上的装饰器不会生效：

```typescript
// 不启用 ValidationPipe
@Post('register')
register(@Body() dto: RegisterUserDto) {
  // dto 是 { username: 'john', password: '123456' }
  // @IsNotEmpty() 装饰器没有执行！
  // dto 不是 RegisterUserDto 的实例，只是恰好有相同属性的普通对象
}
```

## 在 main.ts 中配置

```typescript
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局启用参数校验
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,  // 自动剔除 DTO 中未定义的属性
    transform: true,  // 自动将普通对象转为 DTO 类实例
  }));

  await app.listen(3000);
}
bootstrap();
```

## 关键配置项说明

### whitelist: true

```typescript
// DTO
class RegisterUserDto {
  username: string;
  password: string;
}

// 请求
POST /register
{
  "username": "john",
  "password": "123456",
  "isAdmin": true     // ← DTO 中没有定义
}

// whitelist: true → isAdmin 被自动剔除
// Controller 收到的 dto = { username: 'john', password: '123456' }
```

> `whitelist: true` 防止客户端注入未预期的字段。这是一个安全最佳实践。

### transform: true

```typescript
// DTO
class FindAllDto {
  page: number;  // 类型是 number
}

// 请求
GET /users?page=1
// Query String 传过来 page 始终是 string: '1'

// transform: true → 自动转换
// Controller 收到 dto.page = 1 (number, 不是 '1')
```

> 没有 `transform: true`，Query 参数全是 `string` 类型，你需要手动 `+page` 转换。

## 完整的生产级配置

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,                 // 剔除未知属性
  forbidNonWhitelisted: true,      // 遇到未知属性直接报错（比剔除更严格）
  transform: true,                 // 自动类型转换
  disableErrorMessages: false,     // 显示错误消息（生产环境可设为 true 防泄漏）
  validationError: {
    target: false,                 // 不在错误中暴露原始对象
    value: false,                  // 不在错误中暴露输入值
  },
}));
```

## 验证效果

配置后，不合法请求会自动返回 400：

```
POST /user/register
Content-Type: application/json

{
  "password": "12"
}

→ 400 Bad Request
{
  "statusCode": 400,
  "message": [
    "用户名不能为空",
    "密码最少 6 位"
  ],
  "error": "Bad Request"
}
```

> `class-validator` 的错误消息支持中文——这正是每个装饰器中 `{ message: '...' }` 的作用。

---

## 参考链接

- [NestJS — Pipes](https://docs.nestjs.com/pipes)
- [NestJS — Validation](https://docs.nestjs.com/techniques/validation)
- 开源笔记：《Nest 通关秘籍》.doc/21. 如何使用 ValidationPipe 验证 post 请求参数.md
