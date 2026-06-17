# 第 64 章：Flutter 开发最佳实践汇总

## 0. 本章目标

- 掌握 Widget 编写规范和常见反模式
- 学会状态管理方案的选型决策
- 拥有完整的性能优化 Checklist
- 建立 Code Review 的标准流程
- 能够对现有代码做一次完整的代码审查

> 🎯 **本章产出**：`CODE_REVIEW_CHECKLIST.md` — 可复用到任何 Flutter 项目的代码审查清单。

---

## 1. Widget 编写规范

### 1.1 核心原则

#### 原则一：build 方法必须纯净

```dart
// ❌ 反模式：build 方法太长，职责混杂
class BadWidget extends StatelessWidget {
  Widget build(BuildContext context) {
    final data = fetchData();       // 副作用！build 应该纯净
    final now = DateTime.now();     // 每次 rebuild 值都变
    return Column(
      children: [
        _buildHeader(),
        Container(
          padding: const EdgeInsets.all(16),
          child: Column(/* 50 行布局代码 */),
        ),
        _buildFooter(),
      ],
    );
  }
}

// ✅ 正确：build 纯净 + 合理拆分
class GoodWidget extends StatelessWidget {
  const GoodWidget({super.key});

  Widget build(BuildContext context) {
    return Column(
      children: const [
        AppHeader(),
        SizedBox(height: 16),
        BookContent(),
        SizedBox(height: 16),
        AppFooter(),
      ],
    );
  }
}
```

#### 原则二：Widget 粒度 — 单一职责

```dart
// ❌ 一个 Widget 干了太多事
class ProductPage extends StatelessWidget {
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          // 导航栏逻辑
          AppBar(/* ... */),
          // 轮播图
          PageView(/* ... */),
          // 商品列表
          ListView(/* ... */),
          // 筛选器
          Row(/* ... */),
          // 购物车浮窗
          Stack(/* ... */),
          // 底部 Tab
          BottomNavigationBar(/* ... */),
        ],
      ),
    );
  }
}

// ✅ 拆分为独立组件，各司其职
class ProductPage extends StatelessWidget {
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          const ProductBannerCarousel(),
          const ProductFilterBar(),
          Expanded(child: ProductListView()),
          const CartFloatingButton(),
        ],
      ),
    );
  }
}
```

### 1.2 Widget 拆分信号

| 信号 | 操作 | 示例 |
|------|------|------|
| Widget 超过 150 行 | 提取为独立 Widget | `ProductCard` 从 `ProductList` 中提取 |
| 同一层级嵌套超过 5 层 | 提取中间 Widget | `Padding > Container > Column > Row > Text` — 提取前 3 层为独立组件 |
| 同一个表达式出现 3 次以上 | 提取为方法或独立 Widget | 多处使用 `EdgeInsets.symmetric(horizontal: 16)` → 提取为常量 |
| 某个区域有独立的状态 | 提取为 StatefulWidget | 折叠面板 → `ExpansionPanelWidget` |
| 同样的 UI 模式出现在多个页面 | 提取为可复用组件 | 空状态页 → `EmptyStateWidget` |
| Widget 同时包含 UI + 业务逻辑判断 | 分离为纯 UI Widget + 逻辑层 | 条件渲染逻辑提取到 ViewModel |

### 1.3 const 优先原则

```dart
// ❌ 漏掉 const — 每次 rebuild 都创建新实例
Padding(padding: EdgeInsets.all(16), child: Text('Hello'));
SizedBox(height: 20);

// ✅ 能 const 就 const — Flutter 性能优化的第一原则
const Padding(padding: EdgeInsets.all(16), child: Text('Hello'));
const SizedBox(height: 20);

// ✅ 含变量的情况：外层不用 const，内层能 const 就 const
Padding(
  padding: const EdgeInsets.all(16),  // const!
  child: Text(userName),              // userName 是变量，不能 const
);

// ✅ 列表中的 const
Column(
  children: const [
    Text('标题'),
    SizedBox(height: 8),
    Divider(),
  ],
);
```

**规则**：如果构造函数的参数在编译时都是已知的常量，就用 `const`。配置 `prefer_const_constructors` 和 `prefer_const_literals_to_create_immutables` lint 规则。

### 1.4 StatefulWidget 最小化原则

