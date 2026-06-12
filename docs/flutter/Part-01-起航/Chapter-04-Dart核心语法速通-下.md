> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 02 — Dart 核心语法速通（上）：变量、类型、函数、异步](./Chapter-02-Dart核心语法速通-上.md)
> **下一章**: [Chapter 05 — Dart 3 新特性与现代 Dart 工程化](./Chapter-05-Dart3新特性与工程化基础.md)
> **官方文档**: [dart.cn/language/classes](https://dart.cn/language/classes) | [dart.cn/language/constructors](https://dart.cn/language/constructors) | [dart.cn/language/mixins](https://dart.cn/language/mixins) | [dart.cn/language/enums](https://dart.cn/language/enums) | [dart.cn/language/generics](https://dart.cn/language/generics) | [dart.cn/language/extension-methods](https://dart.cn/language/extension-methods)

---

# 第 4 章：Dart 核心语法速通（下）— 面向对象与集合

## 0. 本章目标

- 掌握 Dart 类定义、字段、Getter
- 理解三种构造方法（默认语法糖 / 命名构造 / const 构造）及使用场景
- 掌握继承（`extends`）、实现（`implements`）、混入（`with` Mixin）
- 熟练使用增强枚举（Dart 3 enum with fields/methods）
- 理解泛型（类泛型 / 方法泛型 / 泛型约束）
- 掌握扩展方法（extension methods）

> 🎯 **本章产出**：在 `lib/models/` 下创建 `Book` 数据模型类，包含 const 构造、fromJson、toJson、copyWith 四件套，为后续章节提供类型安全的数据基础。

---

## 1. 类基础

### 1.1 类定义与字段

```dart
class Book {
  // 字段
  String title;
  String author;
  int publishYear;
  bool isAvailable;

  // 构造方法 — this.field 是一种简写，等价于下面的手动写法
  Book(this.title, this.author, this.publishYear, this.isAvailable);
  // 上面这行等价于：
  // Book(String title, String author, int publishYear, bool isAvailable)
  //     : title = title,
  //       author = author,
  //       publishYear = publishYear,
  //       isAvailable = isAvailable;
  // this.field 让你不用在构造参数和字段赋值中各写一遍变量名

  // 实例方法
  String getDescription() => '"$title" by $author ($publishYear)';

  // Getter — 计算属性（像字段一样访问，实际是方法）
  String get citation => '$author. $title. $publishYear.';
  bool get isClassic => publishYear < 2000;
}

void main() {
  var book = Book('Clean Code', 'Robert C. Martin', 2008, true);
  print(book.title);          // Clean Code
  print(book.citation);       // Robert C. Martin. Clean Code. 2008.
  print(book.isClassic);      // false
}
```

### 1.2 私有成员与封装

Dart 没有 `private` 关键字。以 `_` 开头的标识符是**库级私有**（同一文件内可见）：

```dart
class BankAccount {
  final String _accountNumber;   // 库级私有——仅本文件可见
  double _balance = 0;
  final String owner;            // 公开

  BankAccount(this.owner, this._accountNumber);

  // 暴露只读访问
  String get maskedAccount =>
      '****${_accountNumber.substring(_accountNumber.length - 4)}';

  void deposit(double amount) {
    if (amount <= 0) throw ArgumentError('Amount must be positive');
    _balance += amount;
  }
}
```

### 1.3 抽象类与 implements

```dart
// 抽象类 — 不能被实例化，定义契约
abstract class LibraryItem {
  String get id;
  String get title;
  String toSummary();

  // 具体方法——子类可继承或覆写
  bool matchesQuery(String query) =>
      title.toLowerCase().contains(query.toLowerCase());
}

// extends — 继承抽象类
class Book extends LibraryItem {
  @override
  final String id;
  @override
  final String title;

  Book({required this.id, required this.title});

  @override
  String toSummary() => '📖 $title';
}

// ──── @override 是什么？ ────
// @override 是 Dart 的注解（annotation），放在方法上面表示"我要重写父类的这个方法"。
// 它的实际作用是让编译器帮你检查——如果你不小心把 toSummary 拼成了 toSumary，
// 编译器会报错说"父类里没有这个方法，你是不是拼错了？"
// 不写 @override 的话，这个拼写错误不会被发现，toSumary 会变成一个独立的新方法。
// 所以 @override 不是可有可无的装饰——它是编译器帮你纠错的保护网。

// Dart 没有 interface 关键字——任何类都可以作为接口被实现
class DigitalBook implements LibraryItem {
  @override
  String get id => 'dig_001';
  @override
  String get title => 'Digital Book';
  @override
  String toSummary() => '💻 $title';
  @override
  bool matchesQuery(String query) => title.contains(query);
}
```

---

## 2. 构造方法

Dart 有三种最实用的构造方法。

### 2.1 默认构造 + 语法糖

```dart
class Book {
  String title;
  String author;
  int? year;

  // this.field 直接赋值——最简洁
  Book(this.title, this.author, [this.year]);
}
```

### 2.2 初始化列表

在构造函数体执行**之前**运行——常用于计算 final 字段：

```dart
class BorrowRecord {
  final String bookId;
  final String userId;
  final DateTime borrowDate;
  final DateTime dueDate;

  BorrowRecord({
    required this.bookId,
    required this.userId,
    int borrowDurationDays = 14,
  })  : borrowDate = DateTime.now(),
        dueDate = DateTime.now().add(Duration(days: borrowDurationDays));
}
```

### 2.3 命名构造方法

同一类可以有多个语义化构造器——Dart 最具特色的特性之一：

```dart
class Book {
  final String title;
  final String author;
  final int? year;

  // 默认构造
  Book(this.title, this.author, {this.year});

  // 命名构造 ① — 从 JSON 创建
  Book.fromJson(Map<String, dynamic> json)
      : title = json['title'] as String,
        author = json['author'] as String,
        year = json['year'] as int?;

  // 命名构造 ② — 占位实例
  Book.placeholder()
      : title = 'Untitled',
        author = 'Unknown',
        year = null;
}

var book1 = Book('Design Patterns', 'GoF', year: 1994);
var book2 = Book.fromJson({'title': 'Refactoring', 'author': 'Fowler'});
var book3 = Book.placeholder();
```

### 2.4 工厂构造方法（factory）

`factory` 不同于普通构造——它不一定要创建新实例，但可以返回已有对象：

```dart
class Book {
  final String isbn;
  final String title;

  // 私有构造
  Book._internal(this.isbn, this.title);

  // 缓存已创建的对象
  static final Map<String, Book> _cache = {};

  factory Book(String isbn, String title) {
    return _cache.putIfAbsent(isbn, () => Book._internal(isbn, title));
  }
}
```

> **如何选择：命名构造 vs 工厂构造？**
> 
> - **命名构造**（如 `Book.fromJson(...)`）：每次调用都创建一个新实例。适合"从 JSON 创建新的普通对象"这种最常见场景。
> - **工厂构造**（`factory`）：可以在创建实例前做额外判断——比如检查缓存（相同 isbn 不重复创建）、根据条件返回不同子类。适合需要缓存去重、对象池等场景。
> 
> 初学者最常用的 factory 场景是 `factory Book.fromJson(...)`——从 JSON 创建实例。缓存、返回子类等高级用法在掌握基础后再了解即可。

### 2.5 const 构造——Flutter 性能基石

```dart
class Point {
  final int x;
  final int y;         // 所有字段必须是 final

  const Point(this.x, this.y);

  static const origin = Point(0, 0);
}

// const 实例编译时就创建好——相同值在内存中只存在一份
const a = Point(1, 2);
const b = Point(1, 2);
print(identical(a, b));   // true — 完全相同的对象
```

> Flutter 中大量使用 `const` 构造是 UI 性能优化的一级手段——`const Text('Hello')` 在 App 中始终只有一份实例。

---

## 3. 继承与 Mixin

### 3.1 extends — 单继承

```dart
class LibraryItem {
  final String id;
  final String title;

  LibraryItem({required this.id, required this.title});

  String toSummary() => '$title ($id)';
}

class Book extends LibraryItem {
  final String author;

  // super 参数传递（Dart 2.17+）
  // super.id 的意思是"这个参数我不自己存，直接传给父类 LibraryItem 的构造方法"
  // 而 this.author 的意思是"把这个参数存到我（子类 Book）自己的 author 字段里"
  // super.参数 是 Dart 2.17 才加入的便捷语法，等价于手动写：
  //   Book({required String id, required String title, required this.author})
  //       : super(id: id, title: title);
  // 省去了手动写初始化列表的麻烦
  Book({required super.id, required super.title, required this.author});

  @override
  String toSummary() => '📖 $title by $author';
}
```

### 3.2 Mixin — 横向代码复用

Mixin 是 Dart 最强大的代码复用机制——比继承更灵活：

```dart
mixin LoggerMixin {
  void log(String message) {
    print('[${DateTime.now()}] ${runtimeType}: $message');
  }

  void logError(String message) {
    print('❌ ${runtimeType}: $message');
  }
}

class Book with LoggerMixin {
  final String title;
  Book(this.title) {
    log('Book created: "$title"');   // 来自 LoggerMixin
  }
}
```

> Dart 还有 `mixin on` 语法可限定混入范围，以及 `implements` 可实现多个接口。初学者先用好 `extends` + `with` 即可，完整说明见官方文档。

---

## 4. 增强枚举

Dart 3 的枚举可以包含字段、构造方法和 Getter：

```dart
enum BookStatus {
  available(label: '可借', icon: '📗'),
  borrowed(label: '已借出', icon: '📕'),
  reserved(label: '已预约', icon: '📙'),
  overdue(label: '逾期', icon: '⚠️');

  final String label;
  final String icon;

  const BookStatus({required this.label, required this.icon});

  bool get isAvailable => this == BookStatus.available;
}

// 使用
var status = BookStatus.available;
print(status.label);          // 可借
print(status.isAvailable);    // true

// 配合 switch 表达式（编译器检查是否覆盖所有值）
String display = switch (status) {
  BookStatus.available => '📗 可借',
  BookStatus.borrowed  => '📕 已借出',
  BookStatus.reserved  => '📙 已预约',
  BookStatus.overdue   => '⚠️ 逾期',
};

// 遍历所有枚举值
BookStatus.values.forEach((s) => print(s.label));
```

---

## 5. 泛型

```dart
// 泛型类
class Result<T> {
  final T? data;
  final String? error;

  Result.success(this.data) : error = null;
  Result.failure(this.error) : data = null;

  bool get isSuccess => error == null;

  R fold<R>(R Function(T) onSuccess, R Function(String) onFailure) {
    return isSuccess ? onSuccess(data as T) : onFailure(error!);
  }
}

// 泛型约束 — T 必须是 LibraryItem 或其子类
class Shelf<T extends LibraryItem> {
  final List<T> _items = [];

  void add(T item) => _items.add(item);

  T? findById(String id) {
    try {
      return _items.firstWhere((item) => item.id == id);
    } catch (_) {
      return null;
    }
  }
}

var bookShelf = Shelf<Book>();
bookShelf.add(Book(id: '1', title: 'Design Patterns', author: 'GoF'));
// bookShelf.add('not a book');   // ❌ 编译错误
```

---

## 6. 扩展方法

不修改原始类，给现有类型添加新方法：

```dart
// 给 String 添加扩展
extension StringFormatting on String {
  String get capitalize =>
      isEmpty ? '' : '${this[0].toUpperCase()}${substring(1)}';

  String truncate(int maxLength) =>
      length <= maxLength ? this : '${substring(0, maxLength)}...';

  bool get isValidEmail =>
      RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$').hasMatch(this);
}

print('hello'.capitalize);                 // Hello
print('a very long title'.truncate(10));   // a very lon...
print('test@example.com'.isValidEmail);    // true
```

---

## 7. 图书馆 App 实战：Book 数据模型

将本章所有概念融合进 `lib/models/book.dart`——一个完整的图书数据模型：

```dart
// lib/models/book.dart

enum BookCategory {
  fiction(label: '小说'),
  science(label: '科学'),
  technology(label: '技术'),
  history(label: '历史'),
  philosophy(label: '哲学'),
  other(label: '其他');

  final String label;
  const BookCategory({required this.label});
}

class Book {
  final String id;
  final String title;
  final String author;
  final String isbn;
  final BookCategory category;
  final int publishYear;
  final String? coverUrl;
  final String? description;
  final double rating;
  final int totalCopies;
  final int availableCopies;

  const Book({
    required this.id,
    required this.title,
    required this.author,
    required this.isbn,
    required this.category,
    required this.publishYear,
    this.coverUrl,
    this.description,
    this.rating = 0.0,
    this.totalCopies = 1,
    this.availableCopies = 1,
  });

  // ──── Getter ────
  bool get isAvailable => availableCopies > 0;
  String get availability =>
      isAvailable ? '可借 ($availableCopies/$totalCopies)' : '已全部借出';

  // ──── 命名构造：fromJson ────
  Book.fromJson(Map<String, dynamic> json)
      : id = json['id'] as String,
        title = json['title'] as String,
        author = json['author'] as String,
        isbn = json['isbn'] as String,
        category = BookCategory.values.firstWhere(
          (c) => c.name == json['category'],
          orElse: () => BookCategory.other,
        ),
        publishYear = json['publish_year'] as int,
        coverUrl = json['cover_url'] as String?,
        description = json['description'] as String?,
        rating = (json['rating'] as num?)?.toDouble() ?? 0.0,
        totalCopies = json['total_copies'] as int? ?? 1,
        availableCopies = json['available_copies'] as int? ?? 1;

  // ──── toJson ────
  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'author': author,
        'isbn': isbn,
        'category': category.name,
        'publish_year': publishYear,
        'cover_url': coverUrl,
        'description': description,
        'rating': rating,
        'total_copies': totalCopies,
        'available_copies': availableCopies,
      };

  // ──── copyWith：不可变对象的"修改" ────
  // ?? 是空值合并操作符——如果左边为 null 就用右边的值。
  // 这里的意思是：如果调用 copyWith 时传了新值就用新的，没传就用原来的。
  // ?? 的完整讲解在 Ch05 空安全章节。
  Book copyWith({
    String? title,
    String? author,
    String? isbn,
    BookCategory? category,
    int? publishYear,
    String? coverUrl,
    String? description,
    double? rating,
    int? totalCopies,
    int? availableCopies,
  }) {
    return Book(
      id: id,
      title: title ?? this.title,           // ?? 传了新 title 就用新的，没传就用原值
      author: author ?? this.author,         // ?? 同上——每个字段都是一样的逻辑
      isbn: isbn ?? this.isbn,
      category: category ?? this.category,
      publishYear: publishYear ?? this.publishYear,
      coverUrl: coverUrl ?? this.coverUrl,
      description: description ?? this.description,
      rating: rating ?? this.rating,
      totalCopies: totalCopies ?? this.totalCopies,
      availableCopies: availableCopies ?? this.availableCopies,
    );
  }

  @override
  String toString() => 'Book(id: $id, title: $title, author: $author)';
}
```

> User 和 BorrowRecord 模型遵循相同的 `const 构造 + fromJson + toJson + copyWith` 四件套模式。尝试自行实现这两个模型作为练习。

> 📖 **延伸阅读**：[dart.cn/language/classes](https://dart.cn/language/classes) | [dart.cn/language/constructors](https://dart.cn/language/constructors) | [dart.cn/language/mixins](https://dart.cn/language/mixins) | [dart.cn/language/enums](https://dart.cn/language/enums) | [dart.cn/language/generics](https://dart.cn/language/generics)

---

## 8. 常见错误与最佳实践

### 常见错误

```dart
// ❌ final 字段没在构造中初始化
class Bad {
  final int x;
  // Bad();                    // 编译错误！
  Bad(this.x);                 // ✅
}

// ❌ const 构造的类中有非 final 字段
class Bad {
  int x;                       // ❌ 必须 final
  // const Bad(this.x);        // 编译错误！
}

// ❌ factory 里不能用 this（实例还不存在）
class Bad {
  factory Bad() {
    // this.x = 1;             // ❌
    return Bad._();
  }
  Bad._();
}
```

### 最佳实践

1. **模型类用 const 构造 + fromJson + toJson + copyWith 四件套**——Flutter 模型类的标准模式
2. **优先 Mixin 而非深层继承**——Mixin 更灵活，不引入紧耦合的层级
3. **增强枚举替代常量类**——`enum BookStatus` 比 `class BookStatusConstants` 更安全、更简洁
4. **扩展方法非侵入式增强**——给第三方库类型添加方法时用 extension，不要写 wrapper

---

## 9. 本章小结

| 你学到了什么 | 在图书馆 App 中的体现 |
|-------------|---------------------|
| Dart 类定义 + Getter | Book 模型的完整字段体系 |
| 三种构造方法（默认/命名/const） | Book.fromJson 命名构造、const 性能优化 |
| 继承 + implements + Mixin | 后续章节的 Repository 抽象 |
| 增强枚举 | BookCategory 枚举 |
| 泛型 + 泛型约束 | Result<T>, Shelf<T> |
| 扩展方法 | 后续给 String/DateTime 加便捷方法 |

---

## 10. 本章练习

1. 为 `Book` 类添加 `copyWith` 方法（不借助 freezed），用 `??` 操作符实现可选字段更新
2. 定义一个 `Printable` mixin，包含 `printInfo()` 方法，让 `Book` 和后续的 `User` 类混入它
3. 用增强枚举定义 `BorrowStatus`（active/returned/overdue），每个值关联中文标签和颜色，重写本章练习 1 的 `copyWith` 确保所有字段正确

验证标准：`dart run` 输出各枚举值的 label，`copyWith` 只修改指定字段不改变其他字段。

> **下一步**: [Chapter 05 — Dart 3 新特性与现代 Dart 工程化](./Chapter-05-Dart3新特性与工程化基础.md)
