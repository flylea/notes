# Swagger/OpenAPI 概念

## 什么是 Swagger

Swagger 规范（现称 OpenAPI）是一套**描述 RESTful API 的标准**。它用 JSON/YAML 定义接口的 URL、参数、返回值，人和机器都能读懂。

```
一个 Swagger 文档可以回答：
  - 有哪些接口？           GET /book/list, POST /book/create, ...
  - 每个接口需要什么参数？   Query? Body? Path? 类型？必填？
  - 返回什么数据？          { list: Book[], total: number }
  - 需要认证吗？           Authorization: Bearer <token>
  - 可能返回什么错误？      400, 401, 403, 404
```

## 前端类比

```
前端的接口文档方案：
  - 手写 Markdown 文档  → 写完就忘了更新，代码和文档对不上
  - Postman Collection  → 不错，但需要手动维护和导出
  - YApi/Apifox         → 需要额外平台，与代码分离
  - 从代码自动生成      → 代码即文档，永远同步

Swagger = 后端的"代码即文档"
  不需要手动写文档——装饰器标注在 Controller 上
  Swagger 自动扫描代码生成 JSON Spec
  再生成漂亮的 Web UI 页面
```

## @nestjs/swagger 做了什么

```typescript
// 你写代码
@Controller('book')
export class BookController {
  @Get('list')
  @ApiOperation({ summary: '查询图书列表' })   // ← 这就是文档
  @ApiQuery({ name: 'page', required: false })  // ← 这就是文档
  async list(@Query('page') page?: string) {}
}

// Swagger 扫描后自动生成：
// → swagger.json（OpenAPI 规范文档）
// → Swagger UI（可交互的 Web 页面）
```

## 安装

```bash
npm install @nestjs/swagger
```

## 启用后获得什么

```
http://localhost:3000/api-docs

┌──────────────────────────────────────────────┐
│  Book Management System API v1.0             │
│  ┌────────────────────────────────────────┐  │
│  │  Book                                   │  │
│  │  ┌──────────────────────────────────┐   │  │
│  │  │ GET  /book/list   查询图书列表     │   │  │
│  │  │ POST /book/create 新增图书       │   │  │
│  │  │ POST /book/update 更新图书       │   │  │
│  │  └──────────────────────────────────┘   │  │
│  │  User                                   │  │
│  │  ┌──────────────────────────────────┐   │  │
│  │  │ POST /user/register  用户注册     │   │  │
│  │  │ POST /user/login     用户登录     │   │  │
│  │  └──────────────────────────────────┘   │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

每个接口可以点开，看到：
- 参数说明（Query/Body/Path）
- 返回值示例
- Try it out 按钮——直接在浏览器中调用接口！
- curl 命令

---

## 参考链接

- [OpenAPI Specification](https://swagger.io/specification/)
- [NestJS — OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
