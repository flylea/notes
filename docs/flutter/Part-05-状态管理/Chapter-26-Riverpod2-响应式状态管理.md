> **Part**: Part V — 状态管理
> **上一章**: [Chapter 25 — 状态管理工程化](./Chapter-25-状态管理工程化.md)
> **下一章**: [Chapter 27 — Bloc 对比学习](./Chapter-27-Bloc对比学习.md)
> **官方文档**: [pub.dev/packages/riverpod](https://pub.dev/packages/riverpod) | [riverpod.dev](https://riverpod.dev)

---

# 第 26 章：Riverpod 2.x — 编译时安全的响应式状态管理

## 0. 本章目标与前置依赖

**前置依赖**：已掌握 Provider + ChangeNotifier 的使用（Chapter 14），理解异步状态管理（Chapter 15）。

**本章目标**：
- 理解 Riverpod 的核心设计理念（编译时安全/无 BuildContext 依赖/Provider 全局声明）
- 掌握 Riverpod 八种 Provider 类型及选择策略
- 掌握 `ref.watch` / `ref.listen` / `ref.read` / `ref.invalidate`
- 掌握 Riverpod 代码生成（`@riverpod` 注解）减少样板代码
- 掌握 Riverpod + GoRouter 集成
- 将 App 从 Provider 迁移到 Riverpod 2.x

> 🎯 **本章会在图书馆 App 中做什么**：用 Riverpod 2.x + codegen 重写所有 Provider（BookList/ Borrowing/Search/Auth），添加 ProviderObserver 日志，接入 Riverpod DevTools。

---

## 1. Riverpod 的核心优势

| 特性 | Provider | Riverpod |
|------|----------|----------|
| BuildContext 依赖 | 必须 | 不需要 |
| 编译时安全 | 运行时 | 编译时 |
| Provider 声明位置 | Widget 树中 | 全局 |
| 多个同名 Provider | 不支持 | 支持 |
| 测试 | 需要 Widget 树 | 独立测试 |
| 自动释放 | 手动 | autoDispose |
| 异步原生支持 | 手动管理 | FutureProvider/StreamProvider |

---

## 2. Provider 八种类型

| Provider 类型 | 用途 | 返回值 | 示例场景 |
|--------------|------|--------|---------|
| `Provider` | 只读值/服务 | 对象实例 | Dio 客户端、Repository 实例 |
| `StateProvider` | 简单可变状态 | 值 | Tab 索引、开关状态 |
| `StateNotifierProvider` | 复杂可变状态 | StateNotifier | 表单状态、列表管理 |
| `FutureProvider` | 异步一次性数据 | Future | HTTP GET 请求 |
| `StreamProvider` | 异步流数据 | Stream | WebSocket、Realtime 订阅 |
| `NotifierProvider` | 复杂状态（codegen） | Notifier | 替代 StateNotifierProvider |
| `AsyncNotifierProvider` | 异步复杂状态（codegen） | AsyncNotifier | API 数据 + 状态管理 |
| `ChangeNotifierProvider` | 迁移用 | ChangeNotifier | 从 Provider 过渡用 |

---

## 3. 基础组件安装与配置

```yaml
# pubspec.yaml
dependencies:
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0

dev_dependencies:
  riverpod_generator: ^2.4.0
  build_runner: ^2.4.0
```

```dart
// lib/main.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    // ProviderScope — Riverpod 的根节点
    const ProviderScope(child: LibraryApp()),
  );
}

// 任何使用 Riverpod 的 Widget 必须继承 ConsumerWidget / ConsumerStatefulWidget
// 替代原来的 StatelessWidget / StatefulWidget
```

---

## 4. ref.watch / ref.listen / ref.read

```dart
// ref 是 Riverpod 的核心——所有 Provider 交互通过它

// ① ref.watch — 监听变化，自动重建（在 build 中使用）
class BookListWidget extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final books = ref.watch(bookListProvider);  // books 变化 → 重建
    return ListView(...);
  }
}

// ② ref.listen — 副作用回调（监听变化但不重建）
class BookListWidget extends ConsumerStatefulWidget {
  @override
  ConsumerState<BookListWidget> createState() => _State();
}
class _State extends ConsumerState<BookListWidget> {
  @override
  void initState() {
    super.initState();
    ref.listen(bookListProvider, (previous, next) {
      // 数据变化时触发——用于显示 SnackBar、导航等副作用
      if (next.isSuccess && previous?.isLoading == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('数据加载完成')),
        );
      }
    });
  }
}

// ③ ref.read — 一次性读取（在事件回调中使用）
void _handleRefresh() {
  ref.read(bookListProvider.notifier).refresh();
}
```

| 方法 | 位置 | 是否监听 | 等价 Provider |
|------|------|---------|-------------|
| `ref.watch(p)` | `build()` | ✅ | `context.watch<T>()` |
| `ref.listen(p, callback)` | `initState`/`build` | ✅ (不重建) | `addListener` |
| `ref.read(p)` | 事件回调 | ❌ | `context.read<T>()` |
| `ref.invalidate(p)` | 任意 | — | 强制下次访问时重新计算 |

---

## 5. 常用 Provider 类型实战

### 5.1 StateProvider — 简单状态

```dart
// 全局声明（不在类内部）
final tabIndexProvider = StateProvider<int>((ref) => 0);
final isGridViewProvider = StateProvider<bool>((ref) => true);

// 使用
class HomeScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabIndex = ref.watch(tabIndexProvider);
    final isGrid = ref.watch(isGridViewProvider);

    return Scaffold(
      bottomNavigationBar: NavigationBar(
        selectedIndex: tabIndex,
        onDestinationSelected: (i) => ref.read(tabIndexProvider.notifier).state = i,
        ...
      ),
      body: isGrid ? grid : list,
    );
  }
}
```

### 5.2 FutureProvider — 异步数据

```dart
// 从 API 获取图书列表
final bookListFutureProvider = FutureProvider<List<Book>>((ref) async {
  // 自动处理 loading/error/data 三态
  final response = await dio.get('/books');
  return (response.data as List).map((json) => Book.fromJson(json)).toList();
});

// 使用（自带 AsyncValue）
class BookList extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(bookListFutureProvider);

    return booksAsync.when(
      loading: () => const ShimmerBookGrid(),
      error: (error, stack) => ErrorRetryWidget(message: error.toString(), onRetry: () => ref.invalidate(bookListFutureProvider)),
      data: (books) => GridView.builder(itemCount: books.length, ...),
    );
  }
}
```

### 5.3 AsyncNotifierProvider — 异步复杂状态（codegen）⭐️

```dart
// 使用 codegen —— 创建 book_list_provider.dart

// ① 定义 AsyncNotifier——业务逻辑在这里
// lib/providers/book_list_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'book_list_provider.g.dart';  // 生成文件

@riverpod
class BookList extends _$BookList {
  @override
  FutureOr<List<Book>> build() {
    // build() — 初始化 Provider 时执行（加载数据）
    return _fetchBooks();
  }

  Future<List<Book>> _fetchBooks() async {
    // 实际项目中从 Supabase/API 加载
    await Future.delayed(const Duration(seconds: 1));
    return sampleBooks;
  }

  // ──── 动作方法 ────
  Future<void> addBook(Book book) async {
    // 乐观更新：立即修改 state
    state = AsyncValue.data([...state.value ?? [], book]);
    // 提交到服务器
    // await supabase.from('books').insert(book.toJson());
  }

  Future<void> deleteBook(String id) async {
    final previousState = state;
    state = AsyncValue.data(
      state.value?.where((b) => b.id != id).toList() ?? [],
    );
    // 失败回滚
    // try { await supabase.from('books').delete().eq('id', id); }
    // catch (e) { state = previousState; }
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = AsyncValue.data(await _fetchBooks());
  }
}
```

**codegen 生成后的 `book_list_provider.g.dart` 包含**：
- `BookListProvider<...>` Provider 类型
- `bookListProvider` 顶层常量
- `ref.watch(bookListProvider)` / `ref.read(bookListProvider.notifier)` 的类型安全绑定

> 运行 `dart run build_runner watch` 在每次修改后自动重新生成。

---

## 6. Provider 依赖链

```dart
// 一个 Provider 可以依赖另一个 Provider
@riverpod
Future<List<Book>> filteredBooks(FilteredBooksRef ref) async {
  // 依赖 bookListProvider
  final books = await ref.watch(bookListProvider.future);
  // 依赖 searchQueryProvider
  final query = ref.watch(searchQueryProvider);

  if (query.isEmpty) return books;
  return books.where((b) =>
    b.title.toLowerCase().contains(query.toLowerCase()),
  ).toList();
}
// 当 searchQueryProvider 变化 → filteredBooksProvider 自动重新计算
```

---

## 7. ProviderObserver — 全局日志与调试

```dart
// lib/core/di/provider_observer.dart
class AppProviderObserver extends ProviderObserver {
  @override
  void didUpdateProvider(
    ProviderBase<Object?> provider,
    Object? previousValue,
    Object? newValue,
    ProviderContainer container,
  ) {
    debugPrint('[Provider] ${provider.name ?? provider.runtimeType}: $previousValue → $newValue');
  }

  @override
  void didAddProvider(ProviderBase<Object?> provider, Object? value, ProviderContainer container) {
    debugPrint('[Provider] Created: ${provider.name ?? provider.runtimeType}');
  }

  @override
  void didDisposeProvider(ProviderBase<Object?> provider, ProviderContainer container) {
    debugPrint('[Provider] Disposed: ${provider.name ?? provider.runtimeType}');
  }
}

// 集成到 ProviderScope
// ProviderScope(
//   observers: [AppProviderObserver()],
//   child: LibraryApp(),
// );
```

---

## 8. Riverpod + GoRouter 集成

```dart
// lib/core/router/app_router.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

@riverpod
GoRouter appRouter(AppRouterRef ref) {
  return GoRouter(
    // 当 authState 变化时，GoRouter 自动重新评估 redirect
    refreshListenable: GoRouterRefreshStream(
      ref.watch(authStateProvider.notifier).stream,
    ),
    redirect: (context, state) {
      final isLoggedIn = ref.read(authStateProvider).isLoggedIn;
      if (!isLoggedIn && state.matchedLocation != '/login') return '/login';
      return null;
    },
    routes: [...],
  );
}
```

---

## 9. Provider → Riverpod 迁移总结

| Provider 模式 | Riverpod 等价 |
|--------------|--------------|
| `ChangeNotifierProvider(create: ...)` | `@riverpod class X extends _$X` (AsyncNotifier) |
| `MultiProvider` | 自动依赖注入（ref.watch 链） |
| `Consumer<X>(builder: ...)` | `ref.watch(xProvider)` |
| `Selector<X, T>(selector: ...)` | `ref.watch(select(xProvider, ...))` |
| `context.read<X>()` | `ref.read(xProvider.notifier)` |
| `ChangeNotifierProxyProvider` | `ref.watch(aProvider) + ref.watch(bProvider)` |
| `Provider.of<T>(context)` | `ref.read(xProvider)` |
| `notifyListeners()` | `state = newValue` |

---

## 10. 本章小结

| 你学到了什么 | 核心要点 |
|-------------|---------|
| Riverpod 编译时安全 | 无 BuildContext 依赖，Provider 全局声明 |
| 八种 Provider 类型 | StateProvider → FutureProvider → AsyncNotifierProvider |
| ref.watch/listen/read | watch 渲染/listen 副作用/read 回调 |
| AsyncNotifier + codegen | `@riverpod` 注解 + build_runner 自动生成 |
| Provider 依赖链 | ref.watch 链自动处理依赖更新 |
| ProviderObserver | 全局日志/调试/DevTools |
| Riverpod + GoRouter | GoRouterRefreshStream 状态驱动路由 |

---

## 11. 本章练习

1. 将 Library App 中的 `BookProvider`（ChangeNotifier）迁移为 Riverpod `@riverpod` AsyncNotifier：创建 `BookListViewModel`，使用 `@riverpod` 注解标记，运行 `build_runner` 生成 `.g.dart` 文件，在 Widget 中将 `context.watch<BookProvider>()` 替换为 `ref.watch(bookListViewModelProvider)`。验证标准：应用功能与迁移前完全一致。

2. 添加 `ProviderObserver` 全局日志：创建 `AppProviderObserver` 继承自 `ProviderObserver`，在 `main.dart` 的 `ProviderScope` 中注册，监听所有 Provider 的 `didAddProvider`/`didDisposeProvider`/`didUpdateProvider` 事件并打印到控制台。验证标准：启动 App 后控制台能看到 Provider 加载时序日志。

3. 使用 `ref.watch` 依赖链实现搜索联动：创建 `SearchViewModel` 依赖 `BookRepository` Provider，当搜索关键词变化时自动重新请求数据；同时在 `SearchPage` 中用 `ref.listen(searchViewModelProvider, ...)` 监听错误状态并弹出 SnackBar。验证标准：输入搜索词后列表自动刷新，网络错误时提示用户。

> **下一步**: [Chapter 27 — Bloc 事件驱动状态管理（对比学习）](./Chapter-27-Bloc对比学习.md)
> **原始文档**: [riverpod.dev](https://riverpod.dev) | [pub.dev/packages/riverpod](https://pub.dev/packages/riverpod)
