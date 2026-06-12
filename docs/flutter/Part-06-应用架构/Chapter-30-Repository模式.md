> **Part**: Part VI — 应用架构
> **上一章**: [Chapter 29 — MVVM 模式](./Chapter-29-MVVM模式.md)
> **下一章**: [Chapter 31 — 依赖注入](./Chapter-31-依赖注入.md)
> **官方文档**: [flutter.cn/app-architecture/guide](https://docs.flutter.cn/app-architecture/guide) (data layer)

---

# 第 30 章：Repository 模式与数据源抽象

## 0. 本章目标

掌握 Repository 接口定义（Domain 层不依赖实现）、三种数据源策略（Remote First / Local First / Cache Aside）、Repository 实现（错误映射、数据源协调）、Fake Repository 测试注入。

> 🎯 **Library App 产出**：BookRepository/AuthRepository/BorrowRepository（抽象接口 + Supabase 实现 + Fake 实现）、RemoteBookDataSource + LocalBookDataSource。

---

## 1. Repository 接口（Domain 层）

```dart
// lib/core/repository/book_repository.dart
abstract class BookRepository {
  Future<List<Book>> getBooks({int page = 1, int limit = 20, String? category});
  Future<Book?> getBookById(String id);
  Future<List<Book>> searchBooks(String query);
  Future<Book> createBook(Book book);
  Future<Book> updateBook(Book book);
  Future<void> deleteBook(String id);
}

abstract class BorrowRepository {
  Future<List<BorrowRecord>> getActiveBorrows(String userId);
  Future<BorrowRecord> borrowBook(String bookId, String userId);
  Future<BorrowRecord> returnBook(String recordId);
}
```

## 2. DataSource 接口

```dart
abstract class BookRemoteDataSource {
  Future<List<Book>> getBooks({int page, int limit, String? category});
  Future<Book?> getBookById(String id);
  Future<Book> createBook(Book book);
  Future<void> deleteBook(String id);
}

abstract class BookLocalDataSource {
  Future<List<Book>> getCachedBooks();
  Future<void> cacheBooks(List<Book> books);
  Future<void> clearCache();
}
```

## 3. Repository 实现——Remote First 策略

```dart
// lib/core/data_source/repository/book_repository_impl.dart
class BookRepositoryImpl implements BookRepository {
  final BookRemoteDataSource remote;
  final BookLocalDataSource local;

  BookRepositoryImpl({required this.remote, required this.local});

  @override
  Future<List<Book>> getBooks({int page = 1, int limit = 20, String? category}) async {
    try {
      // ① 从远程获取
      final books = await remote.getBooks(page: page, limit: limit, category: category);
      // ② 缓存到本地
      await local.cacheBooks(books);
      return books;
    } on DioException {
      // ③ 网络失败 → 从本地缓存读取
      final cached = await local.getCachedBooks();
      if (cached.isNotEmpty) return cached;
      rethrow;  // 本地也没有缓存 → 抛给调用方
    }
  }

  @override
  Future<void> deleteBook(String id) async {
    await remote.deleteBook(id);
    await local.clearCache();  // 清除过期缓存
  }
}
```

## 4. 三种数据源策略

| 策略 | 先读 | 后读 | 写操作 | 适用 |
|------|------|------|--------|------|
| **Remote First** | 网络 | 本地缓存（fallback） | 先写网络，成功后更新缓存 | 数据一致性优先 |
| **Local First** | 本地 | 网络（后台同步） | 先写本地，后台同步到网络 | 离线优先 |
| **Cache Aside** | 本地缓存 | 网络（缓存未命中时） | 写网络，失效缓存 | 读多写少 |

## 5. Fake Repository——测试用

```dart
class FakeBookRepository implements BookRepository {
  final List<Book> _books = [];

  @override
  Future<List<Book>> getBooks({int page = 1, int limit = 20, String? category}) async {
    var result = List<Book>.from(_books);
    if (category != null) result = result.where((b) => b.category.name == category).toList();
    return result.skip((page - 1) * limit).take(limit).toList();
  }

  @override
  Future<Book> createBook(Book book) async {
    _books.add(book);
    return book;
  }

  void addTestData(List<Book> books) => _books.addAll(books);
}

// 测试中使用：
// final repo = FakeBookRepository()..addTestData(testBooks);
// final vm = BookDetailViewModel(repo);
// expect(vm.state.value!.book.title, 'Test Book');
```

---

## 6. 本章小结

Repository 接口（Domain 层）→ Repository 实现（Data 层）→ DataSource（远端+本地）。三种策略选 Remote First（大多数场景）。Fake Repository 让 ViewModel 测试零依赖。

---

## 7. 本章练习

1. 定义 `BorrowRepository` 抽象接口：在 `lib/core/repository/` 下创建 `borrow_repository.dart`，声明 `getActiveBorrows(String userId)` / `borrowBook(String bookId, String userId)` / `returnBook(String recordId)` 三个抽象方法。确保接口不依赖 Supabase 或任何具体实现。

2. 实现 `BorrowRepositoryImpl`（Remote First 策略）：创建 `SupabaseBorrowRepository` 实现上述接口，优先从 Supabase 查询数据；在网络失败时降级到本地 SQLite 缓存数据（通过 `BorrowLocalDataSource`）。验证标准：飞行模式下 App 仍能展示上次缓存的借阅记录。

3. 实现 `FakeBorrowRepository` 用于 ViewModel 测试：创建 Fake 实现类，内部维护 `List<BorrowRecord>`，预置 3 条测试数据（1 本已借出、1 本已归还、1 本逾期），在 `BorrowViewModel` 的单元测试中注入 Fake Repository 替代真实 Supabase 调用。验证标准：`flutter test` 无需网络即可运行通过。

> **下一步**: [Chapter 31 — 依赖注入](./Chapter-31-依赖注入.md)
> **原始文档**: [flutter.cn/app-architecture/guide](https://docs.flutter.cn/app-architecture/guide)
