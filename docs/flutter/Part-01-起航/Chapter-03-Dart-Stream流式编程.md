> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 02 — Dart 核心语法速通（上）](./Chapter-02-Dart核心语法速通-上.md)
> **下一章**: [Chapter 04 — Dart 核心语法速通（下）](./Chapter-04-Dart核心语法速通-下.md)
> **官方文档**: [dart.cn/language/async](https://dart.cn/language/async) | [dart.cn/libraries/async](https://dart.cn/libraries/async)

---

# 第 3 章：Dart Stream — 异步流式编程

## 0. 本章目标

- 理解 Stream 概念：一个可随时间推移发出多个值的异步数据序列
- 掌握 Stream 的创建（`async*` + `yield`）和消费（`listen` / `await for`）
- 熟练使用 `StreamBuilder` Widget 将 Stream 连接到 UI
- 了解 Stream 的内存管理要点

> 本章需要你已经掌握 Chapter 02 中的 Future 和 async/await。

---

## 1. Future vs Stream

```dart
// Future<T> — 单个异步结果（一次性的）
Future<String> fetchUserName() async => 'Alice';

// Stream<T> — 多个异步结果（随时间持续发出）
Stream<int> countDown(int from) async* {
  for (int i = from; i > 0; i--) {
    await Future.delayed(const Duration(seconds: 1));
    yield i;                              // 逐个产出值
  }
}
```

> **`async*` 和 `yield` 是什么？** `async*` 声明这是一个异步生成器函数——它随着时间推移，一个接一个地"吐出"多个值，而不是一次性返回。`yield` 的意思是"暂停一下，把这个值发出去，然后继续执行循环的下一次迭代"。可以想象成生产线上的传送带——每 `yield` 一次，传送带上就多一个产品，消费端可以一个个取走。

| 特性 | Future | Stream |
|------|--------|--------|
| 返回值个数 | 1 个 | 0 到 N 个 |
| 取消 | 无法取消 | `subscription.cancel()` |
| UI 集成 | `FutureBuilder` | `StreamBuilder` |

---

## 2. Stream 创建

```dart
// ① async* + yield — 最常用的创建方式
Stream<int> count(int max) async* {
  for (int i = 1; i <= max; i++) {
    await Future.delayed(const Duration(seconds: 1));
    yield i;
  }
}

// ② Stream 构造函数
Stream<int> periodic = Stream.periodic(const Duration(seconds: 1), (i) => i).take(5);
Stream<int> fromList = Stream.fromIterable([1, 2, 3, 4, 5]);
```

---

## 3. Stream 消费

```dart
// ① listen() — 手动订阅
final subscription = count(5).listen(
  (data) => print('收到: $data'),
  onError: (error) => print('错误: $error'),
  onDone: () => print('流结束'),
);

// 取消订阅——非常重要，防止内存泄漏
await subscription.cancel();

// ② await for — 在 async 函数中消费 Stream
Future<void> consume(Stream<int> stream) async {
  await for (final value in stream) {
    print(value);
  }
}
```

---

## 4. Stream 常用操作

| 操作 | 说明 |
|------|------|
| `stream.where((v) => v > 3)` | 过滤 |
| `stream.map((v) => v * 10)` | 转换 |
| `stream.take(3)` | 取前 N 个 |
| `stream.skip(2)` | 跳过前 N 个 |
| `stream.handleError((e) {})` | 错误处理 |
| `stream.timeout(Duration(...))` | 超时处理 |
| `stream.distinct()` | 去重 |

> 更多操作符见 [dart:async 文档](https://dart.cn/libraries/async)。

---

## 5. StreamBuilder — UI 响应流

`StreamBuilder` 是 Flutter 中最常用的 Stream ↔ UI 桥梁：

> ⚠️ **初学者注意**：`StreamBuilder` 是 Flutter Widget，完整讲解在 Part-02。这里你只需理解：它接收一个 Stream 作为输入，每当 Stream 发出新数据时自动重建 UI。下面的代码现在不需要逐行理解，重点关注 `stream:` 和 `builder:` 两个参数即可。

```dart
StreamBuilder<List<Book>>(
  stream: bookRepository.watchAllBooks(),    // Stream 数据源
  builder: (context, snapshot) {
    // snapshot.connectionState: none / waiting / active / done
    if (snapshot.connectionState == ConnectionState.waiting) {
      return const CircularProgressIndicator();
    }
    if (snapshot.hasError) {
      return Text('错误: ${snapshot.error}');
    }
    if (!snapshot.hasData || snapshot.data!.isEmpty) {
      return const Text('暂无图书');
    }
    final books = snapshot.data!;
    return ListView.builder(
      itemCount: books.length,
      itemBuilder: (_, i) => ListTile(title: Text(books[i].title)),
    );
  },
);
```

配合 Riverpod 的 `StreamProvider` 可以更简洁（将在 Part-04 详解）：

```dart
// final booksProvider = StreamProvider<List<Book>>((ref) => db.watchAllBooks());
```

---

## 6. Stream 在图书馆 App 中的应用

> 📋 **预览**：下面是 Stream 在真实 Flutter 项目中的常见应用场景。表中的 Supabase、Drift、Firebase 等外部服务在后续章节中会逐一安装和讲解，现在只需了解 Stream 可以应用在哪些领域即可。

| 场景 | Stream 来源 | 使用方式 |
|------|-----------|---------|
| Supabase Realtime | `supabase.from('books').stream()` | `StreamBuilder` / `StreamProvider` |
| Drift 响应式查询 | `db.bookDao.watchAll()` | `StreamProvider` 自动订阅/取消 |
| Auth 状态变化 | `supabase.auth.onAuthStateChange` | `StreamProvider<AuthState>` |
| 网络状态监听 | `Connectivity().onConnectivityChanged` | 实时网络状态同步 |
| 搜索框防抖 | `TextField` → `StreamController` → `debounceTime` | 防抖搜索 |
| 通知推送 | `FirebaseMessaging.onMessageOpenedApp` | 推送通知处理 |

---

## 7. 内存管理

**Stream 订阅必须在不需要时取消，否则导致内存泄漏：**

```dart
// ❌ 忘记取消——内存泄漏
class _BadWidgetState extends State<BadWidget> {
  @override
  void initState() {
    someStream.listen((_) {});              // 永远不会取消
  }
}

// ✅ 在 dispose 中取消
class _GoodWidgetState extends State<GoodWidget> {
  StreamSubscription? _sub;

  @override
  void initState() {
    _sub = someStream.listen((_) {});
  }

  @override
  void dispose() {
    _sub?.cancel();                         // 必须取消
    super.dispose();
  }
}

// ✅ 更优雅：用 StreamProvider — 自动管理生命周期
// Riverpod 的 StreamProvider 会在 Provider 销毁时自动取消订阅
```

---
> 📖 **延伸阅读**：[dart.cn/language/async](https://dart.cn/language/async) | [dart.cn/libraries/async](https://dart.cn/libraries/async)

## 7. 本章练习

1. 用 `async*` 和 `yield` 生成一个斐波那契数列 Stream（前 20 项），用 `listen` 消费并打印
2. 用 `StreamController.broadcast()` 实现一个简单的事件总线，两个 `listener` 同时监听同一事件流，验证广播特性
3. 用 `stream.transform(debounce(...))` 实现搜索防抖——输入"Flutter"时，只在最后一次输入 300ms 后才打印

验证标准：每个练习的控制台输出符合预期，无未处理的 Stream 泄漏。

> **下一步**: [Chapter 04 — Dart 核心语法速通（下）](./Chapter-04-Dart核心语法速通-下.md)
