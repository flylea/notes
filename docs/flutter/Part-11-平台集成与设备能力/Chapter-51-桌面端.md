> **Part**: Part X — 平台集成与设备能力
> **上一章**: [Chapter 50 — 设备功能](./Chapter-50-设备功能.md)
> **下一章**: [Chapter 52 — Add-to-App](./Chapter-52-Add-to-App.md)

---

# 第 51 章：桌面端深度适配

## 0. 本章目标

window_manager（窗口尺寸/位置/标题栏样式/关闭行为/事件监听）、tray_manager（系统托盘图标/菜单/后台运行）、MenuBar（完整的文件/编辑/视图/帮助菜单栏+快捷键绑定）、Shortcuts+Intents+Actions 键盘体系、desktop_drop（拖放 CSV 文件导入）、LeanFlutter 桌面生态（hotkey_manager/auto_updater/launch_at_startup/local_notifier/protocol_handler）。

> 🎯 **Library App 产出**：Windows/macOS/Linux 窗口管理、桌面菜单栏（文件→导入导出、编辑→搜索、视图→主题）、Ctrl+F/N/B 快捷键、拖放 CSV 导入、最小化到托盘后台运行。

---

## 1. window_manager

```dart
import 'package:window_manager/window_manager.dart';

Future<void> initWindow() async {
  await windowManager.ensureInitialized();

  await windowManager.setMinimumSize(const Size(800, 600));       // 最小窗口
  await windowManager.setTitle('📚 图书馆管理系统');                 // 标题
  await windowManager.setTitleBarStyle(TitleBarStyle.hidden);     // 隐藏原生标题栏（使用自定义 Flutter 标题栏）
  await windowManager.setAsFrameless();                            // 无边框窗口

  // 关闭行为——最小化到托盘而非退出
  windowManager.setPreventClose(true);
  windowManager.onCloseRequested.listen((_) async {
    await windowManager.hide();  // 隐藏到托盘
  });
}
```

## 2. 菜单栏

```dart
// 完整的桌面菜单栏
MenuBar(menus: [
  Submenu(label: const Text('文件'), children: [
    MenuItemButton(onPressed: _importCsv, shortcut: const SingleActivator(LogicalKeyboardKey.keyN, control: true), child: const Text('导入 CSV...')),
    MenuItemButton(onPressed: _exportCsv, shortcut: const SingleActivator(LogicalKeyboardKey.keyE, control: true), child: const Text('导出 CSV...')),
    const Divider(),
    MenuItemButton(onPressed: _exit, shortcut: const SingleActivator(LogicalKeyboardKey.keyQ, control: true), child: const Text('退出')),
  ]),
  Submenu(label: const Text('编辑'), children: [
    MenuItemButton(onPressed: _focusSearch, shortcut: const SingleActivator(LogicalKeyboardKey.keyF, control: true), child: const Text('搜索')),
    MenuItemButton(onPressed: _addBook, shortcut: const SingleActivator(LogicalKeyboardKey.keyN, control: true), child: const Text('添加图书')),
  ]),
  Submenu(label: const Text('视图'), children: [
    MenuItemButton(onPressed: _toggleTheme, child: const Text('切换深色模式')),
    MenuItemButton(onPressed: _toggleSidebar, child: const Text('切换侧边栏')),
  ]),
  Submenu(label: const Text('帮助'), children: [
    MenuItemButton(onPressed: _showAbout, child: const Text('关于')),
  ]),
]);
```

## 3. 系统托盘

```dart
import 'package:tray_manager/tray_manager.dart';

Future<void> initTray() async {
  await trayManager.setIcon('assets/tray_icon.png');
  await trayManager.setToolTip('📚 图书馆管理系统');

  trayManager.addTrayListener(() async {
    await windowManager.show();    // 点击托盘图标 → 恢复窗口
    await windowManager.focus();
  });

  await trayManager.setContextMenu(Menu(items: [
    MenuItem(key: 'show', label: '显示窗口'),
    MenuItem(key: 'quit', label: '退出'),
  ]));
  trayManager.addListener((event) {
    if (event is MenuItemClickEvent && event.menuItem.key == 'quit') exit(0);
  });
}
```

## 4. 拖放文件导入

```dart
DropTarget(
  onDragDone: (details) async {
    final file = details.files.single;
    if (file.path.endsWith('.csv')) {
      final books = await _parseCsvToBooks(File(file.path));
      ref.read(bookListProvider.notifier).addAll(books);
    }
  },
  child: Scaffold(body: ...),
);
```

## 5. 全局快捷键

