> **Part**: Part X — 平台集成与设备能力
> **上一章**: [Chapter 47 — 高级 UI 效果](../Part-09-高级UI与体验/Chapter-47-高级UI效果.md)
> **下一章**: [Chapter 49 — 平台通道](./Chapter-49-平台通道.md)
> **官方文档**: [firebase.google.com/docs/cloud-messaging](https://firebase.google.com/docs/cloud-messaging) | [pub.dev/packages/firebase_messaging](https://pub.dev/packages/firebase_messaging) | [pub.dev/packages/flutter_local_notifications](https://pub.dev/packages/flutter_local_notifications)

---

# 第 48 章：推送通知 — FCM + 本地通知

## 0. 本章目标与前置依赖

**前置依赖**：已完成 Supabase 集成（Ch 21-22）和深度链接（Ch 12），理解 Riverpod StreamProvider（Ch 16）。

**本章目标**：
- 理解 FCM 推送全流程（Token 获取→Topic 订阅→两种消息类型→三种 App 状态处理）
- 掌握 flutter_local_notifications（Android 通知通道/iOS 权限/通知样式/分组）
- 掌握通知点击 Deep Link 跳转（Payload 携带路由信息）
- 理解 Supabase Edge Function + Firebase Admin SDK 触发推送的架构
- 建立与 Web Push API + Service Worker 的类比

> 🎯 **本章会在图书馆 App 中做什么**：借阅到期前 1 天的本地提醒通知、新书上架 FCM 推送（Edge Function + Admin SDK 广播给所有订阅用户）、预约到书通知推送、通知点击跳转到图书详情页。

---

## 1. FCM 推送架构全景

```
┌─────────────────────────────────────────────────┐
│  服务端（Supabase Edge Function）                 │
│  ① 管理员添加新书 → DB Trigger → Edge Function    │
│  ② Edge Function 调用 Firebase Admin SDK          │
│     → messaging.send({ topic: 'new_books', ... }) │
└─────────────────┬───────────────────────────��─────┘
                  │ Firebase Cloud Messaging
                  ▼
┌─────────────────────────────────────────────────┐
│  客户端（Flutter App）                           │
│  ③ FCM SDK 接收消息                               │
│  ④ 根据 App 状态决定处理方式：                      │
│     • 前台 → onMessage 回调 → 显示本地通知          │
│     • 后台 → 系统托盘自动显示通知                    │
│     • 终止 → 系统托盘显示 + onMessageOpenedApp      │
│  ⑤ 用户点击通知 → Deep Link 跳转到对应页面          │
└─────────────────────────────────────────────────┘
```

### 1.1 两种消息类型

| 类型 | 谁处理 | 包含什么 | 适用场景 |
|------|--------|---------|---------|
| **Notification Message** | 系统自动展示 | title/body/icon（预定义字段） | 大多数推送——系统直接显示 |
| **Data Message** | 你的代码处理 | 自定义 key-value | 静默数据同步、自定义 UI |

```json
// Notification Message — 系统自动展示通知
{ "message": { "topic": "new_books", "notification": { "title": "新书上架", "body": "《Clean Code 2nd Edition》已上架" } } }

// Data Message — 应用自行处理
{ "message": { "topic": "sync", "data": { "action": "refresh_books", "book_id": "123" } } }
```

---

## 2. 项目配置

### 2.1 Firebase 项目创建

```bash
# 安装 Firebase CLI
npm install -g firebase-tools
firebase login

# 在 Flutter 项目中初始化 Firebase
flutterfire configure
# 自动生成：android/app/google-services.json、ios/Runner/GoogleService-Info.plist
```

### 2.2 安装依赖

```yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^18.0.0
```

### 2.3 iOS 额外配置

> **APNs（Apple Push Notification service）**是苹果的推送服务——iOS 系统只认 APNs。Firebase FCM 在 iOS 上其实是把 Firebase Token 和 APNs Token 关联起来，实际推送最终还是通过 APNs 投递。而 Android 没有这个限制——FCM 直接通过 Google Play Services 推送。这就是为什么 iOS 需要额外的注册流程。

```xml
<!-- ios/Runner/Info.plist -->
<key>FirebaseMessagingAutoInitEnabled</key>
<false/>  <!-- 手动控制初始化时机 -->
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>remote-notification</string>
</array>
```

```swift
// ios/Runner/AppDelegate.swift — 注册 APNs Token
import Firebase
override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
  Messaging.messaging().apnsToken = deviceToken
}
```

---

## 3. FCM 完整初始化

```dart
// lib/core/notification/fcm_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class FcmService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _local = FlutterLocalNotificationsPlugin();

  /// ① 主初始化——在 main() 中调用
  Future<void> init() async {
    // 请求通知权限（iOS 必须显式请求）
    final settings = await _fcm.requestPermission(
      alert: true, announcement: false, badge: true,
      carPlay: false, criticalAlert: false, provisional: false, sound: true,
    );

    if (settings.authorizationStatus != AuthorizationStatus.authorized) {
      debugPrint('❌ 用户拒绝了通知权限');
      return;  // 优雅降级——不强制要求通知权限
    }

    // 获取 FCM Token——服务端通过此 Token 向特定设备推送
    final token = await _fcm.getToken();
    debugPrint('📱 FCM Token: $token');
    // 上传 Token 到 Supabase（用于定向推送）
    // await _uploadToken(token);

    // Token 刷新监听——Token 过期或 App 重装时会变化
    _fcm.onTokenRefresh.listen((newToken) {
      debugPrint('🔄 Token refreshed: $newToken');
      // await _uploadToken(newToken);
    });

    // 订阅"新书上架"主题——不依赖服务端存储 Token
    await _fcm.subscribeToTopic('new_books');
    debugPrint('✅ Subscribed to topic: new_books');

    // 初始化本地通知插件
    await _initLocalNotifications();

    // 注册消息处理器
    _handleForegroundMessage();   // 前台消息
    _handleNotificationTap();     // 通知点击
    _handleInitialMessage();      // 终止状态启动
  }

  // ──── ② 前台消息处理 ────
  void _handleForegroundMessage() {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('📩 前台收到消息: ${message.notification?.title}');

      // 前台不自动显示通知——手动显示本地通知
      if (message.notification != null) {
        _showLocalNotification(
          id: DateTime.now().millisecond,
          title: message.notification!.title ?? '新消息',
          body: message.notification!.body ?? '',
          payload: jsonEncode(message.data),  // 携带自定义数据
        );
      }
    });
  }

  // ──── ③ 后台/终止状态——点击通知启动 App ────
  void _handleNotificationTap() {
    // App 在后台时，用户点击通知
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('👆 用户点击通知进入 App: ${message.data}');
      _navigateFromNotification(message.data);
    });
  }

  // ──── ④ App 在终止状态——点击通知冷启动 ────
  void _handleInitialMessage() async {
    final initial = await _fcm.getInitialMessage();
    if (initial != null) {
      debugPrint('🚀 冷启动: 用户点击通知打开 App');
      // 延迟导航——等待 GoRouter 初始化完成
      Future.delayed(const Duration(milliseconds: 500), () {
        _navigateFromNotification(initial.data);
      });
    }
  }

  // ──── ⑤ 通知点击 → Deep Link 跳转 ────
  void _navigateFromNotification(Map<String, dynamic> data) {
    final bookId = data['book_id'];
    final type = data['type'];

    if (bookId != null) {
      goRouter.go('/book/$bookId');
    } else if (type == 'overdue') {
      goRouter.go('/borrowing');
    } else if (type == 'announcement') {
      goRouter.go('/notifications');
    }
  }

  /// 取消订阅
  Future<void> unsubscribeFromNewBooks() => _fcm.unsubscribeFromTopic('new_books');
}
```

---

## 4. 本地通知完整配置

```dart
// lib/core/notification/local_notification_service.dart
class LocalNotificationService {
  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    // Android 初始化设置
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');

    // iOS 初始化设置
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true, requestBadgePermission: true, requestSoundPermission: true,
      defaultPresentAlert: true,     // 前台也显示通知
      defaultPresentBadge: true,
      defaultPresentSound: true,
    );

    await _plugin.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: _onNotificationTap,
    );

    // 创建 Android 通知通道（必须——Android 8+ 没有通道通知不会显示）
    await _createChannels();
  }

  /// 创建通知通道（按功能分类）
  ///
  /// 通知通道可以想象成电视机的"频道分类"——同一个遥控器可以切换新闻台、体育台、音乐台，
  /// 每个台的默认音量和是否静音都是独立的。通知通道同理：
  /// "到期提醒"通道声音大、振动强，"新书上架"通道只振动，"系统通知"通道静默。
  /// 用户可以在系统设置中按通道分别调整通知行为。
  Future<void> _createChannels() async {
    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    if (androidPlugin == null) return;

    // 到期提醒通道
    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel('due_reminder', '到期提醒', description: '借阅到期提醒通知', importance: Importance.high, playSound: true, enableVibration: true),
    );
    // 新书上架通道
    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel('new_books', '新书上架', description: '新书入库上架通知', importance: Importance.defaultImportance, playSound: false),
    );
    // 系统通知通道
    await androidPlugin.createNotificationChannel(
      const AndroidNotificationChannel('system', '系统通知', description: '系统维护与公告通知', importance: Importance.low),
    );
  }

  /// 发送本地通知
  Future<void> show({
    required int id, required String title, required String body,
    String? channelId = 'system', String? payload,
  }) async {
    await _plugin.show(id, title, body, NotificationDetails(
      android: AndroidNotificationDetails(channelId!, channelId == 'due_reminder' ? '到期提醒' : '系统通知',
        channelDescription: 'Library App 通知',
        icon: '@mipmap/ic_launcher', color: Colors.blue,
        importance: Importance.high, priority: Priority.high,
        styleInformation: const BigTextStyleInformation(''),  // 展开式通知
      ),
      iOS: const DarwinNotificationDetails(presentAlert: true, presentBadge: true, presentSound: true),
    ), payload: payload);
  }

  /// 用户点击本地通知
  void _onNotificationTap(NotificationResponse response) {
    if (response.payload != null) {
      final data = jsonDecode(response.payload!);
      _navigateFromNotification(data);
    }
  }
}
```

---

## 5. Supabase Edge Function 触发 FCM

> **为什么推送需要服务端？** 因为推送通知需要 Firebase 的服务器密钥（Server Key）。这个密钥绝不能放在客户端 App 里——别人反编译 App 就能拿到，然后冒充你的 App 给所有用户发垃圾推送。所以密钥存放在 Supabase Edge Function 的环境变量中，客户端调用 Edge Function，由它用密钥调用 Firebase。

```typescript
// supabase/functions/send-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { initializeApp, cert } from 'npm:firebase-admin/app';
import { getMessaging } from 'npm:firebase-admin/messaging';

// 初始化 Firebase Admin SDK（服务端——安全使用 service account key）
const app = initializeApp({ credential: cert(JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!)) });
const messaging = getMessaging(app);

serve(async (req) => {
  const { title, body, topic, data } = await req.json();

  try {
    const messageId = await messaging.send({
      notification: { title, body },
      data: data ?? {},   // 自定义数据（用于 Deep Link 导航）
      topic: topic,       // 发送给订阅该 topic 的所有设备
    });

    return new Response(JSON.stringify({ success: true, messageId }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

```bash
# 部署
supabase functions deploy send-notification
```

```dart
// Flutter 端调用 Edge Function 触发推送（管理员操作）
Future<void> notifyNewBook(Book book) async {
  await supabase.functions.invoke('send-notification', body: {
    'title': '📚 新书上架',
    'body': '《${book.title}》by ${book.author} 已加入图书馆',
    'topic': 'new_books',
    'data': {'book_id': book.id, 'type': 'new_book'},
  });
}
```

---

## 6. Library App 通知策略

| 场景 | 类型 | 通道 | 触发方式 | 触发时机 |
|------|------|------|---------|---------|
| 借阅到期提醒 | 本地通知 | `due_reminder` | flutter_local_notifications.periodicallyShow() | 到期前 1 天 + 到期当天 |
| 借阅逾期通知 | 本地通知 | `due_reminder` | App 启动时检查 + 每日定时 | 逾期后每天 |
| 新书上架 | FCM | `new_books` | Edge Function | 管理员添加新书 → DB Trigger |
| 预约到书 | FCM | `system` | Edge Function | 归还操作后检查预约队列 |
| 系统公告 | FCM | `system` | Supabase Dashboard 或 Edge Function | 手动触发 |

```dart
// 定时到期检查
Future<void> _scheduleDueReminders() async {
  final records = await ref.read(borrowRepositoryProvider).getActiveBorrows();
  for (final record in records) {
    final daysUntilDue = record.dueDate.difference(DateTime.now()).inDays;

    if (daysUntilDue == 1) {
      await localNotifications.show(
        id: record.id.hashCode,
        title: '借阅即将到期',
        body: '《${record.bookTitle}》将于明天到期，请及时归还',
        channelId: 'due_reminder',
        payload: jsonEncode({'type': 'due_reminder', 'record_id': record.id}),
      );
    } else if (daysUntilDue <= 0) {
      await localNotifications.show(
        id: record.id.hashCode,
        title: '借阅已逾期',
        body: '《${record.bookTitle}》已逾期 ${daysUntilDue.abs()} 天，请尽快归还',
        channelId: 'due_reminder',
        payload: jsonEncode({'type': 'overdue', 'record_id': record.id}),
      );
    }
  }
}
```

---

## 7. 常见错误与最佳实践

```dart
// ❌ 错误 1：忘记检查通知权限——iOS 用户可能拒绝
// ✅ 在 init() 中检查 settings.authorizationStatus，拒绝时优雅降级

// ❌ 错误 2：冷启动时立即导航——GoRouter 可能还没初始化
// ✅ Future.delayed(500ms) 或监听 GoRouter 的 ready 状态

// ❌ 错误 3：前台收到 FCM 消息什么都不做——消息被静默丢弃
// ✅ onMessage 中手动调用 flutter_local_notifications.show()

// ❌ 错误 4：在 FCM Token 回调中执行耗时操作
// ✅ 异步上传 Token，不阻塞回调

// ❌ 错误 5：Firebase Admin SDK 的 service account key 提交到 Git
// ✅ 存储在 Supabase Edge Function 的环境变量中

// ❌ 错误 6：Android 8+ 没创建通知通道——通知静默不显示
// ✅ init() 中创建所有必需的 NotificationChannel
```

| 最佳实践 | 说明 |
|---------|------|
| 通知权限失败 → 优雅降级 | 不强制要求——App 核心功能不依赖推送 |
| FCM Token 及时上传 | onTokenRefresh 时更新 Supabase 中的 Token |
| Topic 替代 Token 定向 | `new_books` topic 广播 > 逐个 Token 推送 |
| Edge Function 保护 Firebase Key | service account key 存在 Supabase 环境变量中 |
| 通知点击 → Deep Link | Payload 携带 `book_id` → context.go('/book/$bookId') |

---

## 8. 与 Web Push API 对照

| 概念 | FCM (Flutter) | Web Push API |
|------|-------------|-------------|
| Token 获取 | `FirebaseMessaging.instance.getToken()` | `pushManager.subscribe()` → endpoint |
| 权限请求 | `requestPermission()` | `Notification.requestPermission()` |
| 前台消息 | `onMessage.listen()` | `self.addEventListener('push', ...)` |
| Topic 订阅 | `subscribeToTopic('topic')` | 无原生等价 → 通过服务端分组 |
| 通知点击 | `onMessageOpenedApp.listen()` | `self.addEventListener('notificationclick', ...)` |
| 服务端 SDK | Firebase Admin SDK (Node.js/Python/Go) | Web Push library (node-web-push) |

---

## 9. 本章小结

| 你学到了什么 | 核心要点 |
|-------------|---------|
| FCM 全流程 | Token → Topic → Notification/Data Message → 三种 App 状态处理 |
| 本地通知 | flutter_local_notifications + Android Channel + iOS 权限 |
| 通知点击 Deep Link | Payload 携带路由数据 → context.go() |
| Edge Function 触发推送 | Supabase Edge Function → Firebase Admin SDK → topic 广播 |
| 通知策略 | 到期前一天/逾期每天/新书上架/预约到书 四种场景 |

---

---

## 10. 本章练习

1. 为 Library App 实现借阅到期提醒本地通知：在借阅成功时调用 `flutter_local_notifications` 的 `zonedSchedule` 安排定时通知（到期前 24 小时触发），通知标题包含书名、正文包含到期日期，Android 端配置 `AndroidNotificationDetails` 的 channelId 和 importance，iOS 端确保 `Info.plist` 已声明通知权限，通过 `onDidReceiveNotificationResponse` 回调使用 `context.go('/book/${bookId}')` 跳转到图书详情页
2. 为 Library App 实现新书上架 FCM 推送：在 `main()` 初始化 Firebase 后调用 `subscribeToTopic('new_books')`，在 `FirebaseMessaging.onMessage` 中调用 `flutterLocalNotificationsPlugin.show()` 显示带大图（`BigPictureStyle`）的通知，在 `onMessageOpenedApp` 中从 `message.data['bookId']` 提取参数并跳转到图书详情页，验证通知在前台/后台/终止三种状态下的表现
3. 创建 Supabase Edge Function 触发 FCM 推送：在 `supabase/functions/notify_new_book/` 中编写 Edge Function，监听 `books` 表的 INSERT 事件（通过 Database Webhook 触发），调用 Firebase Admin SDK 的 `messaging.sendToTopic('new_books', {notification: ..., data: {bookId: ...}})`，部署后通过 Supabase Dashboard 手动插入一条测试数据验证推送送达

验证：`flutter_local_notifications` 定时通知在设定时间准时弹出；FCM 推送在 App 前台时显示本地通知、后台时系统通知栏出现；Edge Function 部署后插入新书记录能收到推送

---

> **下一步**: [Chapter 49 — 平台通道](./Chapter-49-平台通道.md)
> 📖 **延伸阅读**: [FCM 文档](https://firebase.google.com/docs/cloud-messaging) | [flutter_local_notifications](https://pub.dev/packages/flutter_local_notifications) | [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
