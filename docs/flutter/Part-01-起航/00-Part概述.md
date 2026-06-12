# Part I — 起航：环境与 Dart 语言

> **前置**: [Part 00 — Flutter 概述](../Part-00-Flutter概述/)
>
> **本 Part 总览**：搭建 Flutter 开发环境，掌握 Dart 语言核心语法，建立调试能力和工程化基础。完成本阶段后，你将拥有一个配置完整的 Library App 项目骨架和扎实的 Dart 语法功底。

---

## Part I 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Ch01](./Chapter-01-环境搭建与Flutter架构初探.md) | 环境搭建 + 调试速通 + 项目最佳实践 | SDK安装/四层架构/三棵树/断点调试/项目初始化 | `flutter create library_app` + 调试能力 + lint配置 |
| [Ch02](./Chapter-02-Dart核心语法速通-上.md) | Dart 语法速通（上） | 变量/类型/函数/async-await/控制流/异常 | `lib/utils/dart_syntax_practice.dart` |
| [Ch03](./Chapter-03-Dart-Stream流式编程.md) | Dart Stream 流式编程 | async*+yield/StreamBuilder/内存管理 | Stream 概念 + UI 连接 |
| [Ch04](./Chapter-04-Dart核心语法速通-下.md) | Dart 语法速通（下） | 类/构造/继承/Mixin/枚举/泛型/扩展 | `lib/models/book.dart` |
| [Ch05](./Chapter-05-Dart3新特性与工程化基础.md) | Dart 3 新特性 | sealed class/模式匹配/空安全/dart analyze | `lib/models/api_result.dart` + `analysis_options.yaml` |

---

## Part I 学习目标检查清单

- [ ] 你能独立完成 `flutter create` 并配置好 lint、调试环境、目录结构吗？
- [ ] 你能用 VS Code 断点调试 Flutter App，解读红屏错误信息吗？
- [ ] 你能解释 `var`/`final`/`const`/`late` 的区别和选择场景吗？
- [ ] 你能写一个 `async/await` 函数并用 `try-catch` 处理错误吗？
- [ ] 你能定义一个包含构造函数、getter、fromJson/toJson 的 Dart 类吗？
- [ ] 你能用 sealed class + switch 表达式实现编译时安全的结果处理吗？

### Part I 独立练习

**用纯 Dart 编写一个命令行图书管理程序**——不接受任何 Flutter Widget 代码，纯 Dart：

1. 定义 Book 类（id/title/author/category/publishYear）
2. 实现内存中的图书 CRUD（List\<Book\> 存储）
3. 支持按分类筛选、按书名搜索
4. 支持 JSON 导入/导出（读取/写入本地文件）
5. 所有操作通过命令行菜单交互（print + stdin.readLineSync）

---

> **下一步**: [Part II — 界面基石：Widget、布局、表单、主题](../Part-02-界面基石/)
