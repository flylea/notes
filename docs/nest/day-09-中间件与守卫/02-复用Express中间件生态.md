# 复用 Express 中间件生态

## 概述

Nest 底层是 Express（或 Fastify），所以 Express 中间件生态中的库可以**直接使用**。

## 1. cors — 跨域处理

```bash
npm install cors
npm install -D @types/cors
```

```typescript
// main.ts — 全局方式
import * as cors from 'cors';
const app = await NestFactory.create(AppModule);
app.use(cors({
  origin: ['http://localhost:5173', 'https://my-app.com'],
  credentials: true,          // 允许携带 Cookie
  methods: ['GET', 'POST'],   // 只允许 GET 和 POST
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

或者使用 `app.enableCors()`（Nest 封装，等价于上面的 app.use）：

```typescript
app.enableCors({
  origin: true,              // 反射 Origin（允许任何来源）
  credentials: true,
});
```

## 2. helmet — 安全响应头

```bash
npm install helmet
```

```typescript
import helmet from 'helmet';

const app = await NestFactory.create(AppModule);
app.use(helmet());
```

自动添加的响应头：
```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=15552000
Referrer-Policy: no-referrer
```

> 生产环境强烈建议加上 helmet——它默认启用所有安全头，可根据需要关闭特定的（如 `helmet({ contentSecurityPolicy: false })`）。

## 3. compression — 响应压缩

```bash
npm install compression
npm install -D @types/compression
```

```typescript
import * as compression from 'compression';

const app = await NestFactory.create(AppModule);
app.use(compression({
  level: 6,      // 压缩级别（1-9）
  threshold: 0,  // 所有响应都压缩（默认只压缩 > 1KB）
}));
```

启用后，JSON 响应体从 100KB → 可能压缩到 15KB，大幅节省带宽。

## 4. morgan — HTTP 请求日志

```bash
npm install morgan
npm install -D @types/morgan
```

```typescript
import * as morgan from 'morgan';

const app = await NestFactory.create(AppModule);
app.use(morgan('combined'));
// 输出：::1 - - [10/May/2026:14:30:00 +0000] "POST /user/register HTTP/1.1" 201 42
```

morgan 的格式选项：
| 格式 | 内容 | 适用场景 |
|------|------|---------|
| `dev` | 方法、路径、状态码、耗时、响应大小 | 开发环境（彩色） |
| `combined` | 标准 Apache 日志格式 | 生产环境 |
| `common` | 简化版 combined（无 referrer/user-agent） | 内网项目 |
| `tiny` | 最小格式 | CI 环境 |

## 5. cookie-parser — Cookie 解析

```bash
npm install cookie-parser
npm install -D @types/cookie-parser
```

```typescript
import * as cookieParser from 'cookie-parser';

const app = await NestFactory.create(AppModule);
app.use(cookieParser('my-secret'));  // 'my-secret' 用于签名 Cookie

// Controller 中读取 Cookie
@Get('profile')
profile(@Req() req: Request) {
  console.log(req.cookies);          // { token: 'xxx' }
  console.log(req.signedCookies);    // 签名的 Cookie
  console.log(req.cookies['token']); // 'xxx'
}
```

## 6. express-session — Session 管理

```bash
npm install express-session
npm install -D @types/express-session
```

```typescript
import * as session from 'express-session';

const app = await NestFactory.create(AppModule);
app.use(session({
  secret: 'my-secret-key',     // session id 签名密钥
  resave: false,               // 不自动保存未修改的 session
  saveUninitialized: false,    // 不保存未初始化的 session
  cookie: {
    httpOnly: true,            // 前端 JS 无法读取 cookie
    secure: false,             // 非 HTTPS 也允许（开发环境）
    maxAge: 1000 * 60 * 30,   // 30 分钟过期
  },
}));
```

Controller 中使用：

```typescript
@Post('login')
login(@Body() dto: LoginUserDto, @Req() req: any) {
  // 设置 session
  req.session.user = { username: dto.username };
  return { message: '登录成功' };
}

@Get('profile')
profile(@Req() req: any) {
  return req.session.user;  // 读取当前登录用户
}
```

## 7. express-rate-limit — 接口限流

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const app = await NestFactory.create(AppModule);

// 全局限流
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟窗口
  max: 100,                 // 最多 100 个请求
  message: '请求太频繁，请稍后再试',
}));

// 针对登录接口的特殊限流
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 分钟
  max: 5,               // 最多 5 次
  message: '登录尝试太频繁，请 1 分钟后再试',
});
app.use('/user/login', loginLimiter);
```

## 实战：图书管理系统中间件集成

```typescript
// src/middleware/index.ts
import { INestApplication } from '@nestjs/common';
import * as cors from 'cors';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import * as morgan from 'morgan';
import rateLimit from 'express-rate-limit';

export function setupGlobalMiddleware(app: INestApplication) {
  // 1. 安全头
  app.use(helmet());

  // 2. 跨域
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST'],
  }));

  // 3. 响应压缩
  app.use(compression());

  // 4. Cookie 解析
  app.use(cookieParser());

  // 5. 生产环境日志
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
  } else {
    app.use(morgan('dev'));
  }

  // 6. 限流（登录和注册接口）
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { code: -1, message: '请求太频繁' },
  });
  app.use('/user/login', authLimiter);
  app.use('/user/register', authLimiter);
}

// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupGlobalMiddleware(app);
  await app.listen(3000);
}
```

> ⚠️ `app.use()` 注册的全局 middleware，其执行时机早于 Nest 的 Module 级 `configure()` 中注册的 middleware。URL 匹配规则不同：`app.use('/user/login')` 只匹配该路径，`configure().forRoutes()` 可以按 Controller 和 HTTP 方法匹配。

---

## 参考链接

- [Express — Using Middleware](https://expressjs.com/en/guide/using-middleware.html)
- [cors — Configuration Options](https://github.com/expressjs/cors#configuration-options)
- [helmet — How It Works](https://helmetjs.github.io/)
- [express-rate-limit — Usage](https://github.com/express-rate-limit/express-rate-limit)
- [morgan — Predefined Formats](https://github.com/expressjs/morgan#predefined-formats)