```dart
// ❌ 整个页面都是 Stateful，即使只有一个小按钮需要状态
class BookListPage extends StatefulWidget {
  @override
  State<BookListPage> createState() => _BookListPageState();
}
class _BookListPageState extends State<BookListPage> {
  Widget build(BuildContext context) { /* 200 行代码 */ }
}

// ✅ 只把有状态的部分提取为独立的 StatefulWidget
class BookListPage extends StatelessWidget {
  const BookListPage({super.key});
  Widget build(BuildContext context) {
    return Column(
      children: [
        const BookListHeader(),
        const Expanded(child: BookListContent()),
        FavoriteToggleButton(bookId: bookId),  // 独立的 StatefulWidget
      ],
    );
  }
}
```

---

## 2. 状态管理选型决策指南

### 2.1 决策树

```
你的应用复杂度？
  │
  ├─ 极简单（2-3 个页面、少量局部状态）
  │   └─ → setState  就够了
  │      条件：无需跨页面共享状态，无异步数据流
  │
  ├─ 中小型（多页面、跨组件共享状态）
  │   └─ → Provider + ChangeNotifier  或  Riverpod
  │      条件：需要跨 Widget 树传递数据，但业务逻辑不太复杂
  │
  ├─ 中型+（服务端数据为主、需要缓存/分页/乐观更新）
  │   └─ → Riverpod 2.x（推荐）
  │      优势：编译时安全、无需 BuildContext、代码生成
  │      条件：复杂的异步数据流、需要 Provider 组合、autoDispose 自动回收
  │
  └─ 大型企业级（多团队协作、严格的分层架构要求）
      └─ → Bloc
          优势：严格的事件驱动、高可测性、与 Clean Architecture 契合
          条件：需要严格的单向数据流、事件可追溯、团队有 Bloc 经验
```

### 2.2 方案对比详解

| 方案 | 学习曲线 | 模板代码量 | 适合规模 | 核心优势 | 核心缺陷 |
|------|---------|-----------|---------|---------|---------|
| setState | 极低 | 极少 | S | 零依赖，新人友好 | 无法跨组件共享；代码耦合严重 |
| Provider | 低 | 少 | M | API 简洁；与 Flutter 契合 | BuildContext 依赖；Provider 层级地狱 |
| Riverpod | 中 | 中 | M-L | 编译时安全；Provider 自动回收 | 学习曲线中等；`.autoDispose` 需理解 |
| Bloc | 高 | 多 | L-XL | 事件可追溯；测试友好 | 模板代码爆炸；简单需求过度设计 |

### 2.3 Riverpod 实战决策

```dart
// 使用哪个 Provider 类型？
// Provider          → 同步数据、永不改变（如 Dio 实例、Repository 实例）
// StateProvider     → 简单的可变状态（如计数器、开关状态）
// StateNotifierProvider → 复杂可变状态 + 方法（推荐用 Notifier 替代）
// FutureProvider    → 一次性异步数据（如 API 调用结果）
// StreamProvider    → 持续的异步数据流（如数据库监听）
// NotifierProvider   → 复杂状态 + 方法（2.x 推荐，替代 StateNotifier）

// 什么时候用 .autoDispose？
// ✅ 页面离开后不再需要的数据 → autoDispose
// ✅ 列表项的数据 → autoDispose（防止内存泄漏）
// ❌ 全局配置（如主题、语言）→ 不用 autoDispose
// ❌ WebSocket 连接 → 不用 autoDispose
```

### 2.4 Provider → Riverpod 迁移指南

```dart
// Provider 写法
class CounterProvider extends ChangeNotifier {
  int _count = 0;
  int get count => _count;
  void increment() { _count++; notifyListeners(); }
}

// 使用处
final counter = context.watch<CounterProvider>().count;

// ===========================================

// Riverpod 写法
@riverpod
class Counter extends _$Counter {
  @override
  int build() => 0;
  void increment() => state++;
}

// 使用处
final counter = ref.watch(counterProvider);
```

---

## 3. 常见错误与最佳实践

### 3.1 错误处理

