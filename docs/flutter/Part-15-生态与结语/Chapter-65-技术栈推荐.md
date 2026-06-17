# 第 65 章：2026 年 Flutter 技术栈推荐

## 0. 本章目标

- 了解 2026 年 Flutter 生态主流技术选型
- 理解每个推荐方案的核心优势和适用边界
- 掌握技术选型的决策方法论
- 获得可直接使用的生产级 pubspec.yaml 模板
- 学会在方案之间迁移

> 🎯 **本章产出**：一份完整的推荐 pubspec.yaml + 技术选型决策文档，可复用到你的任何新项目中。

---

## 1. 技术选型原则

在选择技术栈时，遵循以下优先级：

1. **官方推荐优先**：Flutter/Dart 团队维护或推荐的方案，文档和社区支持最完善
2. **社区活跃度**：GitHub stars、更新频率、issue 响应速度
3. **学习成本 vs 收益**：不为了"高级"而增加不必要的复杂度
4. **与现有架构的契合度**：你的 MVVM + Repository 架构适合什么方案？
5. **团队背景**：React 背景选 Riverpod，原生背景选 Bloc

---

## 2. 状态管理：详细对比与选型

### 2.1 方案深度对比

| 维度 | setState | Provider | Riverpod 2.x | Bloc |
|------|----------|----------|-------------|------|
| **类型安全** | 运行时 | 运行时 | **编译时** | 运行时 |
| **BuildContext 依赖** | 需要 | 需要 | **不需要** | 需要（BlocProvider.of） |
| **Provider 组合** | 无 | ChangeNotifierProxy | **原生支持** | BlocListener |
| **自动回收** | 手动 dispose | 需手动 | **autoDispose** | close() |
| **代码生成** | — | — | riverpod_generator | bloc + freezed |
| **测试难度** | 中（需 pumpWidget） | 中 | **低（无 BuildContext）** | 低（纯 Bloc 测试） |
| **学习时间** | 1 小时 | 1 天 | 2-3 天 | 1 周 |
| **适合最大值** | 3 页面 | 10 页面 | 50+ 页面 | 100+ 页面 |

### 2.2 为什么本教程选择 Riverpod？

```dart
// 理由 1：编译时安全 — 拼写错误在编译期就暴露
final bookProvider = Provider<List<Book>>((ref) => []);
// 如果写成 bokProvider，编译直接报错（而不是运行时找不到）

// 理由 2：无需 BuildContext — 可以在任何地方使用
void someFunction(Ref ref) {
  final books = ref.read(bookProvider);  // 不需要 context
}

// 理由 3：autoDispose — 离开页面自动清理
@riverpod
class SearchResults extends _$SearchResults {
  @override
  Future<List<Book>> build(String query) async {
    ref.onDispose(() => print('搜索 Provider 已释放'));
    return repository.search(query);
  }
  // 当 SearchScreen pop 时，这个 Provider 自动 dispose
}

// 理由 4：Provider 覆盖 — 测试时替换实现
testWidgets('should show books', (tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        bookRepositoryProvider.overrideWith((ref) => MockBookRepository()),
      ],
      child: const LibraryApp(),
    ),
  );
});
```

### 2.3 迁移指南：Provider → Riverpod

```dart
// === 第 1 步：替换 Provider 声明 ===

// Provider 旧写法
class BookRepositoryProvider extends ChangeNotifier {
  final BookRepository _repo = BookRepository();
  List<Book> _books = [];
  List<Book> get books => _books;

  Future<void> loadBooks() async {
    _books = await _repo.fetchAll();
    notifyListeners();
  }
}

// Riverpod 新写法
@riverpod
class BookList extends _$BookList {
  @override
  Future<List<Book>> build() async {
    final repo = ref.watch(bookRepositoryProvider);
    return repo.fetchAll();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() {
      final repo = ref.read(bookRepositoryProvider);
      return repo.fetchAll();
    });
  }
}

// === 第 2 步：替换 Consumer ===

// Provider 旧写法
class BookListPage extends StatelessWidget {
  Widget build(BuildContext context) {
    final books = context.watch<BookRepositoryProvider>().books;
    return ListView(/* ... */);
  }
}

// Riverpod 新写法
class BookListPage extends ConsumerWidget {
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(bookListProvider);
    return booksAsync.when(
      loading: () => const CircularProgressIndicator(),
      error: (e, _) => ErrorView(message: e.toString()),
      data: (books) => ListView(/* ... */),
    );
  }
}
```

### 2.4 迁移指南：Riverpod → Bloc

