# @IsPublic() 标记公开接口

## 问题

AuthGuard 全局注册后，所有接口都需要认证——但**登录和注册接口不应该需要认证**（用户还没有 Token）。

## 解决方案：@IsPublic() 装饰器

```typescript
// src/auth/is-public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);
```

## 在 AuthGuard 中读取

```typescript
// src/auth/auth.guard.ts（关键部分）
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,  // ← 用于读取 metadata
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否 @IsPublic()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),   // 方法级别优先
      context.getClass(),     // 类级别兜底
    ]);

    if (isPublic) {
      return true;  // 公开接口，跳过认证
    }

    // ... 正常认证逻辑
  }
}
```

## 在 Controller 中使用

```typescript
// src/user/user.controller.ts
@Controller('user')
export class UserController {
  @Post('register')
  @IsPublic()  // ← 注册不需要认证
  async register(@Body() body: RegisterUserDto) {
    return this.userService.register(body);
  }

  @Post('login')
  @IsPublic()  // ← 登录不需要认证
  async login(@Body() body: LoginUserDto) {
    return this.authService.login(body.username, body.password);
  }

  @Get('profile')
  // 没有 @IsPublic() → 需要认证
  async profile(@CurrentUser() user: JwtPayload) {
    return this.userService.findById(user.sub);
  }
}

// src/auth/auth.controller.ts
@Controller('auth')
export class AuthController {
  @Post('refresh')
  @IsPublic()  // ← 刷新 Token 不需要认证（此时 accessToken 已过期）
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
```

## 也可以标记整个 Controller

```typescript
@Controller('book')
@IsPublic()  // ← 整个 BookController 公开
export class BookController {}

// 但如果想标记某个方法需要认证：
@Controller('book')
export class BookController {
  @Get('list')
  @IsPublic()
  async list() {}  // 公开

  @Post('create')
  // 不标记 @IsPublic() → 需要认证
  async create() {}
}
```

## `getAllAndOverride` vs `getAllAndMerge`

```typescript
// getAllAndOverride：方法级别覆盖类级别
// 类标记 @IsPublic()，方法不标记 → 方法不是公开的
// 类不标记，方法标记 @IsPublic() → 方法是公开的

// getAllAndMerge：合并所有级别
// 适合 @RequireRoles(['admin']) 这种需要叠加的场景（Day 21）
```

对于 `@IsPublic()`，使用 `getAllAndOverride` 是正确的——方法级别应该能覆盖类级别。

## 应用了 AuthGuard 后的图书管理系统接口

```
需要认证：                            不需要认证（@IsPublic）：
POST /book/create                    POST /user/register
POST /book/update                    POST /user/login
POST /book/delete                    POST /auth/refresh
POST /book/upload-cover              GET  /book/list        ← 可选公开
POST /borrow/borrow                  GET  /book/detail      ← 可选公开
POST /borrow/return
GET  /borrow/my-borrows
GET  /borrow/history
GET  /user/profile

具体哪些列表/详情接口需要登录，根据业务需求决定。
这里示例将列表和详情设为公开，借阅相关操作必须登录。
```

## 最终 BookController 示例

```typescript
// src/book/book.controller.ts
@Controller('book')
export class BookController {
  constructor(private readonly bookService: BookService) {}

  @Get('list')
  @IsPublic()  // 浏览图书不需要登录
  async list(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.bookService.list({
      page: page ? parseInt(page, 10) : 1,
      size: size ? parseInt(size, 10) : 10,
      keyword,
    });
  }

  @Get('detail')
  @IsPublic()  // 查看详情不需要登录
  async detail(@Query('id') id: string) {
    return this.bookService.findById(parseInt(id, 10));
  }

  @Post('create')
  // 需要登录（默认）
  async create(
    @Body() body: Prisma.BookCreateInput,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookService.create(body);
  }
}
```

## 前端对应的路由守卫

```typescript
// 前端 Vue Router 的路由守卫类比
const routes = [
  { path: '/login', component: Login, meta: { public: true } },  // @IsPublic()
  { path: '/register', component: Register, meta: { public: true } }, // @IsPublic()
  { path: '/books', component: BookList },  // 需要登录
];

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('accessToken');
  if (to.meta.public) {
    next();  // 公开页面直接放行
  } else if (token) {
    next();  // 已登录放行
  } else {
    next('/login');  // 未登录跳转
  }
});
```

```
前后端对应关系：

前端路由守卫 (beforeEach)     ↔  Nest AuthGuard
前端 meta: { public: true }  ↔  @IsPublic()
前端 localStorage Token       ↔  Authorization Header
前端 401 拦截跳转登录          ↔  Nest 401 UnauthorizedException
```

---

## 参考链接

- [NestJS — Guards](https://docs.nestjs.com/guards)
- [NestJS — Reflection and Metadata](https://docs.nestjs.com/fundamentals/execution-context#reflection-and-metadata)
