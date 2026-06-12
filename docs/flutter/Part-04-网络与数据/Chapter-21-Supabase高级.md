> **Part**: Part IV — 网络与数据
> **上一章**: [Chapter 20 — Supabase 集成](./Chapter-20-Supabase集成.md)
> **下一章**: [Chapter 22 — 文件上传与实时通信](./Chapter-22-文件上传与实时通信.md)
> **官方文档**: [supabase.com/docs/guides/realtime](https://supabase.com/docs/guides/realtime) | [supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions) | [supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)

---

# 第 21 章：Supabase 高级 — Realtime、Edge Functions 与 Auth

## 0. 本章目标与前置依赖

**前置依赖**：已完成 Supabase 基础 CRUD（Chapter 21），理解 Riverpod StreamProvider（Chapter 16）。

**本章目标**：掌握 Supabase Realtime（Postgres Changes / Broadcast / Presence）、Edge Functions（Deno 运行时 / 从 Flutter 调用 / Hub 模式）、Supabase Auth（邮箱/OAuth/Magic Link / Auth State 监听 / AuthGuard）。

> 🎯 **本章会在图书馆 App 中做什么**：图书库存变更实时通知（Realtime）、新书上架管理员广播（Broadcast）、"图书推荐"Edge Function（调用 OpenAI API）、Supabase Auth 完整流程。

---

## 1. Realtime — 数据库变更监听

### 1.1 Postgres Changes（表变更订阅）

```dart
// 启用 Realtime（SQL）
// ALTER PUBLICATION supabase_realtime ADD TABLE books;

// Flutter 端订阅
final channel = supabase.channel('books-changes');

channel.onPostgresChanges(
  event: PostgresChangeEvent.all,   // insert / update / delete / all
  schema: 'public',
  table: 'books',
  callback: (payload) {
    debugPrint('Event: ${payload.eventType}');
    debugPrint('New: ${payload.newRecord}');
    debugPrint('Old: ${payload.oldRecord}');
  },
).subscribe();

// ⚠️ dispose 时取消订阅
// channel.unsubscribe();
```

### 1.2 Stream API（REST + Realtime 结合）⭐️

```dart
// .stream() 返回 Stream<List<Map>>, 自动处理初始加载 + 实时更新
final stream = supabase
  .from('books')
  .stream(primaryKey: ['id'])
  .eq('category', 'technology')
  .order('title')
  .limit(50);

stream.listen((books) {
  // books 自动更新——初始加载全部，后续增量推送
  setState(() => _books = books.map((j) => Book.fromJson(j)).toList());
});
```

### 1.3 Stream + Riverpod 集成

```dart
@riverpod
Stream<List<Book>> realtimeBooks(RealtimeBooksRef ref) {
  final client = ref.watch(supabaseClientProvider);
  return client
      .from('books')
      .stream(primaryKey: ['id'])
      .order('created_at', ascending: false)
      .map((data) => data.map(Book.fromJson).toList());
}
// UI 中使用 ref.watch(realtimeBooksProvider).when(...)
```

### 1.4 Broadcast（客户端间消息）

```dart
// 管理员添加新书 → 广播通知所有在线用户
await supabase.channel('admin-broadcast').sendBroadcastMessage(
  event: 'new_book',
  payload: {'title': 'New Release!', 'id': bookId},
);

// 所有客户端接收
supabase.channel('admin-broadcast').onBroadcast(
  event: 'new_book',
  callback: (payload) {
    showNotification('新书上架: ${payload['title']}');
  },
).subscribe();
```

---

## 2. Edge Functions

### 2.1 创建 Edge Function

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录 + 初始化
supabase login
supabase init
```

```typescript
// supabase/functions/book-recommendations/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const { userId } = await req.json();

    // 从 Supabase 获取用户借阅历史
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: borrows } = await supabase
      .from('borrow_records')
      .select('books(category, tags)')
      .eq('user_id', userId)
      .limit(20);

    // 调用 AI 生成推荐
    const prompt = `基于以下借阅偏好推荐3本书：${JSON.stringify(borrows)}`;
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
    });

    return new Response(JSON.stringify(await aiResponse.json()), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

```bash
# 部署
supabase functions deploy book-recommendations
```

### 2.2 Flutter 调用 Edge Function

```dart
final response = await supabase.functions.invoke('book-recommendations', body: {
  'userId': currentUserId,
});

if (response.status == 200) {
  final recommendations = response.data;
}
```

> ⚠️ **Edge Functions 使用 service_role key**，默认绕过 RLS。永远不要从 Flutter 客户端直接调用第三方 API（OpenAI 等），通过 Edge Function 保护 API Key。

---

## 3. Supabase Auth 核心流程

```dart
// lib/core/supabase/auth_service.dart
class AuthService {
  final SupabaseClient client;
  AuthService(this.client);

  // ① 邮箱注册
  Future<AuthResponse> signUp(String email, String password, String name) async {
    return client.auth.signUp(
      email: email,
      password: password,
      data: {'name': name},
    );
  }

  // ② 邮箱登录
  Future<AuthResponse> signIn(String email, String password) async {
    return client.auth.signInWithPassword(email: email, password: password);
  }

  // ③ OAuth Google 登录
  Future<void> signInWithGoogle() async {
    await client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: 'io.library.app://login-callback',
    );
  }

  // ④ 退出
  Future<void> signOut() => client.auth.signOut();

  // ⑤ Auth State 监听
  Stream<AuthState> get authStateChanges => client.auth.onAuthStateChange;

  // ⑥ 当前用户
  User? get currentUser => client.auth.currentUser;
  bool get isLoggedIn => currentUser != null;
}

// Riverpod Provider
@riverpod
Stream<AuthState> authState(AuthStateRef ref) {
  return Supabase.instance.client.auth.onAuthStateChange;
}

// AuthGuard — GoRouter redirect
final goRouter = GoRouter(
  redirect: (context, state) {
    final session = Supabase.instance.client.auth.currentSession;
    final isAuthRoute = state.matchedLocation == '/login';

    if (session == null && !isAuthRoute) return '/login';
    if (session != null && isAuthRoute) return '/';
    return null;
  },
  routes: [...],
);
```

---

## 4. 本章小结

Supabase Realtime 提供三种模式：Postgres Changes（表变更）/ Broadcast（客户端消息）/ Presence（在线追踪）。Edge Functions 保护第三方 API Key，Hub 模式规避函数数量限制。Auth 完整支持邮箱/OAuth/Magic Link + AuthGuard 路由守卫。

---

## 5. 本章练习

1. 为 `books` 表开启 Supabase Realtime，在 Library App 中订阅 `books` 变更——管理员新增图书后，所有在线用户即时看到新书
2. 创建一个 Supabase Edge Function `hello-world`，从 Flutter App 调用并在控制台打印返回值
3. 用 GoRouter 的 `redirect` 实现 AuthGuard：未登录用户访问首页自动跳转 `/login`

验证标准：在两个设备/模拟器上同时打开 App，一个添加图书后另一个即时显示；Edge Function 调用成功返回 `{ "message": "Hello from Edge!" }`。

> **下一步**: [Part VI — 应用架构（Chapter 28）](../Part-06-应用架构/)
> **原始文档**: [supabase.com/docs](https://supabase.com/docs)