```dart
// Riverpod 写法
@riverpod
Future<List<Book>> books(BooksRef ref) async {
  final repo = ref.watch(bookRepoProvider);
  return repo.fetchAll();
}

// Bloc 写法
// 1. 定义 Event
sealed class BookEvent {}
class LoadBooks extends BookEvent {}

// 2. 定义 State
sealed class BookState {}
class BookLoading extends BookState {}
class BookLoaded extends BookState { final List<Book> books; BookLoaded(this.books); }

// 3. 定义 Bloc
class BookBloc extends Bloc<BookEvent, BookState> {
  final BookRepository _repo;
  BookBloc(this._repo) : super(BookLoading()) {
    on<LoadBooks>((event, emit) async {
      emit(BookLoading());
      try {
        final books = await _repo.fetchAll();
        emit(BookLoaded(books));
      } catch (e) { /* ... */ }
    });
  }
}
// Bloc 模板代码约是 Riverpod 的 3-4 倍，但事件链可追溯
```

---

## 3. 网络层：Dio vs http vs retrofit

### 3.1 为什么选 Dio 而不是 http？

| 特性 | `package:http` | `dio` |
|------|---------------|-------|
| 拦截器 | ❌ 需手动实现 | ✅ 内置拦截器链 |
| 请求取消 | ❌ | ✅ CancelToken |
| 文件上传进度 | ❌ | ✅ onSendProgress |
| 连接超时设置 | ❌（需额外配置） | ✅ 内置超时控制 |
| 拦截器重试 | ❌ 手动实现 | ✅ 内置 RetryInterceptor |
| 日志拦截器 | ❌ 手动打印 | ✅ LogInterceptor |

```dart
// dio 拦截器链 — 优雅的切面编程
final dio = Dio(BaseOptions(baseUrl: 'https://api.example.com'))
  ..interceptors.addAll([
    LogInterceptor(requestBody: true, responseBody: true),  // 日志
    AuthInterceptor(dio),                                    // Token 刷新
    RetryInterceptor(dio: dio, retries: 3),                  // 重试
  ]);
```

### 3.2 retrofit：好不好用？

```dart
// retrofit 让你用注解定义 API — TypeScript 开发者会很熟悉

// 定义 API
@RestApi(baseUrl: 'https://api.example.com')
abstract class BookApi {
  factory BookApi(Dio dio) = _BookApi;

  @GET('/books')
  Future<List<Book>> getBooks();

  @GET('/books/{id}')
  Future<Book> getBook(@Path('id') String id);

  @POST('/books')
  Future<Book> createBook(@Body() Book book);

  @DELETE('/books/{id}')
  Future<void> deleteBook(@Path('id') String id);
}

// 使用（自动生成 _BookApi 类）
final api = BookApi(dio);
final books = await api.getBooks();
```

**review** — 是否必须用 retrofit？

| 场景 | 推荐 |
|------|------|
| API 端点 < 10 个 | 直接用 dio，retrofit 杀鸡用牛刀 |
| API 端点 10-50 个 | **推荐 retrofit**，注解比手写更可维护 |
| API 端点 > 50 个 | **强烈推荐 retrofit**，代码生成自动帮你对齐 |

---

## 4. 路由：go_router 深度使用

### 4.1 为什么是 go_router？

| 方案 | 声明式 | 深度链接 | ShellRoute | 路由守卫 | 官方推荐 |
|------|--------|---------|------------|---------|---------|
| Navigator 1.0 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Navigator 2.0 | ✅ | ❌ | ❌ | 手动实现 | ❌ |
| GoRouter | ✅ | ✅ | ✅ | ✅ | ✅ |
| auto_route | ✅ | ❌ | ❌ | ✅ | ❌ |
| beamer | ✅ | ❌ | ❌ | ✅ | ❌ |

### 4.2 ShellRoute 实战

```dart
final router = GoRouter(
  initialLocation: '/books',
  redirect: (context, state) {
    final isLoggedIn = ref.read(authProvider).isLoggedIn;
    final isLoginPage = state.matchedLocation == '/login';
    if (!isLoggedIn && !isLoginPage) return '/login';
    if (isLoggedIn && isLoginPage) return '/books';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),

    // ShellRoute 实现底部导航栏框架
    ShellRoute(
      builder: (_, __, child) => AppScaffold(child: child),
      routes: [
        GoRoute(
          path: '/books',
          builder: (_, __) => const BookListScreen(),
          routes: [
            GoRoute(
              path: ':id',
              builder: (_, state) => BookDetailScreen(
                id: state.pathParameters['id']!,
              ),
            ),
          ],
        ),
        GoRoute(path: '/borrows', builder: (_, __) => const BorrowListScreen()),
        GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      ],
    ),
  ],
);
```

