# 第 68 章：补充实战项目 — 聊天 App

## 0. 本章目标

Library App 覆盖了 CRUD、认证、离线、推送等核心场景。本章通过一个完整的**聊天 App (Chatter)** 补充 Library App 未涉及的技能：**WebSocket 实时通信**、**文件上传**、**实时消息流**。

> 🎯 **本章产出**：一个完整的聊天 App，具备联系人列表、一对一实时聊天、图片消息、推送通知功能。

---

## 1. 项目概述

### 功能需求

- [x] 用户登录（Supabase Auth，复用 Library App 的认证模块）
- [x] 联系人列表（Supabase 数据库）
- [x] 一对一实时聊天（Supabase Realtime Channel）
- [x] 发送图片消息（文件上传到 Supabase Storage）
- [x] 消息推送通知（FCM + Edge Function 触发）
- [x] 聊天记录本地缓存（Drift 离线消息）

### 技术栈

```
状态管理: Riverpod (flutter_riverpod + riverpod_annotation)
路由:      go_router
实时通信:   Supabase Realtime (WebSocket)
文件存储:   Supabase Storage
推送:      FCM + flutter_local_notifications
本地缓存:   Drift (SQLite)
模型:      freezed
```

### 预计完成时间：2 天

---

## 2. 数据模型设计

### 2.1 Supabase 数据库 Schema

```sql
-- 联系人表
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 聊天室表（一对一聊天）
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID REFERENCES profiles(id) NOT NULL,
  user2_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

-- 消息表
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) NOT NULL,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### 2.2 Dart 模型定义

```dart
// lib/features/chat/domain/message.dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'message.freezed.dart';
part 'message.g.dart';

@freezed
class Message with _$Message {
  const factory Message({
    required String id,
    required String roomId,
    required String senderId,
    String? content,
    String? imageUrl,
    required DateTime createdAt,
  }) = _Message;

  factory Message.fromJson(Map<String, dynamic> json) => _$MessageFromJson(json);

  const Message._();

  bool get isImage => imageUrl != null;
  bool get isText => content != null;
}

@freezed
class ChatRoom with _$ChatRoom {
  const factory ChatRoom({
    required String id,
    required String otherUserId,
    required String otherUsername,
    String? otherAvatarUrl,
    String? lastMessage,
    required DateTime updatedAt,
    @Default(0) int unreadCount,
  }) = _ChatRoom;

  factory ChatRoom.fromJson(Map<String, dynamic> json) => _$ChatRoomFromJson(json);
}

@freezed
class ChatUser with _$ChatUser {
  const factory ChatUser({
    required String id,
    required String username,
    String? avatarUrl,
  }) = _ChatUser;

  factory ChatUser.fromJson(Map<String, dynamic> json) => _$ChatUserFromJson(json);
}
```

---

## 3. 数据层实现

### 3.1 Drift 离线消息表

```dart
// lib/features/chat/data/local/drift_database.dart
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'dart:io';
part 'drift_database.g.dart';

class Messages extends Table {
  TextColumn get id => text()();
  TextColumn get roomId => text()();
  TextColumn get senderId => text()();
  TextColumn get content => text().nullable()();
  TextColumn get imageUrl => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftDatabase(tables: [Messages])
class ChatDatabase extends _$ChatDatabase {
  ChatDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  // 插入消息
  Future<void> insertMessage(Message message) {
    return into(messages).insertOnConflictUpdate(
      MessagesCompanion.insert(
        id: message.id,
        roomId: message.roomId,
        senderId: message.senderId,
        content: Value(message.content),
        imageUrl: Value(message.imageUrl),
        createdAt: message.createdAt,
      ),
    );
  }

  // 获取聊天室的所有消息（按时间正序）
  Stream<List<Message>> watchMessages(String roomId) {
    return (select(messages)
      ..where((m) => m.roomId.equals(roomId))
      ..orderBy([(m) => OrderingTerm(expression: m.createdAt)]))
      .watch()
      .map((rows) => rows.map(_toMessage).toList());
  }

