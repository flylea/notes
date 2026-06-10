> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 02 — Dart 核心语法速通（上）：变量、类型、函数、控制流](./Chapter-02-Dart核心语法速通-上.md)
> **下一章**: [Chapter 04 — Dart 3 新特性与现代 Dart 工程化](./Chapter-04-Dart3新特性与工程化基础.md)
> **官方文档**: [dart.cn/language/classes](https://dart.cn/language/classes) | [dart.cn/language/constructors](https://dart.cn/language/constructors) | [dart.cn/language/extend](https://dart.cn/language/extend) | [dart.cn/language/mixins](https://dart.cn/language/mixins) | [dart.cn/language/enums](https://dart.cn/language/enums) | [dart.cn/language/generics](https://dart.cn/language/generics) | [dart.cn/language/collections](https://dart.cn/language/collections) | [dart.cn/language/extension-methods](https://dart.cn/language/extension-methods)

---

# 第 3 章：Dart 核心语法速通（下）— 面向对象与集合

## 0. 本章目标与前置依赖

**前置依赖**：已完成 Chapter 2 的变量、类型、函数、控制流、异常处理学习。本章假设你可以熟练声明 Dart 变量、编写函数、使用控制流。

**本章目标**：
- 掌握 Dart 类定义、字段、方法、Getter/Setter
- 理解四种构造方法（默认/命名/工厂/常量构造）及其使用场景
- 掌握继承（extends）、实现（implements）、混入（with/on Mixin）
- 熟练使用增强枚举（Dart 3 的 enum with fields/methods）
- 理解泛型的使用（类泛型/方法泛型/泛型约束）
- 掌握集合操作（map/where/reduce/fold/expand/collection-if/collection-for）
- 理解扩展方法（extension methods）的设计模式

> 🎯 **本章会在图书馆 App 中做什么**：在 `lib/models/` 下创建 **Book（图书）、User（用户）、BorrowRecord（借阅记录）** 三个纯 Dart 数据模型类，为后续所有章节提供类型安全的数据基础。

---

## 1. TypeScript 类比速查

| 概念 | Dart | TypeScript | 关键差异 |
|------|------|-----------|---------|
| 类定义 | `class Person {}` | `class Person {}` | 语法几乎一样 |
| 私有成员 | `_privateField` | `private field` / `#privateField` | Dart 用 `_` 前缀（命名约定，非强制） |
| Getter | `int get age => _age;` | `get age(): number { return this._age }` | Dart getter 更简洁 |
| Setter | `set age(int v) { _age = v; }` | `set age(v: number) { this._age = v }` | 相似 |
| 构造方法 | `Person(this.name);` | `constructor(public name: string) {}` | Dart 语法糖更简练 |
| 命名构造 | `Person.guest();` | 无直接等价——用静态工厂方法 | Dart 独有特性 |
| 工厂构造 | `factory Person.fromJson(...)` | `static fromJson(...)` | Dart factory 可使用 `return`，更灵活 |
| 继承 | `class A extends B {}` | `class A extends B {}` | 几乎一样 |
| 实现接口 | `class A implements B {}` | `class A implements B {}` | Dart 没有 `interface` 关键字，任何类都可作为接口 |
| Mixin | `class A with B, C {}` | 无原生对应——用组合或 HOC 模拟 | Dart 最强大特性之一 |
| 增强枚举 | `enum Color { red(0xFF0000); }` | TS enum 也是类似用法 | Dart 3 大幅强化 |
| 泛型 | `class Box<T> {}` | `class Box<T> {}` | 几乎一样 |
| 扩展方法 | `extension E on String {}` | 无原生对应——用原型扩展或 Utility 函数 | Dart 独有特性 |

---

## 2. 类基础

### 2.1 类定义与实例化

```dart
class Book {
  // 字段声明
  String title;
  String author;
  int publishYear;
  bool isAvailable;

  // 构造方法 — 最简形式（语法糖：自动赋值给对应字段）
  Book(this.title, this.author, this.publishYear, this.isAvailable);

  // 实例方法
  String getDescription() {
    return '"$title" by $author ($publishYear)';
  }

  // Getter — 计算属性（看起来像字段，实际上是方法）
  String get citation => '$author. $title. $publishYear.';

  // Setter — 设置属性时自动执行逻辑
  set markUnavailable(bool value) {
    isAvailable = !value;
  }
}

// 使用
void main() {
  var book = Book('Clean Code', 'Robert C. Martin', 2008, true);

  print(book.title);                    // Clean Code
  print(book.getDescription());         // "Clean Code" by Robert C. Martin (2008)
  print(book.citation);                 // Robert C. Martin. Clean Code. 2008.

  book.markUnavailable = true;
  print(book.isAvailable);             // false
}

// 对比 TS：
// class Book {
//   constructor(
//     public title: string,
//     public author: string,
//     public publishYear: number,
//     public isAvailable: boolean
//   ) {}
// }
// Dart 的 this.field 语法糖更简洁：不需要在构造函数参数和类字段中各写一遍
```

### 2.2 私有成员与封装

Dart 没有 `private` / `protected` 关键字。以 `_` 开头的标识符是**库级私有**（同一个 `.dart` 文件内可见）：

```dart
class BankAccount {
  final String _accountNumber;     // 库级私有——仅本文件内可见
  double _balance = 0;             // 库级私有
  final String owner;              // 公开

  BankAccount(this.owner, this._accountNumber);

  // Getter：暴露私有字段的只读访问
  String get maskedAccount =>
      '****${_accountNumber.substring(_accountNumber.length - 4)}';

  // 公开方法操作私有状态
  void deposit(double amount) {
    if (amount <= 0) throw ArgumentError('Amount must be positive');
    _balance += amount;
  }

  // 私有方法——仅在类内部使用
  void _logTransaction(String type, double amount) {
    // 记录交易日志
  }
}
```

> **TS 经验**：Dart 的 `_` 前缀 ≈ TS 的 `private` 关键字（TS 编译后检查消失，Dart 的库级私有是真正的语言级隔离）。与 TS 的 `#privateField`（JS 真私有）更接近——但隔离粒度是文件级别而非类级别。

### 2.3 抽象类（Abstract Class）

```dart
// 抽象类 — 不能被实例化，定义契约
abstract class LibraryItem {
  String get id;                        // 抽象 getter（子类必须实现）
  String get title;

  // 抽象方法
  String toSummary();

  // 具体方法（有实现）——子类可继承或覆写
  bool matchesQuery(String query) {
    return title.toLowerCase().contains(query.toLowerCase());
  }
}

// 子类实现抽象类
class Book extends LibraryItem {
  @override
  final String id;

  @override
  String title;

  Book({required this.id, required this.title});

  @override
  String toSummary() => '📖 $title';
}
```

### 2.4 隐式接口（implements）

Dart 没有 `interface` 关键字——**任何类都可以作为接口被实现**：

```dart
// 任何类都可以当接口
class Rentable {
  void rent(String userId) {}
  void returnItem() {}
  bool get isRented => false;
}

// implements — 必须实现 Rentable 的所有成员
class DigitalBook implements Rentable {
  @override
  void rent(String userId) {
    // 电子书租借逻辑
  }

  @override
  void returnItem() {
    // 电子书归还逻辑
  }

  @override
  bool get isRented => false;
}

// 一个类可以实现多个接口
class AudioBook extends LibraryItem implements Rentable {
  @override
  final String id;

  @override
  String title;

  AudioBook({required this.id, required this.title});

  @override
  String toSummary() => '🎧 $title';

  @override
  void rent(String userId) { /* ... */ }

  @override
  void returnItem() { /* ... */ }

  @override
  bool get isRented => false;
}
```

> **TS 经验**：Dart 的 `implements` 与 TS 的 `implements` 语义完全一致。区别在于 Dart 不需要单独定义 `interface`——每个类天然就是接口。

---

## 3. 构造方法

Dart 有四种构造方法，比 TS 丰富得多。

### 3.1 默认构造方法 + 语法糖

```dart
class Book {
  String title;
  String author;
  int? year;              // 可选字段用 ?

  // ① 最简：this.fieldName 直接赋值
  Book(this.title, this.author, [this.year]);

  // ② 手动赋值（当需要额外逻辑时）
  // Book(String title, String author, [int? year])
  //     : title = title.trim(),     // 初始化列表（Initializer List）
  //       author = author.trim(),
  //       year = year;
}
```

**初始化列表（Initializer List）**是 Dart 独有的强大特性——在构造函数体执行**之前**运行：

```dart
class BorrowRecord {
  final String bookId;
  final String userId;
  final DateTime borrowDate;
  final DateTime dueDate;

  // 初始化列表：在构造体之前计算 final 字段
  BorrowRecord({
    required this.bookId,
    required this.userId,
    int borrowDurationDays = 14,
  })  : borrowDate = DateTime.now(),
        dueDate = DateTime.now().add(Duration(days: borrowDurationDays));
  // ↑ 分号前是初始化列表——可以计算 final 字段的值
}
```

### 3.2 命名构造方法

命名构造方法是 Dart 最实用的特性之一——同一个类可以有多个语义化构造器：

```dart
class Book {
  final String title;
  final String author;
  final int? year;
  final List<String> tags;

  // 默认构造
  Book(this.title, this.author, {this.year, this.tags = const []});

  // 命名构造 ① — 从 JSON 创建
  Book.fromJson(Map<String, dynamic> json)
      : title = json['title'] as String,
        author = json['author'] as String,
        year = json['year'] as int?,
        tags = (json['tags'] as List?)?.cast<String>() ?? [];

  // 命名构造 ② — 创建占位书籍
  Book.placeholder()
      : title = 'Untitled',
        author = 'Unknown',
        year = null,
        tags = [];

  // 命名构造 ③ — 从 CSV 行创建
  Book.fromCsv(String csvLine)
      : this(
          csvLine.split(',')[0],
          csvLine.split(',')[1],
          year: int.tryParse(csvLine.split(',')[2]),
        ); // 调用默认构造（Redirecting Constructor）
}

// 使用：
var book1 = Book('Design Patterns', 'GoF', year: 1994);
var book2 = Book.fromJson({'title': 'Refactoring', 'author': 'Fowler'});
var book3 = Book.placeholder();
var book4 = Book.fromCsv('Clean Code,Martin,2008');
```

> **TS 经验**：TS 没有命名构造方法的等价物。TS 开发者通常用静态工厂方法 `static fromJson(json)` 来模拟。Dart 的命名构造更自然——它仍然是构造函数（而非静态方法），能使用 `this`、初始化列表、`const` 等构造函数专属能力。

### 3.3 工厂构造方法（factory）

`factory` 构造方法不同于普通构造——它**不一定创建新实例**，可以返回缓存的对象或子类实例：

```dart
class Book {
  final String isbn;
  final String title;

  // 私有构造（防止外部直接创建）
  Book._internal(this.isbn, this.title);

  // 缓存已创建的 Book 对象（Flyweight 模式）
  static final Map<String, Book> _cache = {};

  // factory 构造 — 可以返回已有实例
  factory Book(String isbn, String title) {
    // 如果已创建过同一 ISBN 的书，返回缓存
    return _cache.putIfAbsent(isbn, () => Book._internal(isbn, title));
  }

  // factory 也可以返回子类
  factory Book.fromType(String type) {
    switch (type) {
      case 'audio':
        return AudioBook('audio_001', 'Audio Book');
      case 'digital':
        return DigitalBook('dig_001', 'Digital Book');
      default:
        return Book('print_001', 'Print Book');
    }
  }
}

class AudioBook extends Book {
  AudioBook(super.isbn, super.title) : super._internal();
}
class DigitalBook extends Book {
  DigitalBook(super.isbn, super.title) : super._internal();
}

// 对比 TS：TS 中没有 factory 的直接等价物。
// TS 的 constructor 必须返回本类实例（或抛异常）。
// Dart factory 是最接近"构造方法多态"的机制。
```

### 3.4 常量构造方法

```dart
class Point {
  final int x;     // 必须是 final
  final int y;

  // const 构造 — 所有字段必须是 final
  const Point(this.x, this.y);

  // const 实例在编译时就创建好
  static const origin = Point(0, 0);
}

// const 构造的威力 — 同一份数据在内存中只存在一份
const a = Point(1, 2);
const b = Point(1, 2);
print(identical(a, b));          // true — 完全相同的对象引用！

// ⚠️ const 构造也能用 new 方式调用（此时不共享）
final c = Point(1, 2);           // 运行时创建（即使 Point 有 const 构造）
print(identical(a, c));          // false
```

> **TS 经验**：Dart 的 `const` 构造 ≈ TS 的 `Object.freeze()` + 编译时确定。Flutter 中大量使用 const 构造是 UI 性能优化的一级手段——`const Text('Hello')` 在整个 App 中只有一份实例。

---

## 4. 继承与 Mixin

### 4.1 extends — 单继承

```dart
class LibraryItem {
  final String id;
  final String title;
  bool isAvailable = true;

  LibraryItem({required this.id, required this.title});

  String toSummary() => '$title ($id)';
}

// extends — 继承
class Book extends LibraryItem {
  final String author;
  final int? pages;

  // super 参数传递（Dart 2.17+）— 直接传给父类构造
  Book({
    required super.id,       // 直接传给 LibraryItem 的 id
    required super.title,    // 直接传给 LibraryItem 的 title
    required this.author,
    this.pages,
  });

  // @override 注解 — 覆写父类方法
  @override
  String toSummary() => '📖 $title by $author${pages != null ? " ($pages pages)" : ""}';
}

// TS 对比：
// class Book extends LibraryItem {
//   constructor(
//     id: string,         // 不能像 Dart 一样用 super.id 直接传递
//     title: string,      // TS 需要手动调用 super(id, title)
//     public author: string,
//     public pages?: number
//   ) { super(id, title); }
// }
```

### 4.2 Mixin — 横向代码复用

Mixin 是 Dart 最强大的代码复用机制——比继承更灵活，比接口更具体：

```dart
// 定义 Mixin — 可以被混入其他类
mixin LoggerMixin {
  // 记录日志的通用逻辑
  void log(String message) {
    final timestamp = DateTime.now().toIso8601String();
    print('[$timestamp] ${runtimeType}: $message');
  }

  void logError(String message, [Object? error]) {
    print('❌ ${runtimeType}: $message ${error ?? ''}');
  }
}

// 另一个 Mixin
mixin ValidatableMixin {
  List<String> validate();                 // 抽象方法——混入者必须实现
  bool get isValid => validate().isEmpty; // 依赖于抽象方法的具体实现
  List<String> get errors => validate();   // Getter 别名
}

// 使用 Mixin — with 关键字
class Book with LoggerMixin, ValidatableMixin {
  final String title;
  final String author;

  Book(this.title, this.author) {
    log('Book created: "$title" by $author');  // 来自 LoggerMixin
  }

  // 实现 ValidatableMixin 的抽象方法
  @override
  List<String> validate() {
    final errors = <String>[];
    if (title.isEmpty) errors.add('Title cannot be empty');
    if (author.isEmpty) errors.add('Author cannot be empty');
    return errors;
  }
}

void main() {
  final book = Book('', '');
  if (!book.isValid) {
    print('Validation errors: ${book.errors}');
    // Validation errors: [Title cannot be empty, Author cannot be empty]
  }
}
```

**mixin on — 限定混入范围**：

```dart
// 这个 Mixin 只能被 LibraryItem 的子类混入
mixin RentableMixin on LibraryItem {
  String? _borrowedBy;
  DateTime? _borrowDate;

  bool get isBorrowed => _borrowedBy != null;

  void borrow(String userId) {
    if (isBorrowed) throw StateError('Already borrowed');
    if (!isAvailable) throw StateError('Not available');
    _borrowedBy = userId;
    _borrowDate = DateTime.now();
    isAvailable = false;
  }

  void returnItem() {
    _borrowedBy = null;
    _borrowDate = null;
    isAvailable = true;
  }
}

// ✅ 可以用——Book 是 LibraryItem 的子类
class Book extends LibraryItem with RentableMixin {
  Book({required super.id, required super.title});
}

// ❌ 不能用——String 不是 LibraryItem 的子类
// class MyString extends String with RentableMixin {}  // 编译错误！
```

> **TS 经验**：TS 没有原生的 Mixin。TS 开发者通常用多重 `implements` + Utility 函数 或 Decorator 模式来模拟。Dart 的 Mixin 更干净——它是语言级特性，支持 `super` 调用、`on` 类型限定、多混入组合。

---

## 5. 增强枚举

Dart 3 的枚举类非常强大——可以有字段、构造方法、getter、方法和 `switch` 表达式集成：

```dart
enum BookStatus {
  available(icon: Icons.library_books, label: '可借'),
  borrowed(icon: Icons.bookmark, label: '已借出'),
  reserved(icon: Icons.bookmark_border, label: '已预约'),
  overdue(icon: Icons.warning, label: '逾期'),
  damaged(icon: Icons.broken_image, label: '损坏');

  // 字段
  final IconData icon;
  final String label;

  // const 构造（枚举构造必须是 const）
  const BookStatus({required this.icon, required this.label});

  // Getter
  bool get isAvailable => this == BookStatus.available;
  bool get needsAttention => this == BookStatus.overdue || this == BookStatus.damaged;
}

// 使用：
var status = BookStatus.available;
print(status.label);           // 可借
print(status.isAvailable);     // true

// 配合 switch 表达式（完备性检查——必须覆盖所有枚举值）
String displayText = switch (status) {
  BookStatus.available => '📗 Available',
  BookStatus.borrowed => '📕 Borrowed',
  BookStatus.reserved => '📙 Reserved',
  BookStatus.overdue => '📕 Overdue!',
  BookStatus.damaged => '📓 Damaged',
};

// 遍历所有枚举值
for (final s in BookStatus.values) {
  print('${s.label}: ${s.icon}');
}
```

---

## 6. 泛型

```dart
// 泛型类
class Result<T> {
  final T? _data;
  final String? _error;

  Result.success(T data)
      : _data = data,
        _error = null;

  Result.failure(String error)
      : _data = null,
        _error = error;

  bool get isSuccess => _error == null;
  T get data => _data!;
  String get error => _error!;

  // 泛型方法
  R fold<R>(R Function(T) onSuccess, R Function(String) onFailure) {
    return isSuccess ? onSuccess(_data as T) : onFailure(_error!);
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
  List<T> get all => List.unmodifiable(_items);
}

// 使用：
var bookShelf = Shelf<Book>();
bookShelf.add(Book(id: 'b1', title: 'Design Patterns'));
// bookShelf.add('not a book');  // ❌ 编译错误——String 不是 LibraryItem
```

---

## 7. 扩展方法

扩展方法让你在不修改原始类的情况下，给现有类型添加新方法：

```dart
// 给 String 添加格式化扩展
extension StringFormatting on String {
  String get capitalize =>
      isEmpty ? '' : '${this[0].toUpperCase()}${substring(1)}';

  String truncate(int maxLength) =>
      length <= maxLength ? this : '${substring(0, maxLength)}...';

  bool get isValidEmail => RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,}$').hasMatch(this);
}

// 使用：
print('hello'.capitalize);          // Hello
print('a very long title'.truncate(10)); // a very lon...
print('test@example.com'.isValidEmail);  // true

// 给 DateTime 添加扩展
extension DateTimeFormatting on DateTime {
  String get formatted =>
      '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';

  bool isSameDay(DateTime other) =>
      year == other.year && month == other.month && day == other.day;
}

// 泛型扩展
extension ListExtensions<T> on List<T> {
  T? firstWhereOrNull(bool Function(T) test) {
    for (final element in this) {
      if (test(element)) return element;
    }
    return null;
  }
}
```

---

## 8. 图书馆 App 实战：数据模型定义

现在用本章学的 Dart OOP 知识，在 Library App 中创建三个核心数据模型。

### 8.1 Book（图书）

```dart
// lib/models/book.dart

enum BookCategory {
  fiction(label: '小说'),
  science(label: '科学'),
  technology(label: '技术'),
  history(label: '历史'),
  philosophy(label: '哲学'),
  art(label: '艺术'),
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
  final List<String> tags;

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
    this.tags = const [],
  });

  // Getter
  bool get isAvailable => availableCopies > 0;
  String get availabilityText =>
      isAvailable ? '可借 ($availableCopies/$totalCopies)' : '已全部借出';

  // 命名构造：从 JSON 创建
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
        availableCopies = json['available_copies'] as int? ?? 1,
        tags = (json['tags'] as List?)?.cast<String>() ?? const [];

  // 转换为 JSON
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
        'tags': tags,
      };

  // copyWith — 不可变对象的克隆+修改（Flutter 中极为常用）
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
    List<String>? tags,
  }) {
    return Book(
      id: id,
      title: title ?? this.title,
      author: author ?? this.author,
      isbn: isbn ?? this.isbn,
      category: category ?? this.category,
      publishYear: publishYear ?? this.publishYear,
      coverUrl: coverUrl ?? this.coverUrl,
      description: description ?? this.description,
      rating: rating ?? this.rating,
      totalCopies: totalCopies ?? this.totalCopies,
      availableCopies: availableCopies ?? this.availableCopies,
      tags: tags ?? this.tags,
    );
  }

  @override
  String toString() => 'Book(id: $id, title: $title, author: $author)';
}
```

### 8.2 User（用户）

```dart
// lib/models/user.dart

enum UserRole {
  reader(label: '读者'),
  librarian(label: '图书管理员'),
  admin(label: '系统管理员');

  final String label;
  const UserRole({required this.label});
}

class User {
  final String id;
  final String name;
  final String email;
  final UserRole role;
  final String? avatarUrl;
  final DateTime joinedAt;
  final int maxBorrowLimit;

  const User({
    required this.id,
    required this.name,
    required this.email,
    this.role = UserRole.reader,
    this.avatarUrl,
    required this.joinedAt,
    this.maxBorrowLimit = 5,
  });

  bool get canManageBooks =>
      role == UserRole.librarian || role == UserRole.admin;
  bool get canManageUsers => role == UserRole.admin;

  User.fromJson(Map<String, dynamic> json)
      : id = json['id'] as String,
        name = json['name'] as String,
        email = json['email'] as String,
        role = UserRole.values.firstWhere(
          (r) => r.name == json['role'],
          orElse: () => UserRole.reader,
        ),
        avatarUrl = json['avatar_url'] as String?,
        joinedAt = DateTime.parse(json['joined_at'] as String),
        maxBorrowLimit = json['max_borrow_limit'] as int? ?? 5;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'role': role.name,
        'avatar_url': avatarUrl,
        'joined_at': joinedAt.toIso8601String(),
        'max_borrow_limit': maxBorrowLimit,
      };

  User copyWith({
    String? name,
    String? email,
    UserRole? role,
    String? avatarUrl,
    int? maxBorrowLimit,
  }) {
    return User(
      id: id,
      name: name ?? this.name,
      email: email ?? this.email,
      role: role ?? this.role,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      joinedAt: joinedAt,
      maxBorrowLimit: maxBorrowLimit ?? this.maxBorrowLimit,
    );
  }

  @override
  String toString() => 'User(id: $id, name: $name, role: ${role.label})';
}
```

### 8.3 BorrowRecord（借阅记录）

```dart
// lib/models/borrow_record.dart

enum BorrowStatus {
  active(label: '借阅中'),
  returned(label: '已归还'),
  overdue(label: '逾期'),
  renewed(label: '已续借');

  final String label;
  const BorrowStatus({required this.label});
}

class BorrowRecord {
  final String id;
  final String bookId;
  final String userId;
  final DateTime borrowDate;
  final DateTime dueDate;
  final DateTime? returnDate;
  final BorrowStatus status;
  final int renewCount;
  final String? notes;

  const BorrowRecord({
    required this.id,
    required this.bookId,
    required this.userId,
    required this.borrowDate,
    required this.dueDate,
    this.returnDate,
    this.status = BorrowStatus.active,
    this.renewCount = 0,
    this.notes,
  });

  // 命名构造：创建新的借阅记录
  BorrowRecord.create({
    required String id,
    required String bookId,
    required String userId,
    int borrowDurationDays = 14,
  })  : id = id,
        bookId = bookId,
        userId = userId,
        borrowDate = DateTime.now(),
        dueDate = DateTime.now().add(Duration(days: borrowDurationDays)),
        returnDate = null,
        status = BorrowStatus.active,
        renewCount = 0,
        notes = null;

  // Getter
  bool get isOverdue =>
      status != BorrowStatus.returned && DateTime.now().isAfter(dueDate);

  // 归还
  BorrowRecord returnBook() => BorrowRecord(
        id: id,
        bookId: bookId,
        userId: userId,
        borrowDate: borrowDate,
        dueDate: dueDate,
        returnDate: DateTime.now(),
        status: BorrowStatus.returned,
        renewCount: renewCount,
        notes: notes,
      );

  // 续借
  BorrowRecord renew({int additionalDays = 14}) => BorrowRecord(
        id: id,
        bookId: bookId,
        userId: userId,
        borrowDate: borrowDate,
        dueDate: dueDate.add(Duration(days: additionalDays)),
        returnDate: returnDate,
        status: BorrowStatus.renewed,
        renewCount: renewCount + 1,
        notes: notes,
      );

  BorrowRecord.fromJson(Map<String, dynamic> json)
      : id = json['id'] as String,
        bookId = json['book_id'] as String,
        userId = json['user_id'] as String,
        borrowDate = DateTime.parse(json['borrow_date'] as String),
        dueDate = DateTime.parse(json['due_date'] as String),
        returnDate = json['return_date'] != null
            ? DateTime.parse(json['return_date'] as String)
            : null,
        status = BorrowStatus.values.firstWhere(
          (s) => s.name == json['status'],
          orElse: () => BorrowStatus.active,
        ),
        renewCount = json['renew_count'] as int? ?? 0,
        notes = json['notes'] as String?;

  Map<String, dynamic> toJson() => {
        'id': id,
        'book_id': bookId,
        'user_id': userId,
        'borrow_date': borrowDate.toIso8601String(),
        'due_date': dueDate.toIso8601String(),
        'return_date': returnDate?.toIso8601String(),
        'status': status.name,
        'renew_count': renewCount,
        'notes': notes,
      };

  @override
  String toString() =>
      'BorrowRecord(id: $id, book: $bookId, user: $userId, status: ${status.label})';
}
```

---

## 9. 常见错误与最佳实践

### 9.1 常见错误

```dart
// ❌ 错误 1：忘记声明返回类型
greet(name) => 'Hello, $name';           // 隐式 dynamic 返回
String greet(String name) => 'Hello, $name'; // ✅ 正确

// ❌ 错误 2：final 字段没有在构造中初始化
class Bad {
  final int x;           // ❌ 必须初始化——构造参数或默认值
  // Bad();              // 编译错误！
  Bad(this.x);           // ✅ 正确
}

// ❌ 错误 3：Mixin 中使用构造方法
mixin BadMixin {
  // BadMixin();         // ❌ Mixin 不能有构造方法！
}

// ❌ 错误 4：factory 里不能用 this（在 factory 执行时实例还不存在）
class Bad {
  factory Bad() {
    // this.x = 1;      // ❌ 错误！
    return Bad._internal();
  }
  Bad._internal();
}

// ❌ 错误 5：在 const 构造的类中使用非 final 字段
class Bad {
  int x;                 // ❌ 非 final——不能用于 const 构造
  // const Bad(this.x);  // 编译错误！
}
```

### 9.2 最佳实践

1. **模型类用 `const` 构造 + `copyWith` + `fromJson` + `toJson` 四件套**——这是 Flutter 模型类的标准模式
2. **优先 Mixin 而非继承**——Mixin 更灵活，不引入紧耦合的层级关系
3. **抽象类定义契约，Mixin 提供实现**——`abstract class` 描述"是什么"，`mixin` 描述"能做什么"
4. **增强枚举替代常量类**——`enum BookStatus` 比 `class BookStatusConstants` 更安全、更简洁
5. **扩展方法非侵入式增强**——给第三方库类型添加便捷方法时，用 extension 而不是 wrapper 类

---

## 10. 本章小结

| 你学到了什么 | 对标 TS 技能 | 在图书馆 App 中的体现 |
|-------------|-------------|---------------------|
| Dart 类定义 + Getter/Setter | TS class + get/set | Book/User/BorrowRecord 完整字段体系 |
| 四种构造方法 | TS constructor + 静态工厂 | fromJson 命名构造、factory 缓存 |
| 继承 + implements + Mixin | extends + implements + HOC | 未来章节的 Repository 抽象 |
| 增强枚举 | TS enum | BookCategory, UserRole, BorrowStatus |
| 泛型类 + 泛型约束 | TS generics + extends | Result<T>, Shelf<T> |
| 扩展方法 | TS Utility 函数 | 后续给 String/DateTime 加便捷方法 |

---

> **下一步**: [Chapter 04 — Dart 3 新特性与现代 Dart 工程化](./Chapter-04-Dart3新特性与工程化基础.md)
> **原始文档**: [dart.cn/language/classes](https://dart.cn/language/classes) | [dart.cn/language/constructors](https://dart.cn/language/constructors) | [dart.cn/language/extend](https://dart.cn/language/extend) | [dart.cn/language/mixins](https://dart.cn/language/mixins) | [dart.cn/language/enums](https://dart.cn/language/enums) | [dart.cn/language/generics](https://dart.cn/language/generics)