```dart
// ❌ 错误 1：吞掉异常
Future<void> loadBooks() async {
  try {
    final books = await repository.fetchBooks();
    setState(() => _books = books);
  } catch (e) {
    // 什么都不做 — 用户不知道发生了什么
  }
}

// ✅ 正确：分级处理异常
Future<void> loadBooks() async {
  try {
    final books = await repository.fetchBooks();
    setState(() => _books = books);
  } on NetworkException catch (e) {
    _showSnackBar('网络连接失败，请检查网络设置');
    logger.warning('Network error: $e');
  } on AuthException catch (e) {
    _showSnackBar('登录已过期，请重新登录');
    ref.read(authProvider.notifier).logout();
  } catch (e, stackTrace) {
    _showSnackBar('加载失败，请重试');
    logger.severe('Unexpected error', e, stackTrace);
  }
}
```

### 3.2 异步 + mounted 检查

```dart
// ❌ 错误 2：异步操作后未检查 mounted
Future<void> loadData() async {
  final data = await fetchFromNetwork();  // 用户可能已经退出了这个页面
  setState(() => _data = data);           // 崩溃！Widget 已销毁
}

// ✅ 正确：每个异步操作后检查 mounted
Future<void> loadData() async {
  final data = await fetchFromNetwork();
  if (!mounted) return;                   // Widget 已销毁，安全退出
  setState(() => _data = data);
}
```

### 3.3 Controller 生命周期

```dart
// ❌ 错误 3：忘记 dispose Controller
class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _animationController = AnimationController(
    vsync: this, duration: const Duration(milliseconds: 300),
  );
  late final _subscription = stream.listen((_) {});

  @override
  void dispose() {
    // 只 dispose 了部分！_scrollController 和 _subscription 泄漏
    _controller.dispose();
    _animationController.dispose();
    super.dispose();
  }
}

// ✅ 正确：所有 Controller 和 Subscription 必须在 dispose 中释放
class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  late final AnimationController _animationController;
  StreamSubscription? _subscription;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this, duration: const Duration(milliseconds: 300),
    );
    _subscription = stream.listen((_) {});
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    _animationController.dispose();
    _subscription?.cancel();
    super.dispose();
  }
}
```

### 3.4 BuildContext 在 initState 中的使用

```dart
// ❌ 错误 4：initState 中使用 BuildContext
@override
void initState() {
  super.initState();
  final router = GoRouter.of(context);            // 错误！context 不可用
  final theme = Theme.of(context).colorScheme;    // 错误！
}

// ✅ 正确方案 1：使用 addPostFrameCallback
@override
void initState() {
  super.initState();
  WidgetsBinding.instance.addPostFrameCallback((_) {
    final router = GoRouter.of(context);
    router.go('/home');
  });
}

// ✅ 正确方案 2：使用 didChangeDependencies
@override
void didChangeDependencies() {
  super.didChangeDependencies();
  final theme = Theme.of(context).colorScheme;
  // 在这里使用 context 是安全的
}
```

### 3.5 列表构建

```dart
// ❌ 错误 5：大列表使用 ListView(children: [...])
ListView(
  children: books.map((b) => BookCard(book: b)).toList(), // 一次性创建所有 Widget
)

// ✅ 正确：使用 ListView.builder 按需构建
ListView.builder(
  itemCount: books.length,
  itemBuilder: (context, index) => BookCard(book: books[index]),
)

// ✅ 更好：固定高度项使用 itemExtent 跳过测量
ListView.builder(
  itemExtent: 80.0,
  itemCount: books.length,
  itemBuilder: (context, index) => BookCard(book: books[index]),
)
```

### 3.6 状态订阅粒度

```dart
// ❌ 错误 6：订阅整个状态对象
final user = ref.watch(userProvider);

Widget build(BuildContext context) {
  // 即使只用了 userName，user 对象中任何字段变化都会触发重建
  return Text('欢迎, ${user.userName}');
}

// ✅ 正确：只订阅需要的字段
final userName = ref.watch(userNameProvider);
// 或使用 select
final userName = ref.watch(userProvider.select((u) => u.userName));

Widget build(BuildContext context) {
  return Text('欢迎, $userName');
}
```

### 3.7 回调函数优化

