上一章我们比完了两种登录状态保存方式，但只有一张对比表是没用的——你得真的把两条路各跑通一次，才知道"用起来"的差别在哪。

这一章把 Session 和 JWT 都实现进 Nest，并且刻意做成**同一个 controller 能在两种模式下跑**。原因很现实：老项目迁移到 Nest 时，后端还在写 session，新接口已经想用 JWT；或者反过来，你想先上 JWT，但后台管理页还依赖 cookie。如果两种身份在代码里长成两个样子，`@CurrentUser()` 就得写两遍、每个 controller 都得判断"这次是哪种模式"，迁移永远做不完。

## 先看两条链路

```mermaid
flowchart TB
  subgraph S["Session 路线"]
    A1["POST /auth/login"] --> A2["bcrypt 校验通过"]
    A2 --> A3["req.session.userId = user.id"]
    A3 --> A4["Set-Cookie: sid=...; HttpOnly; SameSite=Lax"]
    A4 --> A5["GET /bookings<br/>浏览器自动带 Cookie"]
    A5 --> A6["SessionGuard 读 req.session.userId"]
    A6 --> A7["查 Redis 拿会话 → 查用户 → request.user"]
  end
  subgraph J["JWT 路线"]
    B1["POST /auth/login"] --> B2["bcrypt 校验通过"]
    B2 --> B3["签发 access(15m) + refresh(7d)"]
    B3 --> B4["响应体返回 token"]
    B4 --> B5["GET /bookings<br/>Authorization: Bearer ..."]
    B5 --> B6["JwtStrategy 验签 + 校验 type=access"]
    B6 --> B7["按 sub 查用户 → request.user"]
  end
```

两条路在"拿到身份"之后完全一样，差别只在**凭证怎么来**和**服务端要不要存**。抓住这一点，后面的代码就都好理解了。

## 路线一：express-session 接进 Nest

Nest 没有内置 session 中间件，因为 session 是平台层的东西。Express 平台下就是官方的 `express-session`，存储换成 Redis：

```bash
pnpm add express-session@1.19.0 connect-redis@11.0.0 redis@5
pnpm add -D @types/express-session@1.19.0
```

`connect-redis@11` 的 peer 依赖写的是 `redis >= 5`，也就是 **node-redis** 客户端，不是 ioredis。这一点很关键，后面"坑"那一节会专门讲。

在 `main.ts` 里挂上，顺序在路由之前、在任何需要 session 的守卫之前：

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import { AppModule } from './app.module.js';

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' });
await redis.connect();

const app = await NestFactory.create(AppModule);
app.set('trust proxy', 1);
app.use(
  session({
    store: new RedisStore({ client: redis, prefix: 'sess:' }),
    name: '__Host-sid',
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);
app.enableCors({ origin: process.env.CORS_ORIGINS!.split(','), credentials: true });
await app.listen(process.env.PORT ?? 3000);
```

逐个说清这几个参数，它们就是上一章那张表里"细节做没做对"的具体项：

- `resave: false`：请求没改过 session 就不重新写回存储。设成 `true` 会让每个请求都产生一次 Redis 写入，等于自己制造热点 key。
- `saveUninitialized: false`：没登录的访客不分配 session。不设的话，爬虫每来一次就在 Redis 里留一个空会话。
- `rolling: true`：每次访问刷新过期时间。效果是"7 天内活跃就不掉线"，而不是"登录 7 天后强制重登"。
- `cookie.secure: true` + `app.set('trust proxy', 1)`：这两个是一对。前面有 Nginx/Cloudflare 终止 TLS 时，Node 看到的连接是 HTTP，不设 trust proxy 它就不肯种 `secure` cookie，现象是**登录接口 200 但下一个请求就 401**。这个坑每年都要坑一批人。
- `name: '__Host-sid'`：`__Host-` 前缀由浏览器强制校验（必须 Secure、必须 Path=/、不能带 Domain），能从根上防住子域覆盖 cookie。

Session 里存什么、怎么取？先扩展类型，否则 `req.session.userId` 在 strict TS 下直接报错：

```ts
// src/types/express-session.d.ts
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: 'ADMIN' | 'USER';
    loginAt?: number;
  }
}

