> **Part**: Part IV — 网络与数据
> **上一章**: [Chapter 16 — 深度链接与 URL 策略](../Part-03-导航与路由/Chapter-16-深度链接与URL策略.md)
> **下一章**: [Chapter 18 — Retrofit 类型安全 API](./Chapter-18-Retrofit类型安全API.md)
> **官方文档**: [flutter.cn/data-and-backend/networking](https://docs.flutter.cn/data-and-backend/networking) | [pub.dev/packages/dio](https://pub.dev/packages/dio)

---

# 第 17 章：Dio — HTTP 客户端与 REST API 集成

## 0. 本章目标与前置依赖

**前置依赖**：理解 Dart 异步编程（Chapter 02），已了解 HTTP 协议基础。Riverpod 状态管理参见 Part V。

**本章目标**：掌握 Dio 完整配置（BaseOptions/拦截器链/超时重试/请求取消/文件上传进度）、设计多环境 API 配置（dev/staging/prod）、实现 Dio + Riverpod 异步数据流、建立与 Axios 的完整对照。

> 🎯 **本章会在图书馆 App 中做什么**：创建 Dio 客户端 + 日志/错误/鉴权拦截器链、配置三环境 API Base URL、用 Riverpod FutureProvider 对接图书列表 API。

---

## 1. http 包 vs Dio

| 维度 | http 包 | Dio |
|------|---------|-----|
| 拦截器 | ❌ | ✅ 请求/响应/错误拦截器链 |
| 请求取消 | ❌ | ✅ CancelToken |
| 超时重试 | ❌ | ✅ RetryEvaluator |
| 文件上传进度 | ❌ | ✅ onSendProgress |
| 拦截器队列 | ❌ | ✅ QueueInterceptor（Token 刷新排队） |
| 适用 | 3-5 个端点的小项目 | 中大型生产应用 |

---

## 2. Dio 基础配置

```dart
// lib/core/network/dio_client.dart
import 'package:dio/dio.dart';
import 'api_interceptor.dart';

class DioClient {
  late final Dio dio;

  DioClient({required String baseUrl}) {
    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      validateStatus: (status) => status != null && status < 500,
    ));

    dio.interceptors.addAll([
      LogInterceptor(requestBody: true, responseBody: true),  // ① 日志
      AuthInterceptor(dio),                                    // ② 鉴权
      RetryOnErrorInterceptor(dio),                            // ③ 重试
    ]);
  }
}

// ③ 重试拦截器
class RetryOnErrorInterceptor extends Interceptor {
  final Dio dio;
  RetryOnErrorInterceptor(this.dio);

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (_shouldRetry(err) && (err.requestOptions.extra['retryCount'] ?? 0) < 3) {
      err.requestOptions.extra['retryCount'] = (err.requestOptions.extra['retryCount'] ?? 0) + 1;
      await Future.delayed(Duration(seconds: err.requestOptions.extra['retryCount'] as int));
      try {
        final response = await dio.fetch(err.requestOptions);
        handler.resolve(response);
        return;
      } catch (_) {}
    }
    handler.next(err);
  }

  bool _shouldRetry(DioException err) =>
      err.type == DioExceptionType.connectionTimeout ||
      err.type == DioExceptionType.receiveTimeout ||
      (err.type == DioExceptionType.badResponse && (err.response?.statusCode ?? 0) >= 500);
}

// ② Auth 拦截器（Token 注入）
class AuthInterceptor extends Interceptor {
  final Dio dio;
  AuthInterceptor(this.dio);

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // 从 SecureStorage 读取 Token（Chapter 29 实现）
    // final token = await secureStorage.read('access_token');
    final token = 'mock-token';
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Token 过期 → 尝试刷新
      // final newToken = await refreshToken();
      // 用新 Token 重试原始请求
      // err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
      // final response = await dio.fetch(err.requestOptions);
      // handler.resolve(response);
      // return;
    }
    handler.next(err);
  }
}

// ④ 统一错误处理
class ApiException implements Exception {
  final String message;
  final int? statusCode;
  const ApiException(this.message, [this.statusCode]);
  @override
  String toString() => 'ApiException($statusCode): $message';
}
```

---

## 3. 多环境配置

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

  // Supabase URL (Chapter 21)
  String get supabaseUrl => switch (env) {
    Environment.dev     => 'https://dev-project.supabase.co',
    Environment.staging => 'https://staging-project.supabase.co',
    Environment.prod    => 'https://prod-project.supabase.co',
  };
}
```

---

## 4. API Service 层 + Riverpod 集成

```dart
// lib/core/network/api/book_api_service.dart
class BookApiService {
  final Dio dio;
  BookApiService(this.dio);

