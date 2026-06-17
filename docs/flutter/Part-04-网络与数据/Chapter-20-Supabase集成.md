> **Part**: Part IV — 网络与数据
> **上一章**: [Chapter 19b — 模型单元测试入门](./Chapter-19b-模型单元测试入门.md)
> **下一章**: [Chapter 21 — Supabase 高级](./Chapter-21-Supabase高级.md)
> **官方文档**: [supabase.com/docs/guides/getting-started/quickstarts/flutter](https://supabase.com/docs/guides/getting-started/quickstarts/flutter) | [pub.dev/packages/supabase_flutter](https://pub.dev/packages/supabase_flutter)

---

# 第 21 章：Supabase 集成 — 后端即服务

## 0. 本章目标与前置依赖

**前置依赖**：已理解 Dio/Riverpod 异步数据流（Chapter 18/16），已有数据模型（Chapter 3/20）。

**本章目标**：掌握 Supabase 项目创建与 Flutter 初始化、PostgREST CRUD 操作（.select/.insert/.update/.delete）、查询过滤链（.eq/.order/.limit/.range）、Row Level Security 策略编写、Storage 文件上传下载、与 Firebase 的逐功能对比。

> 🎯 **本章会在图书馆 App 中做什么**：创建 Supabase 项目、建表（books/users/borrow_records）、配置 RLS 策略、Storage Bucket（book_covers）、用 Supabase 替换 Mock 数据源。

---

## 1. 安装与初始化

```yaml
# pubspec.yaml
dependencies:
  supabase_flutter: ^2.12.0
```

```dart
// lib/main.dart
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Supabase.initialize(
    url: 'https://xxxxxxxxxxxx.supabase.co',
    anonKey: 'sb_publishable_xxxxxxxxxxxx',
    // 可选配置
    // storageOptions: const StorageClientOptions(useNewHostname: true),
  );

  runApp(const ProviderScope(child: LibraryApp()));
}
```

**初始化注意事项**：
- `Supabase.initialize()` 必须在 `runApp()` 之前
- 需要先 `WidgetsFlutterBinding.ensureInitialized()`
- v2.12.4 起 `initialize()` 是幂等的——可安全调用多次
- 新项目使用 `sb_publishable_xxx` key（旧的 anon key 用到 2026 年底）

---

## 2. 数据库表创建（SQL Migration）

```sql
-- supabase/migrations/001_create_tables.sql
-- 在 Supabase Dashboard → SQL Editor 中执行

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  publish_year INTEGER NOT NULL,
  cover_url TEXT,
  description TEXT,
  rating NUMERIC(2,1) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
  total_copies INTEGER DEFAULT 1 CHECK (total_copies >= 0),
  available_copies INTEGER DEFAULT 1 CHECK (available_copies >= 0),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.borrow_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES public.books(id),
  user_id UUID REFERENCES auth.users(id),
  borrow_date TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','returned','overdue','renewed')),
  renew_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_books_category ON public.books(category);
CREATE INDEX idx_books_title ON public.books USING gin(to_tsvector('english', title));
CREATE INDEX idx_borrow_user ON public.borrow_records(user_id);
CREATE INDEX idx_borrow_status ON public.borrow_records(status);
```

---

## 3. Row Level Security 策略

```sql
-- supabase/migrations/002_rls_policies.sql

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;

-- 📖 books: 所有人可读
CREATE POLICY "books_read_all" ON public.books
  FOR SELECT USING (true);

-- 📖 books: 仅管理员可增删改
CREATE POLICY "books_insert_admin" ON public.books
  FOR INSERT WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "books_update_admin" ON public.books
  FOR UPDATE USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  ) WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- 📋 borrow_records: 用户只能看自己的记录
CREATE POLICY "borrows_select_own" ON public.borrow_records
  FOR SELECT USING (
    (SELECT auth.uid()) = user_id
  );

-- 📋 borrow_records: 用户可创建自己的借阅
CREATE POLICY "borrows_insert_own" ON public.borrow_records
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id
  );

-- 📋 borrow_records: 用户可归还自己的书
CREATE POLICY "borrows_update_own" ON public.borrow_records
  FOR UPDATE USING (
    (SELECT auth.uid()) = user_id
  ) WITH CHECK (
    (SELECT auth.uid()) = user_id AND status = 'returned'
  );
```

> ⚠️ **RLS 是最核心的安全防线**：anonKey 内嵌在 App 二进制中（可被提取），RLS 确保即使有人拿到 anonKey，也只能访问策略允许的数据。

---

## 4. PostgREST CRUD 操作

### 4.1 Supabase 客户端封装

```dart
// lib/core/supabase/supabase_client.dart
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'supabase_client.g.dart';

@riverpod
SupabaseClient supabaseClient(SupabaseClientRef ref) {
  return Supabase.instance.client;
}
```

### 4.2 CRUD + 查询过滤链

```dart
// lib/core/data_source/remote/book_remote_data_source.dart
class BookRemoteDataSource {
  final SupabaseClient client;
  BookRemoteDataSource(this.client);

  // SELECT + 过滤链
  Future<List<Book>> getBooks({int page = 1, int limit = 20, String? category}) async {
    var query = client.from('books').select().order('created_at', ascending: false);

    if (category != null) query = query.eq('category', category);

    final response = await query.range((page - 1) * limit, page * limit - 1);
    return response.map((json) => Book.fromJson(json)).toList();
  }

  // 单条查询
  Future<Book?> getBookById(String id) async {
    final response = await client.from('books').select().eq('id', id).single();
    return Book.fromJson(response);
  }

  // INSERT
  Future<Book> createBook(Book book) async {
    final response = await client.from('books').insert(book.toJson()).select().single();
    return Book.fromJson(response);
  }

  // UPDATE
  Future<Book> updateBook(Book book) async {
    final response = await client.from('books').update(book.toJson()).eq('id', book.id).select().single();
    return Book.fromJson(response);
  }

  // DELETE
  Future<void> deleteBook(String id) async {
    await client.from('books').delete().eq('id', id);
  }

  // 全文搜索（Chapter 32 详解）
  Future<List<Book>> searchBooks(String query) async {
    final response = await client.from('books').select().textSearch('title', query);
    return response.map((json) => Book.fromJson(json)).toList();
  }
}
```

### 4.3 查询过滤链完整 API

```dart
// 链式过滤——按需组合
await client.from('books')
  .select()
  .eq('category', 'technology')     // =
  .neq('status', 'archived')        // !=
  .gt('rating', 4.0)                // >
  .gte('rating', 3.5)               // >=
  .lt('publish_year', 2000)         // <
  .like('title', '%Flutter%')       // LIKE
  .ilike('title', '%flutter%')      // ILIKE (忽略大小写)
  .or('category.eq.science,category.eq.technology')  // OR 条件
  .order('rating', ascending: false)
  .limit(10)
  .range(0, 9);                     // 分页 (offset, limit-1)
```

---

## 5. Supabase Storage — 图书封面上传

### 5.1 创建 Bucket

在 Supabase Dashboard → Storage → New Bucket → `book_covers` → Public bucket。

### 5.2 Storage Service

```dart
// lib/core/supabase/storage_service.dart
class StorageService {
  final SupabaseClient client;
  StorageService(this.client);

  /// 上传封面图片
  Future<String> uploadBookCover(String bookId, File file) async {
    final path = '$bookId/${DateTime.now().millisecondsSinceEpoch}.jpg';
    await client.storage.from('book_covers').upload(
      path, file,
      fileOptions: const FileOptions(upsert: true),
    );
    return client.storage.from('book_covers').getPublicUrl(path);
  }

  /// 获取公开封面 URL
  String getCoverUrl(String path) =>
      client.storage.from('book_covers').getPublicUrl(path);

  /// 删除封面
  Future<void> deleteCover(String path) async {
    await client.storage.from('book_covers').remove([path]);
  }
}
```

---

## 6. Supabase vs Firebase 对照

| 功能 | Firebase | Supabase |
|------|----------|----------|
| 数据库 | Firestore (NoSQL) | PostgreSQL (关系型) |
| 查询能力 | 简单（无 JOIN） | 完整 SQL + JOIN + 聚合 |
| 安全规则 | 自定义 DSL | PostgreSQL RLS（标准 SQL） |
| 实时 | Firestore 原生离线+同步 | Realtime（需自行实现离线） |
| 认证 | Firebase Auth | Supabase Auth（PKCE 默认） |
| 存储 | Firebase Storage | S3 兼容存储 |
| Edge Functions | Cloud Functions | Deno Edge Functions |
| 开源 | 否 | 是（可自托管） |
| 成本（8K MAU） | ~$47/月 | ~$25/月 |

---

## 7. 常见错误与最佳实践

### 常见错误

| 错误描述 | 后果 | 正确做法 |
|---------|------|----------|
| 表未启用 RLS 或策略缺失 | 接口返回空数组 `[]` 或 401 错误，误以为是数据为空 | 建表后立即 `ALTER TABLE xxx ENABLE ROW LEVEL SECURITY` 并创建至少一条 SELECT 策略 |
| `insert`/`update`/`delete` 后忘记 `.select()` | 请求成功但返回 null，无法获取服务器生成的 `id`/`created_at` 等字段 | 链式添加 `.select().single()` 获取确认数据：`client.from('books').insert(...).select().single()` |
| `.single()` 在无匹配结果时抛异常 | 应用崩溃：`PostgrestException: Results contain 0 rows` | 查询可能为空时用 `.maybeSingle()` 返回 null，或用 try-catch 包裹 |
| Storage bucket 设为 private 却用 `getPublicUrl()` | 图片返回 404，用户看不到封面 | 对公开资源（如图书封面）创建 public bucket；私有文件用 `createSignedUrl()` 生成临时链接 |
| `Supabase.initialize()` 未 `await` 就使用客户端 | 请求时抛出 `AuthException: Not initialized` | 确保 `await Supabase.initialize(...)` 在 `runApp()` 之前完成 |

### 最佳实践

- 所有表默认启用 RLS，先写策略再写代码，避免安全盲区
- `insert`/`update`/`delete` 后始终链式 `.select()` 获取服务端确认数据（含自动生成的 `id`、`created_at`）
- 查询唯一记录时优先用 `.maybeSingle()` 而非 `.single()`，避免无结果时崩溃
- Storage bucket 按用途区分：`book_covers` 设为 public，`user_documents` 设为 private
- Supabase 客户端通过 Riverpod `Provider` 单例暴露，避免多处直接调用 `Supabase.instance.client`
- 分页查询统一使用 `.range((page-1)*limit, page*limit-1)` + `.order()`，确保分页数据可预测
- SQL 迁移脚本纳入 Git 版本管理（`supabase/migrations/`），禁止通过 Dashboard 手动改表结构
- RLS 策略中 `auth.uid()` 获取当前用户 ID，`auth.jwt() -> 'app_metadata' ->> 'role'` 做角色判断

---

## 8. 本章小结

Supabase 替代了传统 Firebase 的角色——PostgreSQL 数据库 + RLS 安全 + Storage + Realtime。核心模式：建表 → 配置 RLS → PostgREST CRUD → Riverpod AsyncNotifier 管理状态。

---

## 9. 本章练习

1. 在 Supabase Dashboard 创建 `books` 表（含 title/author/isbn/category/publish_year/cover_url 字段），启用 RLS 并创建"所有人可读"策略
2. 实现 `BookRepository` 的完整 CRUD（getBooks/getBookById/createBook/updateBook/deleteBook），每条方法用 `.select()` + PostgREST 过滤器
3. 在 Library App 中用 `BookRepository` 替换 Mock 数据，验证图书列表从 Supabase 正确加载

验证标准：App 启动后图书列表从 Supabase 加载，新增/编辑/删除操作正确。检查 Supabase Dashboard 中数据变更。

> **下一步**: [Chapter 21 — Supabase 高级](./Chapter-21-Supabase高级.md)
> **原始文档**: [supabase.com/docs](https://supabase.com/docs) | [pub.dev/packages/supabase_flutter](https://pub.dev/packages/supabase_flutter)
