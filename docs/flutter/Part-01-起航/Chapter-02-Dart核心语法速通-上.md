> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 01 — 环境搭建与 Flutter 架构初探](./Chapter-01-环境搭建与Flutter架构初探.md)
> **下一章**: [Chapter 04 — Dart 核心语法速通（下）：面向对象与集合](./Chapter-04-Dart核心语法速通-下.md)
> **官方文档**: [dart.cn/language](https://dart.cn/language)

---

# 第 2 章：Dart 核心语法速通（上）— 变量、类型、函数、异步与控制流

> 如果你之前使用 TypeScript，可先浏览[附录 D](../../Appendix-D-TypeScript开发者Dart速查.md) 快速了解 Dart 与 TS 的差异。其他语言背景的读者请直接开始学习。

## 0. 本章目标与写代码前的准备

在写第一行 Dart 代码之前，你需要先了解几个最基本的规则。花 3 分钟读完，后面所有代码你就能看懂了。

### 0.1 Dart 代码的基本规则

**① 类型写在前面，变量名写在后面**

Dart 是强类型语言，这一点和 Java、Go、Swift、C# 一样：

```
TypeScript:  let name: string = 'Dart';    // 类型在变量名后面，用冒号隔开
Dart:        String name = 'Dart';          // 类型在变量名前面，用空格隔开
Java:        String name = "Dart";          // 同样：类型在前
Go:          var name string = "Dart"       // Go 的类型也在后面（但写法不同）
```

> 如果你来自 Java/Kotlin/Swift 等语言，Dart 的类型声明方式你非常熟悉。如果你来自 TypeScript，最重要的是**把类型从冒号后面移到变量名前面，去掉冒号**。

**② 每行语句以分号结尾**（和 Java/JS/C 一样，和 Python/Kotlin 不同）

**③ `print()` 是 Dart 内置的打印函数**，作用是把内容输出到控制台（终端窗口）。这一章我们会大量使用它来查看变量的值：
```dart
print('Hello Dart');   // 控制台中看到：Hello Dart
print(42);             // 控制台中看到：42
```

**④ `void main() { }` 是程序的入口**——Dart 从这里开始执行你的代码。每个 `.dart` 文件都可以有自己的 `main()` 函数。

**⑤ `import` 语句用来引入其他库的代码**。Dart 自带一套标准库，以 `dart:` 开头：
- `dart:core` — 最基础的功能（**自动引入，不需要写 import**）。`String`、`int`、`List`、`print()`、`DateTime` 都来自这里
- `dart:math` — 数学工具，比如生成随机数的 `Random` 类
- `dart:convert` — 数据格式转换，比如 JSON 编解码

```dart
import 'dart:math';     // 引入数学库，之后就能使用 Random()
// DateTime 不需要 import，它来自 dart:core（自动引入）
final now = DateTime.now();
```

> 简单说：`dart:core` 像手机的内置 App（开机就有），`dart:math` 和 `dart:convert` 像需要手动下载的 App（需要 `import` 才能用）。

**⑥ Dart 文件以 `.dart` 为扩展名**，用 `dart run 文件名.dart` 命令运行。

---

### 本章目标

- 掌握 Dart 变量声明体系（`var` / `final` / `const` / `late`）
- 熟练使用 Dart 内置类型（`int` / `double` / `String` / `bool` / `List` / `Map`）
- 理解 Dart 函数的参数类型（必填 / 可选位置 / 命名 / 必填命名）
- 掌握 `async` / `await` 异步编程——Flutter 中最常用的模式
- 熟练使用控制流与异常处理

> 🎯 **本章产出**：在 `lib/utils/dart_syntax_practice.dart` 中完成所有语法练习。

---

## 1. 变量声明体系

Dart 提供四种变量声明方式：

### 1.1 var — 类型推断

```dart
var name = 'Dart';        // 编译器看到右边的 'Dart' 是字符串，自动推断 name 为 String
var year = 2026;           // 推断为 int
var fruits = ['apple'];    // 推断为 List<String>

name = 'Flutter';          // ✅ 值可变（类型不变）
// name = 42;              // ❌ 编译错误：Dart 是静态类型语言，变量类型编译时确定后就永远不变
```

> 编译器如何"推断"？
>
> 就像你看到有人手里拿着篮球，推断他可能在打篮球。
>
> 编译器看到 `'Dart'` 就知道这是字符串，所以 `name` 就是 String。
>
> 类型一旦确定，就像出生证明上的性别——之后绝不能改。

### 1.2 final — 运行时常量

```dart
// DateTime 来自 dart:core（自动引入），now() 返回"此刻"的时间
// 因为每次运行 App 时"此刻"都不同，所以只能在运行时确定值
final now = DateTime.now();
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
print(identical(a, b));           // true — a 和 b 指向内存中同一个对象！
// identical(x, y) 是 Dart 内置函数，判断两个变量是否指向同一个内存位置（类似 JS 的 Object.is）

// ❌ 编译时不确定的值不能用 const
// const now = DateTime.now();    // 错误！now() 是运行时值
```

**`const` 在 Flutter 中的工程价值**：当你学到 Flutter Widget 时，`const` Widget 在页面重建时会被完全跳过——因为 Framework 知道它的所有属性都不会变。大量使用 `const` 是 Flutter 性能优化的第一原则。（Widget 和 const 构造的结合会在 Part-02 详解。）

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

`late` 的一个常见场景是**延迟计算**——不希望在声明变量时就执行昂贵的计算：

```dart
// 模拟一个耗时的配置加载
String _loadAppConfig() {
  print('正在从文件读取配置...');
  return 'loaded';
}

late final String config = _loadAppConfig();

void main() {
  print('程序启动');
  print(config);  // 第一次访问 config 时才执行 _loadAppConfig()
  print(config);  // 第二次访问直接返回缓存值，不会重新加载
  // 输出顺序：程序启动 → 正在从文件读取配置... → loaded → loaded
}
```

> `late` 在 Flutter 中还会用于 Widget 级别的延迟初始化（如 `TextEditingController`），那会在 Part-02 中讲到。

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
// num 是一种通用的数字类型，既可以存整数也可以存小数
// （严格来说 num 是 int 和 double 共同的"祖先类型"，但这个概念到 Ch04 学了类之后再理解）
num total = count + price;        // int + double → 自动升级为 num

// 字符串 ↔ 数字
int.parse('42');                   // 42
double.parse('3.14');              // 3.14
42.toString();                     // '42'（在 Dart 中一切都是对象，数字 42 也是对象，所以可以调用方法）
3.14159.toStringAsFixed(2);        // '3.14'

// Dart 3.x：数字下划线分隔
int million = 1_000_000;           // 更易读
```

### 2.2 String

```dart
String name = 'Flutter';

// 字符串插值（String Interpolation）——在字符串中嵌入变量或表达式的值
// $变量名  →  把变量的值放入字符串
// ${表达式} → 把表达式的结果放入字符串（表达式复杂时用花括号包裹）
String greeting = 'Hello, $name!';           // 变量 name 的值会替换 $name → "Hello, Flutter!"
int a = 10, b = 20;
String math = '$a + $b = ${a + b}';          // → "10 + 20 = 30"
//            ↑ 简单变量用 $变量名   ↑ 表达式用 ${ }

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

**Dart 的条件判断必须是 `bool` 类型——这是与 JS/Python 最大的区别之一：**

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

> 有些语言中 `if (1)`、`if ('hello')` 可以运行（因为它们把非零值/非空字符串当作 `true`），Dart 不允许这种做法——`if` 的括号里必须是明确的 `true` 或 `false`。

### 2.4 List（列表，即其他语言中的"数组"）

> `List` 就是你在其他语言里叫"数组（Array）"的东西——Java 的 `ArrayList`、TS/JS 的 `Array`、Python 的 `list`，在 Dart 里统一叫 `List`。

```dart
var list = [1, 2, 3];                    // 类型推断为 List<int>
// <String> 是泛型标注——"这个列表只能放字符串"
var typed = <String>['a', 'b'];          // 尖括号里的类型约束了列表能装什么

// 常用操作
list.add(4);                              // [1, 2, 3, 4]
list.addAll([5, 6]);                      // [1, 2, 3, 4, 5, 6]
list.remove(3);                           // [1, 2, 4, 5, 6]

// `...` 展开操作符 — 把列表"拆开"成独立元素，放入新列表
var combined = [...list, 7, 8, ...[9, 10]];  // [1,2,3,4,5,6,7,8,9,10]

// 集合 if / 集合 for — 声明式构建列表（在列表字面量中直接写条件和循环）
var hasHeader = true;
var items = [
  if (hasHeader) 'Header',
  for (var i = 0; i < 3; i++) 'Item $i',
  'Footer',
];

// 函数式操作
// where/map/firstWhere 返回 Iterable——一种"还没真正计算的懒序列"
// 调用 .toList() 后才真正执行计算，把结果存入内存
var numbers = [3, 1, 4, 1, 5, 9, 2, 6];
var evens = numbers.where((n) => n.isEven).toList(); // [4, 2, 6]
// `..` 是级联操作符——"先对前面的对象执行方法，然后返回对象本身"
// [...numbers]..sort() = 复制一份 → 对复制品原地排序 → 返回排序好的复制品
var sorted = [...numbers]..sort();                    // [1, 1, 2, 3, 4, 5, 6, 9]
var mapped = numbers.map((n) => n * 2).toList();      // [2, 4, 8, 2, 10, 18, 4, 12]
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

// Dart 的 => 是"单表达式函数体"的简写——等价于 { return 表达式; }
bool isEven(int n) => n % 2 == 0;
```

> 注意：Dart 的 `=>` 和 JS 的箭头函数不同。Dart 的 `=>` 只能用于函数体是单个表达式的情况，它仅仅是 `{ return ...; }` 的语法糖——不创建闭包、不改 `this`。

### 3.2 四种参数类型

这是 Dart 函数设计中最具特色的部分：

```dart
// ① 必填位置参数 — 参数少（1-2 个）时使用
String fullName(String first, String last) => '$first $last';
fullName('Ada', 'Lovelace');

// ② 可选位置参数 — 用 [] 包裹
//    类型后面的 ? 表示这个参数可以为 null（不传时默认就是 null）
//    空安全（Null Safety）的完整讲解在 Ch05，这里先记住语法即可
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

**Flutter Widget 的参数几乎全是必填命名参数模式。** 你会在 Part-02 大量见到这种写法。

### 3.3 匿名函数与闭包

```dart
// 匿名函数——最常用于集合操作
var multiply = (int a, int b) => a * b;

[1, 2, 3, 4, 5]
  .where((n) => n > 3)           // 匿名函数传给 where
  .map((n) => n * 2);            // 匿名函数传给 map

// 闭包——捕获外部变量
// Function 是 Dart 的内置类型，表示"一个函数"（就像 String 表示"一个字符串"）
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
// Future<void> 表示"将来会完成但不产生有意义结果的异步操作"
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

  // as 是类型转换操作符，告诉编译器"我确定这个值是 String 类型"
  // Future.wait 返回 List<dynamic>（因为等待的 Future 可能不同类型），取出后需要 as 转换
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

> `assert` 用于开发调试，仅在 Debug 模式生效：`assert(age >= 0, 'Age cannot be negative');`

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

// dart:math 提供 Random 随机数生成器
// dart:convert 提供 JSON 编解码函数
// dart:core 自动引入，不需要写 import
import 'dart:math';

// ──── 1. 变量声明 ────
void practiceVariables() {
  print('\n=== 1. 变量声明 ===');

  var title = 'Library System';
  var version = 1;
  print('$title v$version');

  // DateTime 来自 dart:core（自动引入），now() 返回当前时刻
  final now = DateTime.now();
  // Random 来自 dart:math（需手动 import），nextInt(100) 生成 0~99 的随机数
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

  // Dart 的 if 条件必须是 bool 表达式
  bool hasBooks = bookCount > 0;
  if (hasBooks) print('Library has books');

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

// 返回一个 Map 来表示图书信息（类的用法在 Ch04 才讲）
Map<String, dynamic> createBookInfo({
  required String title,
  required String author,
  int? year,
}) {
  return {'title': title, 'author': author, 'year': year};
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
  final result = notEmpty('Dart');
  if (result != null) {
    print(result);
  } else {
    print('Validation passed');
  }

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
// 自定义异常：定义一个类，用 implements Exception 声明它实现了 Exception 接口
// （class 和 implements 会在 Ch04 详解，这里先照写即可）
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

## 10. 本章练习

1. **用 Dart 建模图书馆数据**：在 `lib/utils/dart_syntax_practice.dart` 中，用 `Map<String, dynamic>` 创建 3 条图书记录（包含 `title`、`author`、`year`、`isBorrowed` 字段）。用 `List<Map<String, dynamic>>` 存储所有记录。实现两个函数：`getAvailableBooks(List<Map<String, dynamic>> books)` 用 `where` 过滤出 `isBorrowed == false` 的图书；`getBookSummaries(List<Map<String, dynamic>> books)` 用 `map` 将每条记录转换为 `"《${title}》by ${author} (${year})"` 格式的字符串列表。使用 `const` 定义借阅期限常量 `borrowDays = 14`。

   验证：打印 `getAvailableBooks` 结果，确认只包含未借出的图书；打印 `getBookSummaries` 结果，确认格式为 "《书名》by 作者 (年份)"。

2. **异步加载 + 异常处理**：在 `dart_syntax_practice.dart` 中，用 `Future.delayed` 模拟 `fetchBookInfo(String bookId)` 函数（延迟 1 秒后返回图书信息）。实现 `safeLoadBook(String bookId)` 函数：调用 `fetchBookInfo`，用 `try-catch` 捕获所有异常并返回默认图书信息；如果 `bookId` 为空字符串，用 `throw FormatException('bookId 不能为空')` 抛出异常。使用 `async/await` 语法。

   验证：传入有效 bookId 能在 1 秒后获取到图书信息；传入空字符串抛出 `FormatException`；mock 网络异常时 catch 生效返回默认值。

3. **控制流实现借阅状态判断**：实现 `getBorrowStatus(int daysUntilDue)` 函数，使用 `switch` 表达式（非 `switch` 语句）返回中文状态字符串：`<= 0` → "已逾期"；`== 1` → "明天到期"；`<= 3` → "即将到期（N天）"；`>= 14` → "刚刚借阅"；`_` → "借阅中"。再实现 `batchUpdateStatus(List<int> daysList)` 用 for 循环 + 展开运算符（`...`）批量调用 `getBorrowStatus` 并返回结果列表。

   验证：传入 `[0, 1, 2, 5, 14]` 得到 `["已逾期", "明天到期", "即将到期（2天）", "借阅中", "刚刚借阅"]`。

---

> **下一步**: [Chapter 03 — Dart 核心语法速通（下）：面向对象与集合](./Chapter-03-Dart核心语法速通-下.md)
