# 第 22 章：文件上传下载与 WebSocket 实时通信

> **Part**: Part IV — 网络与数据
> **上一章**: [Chapter 21 — Supabase 高级](./Chapter-21-Supabase高级.md)
> **下一章**: [Part V — 状态管理](../Part-05-状态管理/)

---

## 0. 本章目标

- 掌握 Dio 文件上传（分片、进度跟踪、取消）
- 学会文件下载与本地存储
- 理解 WebSocket 连接管理与 Supabase Realtime 的选型

> 🎯 **本章产出**：`lib/core/network/upload_service.dart` + Library App 的图书封面上传功能。

---

## 1. 文件上传

### 1.1 基础上传

```dart
// lib/core/network/upload_service.dart

class UploadService {
  final Dio _dio;

  UploadService(this._dio);

  Future<String> uploadBookCover(String bookId, File imageFile) async {
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        imageFile.path,
        filename: '${bookId}_cover.jpg',
        contentType: MediaType('image', 'jpeg'),
      ),
      'book_id': bookId,
    });

    final response = await _dio.post('/upload/cover', data: formData);
    return response.data['url'] as String;
  }
}
```

### 1.2 带进度跟踪的上传

```dart
Future<String> uploadWithProgress(
  String bookId,
  File imageFile,
  void Function(double progress) onProgress,
) async {
  final formData = FormData.fromMap({
    'file': await MultipartFile.fromFile(imageFile.path),
  });

  final response = await _dio.post(
    '/upload/cover',
    data: formData,
    onSendProgress: (sent, total) {
      final progress = total > 0 ? sent / total : 0;
      onProgress(progress);  // 0.0 ~ 1.0
    },
    cancelToken: _cancelToken,
  );

  return response.data['url'] as String;
}
```

### 1.3 取消上传

```dart
class UploadService {
  CancelToken? _cancelToken;

  Future<void> cancelUpload() async {
    _cancelToken?.cancel('用户取消了上传');
    _cancelToken = CancelToken(); // 重置
  }

  Future<String> upload(String bookId, File file) async {
    _cancelToken = CancelToken();
    try {
      // ... 上传逻辑使用 _cancelToken
    } on DioException catch (e) {
      if (CancelToken.isCancel(e)) {
        throw UploadCancelledException();
      }
      rethrow;
    }
  }
}
```

### 1.4 图片压缩后上传

```dart
import 'package:image/image.dart' as img;

Future<File> compressImage(File source, {int maxWidth = 1024, int quality = 85}) async {
  final bytes = await source.readAsBytes();
  final decoded = img.decodeImage(bytes);
  if (decoded == null) return source;

  final resized = img.copyResize(decoded, width: maxWidth);
  final compressed = img.encodeJpg(resized, quality: quality);

  final outputPath = '${source.parent.path}/compressed_${source.uri.pathSegments.last}';
  return File(outputPath)..writeAsBytesSync(compressed);
}
```

---

## 2. 文件下载

```dart
Future<String> downloadFile(String url, String fileName) async {
  // 1. 获取应用文档目录
  final dir = await getApplicationDocumentsDirectory();
  final filePath = '${dir.path}/$fileName';

  // 2. 下载（带进度）
  await _dio.download(
    url,
    filePath,
    onReceiveProgress: (received, total) {
      final progress = total > 0 ? received / total : 0;
      debugPrint('下载进度: ${(progress * 100).toStringAsFixed(0)}%');
    },
    cancelToken: _cancelToken,
  );

  return filePath;
}
```

---

## 3. WebSocket 实时通信

### 3.1 WebSocket vs Supabase Realtime

| 维度 | WebSocket | Supabase Realtime |
|------|-----------|-------------------|
| 适用场景 | 自定义实时协议、聊天、游戏 | 数据库变更订阅 |
| 连接管理 | 手动（心跳、重连） | 自动（Supabase SDK 内置） |
| 序列化 | 自定义（文本/二进制） | JSON（自动） |
| 广播 | 需自建房间/频道 | 内置 Broadcast |
| 推荐场景 | 需要低延迟自定义协议的场景 | CRUD 数据变更推送 |

对于 Library App，图书信息变更 → Supabase Realtime。如果需要聊天/通知 → WebSocket。

### 3.2 WebSocket 连接管理

```dart
// lib/core/network/websocket_client.dart
import 'dart:io';
import 'dart:async';

class WebSocketClient {
  WebSocket? _socket;
  Timer? _heartbeat;
  final String _url;
  final List<void Function(dynamic)> _messageHandlers = [];

  WebSocketClient(this._url);

  Future<void> connect() async {
    _socket = await WebSocket.connect(_url);
    
    _socket!.listen(
      (data) {
        for (final handler in _messageHandlers) {
          handler(data);
        }
      },
      onDone: _onDisconnected,
      onError: (error) {
        debugPrint('WebSocket error: $error');
        _reconnect();
      },
    );

    _startHeartbeat();
  }

  void onMessage(void Function(dynamic) handler) {
    _messageHandlers.add(handler);
  }

  void send(String message) {
    _socket?.add(message);
  }

  void _startHeartbeat() {
    _heartbeat = Timer.periodic(const Duration(seconds: 30), (_) {
      send('ping');
    });
  }

  void _onDisconnected() {
    _heartbeat?.cancel();
    _reconnect();
  }

  void _reconnect() {
    Future.delayed(const Duration(seconds: 3), connect);
  }

  Future<void> close() async {
    _heartbeat?.cancel();
    await _socket?.close();
  }
}
```

### 3.3 配合 Riverpod 生命周期管理

```dart
final webSocketProvider = Provider.autoDispose<WebSocketClient>((ref) {
  final client = WebSocketClient('wss://api.example.com/ws');
  
  ref.onDispose(() => client.close());
  
  client.connect();
  return client;
});
```

---

## 4. 本章练习

1. 实现 `UploadService` 上传图书封面，显示上传进度条
2. 在详情页增加「更换封面」按钮，上传成功后更新封面图
3. 实现上传取消按钮
4. **选做**：用 WebSocket 或 Supabase Realtime 实现图书库存的实时更新——管理员修改库存后，所有在线用户即时看到变化

验证：上传图片后确认 Supabase Storage 中有对应文件，上传期间进度条正常显示。

---

> 📖 **延伸阅读**: [Dio 文档](https://pub.dev/packages/dio) | [WebSocket API](https://api.dart.dev/dart-io/WebSocket-class.html) | [Supabase Realtime](https://supabase.com/docs/guides/realtime)