```dart
// Ctrl+F 聚焦搜索框
CallbackShortcuts(bindings: {
  const SingleActivator(LogicalKeyboardKey.keyF, control: true): () => _focusSearch(),
  const SingleActivator(LogicalKeyboardKey.keyN, control: true): () => context.push('/book-form'),
}, child: child);

// 或使用 hotkey_manager 包实现全局快捷键（即使 App 不在前台也响应）
await hotKeyManager.register(HotKey(KeyCode.keyF, modifiers: [KeyModifier.control]), keyDownHandler: (_) => focusSearch());
```

## 6. LeanFlutter 桌面生态

| 包 | 功能 | 图书馆 App 使用 |
|----|------|----------------|
| `window_manager` | 窗口管理 | ✅ 标题栏/最小尺寸/关闭行为 |
| `tray_manager` | 系统托盘 | ✅ 托盘图标+菜单+后台运行 |
| `hotkey_manager` | 全局快捷键 | ✅ Ctrl+F 搜索 |
| `auto_updater` | 自动更新检查 | App 启动时检查新版本 |
| `launch_at_startup` | 开机自启 | 可选 |
| `local_notifier` | 桌面通知 | 到期提醒桌面弹窗 |
| `protocol_handler` | 自定义协议 | `libraryapp://` 协议处理 |

---

## 7. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 不处理 `windowManager.onCloseRequested` | 关闭窗口直接退出，托盘功能失效 | 设置 `setPreventClose(true)`，关闭时 `hide()` 隐藏到托盘 |
| 菜单栏快捷键使用 `LogicalKeyboardKey.control` 而非 `meta` | macOS 上快捷键不响应（macOS 使用 Cmd 键） | 用 `SingleActivator` 默认适配：macOS 自动将 control→meta |
| 拖放功能不判断文件扩展名 | 非 CSV 文件被导入，解析报错 | `onDragDone` 回调中过滤 `file.path.endsWith('.csv')` |
| `window_manager.setAsFrameless()` 后不实现自定义拖拽区域 | 用户无法拖动窗口 | 给标题栏区域包裹 `GestureDetector` + `windowManager.startDragging()` |
| 在非桌面平台调用 `window_manager` / `tray_manager` | 移动端编译报错或运行时异常 | 用 `Platform.isWindows || Platform.isMacOS || Platform.isLinux` 条件判断 |

**最佳实践**：

- 启动时用 `windowManager.ensureInitialized()` 后再设置窗口属性
- 设置 `setMinimumSize` 防止窗口缩得过小导致布局溢出
- 托盘右键菜单提供"显示窗口"和"退出"两个基本选项
- `hotkey_manager` 实现全局快捷键（即使窗口失焦也响应）优于 `CallbackShortcuts`
- 桌面菜单栏使用 `PlatformMenuBar` 获得原生菜单栏体验
- 拖放导入时添加视觉效果反馈：`onDragEntered` 高亮边框，`onDragExited` 恢复
- `LeanFlutter` 桌面生态足以覆盖常见桌面需求，无需手写原生层
- 在 CI 中使用 `flutter config --enable-linux-desktop` 等开关启用桌面构建

## 8. 本章练习

1. 为 Library App 实现桌面窗口个性化管理：使用 `window_manager` 设置最小窗口 800x600、启动时窗口居中、标题为"图书馆管理系统"，实现自定义无边框标题栏（包含窗口标题文字、最小化/最大化/关闭三个按钮），点击关闭按钮时调用 `windowManager.hide()` 隐藏窗口而非退出（配合 `tray_manager` 的使用场景）
2. 为 Library App 实现桌面菜单栏：使用 `PlatformMenuBar` 构建菜单——"文件"子菜单含"导入 CSV"（Ctrl+I）和"导出 CSV"（Ctrl+E）、"编辑"子菜单含"查找"（Ctrl+F）和"首选项"（Ctrl+,）、"视图"子菜单含"切换深色主题"（Ctrl+T），每个菜单项绑定 `Mnemonic` 和执行回调函数
3. 为 Library App 实现 CSV 文件拖放导入：用 `DropTarget` 包裹整个 Scaffold，监听 `onDragEntered`/`onDragExited`（改变边框颜色提示可拖放）、`onDragDone`（从 `details.files` 获取文件路径），过滤 `.csv` 后缀，调用 CSV 解析服务导入图书数据，完成后显示 SnackBar 汇总结果

验证：窗口标题栏自定义按钮功能正确（最小化/最大化/关闭）；菜单栏快捷键在所有平台生效（macOS 的 Cmd 键自动适配）；拖放 CSV 文件后正确触发导入流程

---

> **下一步**: [Chapter 52 — Add-to-App](./Chapter-52-Add-to-App.md)
> 📖 **延伸阅读**: [Desktop support](https://docs.flutter.dev/platform-integration/desktop) | [window_manager](https://pub.dev/packages/window_manager) | [MenuItemButton](https://api.flutter.dev/flutter/material/MenuItemButton-class.html)
