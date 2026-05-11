# Day 19：图书管理系统从 JSON 迁移到 Prisma + MySQL

## 今日概览

前 6 天学了 Prisma 的 Schema 设计、CRUD API、异常处理、事务和 Migration。今天是实战日——将 Day 12 用 JSON 文件存储的图书管理系统，完整迁移到 Prisma + MySQL/PostgreSQL。

## 学习目标

- 理解从文件存储迁移到数据库的必要性和策略
- 掌握在 Nest 项目中从头集成 Prisma 的完整流程
- 学会重构 Service 层，保持 Controller 接口不变
- 掌握借阅业务的事务处理
- 能够编写种子数据脚本

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-为什么迁移到数据库.md](01-为什么迁移到数据库.md) | JSON vs 数据库全面对比、迁移策略 |
| [02-Prisma安装与Schema创建.md](02-Prisma安装与Schema创建.md) | 安装 Prisma、创建 Schema、执行 migrate dev |
| [03-创建PrismaService和Module.md](03-创建PrismaService和Module.md) | 创建 PrismaService + @Global() PrismaModule |
| [04-重构UserService.md](04-重构UserService.md) | 重构 UserService：JSON 读写 → Prisma API |
| [05-重构BookService.md](05-重构BookService.md) | 重构 BookService：新增分页、模糊搜索 |
| [06-更新Controller.md](06-更新Controller.md) | 更新 BookController 参数、移除不再需要的模块 |
| [07-删除DbModule.md](07-删除DbModule.md) | 删除 DbModule/DbService，清理依赖 |
| [08-新增BorrowService.md](08-新增BorrowService.md) | 新增 BorrowService：借书/还书/查询 |
| [09-新增借阅路由.md](09-新增借阅路由.md) | 新增借贷路由：POST /borrow、POST /return |
| [10-种子数据脚本.md](10-种子数据脚本.md) | 种子数据脚本：管理员、示例图书 |
| [11-Postman全流程测试.md](11-Postman全流程测试.md) | Postman 全流程测试 |
