> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 01 — 环境搭建与 Flutter 架构初探](./Chapter-01-环境搭建与Flutter架构初探.md)
> **下一章**: [Chapter 03 — Dart 核心语法速通（下）：面向对象与集合](./Chapter-03-Dart核心语法速通-下.md)
> **官方文档**: [dart.cn/language/variables](https://dart.cn/language/variables) | [dart.cn/language/built-in-types](https://dart.cn/language/built-in-types) | [dart.cn/language/functions](https://dart.cn/language/functions) | [dart.cn/language/loops](https://dart.cn/language/loops) | [dart.cn/language/branches](https://dart.cn/language/branches) | [dart.cn/language/error-handling](https://dart.cn/language/error-handling)

---

# 第 2 章：Dart 核心语法速通（上）— 变量、类型、函数、控制流

## 0. 本章目标与前置依赖

**前置依赖**：已安装 Flutter SDK（Chapter 1），了解 Dart 文件可独立运行（不需要 Flutter 环境也能执行 `dart run`）。

**本章目标**：
- 掌握 Dart 变量声明体系（var / final / const / late）并能与 TS let / const 互译
- 熟练使用 Dart 内置类型（int / double / String / bool / List / Set / Map），理解与 TS 类型的差异
- 理解 Dart 函数的四种参数类型（必填/可选位置/命名/默认值）及与 TS 的对照
- 掌握箭头函数、匿名函数、闭包、typedef
- 熟练使用控制流（if-else / switch / for / while / break / continue）
- 掌握 Dart 异常处理机制（try-catch-on-finally / throw / rethrow）

> 🎯 **本章会在图书馆 App 中做什么**：在 `lib/utils/` 下创建 Dart 语法练习脚本 `dart_syntax_practice.dart`，覆盖本章所有语法点——确保在进入 Widget 编程之前，Dart 基本功扎实。

---

## 1. TypeScript 类比速查总表

在深入学习之前，先建立全局对照关系。以下映射覆盖本章所有主题：

| 概念 | Dart | TypeScript | 关键差异 |
|------|------|-----------|---------|
| 类型推断变量 | `var x = 1;` | `let x = 1;` | Dart `var` 一旦推断出类型就不能再改类型 |
| 运行时常量 | `final x = DateTime.now();` | `const x = getNow();` | 相似——引用不可变，但对象内容不一定 |
| 编译时常量 | `const x = 3.14;` | `const x = 3.14 as const;` | Dart `const` 是**完全不可变**（递归不可变） |
| 延迟初始化 | `late String x;` | `let x!: string;` | 相似——承诺稍后初始化 |
| 可空类型 | `String? x;` | `string \| null` | Dart 强制空安全检查 |
| 动态类型 | `dynamic x;` | `any` | 都逃逸类型检查，谨慎使用 |
| 整数 | `int x = 42;` | `number` | Dart 整数和浮点分开（`int` / `double` 都继承 `num`） |
| 字符串 | `String s = 'hello';` | `string` | 都支持单引号/双引号/模板字符串 |
| 列表 | `List<int> list = [1,2,3];` | `number[]` | Dart 泛型写在 `<>`，TS 写在 `[]` 或 `<>` |
| Map | `Map<String, int> m = {};` | `Record<string, number>` | Dart 字面量用 `{}`，用 `:` 分隔键值 |
| 箭头函数 | `() => expr;` | `() => expr` | 都只能单行表达式 |
| 命名参数 | `fn({required String name})` | `fn({name}: {name: string})` | Dart 命名参数用 `{}` 包裹，`required` 强制必填 |
| Future | `Future<T>` | `Promise<T>` | 语义几乎相同，下一章详解 |
| 异常 | `try {} on X catch (e) {}` | `try {} catch (e) {}` | Dart 区分 `on`（按类型捕获）和 `catch`（获取异常对象） |

---

## 2. 变量声明体系

Dart 提供了四种变量声明方式，每种都有自己的适用场景。这比 TS 的 `let` / `const` 二分法更丰富。

### 2.1 var — 类型推断

```dart
// var — 类似 TS let：类型推断，推断后类型锁定
var name = 'Dart';        // 推断为 String
var year = 2026;           // 推断为 int
var fruits = ['apple'];    // 推断为 List<String>

// ❌ 错误：var 变量类型一旦推断就不能改变
// name = 42;              // A value of type 'int' can't be assigned to type 'String'

// ✅ 值可以改变（只要类型不变）
name = 'Flutter';          // OK

// 对比 TS：
// let name = 'Dart';     // TS 中可以写 let name: string | number = 'Dart'
// name = 42;              // TS 中只要联合类型包含就能赋值
// Dart 的 var 比 TS 的 let 更严格——不允许类型变更。
```

> **TS 经验**：Dart 的 `var` 更像 TS 中在不指定联合类型时的 `let`——推断后锁定类型。如果你需要像 TS `any` 那样的动态类型，用 `dynamic`。

### 2.2 final — 运行时常量

```dart
// final — 类似 TS const：引用不可变，值运行时确定
final now = DateTime.now();      // 编译时不知道值，运行时才知道
final name = getNameFromAPI();   // 运行时从API获取

// ❌ 不能重新赋值
// now = DateTime.now();         // The final variable 'now' can only be set once.

// ⚠️ 重要差异：final 的对象内容是可以修改的！
final List<String> tags = ['Flutter', 'Dart'];
tags.add('Riverpod');            // ✅ OK！final 只锁定引用，不锁定内容
print(tags); // [Flutter, Dart, Riverpod]

// 对比 TS：
// const tags = ['Flutter', 'Dart'];
// tags.push('Riverpod');        // TS 中也可以——const 只锁定绑定
```

> **TS 经验**：`final` ≈ TS 的 `const`——引用不可变，但对象/列表/Map 的内部仍可修改。

### 2.3 const — 编译时常量

```dart
// const — 比 TS const 更强：对象完全不可变（编译时常量）
const pi = 3.14159;
const greeting = 'Hello';
const numbers = [1, 2, 3];       // const 列表——列表本身和内容都不可变

// ❌ 编译时不确定的值不能用 const
// const now = DateTime.now();   // const 要求编译时已知

// ❌ const 变量和内容都不可变
// numbers.add(4);               // Unsupported operation

// ✅ const 的值可以被复用（同一个 const 对象在内存中只存在一份）
const a = [1, 2, 3];
const b = [1, 2, 3];
print(identical(a, b));          // true — a 和 b 指向同一个内存对象！

// 对比 TS：
// const nums = [1, 2, 3] as const;
// nums.push(4);                 // TS 错误：readonly
// Dart 的 const 是递归不可变，类似 Object.freeze() 深度冻结后的值。
```

**const 的工程级价值**：在 Flutter 中，`const` Widget 在 rebuild 时会被 Flutter 完全跳过——因为它的所有属性在编译时就已知且不可变。大量使用 `const` 是 Flutter UI 性能优化的第一原则。

```dart
// Flutter 中的 const 优化：
// ❌ 每次 build 都创建新的 Padding 对象
Padding(padding: EdgeInsets.all(16), child: Text('Hello'));

// ✅ 编译时确定，重建时复用同一个对象
const Padding(padding: EdgeInsets.all(16), child: Text('Hello'));
```

### 2.4 late — 延迟初始化

```dart
// late — 类似 TS definite assignment assertion (!)
// 承诺变量在使用前会被初始化，绕过编译器的非空检查
late String apiKey;

void initialize() {
  apiKey = loadApiKeyFromConfig(); // 稍后赋值
}

void makeRequest() {
  initialize();
  print(apiKey.length);            // 使用前已赋值，OK
}

// ❌ 如果在赋值前就使用，运行时抛出 LateInitializationError
// late String bad;
// print(bad);                     // LateInitializationError

// late + final — 一次性延迟赋值（赋值后不可再改）
late final int userId = generateUserId(); // 首次使用时计算，之后不变

// 对比 TS：
// let apiKey!: string;            // TS definite assignment assertion
```

`late` 的典型使用场景：

| 场景 | 示例 |
|------|------|
| 依赖注入 | `late final ApiClient api;` — 在 setUp 中初始化 |
| 延迟计算 | `late final _data = _expensiveComputation();` — 首次访问时才计算 |
| Flutter Widget 属性 | `late final TextEditingController _controller;` — 在 `initState` 中初始化 |

### 2.5 变量声明选择指南

```
值在编译时就知道且永远不变？     → const
值在运行时确定但引用不变？       → final
值类型确定但内容会变？           → var
值类型不确定或需要动态类型？     → dynamic（谨慎）或 Object
值在声明后某时刻才初始化？       → late
```

---

## 3. 内置类型

### 3.1 数字：int 和 double

```dart
// Dart 区分整数和浮点——与 TS 的 number 不同
int count = 42;                  // 平台相关：native 上 64-bit，Web 上 JS Number
double price = 19.99;            // 64-bit 浮点
num total = count + price;       // num 是 int 和 double 的父类

// 字符串 ↔ 数字 转换
int parsed = int.parse('42');
double parsedDouble = double.parse('3.14');
String intStr = 42.toString();
String piStr = 3.14159.toStringAsFixed(2);  // "3.14"

// Dart 3.x 新增：数字字面量中的下划线分隔
int million = 1_000_000;         // 1000000，更易读
double hexPi = 0x1.921fb54442d18p1;  // 十六进制浮点（Dart 3.x+）

// 对比 TS：TS 的 number 统一表示整数和浮点（都是 IEEE 754 双精度）
// Dart 在原生平台上 int 是真正的 64-bit 整数，无浮点精度损失
```

### 3.2 String

```dart
// 单引号或双引号均可（官方风格指南建议双引号用于嵌套场景）
String s1 = 'Hello';
String s2 = "World";

// 模板字符串——类似 TS 的模板字面量 `${}`
String name = 'Flutter';
String greeting = 'Hello, $name!';
String version = 'Dart version: ${getDartVersion()}';  // {} 中可以是表达式

// 多行字符串
String multiline = '''
这是第一行
这是第二行
''';

// 原始字符串（不转义）
String path = r'C:\Users\admin\dev\flutter';  // \n \t 等不会被转义

String regex = r'\d+\.\d+';                   // 正则表达式不需要双重转义

// 字符串操作
'hello'.toUpperCase();          // 'HELLO'
'  trim me  '.trim();           // 'trim me'
'Hello'.contains('ell');        // true
'Dart'.startsWith('Da');        // true
'a,b,c'.split(',');             // ['a', 'b', 'c']
'abc'.padLeft(5, '0');          // '00abc'
```

> **TS 经验**：Dart 的字符串模板与 TS 完全一致——`$var` / `${expression}`。注意 Dart 不用反引号，用单引号或双引号。

### 3.3 bool

```dart
// Dart bool 只有 true 和 false——没有 truthy/falsy！
bool isValid = true;

// ❌ Dart 中非 bool 值不能用于条件判断（与 JS/TS 完全不同！）
// if (1) { ... }              // 编译错误！条件必须是 bool
// if ('hello') { ... }        // 编译错误！
// if ([]) { ... }             // 编译错误！

// ✅ 必须显式比较
if (list.isNotEmpty) { ... }   // OK
if (count > 0) { ... }         // OK
if (name != null) { ... }      // OK
```

这是 Dart 与 TS 最明显的差异之一。TS 的 `if (value)` 依赖于 truthy/falsy 判断，Dart 强制使用显式的 bool 表达式。这避免了 `if (0)` 和 `if ('')` 这类常见 JS 陷阱。

### 3.4 List（数组）

```dart
// 创建
var list = [1, 2, 3];                    // List<int>
var typed = <String>['a', 'b'];          // 显式类型
var filled = List.filled(3, 0);          // [0, 0, 0] — 固定长度
var generated = List.generate(5, (i) => i * i); // [0, 1, 4, 9, 16]

// 操作（方法链风格，类似 TS Array 方法）
list.add(4);                              // [1, 2, 3, 4]
list.addAll([5, 6]);                      // [1, 2, 3, 4, 5, 6]
list.remove(3);                           // [1, 2, 4, 5, 6]
list.removeAt(0);                         // [2, 4, 5, 6]

// 展开操作符（Spread）
var combined = [...list, 7, 8, ...[9, 10]];

// 集合 if / 集合 for
var hasHeader = true;
var items = [
  if (hasHeader) 'Header',               // 条件包含元素
  for (var i = 0; i < 3; i++) 'Item $i', // 循环生成元素
  'Footer',
];
// [Header, Item 0, Item 1, Item 2, Footer]

// 查询
var numbers = [3, 1, 4, 1, 5, 9, 2, 6];
var evens = numbers.where((n) => n.isEven);      // (4, 2, 6) — 返回 Iterable
var sorted = numbers..sort();                     // [1, 1, 2, 3, 4, 5, 6, 9] — 原地排序
var mapped = numbers.map((n) => n * 2);           // 每个元素 × 2
var first = numbers.firstWhere((n) => n > 5);    // 9
bool hasLarge = numbers.any((n) => n > 8);        // true
bool allPositive = numbers.every((n) => n > 0);   // true

// 解构（Dart 3 模式匹配）
var [a, b, ...rest] = [1, 2, 3, 4, 5];
// a = 1, b = 2, rest = [3, 4, 5]

// 对比 TS：
// TS: const [a, b, ...rest] = [1,2,3,4,5]; — 解构语法几乎一样
// TS: numbers.filter(n => n % 2 === 0) ≈ Dart: numbers.where((n) => n.isEven)
```

### 3.5 Set

```dart
// 创建
var set = <String>{};                   // 空 Set（注意：{} 是 Map 不是 Set！）
var halogens = {'fluorine', 'chlorine'}; // Set<String> — 自动推断为 Set
var unique = {1, 2, 3, 2, 1};           // {1, 2, 3} — 自动去重

// 操作
set.add('Dart');
set.addAll({'Flutter', 'Riverpod'});
set.remove('Dart');
set.contains('Flutter');                // true

// 集合运算
var a = {1, 2, 3};
var b = {2, 3, 4};
a.intersection(b);                      // {2, 3}
a.union(b);                             // {1, 2, 3, 4}
a.difference(b);                        // {1}

// 对比 TS：TS 使用 new Set()，Dart 使用 {} 字面量（类型推断为 Set 需要泛型或元素）
// TS: const set = new Set<string>(); ≈ Dart: var set = <String>{};
```

### 3.6 Map

```dart
// 创建
var map = {'key1': 'value1', 'key2': 2}; // Map<String, dynamic>
var typed = <String, int>{'a': 1, 'b': 2};

// 操作
map['key3'] = 'value3';                 // 添加
var value = map['key1'];                // 读取（key 不存在返回 null）
map.remove('key2');                     // 删除
map.containsKey('key1');                // true
map.containsValue('value1');            // true

// 遍历
map.forEach((key, value) {
  print('$key: $value');
});

// Map 解构（Dart 3）
for (var MapEntry(key: k, value: v) in map.entries) {
  print('$k -> $v');
}

// 对比 TS：
// TS 的 object 字面量 ≈ Dart Map 字面量，语法几乎一样
// TS: map['key'] 可能返回 undefined，Dart 返回 null
```

### 3.7 dynamic vs Object — 动态类型

```dart
// dynamic — 完全跳过了类型检查（类似 TS any）
dynamic anything = 'hello';
anything = 42;                    // OK — 类型可以改变
anything.fakeMethod();            // 编译通过！但运行时可能 NoSuchMethodError

// Object — 所有 Dart 类的基类
Object obj = 'hello';
obj = 42;                         // OK — 所有类型都是 Object
// obj.length;                    // 编译错误！Object 上没有 length 属性

// 选择指南：
// • 优先用具体类型（String, int 等）
// • 需要泛型容器时用 Object?
// • 仅在无可避免时才用 dynamic（如解析未知结构的 JSON）
```

---

## 4. 函数

### 4.1 基本函数定义

```dart
// 完整签名
String greet(String name, int age) {
  return 'Hello, $name! You are $age years old.';
}
// TS 等价: function greet(name: string, age: number): string { ... }

// 类型推断返回（Flutter 官方风格指南要求声明返回类型）
greet(String name, int age) {          // 缺少返回类型声明，不推荐
  return 'Hello, $name!';
}

// 箭头函数 — 仅单表达式函数体可用
bool isEven(int n) => n % 2 == 0;      // 等价于 { return n % 2 == 0; }

// ⚠️ 箭头函数 ≠ JS 箭头函数
// Dart 的 => 只是 { return ...; } 的语法糖，不是创建闭包的另一种方式
// 对比 TS: const isEven = (n: number) => n % 2 === 0;
```

### 4.2 参数类型详解

Dart 函数有四种参数，这是 Dart 比 TS 在函数定义上更精细的部分：

```dart
// ① 必填位置参数（Required Positional）
String fullName(String first, String last) {
  return '$first $last';
}
// 调用：fullName('Ada', 'Lovelace')

// ② 可选位置参数（Optional Positional）— 用 [] 包裹
String say(String from, String msg, [String? device, int? priority]) {
  var result = '$from says $msg';
  if (device != null) result = '$result with $device';
  return result;
}
// 调用：say('Bob', 'Howdy') 或 say('Bob', 'Howdy', 'smoke signal')

// ③ 命名参数（Named）— 用 {} 包裹
//    默认是可选的（可空），加 required 变必填
void enableFlags({bool? bold, bool? hidden}) {
  // bold 和 hidden 都是可选的，调用者可传可不传
}

// ④ 必填命名参数（Required Named）— {} + required
void createUser({
  required String name,        // 必填
  required String email,       // 必填
  int? age,                    // 可选
  bool isAdmin = false,        // 可选，有默认值
}) {
  // ...
}
// 调用：createUser(name: 'Alice', email: 'alice@example.com', age: 30)
```

**参数选择指南**：

| 参数类型 | 语法 | 何时使用 |
|----------|------|---------|
| 必填位置 | `fn(a, b)` | 参数数量少（1-2个），含义从位置就一目了然 |
| 可选位置 | `fn(a, [b, c])` | 调用方可选的辅助参数 |
| 可选命名 | `fn({bool? x})` | 参数多、含义不直观时，调用时看到参数名更清晰 |
| 必填命名 | `fn({required int x})` | Flutter 中最常用——Widget 参数几乎全是这个模式 |

> **TS 经验**：Dart 的命名参数 ≈ TS 的对象参数解构模式。TS 需要传 `{a: 1, b: 2}` 对象，Dart 直接 `fn(a: 1, b: 2)`——更简洁且类型更安全。

### 4.3 匿名函数与闭包

```dart
// 匿名函数（Lambda / Closure）
var multiply = (int a, int b) => a * b;
var greet = (String name) {
  final upper = name.toUpperCase();
  return 'Hello, $upper!';
};

// 作为参数传递——最常用于集合操作
var numbers = [1, 2, 3, 4, 5];
numbers.where((n) => n > 3);       // 匿名函数传给 where
numbers.map((n) => n * 2);         // 匿名函数传给 map

// 闭包 — 捕获外部变量
Function makeAdder(int addBy) {
  return (int i) => addBy + i;     // 返回的函数持有 addBy
}
var add2 = makeAdder(2);
var add5 = makeAdder(5);
print(add2(3));                     // 5
print(add5(3));                     // 8
// TS 等价:
// const makeAdder = (addBy: number) => (i: number) => addBy + i;
```

### 4.4 typedef — 函数类型别名

```dart
// typedef 给函数类型起名
typedef IntOperation = int Function(int a, int b);

int add(int a, int b) => a + b;
int subtract(int a, int b) => a - b;

// 使用 typedef 约束函数参数类型
int compute(IntOperation operation, int x, int y) {
  return operation(x, y);
}

print(compute(add, 10, 5));       // 15
print(compute(subtract, 10, 5));  // 5

// typedef 也可用于非函数类型（Dart 2.13+）
typedef UserId = String;           // 语义化类型别名
UserId userId = 'usr_12345';

// 对比 TS：
// type IntOperation = (a: number, b: number) => number;
```

---

## 5. 控制流

### 5.1 if-else 与 switch

```dart
// if-else — 与 TS 几乎一致
if (score >= 90) {
  return 'A';
} else if (score >= 80) {
  return 'B';
} else {
  return 'C';
}

// ⚠️ Dart 条件必须是 bool 表达式（回忆 3.3 节）
// if (value) 是编译错误！

// switch — Dart 3 增强版（模式匹配）
// 传统用法：
switch (day) {
  case 'Monday':
    print('Start of work week');
    break;                           // 需要 break（不支持 fall-through）
  case 'Saturday':
  case 'Sunday':                     // 多个 case 共享同一个 block
    print('Weekend!');
    break;
  default:
    print('Midweek');
}

// Dart 3 Switch 表达式（不需要 break，用 =>）
var feeling = switch (day) {
  'Monday' || 'Tuesday' || 'Wednesday' || 'Thursday' || 'Friday' => 'Working',
  'Saturday' || 'Sunday' => 'Relaxing',
  _ => 'Unknown day',                  // _ 是通配符 default
};
```

### 5.2 循环

```dart
// for 循环
for (var i = 0; i < 5; i++) {
  print(i);
}

// for-in — 遍历 Iterable
var fruits = ['apple', 'banana', 'orange'];
for (final fruit in fruits) {
  print(fruit);
}

// while
while (tokens.isNotEmpty) {
  process(tokens.removeLast());
}

// do-while
do {
  line = readLine();
} while (line != null);

// break — 跳出循环
for (final item in items) {
  if (item == target) {
    found = item;
    break;
  }
}

// continue — 跳过当前迭代
for (final item in items) {
  if (item.isProcessed) continue;
  process(item);
}
```

> **TS 经验**：Dart 的循环语法与 TS 完全一致——`for`、`for-in`、`while`、`do-while`、`break`、`continue` 的写法和语义都相同。唯一区别是 Dart 没有 `for-of`（它用 `for-in` 覆盖了 JS 中 `for-in` + `for-of` 的功能）。

### 5.3 断言（assert）

```dart
// assert — 开发调试工具，仅在 Debug 模式生效
assert(age >= 0, 'Age cannot be negative');
assert(items.isNotEmpty);

// Release 模式（flutter run --release）下 assert 被完全忽略

// 类似 TS 的 Node assert 或前端的 console.assert
```

---

## 6. 异常处理

### 6.1 throw — 抛出异常

```dart
// Dart 可以抛出任何对象（不仅仅是 Exception/Error 子类）
throw 'Invalid input';                // 可以但不推荐
throw FormatException('Expected valid JSON');
throw StateError('Already initialized');

// Flutter 中常见的抛出：
throw Exception('Network error');     // 通用异常
throw ArgumentError('name cannot be empty');
throw RangeError('index out of bounds');
throw UnimplementedError('TODO: implement this');
```

### 6.2 try-catch-on-finally

Dart 的异常处理比 TS 多了一个 `on` 关键字——专门按异常类型捕获：

```dart
try {
  final result = await fetchData();
  processResult(result);
} on FormatException {
  // 只捕获 FormatException——不需要获取异常对象时省略 catch
  print('Invalid format');
} on IOException catch (e) {
  // 捕获 IOException 同时获取异常对象
  print('IO error: $e');
} catch (e, stackTrace) {
  // 捕获所有其他异常——e 是异常对象，stackTrace 是堆栈跟踪
  print('Unexpected error: $e');
  print(stackTrace);
} finally {
  // 无论是否抛出异常，都会执行——用于清理资源
  closeResources();
}

// 对比 TS：
// try { ... } catch (e) { ... } finally { ... }
// Dart 多了 on 关键字用于按类型过滤，更精确
```

> **TS 经验**：
> - Dart 的 `on Type catch (e)` ≈ TS 的 `catch (e) { if (e instanceof Type) ... }`
> - Dart 的 `catch (e, stackTrace)` 第二个参数直接拿堆栈——TS 需要用 `e.stack`
> - Dart 的 `rethrow` 保留原始堆栈——TS 的 `throw e` 会丢失堆栈

### 6.3 rethrow — 重新抛出

```dart
try {
  await riskyOperation();
} catch (e) {
  logError(e);       // 记录日志
  rethrow;           // 重新抛出，保留原始堆栈跟踪
}

// ⚠️ throw e; 会丢失原始堆栈，rethrow; 保留
// try {
//   ...
// } catch (e) {
//   throw e;        // 堆栈重置——不要这样做！
// }
```

---

## 7. 图书馆 App 实战：Dart 语法练习脚本

在 `lib/utils/` 下创建 `dart_syntax_practice.dart`。这个脚本不会集成到 App 中，而是用 `dart run` 独立执行，用于验证你对本章语法的掌握。

```dart
// lib/utils/dart_syntax_practice.dart
// 覆盖第 2 章所有语法点的练习脚本
// 运行方式：dart run lib/utils/dart_syntax_practice.dart

import 'dart:convert';
import 'dart:math';

// ──── 1. 变量声明 ────
void practiceVariables() {
  print('\n=== 1. 变量声明 ===');

  // var — 类型推断
  var title = 'Library System';
  var version = 1;
  print('$title v$version');

  // final — 运行时常量
  final now = DateTime.now();
  final random = Random().nextInt(100);
  print('Generated at $now, random seed: $random');

  // const — 编译时常量
  const pi = 3.14159;
  const categories = ['Fiction', 'Science', 'History'];
  print('Categories: $categories');

  // late — 延迟初始化
  late String config;
  config = 'loaded';               // 稍后赋值
  print('Config: $config');

  print('✅ Variables practice completed');
}

// ──── 2. 内置类型 ────
void practiceTypes() {
  print('\n=== 2. 内置类型 ===');

  // int & double
  int bookCount = 1523;
  double avgRating = 4.7;
  double total = bookCount + avgRating;  // num 自动提升
  print('Books: $bookCount, Avg rating: $avgRating');

  // String
  String name = 'Clean Code';
  String query = 'Search: "${name.toUpperCase()}"';
  print(query);
  print('Contains "Clean": ${name.contains('Clean')}');

  // List
  List<String> authors = ['Martin', 'Fowler', 'Gamma'];
  authors.add('Beck');
  var longNames = authors.where((a) => a.length > 5).toList();
  print('Long author names: $longNames');
  var [first, ...rest] = authors;    // 解构
  print('First: $first, Rest: $rest');

  // Set
  var genres = {'Fiction', 'Science', 'Fiction'}; // 自动去重
  genres.add('History');
  print('Genres: $genres');

  // Map
  var isbnMap = {
    'Clean Code': '978-0132350884',
    'Refactoring': '978-0201485677',
    'Design Patterns': '978-0201633610',
  };
  print('ISBN of Clean Code: ${isbnMap['Clean Code']}');

  // bool
  bool hasBooks = bookCount > 0;
  if (hasBooks) print('Library has books ✓');

  print('✅ Types practice completed');
}

// ──── 3. 函数 ────
// 必填位置参数
String formatBook(String title, String author) => '$title by $author';

// 可选位置参数
String createBookEntry(String title, [String? subtitle, int? edition]) {
  var entry = title;
  if (subtitle != null) entry += ': $subtitle';
  if (edition != null) entry += ' ($edition ed.)';
  return entry;
}

// 命名参数
BookInfo createBookInfo({
  required String title,
  required String author,
  int? year,
  List<String> tags = const [],
}) {
  return BookInfo(
    title: title,
    author: author,
    year: year,
    tags: tags,
  );
}

class BookInfo {
  final String title;
  final String author;
  final int? year;
  final List<String> tags;
  const BookInfo({
    required this.title,
    required this.author,
    this.year,
    this.tags = const [],
  });
  @override
  String toString() =>
      'BookInfo(title: $title, author: $author, year: $year, tags: $tags)';
}

// typedef
typedef BookValidator = String? Function(BookInfo book);

String? validateBookTitle(BookInfo book) {
  if (book.title.isEmpty) return 'Title cannot be empty';
  return null;
}

void practiceFunctions() {
  print('\n=== 3. 函数 ===');

  print(formatBook('Design Patterns', 'GoF'));
  print(createBookEntry('Clean Code', 'A Handbook', 1));
  print(createBookEntry('Refactoring')); // 只传必填

  final info = createBookInfo(
    title: 'Effective Dart',
    author: 'Dart Team',
    year: 2026,
    tags: ['programming', 'dart', 'best-practices'],
  );
  print(info);

  // 匿名函数 + typedef
  BookValidator validator = validateBookTitle;
  final error = validator(info);
  print(error ?? 'Validation passed');

  // 闭包
  Function counter() {
    var count = 0;
    return () => ++count;
  }
  var next = counter();
  print('Count: ${next()}'); // 1
  print('Count: ${next()}'); // 2

  print('✅ Functions practice completed');
}

// ──── 4. 控制流 ────
void practiceControlFlow() {
  print('\n=== 4. 控制流 ===');

  // if-else
  var stock = 3;
  if (stock == 0) {
    print('Out of stock');
  } else if (stock < 5) {
    print('Low stock: $stock remaining');
  } else {
    print('In stock: $stock');
  }

  // switch 表达式
  var day = 'Monday';
  var mood = switch (day) {
    'Monday' => 'Need coffee ☕',
    'Friday' => 'Almost weekend 🎉',
    'Saturday' || 'Sunday' => 'Weekend! 🎊',
    _ => 'Working...',
  };
  print(mood);

  // for 循环
  var sum = 0;
  for (var i = 1; i <= 10; i++) {
    sum += i;
  }
  print('Sum of 1-10: $sum');

  // for-in
  var titles = ['Clean Code', 'Refactoring', 'Design Patterns'];
  for (final t in titles) {
    print('  📖 $t');
  }

  // while
  var count = 3;
  while (count > 0) {
    print('Countdown: $count');
    count--;
  }

  print('✅ Control flow practice completed');
}

// ──── 5. 异常处理 ────
class LibraryException implements Exception {
  final String message;
  const LibraryException(this.message);
  @override
  String toString() => 'LibraryException: $message';
}

void borrowBook(String isbn) {
  if (isbn.isEmpty) {
    throw LibraryException('ISBN cannot be empty');
  }
  if (isbn == '000') {
    throw FormatException('Invalid ISBN format: $isbn');
  }
  print('Book $isbn borrowed successfully');
}

void practiceErrorHandling() {
  print('\n=== 5. 异常处理 ===');

  // on — 按类型捕获
  try {
    borrowBook('');
  } on LibraryException {
    print('Library error occurred');
  } on FormatException catch (e) {
    print('Format error: $e');
  } catch (e, stackTrace) {
    print('Unexpected: $e');
    // print(stackTrace); — 开发调试时取消注释
  } finally {
    print('Borrow operation completed');
  }

  // 正常流程
  try {
    borrowBook('978-0132350884');
  } catch (e) {
    print('Error: $e');
  }

  print('✅ Error handling practice completed');
}

// ──── 主入口 ────
void main() {
  practiceVariables();
  practiceTypes();
  practiceFunctions();
  practiceControlFlow();
  practiceErrorHandling();

  print('\n🎉 All Dart syntax practices completed!');
}
```

运行验证：

```bash
dart run lib/utils/dart_syntax_practice.dart
```

如果每个小节都打印 `✅ ... completed` 且最后输出 `🎉`，说明本章语法点全部掌握。

---

## 8. 常见错误与最佳实践

### 8.1 常见错误

```dart
// ❌ 错误 1：以为 Dart 有 truthy/falsy
var list = <String>[];
// if (list) { ... }          // 编译错误！
if (list.isNotEmpty) { ... }   // ✅ 正确

// ❌ 错误 2：忘记 const 构造
// var now = const DateTime.now(); // 编译错误！DateTime.now() 不是 const
final now = DateTime.now();        // ✅ 正确 — 运行时常量用 final

// ❌ 错误 3：var 变量类型锁定后尝试赋值不同类型
var x = 1;
// x = 'hello';                     // 编译错误！int 变量不能赋 String
dynamic y = 1;
y = 'hello';                        // ✅ dynamic 可以改变类型

// ❌ 错误 4：Map 字面量混淆
var map = {};                        // 这是 Map<dynamic, dynamic> 不是 Set！
var set = <String>{};                // ✅ 这是 Set<String>
var alsoMap = <String, int>{};       // ✅ 这是 Map<String, int>

// ❌ 错误 5：throw e 而不是 rethrow
try { ... } catch (e) {
  log(e);
  throw e;                            // ❌ 丢失原始堆栈！
}
try { ... } catch (e) {
  log(e);
  rethrow;                            // ✅ 保留原始堆栈
}
```

### 8.2 最佳实践

1. **优先 `final`，其次 `var`，必须时才 `const`**：`final` 是 Flutter 中最常用的声明——参数、局部变量、类成员几乎都是 `final`。只有在值确实需要变化时才用 `var`
2. **Widget 构造函数参数全部用命名参数**：`const BookCard({required this.title, required this.author})` 而不是 `const BookCard(this.title, this.author)`——这是 Flutter 社区的绝对主流风格
3. **`==` 检查前先检查 `identical`**：Dart 的 `identical(a, b)` 检查是否同一对象引用——比 `==` 快得多
4. **集合操作用方法链，不要写中间变量**：`list.where(...).map(...).toList()` 一气呵成

---

## 9. 本章小结

| 你学到了什么 | 对标 TS 技能 | 在图书馆 App 中的体现 |
|-------------|-------------|---------------------|
| var/final/const/late 四件套 | let/const/! | 练习脚本中声明所有数据 |
| 所有内置类型（int/double/String/bool/List/Set/Map） | number/string/boolean/Array/Set/Map | 图书数据建模基础 |
| 四种函数参数 + typedef | 函数签名 + type alias | 图书格式化函数、验证器 |
| Dart 特有控制流增强（switch 表达式） | if/switch/for/while | 借阅状态判断、库存统计 |
| 异常处理 on-catch-finally-rethrow | try-catch-finally | 借阅操作的错误处理 |

---

> **下一步**: [Chapter 03 — Dart 核心语法速通（下）：面向对象与集合](./Chapter-03-Dart核心语法速通-下.md)
> **原始文档**: [dart.cn/language/variables](https://dart.cn/language/variables) | [dart.cn/language/built-in-types](https://dart.cn/language/built-in-types) | [dart.cn/language/functions](https://dart.cn/language/functions) | [dart.cn/language/loops](https://dart.cn/language/loops) | [dart.cn/language/error-handling](https://dart.cn/language/error-handling)
