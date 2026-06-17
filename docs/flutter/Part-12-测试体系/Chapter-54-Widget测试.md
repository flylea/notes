> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 53 — 单元测试](./Chapter-53-单元测试.md)
> **下一章**: [Chapter 55 — 集成测试](./Chapter-55-集成测试.md)
> **官方文档**: [flutter.cn/testing](https://docs.flutter.cn/testing)

---

# 第 54 章：Widget 测试

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

## 7. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 混淆 `pump()` 和 `pumpAndSettle()` 的使用场景 | pump 后动画未完成断言失败；pumpAndSettle 在无限动画中超时 | 交互后单帧检查用 `pump()`，等待所有动画完成用 `pumpAndSettle()` |
| Widget 测试中不提供 `ProviderScope` / 依赖注入 | 依赖未初始化导致测试崩溃 | 用 `ProviderScope(overrides: [...])` 包裹并提供 Fake 实现 |
| 仅用 `find.text()` 无 ignoreCase 敏感度 | 大小写不匹配导致查找失败 | 多语言/动态文案用 `find.byKey(ValueKey)` 替代 |
| Golden 测试不固定环境尺寸 | CI 与本地分辨率不同，截图不一致 | `setSurfaceSize(Size(800, 600))` 固定尺寸后再对比 |
| 直接操作 `TextField` 不验证防抖逻辑 | 测试忽略防抖时间窗，导致线上与测试行为不一致 | `pump(Duration(milliseconds: 350))` 模拟防抖延迟 |

**最佳实践**：

- 使用 `pumpWidget` 而不是多次 `pump()` 来初始化测试
- 对 Provider 依赖的 Widget，始终在测试中提供 `ProviderScope.overrides`
- 复杂交互按用户操作顺序编写：tap → pump → find → expect
- 使用 `find.ancestor` / `find.descendant` 验证 Widget 层级关系
- Golden 测试文件提交到 Git，作为视觉回归的基线
- 提取 `WidgetTester` 的扩展方法或工具函数减少重复代码
- 命名测试用例为"场景 + 预期结果"格式（如 `BookCard 显示书名和作者`）
- 为每个 Widget 覆盖正常态 + 空态 + 加载态 + 错误态四种状态

## 8. 本章练习

**练习 1：为 Library App 的 BookCard 组件编写 Widget 测试**
- 使用 `pumpWidget` 渲染一个包含 `BookCard` 的 `MaterialApp`
- 使用 `find.text` 验证书名和作者正确显示
- 使用 `tester.tap` 点击卡片，验证 `onTap` 回调被触发
- 验证标准：运行 `flutter test test/widgets/book_card_test.dart` 全部通过

**练习 2：为 Library App 的搜索栏编写交互测试**
- 渲染包含 `TextField` 的搜索组件
- 使用 `tester.enterText` 输入搜索关键词
- 验证输入后 UI 状态正确更新（如显示清除按钮）
- 验证标准：交互流程完整通过，覆盖输入→验证→清除三个步骤

**练习 3：为 BookCard 编写 Golden 测试**
- 设置 `TestWidgetsFlutterBinding` 的 surface size 为固定尺寸
- 使用 `matchesGoldenFile` 对比 BookCard 的渲染截图
- 首次运行生成 reference image，第二次运行验证像素一致性
- 验证标准：Golden 文件存在于 `test/goldens/` 目录，且对比通过

---

> **下一步**: [Chapter 55 — 集成测试](./Chapter-55-集成测试.md)
