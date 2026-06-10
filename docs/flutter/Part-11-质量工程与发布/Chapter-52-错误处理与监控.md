> **Part**: Part XI | **上一章**: [Ch 51](./Chapter-51-性能优化.md) | **下一章**: [Ch 53](./Chapter-53-安全加固.md)

---

# 第 52 章：错误处理与崩溃监控

## 0. 本章目标

Flutter 错误捕获三层级（FlutterError.onError/PlatformDispatcher.instance.onError/runZonedGuarded）及其覆盖范围、全局 ErrorWidget.builder 自定义错误 UI、Sentry 完整集成（崩溃上报+堆栈追踪+Release 版本+用户上下文）、Logger 分级系统（debug/info/warning/error——开发环境 console + 生产环境 Sentry）。

> 🎯 **Library App 产出**：Sentry 崩溃自动上报 + Release Tracking + User Context、友好全局错误页面（含重试按钮）、Logger 分级日志系统。

---

## 1. 三层错误捕获

```dart
// lib/main.dart
Future<void> main() async {
  // ① Flutter 框架层错误（build/setState/layout 中的异常）
  FlutterError.onError = (details) {
    FlutterError.presentError(details);            // 仍然显示红色错误页（Debug）
    Sentry.captureException(details.exception, stackTrace: details.stack);  // 上报
  };

  // ② 平台层 + 未捕获的 Dart 异步错误
  PlatformDispatcher.instance.onError = (error, stack) {
    Sentry.captureException(error, stackTrace: stack);
    return true;  // true = 已处理，不崩溃
  };

  WidgetsFlutterBinding.ensureInitialized();
  await SentryFlutter.init((options) {
    options.dsn = 'https://xxx@yyy.ingest.sentry.io/zzz';
    options.tracesSampleRate = 0.1;
    options.release = 'library_app@${AppConfig.version}';
    options.environment = AppConfig.env.name;
  }, appRunner: () => runApp(const LibraryApp()));
}
```

## 2. 全局错误 UI

```dart
ErrorWidget.builder = (details) => Material(
  child: Scaffold(body: Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(
    mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.error_outline, size: 64, color: Colors.red),
      const SizedBox(height: 16),
      Text('应用遇到错误', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      Text(details.exceptionAsString(), style: const TextStyle(color: Colors.grey, fontSize: 12)),
      const SizedBox(height: 24),
      FilledButton(onPressed: () => _restartApp(), child: const Text('重新加载')),
])),
)));
```

## 3. Logger 分级系统

```dart
import 'package:logging/logging.dart';

final logger = Logger('LibraryApp');

void setupLogger() {
  Logger.root.level = kReleaseMode ? Level.WARNING : Level.ALL;

  Logger.root.onRecord.listen((record) {
    if (kReleaseMode) {
      if (record.level >= Level.SEVERE) Sentry.captureEvent(SentryEvent(message: SentryMessage('${record.loggerName}: ${record.message}'), level: SentryLevel.error));
    } else {
      debugPrint('[${record.level.name}] ${record.loggerName}: ${record.message}');
    }
  });
}

// 使用
logger.info('User logged in');
logger.warning('Network request slow', {'duration': '2500ms'});
logger.severe('Failed to sync queue', e, stackTrace);
```

---

> **下一步**: [Ch 53](./Chapter-53-安全加固.md)