export {};
```

那个 `export {}` 不能省。在 ESM 的 `nodenext` 模式下，`.d.ts` 里只有 import/export 才算模块，否则 `declare module` 会被当成"重新声明整个模块"，你原来的 `SessionData` 定义就全丢了——报错长得像"Property 'session' does not exist on type 'Request'"。

登录/登出就是直接写 session：

```ts
// src/modules/session-auth/session-auth.controller.ts
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { LoginDto } from '../auth/dto/login.dto.js';

@Controller('session-auth')
export class SessionAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.auth.validateUser(dto.email, dto.password);
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.loginAt = Date.now();
    return { userId: user.id };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request) {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });
    return { success: true };
  }
}
```

然后是守卫。注意它和 `AuthGuard('jwt')` 是两套东西，这里是自己读 session：

```ts
// src/modules/session-auth/session-auth.guard.ts
import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const userId = req.session.userId;
    if (!userId) {
      throw new UnauthorizedException('未登录或会话已过期');
    }
    const user = await this.users.findById(userId);
    if (!user) {
      req.session.destroy(() => undefined);
      throw new UnauthorizedException('用户不存在或已被删除');
    }
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    return true;
  }
}
```

这里查一次库是故意的：session 里只存了 `userId`，用户被删、被改角色时，下一次请求立刻取到最新状态。如果图省事把整个用户对象塞进 session，就变成了"改角色要等用户重登才生效"。

`connect-redis` 这条路线跑得通，但你要接受一个新的运行时依赖：为了 session 多装一个 node-redis 客户端。项目里已经在用 ioredis（缓存、限流、refresh 撤销都用它），两个 Redis 客户端并存意味着两份连接池、两套重连日志。如果不想这样，就自己实现 store——`express-session` 只要求对象实现 `get/set/destroy/touch` 四个方法：

```ts
// src/modules/session-auth/ioredis-session.store.ts
import { type SessionData, type Store } from 'express-session';
import type { Redis } from 'ioredis';

export class IoredisSessionStore extends Store {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = 7 * 24 * 60 * 60,
  ) {
    super();
  }

  override get(sid: string, cb: (err: unknown, session?: SessionData | null) => void): void {
    this.redis
      .get(`sess:${sid}`)
      .then((raw) => cb(null, raw ? (JSON.parse(raw) as SessionData) : null))
      .catch((err) => cb(err));
  }

  override set(sid: string, session: SessionData, cb?: (err?: unknown) => void): void {
    this.redis
      .set(`sess:${sid}`, JSON.stringify(session), 'EX', this.ttlSeconds)
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  override destroy(sid: string, cb?: (err?: unknown) => void): void {
    this.redis
      .del(`sess:${sid}`)
      .then(() => cb?.())
      .catch((err) => cb?.(err));
  }

  override touch(sid: string, session: SessionData, cb?: () => void): void {
    void this.redis.expire(`sess:${sid}`, this.ttlSeconds).then(() => cb?.());
  }
}
```

四十行，换来"只有一个 Redis 客户端"。这也解释了第 54 章为什么先讲存储机制：**选型不是选库，是选你要维护多少东西**。

### 会话本身也会被劫持：登录后必须换 sid

Session 路线有一个很多教程不提、但渗透测试必查的问题：**会话固定（Session Fixation）**。攻击者先访问站点拿到一个 sid，然后想办法让受害者用这个 sid 登录（把 `?sid=` 塞进链接、或者利用子域写 cookie）。受害者一登录，服务端就把 `userId` 写进了攻击者已知的 sid——攻击者不用偷任何东西，直接拿这个 sid 就是受害者身份。

修法只有一句：**登录成功后重新生成 sid**，旧 sid 作废。

```ts
// 登录成功之后，写 session 之前
await new Promise<void>((resolve, reject) => {
  req.session.regenerate((err) => (err ? reject(err) : resolve()));
});
req.session.userId = user.id;
```

`regenerate` 会删掉旧记录、生成新 sid、重新下发 cookie。代价是登录请求的响应多一次 Redis 往返，收益是"劫持者拿到的 sid 登录后失效"。同理，改密码、提权（普通用户变管理员）之后也应该 `regenerate`，这是很多后台系统的审计要求。

还有一个更隐蔽的坑：**同一 sid 的并发写**。用户的浏览器同时发两个请求，各自读到 session、各自修改、各自写回，存储层是 last-write-wins，后写的那份覆盖前一份。表现是"多开两个标签页，购物车里的东西莫名其妙少了"。`express-session` 没有内置的乐观锁，常见缓解有三种：把会话数据拆小（大对象放 Redis 的其他 key，session 只存指针）、给 session 加 `version` 字段做校验失败重试、或者干脆接受它——先把会话设计成"幂等的少量字段"，比事后修竞态便宜得多。

## 路线二：JWT 走 passport，状态放在客户端

```bash
pnpm add @nestjs/jwt@12.0.5 @nestjs/passport@12.0.0 passport@0.7.0 passport-jwt@4.0.1
pnpm add -D @types/passport-jwt@4.0.1
```

模块里用 `registerAsync`，把密钥从 `ConfigService` 拿——不要在模块文件里读 `process.env`，那样配置校验（第 60 章）就形同虚设：

```ts
// src/modules/auth/auth.module.ts（节选）
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.accessSecret'),
        signOptions: { expiresIn: config.getOrThrow<string>('jwt.accessExpiresIn') },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

