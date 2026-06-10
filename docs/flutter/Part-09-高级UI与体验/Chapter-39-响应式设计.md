> **Part**: Part IX | **上一章**: [Ch 38](./Chapter-38-Material3主题.md) | **下一章**: [Ch 40](./Chapter-40-国际化.md)
> **官方文档**: [flutter.cn/ui/adaptive-responsive](https://docs.flutter.cn/ui/adaptive-responsive)

---

# 第 39 章：响应式与自适应设计

## 0. 本章目标

LayoutBuilder/MediaQuery/BoxConstraints 三件套联合使用、断点系统（compact<600<medium<840<expanded）、Master-Detail（手机单页/平板双栏/桌面三栏）、Drawer 策略（手机临时抽屉 vs 桌面常驻侧栏）、自适应图书网格列数。

> 🎯 **Library App 产出**：手机→平板→桌面三套自适应布局。

---

## 1. 断点系统

```dart
// lib/core/responsive/breakpoints.dart
enum ScreenSize { compact, medium, expanded }

ScreenSize screenSize(BuildContext context) {
  final width = MediaQuery.of(context).size.width;
  if (width < 600) return ScreenSize.compact;
  if (width < 840) return ScreenSize.medium;
  return ScreenSize.expanded;
}

// 自适应列数
int adaptiveColumns(BuildContext context) => switch (screenSize(context)) {
  ScreenSize.compact => 2, ScreenSize.medium => 3, ScreenSize.expanded => 4,
};
```

## 2. Master-Detail 布局

```dart
class AdaptiveBookBrowser extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return LayoutBuilder(builder: (_, constraints) {
      if (constraints.maxWidth < 600) return _CompactLayout();
      if (constraints.maxWidth < 900) return _MediumLayout();
      return _ExpandedLayout();
    });
  }
}

// 平板——双栏
class _MediumLayout extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Row(children: [
    const SizedBox(width: 320, child: BookListView()),  // 左：列表
    const VerticalDivider(width: 1),
    Expanded(child: BookDetailPanel()),                   // 右：详情
  ]);
}

// 桌面——三栏
class _ExpandedLayout extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Row(children: [
    const SizedBox(width: 240, child: NavigationRail(...)),  // 左：导航
    const VerticalDivider(width: 1),
    const SizedBox(width: 360, child: BookListView()),       // 中：列表
    const VerticalDivider(width: 1),
    Expanded(child: BookDetailPanel()),                      // 右：详情
  ]);
}
```

## 3. Drawer 策略

```dart
// 手机：临时 Drawer（覆盖在当前页面上方）
// 平板/桌面：常驻 NavigationRail（始终可见）
Widget buildNavigation(BuildContext context) {
  final size = screenSize(context);
  if (size == ScreenSize.compact) {
    return Scaffold(drawer: AppDrawer(...), body: ...);
  }
  return Row(children: [NavigationRail(...), Expanded(child: ...)]);
}
```

## 4. 自适应网格

```dart
GridView.builder(
  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: adaptiveColumns(context),
    childAspectRatio: 0.65,
  ),
);
```

## 5. 与 CSS 对照

| Flutter | CSS |
|---------|-----|
| `LayoutBuilder(maxWidth: ...)` | `@container (max-width: ...)` Container Query |
| `MediaQuery.of(context).size.width` | `@media (max-width: ...)` |
| `switch (screenSize(context))` | `@media breakpoints` |
| `Row + Expanded` 双栏 | `display: grid; grid-template-columns: 300px 1fr` |
| NavigationRail | `position: sticky; left: 0` sidebar |

---

> **下一步**: [Ch 40 — 国际化](./Chapter-40-国际化.md)
