> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 01 — 环境搭建与 Flutter 架构初探](./Chapter-01-环境搭建与Flutter架构初探.md)
> **下一章**: [Chapter 03 — Dart 核心语法速通（下）：面向对象与集合](./Chapter-03-Dart核心语法速通-下.md)
> **官方文档**: [dart.cn/language](https://dart.cn/language)

---

# 第 2 章：Dart 核心语法速通（上）— 变量、类型、函数、异步与控制流

> 如果你之前使用 TypeScript，可先浏览[附录 D](../../Appendix-D-TypeScript开发者Dart速查.md) 快速了解 Dart 与 TS 的差异。其他语言背景的读者请直接开始学习。

## 0. 本章目标

- 掌握 Dart 变量声明体系（`var` / `final` / `const` / `late`）
- 熟练使用 Dart 内置类型（`int` / `double` / `String` / `bool` / `List` / `Map`）
- 理解 Dart 函数的参数类型（必填 / 可选位置 / 命名 / 必填命名）
- 掌握 `async` / `await` 异步编程——Flutter 中最常用的模式
- 熟练使用控制流与异常处理

> 🎯 **本章产出**：在 `lib/utils/dart_syntax_practice.dart` 中完成所有语法练习，覆盖变量、类型、函数、异步、控制流和异常处理。

---

## 1. 变量声明体系

Dart 提供四种变量声明方式：

### 1.1 var — 类型推断

```dart
var name = 'Dart';        // 推断为 String，之后不可更改类型
var year = 2026;           // 推断为 int
var fruits = ['apple'];    // 推断为 List<String>

name = 'Flutter';          // ✅ 值可变（类型不变）
// name = 42;              // ❌ 编译错误：类型锁定后不可变更
```

### 1.2 final — 运行时常量

```dart
final now = DateTime.now();       // 运行时才能确定值，用 final
final name = fetchUserName();     // 引用不可变，但对象内容可修改

final List<String> tags = ['Flutter'];
tags.add('Dart');                 // ✅ 可以修改列表内容
// tags = ['other'];              // ❌ 引用本身不可重新赋值
```

`final` 是 Flutter 中最常用的声明——绝大多数 Widget 参数、局部变量都用 `final`。

### 1.3 const — 编译时常量

```dart
const pi = 3.14159;
const greeting = 'Hello';
const numbers = [1, 2, 3];        // 列表本身和内容都不可变

// numbers.add(4);                // ❌ 不可修改

// const 的核心价值：相同值的 const 在内存中只有一份
const a = [1, 2, 3];
const b = [1, 2, 3];
print(identical(a, b));           // true — 指向同一个对象

// ❌ 编译时不确定的值不能用 const
// const now = DateTime.now();    // 错误！now() 是运行时值
```

**Flutter 性能关键**：`const` Widget 在 rebuild 时会被完全跳过。大量使用 `const` 构造是 Flutter UI 优化的第一原则。

```dart
// ✅ 编译时确定，每次 build 复用同一个实例
const Padding(padding: EdgeInsets.all(16), child: Text('Hello'));
```

### 1.4 late — 延迟初始化

```dart
// 承诺在使用前初始化，绕过编译器的非空检查
late String apiKey;

void init() {
  apiKey = loadFromConfig();
}

void use() {
  init();
  print(apiKey.length);          // 使用前已赋值，OK
}

// late final — 首次访问时计算，之后不变
late final int result = expensiveComputation();
```

`late` 最常用于 Flutter 中——在 `initState` 中初始化，在 `build` 中使用：

```dart
late final TextEditingController _controller;

@override
void initState() {
  super.initState();
  _controller = TextEditingController();
}
```

### 1.5 选择指南

```
编译时已知且永远不变 → const
运行时确定但引用不变 → final
值内容会变化       → var
声明后某时初始化    → late
```

---

## 2. 内置类型

### 2.1 数字（int / double）

```dart
int count = 42;
double price = 19.99;
num total = count + price;        // num 是 int 和 double 的父类

// 字符串 ↔ 数字
int.parse('42');                   // 42
double.parse('3.14');              // 3.14
42.toString();                     // '42'
3.14159.toStringAsFixed(2);        // '3.14'

// Dart 3.x：数字下划线分隔
int million = 1_000_000;           // 更易读
```

### 2.2 String

```dart
String name = 'Flutter';

// 字符串模板
String greeting = 'Hello, $name!';
String info = 'Version: ${getVersion()}';  // {} 内可以是表达式

// 多行字符串
String multiline = '''
第一行
第二行
''';

// 原始字符串（不转义）
String path = r'C:\Users\admin\dev\flutter';

// 常用操作
'hello'.toUpperCase();             // 'HELLO'
'  trim  '.trim();                 // 'trim'
'Hello'.contains('ell');           // true
'a,b,c'.split(',');                // ['a', 'b', 'c']
```

### 2.3 bool 与条件判断

**Dart 没有 truthy/falsy——这是与 JS/Python 最大的区别之一：**

```dart
bool isValid = true;

// ❌ 非 bool 值不能用在条件中
// if (1) { ... }           // 编译错误！
// if ('hello') { ... }     // 编译错误！
// if ([]) { ... }          // 编译错误！

// ✅ 必须使用显式的 bool 表达式
if (list.isNotEmpty) { ... }
if (count > 0) { ... }
if (name != null) { ... }
```

### 2.4 List（数组）

```dart
var list = [1, 2, 3];                    // List<int>
var typed = <String>['a', 'b'];          // 显式泛型

// 常用操作
list.add(4);                              // [1, 2, 3, 4]
list.addAll([5, 6]);                      // [1, 2, 3, 4, 5, 6]
list.remove(3);                           // [1, 2, 4, 5, 6]

// 展开操作符
var combined = [...list, 7, 8, ...[9, 10]];

// 集合 if / 集合 for — 声明式构建列表
var hasHeader = true;
var items = [
  if (hasHeader) 'Header',
  for (var i = 0; i < 3; i++) 'Item $i',
  'Footer',
];

// 函数式操作（返回 Iterable，需要时 toList()）

var numbers = [3, 1, 4, 1, 5, 9, 2, 6];
var evens = numbers.where((n) => n.isEven).toList(); // [4, 2, 6]
var sorted = [...numbers]..sort();                    // 不修改原列表的排序
var mapped = numbers.map((n) => n * 2).toList();      // 每个 × 2
var first = numbers.firstWhere((n) => n > 5);         // 9
var hasLarge = numbers.any((n) => n > 8);             // true
```

### 2.5 Set（集合）

```dart
var genres = {'Fiction', 'Science', 'Fiction'}; // 自动去重：{'Fiction', 'Science'}
genres.add('History');
genres.contains('Fiction');                      // true

// 集合运算
var a = {1, 2, 3};
var b = {2, 3, 4};
a.intersection(b);                               // {2, 3}
a.union(b);                                      // {1, 2, 3, 4}
```

> ⚠️ `{}` 默认是 Map，需要显式声明为 Set：`var s = <String>{};`

### 2.6 Map（字典）

```dart
var map = {'name': 'Alice', 'age': 30};          // Map<String, Object>
var typed = <String, int>{'a': 1, 'b': 2};

// 操作
map['email'] = 'alice@example.com';              // 添加
var name = map['name'];                          // 读取（key 不存在返回 null）
map.remove('age');                               // 删除
map.containsKey('name');                         // true

// 遍历
map.forEach((key, value) => print('$key: $value'));
```

### 2.7 dynamic — 谨慎使用的逃生舱

```dart
dynamic anything = 'hello';
anything = 42;                     // 类型可以改变
anything.someMethod();             // 编译通过，运行时可能崩溃

// 优先使用具体类型。dynamic 仅在解析未知结构 JSON 等极少数场景使用。
```

> 📖 **延伸阅读**：[dart.cn/language/built-in-types](https://dart.cn/language/built-in-types)

---

## 3. 函数

### 3.1 基本函数定义

```dart
// 完整签名
String greet(String name, int age) {
  return 'Hello, $name! You are $age years old.';
}

// 箭头函数 — 仅单表达式可用
bool isEven(int n) => n % 2 == 0;
// 等价于 { return n % 2 == 0; }
```

### 3.2 四种参数类型

这是 Dart 函数设计中最具特色的部分：

```dart
// ① 必填位置参数 — 参数少（1-2 个）时使用
String fullName(String first, String last) => '$first $last';
fullName('Ada', 'Lovelace');

// ② 可选位置参数 — 用 [] 包裹
String greet(String from, String msg, [String? device, int? priority]) {
  var result = '$from says $msg';
  if (device != null) result += ' with $device';
  return result;
}
greet('Bob', 'Howdy');                     // 可省略后面几个
greet('Bob', 'Howdy', 'smoke signal');    // 按位置传可选参数

// ③ 可选命名参数 — 用 {} 包裹
void setFlags({bool? bold, bool? hidden}) { /* ... */ }
setFlags(bold: true, hidden: false);       // 调用时看到参数名，更清晰

// ④ 必填命名参数 — {} + required（Flutter 中最常用！）
void createUser({
  required String name,
  required String email,
  int? age,
  bool isAdmin = false,                    // 有默认值的可选参数
}) { /* ... */ }
createUser(name: 'Alice', email: 'alice@example.com', age: 30);
```

**Flutter Widget 的参数几乎全是必填命名参数模式。**

### 3.3 匿名函数与闭包

```dart
// 匿名函数——最常用于集合操作
var multiply = (int a, int b) => a * b;

[1, 2, 3, 4, 5]
  .where((n) => n > 3)           // 匿名函数传给 where
  .map((n) => n * 2);            // 匿名函数传给 map

// 闭包——捕获外部变量
Function makeAdder(int addBy) => (int i) => addBy + i;

var add2 = makeAdder(2);
print(add2(3));                    // 5
```

### 3.4 typedef — 函数类型别名

```dart
typedef IntOperation = int Function(int a, int b);

int add(int a, int b) => a + b;
int subtract(int a, int b) => a - b;

int compute(IntOperation op, int x, int y) => op(x, y);

print(compute(add, 10, 5));       // 15
```

---

## 4. 异步编程：Future 与 async/await

Flutter 中几乎所有与外界交互的操作都是异步的：网络请求、文件读写、数据库查询、计时器。async/await 是你每天都会用到的核心模式。

### 4.1 Future — 将来才有的值

```dart
// Future<T> 表示"将来某个时刻会返回 T 类型的值"
Future<String> fetchUserName() {
  // 模拟网络请求，2 秒后返回
  return Future.delayed(const Duration(seconds: 2), () => 'Alice');
}
```

### 4.2 async / await

```dart
// async — 声明函数包含异步操作
// await — 等待 Future 完成，取出结果
Future<void> loadUserData() async {
  print('加载中...');

  final name = await fetchUserName();    // 暂停，等结果返回
  final avatar = await fetchAvatar();    // 再等第二个结果

  print('用户名: $name, 头像: $avatar');
}

// 对比：不用 await 的写法（回调地狱）
// fetchUserName().then((name) {
//   fetchAvatar().then((avatar) {
//     print('$name, $avatar');
//   });
// });
```

### 4.3 并行等待 — Future.wait

```dart
Future<void> loadAllData() async {
  // 两个请求互不依赖，可以同时发起
  final results = await Future.wait([
    fetchUserName(),    // 同时启动
    fetchAvatar(),      // 同时启动
  ]);

  final name = results[0] as String;
  final avatar = results[1] as String;
  print('$name: $avatar');
}
```

### 4.4 异步错误处理

```dart
Future<void> safeLoad() async {
  try {
    final name = await fetchUserName();
    print('用户名: $name');
  } catch (e) {
    print('加载失败: $e');
  }
}
```

> 📖 **延伸阅读**：[dart.cn/language/async](https://dart.cn/language/async) | [dart.cn/libraries/async](https://dart.cn/libraries/async)

---

## 5. 控制流

### 5.1 if-else 与 switch

```dart
// if-else — 条件必须是 bool 表达式
if (score >= 90) {
  return 'A';
} else if (score >= 80) {
  return 'B';
} else {
  return 'C';
}

// Dart 3 switch 表达式 — 有返回值，编译器检查完备性
var feeling = switch (day) {
  'Monday' || 'Tuesday' || 'Wednesday' || 'Thursday' || 'Friday' => 'Working',
  'Saturday' || 'Sunday' => 'Relaxing',
  _ => 'Unknown',                    // _ 是通配符
};

// 传统 switch 语句仍然可用
switch (day) {
  case 'Monday':
    print('Start of week');
    break;                           // 需要 break
  case 'Saturday':
  case 'Sunday':                     // 多个 case 共享分支
    print('Weekend!');
    break;
  default:
    print('Midweek');
}
```

### 5.2 循环

```dart
// for
for (var i = 0; i < 5; i++) {
  print(i);
}

// for-in — 最常用于遍历集合
for (final fruit in ['apple', 'banana', 'orange']) {
  print(fruit);
}

// while / do-while — 和绝大多数语言一致
while (tokens.isNotEmpty) {
  process(tokens.removeLast());
}

// break — 跳出循环 / continue — 跳过本次迭代
```

`assert` 用于开发调试，仅在 Debug 模式生效：`assert(age >= 0, 'Age cannot be negative');`

> 📖 **延伸阅读**：[dart.cn/language/loops](https://dart.cn/language/loops) | [dart.cn/language/branches](https://dart.cn/language/branches)

---

## 6. 异常处理

### 6.1 抛出异常

```dart
throw FormatException('Invalid JSON');
throw ArgumentError('name cannot be empty');
throw StateError('Already initialized');
```

### 6.2 捕获异常

Dart 的 `on` 关键字可按异常类型精确捕获：

```dart
try {
  final result = await fetchData();
  processResult(result);
} on FormatException {
  // 只捕获 FormatException，不需要异常对象时省略 catch
  print('数据格式错误');
} on IOException catch (e) {
  // 捕获 IOException 同时获取异常对象
  print('IO 错误: $e');
} catch (e, stackTrace) {
  // 捕获所有其他异常
  print('未知错误: $e');
  print(stackTrace);          // 调试时打印堆栈
} finally {
  // 无论是否有异常都会执行——用于清理资源
  closeResources();
}
```

### 6.3 rethrow — 重新抛出

```dart
try {
  await riskyOperation();
} catch (e) {
  logError(e);
  rethrow;           // ✅ 重新抛出，保留原始堆栈
  // throw e;        // ❌ 丢失原始堆栈
}
```

> 📖 **延伸阅读**：[dart.cn/language/error-handling](https://dart.cn/language/error-handling)

---

## 7. 图书馆 App 实战：Dart 语法练习

在 `lib/utils/` 下创建 `dart_syntax_practice.dart`，用 `dart run` 独立验证本章所有语法点。

```dart
// lib/utils/dart_syntax_practice.dart
// 运行：dart run lib/utils/dart_syntax_practice.dart

import 'dart:convert';
import 'dart:math';

// ──── 1. 变量声明 ────
void practiceVariables() {
  print('\n=== 1. 变量声明 ===');

  var title = 'Library System';
  var version = 1;
  print('$title v$version');

  final now = DateTime.now();
  final random = Random().nextInt(100);
  print('Generated at $now, random seed: $random');

  const categories = ['Fiction', 'Science', 'History'];
  print('Categories: $categories');

  late String config;
  config = 'loaded';
  print('Config: $config');

  print('✅ Variables done');
}

// ──── 2. 内置类型 ────
void practiceTypes() {
  print('\n=== 2. 内置类型 ===');

  int bookCount = 1523;
  double avgRating = 4.7;
  print('Books: $bookCount, Avg: $avgRating');

  String query = 'Search: "Clean Code"';
  print('${query.toUpperCase()} — contains "Clean": ${query.contains('Clean')}');

  List<String> authors = ['Martin', 'Fowler', 'Gamma'];
  authors.add('Beck');
  var longNames = authors.where((a) => a.length > 5).toList();
  print('Long names: $longNames');

  var genres = {'Fiction', 'Science', 'Fiction'};
  print('Genres (deduplicated): $genres');

  var isbnMap = {'Clean Code': '978-0132350884', 'Refactoring': '978-0201485677'};
  print('ISBN: ${isbnMap['Clean Code']}');

  // Dart 没有 truthy/falsy！
  bool hasBooks = bookCount > 0;
  if (hasBooks) print('Library has books ✓');

  print('✅ Types done');
}

// ──── 3. 函数 ────
String formatBook(String title, String author) => '$title by $author';

String createEntry(String title, [String? subtitle, int? edition]) {
  var entry = title;
  if (subtitle != null) entry += ': $subtitle';
  if (edition != null) entry += ' ($edition ed.)';
  return entry;
}

// 命名参数模式——Flutter 中最常用
BookInfo createBookInfo({
  required String title,
  required String author,
  int? year,
  List<String> tags = const [],
}) {
  return BookInfo(title: title, author: author, year: year, tags: tags);
}

class BookInfo {
  final String title;
  final String author;
  final int? year;
  final List<String> tags;
  const BookInfo({required this.title, required this.author, this.year, this.tags = const []});
  @override
  String toString() => 'BookInfo(title: $title, author: $author, year: $year, tags: $tags)';
}

typedef StringValidator = String? Function(String value);

void practiceFunctions() {
  print('\n=== 3. 函数 ===');

  print(formatBook('Design Patterns', 'GoF'));
  print(createEntry('Clean Code', 'A Handbook', 1));
  print(createEntry('Refactoring'));

  final info = createBookInfo(title: 'Effective Dart', author: 'Dart Team', year: 2026);
  print(info);

  StringValidator notEmpty = (s) => s.isEmpty ? 'Cannot be empty' : null;
  print(notEmpty('Dart') ?? 'Validation passed');

  // 闭包
  Function counter() {
    var count = 0;
    return () => ++count;
  }
  var next = counter();
  print('Count: ${next()}, ${next()}');

  print('✅ Functions done');
}

// ──── 4. 异步编程 ────
Future<String> fetchBookTitle() async {
  // 模拟网络请求
  await Future.delayed(const Duration(milliseconds: 500));
  return 'Clean Code';
}

Future<void> practiceAsync() async {
  print('\n=== 4. 异步编程 ===');

  print('加载中...');
  final title = await fetchBookTitle();
  print('获取到: $title');

  // 并行等待
  final results = await Future.wait([
    Future.delayed(const Duration(milliseconds: 200), () => 'Result 1'),
    Future.delayed(const Duration(milliseconds: 100), () => 'Result 2'),
  ]);
  print('并行结果: $results');

  // 错误处理
  try {
    await Future.delayed(const Duration(milliseconds: 100), () => throw Exception('网络错误'));
  } catch (e) {
    print('捕获错误: $e');
  }

  print('✅ Async done');
}

// ──── 5. 控制流 ────
void practiceControlFlow() {
  print('\n=== 5. 控制流 ===');

  var stock = 3;
  if (stock == 0) {
    print('缺货');
  } else if (stock < 5) {
    print('库存不足: $stock 本');
  } else {
    print('库存充足: $stock 本');
  }

  // switch 表达式
  var day = 'Monday';
  var mood = switch (day) {
    'Monday' => '需要咖啡',
    'Friday' => '快周末了',
    'Saturday' || 'Sunday' => '周末!',
    _ => '搬砖中',
  };
  print(mood);

  var sum = 0;
  for (var i = 1; i <= 10; i++) sum += i;
  print('Sum 1-10: $sum');

  for (final t in ['Clean Code', 'Refactoring', 'Design Patterns']) {
    print('  📖 $t');
  }

  print('✅ Control flow done');
}

// ──── 6. 异常处理 ────
class LibraryException implements Exception {
  final String message;
  const LibraryException(this.message);
  @override
  String toString() => 'LibraryException: $message';
}

void borrowBook(String isbn) {
  if (isbn.isEmpty) throw LibraryException('ISBN cannot be empty');
  print('借阅成功: $isbn');
}

void practiceErrorHandling() {
  print('\n=== 6. 异常处理 ===');

  try {
    borrowBook('');
  } on LibraryException {
    print('图书馆业务异常');
  } on FormatException catch (e) {
    print('格式错误: $e');
  } catch (e, stackTrace) {
    print('未知错误: $e');
  } finally {
    print('借阅操作结束');
  }

  try {
    borrowBook('978-0132350884');
  } catch (e) {
    print('Error: $e');
  }

  print('✅ Error handling done');
}

void main() async {
  practiceVariables();
  practiceTypes();
  practiceFunctions();
  await practiceAsync();           // async 函数需要 await
  practiceControlFlow();
  practiceErrorHandling();

  print('\n🎉 所有 Dart 语法练习完成！');
}
```

运行验证：

```bash
dart run lib/utils/dart_syntax_practice.dart
```

每个小节打印 `✅ ... done` 说明该部分语法已掌握。

---

## 8. 常见错误与最佳实践

### 常见错误

```dart
// ❌ 以为 Dart 有 truthy/falsy
var list = <String>[];
// if (list) { ... }            // 编译错误！
if (list.isNotEmpty) { ... }     // ✅

// ❌ var 类型锁定后赋值不同类型
var x = 1;
// x = 'hello';                  // 编译错误
dynamic y = 1;
y = 'hello';                     // ✅ 但尽量避免 dynamic

// ❌ {} 默认是 Map
var map = {};                    // Map<dynamic, dynamic>
var set = <String>{};            // Set<String>

// ❌ throw e 而不是 rethrow
try { ... } catch (e) {
  log(e);
  throw e;                       // ❌ 丢失原始堆栈
}
try { ... } catch (e) {
  log(e);
  rethrow;                       // ✅ 保留原始堆栈
}

// ❌ 忘记 await
Future<void> bad() {
  fetchUserName();               // 没有 await！Future 被忽略
}
Future<void> good() async {
  await fetchUserName();         // ✅
}
```

### 最佳实践

1. **优先 final，其次 var**：`final` 是 Flutter 中最常用的——参数、局部变量、类字段几乎都用 `final`
2. **Widget 构造参数全部用命名参数**：`const BookCard({required this.title})` 是 Flutter 社区主流风格
3. **异步操作必须处理错误**：每个 `await` 都应该有配套的 `try-catch`
4. **集合操作尽量用方法链**：`list.where(...).map(...).toList()` 一气呵成

---

## 9. 本章小结

| 你学到了什么 | 在图书馆 App 中的体现 |
|-------------|---------------------|
| var/final/const/late 四件套 | 练习脚本中声明所有数据 |
| 内置类型（int/double/String/bool/List/Set/Map） | 图书馆数据建模基础 |
| 四种函数参数类型 + typedef | 图书格式化函数、验证器 |
| async/await 异步编程 | 模拟网络请求加载图书 |
| switch 表达式 + 控制流 | 借阅状态判断、库存统计 |
| 异常处理 on-catch-finally-rethrow | 借阅操作的错误处理 |

---

> **下一步**: [Chapter 03 — Dart 核心语法速通（下）：面向对象与集合](./Chapter-03-Dart核心语法速通-下.md)
