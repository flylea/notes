# Joi 验证配置完整性

## 为什么需要配置校验

```
没有校验：
  生产环境忘了设置 JWT_SECRET
  → 系统用了 .env 的开发默认值
  → 开发默认值是 'dev-secret'
  → 攻击者可能猜到 → 伪造任意用户 Token → 安全灾难

有 Joi 校验：
  → 启动时检测 JWT_SECRET === 'dev-secret'
  → 拒绝启动
  → 强制运维配置正确的密钥
```

## 安装

```bash
npm install joi
```

## 配置文件

```typescript
// .env.production（模拟生产环境）
DATABASE_URL=mysql://user:password@prod-db:3306/book_prod
JWT_SECRET=dev-secret          # ← 忘记改为生产密钥！
JWT_ACCESS_EXPIRES_IN=15m
PORT=3000
```

## Joi 验证 Schema

```typescript
// src/app.module.ts
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      validationSchema: Joi.object({
        // 数据库
        DATABASE_URL: Joi.string().required(),

        // JWT
        JWT_SECRET: Joi.string().required().min(32),
        JWT_ACCESS_EXPIRES_IN: Joi.string()
          .pattern(/^\d+[smhd]$/)
          .default('30m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string()
          .pattern(/^\d+[smhd]$/)
          .default('7d'),

        // 服务端口
        PORT: Joi.number().default(3000),

        // 运行时环境
        NODE_ENV: Joi.string()
          .valid('development', 'staging', 'production')
          .default('development'),

        // Redis（可选）
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').default(''),
      }),
      validationOptions: {
        allowUnknown: true,   // 允许未在 Schema 中定义的变量（防止因新增变量而失败）
        abortEarly: false,    // 报告所有错误，而非遇到第一个就停止
      },
    }),
  ],
})
export class AppModule {}
```

## 生产环境安全校验

```typescript
// 进阶：生产环境禁止使用默认值
const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'staging', 'production'),

  JWT_SECRET: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .required()
      .min(64)                             // 生产密钥至少 64 字符
      .not('dev-secret')                   // 禁止使用明显的开发值
      .not('change-me')
      .not('your-secret-key'),
    otherwise: Joi.string().required().min(8),
  }),

  DATABASE_URL: Joi.string().required(),

  // 生产环境数据库不能连 localhost
  DATABASE_HOST: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().not('localhost', '127.0.0.1'),
    otherwise: Joi.string(),
  }),
});
```

## Joi 常用校验规则

```typescript
Joi.string()
  .required()              // 必填
  .min(10)                 // 最小长度
  .max(100)               // 最大长度
  .email()                 // 邮箱格式
  .uri()                   // URI 格式
  .pattern(/regex/)       // 正则匹配
  .valid('a', 'b', 'c')    // 枚举值
  .default('defaultVal')   // 默认值

Joi.number()
  .integer()               // 整数
  .min(1)                  // 最小值
  .max(65535)              // 最大值
  .port()                  // 端口号（0-65535）
  .default(3000)

Joi.boolean()
  .default(false)

Joi.array()
  .items(Joi.string())
  .min(1)
  .unique()
```

## 校验失败时的效果

```bash
$ NODE_ENV=production npm run start:prod

# 如果 JWT_SECRET 使用了 'dev-secret'：
#
# ERROR [ConfigModule] Configuration validation error:
#   "JWT_SECRET" is not allowed to be "dev-secret"
#
# 应用无法启动 ✅（而不是带着不安全配置运行）
```

```
启动流程：
  1. NestFactory.create(AppModule)
  2. ConfigModule 初始化
  3. 读取 .env 文件 + 系统环境变量
  4. 运行 Joi validationSchema 校验
  5. 校验通过 → 继续启动
     校验失败 → 抛出异常，应用退出
```

> Joi 校验是"尽早失败"（Fail Fast）原则的体现——配置错误应该在启动时暴露，而不是在运行时触发诡异的 bug。

---

## 参考链接

- [NestJS — Schema Validation](https://docs.nestjs.com/techniques/configuration#schema-validation)
- [Joi — Documentation](https://joi.dev/api/)
