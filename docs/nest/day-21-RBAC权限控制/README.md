# Day 21：RBAC 权限控制

## 今日概览

Day 20 实现了 JWT 认证，系统知道"你是谁"。今天实现 RBAC 权限控制，让系统知道"你能做什么"——普通用户只能浏览和借阅，管理员可以管理图书。

## 学习目标

- 理解 ACL vs RBAC 权限模型的区别
- 设计 RBAC 的数据库 Schema（User/Role/Permission）
- 实现声明式权限装饰器
- 实现 PermissionGuard 动态权限校验
- 了解权限缓存策略

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-ACL与RBAC权限模型.md](01-ACL与RBAC权限模型.md) | ACL vs RBAC 模型对比 |
| [02-RBAC数据库Schema设计.md](02-RBAC数据库Schema设计.md) | Prisma Schema 新增角色/权限表 |
| [03-RequirePermission装饰器.md](03-RequirePermission装饰器.md) | @SetMetadata 声明接口所需权限 |
| [04-PermissionGuard权限守卫.md](04-PermissionGuard权限守卫.md) | PermissionGuard 完整实现 |
| [05-Redis缓存权限.md](05-Redis缓存权限.md) | Redis 缓存权限策略 |
| [06-组合装饰器套件.md](06-组合装饰器套件.md) | @RequireLogin + @RequirePermission 组合装饰器 |
| [07-图书管理系统角色设计.md](07-图书管理系统角色设计.md) | 图书管理系统角色与权限设计 |
