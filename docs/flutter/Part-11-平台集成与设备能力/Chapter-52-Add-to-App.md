> **Part**: Part X — 平台集成与设备能力
> **上一章**: [Chapter 51 — 桌面端](./Chapter-51-桌面端.md)
> **下一章**: [Part XI — 质量工程与发布](../Part-11-质量工程与发布/)

---

# 第 52 章：Add-to-App — 在现有应用中集成 Flutter

## 0. 本章目标

应用场景（已有原生 Android/iOS App → 逐步引入 Flutter 模块）、模块创建（`flutter create --template module`）、Android 集成（AAR/Gradle 源码依赖+FlutterActivity/FlutterFragment+Engine 缓存）、iOS 集成（CocoaPods/Framework+FlutterViewController+Engine）、MethodChannel 跨模块通信。

> 🎯 **概念演示章**：创建独立 Flutter 模块、模拟原生宿主 App 集成图书搜索功能、原生化页面跳转 Flutter 页面并回调。

---

## 1. 创建 Flutter 模块

```bash
flutter create --template module flutter_library_module
# 生成不含 main.dart 入口的模块——无法独立运行，只能被宿主 App 嵌入
```

## 2. Android 集成

```groovy
// settings.gradle
setBinding(new Binding([gradle: this]))
evaluate(new File(settingsDir.parentFile, 'flutter_library_module/.android/include_flutter.groovy'))
// app/build.gradle
dependencies { implementation project(':flutter') }
```

```kotlin
// 启动 Flutter 页面（新建 Engine）
startActivity(FlutterActivity.withNewEngine().initialRoute("/search?q=flutter").build(this))

// 使用缓存 Engine（推荐——避免重复初始化）
val flutterEngine = FlutterEngine(this)
flutterEngine.dartExecutor.executeDartEntrypoint(DartExecutor.DartEntrypoint.createDefault())
FlutterEngineCache.getInstance().put("my_engine", flutterEngine)
startActivity(FlutterActivity.withCachedEngine("my_engine").build(this))
```

## 3. iOS 集成

```ruby
# Podfile
flutter_application_path = '../flutter_library_module'
load File.join(flutter_application_path, '.ios', 'Flutter', 'podhelper.rb')
target 'MyApp' do
  install_all_flutter_pods(flutter_application_path)
end
```

```swift
let flutterEngine = FlutterEngine(name: "my_engine")
flutterEngine.run()
let vc = FlutterViewController(engine: flutterEngine, nibName: nil, bundle: nil)
vc.setInitialRoute("/search?q=flutter")
present(vc, animated: true)
```

## 4. 跨模块通信

Dart 端和原生端使用相同的 MethodChannel Name——Flutter 模块与宿主 App 在同一进程，MethodChannel 自动连通。

## 5. 性能考虑

| 策略 | 首次启动 | 内存 | 适用 |
|------|---------|------|------|
| withNewEngine | ~500ms | 高 | 偶尔使用 Flutter 页面 |
| withCachedEngine | ~50ms | 中 | 频繁切换 Flutter 页面 |
| 全局单 Engine | 0（预热后） | 低 | Flutter 为核心功能 |

---

---

## 6. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 每次启动 Flutter 页面都 `withNewEngine()` | 启动延迟 ~500ms，内存翻倍 | 预缓存 Engine：`FlutterEngineCache.getInstance().put("key", engine)` |
| 不管理 FlutterEngine 生命周期 | Engine 泄漏，内存持续增长 | 在宿主 `Application` 中创建、`onTerminate` 中 `destroy()` |
| Flutter 模块与宿主 App 使用不同 Signature | Android Build 失败（签名冲突） | 确保 Flutter 模块与宿主使用同一签名证书 |
| `initialRoute` 不处理 Flutter 端路由 | Flutter 页面始终显示首页 | Dart 端通过 `window.defaultRouteName` 或 `onGenerateRoute` 解析路由 |
| 忘记 `install_all_flutter_pods`（iOS）| Pod 依赖缺失，编译失败 | 在 Podfile 中正确执行 `install_all_flutter_pods(flutter_application_path)` |

**最佳实践**：

- 单引擎复用：`FlutterEngineCache` 提前预热，适合频繁切换 Flutter 页面
- 多引擎隔离：每个业务模块独立 Engine，适合偶尔使用的独立功能
- 路由传参用 `initialRoute` 的 query 字符串形式：`/search?q=flutter&page=1`
- MethodChannel 在 Flutter 模块和宿主间共享相同的 channel name 即可通信
- Dart 端调用 `channel.invokeMethod()` 向宿主回传结果（如选中图书的 ISBN）
- `flutter attach` 命令可以在不重建宿主 App 的情况下热重载 Flutter 模块
- 团队中有原生开发者时，Add-to-App 是引入 Flutter 的低风险方式

## 7. 本章练习

1. 创建 Flutter 模块 `library_search`：执行 `flutter create --template module library_search`，在模块内实现一个图书搜索页面（搜索框 + 结果列表，使用 `TextField` + `ListView`），通过 MethodChannel（channel name: `library_search/book_select`）将用户点击的图书 ISBN 回传给宿主 App，验证 `flutter attach` 可以连接到该模块
2. 模拟 Android 宿主 App 集成：在 Android 宿主 App 的 `MainActivity` 中添加按钮，点击后使用 `FlutterActivity.withCachedEngine("library_engine").build(this)` 启动搜索页面，在 `Application.onCreate()` 中调用 `FlutterEngine(this).apply { dartExecutor.executeDartEntrypoint(DartExecutor.DartEntrypoint.createDefault()); }.also { FlutterEngineCache.getInstance().put("library_engine", it) }` 预热 Engine，传递 `initialRoute('/search')`
3. 实现双向通信回调：Flutter 端用户选中图书后通过 MethodChannel 调用 `channel.invokeMethod('onBookSelected', {'bookId': id, 'isbn': isbn})`，宿主端（Android `MethodCallHandler` / iOS `FlutterMethodCallHandler`）接收后在原生 UI 层展示图书信息卡片（TextView/UILabel），调用 `finish()`/`dismiss()` 关闭 Flutter 页面

验证：Android 宿主 App 点击按钮后能正常启动 Flutter 搜索页面；选中图书后宿主端正确接收回调并展示图书信息；`withCachedEngine` 方式启动延迟 < 100ms

---

> **下一步**: [Part XII — 测试体系](../Part-12-测试体系/Chapter-13-Widget测试入门.md)
> 📖 **延伸阅读**: [Add-to-App](https://docs.flutter.dev/add-to-app) | [FlutterEngine](https://api.flutter.dev/javadoc/io/flutter/embedding/engine/FlutterEngine.html) | [CachedEngine](https://docs.flutter.dev/add-to-app/android/add-flutter-screen#using-a-cached-flutterengine)
