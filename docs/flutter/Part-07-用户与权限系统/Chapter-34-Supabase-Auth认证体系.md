> **Part**: Part VII — 用户与权限系统
> **上一章**: [Chapter 33 — App 生命周期管理](../Part-06-应用架构/Chapter-33-App生命周期管理.md)
> **下一章**: [Chapter 35 — 安全存储与生物识别](./Chapter-35-安全存储与生物识别.md)
> **官方文档**: [supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)

---

# 第 34 章：Supabase Auth 深度 — 认证体系完整实现

## 0. 本章目标

掌握 Supabase Auth 完整流程：邮箱注册/登录、Auth State 监听（onAuthStateChange + StreamBuilder）、Session 管理（持久化/自动恢复/过期检测/Token 刷新）、SplashScreen 启动认证检查、GoRouter AuthGuard 路由守卫、OAuth + Magic Link、退出登录。

> 🎯 **Library App 产出**：SplashScreen 检查认证状态自动导航、登录/注册/忘记密码页面（完整表单验证）、AuthGuard 路由守卫、Auth State 全局监听。

---

## 1. Auth Service 完整封装

> **OAuth（开放授权）**：一种让你用已有账号（如 Google、GitHub）登录其他网站/App 的协议——不需要为新服务单独注册账号。流程：你点"Google 登录" → App 打开 Google 登录页 → 你确认授权 → Google 把你是谁告诉 App。Custom URL Scheme（如 `io.library.app://login-callback`）是 OAuth 登录完成后 App 重新唤醒自己的"暗号"。
>
> **Magic Link**：一种无密码登录方式——你输入邮箱后，系统发一封包含特殊链接的邮件给你，点击链接就自动登录了，完全不需要记忆密码。OTP 是 One-Time Password 的缩写——代码层面复用了发送一次性验证码的通道。

```dart
// lib/core/supabase/auth_service.dart
class AuthService {
  final SupabaseClient client;
  AuthService(this.client);

  // ① 邮箱注册（含用户元数据）
  Future<AuthResponse> signUp({required String email, required String password, required String name}) async {
    final response = await client.auth.signUp(
      email: email,
      password: password,
      data: {'name': name, 'role': 'reader'},  // 默认角色
    );
    if (response.user == null) throw AuthException('注册失败，请重试');
    return response;
  }

  // ② 邮箱登录
  Future<AuthResponse> signIn({required String email, required String password}) async {
    final response = await client.auth.signInWithPassword(email: email, password: password);
    if (response.user == null) throw AuthException('邮箱或密码错误');
    return response;
  }

  // ③ OAuth Google 登录
  Future<void> signInWithGoogle() => client.auth.signInWithOAuth(
    OAuthProvider.google,
    redirectTo: 'io.library.app://login-callback',
  );

  // ④ Magic Link 无密码登录
  Future<void> signInWithMagicLink(String email) => client.auth.signInWithOtp(
    email: email,
    emailRedirectTo: 'io.library.app://login-callback',
  );

  // ⑤ 退出登录（清除本地所有数据）
  Future<void> signOut() async {
    await client.auth.signOut();
    // 清除本地缓存
    await getIt<BookLocalDataSource>().clearCache();
    await getIt<SecureStorageService>().clearAll();
  }

  // ⑥ 重置密码
  Future<void> resetPassword(String email) => client.auth.resetPasswordForEmail(email);

  // ⑦ 当前状态
  User? get currentUser => client.auth.currentUser;
  Session? get currentSession => client.auth.currentSession;
  bool get isLoggedIn => currentSession != null && !currentSession!.isExpired;

  // ⑧ Auth State 变化流
  Stream<AuthState> get authStateChanges => client.auth.onAuthStateChange;
}
```

---

## 2. Auth State 监听与启动流程

```dart
// lib/core/supabase/auth_state_provider.dart
@riverpod
Stream<AuthState> authState(AuthStateRef ref) {
  return Supabase.instance.client.auth.onAuthStateChange;
}

// SplashScreen 集成 Auth 检查
class SplashScreen extends ConsumerStatefulWidget { ... }
class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuthAndNavigate();
  }

  Future<void> _checkAuthAndNavigate() async {
    await Future.delayed(const Duration(seconds: 2)); // 品牌展示

    final session = Supabase.instance.client.auth.currentSession;
    // 为什么需要检查 mounted？因为 await 后面的代码可能在你的 Widget 已经被销毁后才执行（比如用户在你等待时按了返回键）。
    // 如果 Widget 已销毁但你还调用 setState 或 ScaffoldMessenger，会报错。mounted 是 Flutter 提供的标志位，Widget 销毁后自动变为 false。
    if (!mounted) return;

    if (session != null && !session.isExpired) {
      context.go('/');  // 已登录 → 首页
    } else {
      context.go('/login');  // 未登录 → 登录页
    }
  }
}
```

