> **Part**: Part V — 状态管理
> **上一章**: [Chapter 24 — Provider + ChangeNotifier](./Chapter-24-Provider与ChangeNotifier.md)
> **下一章**: [Chapter 26 — Riverpod 2.x](./Chapter-26-Riverpod2-响应式状态管理.md)
> **官方文档**: [flutter.cn/data-and-backend/state-mgmt/options](https://docs.flutter.cn/data-and-backend/state-mgmt/options)

---

# 第 25 章：状态管理工程化

## 0. 本章目标与前置依赖

**前置依赖**：能使用 Provider 管理应用状态（Chapter 14），理解 ScrollController 和 GridView.builder（Chapter 8）。

**本章目标**：
- 设计统一的 `AsyncState<T>` 四态封装（Loading / Empty / Error / Success）
- 实现无限滚动分页（ScrollController + hasMore + page）
- 实现 Shimmer 骨架屏加载效果
- 理解乐观更新（Optimistic Update）的策略和回滚机制
- 掌握下拉刷新（RefreshIndicator）的数据重载

> 🎯 **本章会在图书馆 App 中做什么**：用 `AsyncState<T>` 封装图书列表的加载/空/错误/成功四态、实现图书列表无限分页（每次20条+触底加载）、Shimmer 骨架屏替换空白 Loading、乐观删除（左滑删除+失败恢复）。

---

## 1. AsyncState\<T\> — 统一的异步状态封装

```dart
// lib/core/state/async_state.dart
enum AsyncStatus { loading, empty, error, success }

class AsyncState<T> {
  final AsyncStatus status;
  final T? data;
  final String? errorMessage;

  const AsyncState._({
    required this.status,
    this.data,
    this.errorMessage,
  });

  // 工厂构造——四种状态
  factory AsyncState.loading() => const AsyncState._(status: AsyncStatus.loading);
  factory AsyncState.empty() => const AsyncState._(status: AsyncStatus.empty);
  factory AsyncState.error(String message) => AsyncState._(status: AsyncStatus.error, errorMessage: message);
  factory AsyncState.success(T data) => AsyncState._(status: AsyncStatus.success, data: data);

  // 便捷检查
  bool get isLoading => status == AsyncStatus.loading;
  bool get isEmpty => status == AsyncStatus.empty;
  bool get isError => status == AsyncStatus.error;
  bool get isSuccess => status == AsyncStatus.success;

  // fold — 统一处理四种状态
  R fold<R>({
    required R Function() onLoading,
    required R Function() onEmpty,
    required R Function(String message) onError,
    required R Function(T data) onSuccess,
  }) {
    switch (status) {
      case AsyncStatus.loading: return onLoading();
      case AsyncStatus.empty: return onEmpty();
      case AsyncStatus.error: return onError(errorMessage!);
      case AsyncStatus.success: return onSuccess(data as T);
    }
  }
}
```

### AsyncStateWidget — 通用状态渲染器

```dart
// lib/core/state/async_state_widget.dart
import 'package:flutter/material.dart';
import 'async_state.dart';

class AsyncStateWidget<T> extends StatelessWidget {
  final AsyncState<T> state;
  final Widget Function(T data) onSuccess;
  final Widget Function()? onLoading;
  final Widget Function()? onEmpty;
  final Widget Function(String message)? onError;

  const AsyncStateWidget({
    super.key,
    required this.state,
    required this.onSuccess,
    this.onLoading,
    this.onEmpty,
    this.onError,
  });

  @override
  Widget build(BuildContext context) {
    return state.fold(
      onLoading: onLoading ?? () => const Center(child: CircularProgressIndicator()),
      onEmpty: onEmpty ?? () => const Center(child: Text('暂无数据', style: TextStyle(color: Colors.grey))),
      onError: (msg) => onError?.call(msg) ?? Center(child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, size: 48, color: Colors.red),
          const SizedBox(height: 8),
          Text(msg, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: () {}, child: const Text('重试')),
        ],
      )),
      onSuccess: onSuccess,
    );
  }
}
```

---

## 2. 无限滚动分页

```dart
// lib/providers/paginated_book_provider.dart
class PaginatedBookProvider extends ChangeNotifier {
  final List<Book> _books = [];
  AsyncState<List<Book>> _state = AsyncState.loading();
  int _currentPage = 1;
  bool _hasMore = true;
  bool _isLoadingMore = false;

  static const _pageSize = 20;

  List<Book> get books => List.unmodifiable(_books);
  AsyncState<List<Book>> get state => _state;
  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;

  // 初始加载
  Future<void> loadBooks() async {
    _state = AsyncState.loading();
    notifyListeners();

    try {
      await Future.delayed(const Duration(seconds: 1));
      final page = _getMockPage(1);
      _books.clear();
      _books.addAll(page);
      _currentPage = 1;
      _hasMore = page.length >= _pageSize;
      _state = _books.isEmpty
          ? AsyncState.empty()
          : AsyncState.success(List.from(_books));
    } catch (e) {
      _state = AsyncState.error('加载失败，请检查网络连接');
    }
    notifyListeners();
  }

  // 加载更多
  Future<void> loadMore() async {
    if (_isLoadingMore || !_hasMore) return;
    _isLoadingMore = true;
    notifyListeners();

    try {
      await Future.delayed(const Duration(milliseconds: 500));
      final nextPage = _getMockPage(_currentPage + 1);
      _books.addAll(nextPage);
      _currentPage++;
      _hasMore = nextPage.length >= _pageSize;
      _state = AsyncState.success(List.from(_books));
    } catch (e) {
      // 加载更多失败不影响已有数据，只提示
    }
    _isLoadingMore = false;
    notifyListeners();
  }

  // 下拉刷新
  Future<void> refresh() async {
    await loadBooks();
  }

  // 模拟分页数据
  List<Book> _getMockPage(int page) {
    if (page > 3) return []; // 模拟只有 3 页
    return sampleBooks;       // 实际项目从 API 获取
  }
}
```

### 首页集成分页和四态

```dart
Consumer<PaginatedBookProvider>(
  builder: (context, provider, _) {
    final state = provider.state;

    // ScrollController 监听触底
    final scrollController = ScrollController();
    scrollController.addListener(() {
      if (scrollController.position.pixels >=
              scrollController.position.maxScrollExtent - 200) {
        provider.loadMore();
      }
    });

    return state.fold(
      onLoading: () => const ShimmerBookGrid(),
      onEmpty: () => const Center(child: Text('图书馆暂无藏书', style: TextStyle(color: Colors.grey))),
      onError: (msg) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(msg, style: const TextStyle(color: Colors.grey)),
            const SizedBox(height: 16),
            FilledButton.icon(
              icon: const Icon(Icons.refresh),
              label: const Text('重新加载'),
              onPressed: () => provider.loadBooks(),
            ),
          ],
        ),
      ),
      onSuccess: (books) => RefreshIndicator(
        onRefresh: () => provider.refresh(),
        child: GridView.builder(
          controller: scrollController,
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2, childAspectRatio: 0.65, crossAxisSpacing: 12, mainAxisSpacing: 12,
          ),
          itemCount: books.length + (provider.hasMore ? 1 : 0),
          itemBuilder: (_, i) {
            if (i == books.length) {
              return const Center(child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ));
            }
            return BookCard(book: books[i]);
          },
        ),
      ),
    );
  },
);
```

---

## 3. Shimmer 骨架屏

```dart
// lib/widgets/shimmer_loading.dart
class ShimmerBookGrid extends StatelessWidget {
  const ShimmerBookGrid({super.key});

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2, childAspectRatio: 0.65, crossAxisSpacing: 12, mainAxisSpacing: 12,
      ),
      itemCount: 6,
      itemBuilder: (_, __) => const ShimmerBookCard(),
    );
  }
}

class ShimmerBookCard extends StatefulWidget {
  const ShimmerBookCard({super.key});
  @override
  State<ShimmerBookCard> createState() => _ShimmerBookCardState();
}

class _ShimmerBookCardState extends State<ShimmerBookCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, child) {
        final shimmerColor = Color.lerp(
          Colors.grey[200]!,
          Colors.grey[100]!,
          _controller.value,
        )!;

        return Card(
          clipBehavior: Clip.antiAlias,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(height: 140, color: shimmerColor),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(height: 14, width: double.infinity, color: shimmerColor),
                    const SizedBox(height: 8),
                    Container(height: 10, width: 80, color: shimmerColor),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(height: 12, width: 40, color: shimmerColor),
                        const Spacer(),
                        Container(height: 18, width: 36, decoration: BoxDecoration(color: shimmerColor, borderRadius: BorderRadius.circular(4))),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
```

---

## 4. 乐观更新（Optimistic Update）

```dart
// 乐观更新：先假设操作成功更新 UI，失败后回滚
Future<void> optimisticDeleteBook(String bookId) async {
  // ① 备份当前数据（用于回滚）
  final backup = List<Book>.from(_books);
  final deletedBook = _books.firstWhere((b) => b.id == bookId);

  // ② 立即从列表中移除（乐观更新 UI）
  _books.removeWhere((b) => b.id == bookId);
  notifyListeners();

  // ③ 显示 SnackBar 带撤销按钮
  // ScaffoldMessenger.of(context).showSnackBar(SnackBar(
  //   content: Text('已删除 "${deletedBook.title}"'),
  //   action: SnackBarAction(
  //     label: '撤销',
  //     onPressed: () {
  //       _books = backup;        // 恢复
  //       notifyListeners();
  //     },
  //   ),
  // ));

  try {
    // ④ 尝试在服务器端删除
    await api.deleteBook(bookId);
    // 成功——数据已同步
  } catch (e) {
    // ⑤ 失败——回滚到备份数据
    _books = backup;
    notifyListeners();
    rethrow; // 通知调用方操作失败
  }
}
```

---

## 5. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 仅用 try-catch 管理异步状态，未封装统一状态枚举 | UI 需要到处判空、判加载，遗漏某种状态导致白屏 | 引入 `AsyncState<T>` 四态封装，用 `fold()` 统一处理 |
| 分页加载时不判断 `hasMore` 和 `isLoadingMore` 就触发加载 | 重复请求、数据覆盖、请求风暴 | 在 `loadMore()` 入口加双重守卫：`if (_isLoadingMore \|\| !_hasMore) return` |
| 乐观更新失败后未恢复原始数据 | 用户看到的数据与服务器不一致 | 先备份原始数据 → 乐观更新 UI → catch 中用备份回滚 |
| `ScrollController` 在 `build()` 中创建 | 每次重建都新实例，滚动位置丢失 | 在 `initState()` 中创建，或在 StatefulWidget 中存为 `final` |
| Shimmer 动画 Controller 忘记 dispose | 内存泄漏，Ticker 持续运行 | 在 State 的 `dispose()` 中调用 `_controller.dispose()` |

**最佳实践**：

- 用 `AsyncState.fold()` 统一处理四种状态，确保 Loading/Empty/Error/Success 都有对应 UI
- 分页时使用 Backup → Optimistic Update → Rollback on Failure 模式，保证数据一致性
- ScrollController 监听设置 200px 预加载阈值，提前触发加载而不等用户滑到底部
- Shimmer 动画用 `SingleTickerProviderStateMixin`，单一动画控制器即可满足骨架屏需求
- `RefreshIndicator` 包裹在 ScrollView 外层，配合 `provider.refresh()` 重置分页并重新加载
- 分页终止条件用服务端返回的 `hasMore` 标志，不要仅靠返回数组长度为 0 判断
- 错误状态提供「重试」按钮 +「刷新」按钮两种恢复方式，允许用户自主恢复

---

## 6. 本章小结

| 你学到了什么 | 对标前端 | 在图书馆 App 中的体现 |
|-------------|---------|---------------------|
| AsyncState\<T\> 四态封装 | React Query status | 图书列表加载/空/错误/成功态 |
| AsyncStateWidget 通用渲染 | Suspense + ErrorBoundary | 统一的状态 UI 渲染 |
| 无限分页 | useInfiniteQuery / Intersection Observer | 触底加载更多图书 |
| Shimmer 骨架屏 | react-content-loader | 加载中的骨架占位动画 |
| 乐观更新 | Optimistic Updates in React Query | 左滑删除 + 失败回滚 |
| RefreshIndicator | pull-to-refresh | 下拉刷新图书列表 |

---

## 7. 本章练习

1. 为图书馆 App 中的图书详情页添加 `AsyncState<Book>` 状态封装：在 `BookDetailViewModel` 中定义 `AsyncState<Book>` 类型的 state，实现 `asyncStateWidget` 统一渲染加载态（Shimmer）、空态（"未找到图书"）、错误态（重试按钮）、成功态（详情内容）四种状态。

2. 实现图书列表的无限分页：在 `BookListViewModel` 中添加 `page` 和 `hasMore` 字段，使用 `ScrollController` 监听滚动到底部的事件，每次触底自动调用 `loadNextPage()` 追加数据。验证标准：滚动到列表底部时自动显示 loading 指示器并加载下一页。

3. 实现图书左滑删除的乐观更新：在 `BookListPage` 中添加 `Dismissible` 组件，左滑删除时立即从列表移除目标图书，如果 Supabase delete API 返回错误则恢复该条图书并显示 SnackBar 提示"删除失败，已恢复"。验证标准：删除动作即时响应，失败时数据回滚无误。

> **下一步**: [Chapter 26 — Riverpod 2.x 编译时安全的响应式状态管理](./Chapter-26-Riverpod2-响应式状态管理.md)
> **原始文档**: [flutter.cn/data-and-backend/state-mgmt/options](https://docs.flutter.cn/data-and-backend/state-mgmt/options)
