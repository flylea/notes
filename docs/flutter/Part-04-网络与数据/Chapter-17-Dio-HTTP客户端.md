# 第 17 章：Dio — HTTP 客户端与 REST API 集成

## 0. 本章目标

- 掌握 Dio 的完整配置：BaseOptions、拦截器链、超时重试、请求取消
- 理解并实现 Token 自动刷新 + 请求排队机制
- 设计多环境 API 配置（dev/staging/prod）
- 实现 Dio + Riverpod 的异步数据流集成
- 了解与 Axios 的对照关系

> **前置依赖**：[Ch16 — 深度链接与 URL 策略](../Part-03-导航与路由/Chapter-16-深度链接与URL策略.md) + Dart 异步编程（[Ch02](../Part-01-起航/Chapter-02-Dart核心语法速通-上.md)）
>
> 🎯 **Library App 产出**：Dio 客户端 + 日志/鉴权/重试拦截器链、三环境 BaseURL 配置、Riverpod Provider 对接图书列表 API。

---

## 1. 为什么不用 http 包？

Flutter 官方提供了 `package:http`，但它只是一个**最简 HTTP 客户端**。在实际生产项目中，你会很快遇到它的瓶颈：

| 需求 | http 包 | Dio |
|------|---------|-----|
| 请求/响应日志 | ❌ 手写 | ✅ `LogInterceptor` |
| 请求头注入（Token） | ❌ 每次手动加 | ✅ `AuthInterceptor` |
| 超时重试 | ❌ 手写 | ✅ `RetryEvaluator` |
| 请求取消 | ❌ | ✅ `CancelToken` |
| 文件上传进度 | ❌ | ✅ `onSendProgress` |
| 拦截器队列（Token 刷新排队） | ❌ | ✅ `QueueInterceptor` |
| 请求缓存 | ❌ | ✅ `CacheInterceptor`（社区） |
| **适用场景** | 3-5 个端点的原型 | 中大型生产应用 |

> **选择建议**：如果你的 App 只需要从 2-3 个 REST 端点拉取数据，http 包足够。一旦需要统一的错误处理、Token 管理、请求日志、超时重试中的任意两项——直接上 Dio。

---

## 2. Dio 基础配置

### 2.1 创建 Dio 实例

```dart
// lib/core/network/dio_client.dart
import 'package:dio/dio.dart';

class DioClient {
  late final Dio dio;

  DioClient({required String baseUrl}) {
    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      validateStatus: (status) => status != null && status < 500,
    ));

    dio.interceptors.addAll([
      LogInterceptor(requestBody: true, responseBody: true),  // ①
      AuthInterceptor(dio),                                    // ②
      RetryOnErrorInterceptor(dio),                            // ③
    ]);
  }
}
```

**`validateStatus` 的作用**：默认情况下，Dio 只在状态码 200-299 时认为请求"成功"。设置 `validateStatus: (status) => status != null && status < 500` 意味着所有 2xx/3xx/4xx 都算成功，只有 5xx 和网络错误才进 `onError`。这让你的业务逻辑可以自己在 `then` 中处理 4xx 错误（如 400 表单验证、404 资源不存在）。

### 2.2 重试拦截器

```dart
class RetryOnErrorInterceptor extends Interceptor {
  final Dio dio;
  RetryOnErrorInterceptor(this.dio);

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (_shouldRetry(err)) {
      final retryCount = (err.requestOptions.extra['retryCount'] ?? 0) as int;
      if (retryCount < 3) {
        err.requestOptions.extra['retryCount'] = retryCount + 1;
        // 指数退避：1s → 2s → 4s
        await Future.delayed(
            Duration(seconds: 1 << retryCount)); // 1, 2, 4
        try {
          final response = await dio.fetch(err.requestOptions);
          return handler.resolve(response);
        } catch (_) {
          // 重试依然失败，继续往下走
        }
      }
    }
    handler.next(err);
  }

  bool _shouldRetry(DioException err) {
    // 连接超时 + 读取超时 + 服务端 5xx 才重试
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout) {
      return true;
    }
    if (err.type == DioExceptionType.badResponse) {
      final code = err.response?.statusCode ?? 0;
      return code >= 500; // 5xx 服务端错误可重试
    }
    return false; // 4xx 客户端错误不重试——重试也没用
  }
}
```

