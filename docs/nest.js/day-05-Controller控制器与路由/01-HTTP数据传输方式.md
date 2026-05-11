# 5 种 HTTP 数据传输方式

## 方式总览

| 方式 | Content-Type | 数据位置 | 适合场景 | 前端发送方式 |
|------|-------------|---------|---------|------------|
| URL Param | — | URL 路径中 | 资源定位 | `/users/123` |
| Query String | — | URL `?` 后面 | 过滤/分页 | `/users?page=1` |
| form-urlencoded | `application/x-www-form-urlencoded` | Body | 简单表单 | HTML `<form>` |
| JSON | `application/json` | Body | **API 通信（最常用）** | `axios.post(url, data)` |
| form-data | `multipart/form-data` | Body | 文件上传 | `new FormData()` |

## 1. URL Param — 资源定位

```
GET /users/123
GET /books/456
```

在 Nest 中获取：

```typescript
@Get(':id')
findOne(@Param('id') id: string) {
  return this.userService.findById(+id);
}

// 多个参数
@Get(':userId/books/:bookId')
findUserBook(
  @Param('userId') userId: string,
  @Param('bookId') bookId: string,
) {}
```

> URL Param 适合"这是哪个资源"的标识。ID 类型的参数通常放 URL Param。

## 2. Query String — 过滤和分页

```
GET /users?page=1&size=10&keyword=john
```

在 Nest 中获取：

```typescript
@Get()
findAll(
  @Query('page') page?: string,
  @Query('size') size?: string,
  @Query('keyword') keyword?: string,
) {
  return this.userService.findAll({
    page: page ? +page : 1,
    size: size ? +size : 10,
    keyword,
  });
}
```

或者用一个 DTO 接收：

```typescript
class FindAllQueryDto {
  page?: number;
  size?: number;
  keyword?: string;
}

@Get()
findAll(@Query() query: FindAllQueryDto) {
  return this.userService.findAll(query);
}
```

> Query String 适合"怎么查这个资源"的修饰——分页、排序、过滤、搜索。

## 3. form-urlencoded — HTML 表单传统方式

```
POST /login
Content-Type: application/x-www-form-urlencoded

username=john&password=123456
```

Nest 默认**不解析** `x-www-form-urlencoded`，需要手动启用：

```typescript
// main.ts
import * as bodyParser from 'body-parser';
app.use(bodyParser.urlencoded({ extended: true }));
```

> 现代前后端分离式 API 几乎不用这个——JSON 是标准。但如果你对接 HTML `<form>` 提交或老式系统，需要知道这个。

## 4. JSON — API 通信标准

```
POST /users
Content-Type: application/json

{
  "username": "john",
  "password": "123456"
}
```

Nest 中**开箱即用**（底层用 `express.json()`）：

```typescript
@Post()
create(@Body() dto: CreateUserDto) {
  return this.userService.create(dto);
}
```

> 这是后端 API 最常用的数据传输方式。前端 `axios.post(url, data)` 默认就用这个。

## 5. form-data — 文件上传

```
POST /upload
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

(binary data)
------WebKitFormBoundary--
```

在 Nest 中处理：

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
uploadFile(@UploadedFile() file: Express.Multer.File) {
  console.log(file.originalname, file.size);
  return { url: `/uploads/${file.filename}` };
}
```

> form-data 主要用于文件上传。普通数据传 JSON 就行。

## 前端到后端的完整数据流

```
前端 (Vue/React)
    │
    │  axios.post('/api/users', { username: 'john', password: '123456' })
    │  Content-Type: application/json
    │
    ▼
Nest 服务器
    │
    │  express.json() 自动解析 Body → req.body = { username: 'john', password: '123456' }
    │
    ▼
ValidationPipe
    │
    │  transform: true → 将普通对象转为 CreateUserDto 实例
    │  校验 @IsNotEmpty() 等规则
    │
    ▼
Controller (@Body() dto: CreateUserDto)
    │
    │  dto 已经是校验通过的 CreateUserDto 实例
    │
    ▼
Service (this.userService.create(dto))
```

---

## 参考链接

- [NestJS — Controllers](https://docs.nestjs.com/controllers)
- [MDN — HTTP Messages](https://developer.mozilla.org/en-US/docs/Web/HTTP/Messages)
- 开源笔记：《Nest 通关秘籍》.doc/5. 5 种 HTTP 数据传输方式.md