策略就是"验签 + 把 payload 翻译成用户"：

```ts
// src/modules/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import passportJwt from 'passport-jwt';
import type { AuthUser, JwtPayload } from '../../common/types/auth-user.js';
import { UsersService } from '../users/users.service.js';

const { ExtractJwt, Strategy } = passportJwt;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('token 类型不正确');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('用户不存在或已被删除');
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
```

`payload.type !== 'access'` 这一句是防"拿 refresh token 当 access 用"。同一个密钥签出来两种令牌，如果不区分类型，refresh（7 天有效）就能直接当 access 访问业务接口，短过期就白设计了。

## 想让 JWT 立刻失效，只有三条路

JWT 最大的卖点是"服务端不存状态"，最大的代价也在这：**签发之后、过期之前，它在数学上一直有效**。想让它立刻失效，只能重新引入状态，区别只是把状态放在哪、代价多大。

**路一：黑名单（revoked jti）。** 登出时把 refresh 的 `jti` 写进 Redis，TTL 设为它剩余的有效期；校验时先查一次。这就是第 54 章和后面第 56 章用的方案——严格说它已经不是纯无状态了，但只对"登出/撤销"这类低频动作查，属于务实做法。

**路二：tokenVersion（改密码/踢全部设备）。** 给用户表加一个自增的版本号，签发时写进 payload，校验时和缓存里的值比：

```ts
// src/modules/auth/jwt.strategy.ts（validate 内，节选追加）
const currentVersion = await this.redis.get(`user:${payload.sub}:ver`);
if (currentVersion !== null && Number(currentVersion) !== payload.ver) {
  throw new UnauthorizedException('登录状态已失效，请重新登录');
}
```

改密码时 `UPDATE users SET token_version = token_version + 1`，并删掉缓存 key，所有旧令牌下一秒全部失效。想让"踢人"在多少秒内生效，就把这个缓存 TTL 设成多少——**用延迟换 QPS**，这是工程上最诚实的表达。

**路三：短 access + refresh 轮换。** access 只给 5–15 分钟，撤销 refresh 就等于"最多 15 分钟后彻底下线"。这个方案不查任何东西，但用户能感知到的延迟就是 access 的 TTL，适合"安全要求高、但可以接受短暂残留"的场景。

三条路没有优劣，只有"你要多快生效"和"你愿意付多少每次请求的查询成本"。第 59 章会把第三条路写完整（refresh 轮换 + 重放检测），那是本项目的默认方案。

全局守卫 + 白名单放行：

```ts
// src/common/guards/jwt-auth.guard.ts
import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    return isPublic ? true : super.canActivate(context);
  }
}
```

在 `AppModule` 里注册成全局，默认全站要登录，需要公开的接口挂 `@Public()`：

```ts
// src/app.module.ts（节选）
{ provide: APP_GUARD, useClass: JwtAuthGuard }
```

注意 `APP_GUARD` 的注册顺序就是执行顺序。如果后面还要加 `RolesGuard`、`ThrottlerGuard`，**认证一定排在授权前面**，否则 RBAC 拿到的是 `undefined` 的 `request.user`。

取当前用户用自定义装饰器，controller 里不再碰 `req`：

```ts
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../types/auth-user.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user,
);
```

## 关键一步：让两种身份长得一样

