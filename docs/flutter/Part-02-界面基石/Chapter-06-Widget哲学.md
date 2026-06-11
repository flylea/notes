> **Part**: Part II — 界面基石：Widget 与布局
> **上一章**: [Chapter 05 — Dart 3 新特性与工程化](../Part-01-起航/Chapter-05-Dart3新特性与工程化基础.md)
> **下一章**: [Chapter 07 — 基础 Widget 全解析](./Chapter-07-基础Widget全解析.md)
> **官方文档**: [flutter.cn/ui](https://docs.flutter.cn/ui) | [flutter.cn/resources/inside-flutter](https://docs.flutter.cn/resources/inside-flutter) | [flutter.cn/resources/architectural-overview](https://docs.flutter.cn/resources/architectural-overview)

---

# 第 6 章：Widget 哲学 — 一切皆 Widget

## 0. 本章目标与前置依赖

**前置依赖**：已理解 Flutter 四层架构和三棵树概念（Chapter 1），能熟练定义 Dart 类和构造方法（Chapter 3），已配置项目的 `analysis_options.yaml`（Chapter 4）。

**本章目标**：
- 建立"一切皆 Widget"的心智模型——Widget 是不可变的 UI 配置，而非可变的有状态对象
- 掌握 StatelessWidget 和 StatefulWidget 的使用场景与差异
- 深入理解 `build()` 方法的职责——将状态映射为 UI 描述
- 理解 Element 树的生命周期（createElement / mount / update / unmount）以及它在 Widget 和 RenderObject 之间的桥接角色
- 理解 `const` Widget 的性能优化原理
- 掌握 Widget Key 的作用与四种 Key 的选择策略
- 深入理解 BuildContext 的本质——它不只是一个"上下文对象"，而是 Widget 树位置的句柄
- 与 React 组件模型建立逐个概念的对应关系

> 🎯 **本章会在图书馆 App 中做什么**：创建 `MyApp` + `MaterialApp` 完整配置（主题/路由/主页）、`SplashScreen` 启动页骨架、`HomeScreen` 首页空态（AppBar + 欢迎文字 + FAB）——让 App 从数据模型走向可视界面。

---

## 1. Widget 是什么——重构心智模型

### 1.1 第一个关键认知：Widget = 配置，不是实例

如果你有 React 或 Vue 经验，最容易犯的错误是认为"Widget 就是组件实例"。**Flutter 的 Widget 不是实例——它是配置（Configuration）**。

看一下这个类比：

```
React:
  <MyButton color="blue" />     → 组件实例 → 渲染为 DOM

Flutter:
  MyButton(color: Colors.blue)  → Widget 配置 → 通过 Element → 渲染为 RenderObject
```

区别在于：

| 概念 | React | Flutter |
|------|-------|---------|
| 你写的代码 | JSX 元素 | Widget 构造调用 |
| 它的本质 | 组件（可变，持有 state） | 配置（不可变，纯数据） |
| 生命周期所有者 | 组件实例 | Element（框架内部管理） |
| 当 props 改变时 | 同一个组件实例的 props 更新 | **创建新的 Widget 配置**，Element 决定是否更新 RenderObject |
| 你直接操作的对象 | 组件实例（ref） | 不存在——你永远不直接操作 Widget |

**核心公式**：

```
Widget 树（声明）→ Element 树（生命周期管理）→ RenderObject 树（布局+绘制）
```

你编写的代码定义的是 Widget 树——它描述了你**想要**什么。Flutter 的 Element 树管理**如何实现**。RenderObject 树执行**实际工作**。

> 💡 **通俗类比**：可以把 Widget 想象成一张"装修图纸"——图纸上画好了墙的颜色、门的位置、家具的样式。你不能直接在图纸上涂改（Widget 不可变），你只能画一张新图纸（重建 Widget），然后施工队（Element）会对比新旧图纸，只改动真正需要改的地方。RenderObject 就像真正砌好的墙——它负责最终呈现。

```dart
// ⚠️ 不要把 Widget 当"活的 UI 组件"看
// ❌ 错误心智模型：Widget 是一个活跃的、有状态的对象，我可以调用它的方法
// ✅ 正确心智模型：Widget 是一份配置——描述我想要什么样的界面

// 例子：每次 setState 后，build() 中创建的是全新的 Widget 对象
@override
Widget build(BuildContext context) {
  return Container(           // ← 这是全新的 Container Widget（配置）
    color: Colors.blue,       // ← "我想要一个蓝色的容器"
    child: Text('Hello'),     // ← "里面放 Hello 文本"
  );
}
// 框架用它和之前的 Widget 树比较（通过 Element 树），决定实际需要更新的部分
```

> **TS 经验**：Flutter Widget ≈ React Element（`React.createElement('div', ...)` 的返回值），不是 React Component 实例。Widget 和 React Element 一样，是不可变的轻量对象，频繁创建和销毁的成本极低。

### 1.2 第二个关键认知：一切皆 Widget

在 Flutter 中，"Widget"这个概念覆盖的范围远超 React 的"Component"：

```dart
// 这些都是 Widget：
Text('Hello');           // 文本
Padding(                // 内边距
  padding: EdgeInsets.all(8),
  child: Text('Hello'),
);
Center(                 // 居中
  child: Text('Hello'),
);
Align(                  // 对齐
  alignment: Alignment.topRight,
  child: Text('Hello'),
);
SizedBox(height: 16);   // 空白间距
GestureDetector(         // 手势检测
  onTap: () => print('tapped'),
  child: Container(),
);
Theme(                   // 主题数据注入
  data: ThemeData(),
  child: MyPage(),
);
```

**布局是 Widget，样式是 Widget，间距是 Widget，手势是 Widget，主题是 Widget**——没有 HTML 的 `<div style="padding: 8px">`，只有 `Padding(child: ...)`。这个设计初看可能觉得啰嗦，但它的威力在于**组合性**——你可以用同样的方式组合和复用所有 UI 概念。

---

## 2. StatelessWidget — 无状态 Widget

### 2.1 定义与用法

```dart
// StatelessWidget — Widget 的参数由外部传入，Widget 本身不维护任何状态
class GreetingCard extends StatelessWidget {
  // 字段——从构造函数传入（类似 React props）
  final String name;
  final Color color;

  // const 构造——这是 Flutter 性能优化的关键
  const GreetingCard({
    super.key,              // Key 参数——每个 Widget 都应该接受（Key 的含义见本章 §5）
    required this.name,     // required 表示必填
    this.color = Colors.blue,
  });

  // build() — 将 props 转换为 Widget 树
  // 每次父 Widget 重建时，这个方法可能被重新调用
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        'Hello, $name!',
        style: const TextStyle(color: Colors.white, fontSize: 18),
      ),
    );
  }
}

// 使用：
// const GreetingCard(name: 'Flutter Developer')
```

`StatelessWidget` 的和 React 函数组件的相似程度最高：

```dart
// Flutter
class Card extends StatelessWidget {
  final String title;
  const Card({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Text(title);
  }
}

// React
// function Card({ title }: { title: string }) {
//   return <p>{title}</p>;
// }
```

### 2.2 StatelessWidget 何时重建

StatelessWidget 自身没有"更新"机制。它的 `build()` 方法被重新调用的唯一原因是：**父 Widget 重建了**。当父 Widget 的 `build()` 执行时，子 StatelessWidget 随着父 Widget 的新配置一起被创建（作为新的 Widget 实例），Element 树比较新旧配置，如果不同则重建对应的 RenderObject。

这也是为什么 `const` 构造如此重要——如果子 Widget 是 `const`，父 Widget 重建时子 Widget 不会被替换（因为新旧 Widget 的引用完全相同），Element 树直接跳过它的更新。

---

## 3. StatefulWidget — 有状态 Widget

### 3.1 两件套结构

`StatefulWidget` 由两个类组成——这是 Flutter 新手最容易困惑的设计：

```dart
// ① Widget 类 — 不可变的配置（每次重建都是新实例）
class CounterDemo extends StatefulWidget {
  final String label;
  const CounterDemo({super.key, required this.label});

  @override
  State<CounterDemo> createState() => _CounterDemoState();
  // ↑ createState() — 框架调用它创建一个 State 对象
  // 注意：StatefulWidget 本身没有 build() 方法！
}

// ② State 类 — 可变的、持久的对象（在 Widget 重建时保持存活）
class _CounterDemoState extends State<CounterDemo> {
  int _count = 0;          // 可变状态——存活于 State 对象中

  void _increment() {
    setState(() {          // setState — 告诉框架"状态变了，请重新 build"
      _count++;
    });
  }

  @override
  Widget build(BuildContext context) {
    // 通过 widget 属性访问 StatefulWidget 的字段
    return Column(
      children: [
        Text('${widget.label}: $_count'),
        ElevatedButton(
          onPressed: _increment,
          child: const Text('+1'),
        ),
      ],
    );
  }
}
```

**分离设计的原因**：

```
StatefulWidget（不可变）           State（可变）
     │                                │
     │ 每一帧可能被重新创建             │ 存活于整个"使用期间"
     │ 可以安全丢弃                    │ 持有数据和业务逻辑
     │ 由框架管理                      │ 由你管理
     │                                │
     └── createState() ──→ 绑定到同一个 Element ──→ 保持相同 State 实例
```

> **TS 经验**：Dart 的 `StatefulWidget` + `State` 两件套 ≈ React 的组件函数 + Hooks（`useState`、`useEffect`）。区别在于 React 把状态和渲染放在同一个函数中，Flutter 将它们分为两个对象。

### 3.2 setState() — 触发重建的唯一方式

```dart
void _handleUpdate() {
  // setState 做了三件事：
  // ① 执行你给的回调函数（更新状态）
  // ② 标记 Element 为"dirty"（需要重建）
  // ③ 在下一帧调用 build() 方法

  setState(() {
    _count = _count + 1;     // 更新状态（同步操作）
    // 不能在 setState 回调中进行异步操作！
  });
  // setState 返回后，_count 已经是新值
  // 但 UI 还没更新——框架会在下一帧调用 build()
}
```

**setState 的关键规则**：

| 规则 | 说明 |
|------|------|
| 只在 State 类中调用 | 不能在 StatelessWidget 中调用（它没有 State） |
| 回调必须是同步的 | 不能 `await`，不能有异步 gap |
| 可以在回调中多次修改 | `setState(() { _a++; _b++; })` — 一次性修改多个字段 |
| 不一定导致实际渲染 | Element 可能判定 Widget 配置没变，跳过 RenderObject 更新 |
| 不能在 build() 中调用 | 会导致循环：build → setState → build → 死循环 |
| 不能在 dispose() 后调用 | State 销毁后再调用 setState 会报错（检查 `mounted`） |

### 3.3 State 生命周期方法全解

```dart
class _MyWidgetState extends State<MyWidget> {
  // ① initState — 仅执行一次，在 Widget 插入树时调用
  @override
  void initState() {
    super.initState();        // ⚠️ 必须首先调用 super
    // 在这里做初始化：订阅 Stream、创建 AnimationController、加载初始数据
    _controller = TextEditingController();
    _subscription = _stream.listen(_onData);
  }

  // ② didChangeDependencies — initState 之后立即调用，
  //    且每当此 Widget 依赖的 InheritedWidget 变化时再次调用
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 例如：当 Theme.of(context) 或 MediaQuery.of(context) 变化时触发
    _updateFromTheme();
  }

  // ③ didUpdateWidget — 当父 Widget 重建并传入了不同的参数时调用
  @override
  void didUpdateWidget(covariant MyWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.userId != oldWidget.userId) {
      // 外部传入的 userId 变了——重新加载数据
      _loadUserData(widget.userId);
    }
  }

  // ④ build — 框架在需要渲染时调用（可能每帧都调用）
  @override
  Widget build(BuildContext context) {
    return Text('Hello, ${widget.name}');
  }

  // ⑤ deactivate — State 对象暂时从树中移除时调用
  @override
  void deactivate() {
    super.deactivate();
    // 框架可能稍后重新插入这个 State（例如通过 GlobalKey 移动）
  }

  // ⑥ dispose — State 对象永久从树中移除时调用（释放资源的最后机会）
  @override
  void dispose() {
    _controller.dispose();    // 释放 TextEditingController
    _subscription.cancel();   // 取消 Stream 订阅
    super.dispose();          // ⚠️ 必须最后调用 super
  }

  // mounted — 检查 State 是否还在树中
  void _someAsyncCallback() async {
    final data = await fetchData();
    if (!mounted) return;     // ⚠️ 异步操作后必须检查！State 可能已经被 dispose
    setState(() { _data = data; });
  }
}
```

**生命周期流程图**：

```
创建:   构造函数 → initState → didChangeDependencies → build → (屏幕上可见)
更新1:  didUpdateWidget → build
更新2:  setState → build
更新3:  didChangeDependencies → build
移除:   deactivate → dispose
重新插入: deactivate → (框架保留 State) → build
```

---

## 4. const Widget — 性能的关键

### 4.1 const Widget 的优化原理

```dart
// 考虑这个 build 方法：
@override
Widget build(BuildContext context) {
  return Column(
    children: [
      const Text('App Title', style: TextStyle(fontSize: 24)),   // ①
      const SizedBox(height: 16),                                 // ②
      Text('Hello, ${widget.name}!'),                             // ③
    ],
  );
}
```

当父 Widget 因为状态变化（比如 `setState` 被调用）而重建这个 `Column` 时：

- ① `const Text(...)` — 跳过。它的所有属性在编译时就已知——它永远不变
- ② `const SizedBox(...)` — 跳过。同样是编译时常量
- ③ `Text('Hello, ${widget.name}!')` — **需要检查**。因为它依赖 `widget.name`

`const` Widget 的优化不是"让它更快创建"——它从根本上避免了检查：**如果新旧 Widget 是同一个 const 对象，Flutter 知道它的整个子树都不需要任何处理**。

### 4.2 const 的使用策略

```dart
// ✅ 能 const 就 const
const Text('Hello');
const Icon(Icons.star);
const SizedBox(width: 8);
const EdgeInsets.all(16);
const BorderRadius.circular(8);
const Color(0xFF1565C0);

// ❌ 不能 const——依赖运行时数据
Text(widget.title);                    // title 是外部传入的
SizedBox(width: _dynamicWidth);        // _dynamicWidth 是运行时变量
Icon(_isFavorite ? Icons.star : Icons.star_border);  // 依赖状态

// ✅ 部分 const：外层不能 const 时，内层仍可以
Padding(
  padding: const EdgeInsets.all(16),   // ← 内层可以 const
  child: Text(widget.title),           // ← 这不能
)
```

> **TS 经验**：Dart 的 `const` Widget ≈ React 的 `React.memo` + 引用比较。当 props 引用没变时跳过重渲染。但 Flutter 的 `const` 更彻底——它是编译时保证的完全不可变。

---

## 5. Widget Key — 身份标识

当 Flutter 需要比较新旧 Widget 树时，它使用**类型 + Key** 来判断"是不是同一个 Widget"。

### 5.1 为什么需要 Key

```dart
// 场景：列表中的 Widget
class BookList extends StatefulWidget {
  final List<Book> books;
  const BookList({super.key, required this.books});

  @override
  State<BookList> createState() => _BookListState();
}

class _BookListState extends State<BookList> {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: widget.books.map((book) =>
        BookRow(book: book),  // ← 每本书是一个 Widget
      ).toList(),
    );
  }
}

// 问题：如果 books 列表的顺序改变了（排序），或者插入了一本书在中间，
// Flutter 如何判断哪些 Widget 是"同一个"？
//
// 默认策略：按位置匹配——第 i 个新 Widget 匹配第 i 个旧 Widget
// 这意味着：如果只是位置变了，Flutter 会错误地"配对"
//
// Key 解决这个问题：给每个 Widget 一个唯一标识，让 Flutter 按标识匹配
// BookRow(key: ValueKey(book.id), book: book)
```

### 5.2 四种 Key

| Key 类型 | 用途 | 示例 |
|----------|------|------|
| `ValueKey` | 用值作为标识——最常用 | `ValueKey(book.id)` / `ValueKey('tab-1')` |
| `ObjectKey` | 用对象引用作为标识 | `ObjectKey(myObject)` — 比较引用相等 |
| `UniqueKey` | 每次创建都是新的唯一标识——会强制重建 | `UniqueKey()` — 谨慎使用 |
| `GlobalKey` | 全局唯一标识——用于跨 Widget 树访问 State | `GlobalKey<FormState>()` — 访问表单验证等 |

```dart
// ValueKey — 日常最常用
BookCard(key: ValueKey(book.id), book: book);

// ObjectKey — 当 ValueKey 无法保证唯一时
BookCard(key: ObjectKey(book), book: book);

// UniqueKey — 强制 Flutter 视为"全新的 Widget"（重置 State）
_MyForm(key: UniqueKey()); // 每次重建都是全新表单

// GlobalKey — 跨 Widget 树访问 State 或 RenderObject
final _formKey = GlobalKey<FormState>();
// ...
Form(key: _formKey, ...);
// 在别处：
_formKey.currentState?.validate();
```

> **TS 经验**：Flutter Key ≈ React key prop。同样用于列表中的元素标识。Dart 提供了更丰富的 Key 类型（ValueKey/ObjectKey/UniqueKey/GlobalKey）。

---

## 6. BuildContext — Widget 树中的位置句柄

`BuildContext` 在每个 `build()` 方法中作为参数出现，但它的本质远不止"上下文对象"。

### 6.1 BuildContext 的本质

> 💡 **通俗类比**：BuildContext 就像你的手机 GPS 定位——它告诉 Flutter 框架"你当前在 Widget 树里的哪个位置"。当你写 `Theme.of(context)` 时，Flutter 从这个位置出发，沿着树干向上查找，直到遇到一个 Theme Widget，然后把它保存的数据返回给你。没有 context，Flutter 就不知道从哪开始向上找。你可以把 Widget 树想象成一棵倒挂的树（根在上面，枝叶在下面），context 就是你所在的那片叶子，向上爬就能找到树干上的各种配置（Theme、Navigator、Scaffold 等）。

```dart
// BuildContext 是 Element 类的接口
// 它代表了"当前 Widget 在 Widget 树中的位置"

@override
Widget build(BuildContext context) {
  // context 可以提供：
  // ① 查找祖先 Widget
  final theme = Theme.of(context);           // 最近的主题配置
  final mediaQuery = MediaQuery.of(context);  // 屏幕尺寸信息
  final navigator = Navigator.of(context);    // 导航器

  // ② 查找祖先 State
  // final scaffoldState = Scaffold.of(context); // Scaffold 的 State

  // ③ 查找祖先 RenderObject
  final renderBox = context.findRenderObject() as RenderBox;
  final size = renderBox.size;               // 当前 Widget 的渲染尺寸

  return Text('Size: $size');
}
```

> **TS 经验**：`BuildContext` 看起来像 React 的 Context API 返回值，但更底层。它 ≈ React 中的 `this`（类组件中）——可以向上遍历找到父组件（`this.context` 在 React 中不存在，但 Flutter 的 BuildContext 天然持有父节点引用）。

### 6.2 context 的异步陷阱

```dart
// ❌ 经典错误：在 async gap 后使用 context
void _loadData() async {
  final data = await fetchFromServer();     // 异步等待期间用户可能退出了这个页面
  Navigator.of(context).push(...);          // ❌ context 可能已经失效！

  // ✅ 正确方式 1：检查 mounted（StatefulWidget 中）
  if (!mounted) return;
  Navigator.of(context).push(...);

  // ✅ 正确方式 2：使用 GoRouter（声明式路由，不依赖 context）
  // ref.read(goRouterProvider).go('/detail');
}
```

---

## 7. 图书馆 App 实战

### 7.1 改写 main.dart — 从 Hello World 到 App 骨架

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'app.dart';

void main() {
  // WidgetsFlutterBinding.ensureInitialized() 确保 Flutter 引擎初始化
  // 后续接入 Supabase/Hive 时需要先调用它
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const LibraryApp());
}
```

### 7.2 app.dart — MaterialApp 完整配置

```dart
// lib/app.dart
import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

