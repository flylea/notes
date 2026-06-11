> **Part**: Part III — 导航与路由
> **上一章**: [Chapter 14 — Navigator 命令式导航](./Chapter-14-命令式导航基础.md)
> **下一章**: [Chapter 16 — 深度链接与 URL 策略](./Chapter-16-深度链接与URL策略.md)
> **官方文档**: [flutter.cn/ui/navigation](https://docs.flutter.cn/ui/navigation) | [pub.dev/packages/go_router](https://pub.dev/packages/go_router)

---

# 第 15 章：GoRouter — 现代化声明式路由

## 0. 本章目标与前置依赖

**前置依赖**：理解 Navigator 栈模型（Chapter 10），理解 BuildContext（Chapter 5）。

**本章目标**：
- 理解 GoRouter 的声明式路由配置模式（与 Navigator 1.0 的命令式对比）
- 掌握 GoRouter 核心配置（path/redirect/routes/initialLocation）
- 掌握 ShellRoute（共享 Scaffold + BottomNavigationBar）
- 掌握 StatefulShellRoute.indexedStack（各 Tab 独立导航栈）
- 掌握三种路由参数（path parameters / query parameters / extra）
- 掌握嵌套路由、重定向守卫、错误页面
- 建立与 Next.js App Router 文件路由的类比

> 🎯 **本章会在图书馆 App 中做什么**：用 GoRouter + StatefulShellRoute 重构全部导航（替代 Navigator 1.0 + BottomNavigationBar），实现深层嵌套路由（Book → Reviews → ReviewDetail → AuthorInfo），添加路由类型安全。

---

## 1. GoRouter vs Navigator 1.0

| 特性 | Navigator 1.0 | GoRouter |
|------|-------------|----------|
| 配置方式 | 命令式（代码中 push/pop） | 声明式（集中配置路由表） |
| URL 同步 | 需要额外配置 | 原生支持 |
| 深度链接 | 手动处理 | 原生支持 |
| Tab 导航 | IndexedStack + 手动管理 | StatefulShellRoute 自动管理 |
| 嵌套路由 | 手动管理子 Navigator | 声明式子路由 |
| 路由守卫 | 手动检查 | redirect 函数 |
| 类型安全 | 需要手动类型转换 | extra 参数支持 |
| 适用场景 | 简单 3-5 页 App | 中大型 App（10+ 页面） |

> **TS 经验**：GoRouter ≈ Next.js App Router（文件路由） + React Router（集中配置）。声明式路由表 → URL 自动同步。

---

## 2. GoRouter 基础配置

### 2.1 安装

```yaml
# pubspec.yaml
dependencies:
  go_router: ^14.0.0
```

### 2.2 最简配置

```dart
// lib/core/router/app_router.dart
import 'package:go_router/go_router.dart';
import 'package:flutter/material.dart';
import '../../screens/home_screen.dart';
import '../../screens/book_detail_screen.dart';
import '../../models/book.dart';

// ① 创建 GoRouter 实例
final goRouter = GoRouter(
  // 初始路径
  initialLocation: '/',

  // ② 路由表
  routes: [
    GoRoute(
      path: '/',
      name: 'home',              // 命名路由——导航时用名称而非路径字符串
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/book/:bookId',     // :bookId 是路径参数
      name: 'book-detail',
      builder: (context, state) {
        // ③ 提取路径参数
        final bookId = state.pathParameters['bookId']!;
        // ④ 提取 extra 参数（类型安全）
        final book = state.extra as Book?;
        return BookDetailScreen(book: book ?? Book.placeholder());
      },
    ),
  ],

  // ⑤ 错误页面
  errorBuilder: (context, state) => Scaffold(
    body: Center(
      child: Text('页面未找到: ${state.uri}'),
    ),
  ),
);
```

### 2.3 在 MaterialApp 中接入

```dart
// lib/app.dart
import 'package:flutter/material.dart';
import 'core/router/app_router.dart';

class LibraryApp extends StatelessWidget {
  const LibraryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Library Management System',
      // 使用 GoRouter 配置
      routerConfig: goRouter,
      // 主题配置保持不变
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF1565C0),
        useMaterial3: true,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF42A5F5),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
    );
  }
}
```

> ⚠️ 使用 GoRouter 时，MaterialApp 必须用 `MaterialApp.router` 构造，配合 `routerConfig` 而非 `home`。

---

## 3. 导航方法

```dart
// ① go — 跳转到指定路径（替换栈中的当前页？取决于配置）
context.go('/');
context.go('/book/123');

// ② push — 跳转（添加到栈）
context.push('/book/123');

// ③ pushReplacement — 替换当前页
context.pushReplacement('/login');

// ④ pop — 返回上一页
context.pop();
context.pop('result');  // 带返回数据

// ⑤ goNamed / pushNamed — 通过命名路由导航
context.goNamed('book-detail', pathParameters: {'bookId': '123'});
context.pushNamed(
  'book-detail',
  pathParameters: {'bookId': '123'},
  extra: book,           // 类型安全的数据传递
);

// ⑥ canPop — 检查是否可以返回
if (context.canPop()) {
  context.pop();
}

// ⑦ 获取当前路由信息
final location = GoRouterState.of(context).uri.toString();
```

> **TS 经验**：`context.go()` ≈ `router.push('/path')`（Next.js），`context.push()` ≈ `router.push('/path')`（React Router），`context.pop()` ≈ `router.back()`。

---

## 4. 路由参数 — 三种类型

### 4.1 Path Parameters（路径参数）

```dart
// 配置
GoRoute(
  path: '/book/:bookId',
  builder: (context, state) {
    final bookId = state.pathParameters['bookId']!;   // '123'
    return BookDetailScreen(bookId: bookId);
  },
),

// 导航
context.go('/book/123');
context.pushNamed('book-detail', pathParameters: {'bookId': '123'});
```

### 4.2 Query Parameters（查询参数）

```dart
// 配置
GoRoute(
  path: '/search',
  builder: (context, state) {
    final query = state.uri.queryParameters['q'] ?? '';  // 'clean+code'
    final category = state.uri.queryParameters['category']; // 'technology'
    return SearchScreen(initialQuery: query, category: category);
  },
),

// 导航
context.push('/search?q=clean+code&category=technology');
```

### 4.3 Extra 参数（类型安全的数据传递）

```dart
// 配置
GoRoute(
  path: '/book/:bookId',
  builder: (context, state) {
    final book = state.extra as Book;   // 直接拿到完整 Book 对象
    return BookDetailScreen(book: book);
  },
),

// 导航
context.pushNamed(
  'book-detail',
  pathParameters: {'bookId': book.id},
  extra: book,     // 传递非字符串的复杂对象——这是 GoRouter 最大的优势
);
```

> **TS 经验**：`extra` ≈ React Navigation 的 `route.params`（类型安全版本）。Navigator 1.0 的 `arguments` 需要手动 `as Book` 强制类型转换。

---

## 5. ShellRoute — 共享布局

```dart
final goRouter = GoRouter(
  routes: [
    // ① ShellRoute — 所有子路由共享同一个 Scaffold（带 BottomNavigationBar）
    ShellRoute(
      builder: (context, state, child) {
        // child 是子路由的页面内容
        return ScaffoldWithNavBar(child: child);
      },
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const HomeTab(),
        ),
        GoRoute(
          path: '/borrowing',
          builder: (context, state) => const BorrowingTab(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileTab(),
        ),
      ],
    ),

    // ② 非 Shell 路由（全屏页面，无底部导航栏）
    GoRoute(
      path: '/book/:bookId',
      builder: (context, state) => const BookDetailScreen(),
    ),
  ],
);

// ScaffoldWithNavBar 组件
class ScaffoldWithNavBar extends StatelessWidget {
  final Widget child;
  const ScaffoldWithNavBar({super.key, required this.child});

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    if (location.startsWith('/borrowing')) return 1;
    if (location.startsWith('/profile')) return 2;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,    // ← 子路由的内容渲染在这里
      bottomNavigationBar: NavigationBar(
        selectedIndex: _calculateSelectedIndex(context),
        onDestinationSelected: (index) {
          switch (index) {
            case 0: context.go('/'); break;
            case 1: context.go('/borrowing'); break;
            case 2: context.go('/profile'); break;
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.library_books_outlined), selectedIcon: Icon(Icons.library_books), label: '图书'),
          NavigationDestination(icon: Icon(Icons.swap_horiz_outlined), selectedIcon: Icon(Icons.swap_horiz), label: '借阅'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: '我的'),
        ],
      ),
    );
  }
}
```

> ⚠️ ShellRoute 的简单版本有一个问题：切换 Tab 时，之前的 Tab 的 State 会丢失。因为它并不保持子路由的活跃。下面的 StatefulShellRoute 解决这个问题。

---

## 6. StatefulShellRoute — 各 Tab 保持独立导航栈

```dart
final goRouter = GoRouter(
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        // navigationShell 管理子 Tab 的导航状态
        return ScaffoldWithNavBar(navigationShell: navigationShell);
      },
      branches: [
        // ① 图书 Tab — 有自己的子导航栈
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const HomeTab(),
            ),
          ],
        ),
        // ② 借阅 Tab
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/borrowing',
              builder: (context, state) => const BorrowingTab(),
            ),
          ],
        ),
        // ③ 我的 Tab
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/profile',
              builder: (context, state) => const ProfileTab(),
            ),
          ],
        ),
      ],
    ),

    // 全屏页面（不在 Tab 中）
    GoRoute(
      path: '/book/:bookId',
      builder: (context, state) {
        final book = state.extra as Book;
        return BookDetailScreen(book: book);
      },
    ),
  ],
);

// ScaffoldWithNavBar 更新为使用 navigationShell
class ScaffoldWithNavBar extends StatelessWidget {
  final StatefulNavigationShell navigationShell;
  const ScaffoldWithNavBar({super.key, required this.navigationShell});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,    // ← 当前 Tab 的内容（保持 State）
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (index) {
          // ② goBranch — 切换到指定分支（保留各分支的导航栈）
          navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
            // initialLocation: true → 如果已经是当前 Tab，回到根页面
          );
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.library_books_outlined), selectedIcon: Icon(Icons.library_books), label: '图书'),
          NavigationDestination(icon: Icon(Icons.swap_horiz_outlined), selectedIcon: Icon(Icons.swap_horiz), label: '借阅'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: '我的'),
        ],
      ),
    );
  }
}
```

---

## 7. 嵌套路由

```dart
GoRoute(
  path: '/book/:bookId',
  builder: (context, state) => BookDetailScreen(book: state.extra as Book),

  // 嵌套子路由 — 在 BookDetailScreen 内部显示
  routes: [
    GoRoute(
      path: 'reviews',             // 完整路径: /book/:bookId/reviews
      builder: (context, state) => const ReviewsScreen(),
    ),
    GoRoute(
      path: 'reviews/:reviewId',   // /book/:bookId/reviews/r123
      builder: (context, state) {
        final reviewId = state.pathParameters['reviewId']!;
        return ReviewDetailScreen(reviewId: reviewId);
      },
    ),
    GoRoute(
      path: 'author',              // /book/:bookId/author
      builder: (context, state) {
        final book = state.extra as Book;
        return AuthorScreen(authorName: book.author);
      },
    ),
  ],
),
```

> **TS 经验**：GoRouter 嵌套路由 ≈ Next.js App Router 的文件夹嵌套 `/book/[bookId]/reviews/page.tsx`。

---

## 8. Redirect — 路由守卫

```dart
final goRouter = GoRouter(
  // ① 全局 redirect — 每次导航都会执行
  redirect: (context, state) {
    final isLoggedIn = authService.isLoggedIn;
    final isAuthRoute = state.matchedLocation == '/login';

    // 未登录 → 强制跳转到登录页
    if (!isLoggedIn && !isAuthRoute) {
      return '/login';
    }
    // 已登录 → 访问登录页 → 跳转到首页
    if (isLoggedIn && isAuthRoute) {
      return '/';
    }
    // 否则允许导航
    return null;   // null = 不重定向
  },

  routes: [
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    // ...
  ],
);

// ② 路由级 redirect — 仅对该路由生效
GoRoute(
  path: '/admin',
  redirect: (context, state) {
    // 只有管理员能访问
    if (currentUser?.role != UserRole.admin) return '/';
    return null;
  },
  builder: (context, state) => const AdminDashboard(),
),
```

---

## 9. 图书馆 App 实战：完整 GoRouter 配置

```dart
// lib/core/router/app_router.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../models/book.dart';
import '../../screens/home_screen.dart';
import '../../screens/book_detail_screen.dart';
import '../../screens/book_form_screen.dart';
import '../../screens/splash_screen.dart';
import '../../widgets/scaffold_with_nav.dart';

final goRouter = GoRouter(
  initialLocation: '/splash',

  routes: [
    // Splash — 启动页
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),

    // 主 Shell — 带底部导航
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          ScaffoldWithNavBar(navigationShell: navigationShell),
      branches: [
        // Tab 1: 图书列表
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/',
              name: 'home',
              builder: (context, state) => const HomeScreen(),
            ),
          ],
        ),
        // Tab 2: 借阅记录
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/borrowing',
              name: 'borrowing',
              builder: (context, state) => const BorrowingScreen(),
            ),
          ],
        ),
        // Tab 3: 个人中心
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/profile',
              name: 'profile',
              builder: (context, state) => const ProfileScreen(),
            ),
          ],
        ),
      ],
    ),

    // 全屏页面: 图书详情 + 嵌套子路由
    GoRoute(
      path: '/book/:bookId',
      name: 'book-detail',
      builder: (context, state) => BookDetailScreen(
        book: state.extra as Book,
      ),
      routes: [
        GoRoute(
          path: 'reviews',
          name: 'book-reviews',
          builder: (context, state) {
            final book = state.extra as Book?;
            return ReviewsScreen(bookId: book?.id ?? '');
          },
        ),
        GoRoute(
          path: 'author',
          name: 'author-info',
          builder: (context, state) {
            final book = state.extra as Book?;
            return AuthorScreen(authorName: book?.author ?? 'Unknown');
          },
        ),
      ],
    ),

    // 全屏页面: 图书表单（添加/编辑）
    GoRoute(
      path: '/book-form',
      name: 'book-form',
      builder: (context, state) {
        final existingBook = state.extra as Book?;
        return BookFormScreen(existingBook: existingBook);
      },
    ),

    // 全屏页面: 搜索
    GoRoute(
      path: '/search',
      builder: (context, state) {
        final initialQuery = state.uri.queryParameters['q'] ?? '';
        return SearchScreen(initialQuery: initialQuery);
      },
    ),
  ],

  // 错误页面
  errorBuilder: (context, state) => Scaffold(
    appBar: AppBar(title: const Text('页面未找到')),
    body: Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text('404', style: Theme.of(context).textTheme.headlineLarge),
          const SizedBox(height: 8),
          Text('找不到 ${state.uri}', style: const TextStyle(color: Colors.grey)),
        ],
      ),
    ),
  ),
);
```

---

## 10. 常见错误与最佳实践

```dart
// ❌ 错误 1：使用 GoRouter 时 MaterialApp 用了 home 属性
// MaterialApp(home: HomeScreen());  // ❌ GoRouter 接管路由
// ✅ 正确：MaterialApp.router(routerConfig: goRouter)

// ❌ 错误 2：ShellRoute 内子路由重复声明 path
// ShellRoute → GoRoute(path: '/', ...) ✅
// ShellRoute → GoRoute(path: '/home', ...) ❌ 重复

// ❌ 错误 3：忘记在 GoRoute 的 builder 中处理 extra 为 null
// ✅ 始终提供默认值或 null 检查

// ❌ 错误 4：go() vs push() 混淆
// go('/a').go('/b')  → 栈中只有 /b（替换）
// push('/a').push('/b') → 栈中有 /a 和 /b
```

---

## 11. 本章小结

| 你学到了什么 | 对标 React 生态 | 在图书馆 App 中的体现 |
|-------------|----------------|---------------------|
| GoRouter 声明式配置 | Next.js App Router / React Router | 完整路由表 |
| shellRoute / StatefulShellRoute | Shared Layout | 底部三 Tab 独立导航栈 |
| path/query/extra 三种参数 | params/query + state | 图书详情 extra 传递 Book |
| 嵌套路由 | 文件夹嵌套路由 | Book → Reviews → ReviewDetail |
| redirect 守卫 | Middleware / Protected Route | 登录检查守卫 |
| MaterialApp.router 接入 | RouterProvider | App 根节点配置 |

---

## 12. 本章练习

### 练习 1：GoRouter 路由表定义

将图书馆 App 的路由从 Navigator 1.0 迁移到 GoRouter，定义至少 5 条路由：
- `/` — 首页（图书列表）
- `/book/:bookId` — 图书详情（通过 `state.extra` 接收 `Book` 对象，通过 `state.pathParameters['bookId']` 获取路径参数）
- `/book-form` — 图书添加/编辑（通过 `state.extra` 接收可选的已有 `Book`，null 表示添加，非 null 表示编辑）
- `/borrowing` — 借阅记录
- `/profile` — 个人中心

将 `MaterialApp` 替换为 `MaterialApp.router`，并配置 `routerConfig: goRouter`。

验证：
- 首页正常显示，地址栏显示 `/`。
- 通过 `context.pushNamed('book-detail', pathParameters: {'bookId': '1'}, extra: book)` 跳转到详情页，页面展示正确的图书信息，地址栏显示 `/book/1`。
- 访问未定义的路由（如 `/not-found`）时显示 404 错误页面，而非白屏崩溃。

### 练习 2：StatefulShellRoute 实现 Tab 独立导航栈

用 `StatefulShellRoute.indexedStack` 重构底部三 Tab（图书 Tab、借阅 Tab、我的 Tab），每个 Tab 使用独立的 `StatefulShellBranch`。在图书 Tab 内，从列表点击一本图书跳转到详情页时，切换到底部的"借阅" Tab 再切回"图书" Tab，验证详情页仍然保持（不回到列表页）。

验证：
- 底部三个 Tab 切换正常，每个 Tab 的 UI 独立渲染。
- 在图书 Tab 中跳转到详情页（`/book/1`），切换到借阅 Tab 再切回图书 Tab，详情页仍在（独立导航栈生效）。
- 连续点击同一个 Tab（如已在图书 Tab 再次点击图书 Tab），不重复 push（`goBranch` 的 `initialLocation` 逻辑正确）。

### 练习 3：redirect 登录守卫

为图书馆 App 添加一个简单的登录守卫。创建一个 `AuthProvider`（用 `ChangeNotifier` 实现，包含 `isLoggedIn` 布尔状态和 `login()`/`logout()` 方法）。在 GoRouter 的全局 `redirect` 中实现以下逻辑：
- 用户未登录时，访问任何非 `/login` 的路径都重定向到 `/login`。
- 用户已登录时，访问 `/login` 则重定向到 `/`。
- 返回 `null` 时允许正常导航。

验证：
- App 启动后（模拟未登录状态），直接访问 `/` 或 `/book/1` 都自动跳转到登录页。
- 在登录页点击"登录"按钮（调用 `authProvider.login()`），自动跳转到首页 `/`。
- 已登录状态下，手动在地址栏输入 `/login`，自动跳转回 `/`。
- 退出登录后（调用 `authProvider.logout()`），页面自动跳转到 `/login`。

---

> **下一步**: [Chapter 12 — 深度链接与 URL 策略](./Chapter-12-深度链接与URL策略.md)
> **原始文档**: [pub.dev/packages/go_router](https://pub.dev/packages/go_router) | [flutter.cn/ui/navigation](https://docs.flutter.cn/ui/navigation)
