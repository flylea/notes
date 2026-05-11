# 分布式 Session 实现

## 问题：多实例部署时的 Session

```
使用内存 Session 时：

  用户 → Nginx → 实例 A（登录，Session 存在 A 的内存中）
  用户下次请求 → Nginx → 实例 B（找不到 Session！→ 401）

解决：
  1. Nginx ip_hash：同一 IP 转发到同一实例（不推荐——某些 IP 可能很多用户）
  2. Redis 共享 Session：所有实例从 Redis 读写 Session（推荐）
```

## connect-redis 方案

```bash
npm install express-session connect-redis ioredis
npm install -D @types/express-session
```

```typescript
// src/main.ts
import * as session from 'express-session';
import * as createRedisStore from 'connect-redis';
import Redis from 'ioredis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const RedisStore = createRedisStore(session);

  const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  });

  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || 'session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24, // 24 小时
        sameSite: 'lax',
      },
    }),
  );

  await app.listen(3000);
}
```

## 但本教程推荐 JWT 而非 Session

```
JWT + Redis 的组合方案：
  - JWT 做认证（无状态，所有实例都能验证）
  - Redis 做缓存和黑名单（需要强制失效时用）

何时用 Session（Redis 共享）：
  - 传统服务端渲染应用（不需要跨域）
  - 需要精确控制 Session 生命周期
  - cookie 敏感信息较多不希望暴露给客户端

何时用 JWT：
  - 前后端分离的 SPA 应用
  - 需要跨域调用 API
  - 微服务架构（各服务独立验证 Token）
```

## JWT 黑名单——Redis 实现强制失效

JWT 无法主动失效，但可以结合 Redis 实现黑名单：

```typescript
// src/auth/auth.service.ts
async logout(userId: number, token: string) {
  // 将 Token 加入黑名单（有效期 = Token 剩余有效期）
  const payload = this.jwtService.decode(token) as any;
  const remainingTime = payload.exp - Math.floor(Date.now() / 1000);

  if (remainingTime > 0) {
    await this.redis.set(`blacklist:${token}`, '1', remainingTime);
  }
}

// AuthGuard 增加黑名单检查
async canActivate(context: ExecutionContext): Promise<boolean> {
  // ... 正常验证
  const token = this.extractTokenFromHeader(request);

  // 检查黑名单
  const isBlacklisted = await this.redis.exists(`blacklist:${token}`);
  if (isBlacklisted) {
    throw new UnauthorizedException('Token 已失效');
  }

  // ... 继续验证
}
```

---

## 参考链接

- [express-session — npm](https://www.npmjs.com/package/express-session)
- [connect-redis — npm](https://www.npmjs.com/package/connect-redis)
