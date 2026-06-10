> **Part**: Part IV — 状态管理
> **上一章**: [Chapter 13 — setState 局部状态管理](./Chapter-13-setState局部状态管理.md)
> **下一章**: [Chapter 15 — 状态管理工程化：三态封装、分页与骨架屏](./Chapter-15-状态管理工程化.md)
> **官方文档**: [flutter.cn/data-and-backend/state-mgmt/simple](https://docs.flutter.cn/data-and-backend/state-mgmt/simple) | [pub.dev/packages/provider](https://pub.dev/packages/provider)

---

# 第 14 章：Provider + ChangeNotifier — 跨组件状态共享

## 0. 本章目标与前置依赖

**前置依赖**：理解 setState 和局部状态（Chapter 13），理解 BuildContext 和 InheritedWidget 概念（Chapter 5）。

**本章目标**：
- 理解 InheritedWidget 的底层原理——Provider 的基础设施
- 掌握 ChangeNotifier + notifyListeners 响应式模型
- 掌握 Provider 全系 Widget（Provider / MultiProvider / Consumer / Selector）
- 理解 `context.read<T>()` vs `context.watch<T>()` 的区别与陷阱
- 掌握 ChangeNotifierProxyProvider 的依赖传递链
- 建立与 React Context + useReducer 的类比

> 🎯 **本章会在图书馆 App 中做什么**：创建 BookListProvider（图书列表增删改查+排序）、BorrowingProvider（借阅状态管理）、SearchProvider（共享搜索条件），用 Provider 让首页、详情页、搜索页共享同一份图书数据。

---

## 1. InheritedWidget — Provider 的底层基石

```dart
// InheritedWidget 是 Flutter 内置的"数据向下传播"机制
// 祖先 Widget 通过 InheritedWidget 向所有子孙暴露数据
// 子孙通过 BuildContext 查找最近的 InheritedWidget

// Provider 就是对 InheritedWidget 的封装——让它更好用
// 原始 InheritedWidget 需要手动写 boilerplate
// Provider 提供了 ChangeNotifier / Consumer / Selector 等便捷封装

// 核心机制：
// ① InheritedWidget 持有数据
// ② 子 Widget 调用 context.dependOnInheritedWidgetOfExactType<T>()
//    注册依赖关系
// ③ 当 InheritedWidget 更新时，所有依赖它的子 Widget 自动重建
```

> **TS 经验**：InheritedWidget ≈ React Context Provider（`<MyContext.Provider value={...}>`）。`context.watch<T>()` ≈ `useContext(MyContext)`。区别在于 Flutter 的依赖追踪更精细——只有实际调用了 `watch` 的 Widget 才会重建。

---

## 2. ChangeNotifier — 响应式数据容器

```dart
// lib/providers/book_list_provider.dart
import 'package:flutter/foundation.dart';
import '../models/book.dart';
import '../data/sample_books.dart';

// ① ChangeNotifier — 继承它，获得 notifyListeners() 能力
class BookListProvider extends ChangeNotifier {
  List<Book> _books = [];
  String _sortBy = 'title';
  bool _isGridView = true;

  // ──── Getters ────
  List<Book> get books => List.unmodifiable(_books);  // 防止外部修改
  List<Book> get sortedBooks {
    final list = List<Book>.from(_books);
    switch (_sortBy) {
      case 'title':  list.sort((a, b) => a.title.compareTo(b.title)); break;
      case 'author': list.sort((a, b) => a.author.compareTo(b.author)); break;
      case 'rating': list.sort((a, b) => b.rating.compareTo(a.rating)); break;
    }
    return list;
  }
  String get sortBy => _sortBy;
  bool get isGridView => _isGridView;
  int get bookCount => _books.length;
  int get availableCount => _books.where((b) => b.isAvailable).length;

  // ──── 初始化 ────
  void loadBooks() {
    _books = List.from(sampleBooks);
    notifyListeners();   // ← 通知所有监听者：数据变了，请重建
  }

  // ──── CRUD ────
  void addBook(Book book) {
    _books.add(book);
    notifyListeners();
  }

  void updateBook(Book updated) {
    final index = _books.indexWhere((b) => b.id == updated.id);
    if (index != -1) {
      _books[index] = updated;
      notifyListeners();
    }
  }

  void deleteBook(String id) {
    _books.removeWhere((b) => b.id == id);
    notifyListeners();
  }

  // ──── UI 状态 ────
  void setSortBy(String sortBy) {
    _sortBy = sortBy;
    notifyListeners();
  }

  void toggleGridView() {
    _isGridView = !_isGridView;
    notifyListeners();
  }
}
```

---

## 3. 注入 Provider — 让整个 App 可访问

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'providers/book_list_provider.dart';
import 'providers/borrowing_provider.dart';
import 'providers/search_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    // MultiProvider 注入多个 Provider
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => BookListProvider()..loadBooks()),
        ChangeNotifierProvider(create: (_) => BorrowingProvider()),
        ChangeNotifierProvider(create: (_) => SearchProvider()),
      ],
      child: const LibraryApp(),
    ),
  );
}
```

---

## 4. Consumer / Selector — 消费数据

### 4.1 Consumer — 监听整个 Provider 的变化

```dart
// 使用 Consumer 包裹需要响应数据变化的 UI
Consumer<BookListProvider>(
  builder: (context, provider, child) {
    final books = provider.sortedBooks;
    return GridView.builder(
      itemCount: books.length,
      itemBuilder: (_, i) => BookCard(book: books[i]),
    );
  },
);

