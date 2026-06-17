> **Part**: Part II — 界面基石：Widget、布局、表单、主题
> **上一章**: [Chapter 12 — Material 3 主题系统](./Chapter-12-Material3主题系统.md)
> **下一章**: [Part III — 导航与路由](../Part-03-导航与路由/)
> **官方文档**: [flutter.dev/testing](https://docs.flutter.dev/testing)

---

# 第 13 章：Widget 测试入门

## 0. 本章目标

- 理解 Widget 测试的定位：验证 UI 渲染和行为
- 掌握 `WidgetTester`、`pumpWidget`、`find`、`expect` 核心 API
- 能写出 Widget 渲染测试、交互测试、空态测试

> 🎯 **本章产出**：为 Library App 的核心 Widget（BookCard、空态页面、搜索栏）编写 Widget 测试。

---

## 1. Flutter 测试三层体系

Flutter 提供三层测试，从下到上逐层扩大覆盖范围：

| 测试类型 | 测试对象 | 速度 | 占比建议 |
|---------|---------|------|---------|
| 单元测试 (Unit) | 纯 Dart 类/函数/模型 | 极快 (<1s) | 70% |
| Widget 测试 (Widget) | 单个 Widget 的渲染和交互 | 快 (1-5s) | 20% |
| 集成测试 (Integration) | 完整 App 端到端流程 | 慢 (30s+) | 10% |

Widget 测试是本教程最先教授的测试类型——你现在已经能构建完整的静态界面了，应该立刻学习验证它们。

---

## 2. 第一个 Widget 测试

### 2.1 测试文件约定

```
library_app/
├── lib/
│   └── widgets/
│       └── book_card.dart         # 被测 Widget
└── test/
    └── widgets/
        └── book_card_test.dart    # 测试文件（命名：xxx_test.dart）
```

### 2.2 测试一个简单 Widget

```dart
// test/widgets/book_card_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:library_app/widgets/book_card.dart';
import 'package:library_app/models/book.dart';

void main() {
  // 创建测试用 Book 数据
  final testBook = Book(
    id: '1',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    category: BookCategory.technology,
    publishYear: 2008,
  );

  testWidgets('BookCard 显示书名和作者', (WidgetTester tester) async {
    // ① pumpWidget — 将 Widget 挂载到测试环境
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: BookCard(book: testBook))),
    );

    // ② find — 查找 Widget
    expect(find.text('Clean Code'), findsOneWidget);
    expect(find.text('Robert C. Martin'), findsOneWidget);
  });
}
```

### 2.3 核心 API 速查

| API | 用途 |
|-----|------|
| `tester.pumpWidget(widget)` | 渲染 Widget 到测试环境 |
| `tester.pump()` | 触发一帧重建（处理动画/定时器） |
| `tester.pumpAndSettle()` | 反复 pump 直到动画全部完成 |
| `tester.tap(finder)` | 模拟点击 |
| `tester.enterText(finder, text)` | 模拟文本输入 |
| `tester.scroll(finder, offset)` | 模拟滚动 |
| `find.text('xxx')` | 查找包含文本的 Widget |
| `find.byType(MyWidget)` | 按类型查找 Widget |
| `find.byKey(key)` | 按 Key 查找 Widget |
| `findsOneWidget` | 断言找到恰好 1 个 |
| `findsNothing` | 断言未找到 |
| `findsWidgets` | 断言找到至少 1 个 |
| `findsNWidgets(n)` | 断言找到恰好 N 个 |

---

## 3. 交互测试

测试用户操作后 UI 是否按预期更新：

```dart
testWidgets('点击图书卡片触发 onTap', (WidgetTester tester) async {
  String? tappedTitle;

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: BookCard(
          book: testBook,
          onTap: (book) => tappedTitle = book.title,
        ),
      ),
    ),
  );

  // 模拟点击
  await tester.tap(find.text('Clean Code'));
  await tester.pump();  // 触发重建

  expect(tappedTitle, 'Clean Code');
});
```

---

## 4. Library App Widget 测试实战

### 4.1 BookCard 空态测试

```dart
testWidgets('图片不可用时显示占位图标', (WidgetTester tester) async {
  await tester.pumpWidget(
    const MaterialApp(
      home: Scaffold(body: BookCard(book: testBookWithoutCover)),
    ),
  );

  // 验证占位图标存在
  expect(find.byIcon(Icons.menu_book), findsOneWidget);
});
```

### 4.2 搜索栏测试

```dart
testWidgets('输入搜索文本后显示清除按钮', (WidgetTester tester) async {
  await tester.pumpWidget(
    const MaterialApp(home: Scaffold(body: SearchBarWidget())),
  );

  // 输入文本
  await tester.enterText(find.byType(TextField), 'Clean');
  await tester.pump();

  // 验证清除按钮出现
  expect(find.byIcon(Icons.clear), findsOneWidget);
});
```

### 4.3 空列表状态测试

```dart
testWidgets('图书列表为空时显示空态', (WidgetTester tester) async {
  await tester.pumpWidget(
    const MaterialApp(home: Scaffold(body: BookListView(books: []))),
  );

  expect(find.text('暂无图书'), findsOneWidget);
});
```

---

## 5. 测试配置

确认 `pubspec.yaml` 中有测试依赖（`flutter create` 默认包含）：

```yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
```

运行测试：

```bash
# 运行所有测试
flutter test

# 运行指定测试文件
flutter test test/widgets/book_card_test.dart

# 查看覆盖率报告
flutter test --coverage
```

---

## 6. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 测试中不用 `MaterialApp` 包裹被测 Widget | `Theme.of(context)` 或 `MediaQuery` 报空指针异常 | 始终用 `MaterialApp` + `Scaffold` 提供基础上下文 |
| 交互后忘记 `tester.pump()` | Widget 状态不更新，断言仍基于旧状态 | `tap` / `enterText` 后立即 `await tester.pump()` 触发重建 |
| 对无限动画使用 `pumpAndSettle()` | 测试超时（10秒），因为动画永不停止 | 使用 `pump(Duration)` 手动推进到目标帧 |
| 通过 `find.text` 查找时忽略了富文本 | `RichText` / `Text.rich` 不会被子串匹配 | 使用 `find.textContaining()` 或 `find.byWidgetPredicate` |
| 测试文件放在错误目录导致未运行 | `flutter test` 未发现测试 | 测试文件必须放在 `test/` 目录下，命名为 `*_test.dart` |

**最佳实践**：

- 每个测试保持独立，不依赖其他测试的执行顺序
- 为测试创建专用的辅助函数 `pumpTestWidget(Widget child)` 减少重复
- 使用 `group()` 组织同一 Widget 的多个测试用例
- `find.byKey(ValueKey('xxx'))` 比 `find.text()` 更稳定，不受多语言影响
- 空态测试、加载态测试、错误态测试三者缺一不可
- 验证 `findsNothing` 时同时验证原因（如数据为空时占位文案出现）
- 避免在 Widget 测试中发起真实的网络请求，使用依赖注入替换数据源
- 运行 `flutter test --coverage` 定期检查测试覆盖率

## 7. 本章练习

1. 为 `BookCard` 编写 3 个测试用例：渲染测试、点击测试、空封面占位测试
2. 为 `BookGridItem` 编写渲染测试，验证评分星级正确显示
3. 为搜索栏编写测试：输入文本 → 显示清除按钮、点击清除按钮 → 文本清空

验证标准：`flutter test` 全部通过。

---

> **下一步**: [Part III — 导航与路由](../Part-03-导航与路由/)
>
> 📖 **延伸阅读**: [Flutter 测试官方文档](https://docs.flutter.dev/testing/overview) | [WidgetTester API](https://api.flutter.dev/flutter/flutter_test/WidgetTester-class.html)
