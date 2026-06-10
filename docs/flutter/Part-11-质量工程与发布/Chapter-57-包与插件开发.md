> **Part**: Part XI | **上一章**: [Ch 56](./Chapter-56-AI开发.md) | **下一章**: [Ch 58](./Chapter-58-结语.md)

---

# 第 57 章：包与插件开发

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

> **下一步**: [Ch 58 — 结语](./Chapter-58-结语.md)
