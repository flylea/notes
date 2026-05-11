# Postman 全流程测试

## 测试准备

```
1. 确保数据库已创建并运行
2. 运行 prisma migrate reset 初始化数据库
3. 运行 npm run start:dev 启动服务
4. Postman Base URL: http://localhost:3000
```

## 1. 用户注册

### 1.1 正常注册

```
POST {{base}}/user/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "123456",
  "nickname": "新用户"
}

→ 期望: 200
{
  "id": 4,
  "username": "newuser",
  "nickname": "新用户",
  "role": "USER",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
// 注意：不返回 password
```

### 1.2 重复注册

```
POST {{base}}/user/register
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}

→ 期望: 400
{
  "statusCode": 400,
  "message": "用户名已存在"
}
```

### 1.3 参数校验失败

```
POST {{base}}/user/register
Content-Type: application/json

{
  "username": "ab",
  "password": "12"
}

→ 期望: 400
{
  "statusCode": 400,
  "message": ["用户名至少 3 个字符", "密码至少 6 位"]
}
```

## 2. 用户登录

### 2.1 正常登录

```
POST {{base}}/user/login
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}

→ 期望: 200
{
  "id": 1,
  "username": "admin",
  "nickname": "系统管理员",
  "role": "ADMIN",
  ...
}
```

### 2.2 密码错误

```
POST {{base}}/user/login
Content-Type: application/json

{
  "username": "admin",
  "password": "wrongpassword"
}

→ 期望: 400
{
  "statusCode": 400,
  "message": "用户名或密码错误"
}
```

### 2.3 用户不存在

```
POST {{base}}/user/login
Content-Type: application/json

{
  "username": "nonexistent",
  "password": "123456"
}

→ 期望: 400
{
  "statusCode": 400,
  "message": "用户名或密码错误"
}
```

> 密码错误和用户不存在返回相同错误信息——防止恶意用户枚举已注册账号（安全最佳实践）。

## 3. 图书列表

### 3.1 默认分页

```
GET {{base}}/book/list

→ 期望: 200
{
  "list": [
    {
      "id": 1,
      "title": "NestJS 从入门到实践",
      "author": "张三",
      "status": "AVAILABLE",
      "category": { "id": 3, "name": "后端开发" },
      "price": 79,
      ...
    },
    ...  // 共 10 条（默认 size=10）
  ],
  "total": 12,
  "page": 1,
  "size": 10
}
```

### 3.2 指定分页参数

```
GET {{base}}/book/list?page=2&size=3

→ 期望: 200
{
  "list": [ ... ],  // 3 条（第 4-6 条）
  "total": 12,
  "page": 2,
  "size": 3
}
```

### 3.3 关键字搜索

```
GET {{base}}/book/list?keyword=NestJS

→ 期望: 200
{
  "list": [
    { "title": "NestJS 从入门到实践", ... }
  ],
  "total": 1,
  "page": 1,
  "size": 10
}
```

### 3.4 按作者搜索

```
GET {{base}}/book/list?keyword=刘慈欣

→ 期望: 200
{
  "list": [
    { "title": "三体", "author": "刘慈欣", ... }
  ],
  "total": 1
}
```

### 3.5 无匹配结果

```
GET {{base}}/book/list?keyword=不存在的书名xyz

→ 期望: 200
{
  "list": [],
  "total": 0,
  "page": 1,
  "size": 10
}
```

## 4. 图书详情

### 4.1 正常查看

```
GET {{base}}/book/detail?id=1

→ 期望: 200
{
  "id": 1,
  "title": "NestJS 从入门到实践",
  "author": "张三",
  "isbn": "978-7-111-10001",
  "description": null,
  "cover": null,
  "price": 79,
  "status": "AVAILABLE",
  "category": { "id": 3, "name": "后端开发" },
  "tags": [
    { "id": 1, "name": "NestJS" },
    { "id": 2, "name": "TypeScript" }
  ]
}
```

### 4.2 不存在的 ID

```
GET {{base}}/book/detail?id=99999

→ 期望: 400
{
  "statusCode": 400,
  "message": "图书不存在"
}
```

### 4.3 无效 ID

```
GET {{base}}/book/detail?id=abc

→ 期望: 400
{
  "statusCode": 400,
  "message": "无效的图书 ID"
}
```

## 5. 新增图书

```
POST {{base}}/book/create
Content-Type: application/json

{
  "title": "测试新增图书",
  "author": "测试作者",
  "isbn": "978-7-111-99999",
  "price": 39.90,
  "description": "这是一本测试图书",
  "category": { "connect": { "id": 1 } }
}

→ 期望: 200
{
  "id": 13,
  "title": "测试新增图书",
  "author": "测试作者",
  "isbn": "978-7-111-99999",
  "price": 39.9,
  "status": "AVAILABLE",
  "category": { "id": 1, "name": "计算机科学" }
}
```

## 6. 更新图书

```
POST {{base}}/book/update
Content-Type: application/json

{
  "id": "13",
  "title": "测试新增图书（已修改）",
  "price": 49.90
}

→ 期望: 200
{
  "id": 13,
  "title": "测试新增图书（已修改）",
  "price": 49.9,
  // 其他字段不变
}
```