// Provider.of<T>(context) — Consumer 的底层等价物
// final provider = context.watch<BookListProvider>();
```

### 4.2 Selector — 精准重建（性能优化关键）

```dart
// Consumer 的问题是：Provider 中任何字段变化，都会触发 builder 重建
// Selector 解决了这个问题——只监听你关心的字段

// ① 只监听 bookCount 的变化
Selector<BookListProvider, int>(
  selector: (_, provider) => provider.bookCount,
  builder: (_, bookCount, __) => Text('共 $bookCount 本'),
  // 只有当 bookCount 变化时，这个 Text 才重建
  // 其他字段（sortBy/isGridView）变化时，这里不重建
);

// ② 只监听 isGridView
Selector<BookListProvider, bool>(
  selector: (_, provider) => provider.isGridView,
  builder: (_, isGridView, __) => Icon(isGridView ? Icons.grid_view : Icons.list),
);
```

> **TS 经验**：`Consumer<BookListProvider>` ≈ `useContext(BookListContext)`——Provider 中任何值变化都会重建。`Selector<A, B>` ≈ Zustand 的 `useStore(state => state.specificField)` 选择器模式——只监听特定字段。

---

## 5. context.read vs context.watch

```dart
// ⚠️ 这是 Provider 最容易被误用的 API

// context.watch<T>() — 监听变化（在 build() 中使用）
// 当 T 的数据变化时，当前 Widget 自动重建
@override
Widget build(BuildContext context) {
  final count = context.watch<BookListProvider>().bookCount;
  // 每当 bookCount 变化 → 当前 Widget 的 build() 重新执行
  return Text('$count');
}

// context.read<T>() — 不监听变化（在事件回调中使用）
// 只读取当前值，不注册监听关系
void _handleDelete(String id) {
  context.read<BookListProvider>().deleteBook(id);
  // 调用方法，但不监听 BookListProvider 的变化
  // 在 onPressed/onTap 回调中使用 read
}

// Provider.of<T>(context, listen: false) — read 的原始形式
// context.read<T>() 等价于 Provider.of<T>(context, listen: false)
```

| API | 位置 | 是否监听 | 何时用 |
|-----|------|---------|--------|
| `context.watch<T>()` | `build()` 内 | 是 | 需要 UI 随数据更新 |
| `context.read<T>()` | 事件回调（onTap/onPressed） | 否 | 只调用方法，不需要重建 |
| `Provider.of<T>(context)` | 同 watch | 是 | watch 的旧版形式 |
| `Provider.of<T>(context, listen: false)` | 同 read | 否 | read 的旧版形式 |

---

## 6. ChangeNotifierProxyProvider — 依赖传递链

```dart
// 当 Provider B 依赖 Provider A 的数据时：
MultiProvider(
  providers: [
    ChangeNotifierProvider(create: (_) => AuthProvider()),
    // BorrowingProvider 依赖 AuthProvider 的 userId
    ChangeNotifierProxyProvider<AuthProvider, BorrowingProvider>(
      create: (_) => BorrowingProvider(),
      update: (_, auth, borrowing) => borrowing!..updateUserId(auth.userId),
      // 每当 AuthProvider 变化 → update 被调用 → BorrowingProvider 收到通知
    ),
  ],
);
```

---

## 7. 图书馆 App 实战：完整 Provider 集成

### BorrowingProvider

```dart
// lib/providers/borrowing_provider.dart
class BorrowingProvider extends ChangeNotifier {
  final List<BorrowRecord> _records = [];
  String? _userId;

  List<BorrowRecord> get records => List.unmodifiable(_records);
  List<BorrowRecord> get activeBorrows =>
      _records.where((r) => r.status == BorrowStatus.active).toList();
  int get activeCount => activeBorrows.length;

  void updateUserId(String? id) {
    _userId = id;
    if (id != null) _loadRecords();
  }