### 2.3 统一错误处理

```dart
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic data; // 服务端返回的详细错误信息

  const ApiException(this.message, [this.statusCode, this.data]);

  factory ApiException.fromDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return ApiException('网络连接超时，请检查网络', null);
      case DioExceptionType.connectionError:
        return ApiException('无法连接到服务器', null);
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        final data = e.response?.data;
        return switch (statusCode) {
          400 => ApiException('请求参数错误', 400, data),
          401 => ApiException('登录已过期，请重新登录', 401),
          403 => ApiException('没有权限执行此操作', 403),
          404 => ApiException('请求的资源不存在', 404),
          422 => ApiException('数据验证失败', 422, data),
          429 => ApiException('请求过于频繁，请稍后重试', 429),
          _ => ApiException('服务器错误 ($statusCode)', statusCode),
        };
      default:
        return ApiException('未知网络错误', null);
    }
  }

  @override
  String toString() => 'ApiException($statusCode): $message';
}
```

---

## 3. Token 自动刷新与请求排队

这是网络层的**核心难点**：当 Token 过期时，多个并发请求会同时收到 401。如果每个请求都独立刷新 Token，会导致多次刷新请求，甚至可能循环。

### 3.1 AuthInterceptor 完整实现

```dart
class AuthInterceptor extends Interceptor {
  final Dio dio;
  final SecureStorage _storage; // 来自 Ch35
  bool _isRefreshing = false;
  final _pendingRequests = <({RequestOptions options, ErrorInterceptorHandler handler})>[];

  AuthInterceptor(this.dio, this._storage);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.read('access_token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    if (_isRefreshing) {
      // Token 正在刷新中：将请求加入等待队列
      _pendingRequests.add((options: err.requestOptions, handler: handler));
      return;
    }

    _isRefreshing = true;
    try {
      final newToken = await _refreshToken();
      await _storage.write('access_token', newToken);

      // 用新 Token 重试当前请求
      err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
      final response = await dio.fetch(err.requestOptions);
      handler.resolve(response);

      // 重试所有等待中的请求
      for (final pending in _pendingRequests) {
        pending.options.headers['Authorization'] = 'Bearer $newToken';
        dio.fetch(pending.options).then(
          (r) => pending.handler.resolve(r),
          onError: (e) => pending.handler.reject(e as DioException),
        );
      }
    } catch (e) {
      // Token 刷新也失败了 → 所有等待的请求都失败
      for (final pending in _pendingRequests) {
        pending.handler.next(err);
      }
      handler.next(err);
    } finally {
      _isRefreshing = false;
      _pendingRequests.clear();
    }
  }

  Future<String> _refreshToken() async {
    final refreshToken = await _storage.read('refresh_token');
    if (refreshToken == null) throw Exception('No refresh token');
    final response = await Dio().post(
      '${dio.options.baseUrl}/auth/refresh',
      data: {'refresh_token': refreshToken},
    );
    return response.data['access_token'] as String;
  }
}
```

**工作流程**：
```
请求 A → 401 → 开始刷新 Token（_isRefreshing = true）
请求 B → 401 → 发现正在刷新 → 加入等待队列
请求 C → 401 → 发现正在刷新 → 加入等待队列
Token 刷新完成 → 用新 Token 重试 A、B、C
```

---

## 4. 请求取消 — CancelToken

搜索场景中，用户连续输入时前序请求应立即取消，只保留最新请求。

```dart
class SearchApiService {
  final Dio dio;
  CancelToken? _cancelToken;

  SearchApiService(this.dio);

  Future<List<Book>> search(String query) async {
    // 取消上一次搜索
    _cancelToken?.cancel('用户输入了新内容');

    // 创建新的 CancelToken
    _cancelToken = CancelToken();

    final response = await dio.get(
      '/books/search',
      queryParameters: {'q': query},
      cancelToken: _cancelToken,  // 传入 CancelToken
    );
    return (response.data['data'] as List)
        .map((json) => Book.fromJson(json))
        .toList();
  }

  void dispose() {
    _cancelToken?.cancel();
  }
}
```

---

## 5. 多环境配置

