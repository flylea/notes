# 校验迁移到 Standard Schema（zod 4）：统一规格

> 用户决定（2026-11-22）：**笔记与 `example/` 全部改用新用法**（Standard Schema + zod），
> class-validator / class-transformer 只在 03.05 保留一段历史说明，其余章节不得再把它们当主写法。

## 0. 事实基线

- `@nestjs/common@12.6.0`：`@Body({ schema })` / `@Query({ schema })` / `@Param('id', { schema })` 的
  `ParameterDecoratorOptions.schema: StandardSchemaV1` 真实存在；`StandardSchemaValidationPipe`
  与 `StandardSchemaSerializerInterceptor` 为 12 新增内置实现。
- `@nestjs/swagger@12.1.2`：`@ApiOkResponse({ standardSchema })` 接受 `StandardSchemaV1 | StandardJSONSchemaV1`；
  `SwaggerDocumentOptions.standardSchemaConverter` 可选，默认走 schema 的 `~standard.jsonSchema.input/output`。
- `zod@4.6.7` 的 `~standard.jsonSchema` 已实现（实测 `z.object({...})['~standard'].jsonSchema.input({ target: 'openapi-3.0' })` 正常输出）。
- class-validator 最新 0.15.1（2026-02-26）；class-transformer 最新 0.5.1（2021-11-22，四年多未发版）。

## 1. 依赖

`example/package.json`：

- 删除 `class-validator`、`class-transformer`；
- 保留 `zod ^4.6.7`；
- 不再需要 `@nestjs/mapped-types`（`PartialType` 用 `schema.partial()` 替代）。

## 2. 文件与命名

```text
src/common/dto/pagination.schema.ts        # paginationSchema / paginatedSchema(item)
src/modules/<mod>/dto/<name>.schema.ts     # 请求 schema（原 *.dto.ts 改名）
src/modules/<mod>/dto/<name>-response.schema.ts  # 响应 schema（可选，用于 Swagger）
```

- 每个 schema 文件导出「schema 常量 + `z.infer` 类型」：
  `export const createRoomSchema = z.object({...})` / `export type CreateRoomInput = z.infer<typeof createRoomSchema>`；
- 命名：请求 `<动作><资源>Schema`、类型 `<动作><资源>Input`；查询 `query<资源>Schema` / `Query<资源>Input`。

## 3. zod 4 写法约定

```ts
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      page: z.number().int(),
      pageSize: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  });
```

规则对照（原 class-validator → zod 4）：

| 原写法 | zod 4 |
| --- | --- |
| `@IsString()` + `@Length(2,100)` | `z.string().min(2).max(100)` |
| `@IsEmail()` + `@MaxLength(191)` | `z.email().max(191)`（顶层函数，不是 `z.string().email()`） |
| `@Transform(trim().toLowerCase())` + `@IsEmail()` | `z.string().max(191).trim().toLowerCase().pipe(z.email())` |
| `@IsUUID()` | `z.uuid()` |
| `@IsISO8601({ strict: true })` | `z.iso.datetime({ offset: true })` |
| `@Type(() => Number) @IsInt() @Min(1) @Max(100)` | `z.coerce.number().int().min(1).max(100)` |
| `@IsOptional() @IsString()` | `z.string().optional()` |
| `@IsEnum(Role)` | `z.enum(Role)`（TS 枚举对象可直接传） |
| `@IsArray() @ArrayMaxSize(20) @IsString({ each: true })` | `z.array(z.string()).max(20)` |
| `PartialType(CreateRoomDto)` | `createRoomSchema.partial()` |
| DTO 继承（`extends PaginationQueryDto`） | `paginationSchema.extend({ ... })` |
| `@Matches(/^(?=.*[A-Za-z])(?=.*\d)/, { message: '密码必须同时包含字母和数字' })` | `z.string().regex(/^(?=.*[A-Za-z])(?=.*\d)/, { message: '密码必须同时包含字母和数字' })` |
| `@IsNotEmpty()` | `z.string().min(1)` |

## 4. 控制器写法

```ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

@Post()
create(@Body({ schema: createRoomSchema }) dto: CreateRoomInput) {
  return this.roomsService.create(dto);
}

@Get()
findAll(@Query({ schema: queryRoomsSchema }) query: QueryRoomsInput) {
  return this.roomsService.findAll(query);
}

@Get(':id')
findOne(@Param('id', { schema: z.uuid() }) id: string) {
  return this.roomsService.findOne(id);
}
```

- 删除全部 `ParseUUIDPipe`、`@Body() dto: XxxDto`、`@Query() query: XxxDto`；
- 参数类型用 `z.infer` 出来的 `Input` 类型，不写 class；
- 分页参数因为 `.default()` 已是 number，service 内不再需要 `?? 1` / `?? 10`。

## 5. `main.ts`

```ts
import { StandardSchemaValidationPipe } from '@nestjs/common';

app.useGlobalPipes(new StandardSchemaValidationPipe());
```

删除 `ValidationPipe` 及其 `whitelist / transform / transformOptions` 配置（schema 默认剥掉未声明键，等价 `whitelist`）。

## 6. Swagger 文档

- 请求：`@Body({ schema })` / `@Query({ schema })` 会被 `StandardSchemaOpenApiConverter` 自动转成 requestBody / parameters，不写 `@ApiProperty`；
- 响应：`@ApiOkResponse({ standardSchema: roomResponseSchema })`（数组用 `z.array(...)`；分页用 `paginatedSchema(itemSchema)`）；
- 响应统一被 `ResponseInterceptor` 包成 `{ data, meta? }`，所以响应 schema 要写成包装后的形状（`z.object({ data: ... })` 或 `paginatedSchema(...)`）；
- 不再使用 `PartialType`（来自 `@nestjs/swagger` 或 `@nestjs/mapped-types`）。

## 7. 错误响应形状

`StandardSchemaValidationPipe` 抛 `BadRequestException`，`message` 是字符串数组，每条带路径前缀：
`["name: Too small: expected string to have >=2 characters", "startTime: Invalid ISO datetime"]`。
`AllExceptionsFilter` 已支持 `string | string[]`，无需改动。

## 8. example 验收命令（在副本里跑，别污染仓库）

```bash
rm -rf /tmp/example-schema && cp -R example /tmp/example-schema && cd /tmp/example-schema
pnpm install
pnpm typecheck && pnpm db:emit && pnpm build
node dist/main.js &   # 无 DB 也能起
curl -s localhost:3000/api/health
curl -s -X POST localhost:3000/api/rooms -H 'content-type: application/json' -d '{}'   # 期望 400 + message 数组
curl -s localhost:3000/api/docs-json | python3 -c "import json,sys; d=json.load(sys.stdin); print(list(d['paths']))"
```

另需确认：`/api/docs-json` 里 `POST /api/rooms` 的 `requestBody.content['application/json'].schema` 有 `required` 与 `properties`（说明 standard schema 已转换）。

## 9. 书稿改写规则

1. 只保留 03.05 一节「class-validator 是不是不用了」的历史说明；其它章节的**主写法全部是 zod schema + StandardSchemaValidationPipe**；
2. 改写后每节「正文汉字（去代码块与行内 code）」**不得低于改写前**（用脚本核），代码块 8–20 个可接受；
3. 不新增未实测的版本号/耗时/百分比；保留原有插图的 `图 NN.MM-K` 编号；
4. 每节改完自检：代码块数为偶数、`check-structure` 0、`validate-chapters` 0；
5. 只改分配给你的文件，不动 `_meta/`、README、`_chapter.md`、其它章节。
