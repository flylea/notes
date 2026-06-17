> **Part**: Part IV — 网络与数据
> **上一章**: [Chapter 17 — Dio HTTP 客户端](./Chapter-17-Dio-HTTP客户端.md)
> **下一章**: [Chapter 19 — freezed JSON 序列化](./Chapter-19-freezed-JSON序列化.md)
> **官方文档**: [pub.dev/packages/retrofit](https://pub.dev/packages/retrofit)

---

# 第 18 章：Retrofit — 类型安全 API 层

## 0. 本章目标与前置依赖

**前置依赖**：已配置 Dio 客户端（Chapter 18），理解代码生成（build_runner）。

**本章目标**：掌握 Retrofit 声明式 API 接口定义（@GET/@POST/@PUT/@DELETE）、理解与 Dio 的关系、掌握大项目 API 组织策略。

> 🎯 **本章会在图书馆 App 中做什么**：用 Retrofit 定义 BookApi/AuthApi/BorrowApi 接口，生成类型安全的 API 客户端代码。

---

## 1. 为什么需要 Retrofit

手写 Dio 调用的问题：
```dart
// ❌ 手写 Dio — 每次都要：序列化 URL / 设 Content-Type / 类型转换 / 错误处理
final res = await dio.get('/books/${id}');
final book = Book.fromJson(res.data['data']);  // 手动转换，data['data'] 无类型
```

Retrofit 把以上重复代码全部生成：
```dart
// ✅ Retrofit — 声明式定义，类型安全
@GET('/books/{id}')
Future<Book> getBook(@Path('id') String id);
```

**Retrofit 不替代 Dio，而是封装 Dio**——Retrofit 生成的代码内部仍然调用 Dio，但消除了所有手动样板代码。≈ Android Retrofit / TS tRPC 的角色。

---

## 2. 安装与配置

```yaml
dependencies:
  retrofit: ^4.4.0
dev_dependencies:
  retrofit_generator: ^9.1.0
  build_runner: ^2.4.0
```

---

## 3. 定义 API 接口

```dart
// lib/core/network/api/book_api.dart
import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';
import '../../../models/book.dart';
part 'book_api.g.dart';  // ← build_runner 自动生成

@RestApi(baseUrl: 'https://api.library.app/v1')
abstract class BookApi {
  factory BookApi(Dio dio, {String baseUrl}) = _BookApi; // 生成的工厂构造

  // ① GET 列表（Query 参数）
  @GET('/books')
  Future<PaginatedResponse<Book>> getBooks({
    @Query('page') int page = 1,
    @Query('limit') int limit = 20,
    @Query('category') String? category,
    @Query('sort') String sort = 'title',
  });

  // ② GET 详情（Path 参数）
  @GET('/books/{id}')
  Future<Book> getBookById(@Path('id') String id);

  // ③ POST 创建（Body 参数）
  @POST('/books')
  Future<Book> createBook(@Body() Book book);

  // ④ PUT 更新
  @PUT('/books/{id}')
  Future<Book> updateBook(@Path('id') String id, @Body() Book book);

  // ⑤ DELETE 删除
  @DELETE('/books/{id}')
  Future<void> deleteBook(@Path('id') String id);

  // ⑥ Multipart 上传（文件上传）
  @POST('/books/{id}/cover')
  @MultiPart()
  Future<Book> uploadCover(@Path('id') String id, @Part() File file);

  // ⑦ 自定义 Headers
  @GET('/books/search')
  Future<List<Book>> searchBooks(
    @Query('q') String query,
    @Header('X-Request-ID') String requestId,
  );
}
```

### 其他 API 接口

```dart
// lib/core/network/api/auth_api.dart
@RestApi(baseUrl: 'https://api.library.app/v1')
abstract class AuthApi {
  factory AuthApi(Dio dio, {String baseUrl}) = _AuthApi;

  @POST('/auth/login')
  Future<AuthResponse> login(@Body() LoginRequest request);

  @POST('/auth/register')
  Future<AuthResponse> register(@Body() RegisterRequest request);

  @POST('/auth/refresh')
  Future<AuthResponse> refreshToken(@Body() RefreshRequest request);
}

// lib/core/network/api/borrow_api.dart
@RestApi(baseUrl: 'https://api.library.app/v1')
abstract class BorrowApi {
  factory BorrowApi(Dio dio, {String baseUrl}) = _BorrowApi;

  @POST('/borrows')
  Future<BorrowRecord> borrowBook(@Body() BorrowRequest request);

  @POST('/borrows/{id}/return')
  Future<BorrowRecord> returnBook(@Path('id') String id);
}
```

---

## 4. 配合 Riverpod 注入

```dart
// lib/core/di/providers.dart
final bookApiProvider = Provider<BookApi>((ref) {
  return BookApi(ref.watch(dioClientProvider));
});

// API 调用在 AsyncNotifier 中：
@riverpod
class BookList extends _$BookList {
  @override
  Future<List<Book>> build() async {
    final api = ref.watch(bookApiProvider);
    final response = await api.getBooks();
    return response.data;  // PaginatedResponse<Book>.data
  }
}
```

---

## 5. 注解速查

| 注解 | 位置 | 示例 |
|------|------|------|
| `@GET('/path')` | 方法 | `@GET('/books/{id}')` |
| `@POST` / `@PUT` / `@DELETE` / `@PATCH` | 方法 | `@POST('/books')` |
| `@Path('param')` | 参数 | `@Path('id') String id` |
| `@Query('key')` | 参数 | `@Query('page') int page` |
| `@Body()` | 参数 | `@Body() Book book` |
| `@Header('key')` | 参数 | `@Header('Auth') String token` |
| `@Headers({...})` | 方法 | `@Headers({'Cache': 'no-cache'})` |
| `@Part()` | 参数 | `@Part() File file` |

---

## 6. 常见错误与最佳实践

### 常见错误

| 错误描述 | 后果 | 正确做法 |
|---------|------|----------|
| 忘记添加 `part 'xxx.g.dart'` | 生成器跳过该文件，无 `.g.dart` 输出 | 在类文件顶部紧跟 import 后添加 `part 'book_api.g.dart';` |
| `baseUrl` 末尾带 `/`，`@GET` 路径也以 `/` 开头 | URL 被拼接为 `//books`，请求 404 | 统一约定：`baseUrl` 不带末尾 `/`，路径以 `/` 开头 |
| 接口方法返回类型写 `Future<dynamic>` 或 `Future<Map>` | 失去类型安全，需要手动 `fromJson` | 始终声明精确返回类型 `Future<Book>` 或 `Future<PaginatedResponse<Book>>` |
| `@Path('id')` 参数名与 `@GET('/books/{id}')` 中的占位符不一致 | 编译无报错，但运行时参数不代入 URL | 确保 `@Path('name')` 与 `{name}` 字面一致 |
| 忘记运行 `build_runner` 就使用 API 接口 | 工厂构造 `_BookApi` 不存在，编译失败 | 开发期用 `dart run build_runner watch` 监听文件变化自动生成 |

### 最佳实践

- `part` 指令紧跟在 import 之后，放在类定义之前
- 统一在 `@RestApi(baseUrl:)` 中配置基础地址，不在 `factory` 构造中重复传入
- 使用 `@Headers({...})` 统一设置公共请求头（如 `Content-Type`、`Accept`）
- 按业务域拆分 API 接口文件：`BookApi`、`AuthApi`、`BorrowApi`，避免单文件膨胀
- 配合 Riverpod `Provider` 注入 API 实例，便于测试时替换为 mock
- 错误处理统一在 Dio `Interceptor` 层完成（如 401 自动刷新 Token），Retrofit 接口保持纯粹
- 返回类型使用 freezed 生成的数据类（`Future<Book>`），从源头保证类型安全
- 接口方法参数使用命名参数 + 默认值（`int page = 1`），减少调用方心智负担

---

## 7. 本章小结

Retrofit 在手写 Dio 之上提供了类型安全的声明式 API 层——定义抽象接口，build_runner 生成实现代码。10+ 端点的大型项目可减少数千行样板代码。与 tRPC/GraphQL codegen 思路一致。

---

## 8. 本章练习

1. 为 Library App 定义 `BookApi` 接口，包含 `getBooks`（分页）、`getBookById`、`searchBooks` 三个端点，运行 `build_runner` 生成代码
2. 添加一个带 `@Header` 的认证端点 `refreshToken`，验证生成的 `_BookApi` 正确附加自定义 Header
3. 用 `@Query` 实现带多个查询参数的搜索接口：`/books/search?q=flutter&category=tech&page=1`

验证标准：`dart run build_runner build` 成功生成 `.g.dart` 文件，所有端点编译通过。

> **下一步**: [Chapter 19 — freezed JSON 序列化与代码生成](./Chapter-19-freezed-JSON序列化.md)
> **原始文档**: [pub.dev/packages/retrofit](https://pub.dev/packages/retrofit)
