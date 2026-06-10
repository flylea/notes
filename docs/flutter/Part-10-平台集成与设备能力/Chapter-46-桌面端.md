> **Part**: Part X | **上一章**: [Ch 45](./Chapter-45-设备功能.md) | **下一章**: [Ch 47](./Chapter-47-Add-to-App.md)

---

# 第 46 章：桌面端深度适配

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

> **下一步**: [Ch 47](./Chapter-47-Add-to-App.md)
