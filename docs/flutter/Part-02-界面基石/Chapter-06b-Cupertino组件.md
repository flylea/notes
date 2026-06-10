> **Part**: Part II | **上一章**: [Ch 6](./Chapter-06-基础Widget全解析.md) | **下一章**: [Ch 7](./Chapter-07-布局系统精讲.md)
> **官方文档**: [flutter.cn/ui/widgets/cupertino](https://docs.flutter.cn/ui/widgets/cupertino)

---

# 第 6b 章：Cupertino — iOS 风格组件

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

> **下一步**: [Ch 7 — 布局系统精讲](./Chapter-07-布局系统精讲.md)
