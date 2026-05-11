# Nest 内置 Pipe 详解

## 为什么需要 Pipe？

除了 ValidationPipe，Nest 还内置了 7 个 Pipe，用于处理简单的类型转换和默认值。它们主要应用在 `@Param()` 和 `@Query()` 上。

## 内置 Pipe 速查

| Pipe | 参数级别使用示例 |
|------|----------------|
| `ParseIntPipe` | `@Param('id', ParseIntPipe) id: number` |
| `ParseFloatPipe` | `@Query('price', ParseFloatPipe) price: number` |
| `ParseBoolPipe` | `@Query('active', ParseBoolPipe) active: boolean` |
| `ParseArrayPipe` | `@Body('ids', ParseArrayPipe) ids: string[]` |
| `ParseUUIDPipe` | `@Param('id', ParseUUIDPipe) id: string` |
| `DefaultValuePipe` | `@Query('page', new DefaultValuePipe(1)) page: number` |
| `ValidationPipe` | 全局注册（已详讲） |

## 1. ParseIntPipe

最常用的内置 Pipe，用于路径参数和查询参数的类型转换：

```typescript
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  // id 的类型是 number，不是 string
  console.log(typeof id);  // 'number'
  console.log(id + 1);     // 正常数学运算
  return this.bookService.findById(id);
}
```

如果前端传了 `GET /book/abc`（非数字），自动返回：
```json
{
  "statusCode": 400,
  "message": "Validation failed (numeric string is expected)",
  "error": "Bad Request"
}
```

### ParseIntPipe 选项

```typescript
@Param('id', new ParseIntPipe({
  errorHttpStatusCode: 400,                // 错误状态码
  exceptionFactory: (error) => {           // 自定义错误
    throw new BadRequestException('ID 必须是整数');
  },
}))
```

## 2. ParseFloatPipe

```typescript
@Get('search')
search(
  @Query('minPrice', ParseFloatPipe) minPrice: number,
  @Query('maxPrice', ParseFloatPipe) maxPrice: number,
) {
  // minPrice、maxPrice 都是 number
  return this.bookService.findByPriceRange(minPrice, maxPrice);
}
```

## 3. ParseBoolPipe

```typescript
@Get('list')
list(
  @Query('available', ParseBoolPipe) available: boolean,
) {
  // 前端传 ?available=true  → available = true  (boolean)
  // 前端传 ?available=false → available = false (boolean)
  // 前端传 ?available=1     → available = true  (boolean)
  // 前端传 ?available=0     → available = false (boolean)
  console.log(typeof available);  // 'boolean'
}
```

## 4. ParseArrayPipe

用于处理逗号分隔的批量操作：

```typescript
@Get('batch')
batch(
  @Query('ids', new ParseArrayPipe({ items: Number, separator: ',' }))
  ids: number[],
) {
  // 前端：?ids=1,2,3
  // 后端：ids = [1, 2, 3]  (number[])
  return this.bookService.findByIds(ids);
}
```

也可以在 Body 中使用：

```typescript
@Post('batch-delete')
batchDelete(
  @Body('ids', new ParseArrayPipe({ items: String }))
  ids: string[],
) {
  return this.bookService.batchDelete(ids);
}
```

### ParseArrayPipe 选项

```typescript
new ParseArrayPipe({
  items: Number,           // 数组元素类型（String/Number/Boolean）
  separator: ',',          // Query String 分隔符（默认 ','）
  optional: true,          // 可选参数
  minSize: 1,              // 数组最小长度
  maxSize: 100,            // 数组最大长度
})
```

## 5. ParseUUIDPipe

验证 UUID 格式，非法 UUID 直接返回 400：

```typescript
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
  // 只有合法的 UUID 才能走到这里
  return this.bookService.findById(id);
}
```

支持自定义 UUID 版本：

```typescript
new ParseUUIDPipe({ version: '4' })  // 只接受 UUID v4
```

## 6. DefaultValuePipe

提供默认值——类似前端 Vue Props 的 `default`：

```typescript
@Get('list')
list(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('size', new DefaultValuePipe(10), ParseIntPipe) size: number,
  @Query('keyword', new DefaultValuePipe('')) keyword: string,
) {
  // 前端不传参数时：
  // page = 1, size = 10, keyword = ''
}
```

> ⚠️ 注意执行顺序：`DefaultValuePipe` 必须放在 `ParseIntPipe` 之前。因为如果值为空，先要用默认值填充，再进行类型转换。

## Pipe 与全局 ValidationPipe 的关系

```typescript
// main.ts: 全局 transform: true
app.useGlobalPipes(new ValidationPipe({ transform: true }));

// BookController: @Param 使用 ParseIntPipe
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) { }
```

**执行顺序**：
1. 全局 ValidationPipe（`transform: true`）→ 尝试转换类型
2. Handler 级别的 Pipe（`ParseIntPipe`）→ 如果第 1 步未生效，这里兜底

> ⚠️ 如果全局开启了 `transform: true`，且 DTO 上有 `@Type(() => Number)`，Parameter 级别的 `ParseIntPipe` 可能不需要了。但安全性上 `ParseIntPipe` 更明确——它会在类型不匹配时直接报错，而 `@Type` 只是默默转换。

## 何时用全局 ValidationPipe vs 局部 Pipe？

| 场景 | 用哪种 |
|------|--------|
| POST/PUT Body 中的复杂对象校验 | 全局 ValidationPipe |
| URL 中的 ID 参数类型转换 | 局部 ParseIntPipe |
| 可选参数默认值 | 局部 DefaultValuePipe |
| 批量操作的数组解析 | 局部 ParseArrayPipe |

> 简单原则：Body（复杂对象用全局 ValidationPipe）、Param/Query（简单类型用局部 Pipe）。

---

## 参考链接

- [NestJS — Pipes](https://docs.nestjs.com/pipes)
- [NestJS — Validation](https://docs.nestjs.com/techniques/validation)
- 开源笔记：《Nest 通关秘籍》.doc/5.HTTP数据传输.md