  // 删除聊天室消息
  Future<void> deleteRoomMessages(String roomId) {
    return (delete(messages)..where((m) => m.roomId.equals(roomId))).go();
  }

  Message _toMessage(MessagesData row) {
    return Message(
      id: row.id,
      roomId: row.roomId,
      senderId: row.senderId,
      content: row.content,
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
    );
  }
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'chat.db'));
    return NativeDatabase.createInBackground(file);
  });
}
```

### 3.2 Chat Repository

```dart
// lib/features/chat/data/chat_repository.dart
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../domain/message.dart';

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  return ChatRepository(
    supabase: Supabase.instance.client,
    db: ref.read(chatDatabaseProvider),
  );
});

class ChatRepository {
  final SupabaseClient _supabase;
  final ChatDatabase _db;

  ChatRepository({required SupabaseClient supabase, required ChatDatabase db})
      : _supabase = supabase,
        _db = db;

  String get _userId => _supabase.auth.currentUser!.id;

  // ──── 联系人 ────

  Future<List<ChatUser>> getContacts() async {
    final response = await _supabase
        .from('profiles')
        .select()
        .neq('id', _userId);
    return response.map((json) => ChatUser.fromJson(json)).toList();
  }

  // ──── 聊天室 ────

  Future<ChatRoom> getOrCreateRoom(String otherUserId, String otherUsername) async {
    // 检查是否已有聊天室（无序遍历 user1/user2）
    final existing = await _supabase
        .from('chat_rooms')
        .select()
        .or('and(user1_id.eq.$_userId,user2_id.eq.$otherUserId),and(user1_id.eq.$otherUserId,user2_id.eq.$_userId)')
        .maybeSingle();

    if (existing != null) {
      return ChatRoom(
        id: existing['id'],
        otherUserId: otherUserId,
        otherUsername: otherUsername,
        otherAvatarUrl: existing['other_avatar_url'],
        lastMessage: existing['last_message'],
        updatedAt: DateTime.parse(existing['updated_at']),
      );
    }

    // 创建新聊天室
    final created = await _supabase.from('chat_rooms').insert({
      'user1_id': _userId,
      'user2_id': otherUserId,
    }).select().single();

    return ChatRoom(
      id: created['id'],
      otherUserId: otherUserId,
      otherUsername: otherUsername,
      updatedAt: DateTime.parse(created['created_at']),
    );
  }

  // ──── 聊天室列表 ────

  Future<List<ChatRoom>> getChatRooms() async {
    final response = await _supabase
        .from('chat_rooms')
        .select('id, user1_id, user2_id, updated_at, profiles!chat_rooms_user2_id_fkey(username, avatar_url)')
        .or('user1_id.eq.$_userId,user2_id.eq.$_userId')
        .order('updated_at', ascending: false);

    return response.map((room) {
      final isUser1 = room['user1_id'] == _userId;
      final otherUser = isUser1
          ? room['profiles'] as Map<String, dynamic>
          : room['profiles'] as Map<String, dynamic>;

      final otherUserId = isUser1 ? room['user2_id'] as String : room['user1_id'] as String;

      return ChatRoom(
        id: room['id'],
        otherUserId: otherUserId,
        otherUsername: otherUser['username'] ?? 'Unknown',
        otherAvatarUrl: otherUser['avatar_url'],
        updatedAt: DateTime.parse(room['updated_at']),
      );
    }).toList();
  }

  // ──── 实时消息流 ────

