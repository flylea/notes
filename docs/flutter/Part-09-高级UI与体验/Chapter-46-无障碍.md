# 第 46 章：无障碍（Accessibility）

> **Part**: Part IX — 高级 UI 与体验
> **上一章**: [Chapter 45 — 国际化](./Chapter-45-国际化.md)
> **下一章**: [Chapter 47 — 高级 UI 效果](./Chapter-47-高级UI效果.md)
> **官方文档**: [flutter.dev/ui/accessibility](https://docs.flutter.dev/ui/accessibility-and-internationalization/accessibility)

---

## 0. 本章目标

- 理解无障碍的核心原则：所有用户都应能使用你的 App
- 掌握 Semantics Widget 为自定义组件添加描述
- 学会动态内容变化的无障碍通知
- 能进行 TalkBack（Android）/ VoiceOver（iOS）测试

> 🎯 **本章产出**：Library App 通过 TalkBack/VoiceOver 基础可用性测试。

---

## 1. 为什么做无障碍

- **法律要求**：部分国家和地区有强制性无障碍法规
- **用户群体**：全球超 10 亿人需要无障碍支持（WHO 数据）
- **对所有人有益**：清晰的对比度、足够的触摸目标、明确的焦点顺序提升所有人的体验

Flutter 的无障碍体系建立在 **Semantics 树**之上——每个 Widget 都可通过 `Semantics` 提供描述信息。

---

## 2. Semantics 基础

```dart
// ❌ 屏幕阅读器只读出 "button"——用户不知道功能
IconButton(
  icon: const Icon(Icons.bookmark),
  onPressed: () => borrowBook(),
);

// ✅ 提供明确的语义描述
Semantics(
  label: '借阅《${book.title}》',
  hint: '双击借阅该书',
  button: true,
  child: IconButton(
    icon: const Icon(Icons.bookmark),
    onPressed: () => borrowBook(),
  ),
);
```

### 常用语义属性

| 属性 | 用途 | 示例 |
|------|------|------|
| `label` | 朗读的主要描述 | `'Clean Code，作者 Martin'` |
| `hint` | 操作提示 | `'双击查看详情'` |
| `value` | 状态值 | `'4.5分'`、`'已借出'` |
| `button` | 标记为按钮 | `true` |
| `enabled` | 是否可用 | 不可借时为 `false`，阅读器读"已停用" |
| `selected` | 选中状态 | Tab 切换时 |
| `liveRegion` | 动态变化自动通知 | `true` |

---

## 3. 合并与排除语义

```dart
// excludeSemantics — 装饰性元素不朗读
ExcludeSemantics(
  child: Image.asset('decorative_bg.png'),
);

// mergeSemantics — 多个子元素合并为一个语义节点
MergeSemantics(
  child: Row(
    children: [
      const Icon(Icons.star, color: Colors.amber, size: 16),
      Text('${book.rating}'),
    ],
  ),
);
// 屏幕阅读器读出："4.5 星"——自然流畅，而非分成两个独立元素
```

---

## 4. 自定义组件的无障碍适配

```dart
class BookCard extends StatelessWidget {
  final Book book;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${book.title}，${book.author}',
      hint: book.isAvailable ? '双击查看详情' : '当前不可借阅',
      value: '评分 ${book.rating}',
      button: onTap != null,
      enabled: book.isAvailable,
      child: GestureDetector(
        onTap: onTap,
        child: Card(/* ... UI ... */),
      ),
    );
  }
}
```

---

## 5. 动态内容变化通知

```dart
// 数据加载完成后通知屏幕阅读器
class BookListScreen extends ConsumerStatefulWidget {
  @override
  ConsumerState<BookListScreen> createState() => _BookListScreenState();
}

class _BookListScreenState extends ConsumerState<BookListScreen> {
  @override
  Widget build(BuildContext context) {
    final asyncBooks = ref.watch(bookListProvider);

    return asyncBooks.when(
      data: (books) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          SemanticsService.announce(
            '加载了 ${books.length} 本书',
            TextDirection.ltr,
          );
        });
        return BookGridView(books: books);
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorView(message: e.toString()),
    );
  }
}
```

---

## 6. 对比度与文本缩放

```dart
// 检测高对比度模式
final isHighContrast = MediaQuery.of(context).highContrast;

// 限制最大字体缩放——防止超大字体破坏布局
MediaQuery(
  data: MediaQuery.of(context).copyWith(
    textScaleFactor: MediaQuery.of(context).textScaleFactor.clamp(1.0, 1.5),
  ),
  child: MyWidget(),
);
```

WCAG AA 对比度要求：正常文本 ≥ 4.5:1，大文本（18px+ 粗体或 24px+ 常规）≥ 3:1。Material 3 的默认 ColorScheme 通常满足此要求。

---

## 7. 键盘导航

桌面端用户需要键盘完整操作：

```dart
// Tab 键焦点顺序
FocusTraversalGroup(
  policy: OrderedTraversalPolicy(),
  child: Column(children: [
    Focus(autofocus: true, child: const TextField(decoration: ...)),
    Focus(child: ElevatedButton(onPressed: () {}, child: const Text('搜索'))),
  ]),
);

// 快捷键
Shortcuts(
  shortcuts: {
    LogicalKeySet(LogicalKeyboardKey.escape): const Intent(ActivateAction()),
  },
  child: /* ... */,
);
```

---

## 8. 屏幕阅读器测试

### TalkBack (Android)
1. 设置 → 无障碍 → TalkBack → 开启
2. 手势：单击=选中（绿框）、双击=激活、双指滑动=滚动
3. 验证：焦点顺序合理、控件有描述、图片有替代文本

### VoiceOver (iOS)
1. 设置 → 辅助功能 → VoiceOver → 开启
2. 验证内容同上

### 自动化检查

```dart
// test/widgets/book_card_a11y_test.dart
testWidgets('BookCard 提供无障碍标签', (tester) async {
  await tester.pumpWidget(
    const MaterialApp(home: Scaffold(body: BookCard(book: testBook))),
  );

  expect(find.bySemanticsLabel(RegExp('Clean Code')), findsOneWidget);
  expect(find.bySemanticsLabel(RegExp('评分')), findsOneWidget);
});
```

---

## 9. 无障碍检查清单

- [ ] 所有可交互元素有语义标签
- [ ] 图片有替代文本（装饰性图片用 `ExcludeSemantics`）
- [ ] 色彩不是传达信息的唯一手段
- [ ] 文字与背景对比度满足 WCAG AA
- [ ] 所有功能可通过键盘操作
- [ ] 动态内容变化通过 `SemanticsService.announce` 通知
- [ ] 表单验证错误信息可被屏幕阅读器访问

---

## 10. 本章练习

1. 为 Library App 中 3 个核心组件添加 Semantics 适配（BookCard、SearchBar、BottomNav）
2. 在 Android 模拟器开启 TalkBack，完成"浏览列表→打开详情→借阅→返回"的全流程
3. 为图书列表数据加载添加 `SemanticsService.announce` 通知
4. 检查并修复：所有装饰性图标添加 `ExcludeSemantics`，所有交互按钮添加 `Semantics.label`

验证：TalkBack 开启后可仅通过朗读完成借阅一本书的完整流程。

---

> 📖 **延伸阅读**: [Flutter 无障碍文档](https://docs.flutter.dev/ui/accessibility) | [WCAG 2.1](https://www.w3.org/TR/WCAG21/) | [Semantics API](https://api.flutter.dev/flutter/widgets/Semantics-class.html)
