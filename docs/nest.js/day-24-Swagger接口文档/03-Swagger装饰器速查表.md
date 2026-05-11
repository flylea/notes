# Swagger 装饰器速查表

## 全部装饰器一览

| 装饰器 | 作用 | 位置 |
|--------|------|------|
| `@ApiTags()` | 接口分组 | Controller 类 |
| `@ApiOperation()` | 接口说明 | 方法 |
| `@ApiQuery()` | Query 参数 | 方法 |
| `@ApiParam()` | Path 参数 | 方法 |
| `@ApiBody()` | 请求体 | 方法 |
| `@ApiResponse()` | 响应说明 | 方法 |
| `@ApiBearerAuth()` | 需要 Bearer Token | 方法/类 |
| `@ApiProperty()` | DTO 属性说明 | DTO 属性 |
| `@ApiPropertyOptional()` | DTO 可选属性 | DTO 属性 |
| `@ApiHideProperty()` | 隐藏属性 | DTO 属性 |
| `@ApiExtraModels()` | 额外关联模型 | 方法/类 |
| `@ApiHeader()` | 自定义 Header | 方法 |
| `@ApiConsumes()` | 请求 Content-Type | 方法 |

## @ApiTags——接口分组

```typescript
@Controller('book')
@ApiTags('图书管理')   // 在 Swagger UI 中归入"图书管理"组
export class BookController {}
```

## @ApiOperation——接口说明

```typescript
@Post('create')
@ApiOperation({
  summary: '新增图书',                    // 简短标题
  description: '创建一本新图书，ISBN 不可重复',  // 详细说明
  deprecated: false,                     // 标记为废弃
  externalDocs: {                        // 外部文档链接
    description: '图书管理规范',
    url: 'https://wiki.example.com/book-spec',
  },
})
async create() {}
```

## @ApiQuery——Query 参数

```typescript
@Get('list')
@ApiQuery({ name: 'page', required: false, type: Number, description: '页码', example: 1 })
@ApiQuery({ name: 'size', required: false, type: Number, description: '每页条数', example: 10 })
@ApiQuery({ name: 'keyword', required: false, type: String, description: '搜索关键词' })
async list(
  @Query('page') page?: string,
  @Query('size') size?: string,
  @Query('keyword') keyword?: string,
) {}
```

## @ApiParam——Path 参数

```typescript
@Get(':id')
@ApiParam({ name: 'id', type: Number, description: '图书 ID', example: 1 })
async findOne(@Param('id') id: string) {}
```

## @ApiBody——请求体

```typescript
@Post('create')
@ApiBody({
  description: '图书信息',
  type: CreateBookDto,           // 引用 DTO 类
  examples: {                    // 多个示例
    basic: {
      summary: '基础示例',
      value: { title: 'NestJS 实战', author: '张三' },
    },
    full: {
      summary: '完整示例',
      value: { title: 'NestJS 实战', author: '张三', isbn: '978-7-111-10001', price: 79 },
    },
  },
})
async create(@Body() body: CreateBookDto) {}
```

## @ApiResponse——响应说明

```typescript
@Post('create')
@ApiResponse({ status: 201, description: '创建成功' })
@ApiResponse({ status: 400, description: '参数校验失败' })
@ApiResponse({ status: 401, description: '未登录' })
@ApiResponse({ status: 403, description: '权限不足' })
@ApiResponse({ status: 409, description: 'ISBN 已存在' })
async create() {}
```

## @ApiBearerAuth——需要认证

```typescript
@Controller('borrow')
@ApiBearerAuth('bearer')    // 整个 Controller 的接口都需要 Token
export class BorrowController {}

// 或单个方法
@Post('borrow')
@ApiBearerAuth('bearer')
async borrow() {}
```

## @ApiHeader——自定义请求头

```typescript
@Post('create')
@ApiHeader({ name: 'X-Idempotency-Key', description: '幂等键', required: false })
async create() {}
```

## @ApiConsumes——Content-Type

```typescript
@Post('upload-cover')
@ApiConsumes('multipart/form-data')
@UseInterceptors(FileInterceptor('cover'))
async uploadCover() {}
```

---

## 参考链接

- [NestJS — OpenAPI Decorators](https://docs.nestjs.com/openapi/decorators)
- [NestJS — OpenAPI Operations](https://docs.nestjs.com/openapi/operations)
