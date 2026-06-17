> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 62 — AI 开发](./Chapter-62-AI开发.md)
> **下一章**: [Chapter 69 — 结语](./Chapter-69-结语.md)

---

# 第 63 章：包与插件开发

## 0. 本章目标

Package vs Plugin（纯 Dart vs 含原生代码）、Federated Plugin 架构（面向接口编程：platform_interface + platform_implementation + app_facing）、pubspec.yaml 完整配置（version/environment/dependencies/topics/screenshots）、发布 pub.dev（dart pub publish + 评分优化）、Semantic Versioning、与 npm 开发发布的对比。

> 🎯 **Library App 产出**：将 BookCard 组件抽取为独立 Package `library_book_card` + 开发 ISBN 解析纯 Dart 包 + 发布到 pub.dev。

---

## 1. Package vs Plugin

```bash
# 纯 Dart Package（可跨平台共享，零原生代码）
flutter create --template package library_book_card

# Plugin（含平台原生代码）
flutter create --template plugin --platforms=android,ios,web isbn_scanner
```

| 类型 | 语言 | 适用 |
|------|------|------|
| **Package** | 纯 Dart | UI 组件/工具函数/数据处理 |
| **Plugin** | Dart + Kotlin/Swift/C++ | 调用原生 API（相机/蓝牙/传感器） |
| **Federated Plugin** | 接口+多实现 | 大型插件→平台实现解耦 |

## 2. 抽取 BookCard 为 Package

```dart
// packages/library_book_card/lib/library_book_card.dart
library library_book_card;
export 'src/book_card.dart';
export 'src/book_card_theme.dart';
export 'src/models/book_data.dart';

// packages/library_book_card/lib/src/book_card.dart
class BookCard extends StatelessWidget {
  final BookData book; final VoidCallback? onTap; final BookCardTheme? theme;
  const BookCard({super.key, required this.book, this.onTap, this.theme});
  @override Widget build(BuildContext context) { /* ... */ }
}

// packages/library_book_card/lib/src/models/book_data.dart
class BookData {
  final String title; final String author; final String? coverUrl; final double rating;
  const BookData({required this.title, required this.author, this.coverUrl, this.rating = 0.0});
}
```

## 3. pubspec.yaml 配置

```yaml
name: library_book_card
version: 1.0.0
description: A beautiful Material 3 book card widget for library and bookstore apps
repository: https://github.com/yourname/library_book_card
environment:
  sdk: '>=3.6.0 <4.0.0'
  flutter: '>=3.44.0'
dependencies:
  flutter: { sdk: flutter }
  cached_network_image: ^3.4.0
dev_dependencies:
  flutter_test: { sdk: flutter }
  flutter_lints: ^5.0.0

topics: [widget, book, library, card, material]
screenshots:
  - path: screenshots/book_card_grid.png
    description: 'Book cards displayed in a grid layout'
  - path: screenshots/book_card_light.png
    description: 'Book card in light theme'
```

## 4. 发布 pub.dev

```bash
dart pub publish --dry-run      # 检查能否发布
dart pub publish                # 正式发布
# 后续更新
# 修改 pubspec.yaml version → dart pub publish
```

## 5. Semantic Versioning

```
1.0.0 → MAJOR.MINOR.PATCH
PATCH: bug fix（1.0.0→1.0.1）
MINOR: 新功能向后兼容（1.0.1→1.1.0）
MAJOR: 不向后兼容的改动（1.1.0→2.0.0）
```

## 6. 与 npm 对照

| pub.dev | npm |
|---------|-----|
| `dart pub publish` | `npm publish` |
| `pubspec.yaml` | `package.json` |
| `dart pub get` | `npm install` |
| `dart pub outdated` | `npm outdated` |
| `dart pub upgrade` | `npm update` |
| pub.dev scoring (140 pts) | npm search ranking |

---

## 7. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 发布 `pub.dev` 前不运行 `dart pub publish --dry-run` | 不完整的包（缺少 README/LICENSE/CHANGELOG）被拒绝 | 先 `--dry-run` 检查，确保所有警告为零 |
| MAJOR 版本升级却引为 MINOR/PATCH | 下游消费者的代码编译失败，破坏信任 | 严格遵循 SemVer：破坏性改动 → MAJOR，新功能兼容 → MINOR，Bugfix → PATCH |
| Package 的 `pubspec.yaml` 不加 `publish_to: none` 导致误发布 | 练习包/私有包被意外发布到 pub.dev | 私有包设置 `publish_to: none` 阻止发布 |
| 不导出公共 API（缺少 `library` 和 `export`） | 包使用者 `import` 后找不到内部类 | 在 `lib/<package_name>.dart` 中 `export` 所有公开 API |
| 原生 Plugin 不声明 `platforms` 配置 | 不同平台构建失败，或 web 端误拉原生依赖 | 在 `pubspec.yaml` 的 `flutter.plugin.platforms` 中声明支持的平台 |

**最佳实践**：

- `flutter create --template package` 创建纯 Dart 包，`--template plugin` 创建含原生代码的插件
- Federated Plugin 架构：接口包 + 各平台实现包 + 前端包，解耦平台依赖
- `pubspec.yaml` 中 `topics` 和 `screenshots` 提升 pub.dev 搜索和展示效果
- 包内 `example/` 目录提供可运行的示例代码，是新用户的第一入口
- API 文档使用 `///` 三斜线注释，覆盖类、方法、参数的全量文档
- pub.dev 评分 140 分机制：代码格式、文档覆盖、平台支持、静态分析、依赖健康度
- 发布前确认 CHANGELOG.md 记录了当前版本的改动
- 与 npm 对照：`pubspec.yaml` ≈ `package.json`，`dart pub publish` ≈ `npm publish`，`topics` ≈ `keywords`

## 8. 本章练习

**练习 1：区分 package 与 plugin 的实际案例**
- 从 Library App 中提取一个纯 Dart 功能模块（如数据格式化工具类）为独立的 `package`
- 再尝试封装一个需要调用原生 API 的功能（如获取设备信息的 `device_info` 封装）为 `plugin`
- 对比两个项目的 `pubspec.yaml` 结构和目录差异
- 验证标准：`package` 项目不包含 `android/`/`ios/` 目录，`plugin` 项目包含平台通道代码

**练习 2：发布一个练习包到 pub.dev**
- 将练习 1 中创建的 `package` 完善：添加 `README.md`、`CHANGELOG.md`、`example/` 目录和 API 文档注释
- 使用 `dart pub publish --dry-run` 验证发布就绪状态
- 了解 pub.dev 的 140 分评分机制，检查你的包能得多少分
- 验证标准：`--dry-run` 无错误，评分 > 120 分（不强制实际发布）

**练习 3：为 Library App 集成社区包并评估质量**
- 选择一个本章推荐的社区包（如 `url_launcher`、`share_plus`），集成到 Library App 中实现分享图书功能
- 在 pub.dev 上查看该包的评分、最新更新时间、issue 活跃度
- 写一段简短的包质量评估（100 字以内），包括可靠性、维护状态和文档质量
- 验证标准：集成功能正常运行，评估报告覆盖三个维度

---

> **下一步**: [Chapter 64 — Flutter 最佳实践汇总](../Part-15-生态与结语/Chapter-64-Flutter最佳实践汇总.md)