  Stream<List<Message>> watchMessages(String roomId) {
    // 1. 先从 Drift 加载缓存
    // 2. 订阅 Supabase Realtime 获取新消息
    // 3. 将新消息写入 Drift

    final controller = StreamController<List<Message>>();

    // 加载本地缓存
    _db.watchMessages(roomId).listen((localMessages) {
      controller.add(localMessages);
    });

    // 订阅远端实时消息
    final channel = _supabase
        .channel('room:$roomId')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert,
          schema: 'public',
          table: 'messages',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'room_id',
            value: roomId,
          ),
          callback: (payload) {
            final message = Message.fromJson(payload.newRecord);
            _db.insertMessage(message);
          },
        )
        .subscribe();

    controller.onCancel = () {
      _supabase.removeChannel(channel);
    };

    return controller.stream;
  }

  // ──── 发送消息 ────

  Future<void> sendMessage({
    required String roomId,
    required String content,
    String? imageUrl,
  }) async {
    final message = {
      'room_id': roomId,
      'sender_id': _userId,
      'content': content,
      'image_url': imageUrl,
    };

    await _supabase.from('messages').insert(message).select().single();

    // 更新聊天室最后活动时间
    await _supabase.from('chat_rooms').update({
      'updated_at': DateTime.now().toIso8601String(),
    }).eq('id', roomId);
  }

  // ──── 图片上传 ────

  Future<String> uploadImage(String filePath, String fileName) async {
    final bytes = await File(filePath).readAsBytes();
    final path = 'chat_images/$_userId/${DateTime.now().millisecondsSinceEpoch}_$fileName';

    await _supabase.storage.from('chat_images').uploadBinary(path, bytes);

    return _supabase.storage.from('chat_images').getPublicUrl(path);
  }
}
```

---

## 4. Riverpod Provider 层

```dart
// lib/features/chat/providers/chat_provider.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../data/chat_repository.dart';
import '../domain/message.dart';
part 'chat_provider.g.dart';

// ──── 聊天室列表 ────

@riverpod
Future<List<ChatRoom>> chatRooms(ChatRoomsRef ref) async {
  final repo = ref.watch(chatRepositoryProvider);
  return repo.getChatRooms();
}

// ──── 联系人列表 ────

@riverpod
Future<List<ChatUser>> contacts(ContactsRef ref) async {
  final repo = ref.watch(chatRepositoryProvider);
  return repo.getContacts();
}

// ──── 单聊消息流（实时）────

@riverpod
Stream<List<Message>> chatMessages(ChatMessagesRef ref, String roomId) {
  final repo = ref.watch(chatRepositoryProvider);
  return repo.watchMessages(roomId);
}

// ──── 当前聊天室详情 ────

@riverpod
class CurrentChatRoom extends _$CurrentChatRoom {
  @override
  ChatRoom build(String otherUserId, String otherUsername) {
    return ChatRoom(
      id: '',
      otherUserId: otherUserId,
      otherUsername: otherUsername,
      updatedAt: DateTime.now(),
    );
  }

  Future<void> initialize() async {
    final repo = ref.read(chatRepositoryProvider);
    state = await repo.getOrCreateRoom(otherUserId, otherUsername);
  }
}

// ──── 发送消息 Action ────

@riverpod
class SendMessage extends _$SendMessage {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> sendText({
    required String roomId,
    required String content,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(chatRepositoryProvider);
      await repo.sendMessage(roomId: roomId, content: content);
    });
    // 刷新聊天室列表（更新最后一条消息）
    ref.invalidate(chatRoomsProvider);
  }

  Future<void> sendImage({
    required String roomId,
    required String filePath,
    required String fileName,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(chatRepositoryProvider);
      final imageUrl = await repo.uploadImage(filePath, fileName);
      await repo.sendMessage(roomId: roomId, content: '', imageUrl: imageUrl);
    });
    ref.invalidate(chatRoomsProvider);
  }
}
```

---

## 5. 界面实现

### 5.1 聊天室列表页

```dart
// lib/features/chat/presentation/chat_list_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/chat_provider.dart';
import 'widgets/chat_room_tile.dart';

