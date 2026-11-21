# 第 27 章 Node.js 中的 TypeScript

`node server.ts` 在 Node 26 能直接跑，但用了 `enum` 或参数属性就报 ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX；生产环境该不该编译也没有统一答案。这一章讲 Node 下运行 TS 的几条路径和生产配置。

Node.js 是 TypeScript 用得最多的后端运行时。Node 22.6 起自带类型剥离，`node app.ts` 可以直接跑。（见 [Node.js 的类型剥离文档](https://nodejs.org/api/typescript.html)）

不是所有代码都能直接跑。NestJS 这种用装饰器的框架要编译，或者交给 `tsx`。Prisma 生成的是 JS 加 `.d.ts`，原生剥离就能用。

## 运行 TypeScript 代码

`node app.ts` 能跑，靠的是类型剥离：删掉类型注解，剩下的 JavaScript 交给 V8。版本节点：

| Node 版本 | 变化 |
|---|---|
| 22.6.0 | 加入剥离，需要 `--experimental-strip-types` |
| 22.7.0 | 加入 `--experimental-transform-types`，能处理 `enum` 和 `namespace` |
| 23.6.0 / 22.18.0 | 默认开启，不用带 flag |
| 24.3.0 / 22.18.0 | 去掉 experimental 警告 |
| 25.2.0 / 24.12.0 | 转为 Stable |
| 26.0.0 | 移除 `--experimental-transform-types` |

26 只剩 `--no-strip-types` 一个开关。带旧 flag 会直接退出：

```bash
$ node --experimental-transform-types app.ts
node: bad option: --experimental-transform-types
```

加 `--no-strip-types` 关掉剥离，`.ts` 跑不起来：

```bash
$ node --no-strip-types app.ts
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts" for /private/tmp/nodedoc3/app.ts
```

能不能跑由语法决定，不由版本决定。三条路：Node 原生剥离、`tsx`、`tsc` 产物。

### Node 原生剥离

跑脚本、写小工具、临时验证用这条。不用装依赖，启动开销比 `tsx` 小。

```bash
node index.ts
node --watch index.ts
```

本机 Node 26.13.1，`ok.ts` 里是 `console.log(add(1, 2))`：

```bash
$ node ok.ts
3
```

它不做类型检查。参数写错了照样跑：

```ts
function greet(name: string): string {
  return "hi " + name;
}

console.log(greet(123)); // error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
```

```bash
$ node nocheck.ts
hi 123
```

类型检查交给 `tsc --noEmit`。

### 原生剥离的边界

判断标准一句话：这段语法会不会生成运行时代码。不生成就能删掉，生成就报错。

| 语法 | 结果 | 处理 |
|---|---|---|
| 类型注解、`interface`、`type`、`as const`、`satisfies`、泛型 | 可剥离 | 直接写 |
| 只有类型的 `namespace` | 可剥离 | 直接写 |
| `enum`、`const enum` | `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` | 改 `as const` 对象加联合类型 |
| 带值的 `namespace` | 同上 | 拆成独立模块 |
| 构造函数参数属性 | 同上 | 显式声明字段 |
| `import x = require()` | 同上 | 改 `import x from` |
| 装饰器 | `SyntaxError: Invalid or unexpected token` | 用 `tsx` 或 `tsc` |
| `.tsx` | `SyntaxError: Unexpected token '<'` | 用 `tsx` 或打包器 |

前四种报错都以 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` 开头。以 `enum` 为例：

```ts
enum Color { Red, Green }
console.log(Color.Red);
```

```text
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
```

`const enum` 报同一个错。另外三种的完整消息：

- 参数属性：`TypeScript parameter property is not supported in strip-only mode`
- 带值的 `namespace`：`TypeScript namespace declaration is not supported in strip-only mode`
- `import x = require`：`TypeScript import equals declaration is not supported in strip-only mode`

`import` 里的纯类型必须加 `type`。剥离只删注解，不做导入消除：

```text
SyntaxError: The requested module './types.ts' does not provide an export named 'User'
```

改成：

```ts
import type { User } from "./types.ts";
import { version } from "./types.ts";
```

开 `verbatimModuleSyntax` 后，`tsc` 会提前报这条错：

```text
error TS1484: 'User' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```

**tsconfig 完全不读**。`paths` 不生效：

```bash
$ node alias.ts
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@/math.ts' imported from /private/tmp/nodedoc2/alias.ts
```

用 `package.json` 的 `imports` 字段代替。路径以 `#` 开头，映射值带 `.ts`：

```json
{
  "type": "module",
  "imports": {
    "#lib/*": "./lib/*"
  }
}
```

```ts
import { add } from "#lib/math.ts";
```

`$ node app.ts` 输出 `3`（Node 26.13.1 实测）。

导入必须写扩展名。写成 `./src/math` 会报：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/private/tmp/nodedoc2/src/math' imported from /private/tmp/nodedoc2/noext.ts
```

`node_modules` 里的 `.ts` 也不处理：

```text
Error [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently unsupported for files under node_modules, for "file:///private/tmp/nodedoc2/node_modules/pkg/index.ts"
```

发 npm 包时出 `.js` 加 `.d.ts`，不能只发 `.ts`。

配合原生剥离的 tsconfig：

```json
{
  "compilerOptions": {
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

`erasableSyntaxOnly` 把不可剥离的语法报成 `error TS1294`。`package.json` 没写 `"type": "module"` 时，`.ts` 按 CommonJS 处理，`verbatimModuleSyntax` 会报 `error TS1287`。加 `"type": "module"` 即可。

边界细节和报错速查见第 33 章。

### 剥离器眼里没有 tsconfig

Node 的原生支持是个解析器，不是编译器前端。官方文档的原话是 `Node.js will replace TypeScript syntax with whitespace`，它把类型语法替换成空白，不做类型检查，也不建立符号表。

没有符号表，就做不了 `paths` 映射，也做不了降级转换。这两件事都依赖 tsconfig，所以它干脆不读。官方文档也写了 `Node.js ignores tsconfig.json files`。

替换成空白还有个副作用，行列位置不变。错误堆栈里的行号与源码一一对应，不需要额外生成 source map。转译会移动代码，就得维护映射，剥离不用。

想让剥离器读 tsconfig，等于让它实现路径解析与降级转换，这两件事都要完整的类型检查前端。原生支持的目标是零依赖运行，装不下这个前端，官方文档给出的方案是装 tsx 这类工具。

enum 被拒绝的原因在语义。enum 不只是类型，编译后要生成一个对象，还要有数字到名字的反向映射。替换成空白会把对象弄丢，运行时行为就变了。`namespace` 和构造器参数属性同理，它们都要求 emit 出新代码。装饰器的 `@` 连解析都过不去，报的是普通 `SyntaxError`。

Node 26 移除了 `--experimental-transform-types`，想要 enum 和装饰器的运行时行为，只能回到 tsc 编译或者 tsx 这类转译器。原生剥离的定位是不装工具也能跑，代价是语法子集窄。

还有一类静默错误。剥离器分不清值和类型，`import { Task } from "./model.js"` 里的 `Task` 如果只是 interface，运行时仍会去模块里找这个名字，找不到就报 `SyntaxError`。写法上要加 `import type`。

剥离器只处理语法层，类型错误在运行时不可见。`const n: number = "x"` 写成字符串，剥离后照样跑，错误不会在启动时报出来。这类风险要靠 `tsc --noEmit` 单独把关。

### 两处报错

同一份代码，tsc 和 node 报的错不一样，位置也不同。

```typescript
enum Status { Active, Closed }

class Task {
  constructor(private readonly title: string) {}
}
```

`tsc --noEmit --erasableSyntaxOnly` 报两条 `error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.`，分别指向 enum 和构造器参数属性。改用联合类型和显式字段即可。

直接 `node` 跑这个文件，报 `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode`。Node 是在解析到 enum 时抛出，后面的类根本没执行。

### 一句话理解剥离

剥离像用修正带涂掉草稿上的批注，只涂说明，不造零件。enum 要造一个新对象，属于零件，整页就被退回来。这个比喻在 `import type` 上会失效，删掉类型导入不属于涂改，整行引用一起消失。

### tsc 编译后运行

最传统的方案：先用 `tsc` 编译，再用 `node` 执行编译产物。

```bash
npm install -D typescript @types/node
npx tsc --init
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

开发流程：

```bash
# 编译
npx tsc

# 运行
node dist/index.js

# 开发模式（监视编译 + 自动重启）
npx tsc --watch &
npx nodemon dist/index.js
```

产物可以直接放进镜像。缺点是改一次代码就要编译一次，开发时慢。

### tsx

[tsx](https://github.com/privatenumber/tsx) 基于 esbuild，当前版本 4.23.15。它读 tsconfig，能处理 `enum`、装饰器、`.tsx`，报错时按源码行号给位置。日常开发用它。

```bash
npm install -D tsx
```

```bash
# 直接运行 .ts 文件
npx tsx src/index.ts

# 监视模式
npx tsx --watch src/index.ts
```

package.json 配置：

```json
{
  "scripts": {
    "dev": "tsx --watch src/index.ts",
    "start": "tsx src/index.ts",
    "build": "tsc",
    "serve": "node dist/index.js"
  }
}
```

tsx 的行为：
- 不做类型检查。检查交给 IDE 和 CI 里的 `tsc --noEmit`。
- CJS 和 ESM 项目都能跑。
- `--watch` 在文件变化后重跑。

### ts-node

`ts-node` 最后一个版本是 10.9.2，2023 年 12 月以后没有再更新。新项目别用。

老项目里还能见到：

```bash
npm install -D ts-node
npx ts-node src/index.ts
```

它默认用 TypeScript 编译器转译，比 `tsx` 慢。迁移时先换 `tsx`，再删掉依赖。

### 方案对比

| 特性 | node 原生 | tsc | tsx | ts-node |
|------|-----------|-----|-----|---------|
| 读 tsconfig | 否 | 是 | 是 | 是 |
| 类型检查 | 否 | 是 | 否 | 是（默认） |
| 支持语法 | 只有可剥离语法 | 全部 | 全部 | 全部 |
| source map | 无 | 有 | 有 | 有 |
| 适用 | 脚本、临时验证 | CI、发布 | 日常开发 | 旧项目 |

写脚本用 `node app.ts`。日常开发用 `tsx --watch`。构建和 CI 用 `tsc`，检查单独跑 `tsc --noEmit`。

## Node.js 项目中的类型处理

### @types/node

Node.js 自身 API 的类型定义来自 `@types/node`：

```bash
npm install -D @types/node
```

安装后即可获得所有 Node.js 内置模块的类型提示：

```typescript
import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

// 所有参数和返回值都有类型
const content: Buffer = fs.readFileSync(path.join(__dirname, 'data.json'));
const data = JSON.parse(content.toString('utf-8'));
```

### 环境变量类型

通过 `process.env` 读取环境变量时，类型默认是 `string | undefined`。可以用声明文件扩展 `ProcessEnv` 接口：

```typescript
// env.d.ts
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    DATABASE_URL: string;
    JWT_SECRET: string;
    REDIS_URL?: string;
  }
}
```

使用时的类型安全：

```typescript
// 类型为 'development' | 'production' | 'test'
const env = process.env.NODE_ENV;

// 类型为 string（不再有 undefined）
const port = parseInt(process.env.PORT, 10);
```

更健壮的做法是配合运行时校验库（如 zod）：

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
});

const env = envSchema.parse(process.env);
// env 的类型是精确推导的，而非 string | undefined
```

## NestJS：装饰器驱动的企业级框架

[NestJS](https://nestjs.com/) 在 Node.js 生态里大量使用装饰器和依赖注入（DI）。架构借鉴 Angular，项目按模块分层：

```
src/
├── app.module.ts       # 根模块：组装 Controller 和 Provider
├── app.controller.ts   # 控制器：处理 HTTP 请求路由
├── app.service.ts      # 服务：封装业务逻辑
└── main.ts             # 入口：启动应用
```

### 核心概念

**Controller**：处理请求与路由，通过装饰器声明。

```typescript
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query('page') page: number) {
    return this.usersService.findAll(page);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }
}
```

**Provider / Service**：通过 `@Injectable()` 声明可注入的服务。

```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  private users: User[] = [];

  findAll(page: number) {
    return this.users.slice((page - 1) * 20, page * 20);
  }

  findOne(id: string) {
    return this.users.find(u => u.id === id);
  }

  create(dto: CreateUserDto) {
    const user = { id: crypto.randomUUID(), ...dto };
    this.users.push(user);
    return user;
  }
}
```

**Module**：组织 Controller 和 Provider 的容器。

```typescript
import { Module } from '@nestjs/common';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // 导出给其他模块使用
})
export class UsersModule {}
```

**DTO（Data Transfer Object）**：用 class + 装饰器做请求参数校验。

```typescript
import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
```

它的几个特点：

- 模块化：按 Module 划分边界，项目变大后结构不散。
- 依赖注入：构造函数声明依赖，测试时换 mock 容易。
- 生态：ORM、GraphQL、微服务、OpenAPI、鉴权、消息队列都有官方包。
- 装饰器：路由、中间件、守卫、拦截器、管道都靠装饰器声明。

### NestJS CLI 快速开始

```bash
npm i -g @nestjs/cli
nest new my-project
```

CLI 会自动生成 TypeScript 配置完整的项目骨架。

## Prisma：类型安全的数据库 ORM

[Prisma](https://www.prisma.io/) 是 TypeScript 生态常用的 ORM，通过 Schema 定义生成类型安全的查询客户端。

### 项目集成

```bash
npm install -D prisma
npm install @prisma/client
npx prisma init
```

这会创建 `prisma/schema.prisma` 和一个 `.env` 模板。

### Schema 定义

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  role      Role     @default(USER)
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
}

enum Role {
  USER
  ADMIN
}
```

### 类型安全的查询

运行 `npx prisma generate` 后，Prisma 根据 Schema 生成完整的 TypeScript 类型和查询方法：

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 所有方法的参数和返回值都有精确类型
async function createUser(data: { name: string; email: string }) {
  const user = await prisma.user.create({
    data,
    select: { id: true, name: true, email: true },
  });
  // user 的类型精确匹配 select 指定的字段
  return user;
}

// 关联查询也有完整类型
async function getUserWithPosts(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      posts: {
        where: { published: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}
```

### 数据库迁移

```bash
# 开发环境：直接推送 Schema 到数据库
npx prisma db push

# 生产环境：生成迁移文件
npx prisma migrate dev --name add_user_role_field

# 部署时执行迁移
npx prisma migrate deploy
```

### NestJS 中集成 Prisma

创建 PrismaService 作为 NestJS 的 Provider：

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

注册到全局模块：

```typescript
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

之后在任何 Service 中通过依赖注入使用：

```typescript
@Injectable()
export class ArticleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { title: string; content: string }) {
    return this.prisma.article.create({ data });
  }
}
```

## 其他常用 Node.js 集成

### Express 与 TypeScript

```bash
npm install express
npm install -D @types/express
```

```typescript
import express, { Request, Response, NextFunction } from 'express';

const app = express();

interface User {
  id: string;
  name: string;
}

app.get('/users/:id', (req: Request<{ id: string }>, res: Response<User>) => {
  res.json({ id: req.params.id, name: 'Alice' });
});

app.listen(3000);
```

### Fastify 与 TypeScript

Fastify 用泛型参数把类型传进请求链：

```typescript
import Fastify from 'fastify';

const server = Fastify();

server.get<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
  const { id } = request.params; // 类型为 string
  return { id, name: 'Alice' };
});

