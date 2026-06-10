# 创建 PrismaService 和 PrismaModule

## 概述

在 Nest 中，我们封装 PrismaClient 为 Nest 的 Provider，通过全局模块暴露给所有 Service 使用。这个概念在 Day 17 已详细讲解，本节在图书管理系统中实际创建它。

## 创建 PrismaService

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // 开发环境打印 SQL 查询
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  async onModuleInit() {
    this.logger.log('正在连接数据库...');
    await this.$connect();
    this.logger.log('数据库连接成功');
  }

  async onModuleDestroy() {
    this.logger.log('正在断开数据库连接...');
    await this.$disconnect();
    this.logger.log('数据库连接已断开');
  }
}
```

## 创建 PrismaModule

```typescript
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()   // 全局模块，所有模块无需 imports 即可注入 PrismaService
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

## 在 AppModule 中引入

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { BookModule } from './book/book.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    PrismaModule,   // ← 添加这一行
    UserModule,
    BookModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
```

## 验证注入是否成功

在任意 Service 中尝试注入：

```typescript
// src/user/user.service.ts（临时测试）
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {
    console.log('PrismaService 注入成功 ✅');
  }
}
```

启动项目：

```bash
npm run start:dev

# 控制台输出：
# [Nest] LOG [PrismaService] 正在连接数据库...
# [Nest] LOG [PrismaService] 数据库连接成功
# PrismaService 注入成功 ✅
```

## 文件变化总结

```
src/
├── prisma/                     ← 新建
│   ├── prisma.service.ts      ← extends PrismaClient, 管理生命周期
│   └── prisma.module.ts       ← @Global(), 到处可用
├── app.module.ts               ← 修改：imports 中添加 PrismaModule
├── user/
│   └── user.service.ts         ← 修改：注入 PrismaService 替换 DbService（下节）
├── book/
│   └── book.service.ts         ← 修改：注入 PrismaService（下节）
└── db/                         ← 即将删除（第 7 节）
```

> 此时项目已可以启动，PrismaService 连接数据库成功。但 Service 层仍在使用旧的 DbService，下一节开始逐步重构。

---

## 参考链接

- [Prisma — NestJS Integration](https://www.prisma.io/docs/guides/frameworks/nestjs#3-create-a-prisma-service)
- [NestJS — Global Modules](https://docs.nestjs.com/modules#global-modules)
- [NestJS — Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
