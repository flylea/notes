# 务实的 API 设计：GET/POST 为主的极简规范

## RESTful 的"原教旨"与现实

RESTful 标准推荐的动词使用：

```
GET    /users      → 列表
GET    /users/:id  → 详情
POST   /users      → 新增
PUT    /users/:id  → 全量更新
PATCH  /users/:id  → 部分更新
DELETE /users/:id  → 删除
```

但在真正和企业级项目中，这种设计带来了实际麻烦：

### 问题 1：前端需要区分 5 种 HTTP 方法

```typescript
// 前端代码变复杂
await axios.get('/users')           // 列表
await axios.post('/users', data)    // 新增
await axios.put(`/users/${id}`, data) // 更新
await axios.delete(`/users/${id}`)    // 删除
```

### 问题 2：某些中间件/防火墙限制 DELETE

某些老旧网关、CDN 或公司防火墙默认禁用 PUT/DELETE 请求。

### 问题 3：更新接口的复杂度

```typescript
// PUT 要求全量更新（所有字段都要传）
PUT /users/1
{ "username": "john", "password": "xxx", "email": "john@test.com", "bio": "..." }

// PATCH 只传变更字段
PATCH /users/1
{ "email": "new@test.com" }
// 前端要决定用 PUT 还是 PATCH，增加心智负担
```

## 企业级的务实方案

**只用 GET 和 POST，用 URL 路径中的动词区分操作**：

```
GET  /users/list               → 用户列表
GET  /users/detail?id=1        → 用户详情
POST /users/create             → 新增用户
POST /users/update             → 更新用户
POST /users/delete?id=1        → 删除用户
```

对应的 Nest Controller：

```typescript
@Controller('users')
export class UserController {
  @Get('list')
  list(@Query() query: PaginationDto) {
    return this.userService.list(query);
  }

  @Get('detail')
  detail(@Query('id') id: string) {
    return this.userService.findById(+id);
  }

  @Post('create')
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Post('update')
  update(@Body() dto: UpdateUserDto) {
    return this.userService.update(dto);
  }

  @Post('delete')
  delete(@Query('id') id: string) {
    return this.userService.delete(+id);
  }
}
```

**优势**：
- 前端只需 `axios.get()` 和 `axios.post()`，心智负担最小
- URL 本身就能看出操作意图（`/delete?id=1` 一目了然）
- 不受 HTTP 方法限制（防火墙/网关不拦 GET/POST）
- 方便在 Swagger 中分组（按功能而非 HTTP 方法）

## 什么时候用 PUT/DELETE

在以下场景中，标准 RESTful 仍然有价值：

1. **公开 API（给第三方开发者）**：RESTful 的约定能让其他开发者更快理解 API
2. **自动生成 SDK**：OpenAPI Generator 这类工具基于 RESTful 方法生成客户端代码
3. **团队习惯**：如果整个团队都习惯标准 RESTful，不用强行改

**推荐策略**：内部项目的业务接口用 GET/POST，公开给第三方的 API 做 RESTful。这是目前国内公司的务实做法。

## 接口命名规范

```
GET  /api/users/list            列表
GET  /api/users/detail?id=1     详情
POST /api/users/create          新增
POST /api/users/update          编辑
POST /api/users/delete          删除
POST /api/users/login           登录
POST /api/users/register        注册
POST /api/users/reset-password  重置密码
```

> 命名原则：**URL = 资源（名词）+ 操作（动词）**。`/users/create` 比 `/users` POST（RESTful）对前端更友好。

---

## 参考链接

- [NestJS — Controllers](https://docs.nestjs.com/controllers)
- [REST API Tutorial](https://restfulapi.net/)
- 开源笔记：《Nest 通关秘籍》.doc/5. 5 种 HTTP 数据传输方式.md
