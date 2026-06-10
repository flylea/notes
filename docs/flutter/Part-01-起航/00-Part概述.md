# Part I — 起航：环境与 Dart 语言

> **Part 总览**：本阶段是 Flutter 学习的起航阶段——搭建开发环境，掌握 Dart 语言核心语法，建立现代 Dart 工程化基础。完成本阶段后，你将拥有一个配置完成的 Library App 项目骨架、扎实的 Dart 语法功底、以及严格的代码质量基线。

---

## Part I 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Chapter 01](./Chapter-01-环境搭建与Flutter架构初探.md) | 环境搭建与 Flutter 架构初探 | SDK 安装 / flutter doctor / 四层架构 / 三棵树 / Hot Reload | `flutter create library_app` + Hello World |
| [Chapter 02](./Chapter-02-Dart核心语法速通-上.md) | Dart 核心语法速通（上） | 变量声明 / 内置类型 / 函数参数 / async-await 异步编程 / 控制流 / 异常处理 | `lib/utils/dart_syntax_practice.dart` |
| [Chapter 02b](./Chapter-02b-Dart-Stream流式编程.md) | Dart Stream — 异步流式编程 | async*+yield / StreamBuilder / 内存管理 / 图书馆应用场景 | Stream 概念理解 + UI 连接准备 |
| [Chapter 03](./Chapter-03-Dart核心语法速通-下.md) | Dart 核心语法速通（下） | 类与构造 / 继承与 Mixin / 增强枚举 / 泛型 / 扩展方法 | `lib/models/book.dart` |
| [Chapter 04](./Chapter-04-Dart3新特性与工程化基础.md) | Dart 3 新特性与工程化 | sealed class / Switch 表达式 / 模式匹配 / 空安全 / 工具链 | `lib/models/api_result.dart` / `analysis_options.yaml` |

---

## Part I 学习目标检查清单

完成本阶段后，你应该能回答以下问题：

- [ ] Flutter 的四层架构分别是什么？每层用什么语言编写？
- [ ] Widget/Element/RenderObject 三棵树各自的职责是什么？
- [ ] Hot Reload 和 Hot Restart 的区别是什么？
- [ ] `var` / `final` / `const` / `late` 四种声明的区别和使用场景？
- [ ] Dart 函数四种参数类型分别是什么语法？
- [ ] `async` / `await` 如何工作？`Future.wait` 用于什么场景？
- [ ] 命名构造方法 `Book.fromJson()` 和 const 构造的区别？
- [ ] Dart 的 Mixin（`with`）如何实现代码复用？
- [ ] sealed class + switch 表达式如何实现编译时完备性检查？
- [ ] `analysis_options.yaml` 中的 `strict-casts: true` 有什么作用？

---

## Part I 完成后的 Library App 状态

```
library_app/
├── lib/
│   ├── main.dart                         # App 入口（Chapter 1）
│   ├── models/
│   │   ├── book.dart                     # Book 数据模型（Chapter 3）
│   │   └── api_result.dart               # ApiResult sealed class（Chapter 4）
│   └── utils/
│       └── dart_syntax_practice.dart      # Dart 语法练习脚本（Chapter 2）
├── analysis_options.yaml                 # 严格静态分析配置（Chapter 4）
├── pubspec.yaml                          # 项目配置
└── test/
    └── widget_test.dart                  # 默认测试文件
```

> 📌 **此时 App 还没有 UI**——它只有数据模型和分析配置。Chapter 5 开始，我们将把这套数据模型连接到屏幕上，让图书馆 App 真正"可见"。

---

> **下一步**: [Part II — 界面基石：Widget 与布局](../Part-02-界面基石/)
