> **Part**: Part X | **上一章**: [Ch 43](./Chapter-43-推送通知.md) | **下一章**: [Ch 45](./Chapter-45-设备功能.md)
> **官方文档**: [flutter.cn/platform-integration/platform-channels](https://docs.flutter.cn/platform-integration/platform-channels) | [pub.dev/packages/pigeon](https://pub.dev/packages/pigeon)

---

# 第 44 章：平台通道 — Dart ↔ Native 双向通信

## 0. 本章目标与前置依赖

**前置依赖**：了解 Android/iOS 原生开发基本概念（Activity/ViewController），理解 Dart 异步编程（Ch 2）。

**本章目标**：Platform Channel 三种类型与选择、MethodChannel 完整调用链（Dart→Kotlin/Swift→返回）、Pigeon 代码生成实现类型安全通道、EventChannel 持续数据流、Channel 命名规范与线程模型。

> 🎯 **Library App 产出**：通过 MethodChannel/Pigeon 调用原生条码扫描 SDK 实现 ISBN 扫码录入。

---

## 1. Platform Channel 三种类型

```
┌──────────────┐    Binary Messages    ┌──────────────────┐
│  Dart 层      │ ◄══════════════════► │  Native 层        │
│  (Flutter)    │    (序列化/反序列化)    │  (Kotlin/Swift)   │
└──────────────┘                       └──────────────────┘
```

| 类型 | 通信模式 | 方向 | 适用场景 |
|------|---------|------|---------|
| **MethodChannel** | 请求→响应 | Dart→Native（主），Native→Dart（少） | 一次性操作：扫码、获取电量、拍照 |
| **EventChannel** | 持续流 | Native→Dart | 传感器数据流、网络状态变化、定位更新 |
| **BasicMessageChannel** | 双向消息 | 双向 | 自定义协议、复杂数据交换、持续双向通信 |

---

## 2. MethodChannel 完整调用链

### Dart 端

```dart
class BarcodeScanner {
  static const _channel = MethodChannel('com.library.app/barcode');

  /// 调用原生扫码功能
  static Future<String?> scan() async {
    try {
      final result = await _channel.invokeMethod<String>('scanBarcode');
      return result;
    } on PlatformException catch (e) {
      debugPrint('扫码失败: ${e.message}');
      if (e.code == 'CAMERA_PERMISSION_DENIED') {
        // 引导用户去设置开启权限
      }
      return null;
    } on MissingPluginException {
      debugPrint('平台未实现此方法');
      return null;
    }
  }
}
```

### Android (Kotlin)

```kotlin
// android/app/src/main/kotlin/.../MainActivity.kt
class MainActivity : FlutterActivity() {
  override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
    super.configureFlutterEngine(flutterEngine)

    MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.library.app/barcode")
      .setMethodCallHandler { call, result ->
        when (call.method) {
          "scanBarcode" -> {
            // 检查相机权限
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
              result.error("CAMERA_PERMISSION_DENIED", "相机权限未授予", null)
              return@setMethodCallHandler
            }
            // 启动条码扫描 Activity（使用 ZBar/Zxing 库）
            startBarcodeScanner { barcode -> result.success(barcode) }
          }
          else -> result.notImplemented()
        }
      }
  }
}
```

### iOS (Swift)

```swift
// ios/Runner/AppDelegate.swift
override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
  let controller = window?.rootViewController as! FlutterViewController
  let channel = FlutterMethodChannel(name: "com.library.app/barcode", binaryMessenger: controller.binaryMessenger)

  channel.setMethodCallHandler { (call, result) in
    switch call.method {
    case "scanBarcode":
      self.startBarcodeScanner { barcode in result(barcode) }
    default:
      result(FlutterMethodNotImplemented)
    }
  }
  return super.application(application, didFinishLaunchingWithOptions: launchOptions)
}
```

## 3. Pigeon——类型安全代码生成

手写 MethodChannel 的问题：方法名字符串拼写错误、参数和返回值类型不安全（`invokeMethod` 返回 `dynamic`）、Dart/Kotlin/Swift 三端代码不一致。Pigeon 解决这三个问题。

```dart
// pigeons/barcode_scanner.dart
import 'package:pigeon/pigeon.dart';

@ConfigurePigeon(PigeonOptions(
  dartOut: 'lib/core/platform/barcode_scanner.g.dart',
  kotlinOut: 'android/app/src/main/kotlin/.../BarcodeScanner.g.kt',
  swiftOut: 'ios/Runner/BarcodeScanner.g.swift',
))
@HostApi()
abstract class BarcodeScannerHost {
  /// 启动条码扫描
  String scan();

  /// 获取最后一次扫描结果
  @async
  String? getLastScanned();
}

@FlutterApi()
abstract class BarcodeScannerFlutter {
  /// 原生端通知 Dart 端扫描已完成
  void onScanComplete(String barcode);
}
```

```bash
dart run pigeon --input pigeons/barcode_scanner.dart
```

使用生成的代码：

```dart
final scanner = BarcodeScannerHostImpl();
final barcode = await scanner.scan();  // 类型安全——返回 String，不是 dynamic
```

## 4. EventChannel——持续数据流

```dart
// Dart 端——监听电池电量变化
static const _eventChannel = EventChannel('com.library.app/battery');
static Stream<int> get batteryLevel => _eventChannel.receiveBroadcastStream().map((event) => event as int);
// 使用
batteryLevel.listen((level) => print('电量: $level%'));
```

```kotlin
// Android 端——发送电池电量变化
EventChannel(flutterEngine.dartExecutor.binaryMessenger, "com.library.app/battery")
  .setStreamHandler(object : StreamHandler() {
    override fun onListen(args: Any?, events: EventSink) {
      // 注册广播接收器，电量变化时发送
      val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
          events.success(level)
        }
      }
      registerReceiver(receiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    }
    override fun onCancel(args: Any?) { /* 取消监听 */ }
  })
```

## 5. 线程模型与常见陷阱

```dart
// ⚠️ Platform Channel 所有调用都在主线程（UI Thread）
// Native 端如果执行耗时操作（如网络请求），必须切到后台线程

// ❌ Native 端主线程做耗时操作→UI 卡顿
// ✅ Native 端用协程/异步处理耗时操作，结果通过 result.success() 回调
```

| 最佳实践 | 说明 |
|---------|------|
| Pigeon > 手写 MethodChannel | 类型安全 + 三端一致 + 自动生成 |
| 错误码标准化 | `CAMERA_PERMISSION_DENIED`、`BARCODE_NOT_FOUND` 等语义化错误码 |
| Native 端耗时操作切后台 | Kotlin `Dispatchers.IO` / Swift `DispatchQueue.global()` |
| 单个 Channel 多个方法 | 通过 `call.method` 区分，而非创建多个 Channel |

---

> **下一步**: [Ch 45](./Chapter-45-设备功能.md)