## 7. 借书

### 7.1 正常借书（bob 借《NestJS 从入门到实践》）

```
POST {{base}}/borrow/borrow
Content-Type: application/json

{
  "userId": "3",
  "bookId": "1"
}

→ 期望: 200
{
  "id": 3,
  "userId": 3,
  "bookId": 1,
  "borrowedAt": "2024-01-15T...",
  "returnedAt": null,
  "book": { "id": 1, "title": "NestJS 从入门到实践" },
  "user": { "id": 3, "username": "bob" }
}
```

### 7.2 重复借同一本书

```
POST {{base}}/borrow/borrow
Content-Type: application/json

{
  "userId": "3",
  "bookId": "1"
}

→ 期望: 400
{
  "statusCode": 400,
  "message": "您已借过该书，请先归还"
}
```

### 7.3 借已被借出的书（alice 已借了《深入理解 TypeScript》）

```
POST {{base}}/borrow/borrow
Content-Type: application/json

{
  "userId": "3",
  "bookId": "3"
}

→ 期望: 400
{
  "statusCode": 400,
  "message": "该书已被借出"
}
```

注意：seed 中 alice 已经借了 id=3 的书。

### 7.4 超过借阅上限

```
# bob 再借 3 本书
POST {{base}}/borrow/borrow  body: { "userId": "3", "bookId": "4" }  → ✅
POST {{base}}/borrow/borrow  body: { "userId": "3", "bookId": "7" }  → ✅
# 第 4 本（超出上限）
POST {{base}}/borrow/borrow
Content-Type: application/json

{
  "userId": "3",
  "bookId": "8"
}

→ 期望: 400
{
  "statusCode": 400,
  "message": "每人最多同时借阅 3 本书"
}
```

## 8. 查询当前借阅

### 8.1 bob 的当前借阅

```
GET {{base}}/borrow/my-borrows?userId=3

→ 期望: 200
[
  {
    "id": ...,
    "userId": 3,
    "bookId": ...,
    "borrowedAt": "...",
    "returnedAt": null,
    "book": {
      "id": ...,
      "title": "...",
      "author": "...",
      "cover": null
    }
  },
  ...  // 共 3 条（bob 借了 3 本）
]
```

## 9. 还书

### 9.1 bob 归还《NestJS 从入门到实践》

```
POST {{base}}/borrow/return
Content-Type: application/json

{
  "userId": "3",
  "bookId": "1"
}

→ 期望: 200
{
  "id": 3,
  "userId": 3,
  "bookId": 1,
  "borrowedAt": "2024-01-15T...",
  "returnedAt": "2024-01-15T...",  // ← 有了归还时间
  "book": { "id": 1, "title": "NestJS 从入门到实践" }
}
```

### 9.2 重复归还

```
POST {{base}}/borrow/return
Content-Type: application/json

{
  "userId": "3",
  "bookId": "1"
}

→ 期望: 400
{
  "statusCode": 400,
  "message": "未找到该借阅记录"
}
```

## 10. 借阅历史

```
GET {{base}}/borrow/history?userId=3&page=1&size=10

→ 期望: 200
{
  "list": [
    {
      "id": 3,
      "userId": 3,
      "bookId": 1,
      "borrowedAt": "...",
      "returnedAt": "...",
      "book": { "id": 1, "title": "NestJS 从入门到实践", "author": "张三" }
    }
  ],
  "total": 1,
  "page": 1,
  "size": 10
}
```

## 11. 检查图书可借状态

```
GET {{base}}/borrow/check?bookId=1

→ 期望: 200
{
  "bookId": 1,
  "title": "NestJS 从入门到实践",
  "status": "AVAILABLE",
  "canBorrow": true,
  "totalBorrows": 1    // 被借过 1 次（已归还）
}
```

## 12. 图书删除

```
POST {{base}}/book/delete
Content-Type: application/json

{
  "id": "13"
}

→ 期望: 200
{
  "success": true
}

# 验证：再次查询
GET {{base}}/book/detail?id=13
→ 期望: 400 "图书不存在"
```

## 异常场景总结

| 场景 | 期望状态码 | 期望消息 |
|------|:-------:|------|
| 注册重复用户名 | 400 | 用户名已存在 |
| 登录密码错误 | 400 | 用户名或密码错误 |
| 查询不存在的书 | 400 | 图书不存在 |
| 借已借出的书 | 400 | 该书已被借出 |
| 重复借同一本 | 400 | 您已借过该书 |
| 超过借阅上限 | 400 | 每人最多同时借阅 3 本书 |
| 归还未借的书 | 400 | 未找到该借阅记录 |
| 参数格式错误 | 400 | 参数格式错误 |

## Postman 环境变量

```
# 创建 Postman Environment
base: http://localhost:3000
admin_user: admin
admin_pass: 123456
normal_user: bob
normal_pass: 123456
```

---

## 参考链接

- [Postman — Getting Started](https://learning.postman.com/docs/getting-started/introduction/)