```dart
// ❌ 错误 7：build 中创建匿名函数
Widget build(BuildContext context) {
  return ElevatedButton(
    onPressed: () {                               // 每次 build 创建新函数
      _handleSubmit(context, formData);
    },
    child: const Text('提交'),
  );
}

// ✅ 正确：使用 tear-off 或类方法
void _handleSubmit() {
  _handleSubmitWithContext(context, formData);
}

Widget build(BuildContext context) {
  return ElevatedButton(
    onPressed: _handleSubmit,                     // 同一个函数引用复用
    child: const Text('提交'),
  );
}
```

### 3.8 不必要的 StatefulWidget

```dart
// ❌ 错误 8：能用 StatelessWidget 却用了 StatefulWidget
class BookTitle extends StatefulWidget {
  final String title;
  const BookTitle({super.key, required this.title});
  @override
  State<BookTitle> createState() => _BookTitleState();
}
class _BookTitleState extends State<BookTitle> {
  Widget build(BuildContext context) {
    return Text(widget.title, style: Theme.of(context).textTheme.headlineSmall);
  }
}

// ✅ 正确：没有可变状态，直接用 StatelessWidget
class BookTitle extends StatelessWidget {
  final String title;
  const BookTitle({super.key, required this.title});
  Widget build(BuildContext context) {
    return Text(title, style: Theme.of(context).textTheme.headlineSmall);
  }
}
```

### 3.9 URL 构造

```dart
// ❌ 错误 9：字符串拼接构造 API URL
final url = 'https://$host:$port/api/v1/books?page=$page&limit=$limit';

// ✅ 正确：使用 Uri 类
final uri = Uri(
  scheme: 'https',
  host: host,
  port: port,
  path: '/api/v1/books',
  queryParameters: {'page': '$page', 'limit': '$limit'},
);
```

### 3.10 GlobalKey 滥用

```dart
// ❌ 错误 10：不需要 Key 的地方使用 GlobalKey
ListView(
  children: [
    BookCard(key: GlobalKey(), book: books[0]),  // 无意义
    BookCard(key: GlobalKey(), book: books[1]),  // 无意义
  ],
)

// ✅ 正确：99% 情况不需要 Key。只在以下场景用：
// 1. 同层级同类型 Widget 需要区分时（如可排序列表项）
// 2. 需要在 Widget 树外访问 State 时（如 Form.validate）
final _formKey = GlobalKey<FormState>();  // 有明确用途
Form(key: _formKey, child: /* ... */);
```

---

## 4. 性能优化 Checklist

### 4.1 Build 优化（影响最大）

- [ ] Widget 构造函数尽可能使用 `const`
- [ ] 避免在 `build()` 中创建对象（`DateTime.now()`、`Random()` 等）
- [ ] 避免在 `build()` 中调用方法（`.toList()`、`.map()` 等）— 应缓存为变量
- [ ] 大列表使用 `ListView.builder`（而非 `ListView(children: [...])`）
- [ ] 固定高度列表使用 `itemExtent` 或 `prototypeItem`
- [ ] 提取 `build()` 中的不变量为 `final` 局部变量
- [ ] 使用 `RepaintBoundary` 包裹不需要重绘的子树
- [ ] 复杂的列表项使用 `AutomaticKeepAliveClientMixin` 避免重复创建

### 4.2 状态管理优化

- [ ] 使用 `Selector` / `select` 精确订阅需要的状态片段
- [ ] 避免全局刷新：只通知真正依赖的 Widget
- [ ] `AnimatedBuilder` 的 `child` 参数用于缓存不依赖于动画的子组件
- [ ] Riverpod 的 `autoDispose` 用于不再需要的 Provider

### 4.3 资源优化

- [ ] 图片使用 `cached_network_image`（网络图片）或 `AssetImage`（本地）
- [ ] 列表中的图片设置合理的 `cacheWidth/cacheHeight`
- [ ] 大图片使用渐进式加载（placeholder + fadeIn）
- [ ] 使用 `const SizedBox.shrink()` 代替 `Container()`（更轻量）
- [ ] 使用 `const SizedBox(width: 8)` 代替 `SizedBox(width: 8)`（可 const 时）

### 4.4 Shader 编译优化

```dart
// ❌ 首次导航到页面时触发大量 shader 编译 → 卡顿/闪烁
// ✅ 使用 warm-up 预热常用路由
MaterialApp(
  // ... 其他配置
  builder: (context, child) {
    return ShaderWarmUpWidget(child: child!);
  },
);

// 或简单方式：启动时快速浏览所有页面
// 参考：flutter run --profile --cache-sksl
```