现在两条路都通了，但 controller 里一个读 `req.user`（JWT 策略塞的），一个也需要 `req.user`——只要 Session 守卫也按同样格式塞，controller 就完全不需要知道凭证从哪来：

```ts
// src/modules/bookings/bookings.controller.ts（节选）
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('mine')
  findMine(@CurrentUser() user: AuthUser) {
    return this.bookings.findByUser(user.id);
  }
}
```

同一个方法，挂 `@UseGuards(JwtAuthGuard)` 就是 JWT 模式，挂 `@UseGuards(SessionAuthGuard)` 就是 Session 模式，业务代码一行不改。迁移期最舒服的形态是：老页面走 Session 路由，新接口走 JWT 路由，两套守卫共存，等所有调用方迁完再删掉一边。

这也是为什么前面 Session 守卫里要 `req.user = {...}`——**把"凭证解析"和"身份使用"解耦**，是这一步唯一要做的事。

## 怎么量出两条路的差别

不要凭感觉说"JWT 更快"。同一台机器上量一下，只需要 curl：

```bash
# session 路径：登录一次保存 cookie，然后循环打受保护接口
for i in $(seq 1 20); do
  curl -s -o /dev/null -b /tmp/sid.txt -w '%{time_total}\n' http://127.0.0.1:3000/api/bookings/mine
done | sort -n | sed -n '10p'
```

JWT 路径把 `-b /tmp/sid.txt` 换成 `-H "Authorization: Bearer $TOKEN"`，其余不变。你大概会看到两条路的耗时在同一个量级（本地几十毫秒，瓶颈是 PG 查询而不是凭证校验）。这说明**凭证方式的选择不该由性能决定**——真正决定它的是撤销语义、跨端支持和部署形态。

（以上耗时未在本机实测，只给方法；量的时候注意先预热，第一次请求包含连接建立，会把中位数带偏。）

## 一个容易被忽略的成本：换平台的代价不一样

第 16 章讲过 Nest 可以换 HTTP 平台，express / fastify / 新版 NodeAdapter 都行。但"换平台"对这两条路线的影响完全不对称：

- **JWT 路线几乎无感**。`ExtractJwt.fromAuthHeaderAsBearerToken()` 读的是请求头，换平台只是 `Request` 类型变了，验签逻辑一行不改。
- **Session 路线要重做存储层**。`express-session` 是 Express 的中间件，Fastify 适配器要靠 `@fastify/middie` 把中间件桥接过去；而 Fastify 生态里更常见的是 `@fastify/secure-session`——它把整个会话塞进**签名 cookie**，根本不落服务端存储。名字都叫 session，语义完全不同：前者"客户端只拿钥匙"，后者"状态全在客户端，只是加密签名过"。

这意味着：如果你打算以后迁 Fastify，Session 路线现在选的库迟早要重写；如果确定长期留在 Express（或只是 NodeAdapter），那 express-session 就是最省事的选择。**选型表里"性能"那一行走得快，"换平台成本"这一行才是几年后真正疼的地方。**

## 双跑期怎么排 401

两种守卫共存时，最难的不是写，是排查。建议在认证失败时给出**可区分的文案**（而不是统一的 `Unauthorized`），排查顺序会清晰很多：

| 响应 message | 含义 | 先查什么 |
| --- | --- | --- |
| 未登录或会话已过期 | Session 里没有 `userId` | cookie 是否带上、`trust proxy`、sid 是否过期 |
| token 类型不正确 | 拿 refresh 当 access | `type` 字段、前端是否把两个 token 存反了 |
| 用户不存在或已被删除 | 令牌有效但用户没了 | 数据库、删号逻辑是否该同时撤销 refresh |
| 登录状态已失效 | tokenVersion 不匹配 | 改密码流程是否正确递增了版本号 |

最后一条经验：排 401 时**先复现、再猜**。用 curl 手动带上凭证打一次，比读十遍守卫代码快——因为 401 的原因九成在"请求里根本没带凭证"，而不是判定逻辑写错。

## 上线前的安全清单

## 上线前的安全清单

