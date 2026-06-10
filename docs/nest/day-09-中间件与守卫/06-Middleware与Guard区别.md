# Middleware vs Guard 核心区别

## 一句话总结

- **Middleware**："你不知道你拦截的是谁"——只知道 req/res，不知道是哪个 Controller 的哪个方法
- **Guard**："你知道你拦截的是谁"——知道精确到 Controller 和 Handler，能读取装饰器元数据

## 全维度对比表

| 维度 | Middleware | Guard |
|------|-----------|-------|
| **执行时机** | 最早（所有切面之前） | Middleware 之后，Interceptor 之前 |
| **能否访问 ExecutionContext** | ❌ 只有 req/res/next | ✅ 可以 |
| **能否知道 Handler 是谁** | ❌ | ✅ `context.getHandler()` |
| **能否知道 Controller 是谁** | ❌ | ✅ `context.getClass()` |
| **能否读取装饰器元数据** | ❌ | ✅ 通过 Reflector |
| **能否注入依赖** | ⚠️ Class 形式可以 | ✅ 可以 |
| **能否阻止请求** | ✅ 不调用 next() | ✅ 返回 false |
| **能否替换返回值** | ❌ | ❌（那是 Interceptor 的事） |
| **响应处理** | 只能调用 `next()` 或手动 `res.send()` | 返回 true/false / 抛异常 |
| **兼容 Express 生态** | ✅ 完全兼容 | ❌ Nest 特有 |
| **全局注册** | `app.use()` / `configure()` | `useGlobalGuards()` / `APP_GUARD` |
| **路由级应用** | 路径匹配 / Controller 匹配 | `@UseGuards()` 装饰器 |

## 什么时候用 Middleware？

```
Middleware 的职责边界：
├── 请求预处理
│   ├── CORS 头设置
│   ├── Body 解析（body-parser/json）
│   ├── Cookie/Session 解析
│   └── 压缩（compression）
│
├── 请求增强
│   ├── 添加 requestId
│   ├── 添加请求开始时间戳
│   └── 设置自定义响应头
│
└── 全局限流
    └── 基于 IP 的 rate-limit
```

## 什么时候用 Guard？

```
Guard 的职责边界：
├── 鉴权
│   ├── 检查 token 是否存在
│   ├── 验证 JWT 合法性
│   └── 将用户信息挂载到 request
│
├── 角色/权限
│   ├── 读取 @RequireRole() 元数据
│   ├── 检查用户是否拥有必要角色
│   └── 检查用户是否拥有必要权限
│
└── 条件放行
    ├── 公开接口跳过鉴权（@IsPublic()）
    └── 开发环境跳过鉴权
```

## 为什么 Guard 能取代 Middleware 的某些功能？

很多人在 Express 中用 Middleware 做鉴权，但 Nest 用 Guard 更好：

```typescript
// ❌ Express 风格：Middleware 做鉴权
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // 问题：所有路由都要鉴权，无法声明"这个路由不需要 auth"
  // 只能用 if (req.path === '/login') 这样的硬编码
  next();
}

// ✅ Nest 风格：Guard + 装饰器
@Controller('user')
export class UserController {
  @Post('register')
  @IsPublic()  // ← 声明式：这个方法不需要鉴权
  register() {}

  @Post('login')
  @IsPublic()  // ← 声明式
  login() {}

  @Get('profile')
  // 没有 @IsPublic() → 需要鉴权
  profile() {}
}

// Guard 中：
canActivate(context) {
  const isPublic = this.reflector.get('isPublic', context.getHandler());
  if (isPublic) return true;  // 自动跳过公开接口
  // ...
}
```

**Nest 的优势**：权限声明就写在接口旁边，不需要维护一个"白名单路径数组"。

## 选择决策树

```
需要处理的逻辑满足以下条件吗？
├── 所有路由统一处理（无例外）？
│   └── YES → Middleware（如 CORS、helmet、compression）
│
├── 需要根据具体路由做不同处理？
│   └── YES → Guard
│
├── 需要访问 req/res 做底层操作？
│   └── YES → Middleware
│
├── 需要读取 Controller/Handler 上的装饰器信息？
│   └── YES → Guard
│
├── 与权限/鉴权相关？
│   └── YES → Guard
│
└── 与 Express 生态兼容？
    └── YES → Middleware
```

## 实战：图书管理系统的拆分

| 需求 | 用哪个 | 原因 |
|------|--------|------|
| CORS 跨域 | Middleware | 所有接口都需要，无需区分路由 |
| Helmet 安全头 | Middleware | 所有接口都需要 |
| Cookie 解析 | Middleware | 底层 req/res 操作 |
| 限流（登录 3次/分钟） | Middleware | 基于路径+IP，不需要装饰器元数据 |
| Token 验证 | Guard | 需要知道哪些接口是 `@IsPublic()` |
| 角色检查 | Guard | 需要读 `@RequireRole()` 元数据 |
| 权限检查 | Guard | 需要读 `@RequirePermission()` 元数据 |

> 好的架构让每一层做自己最擅长的事。Middleware 处理底层 HTTP，Guard 处理业务鉴权。

---

## 参考链接

- [NestJS — Middleware](https://docs.nestjs.com/middleware)
- [NestJS — Guards](https://docs.nestjs.com/guards)
- [NestJS — Execution Context](https://docs.nestjs.com/fundamentals/execution-context)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md
