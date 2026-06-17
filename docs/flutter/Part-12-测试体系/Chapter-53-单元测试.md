> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 52 — Add-to-App](../Part-10-平台集成与设备能力/Chapter-52-Add-to-App.md)
> **下一章**: [Chapter 54 — Widget 测试](./Chapter-54-Widget测试.md)
> **官方文档**: [flutter.cn/testing](https://docs.flutter.cn/testing) | [dart.cn/tools/dart-test](https://dart.cn/tools/dart-test)

---

# 第 53 章：单元测试

## 0. 本章目标

test 包（test/setUp/tearDown/group）、Given-When-Then 结构、模型测试（fromJson/toJson/copyWith/==/hashCode）、Repository 测试（Mock→Fake 模式）、ViewModel 测试（ProviderContainer+overrides+状态断言）、Matcher 大全、代码覆盖率、与 Jest/Vitest 对照。

> 🎯 **Library App 产出**：模型 fromJson/toJson/copyWith 测试（全部字段）、Repository 业务逻辑 Mock 测试、ViewModel 状态转换测试——目标 80%+ 覆盖率。

---

## 1. 测试文件组织

```bash
test/
├── models/
│   ├── book_test.dart
│   ├── user_test.dart
│   └── borrow_record_test.dart
├── repositories/
│   └── book_repository_test.dart
├── view_models/
│   ├── home_view_model_test.dart
│   └── auth_view_model_test.dart
└── utils/
    └── validation_test.dart
```

## 2. 模型测试（Given-When-Then）

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:library_app/models/book.dart';

void main() {
  group('Book Model', () {
    final validJson = {'id': '1', 'title': 'Clean Code', 'author': 'Robert C. Martin', 'isbn': '978-0132350884', 'category': 'technology', 'publish_year': 2008, 'cover_url': 'https://example.com/cover.jpg', 'description': 'A handbook of agile software craftsmanship', 'rating': 4.7, 'total_copies': 3, 'available_copies': 2, 'tags': ['software', 'best-practices']};

    test('fromJson parses all required fields', () {
      // When
      final book = Book.fromJson(validJson);
      // Then
      expect(book.id, '1');
      expect(book.title, 'Clean Code');
      expect(book.author, 'Robert C. Martin');
      expect(book.isbn, '978-0132350884');
      expect(book.category, BookCategory.technology);
      expect(book.publishYear, 2008);
    });

    test('fromJson handles missing optional fields with defaults', () {
      // Given
      final minimalJson = {'id': '1', 'title': 'T', 'author': 'A', 'isbn': '123', 'category': 'other', 'publish_year': 2024};
      // When
      final book = Book.fromJson(minimalJson);
      // Then
      expect(book.coverUrl, isNull);
      expect(book.description, isNull);
      expect(book.rating, 0.0);
      expect(book.totalCopies, 1);
      expect(book.tags, isEmpty);
    });

    test('toJson → fromJson roundtrip preserves all data', () {
      // Given
      final original = Book.fromJson(validJson);
      // When
      final roundtripped = Book.fromJson(original.toJson());
      // Then
      expect(roundtripped.title, original.title);
      expect(roundtripped.rating, original.rating);
      expect(roundtripped.tags, original.tags);
    });

    test('copyWith modifies only specified fields', () {
      final book = Book.fromJson(validJson);
      final updated = book.copyWith(title: 'Updated Title');
      expect(updated.title, 'Updated Title');
      expect(updated.author, book.author); // unchanged
      expect(updated.isbn, book.isbn);     // unchanged
    });

    test('equality compares by value, not reference', () {
      final a = Book.fromJson(validJson);
      final b = Book.fromJson(validJson);
      expect(a, equals(b));
    });
  });
}
```

## 3. Repository 测试——Fake + Mock

```dart
// 使用 Fake 实现——不依赖真实 Supabase
class FakeBookRemoteDataSource implements BookRemoteDataSource {
  final List<Map<String, dynamic>> _books = [];
  bool shouldThrow = false;

  void addTestData(List<Map<String, dynamic>> books) => _books.addAll(books);

  @override
  Future<List<Book>> getBooks({int page = 1, int limit = 20, String? category}) async {
    if (shouldThrow) throw DioException(requestOptions: RequestOptions(path: '/books'));
    return _books.skip((page - 1) * limit).take(limit).map((j) => Book.fromJson(j)).toList();
  }
}

void main() {
  late FakeBookRemoteDataSource remote;
  late BookRepositoryImpl repo;

  setUp(() {
    remote = FakeBookRemoteDataSource();
    repo = BookRepositoryImpl(remote: remote, local: FakeBookLocalDataSource());
  });

  test('getBooks returns data from remote source', () async {
    remote.addTestData([validBookJson]);
    final books = await repo.getBooks();
    expect(books, hasLength(1));
    expect(books.first.title, 'Clean Code');
  });

  test('getBooks returns empty list when no data', () async {
    final books = await repo.getBooks();
    expect(books, isEmpty);
  });

  test('getBooks falls back to local on network error', () async {
    remote.shouldThrow = true;
    // 本地有缓存数据
    final books = await repo.getBooks();
    expect(books, hasLength(0)); // 本地也无数据
  });
}
```

## 4. ViewModel 测试—ProviderContainer + overrides

```dart
import 'package:riverpod/riverpod.dart';

void main() {
  test('HomeViewModel emits books on successful load', () async {
    final container = ProviderContainer(overrides: [
      bookRepositoryProvider.overrideWith((ref) => FakeBookRepository()..addTestData([testBook])),
    ]);

    final vm = container.read(homeViewModelProvider.notifier);
    // 等待异步 build() 完成
    await container.read(homeViewModelProvider.future);

    final state = container.read(homeViewModelProvider);
    expect(state.value!.books, hasLength(1));
    expect(state.value!.books.first.title, 'Clean Code');
  });

  test('HomeViewModel emits error state on failure', () async {
    final container = ProviderContainer(overrides: [
      bookRepositoryProvider.overrideWith((ref) => FailingBookRepository()),
    ]);
    await container.read(homeViewModelProvider.future);
    expect(container.read(homeViewModelProvider).hasError, isTrue);
  });
}
```

## 5. 代码覆盖率

```bash
flutter test --coverage                    # 生成 lcov.info
genhtml coverage/lcov.info -o coverage/html  # 生成 HTML 报告
# 目标：models 95%+ / repositories 80%+ / view_models 75%+
```

## 6. 与 Jest/Vitest 对照

| Dart test | Jest/Vitest |
|-----------|------------|
| `test('name', () { ... })` | `test('name', () => { ... })` |
| `group('name', () { ... })` | `describe('name', () => { ... })` |
| `setUp(() { ... })` | `beforeEach(() => { ... })` |
| `expect(value, matcher)` | `expect(value).matcher()` |
| `expect(value, equals(expected))` | `expect(value).toBe(expected)` |
| `expect(fn, throwsA(isA<Exception>()))` | `expect(fn).toThrow()` |

---

## 7. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| Repository 测试调用真实 Supabase/API | 测试慢、不稳定、依赖网络，CI 频繁失败 | 用 Fake（内存实现）替代真实数据源，实现 `FakeXxxRepository` |
| ViewModel 测试中手动实例化而非用 `ProviderContainer` | 无法注入 overrides，测试紧耦合生产依赖 | 通过 `ProviderContainer(overrides: [...])` 注入 Fake |
| 异步测试不 `await` 或遗漏 `expectLater` | 测试"假通过"——异步异常被静默吞掉 | async 测试中所有 `expect` 前确保 Future 已完成 |
| `setUp`/`tearDown` 中创建资源但未清理 | 测试间状态泄漏，导致偶发性失败 | `tearDown` 中释放所有 `StreamSubscription` / `AnimationController` |
| 把 Mock 当 Fake 使用——Mock 验证行为而非状态 | 测试脆弱——Mock 验证了内部实现细节 | 用 Fake（状态验证）而非 Mock（行为验证）测试数据层 |

**最佳实践**：

- 遵循 Given-When-Then 结构：Arrange（准备数据）→ Act（执行操作）→ Assert（验证结果）
- 单个 `test()` 只测一件事，避免一条测试覆盖多个行为
- Fake 优于 Mock：Fake 是轻量实现，Mock 是行为记录——Repository 层优先用 Fake
- ViewModel 测试关注状态转换：初始态 → 加载态 → 成功态/失败态
- 用 `ProviderContainer` 的 `overrides` 注入测试替身，而不修改生产代码
- 分组覆盖率目标：models 95%+ / repositories 80%+ / view_models 75%+
- 用 `genhtml` 生成 HTML 覆盖率报告可视化未覆盖分支

## 8. 本章练习

**练习 1：为 Library App 的 Book 模型编写单元测试**
- 创建 `test/models/book_test.dart`，为 `Book` 模型的 `fromJson`/`toJson` 编写测试
- 覆盖正常 JSON 解析、缺失字段时的默认值、边界值（空字符串、超长标题）
- 验证标准：运行 `flutter test test/models/book_test.dart` 全部通过

**练习 2：为 Library App 的 BookRepository 编写 Fake 测试**
- 创建 `FakeBookRepository`（实现 `BookRepository` 接口，用内存 `List<Book>` 模拟数据源）
- 测试 `getBooks()` 返回空列表、`addBook()` 后 `getBooks()` 包含新书、`deleteBook()` 后列表减少
- 验证标准：所有测试通过，且不依赖任何网络或数据库连接

**练习 3：生成并检查测试覆盖率**
- 运行 `flutter test --coverage` 生成覆盖率报告
- 使用 `genhtml coverage/lcov.info -o coverage/html` 生成 HTML 报告
- 确认 models 层覆盖率 > 90%，并找出至少一个未被测试覆盖的分支，为其补充测试
- 验证标准：覆盖率报告中 models 目录覆盖率达标，并截图保存

---

> **下一步**: [Chapter 54 — Widget 测试](./Chapter-54-Widget测试.md)
