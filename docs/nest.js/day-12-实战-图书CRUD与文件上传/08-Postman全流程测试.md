# Postman 全面测试图书模块

## 测试环境准备

```bash
pnpm run start:dev
# 确认：Application is running on: http://localhost:3000
```

## 测试 1：新增图书

```
POST http://localhost:3000/book/create
Content-Type: application/json

{
  "title": "NestJS 实战指南",
  "author": "张三",
  "isbn": "978-7-1234-5678-9",
  "price": 79.00,
  "description": "一本从入门到精通 NestJS 的实战教程"
}
```

预期响应（200 OK）：
```json
{
  "id": "a1b2c3d4-...",
  "title": "NestJS 实战指南"
}
```

## 测试 2：新增第二本书

```
POST http://localhost:3000/book/create
Content-Type: application/json

{
  "title": "深入浅出 Prisma",
  "author": "李四",
  "price": 59.00
}
```

## 测试 3：图书列表（无搜索）

```
GET http://localhost:3000/book/list?page=1&size=10
```

预期响应：
```json
{
  "list": [
    { "id": "...", "title": "NestJS 实战指南", "author": "张三", ... },
    { "id": "...", "title": "深入浅出 Prisma", "author": "李四", ... }
  ],
  "total": 2,
  "page": 1,
  "size": 10
}
```

## 测试 4：图书列表（关键字搜索）

```
GET http://localhost:3000/book/list?keyword=NestJS
```

预期响应：
```json
{
  "list": [
    { "title": "NestJS 实战指南", ... }
  ],
  "total": 1,
  "page": 1,
  "size": 10
}
```

## 测试 5：图书详情

```
GET http://localhost:3000/book/detail?id=<测试1返回的id>
```

预期响应（完整图书信息）：
```json
{
  "id": "...",
  "title": "NestJS 实战指南",
  "author": "张三",
  "isbn": "978-7-1234-5678-9",
  "price": 79,
  "description": "一本从入门到精通 NestJS 的实战教程",
  "cover": "",
  "status": "available",
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 测试 6：更新图书

```
POST http://localhost:3000/book/update?id=<测试1返回的id>
Content-Type: application/json

{
  "price": 89.00,
  "description": "更新后的描述"
}
```

验证：再次调用 GET detail，确认 price 和 description 已更新。

## 测试 7：上传图书封面

```
POST http://localhost:3000/book/upload-cover?id=<测试1返回的id>
Content-Type: multipart/form-data

表单字段 file: 选择一个图片文件（.jpg/.png）
```

预期响应：
```json
{
  "id": "...",
  "cover": "/uploads/covers/2026-05-10/1715344200_abc.jpg"
}
```

验证：
1. 浏览器打开 `http://localhost:3000/uploads/covers/2026-05-10/1715344200_abc.jpg` — 应该看到上传的图片
2. 再次调用 GET detail，确认 cover 字段已更新

## 测试 8：删除图书

```
POST http://localhost:3000/book/delete?id=<测试1返回的id>
```

预期响应：
```json
{
  "message": "删除成功"
}
```

验证：再次调用 GET detail — 应返回 400 "图书不存在"。

## 测试 9：参数校验失败

```
POST http://localhost:3000/book/create
Content-Type: application/json

{
  "title": "",
  "price": -10
}
```

预期响应（400 Bad Request）：
```json
{
  "code": 90000,
  "message": "书名不能为空; 价格不能是负数",
  "errors": [
    { "field": "title", "message": "书名不能为空" },
    { "field": "price", "message": "价格不能是负数" }
  ]
}
```

## 测试 10：更新不存在的图书

```
POST http://localhost:3000/book/update?id=nonexistent
Content-Type: application/json

{
  "title": "不存在的书"
}
```

预期响应（400 Bad Request）：
```json
{
  "code": 400,
  "message": "图书不存在",
  ...
}
```

## 测试 11：分页边界值

```
GET http://localhost:3000/book/list?page=100&size=10
```

预期响应：
```json
{
  "list": [],
  "total": 1,
  "page": 100,
  "size": 10
}
```

## 测试汇总

| 测试场景 | 接口 | 预期结果 |
|---------|------|---------|
| 新增图书 | POST /book/create | 200，返回 id 和 title |
| 列表查询 | GET /book/list | 200，返回分页列表 |
| 关键字搜索 | GET /book/list?keyword=NestJS | 200，只返回匹配的图书 |
| 图书详情 | GET /book/detail?id=xxx | 200，返回完整信息 |
| 更新图书 | POST /book/update?id=xxx | 200，返回更新后的 id 和 title |
| 上传封面 | POST /book/upload-cover | multipart 上传，返回封面 URL |
| 删除图书 | POST /book/delete?id=xxx | 200，返回删除成功 |
| 参数校验 | POST /book/create（空书名） | 400，返回字段级错误 |
| 不存在图书 | POST /book/update?id=nonexistent | 400，图书不存在 |
| 分页边界 | GET /book/list?page=100 | 200，返回空列表 |

> 全部通过说明图书模块核心功能正常。Day 19 将把底层存储从 JSON 文件迁移到 MySQL/PostgreSQL，接口不变。

---

## 参考链接

- [NestJS — Controllers](https://docs.nestjs.com/controllers)
- 开源笔记：《Nest 通关秘籍》.doc/29.图书管理系统：文件和图书模块后端开发.md