class ChatListScreen extends ConsumerWidget {
  const ChatListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final roomsAsync = ref.watch(chatRoomsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('消息'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add),
            onPressed: () => context.go('/contacts'),
            tooltip: '新建聊天',
          ),
        ],
      ),
      body: roomsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text('加载失败', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => ref.invalidate(chatRoomsProvider),
                child: const Text('重试'),
              ),
            ],
          ),
        ),
        data: (rooms) {
          if (rooms.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.chat_bubble_outline, size: 64, color: theme.colorScheme.outline),
                  const SizedBox(height: 16),
                  Text('暂无聊天', style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text('点击右上角开始新聊天', style: theme.textTheme.bodyMedium),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(chatRoomsProvider),
            child: ListView.separated(
              itemCount: rooms.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
              itemBuilder: (context, index) => ChatRoomTile(room: rooms[index]),
            ),
          );
        },
      ),
    );
  }
}
```

### 5.2 聊天室列表项组件

```dart
// lib/features/chat/presentation/widgets/chat_room_tile.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../domain/message.dart';

class ChatRoomTile extends StatelessWidget {
  final ChatRoom room;

  const ChatRoomTile({super.key, required this.room});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListTile(
      leading: CircleAvatar(
        radius: 24,
        backgroundImage: room.otherAvatarUrl != null
            ? NetworkImage(room.otherAvatarUrl!)
            : null,
        child: room.otherAvatarUrl == null
            ? Text(room.otherUsername[0].toUpperCase())
            : null,
      ),
      title: Row(
        children: [
          Expanded(child: Text(room.otherUsername, overflow: TextOverflow.ellipsis)),
          Text(
            _formatTime(room.updatedAt),
            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
          ),
        ],
      ),
      subtitle: Row(
        children: [
          Expanded(
            child: Text(
              room.lastMessage ?? '暂无消息',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: room.unreadCount > 0
                    ? theme.colorScheme.onSurface
                    : theme.colorScheme.outline,
              ),
            ),
          ),
          if (room.unreadCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${room.unreadCount}',
                style: TextStyle(
                  color: theme.colorScheme.onPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
      onTap: () {
        context.go('/chat/${room.otherUserId}/${room.otherUsername}');
      },
    );
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes}分钟前';
    if (diff.inDays < 1) return '${diff.inHours}小时前';
    if (diff.inDays < 7) return '${diff.inDays}天前';
    return '${time.month}/${time.day}';
  }
}
```

### 5.3 联系人选择页

```dart
// lib/features/chat/presentation/contact_list_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/chat_provider.dart';

class ContactListScreen extends ConsumerWidget {
  const ContactListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contactsAsync = ref.watch(contactsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('选择联系人'),
      ),
      body: contactsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('加载失败: $e')),
        data: (contacts) {
          if (contacts.isEmpty) {
            return const Center(child: Text('暂无联系人'));
          }
          return ListView.separated(
            itemCount: contacts.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
            itemBuilder: (context, index) {
              final user = contacts[index];
              return ListTile(
                leading: CircleAvatar(
                  child: Text(user.username[0].toUpperCase()),
                ),
                title: Text(user.username),
                onTap: () {
                  context.go('/chat/${user.id}/${user.username}');
                },
              );
            },
          );
        },
      ),
    );
  }
}
```

### 5.4 聊天室页面 — 核心实现

```dart
// lib/features/chat/presentation/chat_screen.dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../providers/chat_provider.dart';
import 'widgets/message_bubble.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String otherUserId;
  final String otherUsername;

  const ChatScreen({
    super.key,
    required this.otherUserId,
    required this.otherUsername,
  });

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  final _focusNode = FocusNode();
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    // 初始化聊天室（创建或获取现有房间）
    Future.microtask(() {
      ref.read(currentChatRoomProvider(widget.otherUserId, widget.otherUsername).notifier).initialize();
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      });
    }
  }

  Future<void> _sendTextMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() => _isSending = true);
    _messageController.clear();

    final room = ref.read(currentChatRoomProvider(widget.otherUserId, widget.otherUsername));
    if (room.id.isEmpty) return;

    try {
      await ref.read(sendMessageProvider.notifier).sendText(
            roomId: room.id,
            content: text,
          );
      _scrollToBottom();
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _sendImageMessage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;

    final room = ref.read(currentChatRoomProvider(widget.otherUserId, widget.otherUsername));
    if (room.id.isEmpty) return;

    await ref.read(sendMessageProvider.notifier).sendImage(
          roomId: room.id,
          filePath: picked.path,
          fileName: picked.name,
        );
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final room = ref.watch(currentChatRoomProvider(widget.otherUserId, widget.otherUsername));
    final messagesAsync = room.id.isNotEmpty
        ? ref.watch(chatMessagesProvider(room.id))
        : null;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              child: Text(widget.otherUsername[0].toUpperCase()),
            ),
            const SizedBox(width: 12),
            Text(widget.otherUsername),
          ],
        ),
      ),
      body: Column(
        children: [
          // ──── 消息列表 ────
          Expanded(
            child: messagesAsync == null
                ? const Center(child: Text('正在连接...'))
                : messagesAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (e, _) => Center(child: Text('连接失败: $e')),
                    data: (messages) {
                      // 新消息滚动到底部
                      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
                      if (messages.isEmpty) {
                        return Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.chat_outlined, size: 48, color: theme.colorScheme.outline),
                              const SizedBox(height: 8),
                              Text('发送第一条消息吧', style: theme.textTheme.bodyMedium),
                            ],
                          ),
                        );
                      }
                      return ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: messages.length,
                        itemBuilder: (context, index) {
                          return MessageBubble(
                            message: messages[index],
                            isMe: messages[index].senderId ==
                                ref.read(currentUserIdProvider),
                          );
                        },
                      );
                    },
                  ),
          ),

          // ──── 输入区域 ────
          Container(
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerLow,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 4,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            padding: EdgeInsets.only(
              left: 8,
              right: 8,
              top: 8,
              bottom: MediaQuery.of(context).viewInsets.bottom + 8,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                // 图片按钮
                IconButton(
                  icon: const Icon(Icons.image_outlined),
                  onPressed: _sendImageMessage,
                  tooltip: '发送图片',
                ),

                // 文本输入
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    focusNode: _focusNode,
                    maxLines: 4,
                    minLines: 1,
                    textCapitalization: TextCapitalization.sentences,
                    textInputAction: TextInputAction.newline,
                    decoration: InputDecoration(
                      hintText: '输入消息...',
                      filled: true,
                      fillColor: theme.colorScheme.surfaceContainerHighest,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      isDense: true,
                    ),
                    onChanged: (_) => setState(() {}),
                  ),
                ),

                // 发送按钮
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: _messageController.text.trim().isNotEmpty
                      ? IconButton(
                          key: const ValueKey('send'),
                          icon: Icon(
                            Icons.send_rounded,
                            color: theme.colorScheme.primary,
                          ),
                          onPressed: _isSending ? null : _sendTextMessage,
                          tooltip: '发送',
                        )
                      : const SizedBox(width: 48),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// 获取当前用户 ID 的 Provider
