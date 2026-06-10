> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 03 — Dart 核心语法速通（下）：面向对象与集合](./Chapter-03-Dart核心语法速通-下.md)
> **下一章**: [Part II — 界面基石：Widget 与布局](../Part-02-界面基石/)
> **官方文档**: [dart.cn/language/patterns](https://dart.cn/language/patterns) | [dart.cn/language/class-modifiers](https://dart.cn/language/class-modifiers) | [dart.cn/null-safety](https://dart.cn/null-safety)

---

# 第 4 章：Dart 3 新特性与现代 Dart 工程化

## 0. 本章目标

- 掌握 Dart 3 模式匹配：switch 表达式、解构、sealed class 联合类型
- 深入健全空安全（Sound Null Safety）：`?` / `??` / `?.` / `!` / `late` / `required`
- 熟练使用 Dart 工程化工具链：`dart analyze` / `dart format` / `dart fix`
- 配置 `analysis_options.yaml` 实现严格静态检查

> 🎯 **本章产出**：创建 `ApiResult<T>` sealed class，使用模式匹配处理 API 结果；配置 `analysis_options.yaml` 建立项目质量基线。

---

## 1. sealed class — 密封联合类型

`sealed` 是 Dart 3 最实用的类修饰符。它定义一个**封闭的类层级**——所有子类必须在同一文件中定义。配合 switch 表达式，编译器能做**完备性检查**，防止遗漏分支。

> Dart 3 还引入了 `final`、`base`、`interface`、`mixin class` 等类修饰符，它们的完整说明见 [dart.cn — 类修饰符](https://dart.cn/language/class-modifiers)。初学者通常只需要 `sealed`。

### 1.1 核心用法

```dart
// sealed class — 所有子类必须在同一文件中
sealed class ApiResult<T> {}

class Success<T> extends ApiResult<T> {
  final T data;
  Success(this.data);
}

class Failure<T> extends ApiResult<T> {
  final String message;
  Failure(this.message);
}

// 编译器知道 ApiResult 只有 Success 和 Failure 两个子类
// ——不需要 default/_ 分支
String handleResult(ApiResult<String> result) => switch (result) {
  Success(data: final d) => '✅ 成功: $d',
  Failure(message: final m) => '❌ 失败: $m',
};
// 如果以后添加新的子类（如 Loading），这里会编译报错——强迫你更新所有 switch
```

### 1.2 对象模式——在 switch 中直接解构字段

```dart
String handleDetailed(ApiResult<String> result) => switch (result) {
  Success(data: final d) when d.length > 10 => '长数据: ${d.substring(0, 10)}...',
  Success(data: final d)                    => '数据: $d',
  Failure(message: final m)                 => '错误: $m',
};
// when 关键字——守卫子句，在模式匹配基础上再加条件
```

> 这种模式在 Rust 中叫 `enum + match`，在 Swift 中叫 `enum + switch`。它比传统 `if (x is Success)` 更安全——编译器保证你不会漏掉任何情况。

---

## 2. 模式匹配与解构

### 2.1 列表和 Map 解构

```dart
// 列表解构
var [a, b, ...rest] = [1, 2, 3, 4, 5];
// a = 1, b = 2, rest = [3, 4, 5]

// Map 解构
var {'name': name, 'age': age} = {'name': 'Alice', 'age': 30};
// name = 'Alice', age = 30
```

### 2.2 Switch 表达式进阶

```dart
// 守卫子句（when）
String evaluateGrade(int score) => switch (score) {
  >= 90 => 'A',
  >= 80 => 'B',
  >= 70 => 'C',
  >= 60 => 'D',
  _     => 'F',
};

// 逻辑或（||）
String describeDay(String day) => switch (day) {
  'Monday' || 'Tuesday' || 'Wednesday' || 'Thursday' || 'Friday' => '工作日',
  'Saturday' || 'Sunday' => '周末',
  _ => '未知',
};
```

### 2.3 Records — 轻量匿名聚合

当你只需要临时打包几个值而不想定义完整类时，用 Records：

```dart
var pair = (1, 'hello');                             // (int, String)
var named = (name: 'Flutter', version: 3);           // 命名字段

// 访问字段
print(pair.$1);                                      // 1（位置字段用 $N）
print(named.name);                                   // Flutter（命名字段直接用名字）

// 多返回值——Records 最常见的用途
(String, int) getUserInfo() => ('Alice', 30);
var (name, age) = getUserInfo();                     // 解构接收

// Records 值相等（不是引用相等）
print((1, 'hello') == (1, 'hello'));                 // true
```

> 📖 **延伸阅读**：[dart.cn/language/patterns](https://dart.cn/language/patterns) | [dart.cn/language/records](https://dart.cn/language/records)

---

## 3. 健全空安全（Sound Null Safety）

Dart 的空安全是**健全的**——如果类型系统说变量不可为 null，运行时它就绝不可能是 null。

### 3.1 可空与非空类型

```dart
// 非空类型（默认）
String name = 'Dart';                                // 永远不能为 null

// 可空类型（加 ?）
String? maybeName;                                   // 可以是 null

// 类型提升——编译器自动追踪 null 检查
void printLength(String? text) {
  // text.length;                                    // ❌ 编译错误
  if (text != null) {
    print(text.length);                              // ✅ 被提升为 String
  }
}
```

### 3.2 空安全操作符

```dart
String? maybeString;

// ?. — 安全访问（如果为 null 则短路）
print(maybeString?.length);                          // null

// ?? — 空值合并（为 null 时用默认值）
String text = maybeString ?? '默认值';

// ??= — 空值赋值（如果为 null 才赋值）
maybeString ??= '赋值';

// ! — 非空断言（"我保证它不是 null"，危险操作！）
// String s = maybeString!;                          // 如果 null → 运行时崩溃
// 优先使用 ?. 和 ??，避免 ! 出现在生产代码中
```

### 3.3 late 与 required

```dart
// late — 承诺在使用前初始化
class DatabaseConnection {
  late final String connectionString;

  void init(String host, String port) {
    connectionString = 'postgres://$host:$port';
  }
}

// required — 让命名参数不可省略
void createUser({
  required String name,
  required String email,
  int? age,
}) {
  // name 和 email 保证非 null——不需要 null 检查
}
```

> 📖 **延伸阅读**：[dart.cn/null-safety](https://dart.cn/null-safety)

---

## 4. Dart 工程化工具链

### 4.1 dart analyze — 静态分析

```bash
# 检查所有 Dart 文件的错误和警告
dart analyze

# Flutter 项目中
flutter analyze
```

分析规则分四个级别：

| 级别 | 含义 | 策略 |
|------|------|------|
| `error` | 编译错误——代码无法运行 | 必须修复 |
| `warning` | 潜在问题 | 必须修复（建议提升为 error） |
| `info` | 风格建议 | 逐步修复 |
| `lint` | 代码风格规则 | 团队统一 |

### 4.2 dart format — 代码格式化

```bash
# 格式化所有文件
dart format lib/

# CI 中检查格式（不规范则失败）
dart format --set-exit-if-changed lib/
```

Dart 的格式化器是**权威的**——没有配置项（除了行宽）。团队中不会有格式争议。

### 4.3 dart fix — 自动修复

```bash
# 预览可自动修复的问题
dart fix --dry-run

# 自动应用所有修复
dart fix --apply
```

---

## 5. analysis_options.yaml — 项目质量配置

配置 Library App 的静态分析基线：

```yaml
# analysis_options.yaml
# 定义 Dart 静态分析规则

include: package:flutter_lints/flutter.yaml

analyzer:
  language:
    strict-casts: true              # 禁止隐式类型转换
    strict-inference: true          # 类型推断缺失时报错
    strict-raw-types: true          # 禁止省略泛型参数

  errors:
    missing_return: error
    dead_code: error
    unused_import: error
    unused_local_variable: error

  exclude:
    - "**/*.g.dart"                 # 代码生成文件不检查
    - "**/*.freezed.dart"

linter:
  rules:
    - always_declare_return_types
    - annotate_overrides
    - prefer_const_constructors       # 性能关键
    - prefer_const_declarations
    - require_trailing_commas         # 更好的格式化
    - avoid_print                     # 用 debugPrint 替代
    - avoid_empty_else
    - avoid_void_async
    - unnecessary_null_checks
    - use_super_parameters
    - prefer_single_quotes
```

验证配置：

```bash
flutter analyze
# 预期：0 errors, 0 warnings
```

---

## 6. 图书馆 App 实战

### 6.1 ApiResult — sealed class 联合类型

```dart
// lib/models/api_result.dart
// 整个 App 所有 API 调用统一使用此类型

sealed class ApiResult<T> {
  const ApiResult();

  bool get isSuccess => this is Success<T>;
  bool get isFailure => this is Failure<T>;

  T? get data => switch (this) {
        Success(data: final d) => d,
        Failure() => null,
      };

  String? get errorMessage => switch (this) {
        Success() => null,
        Failure(message: final m) => m,
      };

  // fold — 统一处理成功和失败
  R fold<R>({
    required R Function(T data) onSuccess,
    required R Function(String message) onFailure,
  }) =>
      switch (this) {
        Success(data: final d) => onSuccess(d),
        Failure(message: final m) => onFailure(m),
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

### 6.2 使用 ApiResult

```dart
// 模拟 API 调用
Future<ApiResult<String>> fetchBookTitle() async {
  try {
    // 模拟网络请求
    await Future.delayed(const Duration(seconds: 1));
    return Success('Clean Code');
  } catch (e) {
    return Failure('网络请求失败: $e');
  }
}

// 使用 sealed class + switch 处理结果
Future<void> loadBook() async {
  final result = await fetchBookTitle();

  // 方式 1：switch 表达式（编译时完备性检查）
  final message = switch (result) {
    Success(data: final title) => '书名: $title',
    Failure(message: final error) => '错误: $error',
  };
  print(message);

  // 方式 2：fold 模式
  result.fold(
    onSuccess: (title) => print('✅ $title'),
    onFailure: (error) => print('❌ $error'),
  );
}
```

---

## 7. 常见错误与最佳实践

### 常见错误

```dart
// ❌ sealed class 的子类在另一个文件定义
// file_a.dart: sealed class MyResult {}
// file_b.dart: class Success extends MyResult {}  // 编译错误！

// ❌ 滥用 ! 操作符
String? maybeNull;
// var x = maybeNull!;            // 如果 null → 运行时崩溃
var x = maybeNull ?? 'fallback';  // ✅

// ❌ switch 表达式遗漏分支
enum Status { active, inactive, pending }
// String s = switch (status) {   // ❌ 漏了 pending
//   Status.active => '激活',
//   Status.inactive => '未激活',
// };
// 编译器报错：not exhaustively matched

// ❌ 使用 print 而不是 debugPrint
print('Debug info');              // Android 上可能丢消息
debugPrint('Debug info');         // ✅ Flutter 的 throttle 版本
```

### 最佳实践

1. **所有"结果类型"都用 sealed class**：`ApiResult<T>`、`AuthState`，利用 switch 完备性检查防止分支遗漏
2. **默认非空，仅在确实需要时才用 `?`**：大多数场景用 `late` 延迟初始化比用 `?` 更清晰
3. **避免 `!` 出现在生产代码中**：每次看到 `!` 都问自己"有没有更安全的方式？"
4. **项目第一天就配置 `analysis_options.yaml`**：`strict-casts`、`strict-inference`、`strict-raw-types` 全开
5. **`dart format --set-exit-if-changed lib/` 放入 CI**：格式不规范的 PR 直接拒绝

---

## 8. 本章小结

| 你学到了什么 | 在图书馆 App 中的体现 |
|-------------|---------------------|
| sealed class + switch 表达式 | `ApiResult<T>` 密封联合类型 |
| 模式匹配解构 | Success/Failure 的对象模式匹配 |
| 健全空安全（?/??/?./!/late/required） | 所有模型字段的空安全声明 |
| dart analyze/format/fix 工具链 | `analysis_options.yaml` 严格配置 |
| apire result fold 模式 | API 结果的统一处理 |

---

> **下一步**: [Part II — 界面基石：Widget 与布局](../Part-02-界面基石/)
