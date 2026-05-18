# 第27章 Node.js 中的 TypeScript

Node.js 是 TypeScript 应用最广泛的后端运行时。本章介绍如何在 Node.js 项目中高效使用 TypeScript，包括运行时方案对比、项目配置、常见框架集成以及数据库 ORM 实践。

## 运行 TypeScript 代码

Node.js 不能直接执行 `.ts` 文件，需要先将 TypeScript 编译为 JavaScript。目前主流方案有三种：

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

优点是最稳妥、和任何 Node.js 版本兼容；缺点是每次修改都需要重新编译，开发体验不如即时方案。

### tsx（推荐）

[tsx](https://github.com/privatenumber/tsx) 是目前最流行的 TypeScript 即时执行工具，基于 esbuild 实现超快转译：

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

tsx 的特点：
- 底层使用 esbuild 转译，速度极快
- 不做类型检查——开发时由 IDE 负责，CI/CD 时单独 `tsc --noEmit`
- 同时支持 CJS 和 ESM
- 支持 `--watch` 监视热重载

### ts-node

`ts-node` 是老牌方案，速度较慢但生态成熟。使用 `ts-node/register` 可以在 Node 进程中直接 require `.ts` 文件：

```bash
npm install -D ts-node
```

```bash
npx ts-node src/index.ts
```

ts-node 默认使用 TypeScript 编译器做转译，速度远慢于 tsx。可以通过 `ts-node --swc` 或 `ts-node --esm` 提升速度，但配置复杂度也随之增加。**新项目推荐使用 tsx**。

### 方案对比

| 特性 | tsc | tsx | ts-node |
|------|-----|-----|---------|
| 启动速度 | 慢（需编译） | 快（esbuild） | 较慢（TS Compiler） |
| 类型检查 | 编译时 | 不支持（IDE + CI） | 默认支持 |
| ESM 支持 | 取决于 module | 原生支持 | 需配置 |
| 生产使用 | ✅ 推荐 | 开发工具 | 开发工具 |
| 生态成熟度 | 最成熟 | 快速增长 | 成熟 |

**推荐组合**：开发用 `tsx --watch`，生产构建用 `tsc`，CI 类型检查用 `tsc --noEmit`。

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

[NestJS](https://nestjs.com/) 是 Node.js 生态中最具代表性的 TypeScript 后端框架，大量使用了装饰器和依赖注入（DI）。它借鉴了 Angular 的架构理念，提供模块化、分层的项目结构：

```
src/
├── app.module.ts       # 根模块：组装 Controller 和 Provider
├── app.controller.ts   # 控制器：处理 HTTP 请求路由
├── app.service.ts      # 服务：封装业务逻辑
└── main.ts             # 入口：启动应用
```

### 核心概念

**Controller**——处理请求与路由，通过装饰器声明：

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

**Provider / Service**——通过 `@Injectable()` 声明可注入的服务：

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

**Module**——组织 Controller 和 Provider 的容器：

```typescript
import { Module } from '@nestjs/common';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // 导出给其他模块使用
})
export class UsersModule {}
```

**DTO（Data Transfer Object）**——通过 class + 装饰器做请求参数校验：

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

NestJS 的核心优势在于：
- **模块化架构**：天然支持领域驱动设计，项目规模扩大时结构依然清晰
- **依赖注入**：通过构造函数自动注入依赖，便于单元测试
- **全家桶生态**：内置了 ORM 集成、GraphQL、微服务、OpenAPI、鉴权、消息队列等能力
- **装饰器语法**：声明式编程，路由、中间件、守卫、拦截器、管道等都通过装饰器声明

### NestJS CLI 快速开始

```bash
npm i -g @nestjs/cli
nest new my-project
```

CLI 会自动生成 TypeScript 配置完整的项目骨架。

## Prisma：类型安全的数据库 ORM

[Prisma](https://www.prisma.io/) 是 TypeScript 生态中最流行的 ORM 之一，核心理念是通过 Schema 定义生成类型安全的查询客户端。

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

Fastify 对 TypeScript 的支持更加原生，通过泛型参数在整个请求链中传递类型：

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
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

如果是纯 ESM 项目：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

package.json 中需添加 `"type": "module"`，并且导入时使用 `.js` 后缀（TS 会自动解析为 `.ts`）。

## 本章小结

- **运行时方案**：开发用 `tsx`（快），生产构建用 `tsc`（稳），CI 类型检查用 `tsc --noEmit`
- **环境变量**：扩展 `NodeJS.ProcessEnv` 接口声明类型，生产项目建议配合 zod 做运行时校验
- **NestJS**：装饰器驱动的企业级框架，核心是模块化、依赖注入、全家桶生态，很适合中大型项目
- **Prisma**：类型安全的 ORM，通过 Schema 生成类型完备的查询客户端，支持自动迁移和关联查询
- **Express/Fastify**：轻量框架直接安装 `@types/` 包后即可获得完整类型提示

下一章将介绍如何使用 ESLint 来约束 TypeScript 代码质量。
