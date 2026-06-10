> **Part**: Part IX | **上一章**: [Ch 40](./Chapter-40-国际化.md) | **下一章**: [Ch 42](./Chapter-42-高级UI效果.md)
> **官方文档**: [flutter.cn/ui/accessibility](https://docs.flutter.cn/ui/accessibility)

---

# 第 41 章：无障碍（Accessibility）

## 0. 本章目标

Semantics Widget（label/value/hint/onTap/excludeSemantics/MergeSemantics）、TalkBack/VoiceOver 测试、WCAG AA 对比度（正文 4.5:1，大文字 3:1）、textScaleFactor 缩放、键盘导航（Focus/FocusTraversalGroup）、与 Web ARIA 对照。

> 🎯 **Library App 产出**：所有交互元素添加 Semantics Label、高对比度模式、大字体支持、桌面键盘导航。

---

## 1. Semantics Widget

```dart
// 图标按钮——必须提供语义标签
IconButton(
  icon: const Icon(Icons.star),
  onPressed: _toggleFavorite,
).semantics(label: '收藏《${book.title}》', hint: '双击以添加或移除收藏');

// 自定义组件——用 Semantics 包裹
Semantics(
  label: '评分 ${book.rating} 星（满分 5 星）',
  value: '${book.rating}',
  child: StarRating(rating: book.rating),
);

// 装饰性元素——排除语义
ExcludeSemantics(child: Image.asset('decorative_bg.png'));

// 合并语义组——Column 内的多个 Text 合并为一个语义单元
MergeSemantics(
  child: Column(children: [Text('Clean Code'), Text('Robert C. Martin')]),
);
```

## 2. 屏幕阅读器测试

```bash
# Android: 设置→无障碍→TalkBack 开启→触摸屏幕元素→验证朗读的 label 是否准确
# iOS: 设置→辅助功能→VoiceOver 开启→同上
```

## 3. 对比度与文本缩放

```dart
// 高对比度模式检测
final isHighContrast = MediaQuery.of(context).highContrast;

// 限制最大字体缩放
MediaQuery(
  data: MediaQuery.of(context).copyWith(textScaleFactor: context.textScaleFactor.clamp(1.0, 1.5)),
  child: MyWidget(),
);
```

## 4. 键盘导航

```dart
// Tab 键在交互元素间导航
FocusTraversalGroup(
  policy: OrderedTraversalPolicy(),
  child: Column(children: [
    Focus(autofocus: true, child: TextField(decoration: InputDecoration(labelText: '搜索'))),
    Focus(child: ElevatedButton(onPressed: () {}, child: Text('搜索'))),
  ]),
);

// 快捷键
Shortcuts(shortcuts: {LogicalKeySet(LogicalKeyboardKey.escape): const Intent(ActivateAction())}, child: ...);
```

## 5. 对比 Web ARIA

| Flutter | Web ARIA |
|---------|----------|
| `Semantics(label: ...)` | `aria-label="..."` |
| `Semantics(hint: ...)` | `aria-describedby` |
| `ExcludeSemantics` | `aria-hidden="true"` |
| `MergeSemantics` | `<fieldset>` + `<legend>` |
| `FocusTraversalGroup` | `tabindex` 管理 |

---

> **下一步**: [Ch 42](./Chapter-42-高级UI效果.md)