### 4.5 分析工具

```bash
# 性能分析
flutter run --profile
# 打开 DevTools → Performance 标签 → 录制 → 分析帧时间

# Widget 重建可视化
# 在 DevTools 中开启 Highlight Repaints

# SKSL 预热
flutter run --profile --cache-sksl
flutter screenshot --type=skia --observatory-uri=...
```

---

## 5. Code Review 场景实战

### 5.1 场景一：审查 Widget 拆分

```dart
// 提交的代码是这样的（一个类 300+ 行）：
class BookDetailPage extends StatefulWidget {
  // ... 省略 State
}

class _BookDetailPageState extends State<BookDetailPage> {
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        child: Column(
          children: [
            // 封面区 (30 行)
            // 基本信息区 (40 行)
            // 借阅状态区 (50 行)
            // 书评列表区 (60 行)
            // 相似推荐区 (40 行)
            // 操作按钮区 (30 行)
          ],
        ),
      ),
    );
  }
}

// Review 建议：
// 1. 每个语义区块提取为独立 Widget（或方法）
// 2. BookDetailPage 应该只有 body: BookDetailBody() 一行
// 3. 封面区 → BookCoverSection
// 4. 借阅状态 → BorrowStatusCard
// 5. 书评列表 → BookReviewsSection
```

### 5.2 场景二：审查异步处理

```dart
// 提交的代码：
Future<void> _deleteBook(String id) async {
  await repository.deleteBook(id);
  setState(() { _books.removeWhere((b) => b.id == id); });
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(content: Text('删除成功')),
  );
}

// Review 要点：
// 1. 删除操作可能失败，缺少 try-catch
// 2. 乐观更新：应该先更新 UI 再删后端，失败时回滚
// 3. 未检查 mounted
// 4. 没有确认对话框 — 危险操作需要用户确认

// 修改后的代码：
Future<void> _deleteBook(String id) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('确认删除'),
      content: const Text('删除后不可恢复'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('取消')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('删除')),
      ],
    ),
  );
  if (confirmed != true) return;

  final backup = List<Book>.from(_books);
  setState(() { _books.removeWhere((b) => b.id == id); });

  try {
    await repository.deleteBook(id);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('删除成功')),
    );
  } catch (e) {
    setState(() { _books = backup; });  // 回滚
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('删除失败: $e')),
    );
  }
}
```

### 5.3 场景三：审查安全性

```dart
// 提交的代码：
final dio = Dio(BaseOptions(
  baseUrl: 'https://api.example.com',
  headers: {'Authorization': 'Bearer sk-abc123xyz'},
));

// Review 要点：
// 1. API Key 硬编码在源码中 — 必须移到环境变量
// 2. baseUrl 硬编码 — 不同环境（dev/staging/prod）应不同

// 修改后：
final dio = Dio(BaseOptions(
  baseUrl: const String.fromEnvironment('API_BASE_URL'),
  headers: {
    'Authorization': 'Bearer ${const String.fromEnvironment('API_KEY')}',
  },
));

// 运行时传入：
// flutter run --dart-define=API_BASE_URL=https://api.example.com \
//             --dart-define=API_KEY=sk-abc123xyz
```

---

## 6. 完整的 Code Review Checklist