class LibraryApp extends StatelessWidget {
  const LibraryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      // 应用标题（在 Android 任务切换器中显示）
      title: 'Library Management System',

      // 调试横幅开关（Release 模式自动隐藏）
      debugShowCheckedModeBanner: false,

      // Material 3 主题配置
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
      themeMode: ThemeMode.system,  // 跟随系统

      // 首页
      home: const HomeScreen(),
    );
  }
}
```

### 7.3 home_screen.dart — 首页骨架（含 TabBar）

```dart
// lib/screens/home_screen.dart
import 'package:flutter/material.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // 当前选中的 Tab 索引
  int _currentIndex = 0;

  // 三个 Tab 页面的标题
  static const _pageTitles = ['📚 图书列表', '📋 借阅记录', '👤 我的'];

  // 三个 Tab 页面的构建
  Widget _buildPage(int index) {
    switch (index) {
      case 0:
        return _buildBookListTab();
      case 1:
        return _buildBorrowingTab();
      case 2:
        return _buildProfileTab();
      default:
        return const SizedBox.shrink();
    }
  }

  // 图书列表 Tab（目前仍是占位）
  Widget _buildBookListTab() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.menu_book, size: 80, color: Colors.grey),
          SizedBox(height: 16),
          Text(
            '还没有图书',
            style: TextStyle(fontSize: 18, color: Colors.grey),
          ),
          SizedBox(height: 8),
          Text(
            '点击右下角按钮添加第一本图书',
            style: TextStyle(color: Colors.grey),
          ),
        ],
      ),
    );
  }

  // 借阅记录 Tab（占位）
  Widget _buildBorrowingTab() {
    return const Center(
      child: Text('暂无借阅记录', style: TextStyle(color: Colors.grey)),
    );
  }

  // 我的 Tab（占位）
  Widget _buildProfileTab() {
    return const Center(
      child: Text('请先登录', style: TextStyle(color: Colors.grey)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_pageTitles[_currentIndex]),
        centerTitle: true,
        actions: [
          // 搜索按钮
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // TODO: Chapter 9 实现搜索功能
              debugPrint('搜索按钮被点击');
            },
          ),
        ],
      ),
      // IndexedStack 保持所有 Tab 的 State 存活
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _buildBookListTab(),
          _buildBorrowingTab(),
          _buildProfileTab(),
        ],
      ),
      // 底部导航栏
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
      // 浮动操作按钮
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          debugPrint('添加图书');
        },
        icon: const Icon(Icons.add),
        label: const Text('添加图书'),
      ),
    );
  }
}
```

### 7.4 splash_screen.dart — 启动页

```dart
// lib/screens/splash_screen.dart
import 'package:flutter/material.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

