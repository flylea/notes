> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 03 — Dart 核心语法速通（下）：面向对象与集合](./Chapter-03-Dart核心语法速通-下.md)
> **下一章**: [Part II — 界面基石：Widget 与布局（敬请期待）](../Part-02-界面基石/)
> **官方文档**: [dart.cn/language/patterns](https://dart.cn/language/patterns) | [dart.cn/language/records](https://dart.cn/language/records) | [dart.cn/language/class-modifiers](https://dart.cn/language/class-modifiers) | [dart.cn/null-safety](https://dart.cn/null-safety) | [dart.cn/tools/dart-analyze](https://dart.cn/tools/dart-analyze) | [dart.cn/tools/dart-format](https://dart.cn/tools/dart-format)

---

# 第 4 章：Dart 3 新特性与现代 Dart 工程化

## 0. 本章目标与前置依赖

**前置依赖**：已完成 Chapter 2-3 的 Dart 基础语法学习。你应已能熟练定义类、使用构造方法、操作集合。

**本章目标**：
- 掌握 Dart 3 模式匹配（Pattern Matching）：解构 / Switch 表达式 / 密封类模式
- 理解 Records 记录类型——轻量匿名聚合数据
- 精通类修饰符（sealed / final / base / interface / mixin class）的完整用法与场景
- 深入健全空安全（Sound Null Safety）：`?` / `!` / `late` / 类型提升
- 熟练使用 Dart 工程化工具链：`dart analyze` / `dart format` / `dart fix`
- 配置项目级 `analysis_options.yaml` 实现严格静态检查

> 🎯 **本章会在图书馆 App 中做什么**：创建 `ApiResult<T>` sealed class（Success/Failure 联合类型），使用模式匹配处理 API 结果；配置严格的 `analysis_options.yaml`，确保项目代码质量基线。

---

## 1. 模式匹配（Pattern Matching）

模式匹配是 Dart 3 引入的最重要新特性——它让你以声明式方式解构数据并做出分支决策。

### 1.1 解构（Destructuring）

```dart
// 列表解构
var [a, b, ...rest] = [1, 2, 3, 4, 5];
// a = 1, b = 2, rest = [3, 4, 5]

// Map 解构
var {'name': name, 'age': age} = {'name': 'Alice', 'age': 30};
// name = 'Alice', age = 30

// 对象解构（配合模式匹配 switch）
var book = Book(id: '1', title: 'Dart 3 Guide', author: 'Google');
// 见 1.3 节的 switch 表达式解构

// 嵌套解构
var nested = [
  {'name': 'Alice', 'scores': [90, 85, 88]},
  {'name': 'Bob', 'scores': [78, 82, 91]},
];

for (var {'name': name, 'scores': [first, ...rest]} in nested) {
  print('$name first score: $first');
}
// Alice first score: 90
// Bob first score: 78

// 对比 TS：
// TS: const [a, b, ...rest] = [1, 2, 3, 4, 5];  —— 语法几乎一样
// TS: const { name, age } = obj;                  —— Dart 需要匹配整个结构
```

### 1.2 Switch 表达式

Dart 3 的 switch 从"语句"升级为"表达式"——它有返回值，且编译器强制进行**完备性检查**：

```dart
// 传统 switch 语句（Dart 2）——没有返回值，需要 break
String getStatusText(BookStatus status) {
  switch (status) {
    case BookStatus.available:
      return '可借';
    case BookStatus.borrowed:
      return '已借出';
    case BookStatus.overdue:
      return '逾期';
    default:
      return '未知';
  }
}

// Dart 3 switch 表达式——有返回值，不需要 break，编译器检查是否覆盖所有分支
String getStatusTextV3(BookStatus status) => switch (status) {
      BookStatus.available => '可借',
      BookStatus.borrowed => '已借出',
      BookStatus.overdue  => '逾期',
      BookStatus.reserved => '已预约',
      BookStatus.damaged  => '损坏',
    };
// ↑ 如果遗漏某个枚举值，编译器直接报错！
// 这是 Dart 3 最关键的改进之一：让编译器帮你避免"漏了分支"导致的 bug

// 守卫子句（Guard Clause）—— when 关键字
String evaluateGrade(int score) => switch (score) {
      >= 90 => 'A',
      >= 80 => 'B',
      >= 70 => 'C',
      >= 60 => 'D',
      _     => 'F',              // _ 是通配符（类似 default）
    };

// 逻辑或（Logical-or）—— 多个条件共享同一结果
String describeDay(String day) => switch (day) {
      'Monday' || 'Tuesday' || 'Wednesday' || 'Thursday' || 'Friday' => '工作日',
      'Saturday' || 'Sunday' => '周末',
      _ => '不知道是哪一天',
    };

// 与 TS 的对比：
// TS 没有原生 switch 表达式。最接近的是：
// const text = {
//   available: '可借',
//   borrowed: '已借出',
// }[status] ?? '未知';
// 但这不会做完备性检查。
```

### 1.3 对象模式（Object Pattern）

Dart 3 可以在 switch 中直接解构对象的字段进行匹配——这是模式匹配中最强大的部分：

```dart
// 假设有如下数据模型
sealed class ApiResult {}

class Success extends ApiResult {
  final dynamic data;
  final int statusCode;
  Success(this.data, this.statusCode);
}

class Failure extends ApiResult {
  final String message;
  final int statusCode;
  Failure(this.message, this.statusCode);
}

class Loading extends ApiResult {}

// 对象模式匹配——直接在 switch 中解构并提取字段值
String handleResult(ApiResult result) => switch (result) {
      // 匹配 Success 类型，同时解构 data 和 statusCode
      Success(data: final data, statusCode: 200) => '数据获取成功: $data',
      Success(statusCode: final code)                    => '成功，状态码: $code',
      // 匹配 Failure 类型，同时解构 message
      Failure(message: final msg, statusCode: 404)       => '资源未找到: $msg',
      Failure(message: final msg)                        => '请求失败: $msg',
      Loading()                                          => '加载中...',
    };

// 使用：
var result1 = Success({'title': 'Dart 3'}, 200);
print(handleResult(result1));   // 数据获取成功: {title: Dart 3}
```

> **TS 经验**：TS 没有原生的对象模式匹配。最接近的是 `if (x instanceof Success) { const { data } = x; ... }` 模式。Dart 3 的 sealed class + switch 表达式 ≈ Rust 的 enum + match / Swift 的 enum + switch。

---

## 2. Records（记录类型）

Records 是 Dart 3 引入的轻量级匿名不可变聚合类型——当你只需要"把几个值打包在一起"而不想定义完整类时使用：

```dart
// 声明 Records
var pair = (1, 'hello');                               // (int, String)
var triple = ('Dart', 3.12, true);                     // (String, double, bool)

// 命名字段 Records
var named = (name: 'Flutter', version: 3.44);          // ({String name, int version})

// 混合位置和命名字段
var mixed = ('result', 200, success: true);            // (String, int, {bool success})

// 访问 Records 字段
print(pair.$1);                                        // 1 —— 位置字段用 $N 访问
print(pair.$2);                                        // hello
print(named.name);                                     // Flutter —— 命名字段直接用名字
print(named.version);                                  // 3.44
print(mixed.$1);                                       // result

// Records 是不可变的
// named.name = 'React';                               // ❌ 编译错误

// Records 的相等性——值相等（不是引用相等）
var a = (1, 'hello');
var b = (1, 'hello');
print(a == b);                                         // true

// 多返回值——Records 最常见的用途
(String, int) getUserInfo() {
  return ('Alice', 30);
}
var (name, age) = getUserInfo();                       // 解构接收
print('$name is $age years old');

// 在 switch 中使用 Records 模式
String coordString((int, int) coord) => switch (coord) {
      (0, 0)     => '原点',
      (0, var y) => 'Y 轴上，y = $y',
      (var x, 0) => 'X 轴上，x = $x',
      (var x, var y) => '($x, $y)',
    };

// 对比 TS：
// TS 中类似的是 tuple: const pair: [number, string] = [1, 'hello'];
// Dart Records 的优势：值相等（TS 数组比较的是引用）、命名参数、不可变
```

---

## 3. 类修饰符（Class Modifiers）

Dart 3 引入了六个类修饰符来控制类的继承和实现行为：

### 3.1 修饰符速查

| 修饰符 | 可 extend | 可 implement | 可 mixin | 可构造 | 典型用途 |
|--------|-----------|-------------|----------|--------|---------|
| 无修饰符 | ✅ 同库 | ✅ | ❌ | ✅ | 标准类（最常用） |
| `interface` | ❌ | ✅ | ❌ | ✅ | 定义需被实现的契约 |
| `final` | ❌ | ❌ | ❌ | ✅ | 封闭类（不被扩展/实现） |
| `base` | ✅ 同库 | ❌ | ❌ | ✅ | 限定子类必须是 base/final/sealed |
| `sealed` | ❌ | ❌ | ❌ | ❌ | 密封联合类型（编译时已知所有子类） |
| `mixin class` | ✅ 同库 | ✅ | ✅ | ✅ | 既是类也是 Mixin |

### 3.2 sealed — 密封类（最重要）

`sealed` 是 Dart 3 最实用的类修饰符——配合 switch 表达式实现**编译时完备性检查**：

```dart
// sealed 定义封闭的类层级——所有子类必须在同一个文件中定义
sealed class ApiResult<T> {}

class Success<T> extends ApiResult<T> {
  final T data;
  Success(this.data);
}

class Failure<T> extends ApiResult<T> {
  final String message;
  Failure(this.message);
}

// sealed 的核心价值——switch 完备性检查
String handleApiResult(ApiResult<String> result) => switch (result) {
      Success(data: final d) => '✅ Success: $d',
      Failure(message: final m) => '❌ Failure: $m',
    };
// 不需要 default/_ 分支！编译器知道 sealed class 的所有子类
// 如果后来添加了新的子类（如 Loading），编译器会报错——强迫你更新所有 switch

// 对比 TS：
// TS 中的 discriminated union:
// type ApiResult<T> =
//   | { type: 'success'; data: T }
//   | { type: 'failure'; message: string };
// Dart sealed class 是语言级保证，比 TS union type 更安全。
```

### 3.3 各修饰符使用示例

```dart
// interface — 只能被实现，不能被继承
interface class JsonSerializable {
  Map<String, dynamic> toJson();
}
// class Bad extends JsonSerializable {}     // ❌ 不能 extend interface class
class Good implements JsonSerializable {     // ✅ 可以实现
  @override
  Map<String, dynamic> toJson() => {};
}

// final — 既不能扩展也不能实现
final class ConfigManager {
  final Map<String, String> _config = {};
  String? get(String key) => _config[key];
}
// class Bad extends ConfigManager {}        // ❌ 不能 extend final class
// class Bad2 implements ConfigManager {}    // ❌ 不能 implement final class

// base — 只能被 base/final/sealed 类扩展（同库均可）
base class Widget {
  void build() {}
}
base class MyWidget extends Widget {}        // ✅ 同类型修饰符扩展
final class FinalWidget extends Widget {}    // ✅ 更严格的修饰符也可
// class Bad extends Widget {}              // ❌ 非 base/final/sealed 不能扩展 base

// mixin class — 既是普通类，也可作为 Mixin
mixin class Logger {
  void log(String msg) => print('[LOG] $msg');
}
class App with Logger {}                     // ✅ 作为 Mixin 混入
class AlsoApp extends Logger {}              // ✅ 作为普通类继承
```

---

## 4. 健全空安全（Sound Null Safety）

Dart 的空安全是**健全的（Sound）**——这意味着如果类型系统说一个变量不可为 null，它**绝不可能是 null**。这与 TS 的 `strictNullChecks` 不同——TS 的类型系统在运行时仍然可能遇到 null。

### 4.1 可空与非空类型

```dart
// 非空类型（Non-nullable）—— 默认
String name = 'Dart';                             // 永远不能为 null
int count = 42;                                   // 永远不能为 null

// 可空类型（Nullable）—— 加 ?
String? maybeName;                                // 可以是 null
int? maybeCount = null;                           // 显式 null

// 类型提升（Type Promotion）—— Dart 编译器自动追踪 null 检查
void printLength(String? text) {
  // text.length;                                 // ❌ 编译错误——text 可能为 null
  if (text != null) {
    print(text.length);                           // ✅ text 被提升为 String
  }
}
// 对比 TS：Dart 的类型提升比 TS 的控制流分析更可靠——
// 因为它有 Sound Null Safety 保证运行时真的不会为 null
```

### 4.2 null 安全操作符

```dart
String? maybeString;

// ?. — 安全访问（空值短路）
print(maybeString?.length);                       // null（不抛异常）

// ?? — 空值合并（if null, use alternative）
String text = maybeString ?? '默认值';             // '默认值'

// ??= — 空值赋值（assign if null）
maybeString ??= '赋值';                            // 将 null 替换为值

// ! — 非空断言（Null Assertion）—— "我保证它不是 null"
String definitelyNotNull = maybeString!;           // 如果为 null → 运行时异常

// ⚠️ ! 是危险的——只有在你能 100% 确定非空时才使用
// 优先用 ?. 和 ?? 进行安全处理

// ?.. — 可空级联（Dart 3.3+）
List<int>? numbers;
numbers
    ?..add(1)
    ..add(2)
    ..add(3);                                    // 如果 numbers 为 null，什么都不做

// 对比 TS optional chaining + nullish coalescing：
// maybeString?.length ≈ Dart ?.
// maybeString ?? 'default' ≈ TS ??
// maybeString! ≈ TS non-null assertion (!)
```

### 4.3 late — 非空延迟初始化

```dart
class DatabaseConnection {
  // late — 承诺在使用前初始化（让非空字段可以延迟赋值）
  late final String connectionString;

  void init(String host, String port) {
    connectionString = 'postgres://$host:$port';  // 一次赋值（late final）
  }

  void query(String sql) {
    print('Querying $connectionString: $sql');    // 使用前确保已赋值
  }
}

// late 的惰性计算
class ExpensiveService {
  late final _data = _loadData();                 // 首次访问时才执行 _loadData()

  String _loadData() {
    print('Loading data... (expensive!)');
    return 'loaded';
  }
}

// ⚠️ LateInitializationError
// late String bad;
// print(bad);                                    // 运行时抛异常——未初始化
```

### 4.4 必填命名参数（required）

```dart
// required — 让命名参数不可省略
void createUser({
  required String name,                            // 必须传
  required String email,                           // 必须传
  int? age,                                        // 可选（可空）
  String? bio,                                     // 可选（可空）
}) {
  // name 和 email 保证非 null——不需要 null 检查
}
```

---

## 5. Dart 工程化工具链

### 5.1 dart analyze — 静态分析

```bash
# 检查所有 Dart 文件的静态错误和警告
dart analyze

# 等同于 Flutter 项目中的
flutter analyze

# 输出示例：
# Analyzing library_app...
#
#   warning • Unused import: 'dart:convert' • lib/main.dart:3:8 • unused_import
#   info • Use 'const' with the constructor • lib/models/book.dart:15:19 • prefer_const_constructors
#
# 3 issues found. (ran in 1.2s)
```

分析规则分为四个级别：

| 级别 | 含义 | 默认行为 | 推荐策略 |
|------|------|---------|---------|
| `error` | 编译错误——代码无法运行 | 阻止编译 | 必须修复 |
| `warning` | 潜在问题——代码可能有问题 | 允许编译但警告 | 必须修复（提升为 error） |
| `info` | 风格建议——不影响运行 | 可忽略 | 逐步修（配置 strict） |
| `lint` | 代码风格规则 | 取决于 linter 配置 | 团队统一 |

### 5.2 dart format — 代码格式化

```bash
# 格式化所有 Dart 文件
dart format lib/

# 检查格式但不修改（CI 中常用）
dart format --set-exit-if-changed lib/

# 一行最大宽度（默认 80）
dart format --line-length 120 lib/
```

Dart 的 `dart format` 类似于 Prettier——它是权威格式化器，没有配置选项（除了行宽）。这意味着团队中不会有格式争议——`dart format` 说什么就是什么。

### 5.3 dart fix — 自动修复

```bash
# 预览可自动修复的问题
dart fix --dry-run

# 自动修复所有可修复问题
dart fix --apply

# 仅预览特定规则
dart fix --dry-run --code=prefer_const_constructors
```

---

## 6. analysis_options.yaml — 项目质量配置

这是 Library App 的严格静态分析配置。使用 `flutter_lints` 作为基础，叠加自定义规则：

```yaml
# analysis_options.yaml
# 本文件定义 Dart 静态分析规则——等同于 ESLint + tsc strict 的组合

include: package:flutter_lints/flutter.yaml

analyzer:
  language:
    strict-casts: true              # 隐式转型 (as) 必须显式——禁止意外类型转换
    strict-inference: true          # 类型推断缺失时报错
    strict-raw-types: true          # 禁止省略泛型参数

  errors:
    # 将以下警告提升为错误（编译不通过）
    missing_return: error
    missing_enum_constant_in_switch: error  # 枚举 switch 必须覆盖所有值 ⭐️
    dead_code: error
    unused_import: error
    unused_local_variable: error
    deprecated_member_use: error
    avoid_web_libraries_in_flutter: error

  exclude:
    - "**/*.g.dart"                 # 代码生成文件不检查
    - "**/*.freezed.dart"
    - "**/*.gr.dart"
    - "lib/generated/**"

linter:
  rules:
    # ──── 代码风格 ────
    - always_declare_return_types       # 函数必须声明返回类型
    - annotate_overrides                # 覆写方法必须有 @override
    - prefer_const_constructors         # ⭐️ 优先使用 const 构造（性能关键）
    - prefer_const_declarations         # 不变的变量用 const 声明
    - prefer_const_literals_to_create_immutables  # 不变集合用 const
    - require_trailing_commas           # ⭐️ 尾随逗号 → 更好的格式化
    - sort_constructors_first           # 构造方法放在类的开头
    - sort_unnamed_constructors_first   # 默认构造放在命名构造前
    - lines_longer_than_80_chars        # 行宽限制（配合 dart format）
    - use_key_in_widget_constructors    # Widget 构造必须有 Key 参数
    - use_super_parameters              # 优先用 super 参数传递

    # ──── 避免错误 ────
    - avoid_print                           # 禁止 print——用 debugPrint 或 Logger
    - avoid_empty_else                      # 禁止空 else 块
    - avoid_relative_lib_imports            # 禁止相对路径 import lib 内文件
    - avoid_types_on_closure_parameters     # 闭包参数省略类型（可推断）
    - avoid_void_async                      # async 函数不应返回 void
    - cancel_subscriptions                  # StreamSubscription 必须 cancel
    - close_sinks                           # StreamController 必须 close
    - no_leading_underscores_for_local_identifiers # 局部变量不用 _ 前缀
    - prefer_void_to_null                   # 用 void 而非 Null
    - unnecessary_null_checks               # 消除多余的 null 检查
    - use_build_context_synchronously       # async gap 后安全使用 context

    # ──── 命名规范 ────
    - constant_identifier_names             # 常量用 lowerCamelCase
    - non_constant_identifier_names         # 非常量也检查命名
    - prefer_single_quotes                  # 首选单引号

    # ──── 性能相关 ────
    - avoid_build_and_dispose_on_widgets
    - avoid_unnecessary_containers          # 禁止不必要的 Container 嵌套
    - prefer_const_constructors_in_immutables
```

配置完成后验证：

```bash
# 运行分析
flutter analyze

# 预期结果：0 errors, 0 warnings, 0 hints
# 如果非零，根据提示修复后再推进
```

---

## 7. 图书馆 App 实战

### 7.1 ApiResult — 使用 sealed class 定义 API 结果联合类型

```dart
// lib/models/api_result.dart

/// 泛型 API 结果类型——整个 App 所有 API 调用统一使用此类型
sealed class ApiResult<T> {
  const ApiResult();

  /// 是否成功
  bool get isSuccess => this is Success<T>;
  bool get isFailure => this is Failure<T>;

  /// 安全取值
  T? get data => switch (this) {
        Success(data: final d) => d,
        Failure() => null,
      };

  /// 安全取错误
  String? get errorMessage => switch (this) {
        Success() => null,
        Failure(message: final m) => m,
      };

  /// fold — 统一处理成功和失败（类似 Rust 的 match）
  R fold<R>({
    required R Function(T data) onSuccess,
    required R Function(String message) onFailure,
  }) =>
      switch (this) {
        Success(data: final d) => onSuccess(d),
        Failure(message: final m) => onFailure(m),
      };

  /// map — 转换成功值
  ApiResult<R> mapSuccess<R>(R Function(T) transform) => switch (this) {
        Success(data: final d) => Success<R>(transform(d)),
        Failure(:final message) => Failure<R>(message),
      };
}

class Success<T> extends ApiResult<T> {
  final T data;
  const Success(this.data);
}

class Failure<T> extends ApiResult<T> {
  final String message;
  const Failure(this.message);
}
```

### 7.2 在 UserRole 枚举中添加权限检查

```dart
// lib/models/user_role.dart
// 覆盖 Chapter 3 中定义的 UserRole 枚举，添加权限检查能力

enum UserRole {
  reader(label: '读者', level: 0),
  librarian(label: '图书管理员', level: 1),
  admin(label: '系统管理员', level: 2);

  final String label;
  final int level;
  const UserRole({required this.label, required this.level});

  bool get canManageBooks => level >= 1;
  bool get canManageUsers => level >= 2;
  bool get canViewReports => level >= 1;

  // 配合 switch 表达式的完备性检查
  String get homeRoute => switch (this) {
        UserRole.reader     => '/home',
        UserRole.librarian  => '/librarian-dashboard',
        UserRole.admin      => '/admin-dashboard',
      };
}
```

### 7.3 配置 analysis_options.yaml

将第 6 节的完整配置复制到项目根目录的 `analysis_options.yaml`，然后运行验证：

```bash
flutter analyze
```

如果项目目前只有 Chapter 1-3 创建的模型文件和数据文件，分析结果应该通过。

---

## 8. Extension Types — Dart 3 零成本包装类型

Extension Types 是 Dart 3 引入的关键特性——对现有类型做零运行时开销的包装，添加新 API 而不创建新对象。

```dart
// 语法：extension type <Name>.<representation-var> on <WrappedType> implements <Interface> { }

// ① 包装 String 为 ISBN 类型——编译时类型安全，运行时零开销
extension type Isbn(String value) implements String {
  bool get isValid => value.length == 13 && RegExp(r'^\d{13}$').hasMatch(value);
  String get formatted => '${value.substring(0, 3)}-${value.substring(3)}';
}

void lookupBook(Isbn isbn) {
  // isbn 编译时是 Isbn 类型（类型安全），运行时是 String（零开销）
  print(isbn.formatted);    // ✅
  print(isbn.toUpperCase()); // ✅ — 通过 implements String 继承
}
// lookupBook('1234567890123'); // ❌ 编译错误——不是 Isbn 类型

// ② 对比 extension method——Extension Type 提供更强的类型隔离
extension StringExt on String { bool get isValidIsbn => length == 13; }
// 问题：任何 String 都能调用 .isValidIsbn，即使它本意不是 ISBN
// Extension Type 解决了这个问题：只接受显式构造的 Isbn 类型

// ③ Extension Type vs Wrapper Class
class IsbnWrapper { final String value; IsbnWrapper(this.value); }
// IsbnWrapper 运行时创建对象——有内存分配开销
// extension type Isbn 运行时仍是 String——零开销
```

## 9. Dart 操作符速查

| 类别 | 操作符 | 说明 |
|------|--------|------|
| 算术 | `+ - * / ~/ %` | `~/` 整除（`7 ~/ 3 = 2`） |
| 比较 | `== != < > <= >=` | 与 TS 一致 |
| 类型 | `as is is!` | `x as String` 转型 / `x is String` 类型检查 |
| 逻辑 | `&& \|\| !` | 与 TS 一致 |
| 空安全 | `?. ?? ??= !` | `a?.b` 安全访问 / `a??b` 空值合并 / `x!` 非空断言 |
| 级联 | `..` | `obj..a=1..b=2` 连续操作同一对象 |
| 展开 | `?..` | 可空级联（Dart 3.3+） |
| 位运算 | `& \| ^ ~ << >>` | 按位与/或/异或/取反/左移/右移 |
| 条件 | `expr ? a : b` | 三元运算 |

## 10. 常见错误与最佳实践

### 8.1 常见错误

```dart
// ❌ 错误 1: sealed class 的子类在另一个文件中定义
// file_a.dart
// sealed class MyResult {}            // sealed 要求所有子类在同一文件
// file_b.dart
// class Success extends MyResult {}   // ❌ 编译错误！必须在同一文件

// ❌ 错误 2: 滥用 ! 操作符
String? maybeNull;
// var x = maybeNull!;                 // 如果 null → 运行时崩溃
var x = maybeNull ?? 'fallback';       // ✅ 使用 ?? 安全处理

// ❌ 错误 3: switch 表达式遗漏分支（不用 sealed class 时）
enum Status { active, inactive, pending }
// String s = switch (status) {        // ❌ 漏了 pending
//   Status.active => '激活',
//   Status.inactive => '未激活',
// };
// 编译器报错：The type 'Status' is not exhaustively matched.

// ❌ 错误 4: 忘记 strict-casts——隐式类型转换导致运行时错误
List<dynamic> raw = [1, 'two', 3];
List<int> nums = raw.cast<int>();      // ❌ raw: true 时运行时报错
// 配置 strict-casts: true 强制显式转换，让团队提前看到风险

// ❌ 错误 5: 使用 print 而不是 debugPrint
print('Debug info');                   // ❌ Android 上会丢消息
debugPrint('Debug info');              // ✅ 使用 debugPrint（Flutter 的 throttle 版本）
```

### 8.2 最佳实践

1. **所有"结果类型"都用 sealed class 定义**：`ApiResult<T>`、`ValidationResult`、`AuthState`——用 switch 表达式的完备性检查防止分支遗漏
2. **默认所有变量非空**：只在确实需要可空时才用 `?`。大多数场景用 `late` 延迟初始化比用 `?` 更清晰
3. **永远不要让 `!` 出现在生产代码中**：如果看到 `!`，问自己："这里我凭什么保证非空？有没有更安全的方式？"
4. **`analysis_options.yaml` 在项目第一天就严格配置**：`strict-casts`、`strict-inference`、`strict-raw-types` 三者全开——修改已有代码的成本比一开始就严格要高得多
5. **`dart format` 作为 CI 门禁**：`dart format --set-exit-if-changed lib/` 放入 GitHub Actions，任何格式不规范的 PR 直接拒绝

---

## 9. 本章小结

| 你学到了什么 | 对标 TS 技能 | 在图书馆 App 中的体现 |
|-------------|-------------|---------------------|
| 模式匹配解构 + Switch 表达式 | 解构赋值 + discriminated union | `ApiResult<T>` 的 switch 处理 |
| Records 记录类型 | Tuple | 可能的多返回值辅助场景 |
| sealed/final/base/interface/mixin class | TS 无直接等价 | `sealed class ApiResult<T>` 密封类型 |
| 健全空安全 ?/!/late/required | strictNullChecks + non-null assertion | 所有模型的空安全字段 |
| dart analyze/format/fix 工具链 | ESLint/Prettier | `analysis_options.yaml` 严格配置 |
| strict 分析规则 | tsconfig strict 全开 | 项目质量基线建立 |

---

> **下一步**: [Part II — 界面基石：Widget 与布局（Chapter 5）](../Part-02-界面基石/)
> **原始文档**: [dart.cn/language/patterns](https://dart.cn/language/patterns) | [dart.cn/language/records](https://dart.cn/language/records) | [dart.cn/language/class-modifiers](https://dart.cn/language/class-modifiers) | [dart.cn/null-safety](https://dart.cn/null-safety)