```dart
// lib/core/network/network_config.dart
enum Environment { dev, staging, prod }

class NetworkConfig {
  final Environment env;
  late final DioClient client;

  NetworkConfig(this.env) {
    client = DioClient(baseUrl: baseUrl);
  }

  String get baseUrl => switch (env) {
    Environment.dev     => 'https://dev-api.library.app/v1',
    Environment.staging => 'https://staging-api.library.app/v1',
    Environment.prod    => 'https://api.library.app/v1',
  };
}

// 通过 --dart-define 从构建命令注入环境
// flutter run --dart-define=ENV=staging
// flutter build apk --dart-define=ENV=prod
const envName = String.fromEnvironment('ENV', defaultValue: 'dev');

final networkConfigProvider = Provider<NetworkConfig>((ref) {
  final env = switch (envName) {
    'prod'    => Environment.prod,
    'staging' => Environment.staging,
    _         => Environment.dev,
  };
  return NetworkConfig(env);
});
```

---

## 6. Dio + Riverpod 集成

### 6.1 API Service 层

```dart
// lib/features/books/data/book_api_service.dart
class BookApiService {
  final Dio dio;
  BookApiService(this.dio);

  Future<PaginatedResponse<Book>> getBooks({int page = 1, int limit = 20}) async {
    final response = await dio.get(
      '/books',
      queryParameters: {'page': page, 'limit': limit},
    );
    return PaginatedResponse.fromJson(
      response.data,
      (json) => Book.fromJson(json),
    );
  }

  Future<Book> getBookById(String id) async {
    final response = await dio.get('/books/$id');
    return Book.fromJson(response.data['data']);
  }

  Future<Book> createBook(CreateBookDto dto) async {
    final response = await dio.post('/books', data: dto.toJson());
    return Book.fromJson(response.data['data']);
  }

  Future<Book> updateBook(String id, UpdateBookDto dto) async {
    final response = await dio.patch('/books/$id', data: dto.toJson());
    return Book.fromJson(response.data['data']);
  }

  Future<void> deleteBook(String id) async {
    await dio.delete('/books/$id');
  }
}
```

### 6.2 Riverpod Provider 注册

```dart
// lib/core/network/di.dart
final dioProvider = Provider<Dio>((ref) {
  final config = ref.watch(networkConfigProvider);
  return config.client.dio;
});

final bookApiServiceProvider = Provider<BookApiService>((ref) {
  return BookApiService(ref.watch(dioProvider));
});

// 简单的 FutureProvider（适合只读场景）
final bookListProvider = FutureProvider<List<Book>>((ref) async {
  final api = ref.watch(bookApiServiceProvider);
  final result = await api.getBooks();
  return result.data;
});
```

### 6.3 AsyncNotifier 完整集成（带错误处理）

```dart
// lib/features/books/presentation/book_list_controller.dart
@riverpod
class BookList extends _$BookList {
  @override
  Future<List<Book>> build() async {
    final api = ref.watch(bookApiServiceProvider);
    final result = await api.getBooks();
    return result.data;
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final api = ref.read(bookApiServiceProvider);
      final result = await api.getBooks();
      return result.data;
    });
  }

  Future<void> addBook(CreateBookDto dto) async {
    final api = ref.read(bookApiServiceProvider);
    // 乐观更新：先更新 UI，再发请求
    final previous = state.valueOrNull ?? [];
    state = AsyncValue.data([Book.placeholder(), ...previous]);

    state = await AsyncValue.guard(() async {
      await api.createBook(dto);
      final result = await api.getBooks();
      return result.data;
    });

    if (state.hasError) {
      // 请求失败，回滚到之前的状态
      state = AsyncValue.data(previous);
    }
  }
}
```

---

## 7. 与 Axios 对照

| Axios (JS/TS) | Dio (Dart) | 说明 |
|---------------|-----------|------|
| `axios.create({ baseURL })` | `Dio(BaseOptions(baseUrl: ...))` | 创建实例 |
| `axios.interceptors.request.use(fn)` | `dio.interceptors.add(Interceptor(onRequest: fn))` | 请求拦截 |
| `axios.interceptors.response.use(success, error)` | `dio.interceptors.add(Interceptor(onResponse: fn, onError: fn))` | 响应拦截 |
| `new AbortController().signal` | `CancelToken()` | 请求取消 |
| `error.response?.status` | `err.response?.statusCode` | 获取状态码 |
| `axios.get('/url', { params })` | `dio.get('/url', queryParameters: params)` | GET 请求 |
| `axios.post('/url', data)` | `dio.post('/url', data: data)` | POST 请求 |
| `onUploadProgress` | `onSendProgress` (in options) | 上传进度 |
| `onDownloadProgress` | `onReceiveProgress` (in options) | 下载进度 |
| `axios.CancelToken.source()` | `CancelToken()` | 取消令牌 |

