# Day 17：NestJS 与 Prisma 集成

## 今日概览

Day 16 学了 Prisma Client 的全部 API。今天把它们整合进 NestJS——让 Prisma 成为 Nest DI 容器的一部分，享受完整的依赖注入和生命周期管理。

## 学习目标

- 创建 PrismaService 并集成 Nest 生命周期
- 设计 @Global() PrismaModule
- 在 Service 中注入 PrismaService
- 理解 Prisma 生成的 TypeScript 类型体系
- 处理 Prisma 特定异常

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-PrismaService完整实现.md](01-PrismaService完整实现.md) | PrismaService 完整实现 |
| [02-全局PrismaModule.md](02-全局PrismaModule.md) | @Global() PrismaModule |
| [03-在Service中注入Prisma.md](03-在Service中注入Prisma.md) | 在业务 Service 中注入 |
| [04-Prisma生成的类型体系.md](04-Prisma生成的类型体系.md) | Prisma 生成的类型体系 |
| [05-Prisma异常码处理.md](05-Prisma异常码处理.md) | Prisma 异常码处理 |
