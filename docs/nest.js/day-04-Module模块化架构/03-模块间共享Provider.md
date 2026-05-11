# 模块间共享 Provider：imports 和 exports 机制

## 核心规则：Provider 的作用域

```
Module A（定义 + export）           Module B（import）
┌──────────────────────┐           ┌──────────────────────┐
│ providers: [ASvc]    │  export   │ imports: [ModuleA]   │
│ exports: [ASvc]  ────┼──────────→│ → B 可以注入 ASvc    │
└──────────────────────┘           └──────────────────────┘
```

默认情况下，每个 Module 的 Provider 是**私有的**（封装在模块内部）。只有显式 exports 的 Provider 才能被引入方注入。

## 完整流程

```typescript
// step 1: user.module.ts — 定义并导出
@Module({
  providers: [UserService],
  exports: [UserService],  // 关键：导出后别人才能用
})
export class UserModule {}

// step 2: book.module.ts — 引入
@Module({
  imports: [UserModule],  // 引入 UserModule
  providers: [BookService],
})
export class BookModule {}

// step 3: book.service.ts — 注入
@Injectable()
export class BookService {
  constructor(
    private userService: UserService,  // ✅ 可以使用！
  ) {}
}
```

## 常见错误

### 错误 1：忘记 exports

```typescript
// user.module.ts
@Module({
  providers: [UserService],
  // ❌ 忘记 exports
})
```

```typescript
// book.service.ts — Nest 启动报错
constructor(private userService: UserService) {}
// Error: Nest can't resolve dependencies of BookService.
// Please make sure UserService is exported from UserModule.
```

### 错误 2：忘记 imports

```typescript
// book.module.ts
@Module({
  // ❌ 忘记 imports: [UserModule]
  providers: [BookService],
})
```

### 错误 3：认为导入的模块会自动导出

```typescript
// AppModule 引入了 UserModule
@Module({
  imports: [UserModule],
})
export class AppModule {}

// BookModule 引入了 AppModule → 不能用 UserService！
// imports 没有传递性，每个模块需要显式引入它需要的模块
```

## 导出整个模块

```typescript
@Module({
  imports: [UserModule],
  exports: [UserModule],  // 既导入又导出 = 转发
})
export class SharedModule {}
```

这样引入 SharedModule 的模块也能使用 UserModule 的导出。

## 一个实战例子

图书管理系统中的模块依赖关系：

```
AppModule
├── imports: [PrismaModule, UserModule, BookModule]
│
├── PrismaModule (@Global)
│   └── exports: [PrismaService]  → 全局可用，所有模块都能注入
│
├── UserModule
│   ├── controllers: [UserController]
│   ├── providers: [UserService]
│   └── exports: [UserService]  → BookModule 需要
│
└── BookModule
    ├── imports: [UserModule]  → 需要 UserService
    ├── controllers: [BookController]
    └── providers: [BookService]
```

---

## 参考链接

- [NestJS — Shared Modules](https://docs.nestjs.com/modules#shared-modules)
- [NestJS — Module Re-exporting](https://docs.nestjs.com/modules#module-re-exporting)
- 开源笔记：《Nest 通关秘籍》.doc/9. 全局模块和生命周期.md
