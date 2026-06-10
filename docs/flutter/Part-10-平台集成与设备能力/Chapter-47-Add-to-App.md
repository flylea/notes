> **Part**: Part X | **上一章**: [Ch 46](./Chapter-46-桌面端.md) | **下一章**: [Part XI](../Part-11-质量工程与发布/)

---

# 第 47 章：Add-to-App — 在现有应用中集成 Flutter

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

> **下一步**: [Part XI — 质量工程与发布](../Part-11-质量工程与发布/)
