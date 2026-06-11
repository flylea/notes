> **Part**: Part II — 界面基石
> **上一章**: [Chapter 07 — 基础 Widget 全解析](./Chapter-07-基础Widget全解析.md)
> **下一章**: [Chapter 09 — 布局系统精讲](./Chapter-09-布局系统精讲.md)
> **官方文档**: [flutter.cn/ui/widgets/cupertino](https://docs.flutter.cn/ui/widgets/cupertino)

---

# 第 8 章：Cupertino — iOS 风格组件

## 0. 本章目标

Cupertino 作为 Flutter 第二设计系统（Material → Google, Cupertino → Apple），掌握 CupertinoPageScaffold/NavigationBar/Button/TextField/DatePicker/AlertDialog/Switch/Slider/ActivityIndicator 等 12+ iOS 风格组件、与 Material 组件的对应关系、通过 `Theme.of(context).platform` 自动适配。

---

## 1. Material vs Cupertino 对照

| Material Widget | Cupertino Widget | iOS 等效 |
|----------------|-----------------|---------|
| `Scaffold` | `CupertinoPageScaffold` | UIViewController |
| `AppBar` | `CupertinoNavigationBar` | UINavigationBar |
| `BottomNavigationBar` | `CupertinoTabBar` | UITabBar |
| `ElevatedButton` | `CupertinoButton` | UIButton |
| `TextField` | `CupertinoTextField` | UITextField |
| `Switch` | `CupertinoSwitch` | UISwitch |
| `Slider` | `CupertinoSlider` | UISlider |
| `CircularProgressIndicator` | `CupertinoActivityIndicator` | UIActivityIndicatorView |
| `AlertDialog` | `CupertinoAlertDialog` | UIAlertController |
| `FloatingActionButton` | 无等价（iOS 不推荐 FAB） | — |
| `Drawer` | 无等价（iOS 无侧边抽屉概念） | — |

---

## 2. 基础 iOS 页面骨架

```dart
import 'package:flutter/cupertino.dart';

class IOStyleHomePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      // ① 导航栏 — 类似 UINavigationBar
      navigationBar: CupertinoNavigationBar(
        middle: const Text('图书馆'),
        leading: CupertinoButton(padding: EdgeInsets.zero, onPressed: () {}, child: const Icon(CupertinoIcons.settings)),
        trailing: CupertinoButton(padding: EdgeInsets.zero, onPressed: () {}, child: const Icon(CupertinoIcons.search)),
      ),
      child: SafeArea(
        child: ListView(
          children: [
            // ② iOS 风格的分组列表
            CupertinoFormSection(
              header: const Text('借阅状态'),
              children: [
                CupertinoFormRow(prefix: const Text('当前借阅'), child: Text('3 本')),
                CupertinoFormRow(prefix: const Text('逾期'), child: Text('0 本', style: TextStyle(color: CupertinoColors.systemGreen))),
              ],
            ),
            // ③ 选择器行
            CupertinoButton(child: const Text('借阅历史'), onPressed: () {
              Navigator.of(context).push(CupertinoPageRoute(builder: (_) => CupertinoPageScaffold(navigationBar: CupertinoNavigationBar(middle: const Text('借阅历史')), child: ...)));
            }),
          ],
        ),
      ),
      // ④ iOS 底部 TabBar
      tabBar: CupertinoTabBar(
        items: const [
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.book), label: '图书'),
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.tray), label: '借阅'),
          BottomNavigationBarItem(icon: Icon(CupertinoIcons.person), label: '我的'),
        ],
      ),
    );
  }
}
```

## 3. Cupertino 表单组件

```dart
// CupertinoTextField — iOS 风格输入框
CupertinoTextField(
  placeholder: '搜索图书...',
  prefix: const Padding(padding: EdgeInsets.only(left: 8), child: Icon(CupertinoIcons.search, size: 20)),
  suffix: const Padding(padding: EdgeInsets.only(right: 8), child: Icon(CupertinoIcons.clear_circled_solid, size: 18)),
  padding: const EdgeInsets.all(12),
  decoration: BoxDecoration(color: CupertinoColors.systemGrey6, borderRadius: BorderRadius.circular(10)),
);

// CupertinoSwitch — iOS 风格开关
CupertinoSwitch(value: _biometricEnabled, onChanged: (v) => setState(() => _biometricEnabled = v), activeColor: CupertinoColors.activeBlue);

// CupertinoSlider
CupertinoSlider(value: _rating, min: 0, max: 5, divisions: 10, onChanged: (v) => setState(() => _rating = v));

// CupertinoDatePicker
SizedBox(
  height: 200,
  child: CupertinoDatePicker(
    mode: CupertinoDatePickerMode.date,
    initialDateTime: _selectedDate,
    onDateTimeChanged: (date) => setState(() => _selectedDate = date),
  ),
);
```

## 4. Cupertino 对话框

```dart
showCupertinoDialog(
  context: context,
  builder: (context) => CupertinoAlertDialog(
    title: const Text('删除图书'),
    content: const Text('确定要删除《${book.title}》吗？此操作不可撤销。'),
    actions: [
      CupertinoDialogAction(child: const Text('取消'), onPressed: () => Navigator.pop(context)),
      CupertinoDialogAction(isDestructiveAction: true, child: const Text('删除'), onPressed: () { deleteBook(); Navigator.pop(context); }),
    ],
  ),
);

// CupertinoActionSheet — iOS 风格底部操作表
showCupertinoModalPopup(
  context: context,
  builder: (context) => CupertinoActionSheet(
    title: const Text('排序方式'),
    actions: [
      CupertinoActionSheetAction(onPressed: () {}, child: const Text('按书名')),
      CupertinoActionSheetAction(onPressed: () {}, child: const Text('按作者')),
    ],
    cancelButton: CupertinoActionSheetAction(child: const Text('取消'), onPressed: () => Navigator.pop(context)),
  ),
);
```

## 5. 自适应平台策略

```dart
// ① 手动判断 — Theme.of(context).platform
Widget buildButton(BuildContext context) {
  if (Theme.of(context).platform == TargetPlatform.iOS) {
    return CupertinoButton(child: const Text('借阅'), onPressed: () {});
  }
  return ElevatedButton(child: const Text('借阅'), onPressed: () {});
}

// ② 自适应 Widget — flutter_platform_widgets 包
// PlatformWidget(ios: CupertinoButton(...), android: ElevatedButton(...));

// ③ 自适应路由 — CupertinoPageRoute(iOS) vs MaterialPageRoute(Android)
Navigator.push(context, Theme.of(context).platform == TargetPlatform.iOS
    ? CupertinoPageRoute(builder: (_) => DetailPage())
    : MaterialPageRoute(builder: (_) => DetailPage()));
```

## 6. CupertinoIcons vs Icons

```dart
// Material Icons — Google 设计风格的图标
Icons.search
Icons.arrow_back
Icons.add

// CupertinoIcons — Apple 设计风格的图标（SF Symbols 映射）
CupertinoIcons.search       // 对应 SF Symbol: magnifyingglass
CupertinoIcons.left_chevron // 对应 SF Symbol: chevron.left
CupertinoIcons.add          // 对应 SF Symbol: plus
CupertinoIcons.share        // 对应 SF Symbol: square.and.arrow.up
CupertinoIcons.trash        // 对应 SF Symbol: trash
```

---

## 7. 本章练习

**1. Cupertino 与 Material 组件的互选**

在图书馆 App 中，同一个页面在 iOS 和 Android 上应该呈现不同的视觉风格。请实现一个 `PlatformAdaptiveBookPage` 页面，包含以下元素：

- 页面骨架：iOS 用 `CupertinoPageScaffold` + `CupertinoNavigationBar`，Android 用 `Scaffold` + `AppBar`
- 导航栏标题均为"图书馆"
- 页面内容暂时用一条居中文字"平台自适应页面"占位
- 页面切换按钮：iOS 用 `CupertinoButton`，Android 用 `ElevatedButton`，文字均为"查看详情"
- 使用 `Theme.of(context).platform` 判断当前平台
- 验证：新建 `lib/screens/platform_adaptive_page.dart`，分别在 iOS 模拟器和 Android 模拟器中运行（或使用平台的 `debugDefaultTargetPlatformOverride` 强制切换），确认骨架、导航栏、按钮在两个平台上分别渲染为正确的风格。

**2. iOS 风格搜索栏**

为图书馆 App 的 iOS 用户设计一个符合 Apple 设计规范的搜索栏，要求：

- 使用 `CupertinoTextField` 实现
- `placeholder` 文字为"搜索图书..."
- 左侧 `prefix` 放置 `CupertinoIcons.search` 图标
- 右侧 `suffix` 放置清除按钮（`CupertinoIcons.clear_circled_solid`），点击后清空输入
- 背景色使用 `CupertinoColors.systemGrey6`，圆角 10
- 内边距 `EdgeInsets.all(12)`
- 验证：在 `PlatformAdaptiveBookPage` 中，当平台为 iOS 时显示此搜索栏（Android 时显示 Material `TextField`），运行确认两种搜索框在各自平台上均可正常输入和清除。

**3. CupertinoAlertDialog 删除确认**

图书馆 App 的图书管理功能需要在删除图书前弹出一个确认对话框，在 iOS 上应使用 iOS 风格。请实现：

- 使用 `showCupertinoDialog` + `CupertinoAlertDialog` 弹出对话框
- 标题："删除图书"
- 内容："确定要删除《Clean Code》吗？此操作不可撤销。"
- 两个操作按钮：
  - "取消"（普通样式，关闭对话框）
  - "删除"（`isDestructiveAction: true`，红色文字，关闭对话框并在 console 打印"图书已删除"）
- 在 Android 平台上使用 `showDialog` + `AlertDialog` 实现同样的功能（Material 风格）
- 验证：在 `PlatformAdaptiveBookPage` 的"查看详情"按钮中，改为弹出一个包含"删除图书"选项的按钮，点击后根据平台弹出对应风格的确认对话框。在两个平台上分别确认对话框样式正确。

---

> **下一步**: [Chapter 09 — 布局系统精讲](./Chapter-09-布局系统精讲.md)
