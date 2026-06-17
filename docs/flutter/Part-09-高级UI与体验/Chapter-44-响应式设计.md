# 第 44 章：响应式与自适应设计

> **Part**: Part IX — 高级 UI 与体验
> **上一章**: [Chapter 43 — CustomPainter](./Chapter-43-CustomPainter.md)
> **下一章**: [Chapter 45 — 国际化](./Chapter-45-国际化.md)
> **官方文档**: [flutter.dev/ui/adaptive-responsive](https://docs.flutter.dev/ui/adaptive-responsive)

---

## 0. 本章目标

- 掌握 LayoutBuilder + MediaQuery + 断点系统联合使用
- 实现 Master-Detail 布局（手机单页/平板双栏/桌面三栏）
- 理解导航模式自适应（BottomNav → NavigationRail → SideDrawer）
- 学会响应式图片和网格策略

> 🎯 **本章产出**：Library App 的手机/平板/桌面三套自适应布局。

---

## 1. 断点系统

Material 3 官方推荐的断点值：

```dart
// lib/core/responsive/breakpoints.dart

enum ScreenType { compact, medium, expanded, large }

class AppBreakpoints {
  static const double compact = 600;
  static const double medium = 840;
  static const double expanded = 1200;

  static ScreenType typeOf(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width < compact) return ScreenType.compact;
    if (width < medium) return ScreenType.medium;
    if (width < expanded) return ScreenType.expanded;
    return ScreenType.large;
  }

  static int adaptiveColumns(BuildContext context) {
    return switch (typeOf(context)) {
      ScreenType.compact => 2,
      ScreenType.medium => 3,
      ScreenType.expanded => 4,
      ScreenType.large => 6,
    };
  }
}
```

---

## 2. Master-Detail 布局

```dart
class AdaptiveBookBrowser extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return LayoutBuilder(builder: (_, constraints) {
      final width = constraints.maxWidth;

      if (width < 600) return const _CompactLayout();
      if (width < 900) return const _MediumLayout();
      return const _ExpandedLayout();
    });
  }
}

// 手机：单页，全屏切换
class _CompactLayout extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BookListView(
      onSelect: (book) => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => BookDetailScreen(book: book)),
      ),
    );
  }
}

// 平板：双栏（列表 + 详情）
class _MediumLayout extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(children: [
      const SizedBox(width: 320, child: BookListView()),
      const VerticalDivider(width: 1),
      Expanded(child: BookDetailPanel()),  // 当前选中图书的详情
    ]);
  }
}

// 桌面：三栏（导航 + 列表 + 详情）
class _ExpandedLayout extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(children: [
      const SizedBox(width: 240, child: NavigationRail(...)),
      const VerticalDivider(width: 1),
      const SizedBox(width: 360, child: BookListView()),
      const VerticalDivider(width: 1),
      Expanded(child: BookDetailPanel()),
    ]);
  }
}
```

---

## 3. 导航模式自适应

不同屏幕尺寸下的最佳导航模式：

| 屏幕 | 导航模式 | Flutter 实现 |
|------|---------|-------------|
| Compact (手机) | BottomNavigationBar | Scaffold 的 bottomNavigationBar |
| Medium (竖屏平板) | NavigationRail | Scaffold body 左侧 |
| Expanded (横屏平板) | NavigationRail（常驻） | body 左侧，始终可见 |
| Large (桌面) | NavigationRail 或 MenuBar | body 左侧 + 快捷键 |

```dart
Widget buildNavigation(BuildContext context) {
  return switch (AppBreakpoints.typeOf(context)) {
    ScreenType.compact => Scaffold(
      body: body,
      bottomNavigationBar: NavigationBar(/* ... */),
    ),
    _ => Row(children: [
      NavigationRail(/* ... */),  // 平板/桌面——常驻侧栏
      Expanded(child: body),
    ]),
  };
}
```

---

## 4. 响应式网格

```dart
GridView.builder(
  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: AppBreakpoints.adaptiveColumns(context),
    mainAxisSpacing: 16,
    crossAxisSpacing: 16,
    childAspectRatio: 0.65,
  ),
  itemBuilder: (_, i) => BookGridItem(book: books[i]),
);
```

### 响应式图片

```dart
Image.network(
  book.coverUrl,
  fit: BoxFit.cover,
  // 根据当前列宽加载合适尺寸的图片，避免加载过大图片浪费内存
  cacheWidth: (MediaQuery.of(context).size.width ~/ adaptiveColumns).toInt(),
);
```

---

## 5. 实战测试

```bash
# 在不同尺寸设备上测试
flutter run -d chrome                    # Web 浏览器——拖拽窗口宽度
flutter run -d macOS                     # 桌面端——全屏 vs 窗口

# 模拟器测试
flutter run -d "iPhone 15 Pro"           # compact
flutter run -d "iPad (10th generation)"  # medium/expanded
```

---

## 6. 常见错误与最佳实践

### 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|----------|
| 用 `MediaQuery.of(context).size` 而非 `LayoutBuilder` | 获取的是屏幕尺寸而非父容器约束，Split View 下布局错误 | `LayoutBuilder(builder: (_, constraints) { final width = constraints.maxWidth; })` |
| 断点值硬编码散落各文件 | 多页面各自定义 600/900/1200，修改断点需全局搜索 | 集中在 `AppBreakpoints` 类用静态常量 + `typeOf()` 方法 |
| 平板横屏未处理键盘弹出 | 键盘弹出后可用高度骤减，布局塌陷或溢出 | 用 `MediaQuery.of(context).viewInsets.bottom` 动态调整 padding |
| NavigationRail 状态与页面不同步 | 切换页面后侧栏高亮项不变，用户迷惑 | `NavigationRail` 的 `selectedIndex` 与路由状态同步管理 |
| 响应式网格 childAspectRatio 固定 | 封面、横版图、竖版图混排时变形 | 根据内容类型动态设置 `childAspectRatio` |

### 最佳实践

- `LayoutBuilder` 获取父容器约束，`MediaQuery` 获取系统级信息（文本缩放、暗黑模式）
- `AppBreakpoints.typeOf()` 返回 `ScreenType` enum，UI 层 `switch` 枚举做分支，避免裸数字比较
- 导航模式与布局模式解耦：`typeOf()` 决定导航组件，`LayoutBuilder` 决定内容区域布局
- 平板/桌面端优先测试场景：窗口缩放、分屏模式、键盘弹出、横竖屏切换
- Master-Detail 布局中选中状态由 `riverpod` Provider 管理，不依赖 local state
- 响应式图片使用 `cacheWidth: (constraints.maxWidth ~/ columns).toInt()` 限制解码分辨率
- `adaptiveColumns()` 方法自动返回 2/3/4/6 列，网格/列表/详情页共用同一断点逻辑
- 用 `flutter run -d chrome` 拖拽窗口快速验证所有断点切换

---

## 7. 本章练习

1. 实现 Library App 的 `AppBreakpoints` 断点系统
2. 实现图书列表的 Master-Detail 双栏布局（平板模式）
3. 根据屏幕尺寸自动切换 BottomNav ↔ NavigationRail
4. 实现自适应网格列数（手机 2 列 → 平板 3 列 → 桌面 4 列）

验证：在不同模拟器/浏览器窗口大小下验证布局正确切换。

---

> **下一步**: [Chapter 45 — 国际化](./Chapter-45-国际化.md)
> 📖 **延伸阅读**: [Material 3 布局指南](https://m3.material.io/foundations/layout) | [LayoutBuilder API](https://api.flutter.dev/flutter/widgets/LayoutBuilder-class.html)
