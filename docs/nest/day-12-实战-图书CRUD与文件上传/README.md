# Day 12：图书 CRUD + 文件上传（实战）

## 今日概览

Day 6 完成了用户模块，今天构建图书管理系统的核心——图书 CRUD 和封面上传。并用 `nest g resource` 快速生成模块骨架。

## 今日目标

- 使用 `nest g resource` 快速生成 CRUD 模块
- 实现图书的增删改查（全部基于 GET/POST）
- 集成 multer 实现封面图片上传
- 配置静态文件托管让上传的图片可访问
- Postman 全面测试

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-Book-Entity与DTO设计.md](01-Book-Entity与DTO设计.md) | Book Entity 与 DTO 设计 |
| [02-BookModule搭建.md](02-BookModule搭建.md) | 用 nest g resource 生成模块 |
| [03-BookService-CRUD实现.md](03-BookService-CRUD实现.md) | BookService CRUD 完整实现 |
| [04-BookController路由.md](04-BookController路由.md) | 务实的 API 设计（全部 GET/POST） |
| [05-multer文件上传.md](05-multer文件上传.md) | multer 文件上传配置 |
| [06-自定义磁盘存储.md](06-自定义磁盘存储.md) | 自定义存储引擎 |
| [07-静态文件托管.md](07-静态文件托管.md) | 静态文件托管 |
| [08-Postman全流程测试.md](08-Postman全流程测试.md) | Postman 全功能测试 |