---

## 5. 数据库：Drift vs Isar vs Hive

| 维度 | Drift (SQL) | Isar (NoSQL) | Hive (KV) |
|------|------------|-------------|-----------|
| **查询能力** | ⭐⭐⭐⭐⭐ 完整 SQL | ⭐⭐⭐ 索引+条件 | ⭐ 仅 key 查询 |
| **关系映射** | ⭐⭐⭐⭐⭐ JOIN/外键 | ⭐⭐ 手动关联 | ❌ |
| **响应式** | ⭐⭐⭐⭐⭐ Stream 查询 | ⭐⭐⭐ Stream | ⭐⭐ ValueListenable |
| **迁移** | ⭐⭐⭐⭐ 版本化 schema | ⭐⭐ 手动迁移 | ⭐ 无 schema |
| **性能** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **学习曲线** | ⭐⭐⭐ 需会 SQL | ⭐⭐⭐⭐ 直觉 API | ⭐⭐⭐⭐⭐ 极简 |

**推荐策略**：
- **主数据库**：Drift（需要复杂查询、关系数据、离线同步）
- **简单 KV**：SharedPreferences（设置、偏好、主题）
- **临时大数据**：Hive（非结构化缓存、图片缓存元数据）

---

## 6. BaaS 后端：Supabase vs Firebase vs Appwrite

| 维度 | Supabase | Firebase | Appwrite |
|------|----------|---------|---------|
| **数据库** | PostgreSQL（关系型） | Firestore（文档型） | 自研 DB |
| **开源** | ✅ 完全开源 | ❌ 闭源 | ✅ 开源 |
| **自托管** | ✅ docker compose | ❌ | ✅ |
| **Realtime** | ✅ PostgreSQL CDC | ✅ | ✅ |
| **Auth** | ✅ GoTrue (OAuth/SMS) | ✅ | ✅ |
| **价格** | 免费层慷慨 | 免费层一般 | 免费层慷慨 |
| **供应商锁定度** | 低（标准 PG） | 高 | 中 |

**为什么本教程选用 Supabase？**
1. PostgreSQL 是行业标准，学习一次到处可用
2. Row Level Security 让权限控制简单且安全
3. 完全开源，可以随时自托管
4. Realtime 基于 PostgreSQL 的 logical replication，可靠性高

---

## 7. 完整生产级 pubspec.yaml

```yaml
name: my_flutter_app
description: A production-ready Flutter application.
version: 1.0.0+1
publish_to: 'none'

environment:
  sdk: ^3.5.0
  flutter: '>=3.24.0'

dependencies:
  flutter:
    sdk: flutter

  # ──── 状态管理 ────
  flutter_riverpod: ^2.6.1
  riverpod_annotation: ^2.6.1

  # ──── 路由 ────
  go_router: ^14.8.1

  # ──── 网络 ────
  dio: ^5.7.0
  retrofit: ^4.4.1
  json_annotation: ^4.9.0

  # ──── 不可变模型 ────
  freezed_annotation: ^2.4.4

  # ──── 后端服务 ────
  supabase_flutter: ^2.12.0

  # ──── 本地存储 ────
  drift: ^2.21.0
  sqlite3_flutter_libs: ^0.5.0
  shared_preferences: ^2.3.5
  flutter_secure_storage: ^9.2.4

  # ──── UI 增强 ────
  cached_network_image: ^3.4.1
  flutter_svg: ^2.0.16
  shimmer: ^3.0.0
  flutter_screenutil: ^5.9.3

  # ──── 国际化 ────
  flutter_localizations:
    sdk: flutter
  intl: ^0.19.0

  # ──── 设备功能 ────
  connectivity_plus: ^6.1.1
  image_picker: ^1.1.2

  # ──── 日志 ────
  logger: ^2.5.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

  # ──── 代码生成 ────
  build_runner: ^2.4.13
  riverpod_generator: ^2.6.3
  retrofit_generator: ^9.1.5
  json_serializable: ^6.8.0
  freezed: ^2.5.7
  drift_dev: ^2.21.0

  # ──── 测试 ────
  mocktail: ^1.0.4
  bloc_test: ^9.1.7  # 如果使用 Bloc

  # ──── 图标 ────
  flutter_launcher_icons: ^0.14.1

flutter:
  uses-material-design: true

  generate: true  # 启用国际化代码生成

  assets:
    - assets/images/
    - assets/fonts/
    - assets/animations/
```

---

## 8. 渐进式引入策略