@riverpod
String currentUserId(CurrentUserIdRef ref) {
  return Supabase.instance.client.auth.currentUser!.id;
}
```

### 5.5 消息气泡组件

```dart
// lib/features/chat/presentation/widgets/message_bubble.dart
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../domain/message.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final alignment = isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final color = isMe ? theme.colorScheme.primaryContainer : theme.colorScheme.surfaceContainerHighest;
    final radius = BorderRadius.only(
      topLeft: const Radius.circular(16),
      topRight: const Radius.circular(16),
      bottomLeft: isMe ? const Radius.circular(16) : Radius.zero,
      bottomRight: isMe ? Radius.zero : const Radius.circular(16),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Column(
        crossAxisAlignment: alignment,
        children: [
          // 消息内容
          ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.75,
            ),
            child: Container(
              padding: EdgeInsets.all(message.isImage ? 4 : 12),
              decoration: BoxDecoration(
                color: color,
                borderRadius: radius,
              ),
              child: message.isImage ? _buildImageContent() : _buildTextContent(theme),
            ),
          ),

          // 时间戳
          Padding(
            padding: const EdgeInsets.only(top: 2, left: 8, right: 8),
            child: Text(
              _formatTime(message.createdAt),
              style: TextStyle(
                fontSize: 11,
                color: theme.colorScheme.outline,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextContent(ThemeData theme) {
    return Text(
      message.content ?? '',
      style: theme.textTheme.bodyMedium?.copyWith(
        color: theme.colorScheme.onSurface,
      ),
    );
  }

  Widget _buildImageContent() {
    return ClipRRect(
      borderRadius: const BorderRadius.all(Radius.circular(12)),
      child: GestureDetector(
        onTap: () {
          // TODO: 打开图片查看器
        },
        child: Hero(
          tag: 'image_${message.id}',
          child: CachedNetworkImage(
            imageUrl: message.imageUrl!,
            fit: BoxFit.cover,
            placeholder: (_, __) => const SizedBox(
              width: 200,
              height: 200,
              child: Center(child: CircularProgressIndicator()),
            ),
            errorWidget: (_, __, ___) => const Icon(Icons.broken_image, size: 48),
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}
```

---

## 6. 路由配置

```dart
// lib/core/router/app_router.dart (追加聊天相关路由)
import 'package:go_router/go_router.dart';

// ... 其他路由

GoRoute(
  path: '/contacts',
  builder: (_, __) => const ContactListScreen(),
),
GoRoute(
  path: '/chat/:userId/:username',
  builder: (_, state) => ChatScreen(
    otherUserId: state.pathParameters['userId']!,
    otherUsername: state.pathParameters['username']!,
  ),
),
```

---

## 7. 推送通知集成

```dart
// lib/features/chat/presentation/notifications/chat_notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class ChatNotificationService {
  final _fcm = FirebaseMessaging.instance;
  final _localNotifications = FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    // 请求权限
    await _fcm.requestPermission();

    // 初始化本地通知
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _localNotifications.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    // 监听前台消息
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // 监听后台消息点击
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationOpen);

    // 获取 FCM Token
    final token = await _fcm.getToken();
    print('FCM Token: $token');
    // 将 token 保存到 Supabase 用户表
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      message.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'chat_messages',
          'Chat Messages',
          channelDescription: 'New chat message notifications',
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      payload: message.data['room_id'],
    );
  }

  void _onNotificationTapped(NotificationResponse response) {
    final roomId = response.payload;
    if (roomId != null) {
      // 导航到聊天室
      // router.go('/chat/$roomId');
    }
  }

  void _handleNotificationOpen(RemoteMessage message) {
    final roomId = message.data['room_id'];
    if (roomId != null) {
      // 导航到聊天室
      // router.go('/chat/$roomId');
    }
  }
}
```

---

## 8. 三个项目的学习覆盖对比

| 概念 | Library App | 聊天 App | 记账 App | 天气 App |
|------|:--:|:--:|:--:|:--:|
| CRUD | ✅ | — | ✅ | — |
| 认证 | ✅ | ✅ | — | — |
| WebSocket/实时 | — | ✅ | — | — |
| 文件上传 | ✅ | ✅ | — | — |
| 图表可视化 | — | — | ✅ | — |
| 数据导出 | — | — | ✅ | — |
| 位置服务 | — | — | — | ✅ |
| 动画 | ✅ | — | — | ✅ |
| 响应式布局 | ✅ | — | — | ✅ |
| 离线缓存 | ✅ | ✅ | — | — |
| 推送通知 | ✅ | ✅ | — | — |
| Realtime订阅 | — | ✅ | — | — |

---

## 9. 记账 App (Pennywise) & 天气 App (SkyCast)

聊天 App 已经覆盖了本章最核心的学习目标（实时通信）。另外两个项目 —— 记账 App（图表可视化 + 数据导出）和天气 App（公开 API + 位置服务 + 响应式布局）—— 作为选做项目，你可以根据兴趣自行完成。

### 记账 App 核心学习点

```dart
// 使用 Drift 写复杂统计查询
Stream<Map<String, double>> watchCategorySummary(String userId, DateTime month) {
  final startOfMonth = DateTime(month.year, month.month, 1);
  final endOfMonth = DateTime(month.year, month.month + 1, 0);

  // 按分类统计支出
  final query = select(transactions).join([
    leftOuterJoin(categories, categories.id.equalsExp(transactions.categoryId)),
  ])
    ..where(transactions.userId.equals(userId)
        & transactions.transactionDate.isBetweenValues(startOfMonth, endOfMonth)
        & transactions.type.equalsValue('expense'))
    ..groupBy([categories.name]);

  return query.watch().map((rows) {
    final map = <String, double>{};
    for (final row in rows) {
      map[row.readTable(categories).name ?? '未分类'] =
          row.readTable(transactions).amount;
    }
    return map;
  });
}
```

### 天气 App 核心学习点

```dart
// 使用 Retrofit 接入公开 REST API
@RestApi(baseUrl: 'https://api.openweathermap.org/data/2.5')
abstract class WeatherApi {
  factory WeatherApi(Dio dio) = _WeatherApi;

  @GET('/weather')
  Future<WeatherResponse> getCurrentWeather(
    @Query('lat') double lat,
    @Query('lon') double lon,
    @Query('appid') String apiKey,
    @Query('units') String units,
  );

  @GET('/forecast')
  Future<ForecastResponse> getForecast(
    @Query('lat') double lat,
    @Query('lon') double lon,
    @Query('appid') String apiKey,
    @Query('units') String units,
  );
}

// 响应式布局示例
Widget build(BuildContext context) {
  final width = MediaQuery.of(context).size.width;
  if (width > 600) {
    return Row(  // 平板：并排布局
      children: [
        Expanded(child: _buildWeatherNow()),
        Expanded(child: _buildForecast()),
      ],
    );
  }
  return SingleChildScrollView(  // 手机：垂直布局
    child: Column(
      children: [
        _buildWeatherNow(),
        _buildForecast(),
      ],
    ),
  );
}
```

---

## 本章练习

**练习 1：搭建聊天 App 基础框架**
- 初始化 Flutter 项目，配置 `pubspec.yaml`（参考本章技术栈）
- 在 Supabase 中创建本章的数据库 Schema（profiles, chat_rooms, messages）
- 实现基础目录结构和路由配置

**练习 2：实现核心聊天功能**
- 实现联系人列表 + 聊天室创建
- 实现聊天界面（消息列表 + 文本输入 + 发送）
- 集成 Supabase Realtime，实现实时消息推送
- 验证：两个设备同时打开聊天室，消息实时同步

**练习 3：完善聊天 App 周边功能**
- 实现图片消息发送（Image Picker + Supabase Storage）
- 添加本地缓存（Drift 离线消息）
- 实现推送通知（FCM + 本地通知）
- 验证：杀后台进程后收到通知，点击通知跳转到对应聊天室

**练习 4（选做）：完成记账 App 或天气 App**
- 根据本章的概要设计，独立完成其中一个项目
- 核心要求：覆盖对应的学习点（图表/导出 或 位置/响应式布局）
- 与 Library App 和聊天 App 一起，完成你的全栈 Flutter 项目四件套

---

> **下一步**: [Chapter 69 — 结语](./Chapter-69-结语.md)
