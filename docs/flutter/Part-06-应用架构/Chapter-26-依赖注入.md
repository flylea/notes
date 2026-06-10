> **Part**: Part VI — 应用架构
> **上一章**: [Chapter 25 — Repository 模式](./Chapter-25-Repository模式.md)
> **下一章**: [Chapter 27 — Feature-First 项目结构](./Chapter-27-FeatureFirst项目结构.md)
> **官方文档**: [flutter.cn/app-architecture/recommendations](https://docs.flutter.cn/app-architecture/recommendations)

---

# 第 26 章：依赖注入 — Riverpod DI 体系 + get_it 共存

## 0. 本章目标

掌握 Riverpod 作为主 DI 容器的使用模式、get_it 管理全局非响应式服务、Override 机制（测试注入 + 环境切换）、dev/staging/prod 三环境配置。

> 🎯 **Library App 产出**：完整 Riverpod DI 容器（Repository → DataSource → Supabase Client 依赖链）、get_it 管理 Analytics/Logger/CrashReporter、三环境配置切换。

---

## 1. Riverpod 作为 DI 容器

```dart
// lib/core/di/injection_container.dart

// 第 1 层：基础设施
@riverpod
SupabaseClient supabaseClient(SupabaseClientRef ref) => Supabase.instance.client;

@riverpod
Dio dio(DioRef ref) => DioClient(baseUrl: ref.watch(appConfigProvider).baseUrl).dio;

// 第 2 层：DataSource
@riverpod
BookRemoteDataSource bookRemoteDataSource(BookRemoteDataSourceRef ref) =>
    BookRemoteDataSource(client: ref.watch(supabaseClientProvider));

@riverpod
BookLocalDataSource bookLocalDataSource(BookLocalDataSourceRef ref) =>
    BookLocalDataSource();

// 第 3 层：Repository
@riverpod
BookRepository bookRepository(BookRepositoryRef ref) => BookRepositoryImpl(
      remote: ref.watch(bookRemoteDataSourceProvider),
      local: ref.watch(bookLocalDataSourceProvider),
    );

// 第 4 层：ViewModel 自动依赖 Repository（通过 ref.watch 链）
// homeViewModelProvider 内部：ref.watch(bookRepositoryProvider)
```

## 2. get_it — 非响应式全局服务

```dart
// lib/core/di/app_services.dart
final getIt = GetIt.instance;

Future<void> setupServices(AppConfig config) async {
  // 不参与 UI 响应的全局服务——用 get_it
  getIt.registerLazySingleton<AnalyticsService>(() => FirebaseAnalyticsService());
  getIt.registerLazySingleton<LoggerService>(() => LoggerService(config.isDebug));
  getIt.registerLazySingleton<CrashReporter>(() => SentryCrashReporter(config.sentryDsn));
}

// 在任意位置使用（不需要 BuildContext）：
// final analytics = getIt<AnalyticsService>();
// analytics.logEvent('book_viewed', {'book_id': id});
```

## 3. 环境配置切换

```dart
// lib/core/config/app_config.dart
@freezed
class AppConfig with _$AppConfig {
  const factory AppConfig({
    required Environment env,
    required String baseUrl,
    required String supabaseUrl,
    required String supabaseKey,
    required bool isDebug,
    String? sentryDsn,
  }) = _AppConfig;

  static AppConfig development() => AppConfig(
        env: Environment.dev, baseUrl: 'https://dev-api.library.app/v1',
        supabaseUrl: 'https://dev-project.supabase.co', supabaseKey: 'sb_publishable_dev',
        isDebug: true,
      );

  static AppConfig production() => AppConfig(
        env: Environment.prod, baseUrl: 'https://api.library.app/v1',
        supabaseUrl: 'https://prod-project.supabase.co', supabaseKey: 'sb_publishable_prod',
        isDebug: false, sentryDsn: 'https://xxx@sentry.io/yyy',
      );
}

final appConfigProvider = Provider<AppConfig>((ref) {
  // 通过 --dart-define=ENV=prod 环境变量切换
  const env = String.fromEnvironment('ENV', defaultValue: 'dev');
  return env == 'prod' ? AppConfig.production() : AppConfig.development();
});
```

## 4. Override — 测试注入

```dart
// 单元测试中注入 Fake
test('getBooks returns books from repository', () async {
  final container = ProviderContainer(
    overrides: [
      // 用 Fake 替换真实 Repository
      bookRepositoryProvider.overrideWith((ref) {
        return FakeBookRepository()..addTestData(testBooks);
      }),
    ],
  );

  final vm = container.read(homeViewModelProvider.notifier);
  await container.read(homeViewModelProvider.future);

  expect(container.read(homeViewModelProvider).value!.books, hasLength(3));
});
```

---

## 5. DI 选择决策

| 场景 | 方案 |
|------|------|
| 需要响应式更新 UI | Riverpod Provider |
| 全局单例不参与 UI | get_it |
| 测试中替换依赖 | ProviderScope.overrides |
| dev/staging/prod 切换 | --dart-define 环境变量 + Provider |

---

> **下一步**: [Chapter 27 — Feature-First 项目结构](./Chapter-27-FeatureFirst项目结构.md)
