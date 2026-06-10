# @Global() PrismaModule

## 完整代码

```typescript
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()  // ← 声明为全局模块
@Module({
  providers: [PrismaService],
  exports: [PrismaService],  // PrismaService 对所有模块可见
})
export class PrismaModule {}
```

## 为什么 @Global()？

PrismaService 和 Day 5 的 DbModule 不同：
- DbModule 是**非全局动态模块**——每个业务模块独立传 `path` 参数
- PrismaService 是**全局单例**——整个应用只有一个数据库连接

```typescript
// 如果不加 @Global()，每个模块都要：
@Module({
  imports: [PrismaModule],  // 重复！
})
export class BookModule {}

@Module({
  imports: [PrismaModule],  // 又重复了！
})
export class UserModule {}

// 加了 @Global()：
@Module({ imports: [] })
export class BookModule {}  // 直接注入 PrismaService，无需 imports
export class UserModule {}  // 直接注入 PrismaService，无需 imports
```

## AppModule 注册

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { BookModule } from './book/book.module';

@Module({
  imports: [
    PrismaModule,   // ← 只在这里引入一次
    UserModule,
    BookModule,
  ],
})
export class AppModule {}
```

## 不再需要 @Global 的替代方案

如果不想用 `@Global()`，可以用 forRoot 模式：

```typescript
@Module({})
export class PrismaModule {
  static forRoot(): DynamicModule {
    return {
      module: PrismaModule,
      providers: [PrismaService],
      exports: [PrismaService],
      global: true,  // ← forRoot 的 global 选项
    };
  }
}

// AppModule:
@Module({
  imports: [PrismaModule.forRoot()],
})
```

> `@Global()` 和 `global: true` 效果相同——让 PrismaService 在整个应用中保持单例，每个模块可直接注入。

---

## 参考链接

- [NestJS — Global Modules](https://docs.nestjs.com/modules#global-modules)
- [Prisma — NestJS Guide](https://www.prisma.io/docs/guides/frameworks/nestjs)
