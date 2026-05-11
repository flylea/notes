# Postman 全面测试用户模块

## 测试环境准备

```bash
pnpm run start:dev
# 确认控制台显示：Application is running on: http://localhost:3000
```

## 测试 1：正常注册

```
POST http://localhost:3000/user/register
Content-Type: application/json

{
  "username": "john",
  "password": "123456"
}
```

预期响应（200 OK）：

```json
{
  "username": "john"
}
```

检查 `users.json`：

```json
[
  {
    "username": "john",
    "password": "123456"
  }
]
```

## 测试 2：缺少必填字段

```
POST http://localhost:3000/user/register
Content-Type: application/json

{
  "password": "123456"
}
```

预期响应（400 Bad Request）：

```json
{
  "statusCode": 400,
  "message": ["用户名不能为空"],
  "error": "Bad Request"
}
```

## 测试 3：密码少于 6 位

```
POST http://localhost:3000/user/register
Content-Type: application/json

{
  "username": "jane",
  "password": "12"
}
```

预期响应（400 Bad Request）：

```json
{
  "statusCode": 400,
  "message": ["密码最少 6 位"],
  "error": "Bad Request"
}
```

## 测试 4：重复注册

再次发送测试 1 的请求。

预期响应（400 Bad Request）：

```json
{
  "statusCode": 400,
  "message": "该用户已注册",
  "error": "Bad Request"
}
```

## 测试 5：正常登录

```
POST http://localhost:3000/user/login
Content-Type: application/json

{
  "username": "john",
  "password": "123456"
}
```

预期响应（200 OK）：

```json
{
  "username": "john"
}
```

## 测试 6：密码错误

```
POST http://localhost:3000/user/login
Content-Type: application/json

{
  "username": "john",
  "password": "wrongpassword"
}
```

预期响应（400 Bad Request）：

```json
{
  "statusCode": 400,
  "message": "密码不正确",
  "error": "Bad Request"
}
```

## 测试 7：用户不存在

```
POST http://localhost:3000/user/login
Content-Type: application/json

{
  "username": "nonexistent",
  "password": "123456"
}
```

预期响应（400 Bad Request）：

```json
{
  "statusCode": 400,
  "message": "用户不存在",
  "error": "Bad Request"
}
```

## 测试 8：whitelist 效果验证

```
POST http://localhost:3000/user/register
Content-Type: application/json

{
  "username": "hacker",
  "password": "123456",
  "isAdmin": true,
  "balance": 9999999
}
```

预期：成功注册，但 `isAdmin` 和 `balance` 字段被 `whitelist: true` 自动剔除，不会出现在 `users.json` 中。

## 测试汇总

| 测试场景 | 预期结果 |
|---------|---------|
| 正常注册 | 200，返回用户名 |
| 缺少 username | 400，"用户名不能为空" |
| 密码太短 | 400，"密码最少 6 位" |
| 重复注册 | 400，"该用户已注册" |
| 正常登录 | 200，返回用户名 |
| 密码错误 | 400，"密码不正确" |
| 用户不存在 | 400，"用户不存在" |
| whitelist | 多余字段被剔除 |

> 全部通过说明用户模块核心功能正常，可以进入下一个模块的开发。

---

## 参考链接

- 开源笔记：《Nest 通关秘籍》.doc/28. 图书管理系统：用户模块后端开发.md