// SingleTickerProviderStateMixin 是动画相关的高级特性（Dart Mixin），
// 在 Part-09 动画章节会详解。这里暂时不需要理解它的含义，照写即可。
class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    // 创建动画控制器（Chapter 34 详细讲解动画）
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );

    _controller.forward();

    // 2 秒后导航到首页
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.local_library,
                size: 100,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 24),
              Text(
                '📚 图书馆管理系统',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Library Management System',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 48),
              const CircularProgressIndicator(),
            ],
          ),
        ),
      ),
    );
  }
}
```

---

## 8. 常见错误与最佳实践

### 8.1 常见错误

```dart
// ❌ 错误 1：在 build() 中执行副作用
@override
Widget build(BuildContext context) {
  _loadData();                // ❌ build 可能每帧调用！副作用应该放在 initState
  return Text('$_data');
}

// ✅ 正确：在 initState 中触发加载
@override
void initState() {
  super.initState();
  _loadData();
}

// ❌ 错误 2：在 dispose() 后调用 setState
void _onDataLoaded(Data data) async {
  await Future.delayed(Duration(seconds: 1));
  setState(() { ... });       // ❌ 用户可能已退出！State 已 dispose!
}

// ✅ 正确：检查 mounted
void _onDataLoaded(Data data) async {
  await Future.delayed(Duration(seconds: 1));
  if (!mounted) return;
  setState(() { ... });
}