| 检查项 | Session 路线 | JWT 路线 |
| --- | --- | --- |
| 传输 | `Secure` + HTTPS | 只走 HTTPS，`Authorization` 头不进 URL |
| 脚本读取 | `HttpOnly` | 令牌不要放 `localStorage`（XSS 可直接偷） |
| 跨站 | `SameSite=Lax` + 写操作校验 Origin | 不用 cookie 就天然免疫 CSRF |
| 固定攻击 | 登录后 `regenerate` sid | 不适用（无 sid） |
| 迭代/撤销 | `destroy` 即失效 | 黑名单 / tokenVersion / 短 access 三选一 |
| 泄漏面 | sid 出现在 cookie 里 | payload 是 Base64，**不是密文**，不放手机号/身份证 |
| 日志 | 不记录 cookie | 代理/网关日志脱敏 `Authorization` |
| 爆破 | 登录接口限流 + 失败计数 | 同左 |

清单里有两项是最容易漏的：`localStorage` 存 token，和日志里打印 `Authorization`。前者把 XSS 从"偷 cookie"升级成"直接偷长期凭证"，后者是内部人员/日志平台的越权入口——两者都属于"代码里完全看不出问题、出事时才发现"的类型。

## checkpoint：两条路各跑一遍

先起服务（需要 Redis 和 PG，见第 4 章 compose 文件）：

```bash
pnpm start:dev
# 预期：Nest application successfully started，日志里能看到 Redis 连接成功
```

Session 路线——注意 `-c` 保存 cookie，`-b` 回传 cookie：

```bash
# 1) 登录，拿到 Set-Cookie
curl -i -c /tmp/sid.txt -X POST http://127.0.0.1:3000/api/session-auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Passw0rd!"}'
# 预期：HTTP/1.1 200，响应头含 set-cookie: __Host-sid=...; HttpOnly; Secure; SameSite=Lax

# 2) 带 cookie 访问受保护接口
curl -s -b /tmp/sid.txt http://127.0.0.1:3000/api/bookings/mine
# 预期：200 + 当前用户的预订数组

# 3) 不带 cookie
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/bookings/mine
# 预期：401
```

JWT 路线：

```bash
# 1) 登录拿 token
TOKEN=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Passw0rd!"}' | jq -r '.data.accessToken')

# 2) 带 token
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3000/api/bookings/mine | head -c 200

# 3) 用 refresh token 冒充 access（应被 type 检查拦下）
REFRESH=$(curl -s -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"Passw0rd!"}' | jq -r '.data.refreshToken')
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $REFRESH" http://127.0.0.1:3000/api/bookings/mine
# 预期：401
```

第 3 步值得单独跑一次。它是"两种令牌同密钥"这个设计唯一的风险点，也是很多线上事故的入口。

## 坑表

| 现象 | 原因 | 修法 |
| --- | --- | --- |
| 登录 200，下个请求 401 | `secure` cookie 在 HTTP 连接上不下发 | `app.set('trust proxy', 1)`，或本地临时 `secure: false` |
| 浏览器跨域请求不带 cookie | CORS 没开 `credentials`，或 `origin: '*'` | `enableCors({ origin: [具体域名], credentials: true })` 且前端 `credentials: 'include'` |
| `req.session` 类型报错 | `.d.ts` 不是模块，`declare module` 覆盖了原定义 | 文件末尾 `export {}` |
| 每个请求都写一次 Redis | `resave: true` 或 `saveUninitialized: true` | 都设 `false`，需要延长寿命用 `rolling` |
| `connect-redis` 报 peer 冲突 | 项目用的是 ioredis，它要 node-redis ≥5 | 二选一：加 node-redis 客户端，或自写 store（本节给了） |
| JWT 验签拿不到用户 | `validate` 里没查库，用户删了仍能访问 | `validate` 里 `findById`，删号即失效 |
| 把 `@Public()` 加在类上不生效 | 只在 handler 上查元数据 | `getAllAndOverride` 按 `[handler, class]` 顺序查 |
| 守卫里 `request.user` 是 undefined | `APP_GUARD` 注册顺序错，授权跑在认证前 | 认证守卫先注册，或用 `@UseGuards(AuthGuard, RolesGuard)` 显式排序 |

<!-- chapter-nav:start -->
---

← 上一篇：[054 两种登录状态保存方式：JWT、Session](054-两种登录状态保存方式：JWT、Session.md) · [本 Part 目录](_part.md) · 下一篇：[056 PostgreSQL+Prisma8+JWT实现登录注册](056-PostgreSQL+Prisma8+JWT实现登录注册.md) →
<!-- chapter-nav:end -->
