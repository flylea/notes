# 附录 C：Dart 核心库速查

> 原文: [dart.cn/guides/libraries](https://dart.cn/guides/libraries)

## dart:core — 内置基础

```dart
// String: toUpperCase()/toLowerCase()/trim()/contains()/startsWith()/endsWith()/split()/replaceAll()/padLeft()/substring()
// int/double: abs()/ceil()/floor()/round()/toStringAsFixed(2)/clamp(min, max)
// DateTime: now()/parse()/add()/difference()/isAfter()/isBefore()/millisecondsSinceEpoch
// Duration: seconds/minutes/hours/days/inMilliseconds
// List/Set/Map: add/remove/contains/clear/map/where/reduce/fold/expand/sort
// RegExp: RegExp(r'\d+').hasMatch(str) / .allMatches(str) / .stringMatch(str)
```

## dart:async — 异步编程

```dart
// Future: then/catchError/whenComplete
// Stream: listen/asyncMap/where/map/transform/handleError
// Completer<T>: 手动控制 Future 完成
// Timer: Timer(duration, callback) / Timer.periodic(duration, callback)
// StreamController: add/close/stream
```

## dart:convert — 编解码

```dart
// jsonEncode(obj)/jsonDecode(str) — JSON ↔ Dart 对象
// utf8.encode(str)/decode(bytes) — UTF-8 编解码
// base64.encode(bytes)/decode(str) — Base64
// LineSplitter() — 按行分割
```

## dart:math — 数学

```dart
// Random: nextInt(max)/nextDouble()/nextBool()
// min(a,b)/max(a,b)/sqrt(x)/pow(base, exp)/sin/cos/tan/log
// pi/e — 常量
```

## dart:io — 文件与网络

```dart
// File/path — 读: readAsString()/readAsBytes()/readAsLines()
// 写: writeAsString()/writeAsBytes()
// Directory — list()/create()/delete()
// HttpClient — HTTP 请求底层 API
// Socket/ServerSocket — TCP 网络
// Platform — isAndroid/isIOS/isWindows/isMacOS/isLinux/environment
```

> Flutter 项目中优先使用 path_provider 获取目录 / Dio 做 HTTP 请求——它们是 dart:io 的上层封装。