// ❌ 错误 3：用 const 构造但传了非 const 参数
// const Text(widget.title);  // ❌ widget.title 是运行时值，不能用于 const

// ✅ 正确：非 const 参数就用普通构造
Text(widget.title);

// ❌ 错误 4：忘记 Key 导致列表状态错误
Column(
  children: books.map((b) => BookCard(book: b)).toList(),  // ❌ 无 Key
)

// ✅ 正确：使用 ValueKey
Column(
  children: books.map((b) =>
    BookCard(key: ValueKey(b.id), book: b)   // ✅ 有 Key
  ).toList(),
)
```

### 8.2 最佳实践

1. **优先 StatelessWidget**：如果 Widget 只需要根据外部参数渲染 UI，选 StatelessWidget。只有需要维护内部可变状态（输入框文本、动画控制器、订阅等）时才用 StatefulWidget
2. **每个 `Widget build()` 方法都应该是纯函数**：给定相同的 context 和 widget 参数，返回相同的 Widget 树。副作用（网络请求、数据库操作）放在 initState 或 ViewModel 中
3. **能 const 就 const**：养成习惯——在能使用 const 的地方使用 const。`analysis_options.yaml` 中的 `prefer_const_constructors` 规则会提醒你
4. **异步操作后检查 mounted**：任何 `await` 之后的代码，如果需要调用 `setState` 或访问 `context`，先检查 `if (!mounted) return`
5. **生命周期方法中先调用 super**：`initState` 中 `super.initState()` 必须在开头；`dispose` 中 `super.dispose()` 必须在末尾

---

## 9. 本章小结

| 你学到了什么 | 对标 React | 在图书馆 App 中的体现 |
|-------------|-----------|---------------------|
| Widget = 不可变配置 | React Element (非 Component) | 理解为什么 build() 每次返回新对象 |
| StatelessWidget | 函数组件 | 大量 UI 展示 Widget |
| StatefulWidget + State 两件套 | 类组件 + useState | HomeScreen 的 Tab 切换状态 |
| Element 树生命周期 | Fiber 协调 | 理解 setState 如何触发更新 |
| const Widget 优化 | React.memo 引用比较 | 在 build() 中大量使用 const |
| Widget Key | React key | BookCard 中用 ValueKey(book.id) |
| BuildContext | 组件实例 this | 获取 Theme/MediaQuery/Navigator |
| MaterialApp + Scaffold 骨架 | BrowserRouter + Layout | App 完整的框架层配置 |

---

## 10. 本章练习

**1. StatelessWidget 与 StatefulWidget 的选择**

在图书馆 App 中，设计一个 `BookRatingWidget` 组件，用于展示一本书的评分（如 4.7 分），旁边有一个星形图标。

- 如果该组件只接收 `rating` 参数并展示，应该用 StatelessWidget 还是 StatefulWidget？写出你的理由。
- 如果该组件还需要支持用户点击星星来打分（点击后分数实时更新），应该用哪种 Widget？写出改造后的代码骨架。
- 验证：新建 `lib/widgets/book_rating_widget.dart`，实现上述两种场景中的至少一种，在 `HomeScreen` 中替换现有的评分展示代码，运行 App 确认评分正常显示。

**2. Widget 树组合**

现有 `BookCard` 组件包含了封面、书名、作者、评分、分类标签等多个子部分（见 Chapter 07 实战代码）。请将其拆分为更小的可复用 Widget：

- 抽取 `BookCoverImage` — 负责封面加载（含 loading/error 占位）
- 抽取 `BookMetaInfo` — 负责书名 + 作者文本
- 抽取 `BookRatingRow` — 负责评分星 + 数值
- 抽取 `BookCategoryLabel` — 负责分类标签
- 在 `BookCard.build()` 中用这些子 Widget 组合出完整卡片
- 验证：重构后的 `BookCard` 视觉效果与重构前完全一致，且每个子 Widget 都能独立在其他页面中使用（如在 `BookDetailScreen` 中复用 `BookCoverImage`）。

**3. 声明式 UI 与命令式 UI 对比**

在图书馆 App 的 `HomeScreen` 中，AppBar 的标题会根据当前选中的 Tab 改变（如"图书列表"/"借阅记录"/"我的"）。请用两种思路实现这个功能：

- 命令式思路（伪代码）：写一段假设的命令式代码来描述你会怎么做（如 `appBar.title = "图书列表"`）
- 声明式思路：写出现在 Flutter 代码中实际的做法（`setState` + `build()` 方法中的条件渲染）
- 用自己的话总结：声明式 UI 相比命令式 UI 的两个核心优势是什么？
- 验证：在 AppBar 右侧增加一个 `IconButton`，点击后切换 AppBar 标题在"图书馆"和当前页面标题之间。用声明式方式实现，确保切换正常。

---

> **下一步**: [Chapter 07 — 基础 Widget 全解析](./Chapter-07-基础Widget全解析.md)
> **原始文档**: [flutter.cn/ui](https://docs.flutter.cn/ui) | [flutter.cn/resources/inside-flutter](https://docs.flutter.cn/resources/inside-flutter)
