# 附录 A：Effective Dart 核心摘要

> 原文: [dart.cn/effective-dart](https://dart.cn/effective-dart)

## 命名最佳实践

| 元素 | 规则 | 示例 |
|------|------|------|
| 类/枚举/类型别名/扩展 | `UpperCamelCase` | `class ShoppingCart {}` |
| 库/包/目录/文件 | `lowercase_with_underscores` | `shopping_cart.dart` |
| 导入前缀 | `lowercase_with_underscores` | `import 'dart:math' as math;` |
| 变量/函数/方法/参数 | `lowerCamelCase` | `int itemCount;` |
| 常量 | `lowerCamelCase`（不用 **SCREAMING_CAPS**） | `const apiKey = 'xxx';` |
| 布尔变量 | 用 `is`/`has`/`should` 前缀 | `isLoading`, `hasData` |
| 私有成员 | 以 `_` 开头（库级私有） | `int _count;` |

```dart
// ✅ 正确
const itemsPerPage = 20;
bool isReady = false;

// ❌ 错误
const ITEMS_PER_PAGE = 20;  // 不要用 SCREAMING_CAPS
bool Ready = false;          // 布尔用 is/has 前缀
```

## 类型注解指南

### 应该注解的地方

- 顶层变量和静态字段——因为它们的可见范围大
- 函数签名（参数类型和返回类型）——构成公共 API

```dart
// ✅ 注解公共 API
Future<List<Item>> fetchItems({required int page}) async { ... }

// ✅ 顶层/静态变量注解类型
const Duration timeout = Duration(seconds: 10);
static String baseUrl = 'https://api.example.com';
```

### 不必要时可以省略

- 局部变量——类型可由初始化表达式推断出来
- 回调函数的参数——可由上下文推断
- 泛型实例化中的类型——可由构造参数推断

```dart
// ✅ 省略：类型推断足够清晰
var items = <Item>[];           // 省略 List<Item>
var result = computeValue();    // 省略明确的返回类型
items.map((item) => item.name); // 省略 item 的类型

// ❌ 过度注解（干扰视觉）
List<Item> items = <Item>[];    // 冗余
```

## 成员顺序约定

在类/混入/扩展中，成员按以下顺序排列：

1. **字段/属性** — `static const` → `final` → 其他
2. **构造方法** — 主构造 → 命名构造 → factory 构造
3. **公开方法** — 按逻辑分组
4. **私有方法** — `_privateMethod` 放在调用它的公开方法附近
5. **操作符重载**

```dart
class ShoppingCart {
  // 1. 静态常量
  static const maxItems = 99;

  // 2. 实例字段
  final String id;
  final List<Item> _items = [];

  // 3. 构造方法
  ShoppingCart({required this.id});

  factory ShoppingCart.fromJson(Map<String, dynamic> json) => ...

  // 4. 公开方法
  void addItem(Item item) { ... }
  double get totalPrice => _items.fold(0, (sum, i) => sum + i.price);

  // 5. 私有方法
  void _validateItem(Item item) { ... }
}
```

## 风格指南

- **排序**：`dart:` 导入 → `package:` 导入 → 相对路径导入，各组间空行分隔
- **格式化**：使用 `dart format`（等同于 Prettier——无需讨论风格）
- **`dart:` 导入永远在最前面**，即使有 `package:` 或相对导入

```dart
import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'models/cart.dart';
import 'widgets/cart_tile.dart';
```

## 文档指南

- **`///`** 文档注释（非 `//` 或 `/* */`）——生成 HTML API 文档
- 首句应为简短总结句（以句号结尾）
- 用方括号 `[ClassName]` 引用类/方法
- 代码示例用 ` ```dart ` 包裹

```dart
/// A shopping cart that holds [Item] objects.
///
/// The total price is calculated lazily.
/// ```dart
/// final cart = ShoppingCart(id: 'cart-1');
/// cart.addItem(Item(name: 'Book', price: 29.9));
/// ```
class ShoppingCart { ... }
```

## 使用指南

### 变量与常量

```dart
// ✅ const：编译时常量，能 const 就 const
const timeout = Duration(seconds: 30);
const measurements = [1.0, 2.0, 3.0];  // 递归不可变

// ✅ final：运行时确定但只赋值一次
final now = DateTime.now();

// ❌ 避免
var timeout = Duration(seconds: 30);  // 应该是 const
```

### 空值处理

```dart
// ✅ 用 ?? 提供默认值
var value = nullableValue ?? 'default';

// ✅ 用 ??= 只在为 null 时赋值
data ??= fetchData();

// ✅ ?. 安全访问链
var street = user?.address?.street;

// ❌ 避免显式三目判断 null
var value = nullableValue == null ? 'default' : nullableValue;
```

### 类型检查

```dart
// ✅ 用 is / is!
if (animal is Dog) { animal.bark(); }

// ❌ 用 runtimeType 比较
if (animal.runtimeType == Dog) { ... }  // 不精确且破坏子类型多态
```

### 集合

```dart
// ✅ 用字面量
var list = <int>[];
var set = <String>{};
var map = <String, int>{};

// ❌ 用构造函数（更冗长）
var list = List<int>.empty(growable: true);

// ✅ for-in（可读性好，可 break/continue）
for (var item in items) {
  if (item.isSoldOut) continue;
  print(item.name);
}

// ❌ forEach（不能 break/continue，内部 return 只跳过单次回调）
items.forEach((item) { print(item.name); });
```

### 异步

```dart
// ❌ 避免用 Future(() => ...) 延迟同步代码
Future(() => doWork());          // 在下一个 micro task 执行

// ✅ 用 Future.delayed 明确延迟意图
Future.delayed(Duration(seconds: 1), () => doWork());
```

## 设计指南

### 避免 dynamic

```dart
// ❌ dynamic 失去所有编译时检查
dynamic value = getSomething();
print(value.length);  // 运行时可能崩溃

// ✅ 用 Object? 或具体泛型
Object? value = getSomething();
if (value is String) print(value.length);
```

### 优先命名参数

```dart
// ✅ 命名参数：调用处键值对一目了然
Future<void> createUser({required String name, required int age, bool isAdmin = false});

createUser(name: 'Alice', age: 30);

// ❌ 位置参数：参数多了调用处含义不清
Future<void> createUser(String name, int age, [bool? isAdmin]);

createUser('Alice', 30);  // 30 是什么？需要记住参数顺序
```

### 优先组合而非继承

```dart
// ✅ 用 mixin 复用行为
mixin Logger {
  void log(String msg) => print('[${runtimeType}] $msg');
}

class UserService with Logger { }

// ❌ 用多继承（Dart 不允许，但概念上应该避免深继承链）
class UserService extends BaseService { ... }  // 只在"is-a"关系时使用
```

### 避免不必要的库导入

```dart
// ✅ 仅导入需要的部分
import 'dart:math' show Random, min;

// ✅ 使用 hide 排除冲突的名称
import 'package:lib1.dart' hide JsonEncoder;
```

### 优先 throw 具体异常

```dart
// ✅ 抛出具体类型
throw FormatException('Invalid JSON');

// ❌ 抛任意对象（失去了多态性，调用方无法按类型捕获）
throw 'Something went wrong';
throw 404;
```

## 错误处理指南

### 捕获具体异常

```dart
// ✅ 捕获具体类型
try {
  var data = jsonDecode(rawJson);
} on FormatException catch (e) {
  log('Invalid format: $e');
} catch (e, stack) {
  log('Unexpected: $e\n$stack');
  rethrow;  // 不处理的异常重新抛出
}

// ❌ 宽泛捕获所有异常
try { ... } catch (e) { print(e); }  // 掩盖了 bug
```

### 异步错误处理

```dart
// ✅ async 函数中异常自动转为 Future error
Future<String> loadData() async {
  throw Exception('Network error');  // 自动封装为 Future.error
}

// ✅ 链式 catchError
fetchData()
  .then((data) => process(data))
  .catchError((e) => handleError(e), test: (e) => e is FormatException)
  .whenComplete(() => cleanup());
```

### 断言 vs 异常

- `assert(...)` — 仅在 debug 模式下生效，用于检查不应发生的逻辑错误
- `throw` — 所有模式下都生效，用于运行时错误条件

```dart
void setCount(int value) {
  assert(value >= 0, 'count must be non-negative');  // debug 期检查
  if (value > maxItems) {
    throw ArgumentError.value(value, 'value', 'exceeds max of $maxItems');
  }
  _count = value;
}
```

## 库级设计

### 库文件结构

```dart
// 文件: user_service.dart
library user_service;  // 可省略（默认库名为文件名）

import 'dart:async';
import 'package:flutter/foundation.dart';

part 'user_service_impl.dart';  // 拆分大型文件（谨慎使用）
```

### 包可见性

- Dart 的 `_` 前缀是**库级别私有**——同一文件内可见
- 多个 `part` / `part of` 的文件共享同一个库名时，可互相访问私有成员
- 公开符号就是未以 `_` 开头的顶层声明

```dart
// public_api.dart — 库的公开表面
export 'src/models.dart' show User, AuthToken;
export 'src/services.dart' show AuthService;
// 其余内部实现（src/ 内文件）不被外部直接导入
```

### 显式导出控制

```dart
// ✅ 通过 show/hide 精确控制库的公开 API
export 'src/base.dart' show BaseClass;
export 'src/impl.dart' hide InternalMixin;
```

> 更多细节: [dart.cn/effective-dart](https://dart.cn/effective-dart)
