> **Part**: Part IV — 网络与数据
> **上一章**: [Chapter 18 — Retrofit 类型安全 API](./Chapter-18-Retrofit类型安全API.md)
> **下一章**: [Chapter 19b — 模型单元测试入门](./Chapter-19b-模型单元测试入门.md)
> **官方文档**: [pub.dev/packages/freezed](https://pub.dev/packages/freezed) | [flutter.cn/data-and-backend/serialization](https://docs.flutter.cn/data-and-backend/serialization)

---

# 第 19 章：freezed — JSON 序列化与代码生成

## 0. 本章目标与前置依赖

**前置依赖**：已有数据模型类（Chapter 3），理解 build_runner（Chapter 19）。

**本章目标**：掌握 freezed + json_serializable 组合重写所有数据模型、理解联合类型 sealed、生成 copyWith/==/hashCode/toString。

> 🎯 **本章会在图书馆 App 中做什么**：用 freezed + json_serializable 重写 Book/User/BorrowRecord/ApiResponse，添加 build.yaml 配置。

---

## 1. 手动 vs 代码生成

手写一个完整数据类的成本：
- `fromJson` — 10-30 行
- `toJson` — 10-30 行
- `copyWith` — 15-40 行
- `==` / `hashCode` — 5-10 行
- `toString` — 3 行
- 构造函数参数声明 — 5-20 行

**总计：一个 10 字段的模型类约需 60-120 行**，且容易出错（fromJson 和 toJson 字段名不匹配是最常见的 bug）。freezed + json_serializable 把这 120 行减少到 ~15 行。

---

## 2. 安装

```yaml
dependencies:
  freezed_annotation: ^2.4.0
  json_annotation: ^4.9.0

dev_dependencies:
  freezed: ^2.5.0
  json_serializable: ^6.8.0
  build_runner: ^2.4.0
```

```yaml
# build.yaml
targets:
  $default:
    builders:
      freezed:
        options:
          format: true
      json_serializable:
        options:
          field_rename: snake
          explicit_to_json: true
```

---

## 3. 重写 Book 模型

```dart
// lib/models/book.dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'book.freezed.dart';
part 'book.g.dart';

@freezed
class Book with _$Book {
  const factory Book({
    required String id,
    required String title,
    required String author,
    required String isbn,
    required BookCategory category,
    required int publishYear,
    String? coverUrl,
    String? description,
    @Default(0.0) double rating,
    @Default(1) int totalCopies,
    @Default(1) int availableCopies,
    @Default([]) List<String> tags,
  }) = _Book;

  // ① fromJson — 自动生成
  factory Book.fromJson(Map<String, dynamic> json) => _$BookFromJson(json);
}

// 增强枚举
enum BookCategory {
  @JsonValue('fiction') fiction(label: '小说'),
  @JsonValue('science') science(label: '科学'),
  @JsonValue('technology') technology(label: '技术'),
  @JsonValue('history') history(label: '历史'),
  @JsonValue('other') other(label: '其他');

  final String label;
  const BookCategory({required this.label});
}
```

**自动生成的内容**（`book.freezed.dart` 和 `book.g.dart`）：
- `copyWith` — 克隆+修改任意字段
- `==` / `hashCode` — 值相等判断
- `toString` — 可读的字符串表示
- `fromJson` / `toJson` — JSON 序列化（`field_rename: snake` 将 `publishYear` 映射为 `publish_year`）

---

## 4. 联合类型——用 sealed class 替代 enum

```dart
// lib/models/api_response.dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'api_response.freezed.dart';
part 'api_response.g.dart';

@freezed
sealed class ApiResponse<T> with _$ApiResponse<T> {
  const factory ApiResponse.success({
    required T data,
    @Default(200) int statusCode,
    String? message,
  }) = ApiSuccess<T>;

  const factory ApiResponse.error({
    required String message,
    @Default(500) int statusCode,
    Map<String, dynamic>? errors,
  }) = ApiError<T>;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Object?) fromJsonT,
  ) => _$ApiResponseFromJson(json, fromJsonT);
}
```

搭配 Riverpod switch 使用：
```dart
final result = await api.getBooks();
return switch (result) {
  ApiSuccess(:final data) => data,
  ApiError(:final message) => throw ApiException(message),
};
```

---

## 5. 常用注解速查

| 注解 | 作用 | 示例 |
|------|------|------|
| `@Default(value)` | 默认值 | `@Default(0) int count` |
| `@JsonKey(name: 'xxx')` | 字段名映射 | `@JsonKey(name: 'published_at') DateTime publishedAt` |
| `@JsonKey(ignore: true)` | 忽略字段 | `@JsonKey(ignore: true) String? cacheKey` |
| `@JsonKey(fromJson: ..., toJson: ...)` | 自定义转换 | `@JsonKey(fromJson: _fromJson, toJson: _toJson)` |
| `@JsonValue('xxx')` | 枚举值映射 | `@JsonValue('science')` |

---

## 6. Dart Macros 前瞻

Dart 语言级宏（Macro）正在开发中——`@JsonEncodable()` 等宏将内置于编译器，**不再需要 build_runner 和 .g.dart 文件**。届时 freezed 和 json_serializable 的大部分功能将被语言原生支持。过渡策略：当前继续使用 freezed，关注 Dart 版本迭代，Macro 稳定后评估迁移。

---

## 7. 常见错误与最佳实践

### 常见错误

| 错误描述 | 后果 | 正确做法 |
|---------|------|----------|
| 忘记添加 `part 'xxx.freezed.dart'` 和 `part 'xxx.g.dart'` | 编译错误：找不到 `_$BookFromJson` 或 `_$Book` | 确保两个 part 指令都添加，`freezed.dart` 在 `g.dart` 之前 |
| `fromJson` 字段名与 JSON key 不一致（如 `publishYear` vs `publish_year`） | 序列化时字段为 null，无任何编译警告 | 统一在 `build.yaml` 配置 `field_rename: snake`，或逐个加 `@JsonKey(name:)` |
| 联合类型未使用 `sealed` | switch 必须写 `default` 分支，编译器无法穷举检查 | 用 `sealed class` 确保 switch 语法强制覆盖所有子类型 |
| `@Default` 用于 `required` 字段 | 编译错误：默认值对必填字段无效 | `@Default` 仅用于非 required 字段，如 `int? count` 或 `@Default(0) int count` |
| 手动修改 `.freezed.dart` 或 `.g.dart` 文件 | 下次 `build_runner` 运行时修改被覆盖 | 永远只修改源 `.dart` 文件，生成文件由工具维护 |

### 最佳实践

- 在项目根 `build.yaml` 统一配置 `field_rename: snake` 和 `explicit_to_json: true`，避免逐类设置
- 用 `sealed` 联合类型建模 API 响应状态（`ApiSuccess` / `ApiError`），配合 Dart 3 switch 穷举消除漏处理
- 枚举值始终加 `@JsonValue`，防止前后端字段拼写不一致导致反序列化失败
- `@JsonKey(fromJson:, toJson:)` 处理 DateTime（`_dateFromJson`/`_dateToJson`）等自定义类型转换
- 复杂嵌套泛型 JSON 用 `fromJsonT` 参数传递反序列化函数，如 `factory ApiResponse.fromJson(json, T Function(Object?) fromJsonT)`
- 开发期使用 `dart run build_runner watch` 自动监听文件变化，无需手动触发
- 与 Retrofit 配合时，Retrofit 的返回类型直接使用 freezed 数据类，形成完整类型安全链路
- 模型单元测试覆盖 `fromJson`/`toJson` 往返，确保 `field_rename` 规则生效

---

## 8. 本章小结

freezed + json_serializable 将数据模型类的样板代码减少 80%+。`@freezed` 生成 copyWith/==/hashCode/toString/sealed 联合类型，`@JsonSerializable` 生成 fromJson/toJson。`build_runner watch` 监听文件变化自动重新生成。

---

## 9. 本章练习

1. 将 Library App 的 `Book` 模型迁移到 freezed（添加 `@freezed` + `@JsonSerializable`），生成 `copyWith`/`==`/`fromJson`/`toJson`
2. 为 `Book` 添加 `@JsonKey(name: 'publish_year')` 字段映射，验证 `fromJson` 正确解析 snake_case JSON
3. 用 freezed 的 `@Default` 为 `Book` 的 `rating` 默认 0.0、`tags` 默认空列表

验证标准：`dart run build_runner build` 成功，`book.freezed.dart` 和 `book.g.dart` 生成无误。

> **下一步**: [Chapter 20 — Supabase 集成](./Chapter-20-Supabase集成.md)
> **原始文档**: [pub.dev/packages/freezed](https://pub.dev/packages/freezed)
