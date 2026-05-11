# AOP 思想详解

## 引子：一段糟糕的代码

假设我们要为图书管理系统的每个接口加上"打印请求日志"和"检查用户是否登录"：

```typescript
@Controller('book')
export class BookController {
  @Get('list')
  async list(@Req() req: Request) {
    // 日志（重复代码 1）
    console.log(`[${new Date().toISOString()}] GET /book/list from ${req.ip}`);

    // 权限检查（重复代码 2）
    if (!req.headers.authorization) {
      throw new UnauthorizedException('请先登录');
    }

    // 真正的业务逻辑
    return this.bookService.findAll();
  }

  @Get(':id')
  async findById(@Req() req: Request, @Param('id') id: string) {
    // 日志（又重复了）
    console.log(`[${new Date().toISOString()}] GET /book/${id} from ${req.ip}`);

    // 权限检查（又重复了）
    if (!req.headers.authorization) {
      throw new UnauthorizedException('请先登录');
    }

    return this.bookService.findById(id);
  }

  // 100 个接口意味着日志和权限检查写了 100 遍
}
```

**问题清单**：
1. 代码重复：100 个接口 = 200 行重复的日志+权限代码
2. 关注点混合：Controller 应该只关心"协调请求/响应"，不应该管"怎么打日志"
3. 修改地狱：如果日志格式要改，要改 100 个地方
4. 容易遗漏：新增接口时忘了加权限检查，就是安全漏洞

## AOP 是什么

**AOP（Aspect-Oriented Programming，面向切面编程）** 的核心思想：将通用逻辑从业务代码中**横向切割**出来，放在独立的"切面"中管理。

```
传统纵向结构：               AOP 横向切面：
┌──────────────────┐        ┌──────────────────┐
│  BookController   │        │   Middleware     │ ← 日志、CORS
│  ├── 日志代码      │        ├──────────────────┤
│  ├── 权限代码      │        │   Guard          │ ← 权限
│  ├── 📦 业务逻辑   │        ├──────────────────┤
│  └── 异常处理      │        │   Interceptor    │ ← 响应格式化
├──────────────────┤        ├──────────────────┤
│  UserController   │        │   Pipe           │ ← 参数校验
│  ├── 日志代码      │        ├──────────────────┤
│  ├── 权限代码      │        │   ExceptionFilter│ ← 异常处理
│  ├── 📦 业务逻辑   │        └──────────────────┘
│  └── 异常处理      │              ↓
└──────────────────┘        横切所有 Controller
```

**一句话总结**：AOP = 把"跟业务无关、但跟所有接口有关"的代码抽离到切面中，业务代码只保留核心逻辑。

## 前端视角的 AOP 类比

前端同学其实一直在用 AOP，只是不叫这个名字：

### 1. Vue Router 导航守卫 → Nest Guard

```typescript
// Vue Router — 全局前置守卫
router.beforeEach((to, from, next) => {
  if (!store.state.user.token && to.meta.requiresAuth) {
    next('/login');  // 未登录 → 跳转登录页
  } else {
    next();
  }
});
```

```typescript
// Nest Guard — 同样的模式
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.headers.authorization) {
      throw new UnauthorizedException('请先登录');
    }
    return true;
  }
}
```

**相同的模式**：在到达目标之前，先经过一个"守卫"做检查，不通过就拦截。

### 2. Axios 拦截器 → Nest Interceptor

```typescript
// Axios 响应拦截器
axios.interceptors.response.use(
  response => {
    // 统一处理数据格式
    return response.data;
  },
  error => {
    // 统一处理错误
    ElMessage.error(error.message);
    return Promise.reject(error);
  }
);
```

```typescript
// Nest Interceptor — 同样的模式
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({ code: 0, data, message: 'ok' })),  // 统一包装
    );
  }
}
```

**相同的模式**：在数据返回之前/之后，插入一段通用逻辑处理。

### 3. Vue 指令（Directive）→ Nest 装饰器

Vue 的 `v-permission` 指令可以控制 DOM 元素的显示/隐藏，Nest 的 `@UseGuards()` 装饰器控制接口的访问——本质上都是声明式的横切逻辑。

## AOP 的三种实现方式

| 方式 | 代表技术 | 特点 |
|------|---------|------|
| 编译时织入 | AspectJ（Java） | 编译时把切面代码插入到目标代码中，性能最好，语言支持有限 |
| 运行时代理 | Spring AOP（Java） | 基于动态代理，编译器无感，Nest 采用此方式 |
| 中间件管道 | Express/Koa/Nest | 基于洋葱模型/管道模型的中间件链 |

Nest 的 AOP 本质上是 **中间件管道模式的增强版**——它继承了 Express/Koa 的洋葱模型，同时加入了更丰富的切面类型。

## Nest AOP 的独特价值

普通的 Express/Koa 中间件只有一种切入方式（`app.use()`），所有通用逻辑都挤在同一层。Nest 将"通用请求处理"**细分成了 5 种独立的切面**，每种有明确的职责：

| 如果你用 Express | 如果你用 Nest |
|-----------------|--------------|
| 所有逻辑都堆在中间件里 | Middleware 做请求增强（body-parser/cors） |
| 手写 if/else 校验参数 | ValidationPipe 自动校验 + 转换 |
| 在每个路由里手写权限检查 | Guard 独立管理，声明式绑定 |
| 在每个路由里手写 try-catch | ExceptionFilter 全局兜底 |

这其实就是"关注点分离（Separation of Concerns）"在请求处理层面的体现——它让你每一层只做一件事。

> Day 7-11 我们将逐一击破这五大切面。学完之后你会发现：Nest 的架构设计之美，就美在这些切面的精妙分工中。

---

## 参考链接

- [NestJS — Middleware](https://docs.nestjs.com/middleware)
- [NestJS — Guards](https://docs.nestjs.com/guards)
- [NestJS — Interceptors](https://docs.nestjs.com/interceptors)
- [NestJS — Pipes](https://docs.nestjs.com/pipes)
- [NestJS — Exception Filters](https://docs.nestjs.com/exception-filters)
- 开源笔记：《Nest 通关秘籍》.doc/10.AOP架构.md
