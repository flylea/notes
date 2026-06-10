> **Part**: Part I — 起航：环境与 Dart 语言
> **上一章**: [Chapter 02 — Dart 核心语法速通（上）](./Chapter-02-Dart核心语法速通-上.md)
> **下一章**: [Chapter 03 — Dart 核心语法速通（下）](./Chapter-03-Dart核心语法速通-下.md)
> **官方文档**: [dart.cn/libraries/async](https://dart.cn/libraries/async) | [dart.cn/language/async](https://dart.cn/language/async)

---

# 第 2b 章：Dart Stream — 异步流式编程

## 0. 本章目标与前置依赖

**前置依赖**：已完成 Chapter 2 的 Future 和 async/await 学习。

**本章目标**：Stream 核心概念（单订阅 vs 广播）、StreamController/StreamSubscription、Stream 转换操作符（map/where/transform/asyncMap 等 15+）、StreamBuilder Widget、与 RxJS Observable 的类比。

---

## 1. Future vs Stream

```dart
// Future<T> — 单个异步结果（一次性的）
Future<String> fetchUserName() async => 'Alice';

// Stream<T> — 多个异步结果（随时间推移持续发出）
Stream<int> ticker() async* {
  for (int i = 0; i < 10; i++) {
    await Future.delayed(const Duration(seconds: 1));
    yield i;
  }
}
```

| 特性 | Future | Stream |
|------|--------|--------|
| 返回值数量 | 1 个 | 0~N 个 |
| 类比 | Promise | Observable (RxJS) / AsyncIterator |
| 监听 | `.then()` / `await` | `.listen()` / `await for` |
| 取消 | 无法取消 | `subscription.cancel()` |
| 错误处理 | `.catchError()` / `try-catch` | `.handleError()` / `onError` 回调 |

---

## 2. Stream 创建

```dart
// ① async* + yield — 最常用的创建方式
Stream<int> countStream(int max) async* {
  for (int i = 1; i <= max; i++) {
    await Future.delayed(const Duration(seconds: 1));
    yield i;
  }
}

// ② StreamController — 手动控制
final controller = StreamController<String>();
controller.add('Hello');           // 发射数据
controller.addError(Exception());  // 发射错误
controller.close();                // 关闭流

// ③ Stream.fromFuture / fromIterable / periodic
Stream<int> periodicStream = Stream.periodic(const Duration(seconds: 1), (i) => i).take(5);
// 0, 1, 2, 3, 4 — 每秒一个

// ④ 广播流（Broadcast Stream）— 多个监听者
final broadcastController = StreamController<String>.broadcast();
```

> **TS 经验**：`async* + yield` ≈ `async function*` (AsyncGenerator)。`StreamController` ≈ `new Subject()` (RxJS)。`Broadcast Stream` ≈ `Subject` / `multicast` Observable。

---

## 3. Stream 监听

```dart
// ① listen() — 手动订阅
final subscription = countStream(5).listen(
  (data) => print('收到: $data'),
  onError: (error) => print('错误: $error'),
  onDone: () => print('流结束'),
  cancelOnError: false,  // 出错后是否取消订阅
);

// 暂停/恢复/取消
subscription.pause();
subscription.resume();
await subscription.cancel();  // 必须取消——防止内存泄漏

// ② await for — 在 async 函数中消费 Stream
Future<void> consume(Stream<int> stream) async {
  await for (final value in stream) {
    print(value);
  }
}

// ③ forEach — 简洁消费
await stream.forEach((value) => print(value));
```

---

## 4. Stream 转换操作符（15 种）

```dart
final source = Stream.fromIterable([1, 2, 3, 4, 5, 6]);

// ──── 过滤 ────
source.where((n) => n.isEven);          // 2, 4, 6
source.distinct();                       // 去重
source.skip(2);                          // 跳过前 2 个 → 3, 4, 5, 6
source.take(3);                          // 取前 3 个 → 1, 2, 3
source.skipWhile((n) => n < 3);          // 跳过 <3 的 → 3, 4, 5, 6

// ──── 转换 ────
source.map((n) => n * 10);              // 10, 20, 30, 40, 50, 60
source.expand((n) => [n, n * 10]);       // 展开为多个值
source.asyncMap((n) => Future.delayed(Duration(ms: n * 100), () => n));  // 异步映射
source.transform(utf8.decoder);          // 使用 Converter

// ──── 聚合 ────
source.fold(0, (prev, n) => prev + n);  // → Future<int>(21)
source.join(', ');                        // → Future<String>('1, 2, 3, 4, 5, 6')
await source.toList();                    // → Future<List<int>>
await source.first;                       // → Future<int>(1)
await source.last;                        // → Future<int>(6)

// ──── 时间控制 ────
source.debounceTime(const Duration(milliseconds: 300));  // 防抖
source.throttleTime(const Duration(milliseconds: 500));  // 节流

// ──── 错误处理 ────
source.handleError((error) { ... });      // 捕获错误继续
source.timeout(const Duration(seconds: 5), onTimeout: (sink) => sink.add(-1));  // 超时
```

> **TS 经验**：Dart Stream 操作符 ≈ RxJS operators (`pipe(map(...), filter(...), debounceTime(...))`)。

---

## 5. StreamBuilder Widget — UI 响应流

```dart
// Flutter 中最常用的 Stream ↔ UI 桥梁
StreamBuilder<List<Book>>(
  stream: bookRepository.watchAllBooks(),  // Drift .watch() Stream
  builder: (context, snapshot) {
    // snapshot.connectionState: none / waiting / active / done
    if (snapshot.connectionState == ConnectionState.waiting) {
      return const CircularProgressIndicator();
    }
    if (snapshot.hasError) {
      return Text('Error: ${snapshot.error}');
    }
    if (!snapshot.hasData || snapshot.data!.isEmpty) {
      return const Text('暂无图书');
    }
    return ListView.builder(
      itemCount: snapshot.data!.length,
      itemBuilder: (_, i) => BookCard(book: snapshot.data![i]),
    );
  },
);

// 配合 Riverpod StreamProvider 更简洁：
// ref.watch(cachedBooksProvider).when(
//   loading: () => CircularProgressIndicator(),
//   data: (books) => BookListView(books: books),
// );
```

---

## 6. Stream 在 Library App 中的应用

| 场景 | Stream 来源 | 使用方式 |
|------|-----------|---------|
| Supabase Realtime | `supabase.from('books').stream()` | `StreamBuilder` / `StreamProvider` |
| Drift 响应式查询 | `db.bookDao.watchAll()` | `StreamProvider` 自动订阅取消 |
| Auth 状态变化 | `supabase.auth.onAuthStateChange` | `StreamProvider<AuthState>` |
| 网络状态变化 | `Connectivity().onConnectivityChanged` | `StreamProvider<bool>` |
| 搜索框防抖 | TextField onChanged → StreamController → debounce | Chapter 32 防抖搜索 |
| 通知点击 | `FirebaseMessaging.onMessageOpenedApp` | Chapter 43 推送通知 |

---

## 7. Stream 内存管理

```dart
// ❌ 忘记取消订阅 → 内存泄漏
class _BadWidgetState extends State<BadWidget> {
  @override void initState() {
    someStream.listen((_) {});  // ❌ 永远不会取消
  }
}

// ✅ 正确：在 dispose 中取消
class _GoodWidgetState extends State<GoodWidget> {
  StreamSubscription? _sub;
  @override void initState() {
    _sub = someStream.listen((_) {});
  }
  @override void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

// ✅ 更优雅：用 StreamProvider — 自动管理生命周期
final booksProvider = StreamProvider<List<Book>>((ref) => db.watchAllBooks());
```

---

## 8. 与 RxJS 完整对照

| 概念 | Dart Stream | RxJS |
|------|-----------|------|
| 数据源 | `Stream<T>` | `Observable<T>` |
| 订阅 | `.listen()` | `.subscribe()` |
| 取消 | `subscription.cancel()` | `subscription.unsubscribe()` |
| 映射 | `.map(fn)` | `.pipe(map(fn))` |
| 过滤 | `.where(pred)` | `.pipe(filter(pred))` |
| 防抖 | `.debounceTime(d)` | `.pipe(debounceTime(d))` |
| 广播 | `StreamController.broadcast()` | `Subject` / `multicast` |
| UI 集成 | `StreamBuilder` | `async` pipe in Angular |

---

> **下一步**: [Chapter 03 — Dart 核心语法速通（下）](./Chapter-03-Dart核心语法速通-下.md)
> **原始文档**: [dart.cn/libraries/async](https://dart.cn/libraries/async)
