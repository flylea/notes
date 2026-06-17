# 第 58 章：错误处理与崩溃监控

> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 57 — DevTools 详解](./Chapter-57-DevTools详解.md)
> **下一章**: [Chapter 59 — 安全加固](./Chapter-59-安全加固.md)

---

## 0. 本章目标

- 掌握 Flutter 三层错误捕获机制
- 集成 Sentry 实现崩溃上报 + 堆栈 + 用户上下文 + Release Health
- 建立 Logger 分级日志系统（debug → info → warning → error）
- 实现友好的全局错误页面

> 🎯 **本章产出**：Sentry 崩溃监控 + Source Map 上传 + Release 跟踪 + Logger 分级日志。

---

## 1. Flutter 三层错误捕获

Flutter 的异常有三个逃逸通道，需要全部覆盖：

```dart
// lib/main.dart

Future<void> main() async {
  // ① Flutter 框架层错误（Widget build / layout / paint 中的异常）
  FlutterError.onError = (details) {
    FlutterError.presentError(details);               // Debug 模式显示红屏
    if (kReleaseMode) {
      Sentry.captureException(
        details.exception,
        stackTrace: details.stack,
        hint: 'FlutterError',
      );
    }
  };

  // ② 平台层 + 未捕获的 Dart 异步错误
  PlatformDispatcher.instance.onError = (error, stack) {
    if (kReleaseMode) {
      Sentry.captureException(error, stackTrace: stack);
    }
    return true;  // true = 已处理，App 不崩溃退出
  };

  WidgetsFlutterBinding.ensureInitialized();
  await _initSentry();

  runApp(const ProviderScope(child: LibraryApp()));
}

Future<void> _initSentry() async {
  await SentryFlutter.init(
    (options) {
      options.dsn = const String.fromEnvironment('SENTRY_DSN');
      options.tracesSampleRate = 0.1;           // 10% 的性能追踪采样
      options.release = 'library_app@${AppConfig.version}';
      options.environment = AppConfig.env.name;  // dev / staging / prod
      options.attachScreenshot = true;            // 崩溃时自动截图
      options.attachViewHierarchy = true;         // 崩溃时的 Widget 树
    },
    appRunner: () => runApp(const ProviderScope(child: LibraryApp())),
  );
}
```

---

## 2. Source Map 上传

混淆后的代码无法直接阅读堆栈跟踪，需要上传 Symbol 文件：

```bash
# 构建时生成 debug-info
flutter build appbundle --obfuscate --split-debug-info=./debug-info

# 上传到 Sentry
sentry-cli upload-dif \
  --org your-org \
  --project your-project \
  ./debug-info
```

CI/CD 中自动化这个步骤（见 Ch61）：

```yaml
- run: flutter build appbundle --release --obfuscate --split-debug-info=./debug-info
- run: |
    curl -sL https://sentry.io/get-cli/ | bash
    sentry-cli upload-dif --org $SENTRY_ORG --project $SENTRY_PROJECT ./debug-info
```

---

## 3. Sentry 高级功能

### 用户上下文关联

```dart
// 登录成功后关联用户信息到 Sentry
Sentry.configureScope((scope) {
  scope.setUser(SentryUser(
    id: userId,
    email: userEmail,
    extras: {'role': role.name, 'plan': 'pro'},
  ));
});

// 登出时清除
Sentry.configureScope((scope) => scope.setUser(null));
```

### 面包屑追踪

```dart
// 手动添加面包屑——帮助还原崩溃前用户的操作路径
Sentry.addBreadcrumb(Breadcrumb(
  message: 'User tapped borrow button',
  category: 'ui',
  level: SentryLevel.info,
  data: {'bookId': book.id, 'userId': currentUserId},
));

// 网络请求自动面包屑
// Sentry Dio 集成：sentry_dio 包自动上报 HTTP 请求为面包屑
```

### 性能监控

```dart
// 手动开启事务追踪
final transaction = Sentry.startTransaction(
  'book-search',
  'ui',
  bindToScope: true,
);

await searchBooks(query);
transaction.finish(status: SpanStatus.ok());
```

---

## 4. Logger 分级系统

