> **Part**: Part VIII — 本地持久化与离线
> **上一章**: [Chapter 33](./Chapter-33-SharedPreferences用户偏好.md) | **下一章**: [Chapter 35](./Chapter-35-离线优先策略.md)
> **官方文档**: [pub.dev/packages/drift](https://pub.dev/packages/drift) | [drift.simonbinder.eu](https://drift.simonbinder.eu)

---

# 第 34 章：Drift — 本地关系型数据库

## 0. 本章目标与前置依赖

**前置依赖**：SQL 基础（SELECT/INSERT/UPDATE/DELETE）、Riverpod StreamProvider（Chapter 16）、build_runner（Chapter 19-20）。

**本章目标**：Flutter 数据库选型（Isar 已停维→Drift 是首选）、Table→DAO→Database 三层架构、CRUD + 响应式 .watch() Stream、数据库迁移、与 Room(Android)/Prisma(Node) 类比。

> 🎯 **Library App 产出**：图书缓存表+借阅记录表+同步队列表的完整 Schema/DAO/Database、离线图书缓存、借阅记录本地读写、搜索历史持久化、数据库迁移。

---

## 1. Flutter 本地数据库选型（2026）

| 方案 | 状态 | 推荐度 | 说明 |
|------|------|--------|------|
| **Drift** | 🟢 活跃 | ⭐⭐⭐ | SQLite ORM，编译时类型安全 SQL，响应式 `.watch()` Stream |
| **Hive CE** | 🟢 社区 | ⭐⭐ | NoSQL kv，简单缓存/偏好用 |
| **ObjectBox** | 🟢 活跃 | ⭐⭐ | NoSQL 文档，高性能+同步 |
| **Isar / Hive(原版) / Realm** | 🔴 已停维 | ❌ | 禁止新项目使用 |

> **TS 经验**：Drift ≈ Prisma（ORM）+ React Query 响应式更新。定义 Schema → 生成代码 → `.watch()` 返回 Stream 自动触发 UI 重建。

---

## 2. 安装

```yaml
dependencies:
  drift: ^2.21.0
  sqlite3_flutter_libs: ^0.5.0
  path_provider: ^2.1.0
  path: ^1.9.0
dev_dependencies:
  drift_dev: ^2.21.0
  build_runner: ^2.4.0
```

---

## 3. Table 定义

```dart
// lib/core/database/tables.dart
import 'package:drift/drift.dart';

class BookCache extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get author => text()();
  TextColumn get isbn => text()();
  TextColumn get category => text()();
  IntColumn get publishYear => integer()();
  RealColumn get rating => real().withDefault(const Constant(0.0))();
  IntColumn get totalCopies => integer().withDefault(const Constant(1))();
  IntColumn get availableCopies => integer().withDefault(const Constant(1))();
  TextColumn get coverUrl => text().nullable()();
  TextColumn get description => text().nullable()();
  TextColumn get tags => text().withDefault(const Constant(''))();
  DateTimeColumn get cachedAt => dateTime().withDefault(currentDateAndTime)();

  @override Set<Column> get primaryKey => {id};
  @override List<TableIndex> get indexes => [TableIndex(value: [category]), TableIndex(value: [title])];
}

class BorrowCache extends Table {
  TextColumn get id => text()();
  TextColumn get bookId => text()();
  TextColumn get userId => text()();
  DateTimeColumn get borrowDate => dateTime()();
  DateTimeColumn get dueDate => dateTime()();
  DateTimeColumn get returnDate => dateTime().nullable()();
  TextColumn get status => text().withDefault(const Constant('active'))();
  IntColumn get renewCount => integer().withDefault(const Constant(0))();
  @override Set<Column> get primaryKey => {id};
}

class SyncQueue extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get operation => text()();
  TextColumn get payload => text()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  @override Set<Column> get primaryKey => {id};
}
```

---

## 4. DAO — 数据访问对象

```dart
// lib/core/database/daos.dart
import 'package:drift/drift.dart';
import 'app_database.dart';

@DriftAccessor(tables: [BookCache])
class BookDao extends DatabaseAccessor<AppDatabase> with _$BookDaoMixin {
  BookDao(super.db);

  // 批量写入（存在则更新）
  Future<void> cacheBooks(List<BookCacheCompanion> books) =>
      batch((b) => b.insertAllOnConflictUpdate(db.bookCache, books));

  // 单条查询
  Future<BookCacheData?> getBook(String id) =>
      (select(db.bookCache)..where((t) => t.id.equals(id))).getSingleOrNull();

  // 条件查询
  Future<List<BookCacheData>> getByCategory(String category) =>
      (select(db.bookCache)..where((t) => t.category.equals(category))
        ..orderBy([(t) => OrderingTerm.desc(t.cachedAt)])).get();

  // 模糊搜索
  Future<List<BookCacheData>> search(String query) {
    final p = '%$query%';
    return (select(db.bookCache)..where((t) => t.title.like(p) | t.author.like(p))).get();
  }

  // 🌊 响应式查询——数据变化时 Stream 自动推送，UI 自动更新
  Stream<List<BookCacheData>> watchAll() =>
      (select(db.bookCache)..orderBy([(t) => OrderingTerm.desc(t.cachedAt)])).watch();

  Stream<List<BookCacheData>> watchByCategory(String category) =>
      (select(db.bookCache)..where((t) => t.category.equals(category))).watch();

  // 清理
  Future<int> clearAll() => delete(db.bookCache).go();
  Future<void> deleteById(String id) =>
      (delete(db.bookCache)..where((t) => t.id.equals(id))).go();
}
```

```dart
@DriftAccessor(tables: [BorrowCache])
class BorrowDao extends DatabaseAccessor<AppDatabase> with _$BorrowDaoMixin {
  BorrowDao(super.db);

  Future<void> cacheBorrows(List<BorrowCacheCompanion> records) =>
      batch((b) => b.insertAllOnConflictUpdate(db.borrowCache, records));

  Stream<List<BorrowCacheData>> watchActiveBorrows(String userId) =>
      (select(db.borrowCache)
        ..where((t) => t.userId.equals(userId) & t.status.equals('active'))
        ..orderBy([(t) => OrderingTerm.desc(t.borrowDate)]))
      .watch();

  Future<void> updateStatus(String id, String status) async {
    await (update(db.borrowCache)..where((t) => t.id.equals(id)))
        .write(BorrowCacheCompanion(status: Value(status), returnDate: Value(DateTime.now())));
  }
}
```

```dart
@DriftAccessor(tables: [SyncQueue])
class SyncQueueDao extends DatabaseAccessor<AppDatabase> with _$SyncQueueDaoMixin {
  SyncQueueDao(super.db);

  Future<int> enqueue(String operation, String payload) =>
      into(db.syncQueue).insert(SyncQueueCompanion(operation: Value(operation), payload: Value(payload)));

  Future<List<SyncQueueData>> getPending() =>
      (select(db.syncQueue)..orderBy([(t) => OrderingTerm.asc(t.createdAt)])).get();

  Future<int> remove(int id) => (delete(db.syncQueue)..where((t) => t.id.equals(id))).go();
  Future<int> clearProcessed() => delete(db.syncQueue).go();
}
```

---

## 5. AppDatabase 组装 + 迁移

```dart
// lib/core/database/app_database.dart
import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'tables.dart';
import 'daos.dart';
part 'app_database.g.dart';

@DriftDatabase(tables: [BookCache, BorrowCache, SyncQueue], daos: [BookDao, BorrowDao, SyncQueueDao])
class AppDatabase extends _$AppDatabase {
  AppDatabase._(QueryExecutor e) : super(e);

  static Future<AppDatabase> create() async {
    final dbPath = p.join((await getApplicationDocumentsDirectory()).path, 'library_app.db');
    return AppDatabase._(databaseConnectionFactory.openDatabase(dbPath));
  }

  static AppDatabase memory() => AppDatabase._(NativeDatabase.memory());  // 测试用

  @override int get schemaVersion => 2;

  @override MigrationStrategy get migration => MigrationStrategy(
    beforeOpen: (details) async {
      await customStatement('PRAGMA journal_mode=WAL');
      await customStatement('PRAGMA foreign_keys=ON');
    },
    onUpgrade: (migrator, from, to) async {
      if (from < 2) {
        await migrator.addColumn(db.bookCache, db.bookCache.publisher);
      }
    },
  );
}
```

---

## 6. Riverpod 集成

```dart
// lib/core/di/database_providers.dart
@Riverpod(keepAlive: true)
Future<AppDatabase> appDatabase(AppDatabaseRef ref) => AppDatabase.create();

@riverpod
Stream<List<BookCacheData>> cachedBooks(CachedBooksRef ref) {
  final db = ref.watch(appDatabaseProvider).valueOrNull;
  if (db == null) return const Stream.empty();
  return db.bookDao.watchAll();
}

@riverpod
Stream<List<BorrowCacheData>> activeBorrows(ActiveBorrowsRef ref, String userId) {
  final db = ref.watch(appDatabaseProvider).valueOrNull;
  if (db == null) return const Stream.empty();
  return db.borrowDao.watchActiveBorrows(userId);
}
```

---

## 7. 数据库迁移实战

```dart
// 场景：v1 → v2 添加字段，v2 → v3 新建表
@override MigrationStrategy get migration => MigrationStrategy(
  onUpgrade: (migrator, from, to) async {
    if (from < 2) await migrator.addColumn(db.bookCache, db.bookCache.publisher);
    if (from < 3) await migrator.createTable(db.reviews);
    if (from < 4) {
      // 复杂迁移：数据转换
      await migrator.addColumn(db.borrowCache, db.borrowCache.fine);
      // 填充默认值
      await customStatement("UPDATE borrow_cache SET fine = 0 WHERE fine IS NULL");
    }
  },
);
```

---

## 8. Drift Isolate — 后台线程

```dart
// 当数据库操作量大（如批量导入 10000+ 条）时，在主线程执行会导致 UI 卡顿
// Drift Isolate 将数据库操作移到独立 Isolate

import 'package:drift/isolate.dart';

static Future<AppDatabase> createWithIsolate() async {
  final isolate = await DriftIsolate.spawn(() {
    return databaseConnectionFactory.openDatabase('library_app.db');
  });
  return AppDatabase._(isolate.connect());
}
// 优点：UI 线程和数据库 I/O 完全隔离
// 代价：每次查询都有 Isolate 通信开销（不适合单条频繁小查询）
```

---

## 9. 常见错误与最佳实践

```dart
// ❌ 错误 1：忘记运行 build_runner
// dart run build_runner build  (一次性生成)
// dart run build_runner watch  (监听文件变化自动生成)

// ❌ 错误 2：.watch() 在 build() 中直接创建 Stream——每次 rebuild 创建新订阅
// ✅ 用 StreamProvider 或 initState 中创建

// ❌ 错误 3：不设 schemaVersion——无法追踪数据库版本
// ✅ 从第一天就设置 schemaVersion: 1

// ❌ 错误 4：INSERT 数据时主键冲突导致崩溃
// ✅ 使用 insertOnConflictUpdate 或 insertOrReplace

// ❌ 错误 5：生产环境不启用 WAL 模式
// ✅ beforeOpen 中执行 PRAGMA journal_mode=WAL
```

| 最佳实践 | 说明 |
|---------|------|
| schemaVersion 从 1 开始 | 每次表结构变更 +1 |
| insertOnConflictUpdate | 缓存场景最常用——有则更新，无则插入 |
| .watch() 配合 StreamProvider | 自动管理 Stream 生命周期 |
| WAL 模式 + 外键约束 | beforeOpen 中配置 |
| 测试用内存数据库 | `NativeDatabase.memory()`，不落盘 |

---

## 10. 本章小结

| 你学到了什么 | 对标 | 在图书馆 App 中的体现 |
|-------------|------|---------------------|
| Drift 三层架构 | Prisma Schema + Service | Table→DAO→Database |
| BookCache/BorrowCache/SyncQueue 三表 | — | 离线缓存+借阅记录+同步队列 |
| insertOnConflictUpdate | UPSERT | 缓存数据幂等写入 |
| .watch() 响应式查询 | React Query subscription | Stream → UI 自动更新 |
| schemaVersion + onUpgrade | Prisma migration | 数据库版本迁移 |
| WAL 模式 | SQLite PRAGMA | 并发读写性能提升 |

---

> **下一步**: [Chapter 35 — 离线优先策略](./Chapter-35-离线优先策略.md)
> **原始文档**: [drift.simonbinder.eu](https://drift.simonbinder.eu) | [pub.dev/packages/drift](https://pub.dev/packages/drift)
