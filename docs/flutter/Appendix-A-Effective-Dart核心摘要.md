# 附录 A：Effective Dart 核心摘要

> 原文: [dart.cn/effective-dart](https://dart.cn/effective-dart)

## 风格指南

- **命名**：类/枚举/类型别名用 `UpperCamelCase`；变量/函数/方法用 `lowerCamelCase`；常量用 `lowerCamelCase`（不用 SCREAMING_CAPS）；文件用 `lowercase_with_underscores`
- **排序**：`dart:` 导入 → `package:` 导入 → 相对路径导入，各组间空行分隔
- **格式化**：使用 `dart format`（等同于 Prettier——无需讨论风格）

## 文档指南

- **`///`** 文档注释（非 `//` 或 `/* */`）——生成 HTML API 文档
- 首句应为简短总结句（以句号结尾）
- 用方括号 `[ClassName]` 引用类/方法
- 代码示例用 ` ```dart ` 包裹

## 使用指南

- **`const`**：能 const 就 const
- **`final`**：不需要重新赋值的变量用 final（非 var）
- **`??`**：用 `??` 而非显式 `== null ? ... : ...`
- **`is`**：用 `is` 而非 `runtimeType == ...`
- **集合**：用字面量 `[]`/`{}` 而非构造函数
- **异步**：不用 `Future(() => ...)`，用 `Future.delayed()`

## 设计指南

- **避免** `dynamic`——用 `Object?` 或泛型
- **避免** `List.forEach()` —— 用 `for-in`
- **优先** 命名参数（`{required ...}`）而非位置参数
- **优先** 组合而非继承（mixin 替代多继承）