```dart
// lib/core/logger/app_logger.dart
import 'package:logging/logging.dart';
import 'package:flutter/foundation.dart';

final logger = Logger('LibraryApp');

void setupLogger() {
  // 生产环境只记录 WARNING 及以上
  Logger.root.level = kReleaseMode ? Level.WARNING : Level.ALL;

  Logger.root.onRecord.listen((record) {
    final message = '${record.loggerName}: ${record.message}';

    if (kReleaseMode) {
      // 生产环境 → 发送到 Sentry
      if (record.level >= Level.SEVERE) {
        Sentry.captureException(
          record.error ?? Exception(message),
          stackTrace: record.stackTrace,
          hint: 'Logger(${record.level.name})',
        );
      }
    } else {
      // 开发环境 → 控制台输出
      final prefix = switch (record.level) {
        >= Level.SEVERE => '🔴',
        >= Level.WARNING => '🟡',
        >= Level.INFO => '🔵',
        _ => '⚪',
      };
      debugPrint('$prefix [$prefix ${record.level.name}] $message');
    }
  });
}

// 使用示例
logger.info('App started');
logger.warning('Slow API response', null, StackTrace.current);
logger.severe('Database sync failed', e, stackTrace);
```

---

## 5. 全局错误页面

```dart
// lib/main.dart
ErrorWidget.builder = (details) {
  if (kDebugMode) return ErrorWidget(details.exception);

  return MaterialApp(
    home: Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 64,
                color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 16),
              Text('应用遇到错误',
                style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => _restartApp(),
                child: const Text('重新加载'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
};
```

---

## 6. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 只重写 `FlutterError.onError`，忽略 `PlatformDispatcher.onError` | 异步错误和平台层异常无法上报，线上崩溃看不到 | 同时配置三层捕获：FlutterError + PlatformDispatcher + Sentry init |
| Release 模式不上传 Source Map | Sentry 收到的堆栈全是被混淆的符号（如 `Abc1.x()`），无法定位 | 构建时 `--split-debug-info` 输出符号文件，CI 中上传到 Sentry |
| Logger 记录完整 Token / 用户 PII 到日志 | 日志泄露敏感信息，违反隐私法规 | 生产环境日志只记录错误码和关键标识，不记录 Token/PII |
| 全局错误页面 `ErrorWidget.builder` 在 Debug 模式也隐藏错误 | 失去红屏调试优势 | `kDebugMode` 时返回 `ErrorWidget(details.exception)` 保留红屏 |
| Sentry 配置 `tracesSampleRate = 1.0` | 大量性能追踪消耗 Quota，超出免费额度 | 生产环境采样率设为 0.1-0.3，开发环境关闭 |

**最佳实践**：

- 三层错误捕获缺一不可：`FlutterError.onError` + `PlatformDispatcher.onError` + `SentryFlutter.init`
- 用户登录后关联 `SentryUser`（id/email/role），崩溃时能追溯到具体用户
- 在关键操作点添加 `Breadcrumb`（如"用户点击借阅"），还原崩溃前的操作路径
- Logger 分级输出：Debug 显示全部，Release 只发 WARNING 以上到 Sentry
- 使用 `sentry_dio` 自动将 HTTP 请求作为面包屑附加到 Sentry 事件
- 自定义 ErrorWidget 提供"重新加载"按钮，给用户恢复途径
- 定期在 Sentry 上 Review Issues，优先处理 Top 5 崩溃

## 7. 本章练习

1. 在 Library App 中集成 Sentry（使用 Sentry 免费额度即可）
2. 配置三层错误捕获 + Release 追踪
3. 实现 Logger 分级日志系统
4. 实现友好的全局错误页面
5. 模拟一个崩溃（如 `throw Exception('Test crash')`）并确认 Sentry 控制台收到上报

---

> **下一步**: [Part XIV — 发布与运维（Chapter 59）](../Part-14-发布与运维/Chapter-59-安全加固.md)
> 📖 **延伸阅读**: [Sentry Flutter SDK](https://docs.sentry.io/platforms/flutter/) | [logging 包](https://pub.dev/packages/logging)
