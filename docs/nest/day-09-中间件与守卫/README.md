# Day 9：Middleware 与 Guard 深入

## 今日概览

Day 7 我们俯瞰了五大切面。今天聚焦前两个——Middleware 和 Guard——做深入实战。

## 学习目标

- 掌握 Nest Middleware 的注册、排除和排列
- 学会复用 Express 中间件生态（cors/helmet/session）
- 深入理解 ExecutionContext
- 学会用 @SetMetadata + Reflector 实现声明式权限
- 彻底理解 Middleware vs Guard 的职责边界

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-Nest-Middleware完整用法.md](01-Nest-Middleware完整用法.md) | Nest Middleware 完整用法 |
| [02-复用Express中间件生态.md](02-复用Express中间件生态.md) | 复用 Express 中间件生态 |
| [03-ExecutionContext详解.md](03-ExecutionContext详解.md) | ExecutionContext 详解 |
| [04-Guard实现与路由级守卫.md](04-Guard实现与路由级守卫.md) | Guard 实现 CanActivate 接口 |
| [05-SetMetadata与Reflector.md](05-SetMetadata与Reflector.md) | @SetMetadata + Reflector 声明式权限 |
| [06-Middleware与Guard区别.md](06-Middleware与Guard区别.md) | Middleware vs Guard 核心区别 |
| [07-全局与局部应用级别对比.md](07-全局与局部应用级别对比.md) | 各切面的注册级别对比 |