---

## 3. GoRouter AuthGuard

```dart
final goRouter = GoRouter(
  redirect: (context, state) {
    final session = Supabase.instance.client.auth.currentSession;
    final isLoggedIn = session != null && !session.isExpired;
    final isAuthRoute = state.matchedLocation == '/login' || state.matchedLocation == '/register';

    if (!isLoggedIn && !isAuthRoute) return '/login';
    if (isLoggedIn && isAuthRoute) return '/';
    return null;
  },
  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
    GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
    StatefulShellRoute.indexedStack(/* 需要登录的 Tab 路由 */),
  ],
);
```

---

## 4. 登录页面完整实现

```dart
class LoginScreen extends ConsumerStatefulWidget { ... }
class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      await ref.read(authServiceProvider).signIn(
        email: _emailCtrl.text.trim(),
        password: _passwordCtrl.text,
      );
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 80),
                Icon(Icons.local_library, size: 80, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 16),
                Text('欢迎回来', style: Theme.of(context).textTheme.headlineMedium, textAlign: TextAlign.center),
                const SizedBox(height: 32),
                TextFormField(
                  controller: _emailCtrl,
                  decoration: const InputDecoration(labelText: '邮箱', prefixIcon: Icon(Icons.email)),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => v?.contains('@') != true ? '请输入有效的邮箱地址' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _passwordCtrl,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: '密码',
                    prefixIcon: const Icon(Icons.lock),
                    suffixIcon: IconButton(icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off), onPressed: () => setState(() => _obscurePassword = !_obscurePassword)),
                  ),
                  validator: (v) => (v?.length ?? 0) < 6 ? '密码至少 6 位' : null,
                ),
                const SizedBox(height: 24),
                FilledButton(onPressed: _isLoading ? null : _login, child: Text(_isLoading ? '登录中...' : '登录')),
                const SizedBox(height: 16),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Text('还没有账号？'),
                  TextButton(onPressed: () => context.go('/register'), child: const Text('立即注册')),
                ]),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() { _emailCtrl.dispose(); _passwordCtrl.dispose(); super.dispose(); }
}
```

---

## 5. Token 刷新与 Session 恢复

```dart
// Supabase SDK 2.12.4 自动处理 Token 刷新
// 启动时自动调用 supabase.auth.startAutoRefresh()
// 默认每 60 秒检查一次，过期前自动刷新

// 手动检查 Session 状态：
final session = client.auth.currentSession;
if (session?.isExpired == true) {
  // Session 已过期 → 跳转登录页
  client.auth.signOut();
}
```

---

## 6. 本章小结

Supabase Auth 完整流程：注册→邮箱确认→登录→启动 AutoRefresh→AuthGuard 路由守卫→退出清理。关键 API：signUp/signInWithPassword/signInWithOAuth/onAuthStateChange/currentSession。

---

## 7. 本章练习

1. **添加 Google OAuth 登录**：在 `AuthService` 中实现 `signInWithGoogle()` 方法（参考 `signInWithOAuth` provider），在登录页面添加"使用 Google 登录"按钮，配置 Supabase Google Provider。验证标准：点击按钮后跳转 Google 授权页，授权成功后回调 App 并自动登录进入首页。

2. **实现忘记密码页面**：创建 `ForgotPasswordScreen`，包含邮箱输入框和"发送重置邮件"按钮，调用 `client.auth.resetPasswordForEmail(email)` 发送重置邮件，发送成功后显示"已发送密码重置邮件"提示并自动返回登录页。验证标准：输入已注册邮箱后收到 Supabase 发出的重置密码邮件，点击邮件链接可设置新密码。

3. **完善 AuthGuard 路由守卫**：在 GoRouter 的 `redirect` 回调中增加对 `/forgot-password` 路由的处理——未登录用户可访问忘记密码页；同时添加 Session 过期检测——`session.isExpired` 为 true 时自动退出登录并跳转到登录页。验证标准：未登录状态下可访问登录/注册/忘记密码页，访问首页或其他受保护路由则重定向到登录页；Token 过期后自动跳转登录页。

验证标准：以上 3 个练习均通过真机或模拟器手动测试，控制台无报错。

---

> **下一步**: [Chapter 35 — 安全存储与生物识别](./Chapter-35-安全存储与生物识别.md)
> **原始文档**: [supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)