  Future<List<Book>> getBooks({int page = 1, int limit = 20}) async {
    final response = await dio.get('/books', queryParameters: {'page': page, 'limit': limit});
    final list = response.data['data'] as List;
    return list.map((json) => Book.fromJson(json)).toList();
  }

  Future<Book> getBookById(String id) async {
    final response = await dio.get('/books/$id');
    return Book.fromJson(response.data['data']);
  }

  Future<Book> createBook(Book book) async {
    final response = await dio.post('/books', data: book.toJson());
    return Book.fromJson(response.data['data']);
  }

  Future<void> deleteBook(String id) async {
    await dio.delete('/books/$id');
  }
}

// Riverpod Provider
final dioClientProvider = Provider<Dio>((ref) {
  final config = ref.watch(networkConfigProvider);
  return config.client.dio;
});

final bookApiServiceProvider = Provider<BookApiService>((ref) {
  return BookApiService(ref.watch(dioClientProvider));
});

final bookListProvider = FutureProvider<List<Book>>((ref) async {
  final api = ref.watch(bookApiServiceProvider);
  return api.getBooks();
});
```

---

## 5. 图书馆 App 实战

```dart
// ⚠️ 注意：以下 @riverpod 代码依赖 Riverpod 代码生成（Part V 状态管理系列章节会详解）。
// 如果你还没有学习 Riverpod，可以先跳过这段，用上面 §4 的 FutureProvider 方式替代。
// 在 Riverpod AsyncNotifier 中集成 Dio
@riverpod
class BookList extends _$BookList {
  @override
  Future<List<Book>> build() async {
    final api = ref.watch(bookApiServiceProvider);
    return api.getBooks();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final api = ref.read(bookApiServiceProvider);
      return api.getBooks();
    });
  }

  Future<void> add(Book book) async {
    final api = ref.read(bookApiServiceProvider);
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => api.createBook(book));
  }
}
```

---

## 6. 与 Axios 对照

| Axios | Dio |
|-------|-----|
| `axios.create({ baseURL })` | `Dio(BaseOptions(baseUrl: ...))` |
| `axios.interceptors.request.use(fn)` | `dio.interceptors.add(Interceptor(onRequest: fn))` |
| `axios.CancelToken.source()` | `CancelToken()` |
| `axios.get('/url', { params })` | `dio.get('/url', queryParameters: params)` |
| `axios.post('/url', data)` | `dio.post('/url', data: data)` |
| `error.response?.status` | `err.response?.statusCode` |

---

## 7. 本章小结

| 你学到了什么 | 核心要点 |
|-------------|---------|
| Dio BaseOptions | timeout/baseUrl/headers 全局配置 |
| 拦截器链 | LogInterceptor → AuthInterceptor → RetryInterceptor |
| Token 自动刷新 | 401 拦截 + 排队重试机制 |
| 多环境配置 | dev/staging/prod 三环境 BaseURL 切换 |
| Dio + Riverpod | FutureProvider + AsyncNotifier guard |

---

## 8. 本章练习

1. 为 Library App 配置三环境 Dio 实例：dev（localhost:3000）/ staging（staging-api.example.com）/ prod（api.example.com），用 `--dart-define` 切换
2. 写一个 `AuthInterceptor`，在请求头中自动附加 Bearer Token，收到 401 时打印日志并跳转登录页
3. 用 `CancelToken` 实现搜索请求的自动取消——用户连续输入时，前一个请求被取消，只保留最新的

验证标准：切换 `--dart-define=ENV=dev` 后 BaseURL 正确；快速连续输入后只有最后一次请求完成。

> **下一步**: [Chapter 18 — Retrofit 类型安全 API 层](./Chapter-18-Retrofit类型安全API.md)
> **原始文档**: [pub.dev/packages/dio](https://pub.dev/packages/dio) | [flutter.cn/data-and-backend/networking](https://docs.flutter.cn/data-and-backend/networking)