  void _loadRecords() {
    // TODO: 从 API 加载
    notifyListeners();
  }

  Future<void> borrowBook(Book book) async {
    if (_userId == null) throw StateError('Not logged in');
    if (activeCount >= 5) throw StateError('已达到最大借阅数（5本）');

    final record = BorrowRecord.create(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      bookId: book.id,
      userId: _userId!,
    );
    _records.add(record);
    notifyListeners();
  }

  Future<void> returnBook(String recordId) async {
    final index = _records.indexWhere((r) => r.id == recordId);
    if (index != -1) {
      _records[index] = _records[index].returnBook();
      notifyListeners();
    }
  }
}
```

### 首页集成 Provider

```dart
// 在 HomeScreen 中使用 Provider
class _HomeScreenState extends State<HomeScreen> {
  @override
  Widget build(BuildContext context) {
    // 用 Selector 分别订阅——避免不必要的重建
    final isGridView = context.watch<BookListProvider>().isGridView;
    final sortBy = context.watch<BookListProvider>().sortBy;
    final books = context.watch<BookListProvider>().sortedBooks;

    return Scaffold(
      appBar: AppBar(
        title: const Text('📚 图书馆'),
        actions: [
          // ① 只监听 isGridView
          Selector<BookListProvider, bool>(
            selector: (_, p) => p.isGridView,
            builder: (_, isGrid, __) => IconButton(
              icon: Icon(isGrid ? Icons.list : Icons.grid_view),
              onPressed: () => context.read<BookListProvider>().toggleGridView(),
            ),
          ),
          // ② 只监听 sortBy
          Selector<BookListProvider, String>(
            selector: (_, p) => p.sortBy,
            builder: (_, current, __) => PopupMenuButton<String>(
              onSelected: (v) => context.read<BookListProvider>().setSortBy(v),
              itemBuilder: (_) => [
                PopupMenuItem(value: 'title', child: Text('按书名 ${current == "title" ? "✓" : ""}')),
                PopupMenuItem(value: 'author', child: Text('按作者 ${current == "author" ? "✓" : ""}')),
                PopupMenuItem(value: 'rating', child: Text('按评分 ${current == "rating" ? "✓" : ""}')),
              ],
            ),
          ),
        ],
      ),
      body: books.isEmpty
          ? const Center(child: Text('暂无图书', style: TextStyle(color: Colors.grey)))
          : _buildBookGrid(books, isGridView),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final newBook = await context.push<Book>('/book-form');
          if (newBook != null && context.mounted) {
            context.read<BookListProvider>().addBook(newBook);
          }
        },
        label: const Text('添加图书'),
      ),
    );
  }
}
```

---

## 8. 常见错误与最佳实践

```dart
// ❌ 错误 1：在 build() 中用 read 读取用于渲染的数据
// @override Widget build(BuildContext context) {
//   final count = context.read<BookListProvider>().bookCount; // ❌
//   return Text('$count');  // 数据变化不会重建
// }
// ✅ 正确：渲染用 watch
final count = context.watch<BookListProvider>().bookCount;

// ❌ 错误 2：在事件回调中用 watch
// onPressed: () { context.watch<...>().doSomething(); } // ❌
// ✅ 正确：回调用 read
onPressed: () { context.read<...>().doSomething(); }

// ❌ 错误 3：忘记在 ChangeNotifier 中调用 notifyListeners
// ✅ 每次修改数据后必须调用 notifyListeners()

// ❌ 错误 4：在 Provider 外部访问 context.read
// ✅ Provider 必须在 Widget 树的上层（通过 ChangeNotifierProvider 注入）
```

---

## 9. 本章小结

| 你学到了什么 | 对标 React | 在图书馆 App 中的体现 |
|-------------|-----------|---------------------|
| InheritedWidget 机制 | Context.Provider | Provider 的底层依赖 |
| ChangeNotifier + notifyListeners | useState + setState 全局化 | BookListProvider 响应式数据 |
| Provider / MultiProvider | `<Provider value={}>` | main.dart 注入所有 Provider |
| Consumer / Selector | useContext / Zustand selector | 首页精准订阅 isGridView/sortBy |
| context.read vs context.watch | const vs hook | 回调用 read，build 用 watch |
| ChangeNotifierProxyProvider | 依赖链传递 | Auth → Borrowing 联动 |

---

> **下一步**: [Chapter 15 — 状态管理工程化：三态封装、分页与骨架屏](./Chapter-15-状态管理工程化.md)
> **原始文档**: [flutter.cn/data-and-backend/state-mgmt/simple](https://docs.flutter.cn/data-and-backend/state-mgmt/simple) | [pub.dev/packages/provider](https://pub.dev/packages/provider)
