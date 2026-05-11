# @nestjs/jwt 集成与配置

## 安装

```bash
npm install @nestjs/jwt
```

## 创建 JwtModule 配置

```typescript
// src/auth/jwt.module.ts
import { Module, Global } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';

@Global()  // JWT 服务全局可用
@Module({
  imports: [
    NestJwtModule.register({
      // 密钥——生产环境必须从环境变量读取
      secret: process.env.JWT_SECRET || 'book-management-secret-key',

      // Token 配置
      signOptions: {
        expiresIn: '2h',       // Token 过期时间
        issuer: 'book-management-api',
        audience: 'book-management-app',
      },
    }),
  ],
  exports: [NestJwtModule],
})
export class JwtModule {}
```

## 环境变量配置

```bash
# .env
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d

# .env.example（提交到 Git）
JWT_SECRET=change-me
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d
```

```bash
# 生成安全的随机密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# 输出：a1b2c3...128位随机字符串
```

## 使用 ConfigModule 管理 JWT 配置

```typescript
// src/auth/jwt.module.ts（使用 ConfigService 版本）
import { Module, Global } from '@nestjs/common';
import { JwtModule as NestJwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    NestJwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '2h'),
          issuer: 'book-management-api',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [NestJwtModule],
})
export class JwtModule {}
```

> `registerAsync` 模式允许在 `useFactory` 中注入 `ConfigService`，实现配置分离。Day 22 会详解 ConfigModule。

## 在 AppModule 中注册

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { JwtModule } from './auth/jwt.module';
import { UserModule } from './user/user.module';
import { BookModule } from './book/book.module';
import { BorrowModule } from './borrow/borrow.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),  // Day 22 详解
    PrismaModule,
    JwtModule,    // ← 新增
    UserModule,
    BookModule,
    BorrowModule,
  ],
})
export class AppModule {}
```

## JwtService 核心 API

```typescript
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  // 1. sign —— 签发 Token
  issueToken(user: User) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return this.jwtService.sign(payload);
    // 输出：eyJhbGciOiJIUzI1NiIs...
  }

  // 2. signAsync —— 异步签发
  async issueTokenAsync(user: User) {
    return this.jwtService.signAsync({ sub: user.id });
  }

  // 3. verify —— 验证 Token
  verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      // payload: { sub: 1, username: 'alice', role: 'USER', iat: ..., exp: ... }
      return payload;
    } catch (error) {
      // Token 过期、无效、被篡改
      throw new UnauthorizedException('Token 无效');
    }
  }

  // 4. verifyAsync —— 异步验证
  async verifyTokenAsync(token: string) {
    return this.jwtService.verifyAsync(token);
  }

  // 5. decode —— 只解码不验证（不推荐在业务中使用）
  debugToken(token: string) {
    return this.jwtService.decode(token);
    // 不解密不验证，只 base64 decode——任何人都会
  }
}
```

## signOptions 详解

```typescript
NestJwtModule.register({
  secret: 'your-secret',
  signOptions: {
    // expiresIn: Token 有效期
    expiresIn: '2h',         // 2小时
    // expiresIn: '7d',      // 7天
    // expiresIn: 3600,      // 3600秒
    // expiresIn: '30m',     // 30分钟

    // issuer: 签发者标识
    issuer: 'book-management-api',

    // audience: 接收方标识
    audience: ['book-app', 'mobile-app'],

    // subject: 主题（一般不在此设，在 sign 时设）
    // subject: 'user-auth',

    // jwtid: 唯一 ID（不在此设）
    // jwtid: 'unique-id',

    // notBefore: 生效时间（不在此设）
    // notBefore: '0',

    // algorithm: 签名算法
    algorithm: 'HS256',     // 默认
    // algorithm: 'RS256',  // 使用 RSA

    // noTimestamp: 不包含 iat
    // noTimestamp: true,
  },
})
```

## 前端对应：Token 管理

```typescript
// 前端 Token 管理（React/Vue 通用）
class TokenManager {
  private static TOKEN_KEY = 'access_token';

  static set(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static get(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static remove() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static isExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}

// Axios 拦截器自动附加 Token
axios.interceptors.request.use(config => {
  const token = TokenManager.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 参考链接

- [NestJS — JWT Module](https://docs.nestjs.com/security/authentication#jwt-token)
- [@nestjs/jwt — npm](https://www.npmjs.com/package/@nestjs/jwt)
- [jsonwebtoken — npm](https://www.npmjs.com/package/jsonwebtoken)