---

## 8. 常见错误与最佳实践

### 8.1 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|---------|
| ❌ 每个页面自己 `new Dio()` | 多个 Dio 实例各有独立的拦截器链和连接池，浪费资源 | 全局共享一个 Dio 实例（通过 Provider 注入） |
| ❌ Token 刷新不加排队机制 | 多个并发 401 请求各自刷新 Token，最后一次刷新的覆盖之前的 | 用 `_isRefreshing` 标记 + 等待队列 |
| ❌ 401 后直接跳转登录页 | 一个接口 401 不代表所有场景都要登出 | 区分"真过期"和"接口权限不足" |
| ❌ 忘记 `CancelToken.cancel()` | 页面销毁后网络回调访问已销毁的 Widget → 内存泄漏 | 在 dispose 中 cancel |
| ❌ 在 `onError` 中吞掉错误不调用 `handler.next()` | 错误被静默忽略，上层代码不知道出错了 | 始终调用 `handler.next(err)` 或 `handler.resolve()` |

### 8.2 最佳实践

1. **全局单例 Dio**：通过 Riverpod `Provider<Dio>` 注入，全 App 共享连接池
2. **拦截器链顺序重要**：LogInterceptor → AuthInterceptor → RetryInterceptor（先记日志，再注入 Token，最后处理重试）
3. **Token 刷新只做一次**：`_isRefreshing` 标记确保同一时刻只有一个刷新请求在进行
4. **请求重试有上限**：最多 3 次，指数退避（1s/2s/4s），避免请求风暴
5. **错误分类处理**：4xx（客户端错误）不重试，5xx（服务端错误）可重试，网络超时可重试
6. **构建时注入环境**：用 `--dart-define` + `String.fromEnvironment`，不要在代码中硬编码 URL
7. **Cancel Token 生命周期**：每个页面/功能持有自己的 `CancelToken`，页面销毁时 cancel

---

## 9. 本章小结

| 概念 | 核心要点 |
|------|---------|
| Dio vs http | Dio 提供拦截器链、Token 刷新、请求取消、重试等生产级能力 |
| 拦截器链 | 有序的请求/响应处理管道：Log → Auth → Retry |
| Token 刷新 | 401 拦截 + 刷新锁（`_isRefreshing`）+ 等待队列重试 |
| 请求取消 | `CancelToken` 取消上次搜索，节省带宽和后端资源 |
| 多环境 | `--dart-define` + `String.fromEnvironment` 构建时选择环境 |
| Riverpod 集成 | `Provider<Dio>` 全局注入 → `Provider<BookApiService>` → `FutureProvider`/`AsyncNotifier` |
| 错误处理 | `ApiException.fromDioError` 统一转换，按状态码分级描述 |

---

## 10. 本章练习

**练习 1：实现完整的 AuthInterceptor**

为 Library App 实现带 Token 刷新排队的 `AuthInterceptor`。使用 `SecureStorage`（Ch35）存取 Token。测试场景：同时发起 3 个需要认证的请求，其中一个触发 401，验证其他两个请求被排队并在 Token 刷新后自动重试。

**练习 2：搜索防抖 + 请求取消**

用 `CancelToken` 实现搜索请求的自动取消。用户连续输入时，前序请求被 cancel，只保留最新的。配合 300ms 的 debounce（用 `Timer` 实现），避免每次按键都发请求。

**练习 3：三环境配置**

为 Library App 配置 dev/staging/prod 三套 Dio 实例。使用 `--dart-define=ENV=staging` 切换环境。验证：不同环境通过不同 BaseURL 请求，console 日志中可见。

---

> **下一步**: [Chapter 18 — Retrofit 类型安全 API 层](./Chapter-18-Retrofit类型安全API.md)
> 📖 **延伸阅读**: [Dio 官方文档](https://pub.dev/packages/dio) | [Flutter 网络层最佳实践](https://docs.flutter.dev/data-and-backend/networking)
