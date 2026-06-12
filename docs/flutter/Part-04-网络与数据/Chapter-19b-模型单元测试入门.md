# 第 20 章：模型单元测试入门

> **Part**: Part IV — 网络与数据
> **上一章**: [Chapter 19 — freezed JSON 序列化](./Chapter-19-freezed-JSON序列化.md)
> **下一章**: [Chapter 20 — Supabase 集成](./Chapter-20-Supabase集成.md)

---

## 0. 本章目标

- 掌握 Flutter 单元测试的基本结构
- 学会测试数据模型的 fromJson / toJson / copyWith
- 理解 Mock 的用途和基本用法

> 🎯 **本章产出**：为 Book 模型编写完整的单元测试。

---

## 1. 为什么模型测试要现在学

你现在已经学会用 freezed 定义数据模型（Ch19）。模型是 App 的数据基础——如果 fromJson/toJson/copyWith 有 Bug，后续所有状态管理和 UI 逻辑都会受影响。

**模型测试是最简单的单元测试**——纯 Dart 代码，不需要 Widget 环境，不需要 Mock。Ch13 你学过 Widget 测试，现在是它的互补技能。

---

## 2. 第一个模型测试

```dart
// test/models/book_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:library_app/models/book.dart';

void main() {
  final testJson = {
    'id': '1',
    'title': 'Clean Code',
    'author': 'Robert C. Martin',
    'isbn': '9780132350884',
    'category': 'technology',
    'publish_year': 2008,
    'rating': 4.5,
    'total_copies': 3,
    'available_copies': 2,
  };

  group('Book.fromJson', () {
    test('从完整 JSON 创建 Book', () {
      final book = Book.fromJson(testJson);

      expect(book.id, '1');
      expect(book.title, 'Clean Code');
      expect(book.author, 'Robert C. Martin');
      expect(book.category, BookCategory.technology);
      expect(book.publishYear, 2008);
      expect(book.rating, 4.5);
    });

    test('category 不存在时默认为 other', () {
      final json = Map<String, dynamic>.from(testJson)..remove('category');
      final book = Book.fromJson(json);

      expect(book.category, BookCategory.other);
    });

    test('可选字段为 null 时使用默认值', () {
      final json = {'id': '1', 'title': 'T', 'author': 'A', 'isbn': 'X'};

      final book = Book.fromJson(json);

      expect(book.publishYear, isA<int>()); // 取决于你的默认值
      expect(book.rating, 0.0);
      expect(book.totalCopies, 1);
    });
  });

  group('Book.toJson', () {
    test('序列化为 JSON 后能再反序列化', () {
      final book = Book.fromJson(testJson);
      final json = book.toJson();
      final restored = Book.fromJson(json);

      expect(restored.id, book.id);
      expect(restored.title, book.title);
      expect(restored.rating, book.rating);
    });
  });

  group('Book.copyWith', () {
    test('只修改指定字段', () {
      final book = Book.fromJson(testJson);
      final updated = book.copyWith(title: 'Clean Architecture');

      expect(updated.title, 'Clean Architecture');
      expect(updated.id, book.id);         // 未变的保持
      expect(updated.author, book.author); // 未变的保持
    });

    test('copyWith 不修改原对象', () {
      final book = Book.fromJson(testJson);
      book.copyWith(title: 'New Title');

      expect(book.title, 'Clean Code');    // 原对象不变
    });
  });

  group('Book getters', () {
    test('availableCopies > 0 时 isAvailable 为 true', () {
      final book = Book.fromJson(testJson);
      expect(book.isAvailable, true);
    });

    test('availableCopies = 0 时 isAvailable 为 false', () {
      final book = Book.fromJson(testJson).copyWith(availableCopies: 0);
      expect(book.isAvailable, false);
    });
  });
}
```

---

## 3. 测试 ApiResult

```dart
// test/models/api_result_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:library_app/models/api_result.dart';

void main() {
  group('ApiResult', () {
    test('Success 的 isSuccess 为 true', () {
      const result = Success<String>('data');
      expect(result.isSuccess, true);
      expect(result.isFailure, false);
      expect(result.data, 'data');
    });

    test('Failure 的 isFailure 为 true', () {
      const result = Failure<String>('error');
      expect(result.isFailure, true);
      expect(result.isSuccess, false);
      expect(result.errorMessage, 'error');
    });

    test('fold 正确处理 Success', () {
      const result = Success<int>(42);
      final output = result.fold(
        onSuccess: (d) => 'got $d',
        onFailure: (e) => 'error: $e',
      );
      expect(output, 'got 42');
    });

    test('fold 正确处理 Failure', () {
      const result = Failure<int>('boom');
      final output = result.fold(
        onSuccess: (d) => 'got $d',
        onFailure: (e) => 'error: $e',
      );
      expect(output, 'error: boom');
    });
  });
}
```

---

## 4. 运行与覆盖率

```bash
# 运行所有测试
flutter test

# 运行指定文件
flutter test test/models/book_test.dart

# 生成覆盖率报告
flutter test --coverage
# 查看：open coverage/lcov-report/index.html（需安装 lcov）
```

---

## 5. 本章练习

1. 为 Book 模型编写全部测试用例（fromJson/toJson/copyWith/getters）
2. 为 ApiResult 编写 fold 和 mapSuccess 的测试
3. 为自己定义的 User/BorrowRecord 模型编写测试

验证：`flutter test` 全部通过。

---

> 📖 **延伸阅读**: [Flutter 单元测试文档](https://docs.flutter.dev/testing/unit-testing) | [mocktail 使用指南](https://pub.dev/packages/mocktail)
