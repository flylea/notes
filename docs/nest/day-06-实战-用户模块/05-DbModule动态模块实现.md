# DbModule 动态模块 — JSON 文件存储

## 设计思路

数据库还没学，但我们需要数据持久化。用 JSON 文件模拟——读写都通过 `DbService`，将来换成 MySQL 时只需换 `DbService` 的实现。

用**动态模块**是因为 UserModule 和 BookModule 需要读写不同的文件（`users.json` vs `books.json`）。动态模块让传入的文件路径成为"配置"。

## DbService：JSON 文件读写

`src/db/db.service.ts`：

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { DbModuleOptions } from './db.module';
import { access, readFile, writeFile } from 'fs/promises';

@Injectable()
export class DbService {
  @Inject('OPTIONS')
  private options: DbModuleOptions;

  async read<T = any>(): Promise<T[]> {
    try {
      await access(this.options.path);  // 检查文件是否存在
    } catch {
      return [];  // 文件不存在 → 返回空数组
    }

    const content = await readFile(this.options.path, { encoding: 'utf-8' });
    if (!content.trim()) return [];
    return JSON.parse(content);
  }

  async write(data: any[]): Promise<void> {
    await writeFile(
      this.options.path,
      JSON.stringify(data || [], null, 2),  // 格式化 JSON
      { encoding: 'utf-8' },
    );
  }
}
```

### 关键点

- `@Inject('OPTIONS')`：用字符串 Token 注入配置（`OPTIONS` 是我们在 DbModule 中注册的）
- `read<T = any>()`：泛型方法，调用时可指定返回类型
- `access()` 检查文件存在性：比 try-catch readFile 更语义化
- `JSON.stringify(data, null, 2)`：美化输出，方便手动查看和调试

## DbModule：动态模块

`src/db/db.module.ts`：

```typescript
import { DynamicModule, Module } from '@nestjs/common';
import { DbService } from './db.service';

export interface DbModuleOptions {
  path: string;  // JSON 文件路径
}

@Module({})
export class DbModule {
  static register(options: DbModuleOptions): DynamicModule {
    return {
      module: DbModule,
      providers: [
        {
          provide: 'OPTIONS',  // 配置 Token
          useValue: options,
        },
        DbService,
      ],
      exports: [DbService],
    };
  }
}
```

### 为什么 `@Module({})` 是空的？

因为 `DbModule` 没有固定的 providers——配置由调用方在 `register()` 时提供。这就是**动态模块**的核心：模块的定义在运行时才完成。

## 使用方式

```typescript
// user.module.ts
@Module({
  imports: [
    DbModule.register({ path: 'users.json' }),  // 用户模块读写 users.json
  ],
})

// book.module.ts (Day 12)
@Module({
  imports: [
    DbModule.register({ path: 'books.json' }),  // 图书模块读写 books.json
  ],
})
```

同一个 `DbService`，不同模块拿到的 `OPTIONS` 不同——因为 Nest 为每个 `register()` 调用创建了独立的 Provider 实例。

## 动态模块 vs 全局模块

DbModule 不是全局的——每个需要它的模块必须显式 imports。这保留了模块依赖的可见性，同时也让每个模块可以传入不同的 `path`。

> 把 DbModule 设成 `@Global()` 就没法传不同 path 了——全局只有一份配置。动态模块的设计恰到好处。

---

## 参考链接

- [NestJS — Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules)
- 开源笔记：《Nest 通关秘籍》.doc/16. 如何创建动态模块.md
- 开源笔记：《Nest 通关秘籍》.doc/28. 图书管理系统：用户模块后端开发.md
