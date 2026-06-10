# Node.js 服务端开发的三个层次

## 层次一：原生 http 模块 — 手动打造一切

Node.js 自带的 `http` 模块可以创建 Web 服务，但非常底层：

```typescript
import * as http from 'http';

const server = http.createServer((req, res) => {
  // 手动解析 URL
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // 手动路由匹配
  if (req.method === 'GET' && url.pathname === '/api/users') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([{ id: 1, name: 'John' }]));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/users') {
    // 手动解析 Body（Node.js 不会自动做这个）
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const user = JSON.parse(body);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 2, ...user }));
    });
    return;
  }

  // 手动 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

**这个层次的特点**：
- 一切手动：手动解析 URL、手动解析 Body、手动设置响应头、手动处理 CORS
- 没有中间件概念：所有逻辑混在一起
- 没有错误处理机制：一个未捕获异常整个进程崩溃
- 没有类型安全：`req` 和 `res` 都是 `any`

> 前端类比：原生 http 模块就像不用任何框架的 vanilla JS DOM 操作——`document.createElement('div')` 一步步手动来。能跑，但生产力极低。

## 层次二：Express/Koa — 中间件层

Express（2009）是 Node.js 生态的里程碑，引入了**中间件（Middleware）**模式：

```typescript
import express from 'express';

const app = express();

// 内置 Body 解析（不用手动读 stream 了）
app.use(express.json());

// 中间件：日志
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// 路由（不用手动 if-else 匹配 URL 了）
app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'John' }]);
});

app.post('/api/users', (req, res) => {
  const user = req.body;  // 自动解析 JSON
  res.status(201).json({ id: 2, ...user });
});

app.listen(3000);
```

**这个层次的进步**：
- `express.json()` → 自动解析 Body
- `app.get('/api/users', handler)` → 声明式路由
- `(req, res, next)` → 洋葱模型的中间件链
- `res.json()` / `res.status()` → 便捷的响应方法

**但这个层次仍然缺少**：
- 应用架构约束：Controller 写在哪？Service 写在哪？全凭约定
- 依赖注入：Service 之间怎么互相引用？只能手动 `require`
- 参数校验：每个路由都要手动 `if (!req.body.name) return res.status(400)...`
- 类型安全：`req.body` 的类型是 `any`，TypeScript 帮不上忙

Koa（2013）是 Express 团队的新作品，用 async/await 替代了回调风格的中间件。但本质上仍是中间件层，没有解决架构约束问题。

> 前端类比：Express/Koa 就像 jQuery——它让 DOM 操作更方便了，但没有提供组件化、状态管理这样的应用架构。

## 层次三：NestJS — 企业级架构框架

NestJS（2017）在 Express/Koa 之上加了一层**架构约束**：

```typescript
// Controller — 只负责路由和参数提取
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}  // 自动注入

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {  // 自动校验
    return this.userService.create(dto);
  }
}

// Service — 只负责业务逻辑
@Injectable()
export class UserService {
  findAll() { /* 查数据库 */ }
  create(dto: CreateUserDto) { /* 创建用户 */ }
}

// DTO — 只负责定义输入结构
export class CreateUserDto {
  @IsNotEmpty() name: string;
  @IsEmail() email: string;
}
```

**这个层次的突破**：
- **架构约束**：Controller/Service/DTO/Module 各司其职，不再全凭约定
- **依赖注入**：`constructor(private userService: UserService)` 自动注入，不需要手动 new
- **声明式校验**：`@IsNotEmpty()` 装饰器声明规则，自动校验
- **完全类型安全**：从 Controller 到 Service 到数据库，全程有类型提示

## 三层对比总结

| 维度 | 原生 http | Express/Koa | NestJS |
|------|----------|-------------|--------|
| 路由 | 手动 if-else | `app.get()` | `@Get()` 装饰器 |
| Body 解析 | 手动读 stream | `express.json()` | 内置（基于 express） |
| 参数校验 | 手动 if 判断 | 手动 if 判断 | `class-validator` 装饰器 |
| 架构约束 | 无 | 无（约定优于配置） | Module/Controller/Service 强制分层 |
| 依赖管理 | 手动 require | 手动 require | IoC 容器自动注入 |
| 类型安全 | 无 | 弱（body 是 any） | 强（DTO 类型 + Prisma 类型） |
| 测试 | 难 mock | 手动 mock | 内置 TestingModule 自动 mock |

## 为什么 Express 依然是 Nest 的底层？

Nest 默认使用 Express 作为 HTTP 平台。你写的 `@Get()` 装饰器最终会被 Nest 翻译成 `app.get()` 调用。这意味着：

1. Express 的中间件生态（cors、helmet、morgan 等）在 Nest 中**完全可用**
2. 如果你之前用过 Express，底层机制没有变——只是加了一层更优雅的封装
3. Nest 也可以切换到 Fastify（更快、更轻量），API 完全不变

> 这个关系就是 Nest 的精髓：**底层兼容 Express 生态，上层提供企业级架构**。

## 这个教程的目标

带你从层次二（如果你用过 Express）跨越到层次三。我们不会从零写 http 服务，而是直接进入 Nest 的世界——但你会看到那些底层概念（路由、中间件、请求处理）如何在 Nest 中以更优雅的方式呈现。

---

## 参考链接

- [Node.js 官方文档 — HTTP 模块](https://nodejs.org/docs/latest/api/http.html)
- [Express 官方文档](https://expressjs.com/)
- [Koa 官方文档](https://koajs.com/)
- [NestJS 官方文档 — Overview](https://docs.nestjs.com/)
- 开源笔记：《Nest 通关秘籍》.doc/1. 开篇词.md
