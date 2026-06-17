> **Part**: Part III — 导航与路由
> **上一章**: [Chapter 13 — Widget 测试入门](../Part-02-界面基石/Chapter-13-Widget测试入门.md)
> **下一章**: [Chapter 15 — GoRouter 声明式路由](./Chapter-15-GoRouter声明式路由.md)
> **官方文档**: [flutter.cn/ui/navigation](https://docs.flutter.cn/ui/navigation)

---

# 第 14 章：Navigator 1.0 — 命令式导航基础

## 0. 本章目标与前置依赖

**前置依赖**：能构建完整的页面布局（Chapter 7），理解 BuildContext（Chapter 5），已创建图书详情页（Chapter 8）。

**本章目标**：
- 理解 Navigator 栈模型（Overlay + Route 基础设施）
- 掌握 Navigator 全部 push/pop 方法（push/pop/pushReplacement/popUntil/pushAndRemoveUntil）
- 掌握路由传参与回传数据
- 了解 PageRouteBuilder 自定义页面转场动画
- 掌握嵌套 Navigator 和子栈独立管理
- 掌握底部 TabBar + IndexedStack 保持页面状态
- 掌握 Drawer 侧边导航栏
- 建立与 React Router `<Route>` + `useNavigate()` 的类比

> 🎯 **本章会在图书馆 App 中做什么**：实现图书详情页点击跳转（push/pop）、底部三个 Tab 切换（首页/借阅/我的）、侧边 Drawer 抽屉导航——让 App 从单页走向多页面。

---

## 1. Navigator 栈模型

```dart
// Navigator 基于 Overlay —— 一个浮动在 App 之上的路由堆栈
// 新页面被 push 到栈顶，返回时 pop 出栈

// 类比：浏览器历史记录
// push  ≈ 打开新标签页（并跳转到它）
// pop   ≈ 关闭当前标签页（回到上一页）
// 栈   ≈ 浏览器标签页的"后退"历史

// 可视化：
// ┌────────────────────┐
// │   Page C (栈顶)     │  ← 当前显示
// ├────────────────────┤
// │   Page B           │
// ├────────────────────┤
// │   Page A (栈底)     │
// └────────────────────┘
// pop() → 移除 C → B 成为栈顶 → 显示 B
// push(D) → D 入栈 → D 成为栈顶 → 显示 D
```

> **TS 经验**：Navigator 栈 ≈ React Navigation 的 Stack Navigator。`push` ≈ `navigation.navigate('RouteName', params)`，`pop` ≈ `navigation.goBack()`。

---

## 2. push / pop — 基本页面跳转

### 2.1 最简跳转

```dart
// MaterialPageRoute 是 Flutter 提供的标准页面路由——它会根据平台自动选择合适的转场动画
// （iOS 从右滑入，Android 从下往上）。它是一个 Route 对象，描述了一个"页面"在导航栈中的行为。
// PageRouteBuilder（后面会讲到）是它的可定制版本——你可以自定义动画。
// 跳转到新页面
Navigator.of(context).push(
  MaterialPageRoute(
    builder: (context) => const BookDetailScreen(book: book),
  ),
);

// 返回上一页
Navigator.of(context).pop();
// 或
Navigator.pop(context); // 等价简写

// 返回并传递数据
Navigator.of(context).pop('结果数据');
```

### 2.2 完整跳转+接收返回数据

```dart
// 在列表页中：
void _openBookDetail(Book book) async {
  // push 返回一个 Future——当目标页面 pop 时，此 Future 完成
  final result = await Navigator.of(context).push<String>(
    MaterialPageRoute(
      builder: (context) => BookDetailScreen(book: book),
    ),
  );

  // 使用返回数据
  if (result != null && mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('返回信息: $result')),
    );
  }
}

// 在详情页中：
void _goBack() {
  // pop 时可以携带返回数据
  Navigator.of(context).pop('已借阅: ${book.title}');
}

// 对比 React Navigation:
// navigation.navigate('Detail', { book })          ≈ push
// navigation.goBack()                              ≈ pop
// route.params?.result                             ≈ pop 携带的数据
```

### 2.3 pushReplacement — 替换当前页

```dart
// 场景：登录成功后跳转到首页，不能返回登录页
Navigator.of(context).pushReplacement(
  MaterialPageRoute(
    builder: (context) => const HomeScreen(),
  ),
);

// 相当于：pop() 然后 push(HomeScreen)，但中间帧用户看不到
// React 等价：navigation.replace('Home')
```

### 2.4 popUntil — 返回到指定页面

```dart
// 场景：完成多步操作后直接回到首页
// 栈: Home → Search → Detail → Confirm
// 想直接回到 Home

Navigator.of(context).popUntil((route) => route.isFirst);
// route.isFirst — 栈底的第一个路由

// 通过路由名称返回（配合命名路由使用）
Navigator.of(context).popUntil(ModalRoute.withName('/home'));
```

### 2.5 pushAndRemoveUntil — 跳转并清空栈

```dart
// 场景：登录后跳转到首页，清空所有历史栈
Navigator.of(context).pushAndRemoveUntil(
  MaterialPageRoute(builder: (context) => const HomeScreen()),
  (route) => false,     // false = 移除所有旧路由（栈中只剩 HomeScreen）
);

// 保留某个路由：
// (route) => route.isFirst  保留首页
// (route) => route.settings.name == '/splash'  保留 Splash Screen
```

---

## 3. 路由传参 — 页面间数据传递

### 3.1 发送方式

```dart
// 方式 1：构造函数传参（最常用，类型安全）
Navigator.of(context).push(
  MaterialPageRoute(
    builder: (context) => BookDetailScreen(book: book),
  ),
);

// 方式 2：RouteSettings 传参
Navigator.of(context).push(
  MaterialPageRoute(
    settings: const RouteSettings(arguments: book),
    builder: (context) {
      // 通过 ModalRoute.of(context)?.settings.arguments 取值
      // 见 3.2 节
      return const BookDetailScreen();
    },
  ),
);
```

### 3.2 接收方式

```dart
class BookDetailScreen extends StatelessWidget {
  // 方式 1：构造函数接收（类型安全，首选）
  final Book book;
  const BookDetailScreen({super.key, required this.book});

  // 方式 2：从 RouteSettings 提取（适合命名路由）
  // @override
  // Widget build(BuildContext context) {
  //   final book = ModalRoute.of(context)!.settings.arguments as Book;
  //   return ...
  // }
}
```

### 3.3 返回数据给上一页

```dart
// 上一页：
final result = await Navigator.of(context).push(
  MaterialPageRoute(
    builder: (context) => const BookFormScreen(),
  ),
);
if (result != null && result is Book) {
  // 拿到了新添加/编辑的 Book 对象
  _addBookToList(result);
}

// BookFormScreen 中：
Navigator.of(context).pop(newBook);  // 返回 Book 对象
```

---

## 4. 自定义页面转场动画

```dart
// PageRouteBuilder — 完全控制页面切换动画
Navigator.of(context).push(
  PageRouteBuilder(
    // 目标页面
    pageBuilder: (context, animation, secondaryAnimation) =>
        BookDetailScreen(book: book),

    // 过渡动画时长
    transitionDuration: const Duration(milliseconds: 300),
    reverseTransitionDuration: const Duration(milliseconds: 200),

    // 自定义过渡效果
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      // animation.value: 0.0 → 1.0（进入），1.0 → 0.0（退出）
      const begin = Offset(1.0, 0.0);   // 从右侧滑入
      const end = Offset.zero;
      const curve = Curves.easeOut;

      var tween = Tween(begin: begin, end: end).chain(
        CurveTween(curve: curve),
      );

      return SlideTransition(
        position: animation.drive(tween),
        child: child,
      );
    },
  ),
);

// 常用转场效果速查：
// SlideTransition  — 滑入（类似 iOS push）
// FadeTransition   — 淡入淡出
// ScaleTransition  — 缩放
// RotationTransition — 旋转
// 组合效果：用 AnimatedBuilder 同时组合多个 transition
```

> **TS 经验**：`PageRouteBuilder` ≈ React Navigation 的 `cardStyleInterpolator` 自定义动画。

---

## 5. 命名路由（Named Routes）

对于页面较多的 App，命名路由提供了集中式配置：

```dart
// 在 MaterialApp 中注册所有路由
MaterialApp(
  // 首页
  home: const HomeScreen(),

  // 命名路由表 — 集中式路由字典
  routes: {
    '/': (context) => const HomeScreen(),
    '/detail': (context) => const BookDetailScreen(),
    '/settings': (context) => const SettingsScreen(),
  },

  // 动态路由 — 处理带参数的路由
  onGenerateRoute: (settings) {
    // settings.name — 路由名称
    // settings.arguments — 路由参数

    switch (settings.name) {
      case '/book-detail':
        final book = settings.arguments as Book;
        return MaterialPageRoute(
          builder: (context) => BookDetailScreen(book: book),
        );

      case '/book-edit':
        final book = settings.arguments as Book?;  // null = 添加，非 null = 编辑
        return MaterialPageRoute(
          builder: (context) => BookFormScreen(existingBook: book),
        );

      default:
        // 未知路由 → 显示 404 或回退到首页
        return MaterialPageRoute(
          builder: (context) => const Scaffold(
            body: Center(child: Text('404 - 页面未找到')),
          ),
        );
    }
  },

  // 未知路由的默认处理
  onUnknownRoute: (settings) {
    return MaterialPageRoute(
      builder: (context) => const Scaffold(
        body: Center(child: Text('404 - Not Found')),
      ),
    );
  },
);

// 导航到命名路由
Navigator.pushNamed(context, '/book-detail', arguments: book);
Navigator.pushReplacementNamed(context, '/home');
Navigator.popAndPushNamed(context, '/settings');
```

---

## 6. 底部导航（BottomNavigationBar / NavigationBar）+ IndexedStack

### 6.1 Material 3 NavigationBar

```dart
class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;

  // ① 子页面列表
  static const _screens = [
    HomeTab(),
    BorrowingTab(),
    ProfileTab(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(            // ② IndexedStack 保持所有子页 State
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.library_books_outlined),
            selectedIcon: Icon(Icons.library_books),
            label: '图书',
          ),
          NavigationDestination(
            icon: Icon(Icons.swap_horiz_outlined),
            selectedIcon: Icon(Icons.swap_horiz),
            label: '借阅',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: '我的',
          ),
        ],
      ),
    );
  }
}
```

> **TS 经验**：BottomNavigationBar + IndexedStack ≈ React Navigation 的 Bottom Tab Navigator + `unmountOnBlur: false`。IndexedStack 保证切换 Tab 时子页的 State 不丢失。

---

## 7. Drawer — 侧边抽屉导航

```dart
Scaffold(
  appBar: AppBar(title: const Text('图书馆')),
  // 左侧抽屉
  drawer: Drawer(
    child: ListView(
      padding: EdgeInsets.zero,    // 移除顶部默认内边距
      children: [
        // 头部
        DrawerHeader(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primaryContainer,
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              CircleAvatar(radius: 32, child: Icon(Icons.person, size: 32)),
              SizedBox(height: 8),
              Text('图书馆管理系统', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            ],
          ),
        ),
        // 菜单项
        ListTile(
          leading: const Icon(Icons.home),
          title: const Text('首页'),
          selected: _currentIndex == 0,
          onTap: () {
            setState(() => _currentIndex = 0);
            Navigator.pop(context);   // 关闭抽屉
          },
        ),
        ListTile(
          leading: const Icon(Icons.category),
          title: const Text('分类浏览'),
          onTap: () {
            Navigator.pop(context);
            // 跳转到分类浏览页
          },
        ),
        const Divider(),
        ListTile(
          leading: const Icon(Icons.settings),
          title: const Text('设置'),
          onTap: () {
            Navigator.pop(context);
            Navigator.pushNamed(context, '/settings');
          },
        ),
        ListTile(
          leading: const Icon(Icons.info),
          title: const Text('关于'),
          onTap: () {},
        ),
      ],
    ),
  ),

  // 右侧抽屉（可选）
  // endDrawer: Drawer(...),

  body: _screens[_currentIndex],
);
```

---

## 8. PopScope — 拦截返回操作

```dart
class _BookFormScreenState extends State<BookFormScreen> {
  bool _hasUnsavedChanges = false;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // canPop: false → 禁止系统返回键（需手动处理）
      canPop: !_hasUnsavedChanges,

      // onPopInvokedWithResult: 用户尝试返回时触发
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return; // 已经 pop 了，不需要处理

        // 未保存的修改 → 弹出确认对话框
        final shouldPop = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('放弃修改？'),
            content: const Text('有未保存的修改，确定要退出吗？'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('取消')),
              TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('放弃')),
            ],
          ),
        );

        if (shouldPop == true && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        // ... 表单内容
      ),
    );
  }
}
```

> **TS 经验**：`PopScope` ≈ React Navigation 的 `beforeRemove` 事件监听器——在用户尝试退出页面时拦截并确认。

---

## 9. 图书馆 App 实战

### 9.1 首页点击图书卡片 → 跳转详情

```dart
// home_screen.dart 中的修改
BookCard(
  book: book,
  onTap: () async {
    final result = await Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (_, animation, __) => BookDetailScreen(book: book),
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 250),
      ),
    );
    if (result == 'borrowed' && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('借阅成功！')),
      );
    }
  },
);
```

### 9.2 图书表单 — 添加完成后返回数据

```dart
// home_screen.dart 中 FAB 的 onPressed
floatingActionButton: FloatingActionButton.extended(
  onPressed: () async {
    final newBook = await Navigator.of(context).push<Book>(
      MaterialPageRoute(builder: (_) => const BookFormScreen()),
    );
    if (newBook != null && mounted) {
      // 将新书加入列表
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('已添加: ${newBook.title}')),
      );
    }
  },
  icon: const Icon(Icons.add),
  label: const Text('添加图书'),
),

// BookFormScreen 提交后：
Navigator.of(context).pop(newBook);  // pop 并返回新建的 Book
```

### 9.3 抽出 AppDrawer 组件

```dart
// lib/widgets/app_drawer.dart
import 'package:flutter/material.dart';

class AppDrawer extends StatelessWidget {
  final int currentIndex;
  final void Function(int) onItemSelected;

  const AppDrawer({
    super.key,
    required this.currentIndex,
    required this.onItemSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          DrawerHeader(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Icon(Icons.local_library, size: 48, color: Theme.of(context).colorScheme.primary),
                const SizedBox(height: 8),
                Text('图书馆管理系统', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 4),
                Text('Library Management', style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          _buildDrawerItem(context, Icons.home, '首页', 0),
          _buildDrawerItem(context, Icons.swap_horiz, '借阅记录', 1),
          _buildDrawerItem(context, Icons.person, '我的', 2),
          const Divider(),
          _buildDrawerItem(context, Icons.category, '分类浏览', -1, onTap: () {
            Navigator.pop(context);
          }),
          _buildDrawerItem(context, Icons.settings, '设置', -1, onTap: () {
            Navigator.pop(context);
          }),
          _buildDrawerItem(context, Icons.info, '关于', -1, onTap: () {
            Navigator.pop(context);
          }),
        ],
      ),
    );
  }

  Widget _buildDrawerItem(BuildContext context, IconData icon, String title, int index, {VoidCallback? onTap}) {
    return ListTile(
      leading: Icon(icon),
      title: Text(title),
      selected: index >= 0 && currentIndex == index,
      onTap: () {
        if (index >= 0) onItemSelected(index);
        onTap?.call();
      },
    );
  }
}
```

### 9.4 集成到 HomeScreen

```dart
// home_screen.dart 中 Scaffold 添加 drawer
Scaffold(
  drawer: AppDrawer(
    currentIndex: _currentIndex,
    onItemSelected: (index) {
      setState(() => _currentIndex = index);
    },
  ),
  // ...其他属性不变
);
```

---

## 10. 常见错误与最佳实践

```dart
// ❌ 错误 1：在 build() 中 push 路由
@override
Widget build(BuildContext context) {
  Navigator.of(context).push(...);  // ❌ build 被频繁调用，会 push 多次
  return ...;
}
// ✅ 正确：在事件回调或生命周期中 push

// ❌ 错误 2：pop 时忘记检查 Navigator.canPop()
// Navigator.of(context).pop();  // 栈中只有一页时 pop 会抛异常
// ✅ 正确：
if (Navigator.of(context).canPop()) {
  Navigator.of(context).pop();
}

// ❌ 错误 3：IndexedStack 子页过多 → 内存问题
// ✅ 适当使用 AutomaticKeepAliveClientMixin 控制保活

// ❌ 错误 4：忘记 context.mounted 检查
// final result = await Navigator.push(...);  // await 后 context 可能失效
// Navigator.of(context).push(...);           // ❌
if (context.mounted) {                        // ✅
  Navigator.of(context).push(...);
}
```

---

## 11. 本章小结

| 你学到了什么 | 对标 React Navigation | 在图书馆 App 中的体现 |
|-------------|---------------------|---------------------|
| Navigator push/pop 栈模型 | Stack Navigator | 图书详情页跳转+返回 |
| pushReplacement/popUntil | navigation.replace/goBack | 登录流程跳转 |
| 路由传参 + 数据回传 | route.params | 添加图书返回数据 |
| PageRouteBuilder 自定义动画 | cardStyleInterpolator | 详情页淡入过渡 |
| BottomNavigationBar + IndexedStack | Bottom Tab Navigator | 首页/借阅/我的 三 Tab |
| Drawer | Drawer Navigator | 侧边分类/设置导航 |
| PopScope 拦截返回 | beforeRemove | 未保存修改确认退出 |

---

## 12. 本章练习

### 练习 1：图书详情页跳转与返回

为图书馆 App 的首页图书列表添加点击跳转功能，点击任意图书卡片后通过 `Navigator.push` 进入 `BookDetailScreen`，展示该书的标题、作者、评分、简介；详情页 AppBar 左侧有返回按钮，点击后通过 `Navigator.pop` 返回列表页。

验证：
- 在首页点击一本图书，页面从右侧滑入（Android 为从下往上），进入详情页，标题栏显示书名。
- 按系统返回键或点击 AppBar 左侧返回箭头，回到列表页，不崩溃。
- 在首页用不同的图书重复测试 3 次，每次进入的详情页内容与点击的图书一致。

### 练习 2：添加图书后回传结果

在首页 FAB（浮动操作按钮）点击后，跳转到 `BookFormScreen`（图书添加表单，包含书名、作者两个输入框和一个"保存"按钮）。用户填写信息后点击保存，表单页通过 `Navigator.pop(newBook)` 返回一个 `Book` 对象。首页接收该对象后，用 `SnackBar` 展示"已添加：《书名》"。

验证：
- FAB 点击后进入表单页，输入"Flutter 实战"和"张伟"，点击保存。
- 回到首页后底部弹出 SnackBar，文字为"已添加：Flutter 实战"。
- 不输入任何内容直接保存时，表单页不应 pop（需做非空校验），停留在表单页并显示错误提示。

### 练习 3：命名路由实现设置页跳转

在 `MaterialApp` 中使用 `routes` 表注册至少两条命名路由（`/` 和 `/settings`），并用 `onGenerateRoute` 处理一条带参数的动态路由 `/book-detail`（通过 `arguments` 接收 `Book` 对象）。从首页 Drawer 中点击"设置"菜单项，通过 `Navigator.pushNamed(context, '/settings')` 跳转到设置页。

验证：
- 打开侧边 Drawer，点击"设置"，跳转到 SettingsScreen。
- 在 SettingsScreen 中按返回键，回到首页。
- 通过 `Navigator.pushNamed(context, '/book-detail', arguments: sampleBook)` 能正确跳转到详情页，且页面能展示传入的图书信息。

---

> **下一步**: [Chapter 15 — GoRouter 声明式路由](./Chapter-15-GoRouter声明式路由.md)
> **原始文档**: [flutter.cn/ui/navigation](https://docs.flutter.cn/ui/navigation)
