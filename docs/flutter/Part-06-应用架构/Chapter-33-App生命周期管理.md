# 第 33 章：App 生命周期管理

> **Part**: Part VI — 应用架构
> **上一章**: [Chapter 32 — Feature-First 项目结构](./Chapter-32-FeatureFirst项目结构.md)
> **下一章**: [Part VII — 用户与权限系统](../Part-07-用户与权限系统/)

---

## 0. 本章目标

- 掌握 `WidgetsBindingObserver` 监听 App 前后台切换
- 理解 `AppLifecycleState` 各状态的触发时机
- 学会在生命周期变化时正确管理资源（暂停/恢复网络、释放/重建连接）
- 避免最常见的内存泄漏：忘记取消订阅、计时器未清理

---

## 1. AppLifecycleState 详解

Flutter 通过 `AppLifecycleState` 枚举跟踪 App 的全局状态：

| 状态 | 触发时机 | 操作建议 |
|------|---------|---------|
| `resumed` | App 回到前台（可见且可交互） | 恢复网络请求、刷新数据、恢复计时器 |
| `inactive` | App 即将进入后台（短暂过渡，如电话来电、分屏切换） | 暂停动画、暂停视频播放 |
| `paused` | App 进入后台（不可见） | 暂停网络请求、关掉敏感数据展示、释放大资源 |
| `detached` | App 被系统销毁（极少触发） | 清理所有资源、保存状态 |
| `hidden` | App 被其他 App 遮挡（桌面端多窗口场景） | 暂停 UI 更新 |

> `inactive` 在移动端通常只持续几毫秒（过渡态）。真正的"前后台"判断用 `resumed` vs `paused`。

---

## 2. WidgetsBindingObserver 用法

```dart
class AppLifecycleManager extends StatefulWidget {
  final Widget child;
  const AppLifecycleManager({required this.child});
  @override
  State<AppLifecycleManager> createState() => _AppLifecycleManagerState();
}

class _AppLifecycleManagerState extends State<AppLifecycleManager>
    with WidgetsBindingObserver {
  AppLifecycleState _lastState = AppLifecycleState.resumed;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    setState(() => _lastState = state);

    switch (state) {
      case AppLifecycleState.resumed:
        _onAppResumed();
        break;
      case AppLifecycleState.paused:
        _onAppPaused();
        break;
      case AppLifecycleState.inactive:
        _onAppInactive();
        break;
      case AppLifecycleState.detached:
        _onAppDetached();
        break;
      case AppLifecycleState.hidden:
        _onAppHidden();
        break;
    }
  }

  void _onAppResumed() {
    // 恢复网络请求、刷新数据
    ref.read(bookListProvider.notifier).refresh();
  }

  void _onAppPaused() {
    // 暂停轮询、隐藏敏感数据
    ref.read(userProvider.notifier).clearSensitiveData();
  }

  void _onAppInactive() {
    // 暂停动画
  }

  void _onAppDetached() {
    // 清理所有资源
  }

  void _onAppHidden() {
    // 暂停 UI 更新（桌面端多窗口）
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
```

### 集成到 App 入口

```dart
// lib/app.dart
class LibraryApp extends StatelessWidget {
  const LibraryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      child: AppLifecycleManager(    // ← 包裹在根 Widget 外层
        child: MaterialApp.router(/* ... */),
      ),
    );
  }
}
```

---

## 3. Riverpod 生命周期集成

```dart
// lib/core/lifecycle/app_lifecycle_provider.dart

enum AppLifecycle { resumed, paused, inactive }

final appLifecycleProvider = StateProvider<AppLifecycle>(
  (ref) => AppLifecycle.resumed,
);

// 任何 Provider 都可以监听生命周期变化
final autoRefreshProvider = Provider.autoDispose<void>((ref) {
  final lifecycle = ref.watch(appLifecycleProvider);

  Timer? timer;
  if (lifecycle == AppLifecycle.resumed) {
    // App 在前台 → 开启 30 秒轮询
    timer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => ref.read(bookListProvider.notifier).refresh(),
    );
  }

  ref.onDispose(() => timer?.cancel());
});
```

---

## 4. 常见资源管理清单

| 资源类型 | 进入后台 | 回到前台 |
|---------|---------|---------|
| 网络轮询 | 暂停 Timer | 重启 Timer + 立即刷新一次 |
| WebSocket 连接 | 保持连接或关闭（视需求） | 重连（检查连接状态） |
| 音频播放 | 暂停 | 恢复（需检查用户是否手动暂停） |
| 视频播放 | 暂停 | 恢复 |
| 动画 | 暂停（Ticker 自动暂停） | 自动恢复 |
| 敏感数据 | 模糊/隐藏（如银行余额） | 恢复显示 |
| 位置追踪 | 改为低频更新 | 恢复正常频率 |

---

## 5. 本章练习

1. 在 Library App 中集成 `AppLifecycleManager`，用 `debugPrint` 输出每次生命周期变化
2. 实现：App 进入后台时暂停图书列表的轮询刷新，回到前台时立即刷新
3. 实现：在后台超过 5 分钟时，下次回到前台要求重新登录（安全策略）

验证：运行 App → 按 Home 键切到后台 → 查看 debugPrint 输出 → 切回 App → 确认数据已刷新。

---

> 📖 **延伸阅读**: [AppLifecycleState API](https://api.flutter.dev/flutter/dart-ui/AppLifecycleState.html)