server.listen({ port: 3000 });
```

## 生产构建配置

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`package.json` 不写 `"type": "module"` 时，`nodenext` 输出 CommonJS。只做检查不产出，加 `"noEmit": true` 就行。（见 [tsconfig 参考](https://www.typescriptlang.org/tsconfig)）

TypeScript 7 移除了 `moduleResolution: "node"`。写了会报：

```text
error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
```

如果是纯 ESM 项目，`package.json` 加 `"type": "module"`，配置换成：

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

导入路径有两种写法：

- 源码写 `./math.ts`，开 `rewriteRelativeImportExtensions`，`tsc` 产物自动改成 `./math.js`。Node 原生剥离也认这个写法。
- 源码写 `./math.js`，`tsc` 会解析到 `./math.ts`，产物保持原样。

不开 `rewriteRelativeImportExtensions` 时，`./math.ts` 这种写法报：

```text
error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.
```

只检查不产出时（`noEmit`），也可以开 `allowImportingTsExtensions` 代替。

## 小结

- 脚本和临时验证用 `node app.ts`。它剥离类型但不检查，`enum`、参数属性、装饰器、`.tsx` 跑不了。
- 日常开发用 `tsx`。发布用 `tsc` 产物，检查用 `tsc --noEmit`。
- `ts-node` 停在 10.9.2，2023 年 12 月后没再更新，新项目别用。
- `module` 和 `moduleResolution` 统一写 `nodenext`。ESM 项目加 `"type": "module"`，再开 `rewriteRelativeImportExtensions`。
- 环境变量类型扩展 `NodeJS.ProcessEnv` 接口，运行时校验交给 zod。
- NestJS 用装饰器，必须编译或走 `tsx`。Prisma 生成 JS 加 `.d.ts`，原生剥离也能用。

## 用不上的时候

### 用不可擦除语法

`enum`、参数属性、带运行时代码的 `namespace`、`import x = require` 在原生剥离下直接报语法错误。

### 生产环境

开发时用原生剥离跑得快，生产仍建议编译：产物更小，也能覆盖老 Node 版本。

### 依赖 tsconfig

Node 不读 `tsconfig.json`，`paths`、`baseUrl` 都不生效，import 还必须带扩展名。

## 参考

- [Node.js 的类型剥离文档](https://nodejs.org/api/typescript.html)：删类型、不检查的运行时行为说明。
- [tsx](https://github.com/privatenumber/tsx)：日常开发直接跑 .ts 的执行器。
- [tsconfig 参考](https://www.typescriptlang.org/tsconfig)：module、moduleResolution、rewriteRelativeImportExtensions 的取值。
- [NestJS](https://nestjs.com/)：装饰器与依赖注入框架，必须编译或走 tsx。
- [Prisma 文档](https://www.prisma.io/docs)：生成 JS 加 .d.ts，原生剥离也能用。