不要一口气加完所有依赖。按本教程的学习节奏逐步引入：

| 阶段 | 引入依赖 | 对应 Part |
|------|---------|----------|
| 起步 | `flutter` + `flutter_lints` | Part-01 |
| 界面 | 无需新增（用内置 Material 组件） | Part-02 |
| 路由 | `go_router` | Part-03 |
| 网络（仅 dio） | `dio` | Part-04 初期 |
| 网络（完整） | `retrofit` + `json_annotation` + `freezed` + `build_runner` | Part-04 后期 |
| 状态管理 | `flutter_riverpod` + `riverpod_annotation` | Part-05 |
| 后端 | `supabase_flutter` | Part-04 后期 |
| 本地存储（KV） | `shared_preferences` | Part-08 初期 |
| 本地存储（SQL） | `drift` + `sqlite3_flutter_libs` | Part-08 后期 |
| 安全存储 | `flutter_secure_storage` | Part-07 |
| UI 增强 | `cached_network_image` + `shimmer` | Part-09 |
| 测试 | `mocktail` | Part-11 |

---

## 9. Flutter SDK 版本策略

### 9.1 Channel 选择

| Channel | 更新频率 | 稳定性 | 适用 |
|---------|---------|--------|------|
| Stable | ~3 个月 | ⭐⭐⭐⭐⭐ | **主力开发** |
| Beta | ~1 个月 | ⭐⭐⭐⭐ | 提前尝鲜新特性 |
| Master | 每日 | ⭐⭐ | 阅读源码/贡献 Flutter 自身 |

### 9.2 升级操作流程

```bash
# 1. 确认当前版本
flutter --version

# 2. 阅读 Release Notes 中的 breaking changes
# https://docs.flutter.dev/release/release-notes

# 3. 执行升级
flutter channel stable
flutter upgrade

# 4. 清理并重新获取依赖
flutter clean
flutter pub get

# 5. 运行代码生成
dart run build_runner build --delete-conflicting-outputs

# 6. 验证
flutter analyze
flutter test

# 7. 在真机上跑一遍
flutter run --release
```

### 9.3 版本锁定策略

```yaml
# 团队项目建议锁定具体版本号，避免 CI 环境差异
environment:
  sdk: '3.5.4'        # 锁定具体版本
  flutter: '3.24.3'   # 锁定具体版本
```

---

## 10. 依赖管理最佳实践

### 10.1 定期审计

```bash
# 检查可升级的包
dart pub outdated

# 升级所有兼容版本（不会跨大版本）
dart pub upgrade

# 查看依赖树
dart pub deps
```

### 10.2 安全审计

```bash
# 使用 dart pub 的审计功能
dart pub downgrade  # 降级到最低兼容版本（检查版本约束是否合理）

# 使用 OWASP Dependency Check 或类似工具
```

### 10.3 什么时候升级大版本？

- **安全漏洞修复**：立即升级
- **性能提升**：评估收益后升级
- **新特性**：需要时升级
- **仅版本号更新**：不做无意义升级
- **Breaking changes**：评估迁移成本，在功能间歇期升级

---

## 本章练习

**练习 1：为你的 Flutter 项目选择并记录技术栈**
- 参考本章推荐的技术栈表格，为 Library App（或你的个人项目）选型并记录到 `TECH_STACK.md`
- 覆盖以下 7 个维度：路由、网络、状态管理、后端/数据存储、本地存储、UI 增强、测试
- 对每个选择写明理由（为什么选这个而不是其他替代方案）

**练习 2：技术栈版本对齐检查**
- 检查 Library App 的 `pubspec.yaml` 中所有依赖
- 使用 `dart pub outdated` 查看是否有可升级的包
- 选择一个升级，运行 `flutter analyze && flutter test` 验证

**练习 3：技术栈迁移实践**
- 从 Library App 中任选一个模块，将其状态管理从当前方案迁移到另一种方案（如 Provider → Riverpod）
- 写一份简短的迁移报告，包括：代码量变化、遇到的问题、新方案的优势

**练习 4：自建依赖决策矩阵**
- 选两个本章未提及的 Flutter 包（如日志库、图表库）
- 从以下维度比较：stars、更新频率、文档质量、API 易用性、与现有技术栈的兼容性
- 做出选择并记录决策理由

---

> 📖 **延伸阅读**: [pub.dev — Dart/Flutter 包仓库](https://pub.dev) | [Flutter 官方推荐包](https://flutter.dev/packages-and-plugins)
>
> **下一步**: [Chapter 66 — 项目模板搭建](./Chapter-66-项目模板搭建.md)
