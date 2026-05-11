# Token 续期方案

## 问题：Token 过期怎么办

```
accessToken 有效期 30 分钟
      │
      ▼
用户正在填表单 → 30 分钟后 Token 过期 → 提交时 401
用户正在浏览 → 突然跳回登录页

Token 有效期太短 → 用户体验差
Token 有效期太长 → 安全风险高（Token 泄露后长时间可用）
```

## 方案对比

| 方案 | 原理 | 安全性 | 体验 | 复杂度 |
|------|------|:---:|:---:|:---:|
| 单 Token 长有效期 | accessToken 设为 7 天 | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| 双 Token（推荐） | accessToken 30min + refreshToken 7d | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 滑动过期 | 每次请求自动续期 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| 前端静默刷新 | 前端拦截 401 自动换 Token | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

## 方案 1：双 Token 机制（推荐）

```
┌────────────────────────────────────────────────────┐
│                                                     │
│  accessToken（短期）         refreshToken（长期）      │
│  有效期：30 分钟              有效期：7 天              │
│  用途：每次请求携带            用途：只用于换取新 accessToken│
│  暴露频率：高                 暴露频率：低              │
│                                                     │
│  流程：                                              │
│  1. 用户登录 → 返回 accessToken + refreshToken        │
│  2. 正常请求 → 带 accessToken                        │
│  3. accessToken 过期 → 前端收到 401                   │
│  4. 前端用 refreshToken 请求 /auth/refresh            │
│  5. 返回新的 accessToken（旧 refreshToken 不变或刷新）  │
│  6. 前端用新 accessToken 重试原请求                   │
│                                                     │
└────────────────────────────────────────────────────┘
```

### 更新登录接口

```typescript
// src/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    // 短期 Token（访问用）
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30m',
    });

    // 长期 Token（刷新用）
    const refreshToken = this.jwtService.sign(
      { sub: user.id },  // refreshToken 只放最小信息
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        jwtid: `${user.id}-${Date.now()}`,  // 唯一 ID 用于撤销
      },
    );

    const { password: _, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      expiresIn: 30 * 60,  // 30 分钟，秒为单位（前端用）
      user: userWithoutPassword,
    };
  }
}
```

### 实现刷新接口

```typescript
// src/auth/auth.controller.ts
import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('请提供 refreshToken');
    }

    try {
      // 验证 refreshToken
      const payload = this.jwtService.verify(refreshToken);

      // 签发新的 accessToken
      const newAccessToken = this.jwtService.sign(
        {
          sub: payload.sub,
          username: payload.username,
          role: payload.role,
        },
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '30m' },
      );

      return {
        accessToken: newAccessToken,
        expiresIn: 30 * 60,
      };
    } catch (error) {
      throw new UnauthorizedException('refreshToken 无效或已过期，请重新登录');
    }
  }
}
```

### 前端自动刷新拦截器

```typescript
// 前端 axios 拦截器（Vue/React 通用）
import axios from 'axios';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// 响应拦截器——自动刷新 Token
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // 只处理 401 且不是刷新接口本身
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 已有刷新请求在进行中，排队等待
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axios(originalRequest);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post('/auth/refresh', { refreshToken });

        // 更新存储的 Token
        localStorage.setItem('accessToken', data.accessToken);

        // 处理等待队列
        processQueue(null, data.accessToken);

        // 重试原请求
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // refreshToken 也过期了 → 跳转登录
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

## 方案 2：单 Token + 每次请求续期

```typescript
// 简单的"滑动过期"实现
// 每次验证通过后，如果 Token 剩余时间不足一半，签发新 Token

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // ... 验证逻辑

    const payload = await this.jwtService.verifyAsync(token);

    // 检查剩余有效期
    const now = Math.floor(Date.now() / 1000);
    const remainingTime = payload.exp! - now;
    const totalTime = payload.exp! - payload.iat!;

    // 剩余不足一半时，通过响应头返回新 Token
    if (remainingTime < totalTime / 2) {
      const newToken = this.jwtService.sign({
        sub: payload.sub,
        username: payload.username,
        role: payload.role,
      });
      request.res!.setHeader('X-New-Token', newToken);
    }

    request.user = payload;
    return true;
  }
}
```

前端拦截器检测响应头自动更新 Token：

```typescript
axios.interceptors.response.use(response => {
  const newToken = response.headers['x-new-token'];
  if (newToken) {
    localStorage.setItem('accessToken', newToken);
  }
  return response;
});
```

## 方案对比总结

```
双 Token 机制（推荐）：
  ✅ accessToken 泄露影响有限（30分钟过期）
  ✅ refreshToken 使用频率低，泄露风险小
  ✅ 可实现 Token 撤销（将 refreshToken 加入黑名单）
  ❌ 前端需要额外的刷新逻辑
  ❌ 实现稍复杂

单 Token 滑动过期：
  ✅ 实现简单
  ✅ 前端基本无感
  ❌ Token 长期有效，泄露风险高
  ❌ 无法主动撤销某个 Token
```

> 图书管理系统推荐使用**双 Token 机制**，这也是业界主流做法（GitHub、Auth0、微信开放平台都用类似方案）。

---

## 参考链接

- [NestJS — Authentication](https://docs.nestjs.com/security/authentication)
- [Auth0 — Refresh Tokens](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
- [OWASP — Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
