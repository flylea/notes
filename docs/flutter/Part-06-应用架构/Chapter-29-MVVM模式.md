> **Part**: Part VI — 应用架构
> **上一章**: [Chapter 28 — 应用架构设计理念](./Chapter-28-应用架构设计理念.md)
> **下一章**: [Chapter 30 — Repository 模式](./Chapter-30-Repository模式.md)
> **官方文档**: [flutter.cn/app-architecture/case-study](https://docs.flutter.cn/app-architecture/case-study)

---

# 第 29 章：MVVM 模式在 Flutter 中的完整实现

## 0. 本章目标

掌握 ViewModel 的职责边界（持有状态/暴露数据/处理业务逻辑/不持有 BuildContext）、Riverpod AsyncNotifier 作为 ViewModel 的最佳实践、View 层纯渲染+事件转发、页面级 vs 全局 ViewModel 的粒度把握。

> 🎯 **Library App 产出**：为首页/详情页/搜索页/借阅页/个人页各创建独立 ViewModel，将业务逻辑从 Widget 迁移到 ViewModel。

---

## 1. ViewModel 的职责边界

```dart
// ✅ ViewModel 应该做的事
// ✅ ViewModel 不该做的事
// ✅ 持有 State         ❌ 持有 BuildContext
// ✅ 暴露数据给 View      ❌ 直接操作 UI（showDialog/Navigator）
// ✅ 调用 Repository     ❌ 直接调 Supabase/Dio
// ✅ 处理用户事件         ❌ 定义 UI 布局/样式
// ✅ 格式化和计算         ❌ 持有 TextEditingController（那是 View 的事）
```

## 2. AsyncNotifier 作为 ViewModel

```dart
// lib/features/home/view_models/home_view_model.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'home_view_model.g.dart';

@riverpod
class HomeViewModel extends _$HomeViewModel {
  @override
  Future<HomeUiState> build() async {
    final repo = ref.watch(bookRepositoryProvider);
    final books = await repo.getBooks();
    return HomeUiState(books: books);
  }

  // ──── 用户事件 ────
  Future<void> search(String query) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(bookRepositoryProvider);
      final books = await repo.searchBooks(query);
      return HomeUiState(books: books, searchQuery: query);
    });
  }

  Future<void> toggleViewMode() async {
    state = AsyncValue.data(state.value!.copyWith(isGridView: !state.value!.isGridView));
  }

  Future<void> borrowBook(Book book) async {
    await ref.read(borrowRepositoryProvider).borrow(book.id, currentUserId);
    ref.invalidateSelf();
  }
}

// UI State（不可变）
@freezed
class HomeUiState with _$HomeUiState {
  const factory HomeUiState({
    @Default([]) List<Book> books,
    @Default('') String searchQuery,
    @Default(true) bool isGridView,
    @Default(SortBy.title) SortBy sortBy,
  }) = _HomeUiState;
}

// View — 纯渲染
class HomePage extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeViewModelProvider);
    return state.when(
      loading: () => const ShimmerBookGrid(),
      error: (e, _) => ErrorRetryWidget(message: e.toString(), onRetry: () => ref.invalidate(homeViewModelProvider)),
      data: (ui) => BookGridView(
        books: ui.books,
        isGridView: ui.isGridView,
        onToggleView: () => ref.read(homeViewModelProvider.notifier).toggleViewMode(),
        onSearch: (q) => ref.read(homeViewModelProvider.notifier).search(q),
      ),
    );
  }
}
```

---

## 3. 页面级 ViewModel vs 全局 ViewModel

| 维度 | 页面级 ViewModel | 全局 ViewModel |
|------|-----------------|---------------|
| 生命周期 | autoDispose——离开页面自动销毁 | 整个 App 生命周期 |
| 适用 | 首页数据、搜索页、详情页 | 用户登录状态、主题设置、通知计数 |
| Provider 声明 | `@riverpod` + `autoDispose` | `@riverpod`（不加 autoDispose） |

---

## 4. 完整的 ViewModel 体系

```dart
// 图书详情 ViewModel
@riverpod
class BookDetailViewModel extends _$BookDetailViewModel {
  @override
  Future<BookDetailState> build(String bookId) async {
    final book = await ref.read(bookRepositoryProvider).getBookById(bookId);
    final reviews = await ref.read(reviewRepositoryProvider).getReviews(bookId);
    return BookDetailState(book: book, reviews: reviews);
  }
  Future<void> borrow() async {
    await ref.read(borrowRepositoryProvider).borrow(state.value!.book.id, currentUserId);
    ref.invalidateSelf();
  }
}

// 搜索 ViewModel
@riverpod
class SearchViewModel extends _$SearchViewModel {
  Timer? _debounce;
  @override
  Future<SearchState> build() async => const SearchState();

  Future<void> onQueryChanged(String query) async {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      state = const AsyncValue.loading();
      state = await AsyncValue.guard(() async {
        final results = await ref.read(bookRepositoryProvider).searchBooks(query);
        return SearchState(query: query, results: results);
      });
    });
  }
}
```

---

## 5. 迁移检查清单

从当前代码（Chapter 22）迁移到 ViewModel 模式时，逐一检查：

- [ ] Widget 中是否还有直接的 Supabase/Dio 调用？→ 移到 ViewModel
- [ ] Widget 中是否有过滤/排序/计算的业务逻辑？→ 移到 ViewModel
- [ ] ViewModel 是否持有 BuildContext？→ 移除，用 ref 替代
- [ ] ViewModel 是否直接操作 Navigator？→ 用 GoRouter + ref
- [ ] 多个 Widget 是否共享同一份数据？→ 提取为全局 ViewModel

---

## 6. 本章小结

ViewModel = AsyncNotifier = 持有状态 + 暴露数据 + 处理事件。View = ConsumerWidget = 纯渲染。分离后 Widget 从 300 行缩减到 ~50 行，ViewModel 可独立单元测试。

---

## 7. 本章练习

1. 提取 `BookDetailPage` 的业务逻辑到 ViewModel：创建 `BookDetailViewModel`（AsyncNotifier），将 Widget 中的 `fetchBookDetail()` / `toggleFavorite()` / `addToBorrowList()` 方法全部移入 ViewModel。Widget 只保留 `ConsumerWidget` 的 `build` 方法，通过 `ref.watch` 读取状态、通过 ViewModel 方法处理事件。验证标准：Widget 文件从 ~200 行缩减到 ~60 行以内。

2. 将首页分类筛选逻辑移入 ViewModel：在 `HomeViewModel` 中添加 `selectedCategory` 状态和 `filteredBooks` computed 属性，移除 Widget 中的 `where((b) => b.category == selectedCategory)` 逻辑。验证标准：切换分类后 Widget 自动重建，无需手动调用 `setState`。

3. 创建全局 `AuthViewModel`：定义 `AuthViewModel`（AsyncNotifier），管理 `isLoggedIn` / `currentUser` / `authError` 状态，提供 `login()` / `logout()` / `register()` 方法。在 `BookListPage` 和 `ProfilePage` 中分别 `ref.watch(authViewModelProvider)` 验证登录状态是否全局共享。验证标准：在 ProfilePage 退出登录后，BookListPage 自动感知到登录状态变化。

> **下一步**: [Chapter 30 — Repository 模式](./Chapter-30-Repository模式.md)
> **原始文档**: [flutter.cn/app-architecture/case-study](https://docs.flutter.cn/app-architecture/case-study)