```markdown
# Code Review Checklist — Flutter

## Widget 构建
- [ ] Widget 是否合理拆分（<150 行、职责单一）
- [ ] 是否尽可能使用了 const 构造
- [ ] build 方法是否有副作用（网络调用、日期生成等）
- [ ] 是否有不必要的 StatefulWidget（该用 Stateless 的用了 Stateful）
- [ ] 同一层级 Widget 嵌套是否超过 5 层

## 状态管理
- [ ] 是否选用了合适的状态管理方案
- [ ] 是否避免了全局重建（select/Selector 精确订阅）
- [ ] Controller/Subscription 是否在 dispose 中释放
- [ ] Riverpod Provider 是否合理使用了 autoDispose

## 异步处理
- [ ] 每个 await 是否有错误处理
- [ ] 异步操作后是否检查了 mounted
- [ ] 是否有未 await 的 Future（Future<void> 返回值被忽略）
- [ ] 是否合理使用了 loading/error/data 三态

## 性能
- [ ] 列表是否使用了 .builder 构造（非 ListView(children: [...])）
- [ ] 图片是否有合理的缓存策略（cacheWidth/cacheHeight）
- [ ] 是否有不必要的 rebuild（build 中创建函数/对象）
- [ ] 固定尺寸列表是否指定了 itemExtent
- [ ] SizedBox/Container/EdgeInsets 中能 const 的是否都加了 const

## 代码规范
- [ ] 命名是否符合 Dart 规范（lowerCamelCase / UpperCamelCase / snake_case）
- [ ] 导入是否分组排序（dart: → package: → 相对路径，之间空一行）
- [ ] flutter analyze 是否零 issue
- [ ] dart format 是否通过

## 安全
- [ ] 是否有硬编码的密钥/URL/Token
- [ ] 环境变量是否通过 --dart-define 或 .env 管理
- [ ] .env 是否在 .gitignore 中
- [ ] 用户输入是否有校验（长度、格式、注入防护）
- [ ] 敏感数据是否使用了 flutter_secure_storage

## 测试
- [ ] 核心业务逻辑是否有单元测试
- [ ] 关键页面是否有 Widget 测试
- [ ] mock 是否正确（使用了 mocktail 或无代码生成的方案）
- [ ] 边界情况是否覆盖（空列表、网络错误、空用户输入）

## 无障碍
- [ ] 图片是否有 semanticLabel
- [ ] 按钮是否有清晰的语义
- [ ] 颜色对比度是否足够
- [ ] 是否支持大字体/TalkBack
```

---

## 7. 项目级最佳实践配置

### 7.1 analysis_options.yaml 严格配置

```yaml
include: package:flutter_lints/flutter.yaml

linter:
  rules:
    # 核心性能
    - prefer_const_constructors
    - prefer_const_declarations
    - prefer_const_literals_to_create_immutables
    # 代码质量
    - avoid_print
    - avoid_unnecessary_containers
    - use_key_in_widget_constructors
    - avoid_single_cascade_in_expression_statements
    - unnecessary_string_interpolations
    # 异步安全
    - use_build_context_synchronously
    # 导入规范
    - directives_ordering
    - sort_constructors_first
    # 类型安全
    - always_specify_types
    - avoid_dynamic_calls
```

### 7.2 VSCode 保存时自动修复

```json
// .vscode/settings.json
{
  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit",
    "source.organizeImports": "explicit"
  },
  "[dart]": {
    "editor.formatOnSave": true,
    "editor.rulers": [120]
  }
}
```

---

## 本章练习

**练习 1：对照最佳实践清单检查 Library App**
- 逐项对照本章的性能清单和 Code Review Checklist，检查 Library App 是否满足每一条要求
- 建立一份"问题清单"，标记所有不符合项
- 按优先级排序（性能 > 代码规范 > 安全），为前 3 项制定修复计划

**练习 2：补充 Library App 的安全检查**
- 搜索项目中是否包含硬编码的密钥、API Key 或内网 URL
- 确认所有环境变量均通过 `--dart-define` 或 `.env` 文件管理，且 `.env` 已加入 `.gitignore`
- 检查所有用户输入的 TextField 是否有合理的长度限制和格式校验

**练习 3：建立项目级 CI 检查脚本**
- 编写 shell 脚本 `scripts/quality_check.sh`，依次运行：`flutter analyze`、`flutter test --coverage`、`dart format --set-exit-if-changed .`
- 将该脚本配置到 GitHub Actions，确保每次 PR 自动触发
- 为脚本添加覆盖率阈值检查（低于 75% 则 CI 失败）

**练习 4：Code Review 实战**
- 找一个本教程早期章节的代码（如 Part-02 的 Widget 代码）
- 用本章的 Checklist 逐项审查，记录发现的问题
- 重构该代码，消除所有发现的问题
- 对比重构前后的 `flutter analyze` 结果

---

> 📖 **延伸阅读**: [Effective Dart](https://dart.cn/effective-dart) | [Flutter 性能最佳实践](https://docs.flutter.dev/perf/best-practices)
> 
> **下一步**: [Chapter 65 — 技术栈推荐](./Chapter-65-技术栈推荐.md)
