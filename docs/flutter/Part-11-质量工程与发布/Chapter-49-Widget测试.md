> **Part**: Part XI | **上一章**: [Ch 48](./Chapter-48-单元测试.md) | **下一章**: [Ch 50](./Chapter-50-集成测试.md)
> **官方文档**: [flutter.cn/testing](https://docs.flutter.cn/testing)

---

# 第 49 章：Widget 测试

## 0. 本章目标

WidgetTester（pumpWidget/pump/pumpAndSettle/pumpDuration——四者的区别与使用时机）、Finder 完整指南（10+ 种查找方式）、模拟用户操作（tap/drag/scroll/enterText/longPress/fling）、ProviderScope.overrides 测试注入、Golden Tests 截图对比、与 React Testing Library 对照。

> 🎯 **Library App 产出**：BookCard 渲染/空态/交互测试、搜索框输入+防抖测试、登录表单验证测试、图书列表滚动测试、Golden 截图。

---

## 1. WidgetTester 四大泵方法

```dart
// pumpWidget — 挂载整个 Widget 树（测试开始）
await tester.pumpWidget(MyApp());

// pump — 推进一帧（触发当前帧的 build）
await tester.pump();  // 推进 16ms（单帧）

// pump 指定时间——推进 N 毫秒（用于动画中间帧检查）
await tester.pump(const Duration(milliseconds: 300));

// pumpAndSettle — 循环推进直到没有待处理的帧（动画完成/异步操作完成）
await tester.pumpAndSettle();  // 默认超时 10 秒
// ⚠️ 如果动画永不停止（如 CircularProgressIndicator），pumpAndSettle 会超时
// 此时用 pump(Duration) 手动推进
```

## 2. Finder 完整列表

```dart
find.text('Clean Code');                              // 匹配 Text Widget 的文字
find.textContaining('Clean');                         // 包含文字
find.byType(BookCard);                                // 匹配 Widget 类型
find.byIcon(Icons.star);                              // 匹配图标
find.byKey(const ValueKey('book-card-1'));            // 匹配 Key
find.byTooltip('搜索');                                // 匹配 tooltip
find.byWidgetPredicate((w) => w is Container && ...); // 自定义条件
find.ancestor(of: find.text('Title'), matching: find.byType(Card));  // 祖先
find.descendant(of: find.byType(Card), matching: find.text('Title')); // 子孙
find.bySemanticsLabel('收藏此书');                     // Semantics label
```

## 3. 模拟用户操作

```dart
await tester.tap(find.byType(ElevatedButton));           // 点击
await tester.tap(find.text('登录'), warnIfMissed: true); // 如果找不到 widget 会警告
await tester.longPress(find.byType(BookCard));           // 长按
await tester.drag(find.byType(BookCard), const Offset(0, -300)); // 拖拽
await tester.fling(find.byType(ListView), const Offset(0, -500), 1000);  // 快滑
await tester.enterText(find.byType(TextField), 'Clean Code');  // 文本输入
await tester.scrollUntilVisible(find.text('Item 99'), 200);  // 滚动直到可见
```

## 4. 实战示例

```dart
testWidgets('BookCard displays book info', (tester) async {
  await tester.pumpWidget(ProviderScope(child: MaterialApp(home: Scaffold(body: BookCard(book: testBook)))));
  expect(find.text('Clean Code'), findsOneWidget);
  expect(find.text('Robert C. Martin'), findsOneWidget);
  expect(find.byIcon(Icons.star), findsWidgets);
});

testWidgets('Search filters on text input', (tester) async {
  await tester.pumpWidget(const ProviderScope(child: MaterialApp(home: HomeScreen())));
  await tester.enterText(find.byType(TextField), 'Design');
  await tester.pump(const Duration(milliseconds: 350)); // 等待防抖 300ms
  expect(find.text('Clean Code'), findsNothing);
});

testWidgets('Empty state when no books', (tester) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [bookListProvider.overrideWith((_) => Future.value([]))],
    child: const MaterialApp(home: HomeScreen()),
  ));
  await tester.pumpAndSettle();
  expect(find.text('暂无图书'), findsOneWidget);
});

testWidgets('Login form validates empty fields', (tester) async {
  await tester.pumpWidget(const ProviderScope(child: MaterialApp(home: LoginScreen())));
  await tester.tap(find.text('登录'));
  await tester.pumpAndSettle();
  expect(find.text('请输入有效的邮箱地址'), findsOneWidget);
});
```

## 5. Golden Tests

```dart
testWidgets('BookCard golden', (tester) async {
  await tester.pumpWidget(ProviderScope(child: MaterialApp(home: Scaffold(body: BookCard(book: testBook)))));
  await expectLater(find.byType(BookCard), matchesGoldenFile('goldens/book_card.png'));
});
// 首次运行生成 reference image，之后每次对比像素级差异
```

## 6. 与 React Testing Library 对照

| Flutter | RTL |
|---------|-----|
| `find.text('Hello')` | `screen.getByText('Hello')` |
| `find.byType(BookCard)` | `screen.getByRole(...)` |
| `tester.tap(...)` | `fireEvent.click(...)` / `userEvent.click(...)` |
| `tester.enterText(...)` | `userEvent.type(...)` |
| `pumpAndSettle()` | `waitFor(() => ...)` |
| `matchesGoldenFile(...)` | Jest snapshot matching |

---

> **下一步**: [Ch 50](./Chapter-50-集成测试.md)
