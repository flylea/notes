# Day 6：实战 — 图书管理系统：项目初始化与用户模块

## 今日目标

创建第一个 Nest 实战项目，实现用户注册和登录接口。这是"图书管理系统"的起点——先用 JSON 文件模拟数据库，重点体会 Module → Controller → Service → DTO 的完整请求链路。

## 子文件导航

| 文件 | 主题 |
|------|------|
| [01-需求分析与系统设计.md](./01-需求分析与系统设计.md) | 需求分析与系统设计 |
| [02-创建Nest项目.md](./02-创建Nest项目.md) | 创建 Nest 项目 |
| [03-用户Entity与DTO定义.md](./03-用户Entity与DTO定义.md) | Entity 与 DTO 定义 |
| [04-全局启用ValidationPipe.md](./04-全局启用ValidationPipe.md) | 全局启用 ValidationPipe |
| [05-DbModule动态模块实现.md](./05-DbModule动态模块实现.md) | DbModule 动态模块实现 |
| [06-UserService业务逻辑.md](./06-UserService业务逻辑.md) | UserService 业务逻辑 |
| [07-UserController路由实现.md](./07-UserController路由实现.md) | UserController 路由实现 |
| [08-Postman全面测试.md](./08-Postman全面测试.md) | Postman 全面测试 |

## 今日成果

完成后的项目结构：

```
book-management-system-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── db/
│   │   ├── db.module.ts        # 动态模块
│   │   └── db.service.ts       # JSON 文件读写
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   ├── dto/
│   │   │   ├── register-user.dto.ts
│   │   │   └── login-user.dto.ts
│   │   └── entities/
│   │       └── user.entity.ts
```
