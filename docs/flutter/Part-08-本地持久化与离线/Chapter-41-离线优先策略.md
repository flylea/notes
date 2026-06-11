> **Part**: Part VIII — 本地持久化与离线
> **上一章**: [Chapter 40 — Drift 本地数据库](./Chapter-40-Drift本地数据库.md)
> **下一章**: [Part IX — 高级 UI 与体验](../Part-09-高级UI与体验/)
> **官方文档**: [flutter.cn/data-and-backend/persistence](https://docs.flutter.cn/data-and-backend/persistence)

---

# 第 41 章：离线优先策略与数据同步

## 0. 本章目标与前置依赖

**前置依赖**：Drift 本地数据库（Ch 34）、Supabase Realtime（Ch 22）、Riverpod StreamProvider（Ch 16）。

**本章目标**：离线优先架构原理、乐观更新 + 同步队列、connectivity_plus 网络监听、离线 UI Banner、冲突解决策略、Supabase Realtime 断线重连。

> 🎯 **Library App 产出**：离线浏览已缓存图书、离线借阅操作暂存队列、网络恢复后自动同步、离线提示 Banner、同步状态指示器。

---

## 1. 离线优先架构

```
┌──────────────────────────────────────┐
│  UI 层                                │
│  所有操作都走本地数据库（本地是真理源）  │
├──────────────────────────────────────┤
│  本地数据库（Drift）                   │
│  ① 写操作：先写本地                  │
│  ② 读操作：从本地读                  │
│  ③ 同步队列：离线操作暂存             │
├──────────────────────────────────────┤
│  同步引擎                             │
│  网络恢复 → 队列中的操作逐条发送       │
│  → 成功后清除 → 失败跳过等待下次       │
├──────────────────────────────────────┤
│  远程服务（Supabase）                  │
│  最终一致性，非实时                    │
└──────────────────────────────────────┘
```

> **TS 经验**：离线优先 ≈ PWA Service Worker + IndexedDB 缓存策略。先写本地，后台同步到服务器。

---

## 2. 网络状态监听

```dart
// lib/core/sync/connectivity_service.dart
import 'package:connectivity_plus/connectivity_plus.dart';

@riverpod
Stream<bool> isOnline(IsOnlineRef ref) {
  return Connectivity().onConnectivityChanged.map(
    (results) => !results.contains(ConnectivityResult.none),
  );
}

// UI 中使用
final online = ref.watch(isOnlineProvider);
if (online.valueOrNull == false) OfflineBanner();
```

## 3. 同步队列实现

```dart
// lib/core/sync/sync_service.dart
class SyncService {
  final AppDatabase _db;
  final SupabaseClient _supabase;
  bool _isSyncing = false;

  SyncService(this._db, this._supabase);

  /// 离线时暂存操作
  Future<void> enqueue(String operation, Map<String, dynamic> payload) async {
    await _db.syncQueueDao.enqueue(operation, jsonEncode(payload));
  }

  /// 网络恢复后批量同步
  Future<SyncResult> flush() async {
    if (_isSyncing) return SyncResult.inProgress;
    _isSyncing = true;

    try {
      final pending = await _db.syncQueueDao.getPending();
      int successCount = 0;

      for (final item in pending) {
        try {
          await _executeOperation(item.operation, jsonDecode(item.payload));
          await _db.syncQueueDao.remove(item.id);
          successCount++;
        } catch (e) {
          break;  // 某条失败→停止，保留后续项等待下次同步
        }
      }

      return SyncResult(succeeded: successCount, remaining: pending.length - successCount);
    } finally {
      _isSyncing = false;
    }
  }

  Future<void> _executeOperation(String op, Map<String, dynamic> payload) async {
    switch (op) {
      case 'borrow': await _supabase.rpc('borrow_book', params: payload);
      case 'return': await _supabase.rpc('return_book', params: payload);
      case 'delete': await _supabase.from('books').delete().eq('id', payload['id']);
    }
  }
}

class SyncResult {
  final int succeeded;
  final int remaining;
  bool get isComplete => remaining == 0;
  const SyncResult({this.succeeded = 0, this.remaining = 0});
  static const inProgress = SyncResult();
}
```

## 4. 离线优先 Repository

```dart
class OfflineFirstBookRepository implements BookRepository {
  final BookRemoteDataSource remote;
  final BookDao local;
  final SyncService syncService;
  final bool Function() isOnline;

  @override
  Future<List<Book>> getBooks({...}) async {
    if (isOnline()) {
      try {
        final books = await remote.getBooks(...);
        await local.cacheBooks(books.map(_toCompanion).toList());
        return books;
      } catch (_) { /* 网络失败→读本地 */ }
    }
    final cached = await local.getAll();
    return cached.map(_fromRow).toList();
  }

  @override
  Future<void> deleteBook(String id) async {
    await local.deleteById(id);  // 先更新 UI
    if (isOnline()) {
      await remote.deleteBook(id);
    } else {
      await syncService.enqueue('delete', {'id': id});  // 暂存
    }
  }
}
```

## 5. 自动同步 + 离线 Banner

```dart
// lib/core/sync/auto_sync.dart
@riverpod
class AutoSync extends _$AutoSync {
  @override  void build() {
    ref.listen(isOnlineProvider, (prev, next) {
      if (next.valueOrNull == true && prev?.valueOrNull == false) {
        // 网络从离线→在线 → 触发同步
        ref.read(syncServiceProvider).flush();
      }
    });
  }
}

// 离线提示组件
class OfflineBanner extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider);
    if (online.valueOrNull != false) return const SizedBox.shrink();
    return MaterialBanner(
      content: const Text('当前处于离线模式，操作将在网络恢复后自动同步'),
      leading: const Icon(Icons.cloud_off), backgroundColor: Colors.orange[100],
      actions: [TextButton(onPressed: () => ref.invalidate(isOnlineProvider), child: const Text('重试'))],
    );
  }
}
```

## 6. 冲突解决

| 策略 | 说明 | 适用 |
|------|------|------|
| **Last Write Wins** | 时间戳最晚的覆盖 | 图书馆场景——最后操作生效即可 |
| **Merge** | 合并字段级变更 | 协作编辑 |
| **CRDT** | 无冲突数据结构 | 实时协作 |

图书馆 App 采用 Last Write Wins——每次写操作带 `updated_at` 时间戳，同步时逐条比对。

---

## 7. 常见错误

```dart
// ❌ 离线时不提示用户→用户以为功能坏了
// ✅ 离线时显示 Banner + 禁用需要网络的操作

// ❌ 同步时不做幂等处理→重复执行导致数据错误
// ✅ supabase.rpc('borrow_book') 内部检查幂等（已借过的书不重复借）

// ❌ 同步队列无限增长→占满磁盘
// ✅ 设置最大队列长度（如 200 条） + 超过后提示用户联网
```

---

## 8. 本章小结

| 概念 | 实现 |
|------|------|
| 离线优先 | 先写本地 Drift → 后台同步 Supabase |
| 网络监听 | connectivity_plus → Riverpod StreamProvider |
| 同步队列 | SyncQueue 表 + flush() 逐条执行 |
| 离线 Banner | MaterialBanner + isOnlineProvider |
| 冲突解决 | Last Write Wins（updated_at 时间戳） |
| 自动同步 | Riverpod listen → 离线→在线触发 flush() |

---

## 9. 本章练习

1. **实现离线评分功能**：在图书详情页添加星级评分组件（1-5 星），离线时评分先写入本地 Drift `ReviewCache` 表，并通过 `SyncService.enqueue('review', payload)` 加入同步队列。同时更新 UI 为"评分已保存（待同步）"状态。联网后 `SyncService.flush()` 自动将暂存的评分同步到 Supabase。验证标准：断网后评分能提交并显示待同步状态；联网后评分出现在 Supabase 数据库中；同步完成后待同步标记消失。

2. **添加 AppBar 同步状态指示器**：在 AppBar 右侧添加一个圆形状态指示器（使用 `Badge` 或自定义 `Container`），通过 `ref.watch(isOnlineProvider)` 和 `ref.watch(syncServiceProvider)` 驱动三种状态：绿色圆点 = 在线已同步、黄色旋转 = 在线同步中、红色圆点 = 离线。验证标准：断网时显示红色圆点；联网且队列非空时显示黄色旋转；联网且队列清空后显示绿色圆点。

3. **实现冲突解决 Dialog**：扩展 `SyncService._executeOperation` 方法，当 Supabase 返回特定错误码（如 `'23505'` 唯一约束冲突、借阅时库存不足）时，将冲突条目标记为 `conflict` 状态而非直接丢弃。在 UI 层通过 `StreamProvider` 监听 `SyncQueueDao.watchConflicts()`，有冲突时弹出 `AlertDialog` 列出冲突详情，让用户选择"放弃本地操作"（删除队列项）或"重试"（重新执行）。验证标准：模拟冲突场景后弹出 Dialog；点击"放弃"后队列项被移除；点击"重试"后重新尝试同步。

验证标准：以上 3 个练习通过断网/联网切换手动测试，控制台无未处理的异常。

---

> **下一步**: [Part IX — 高级 UI 与体验](../Part-09-高级UI与体验/)
