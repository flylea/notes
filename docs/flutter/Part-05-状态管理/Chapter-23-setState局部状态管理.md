> **Part**: Part V — 状态管理
> **上一章**: [Chapter 22 — 文件上传与实时通信](../Part-04-网络与数据/Chapter-22-文件上传与实时通信.md)
> **下一章**: [Chapter 24 — Provider + ChangeNotifier](./Chapter-24-Provider与ChangeNotifier.md)
> **官方文档**: [flutter.cn/data-and-backend/state-mgmt/simple](https://docs.flutter.cn/data-and-backend/state-mgmt/simple)

---

# 第 23 章：setState — 局部状态管理

## 0. 本章目标与前置依赖

**前置依赖**：理解 StatefulWidget 和 State 生命周期（Chapter 5），能使用 TextField/Checkbox/Slider 等输入 Widget（Chapter 9）。

**本章目标**：
- 建立 Ephemeral State（局部状态）vs App State（应用状态）的清晰边界认知
- 深入理解 `setState()` 的内部工作机制（markNeedsBuild → 下一帧 build）
- 完整掌握 State 生命周期方法及其在状态管理中的角色
- 理解 `mounted` 属性的必要性——异步操作后为什么必须检查它
- 掌握常见的局部状态管理模式（搜索过滤/排序/UI 状态切换）
- 建立与 React useState/useEffect 的精准类比

> 🎯 **本章会在图书馆 App 中做什么**：首页搜索框文字实时过滤（setState）、排序方式切换（按书名/作者/评分）、布局切换按钮（列表/网格视图）、分类 Chips 单选——都是页面内部的局部状态。

---

## 1. 两种状态：Ephemeral vs App State

Flutter 将状态分为两类——这是理解状态管理的第一粒扣子：

| 类型 | 英文名 | 范围 | 生命周期 | 管理方式 | 例子 |
|------|--------|------|---------|---------|------|
| **局部状态** | Ephemeral State | 单个 Widget 内 | 随 Widget 销毁而丢失 | `setState` | 搜索框文字、Tab 选中索引、动画控制器 |
| **应用状态** | App State | 跨多个 Widget / 页面 | 随 App 生命周期 | Provider / Riverpod / Bloc | 用户登录状态、图书列表数据、主题设置 |

```dart
// Ephemeral State（局部）— 只有这个 Widget 自己关心
class SearchBar extends StatefulWidget { ... }
class _SearchBarState extends State<SearchBar> {
  String _query = '';              // ← 局部状态：搜索框里的文字
  bool _isFilterOpen = false;      // ← 局部状态：筛选面板是否展开
  // 不需要通知任何其他 Widget
}

// App State（应用级）— 多个 Widget 都需要知道
// 需要用 Provider/Riverpod 管理
class BookListProvider extends ChangeNotifier {
  List<Book> _books = [];          // ← 应用状态：图书列表
  // HomeScreen、SearchScreen、DetailScreen 都要访问
}
```

> **TS 经验**：Ephemeral State ≈ React 的 `useState` 在单个组件内使用。App State ≈ React Context / Redux / Zustand 管理的全局状态。

---

## 2. setState 内部工作原理

```dart
// 当你调用 setState 时，Flutter 做了三件事：
setState(() {
  _query = newValue;   // ① 执行回调——更新你的状态变量
});
// ② 回调执行完毕后，调用 Element.markNeedsBuild()
//    标记当前 Element 为 "dirty"（需要重建）
// ③ 在下一个 SchedulerPhase（通常是下一帧），
//    框架调用 build() 方法重建 Widget 树

// 关键理解：setState 不会"立即更新 UI"
// 它只是把当前 Widget 标记为需要重建
// 真正的 UI 更新发生在下一帧（通常 16ms 后）
```

**setState 的核心约束**：

| 规则 | 说明 | ❌ 错误示例 |
|------|------|-----------|
| 回调是同步的 | 不能在回调中使用 `await` | `setState(() async { await fetch(); })` |
| 只在 State 类中调用 | StatelessWidget 没有 State | — |
| 不在 build() 中调用 | 会导致死循环 | `build() { setState((){}); }` |
| 不在 dispose() 后调用 | State 已销毁 | 异步执行完回调后才 setState |
| 可以批量更新 | 一次 setState 更新多个变量 | — |

---

## 3. 常见的局部状态模式

### 3.1 搜索过滤

```dart
class _HomeScreenState extends State<HomeScreen> {
  // 局部状态
  String _searchQuery = '';
  List<Book> _allBooks = sampleBooks;
  List<Book> _filteredBooks = sampleBooks;

  void _onSearchChanged(String query) {
    setState(() {
      _searchQuery = query;
      _filteredBooks = query.isEmpty
          ? _allBooks
          : _allBooks.where((b) =>
              b.title.toLowerCase().contains(query.toLowerCase()) ||
              b.author.toLowerCase().contains(query.toLowerCase()),
            ).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(
          onChanged: _onSearchChanged,
          decoration: const InputDecoration(hintText: '搜索...', prefixIcon: Icon(Icons.search)),
        ),
        Expanded(
          child: _filteredBooks.isEmpty
              ? const Center(child: Text('未找到匹配的图书'))
              : ListView.builder(
                  itemCount: _filteredBooks.length,
                  itemBuilder: (_, i) => BookListTile(book: _filteredBooks[i]),
                ),
        ),
      ],
    );
  }
}
```

### 3.2 排序切换

```dart
class _HomeScreenState extends State<HomeScreen> {
  enum SortBy { title, author, rating }
  SortBy _sortBy = SortBy.title;

  List<Book> get _sortedBooks {
    final books = List<Book>.from(_filteredBooks);
    switch (_sortBy) {
      case SortBy.title:
        books.sort((a, b) => a.title.compareTo(b.title));
        break;
      case SortBy.author:
        books.sort((a, b) => a.author.compareTo(b.author));
        break;
      case SortBy.rating:
        books.sort((a, b) => b.rating.compareTo(a.rating));
        break;
    }
    return books;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // SegmentedButton 是 Material 3 提供的分段选择器——类似 iOS 的 Segmented Control。
        // segments 定义每一段的内容，selected 用 Set 表示当前选中的项，
        // onSelectionChanged 回调中取出选中值。
        SegmentedButton<SortBy>(
          segments: const [
            ButtonSegment(value: SortBy.title, label: Text('书名')),
            ButtonSegment(value: SortBy.author, label: Text('作者')),
            ButtonSegment(value: SortBy.rating, label: Text('评分')),
          ],
          selected: {_sortBy},
          onSelectionChanged: (selected) {
            setState(() => _sortBy = selected.first);
          },
        ),
        // 排序后的列表
        Expanded(child: ListView.builder(...)),
      ],
    );
  }
}
```

### 3.3 布局切换（列表 ↔ 网格）

```dart
class _HomeScreenState extends State<HomeScreen> {
  bool _isGridView = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('图书列表'),
        actions: [
          IconButton(
            icon: Icon(_isGridView ? Icons.list : Icons.grid_view),
            onPressed: () => setState(() => _isGridView = !_isGridView),
            tooltip: _isGridView ? '列表视图' : '网格视图',
          ),
        ],
      ),
      body: _isGridView
          ? GridView.builder(gridDelegate: ..., itemBuilder: ...)
          : ListView.builder(itemBuilder: ...),
    );
  }
}
```

### 3.4 Tab 选中索引

```dart
class _MainScreenState extends State<MainScreen> {
  int _currentTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentTabIndex,
        children: const [HomeTab(), BorrowingTab(), ProfileTab()],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentTabIndex,
        onDestinationSelected: (index) => setState(() => _currentTabIndex = index),
        destinations: const [...],
      ),
    );
  }
}
```

---

## 4. mounted — 异步操作后的安全网

```dart
class _BookLoaderState extends State<BookLoader> {
  List<Book> _books = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadBooks();
  }

  Future<void> _loadBooks() async {
    setState(() => _isLoading = true);

    try {
      // 模拟网络请求
      final books = await Future.delayed(
        const Duration(seconds: 2),
        () => sampleBooks,
      );

      // ⚠️ 此时 State 可能已经被 dispose 了！
      // 用户在等待期间按了返回键退出了页面
      if (!mounted) return;  // ← 关键安全检查

      setState(() {
        _books = books;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    return ListView.builder(
      itemCount: _books.length,
      itemBuilder: (_, i) => BookListTile(book: _books[i]),
    );
  }
}
```

> **TS 经验**：`mounted` ≈ React 中的 `isMounted` 检查或 AbortController 模式。在 `useEffect` 的 cleanup 函数中设置 `cancelled = true`，异步操作完成后检查它。

---

## 5. 图书馆 App 实战：HomeScreen 局部状态整合

```dart
// lib/screens/home_screen.dart — 整合搜索/排序/布局的局部状态
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentTabIndex = 0;
  String _searchQuery = '';
  SortBy _sortBy = SortBy.title;
  bool _isGridView = true;
  BookCategory? _selectedCategory;

  List<Book> get _filteredAndSortedBooks {
    var books = List<Book>.from(sampleBooks);

    // 分类过滤
    if (_selectedCategory != null) {
      books = books.where((b) => b.category == _selectedCategory).toList();
    }
    // 搜索过滤
    if (_searchQuery.isNotEmpty) {
      books = books.where((b) =>
        b.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
        b.author.toLowerCase().contains(_searchQuery.toLowerCase()),
      ).toList();
    }
    // 排序
    switch (_sortBy) {
      case SortBy.title: books.sort((a, b) => a.title.compareTo(b.title)); break;
      case SortBy.author: books.sort((a, b) => a.author.compareTo(b.author)); break;
      case SortBy.rating: books.sort((a, b) => b.rating.compareTo(a.rating)); break;
    }
    return books;
  }

  @override
  Widget build(BuildContext context) {
    final books = _filteredAndSortedBooks;

    return Scaffold(
      appBar: _buildAppBar(),
      body: SafeArea(child: Column(
        children: [
          _buildSearchBar(),
          _buildCategoryChips(),
          if (books.isEmpty)
            const Expanded(child: Center(child: Text('未找到匹配的图书')))
          else
            Expanded(child: _buildBookList(books)),
        ],
      )),
      bottomNavigationBar: _buildBottomNav(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const BookFormScreen()),
          );
        },
        icon: const Icon(Icons.add),
        label: const Text('添加图书'),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      title: const Text('📚 图书馆'),
      centerTitle: true,
      actions: [
        IconButton(
          icon: Icon(_isGridView ? Icons.list : Icons.grid_view),
          onPressed: () => setState(() => _isGridView = !_isGridView),
          tooltip: _isGridView ? '列表视图' : '网格视图',
        ),
        PopupMenuButton<SortBy>(
          icon: const Icon(Icons.sort),
          tooltip: '排序方式',
          onSelected: (sortBy) => setState(() => _sortBy = sortBy),
          itemBuilder: (_) => [
            const PopupMenuItem(value: SortBy.title, child: Text('按书名')),
            const PopupMenuItem(value: SortBy.author, child: Text('按作者')),
            const PopupMenuItem(value: SortBy.rating, child: Text('按评分')),
          ],
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: TextField(
        onChanged: (v) => setState(() => _searchQuery = v),
        decoration: InputDecoration(
          hintText: '搜索图书、作者...',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _searchQuery.isNotEmpty
              ? IconButton(icon: const Icon(Icons.clear), onPressed: () => setState(() => _searchQuery = ''))
              : null,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          filled: true,
          fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    final categories = [null, ...BookCategory.values];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) => FilterChip(
          label: Text(categories[i]?.label ?? '全部'),
          selected: _selectedCategory == categories[i],
          onSelected: (_) => setState(() => _selectedCategory = categories[i]),
        ),
      ),
    );
  }

  Widget _buildBookList(List<Book> books) {
    if (_isGridView) {
      return GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2, childAspectRatio: 0.65, crossAxisSpacing: 12, mainAxisSpacing: 12,
        ),
        itemCount: books.length,
        itemBuilder: (_, i) => BookCard(book: books[i], onTap: () => context.pushNamed('book-detail', pathParameters: {'bookId': books[i].id}, extra: books[i])),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: books.length,
      itemBuilder: (_, i) => ListTile(
        leading: const Icon(Icons.menu_book),
        title: Text(books[i].title),
        subtitle: Text('${books[i].author} · ${books[i].category.label}'),
        trailing: Text('${books[i].rating}', style: const TextStyle(fontWeight: FontWeight.bold)),
        onTap: () => context.pushNamed('book-detail', pathParameters: {'bookId': books[i].id}, extra: books[i]),
      ),
    );
  }

  Widget _buildBottomNav() {
    return NavigationBar(
      selectedIndex: _currentTabIndex,
      onDestinationSelected: (i) => setState(() => _currentTabIndex = i),
      destinations: const [
        NavigationDestination(icon: Icon(Icons.library_books_outlined), selectedIcon: Icon(Icons.library_books), label: '图书'),
        NavigationDestination(icon: Icon(Icons.swap_horiz_outlined), selectedIcon: Icon(Icons.swap_horiz), label: '借阅'),
        NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: '我的'),
      ],
    );
  }
}
```

---

## 6. 常见错误与最佳实践

```dart
// ❌ 错误 1：异步操作后未检查 mounted
Future<void> _fetch() async {
  final data = await api.getBooks();
  setState(() { ... });       // ❌ State 可能已 dispose
}
// ✅ 正确：
Future<void> _fetch() async {
  final data = await api.getBooks();
  if (!mounted) return;
  setState(() { ... });
}

// ❌ 错误 2：在 build() 中调用 setState
@override
Widget build(BuildContext context) {
  setState(() => _count++);   // ❌ build → setState → build → 死循环
  return Text('$_count');
}

// ❌ 错误 3：setState 回调中写 await
// setState(() async { await something(); });  // ❌
// ✅ 正确：先 await 再 setState
final result = await something();
if (!mounted) return;
setState(() { ... });

// ❌ 错误 4：能用局部状态解决的，提到了 App State
// ✅ 简单原则：只有一个 Widget 关心 → setState；多个 Widget 关心 → Provider/Riverpod
```

---

## 7. 本章小结

| 你学到了什么 | 对标 React | 在图书馆 App 中的体现 |
|-------------|-----------|---------------------|
| Ephemeral vs App State 边界 | useState vs Context/Redux | 搜索词/排序/布局用 setState |
| setState 工作原理 | 调用 state setter → re-render | markNeedsBuild → 下一帧 build |
| State 生命周期 | useEffect + cleanup | initState/dispose 管理资源 |
| mounted 安全检查 | isMounted 或 AbortController | 异步加载后检查 mounted |
| 四种局部状态模式 | — | 搜索/排序/布局/Tab 切换 |

---

## 8. 本章练习

### 练习 1：搜索框 setState 实时过滤

在图书馆 App 首页顶部实现一个搜索框（`TextField`），用户输入文字时通过 `onChanged` 回调调用 `setState` 更新 `_searchQuery` 状态，并对图书列表进行实时过滤（按书名和作者两个字段匹配，大小写不敏感）。当搜索框为空时显示全部图书，当过滤结果为空时显示"未找到匹配的图书"提示。

验证：
- 输入"flutter"，列表仅显示书名或作者包含"flutter"的图书，过滤是即时的（无需按回车）。
- 清空搜索框后，全部图书重新显示。
- 输入一个不存在的书名（如"xyz123"），页面显示"未找到匹配的图书"而非空白。
- 搜索框右侧有清除按钮（输入不为空时出现），点击后清除搜索内容并恢复全部图书。

### 练习 2：底部弹窗中的排序状态

在首页 AppBar 添加一个排序图标按钮，点击后弹出底部弹窗（`showModalBottomSheet`），弹窗内用 `StatefulBuilder` 持有一个局部的排序方式选中状态（书名升序、作者升序、评分降序三个选项，用 `RadioListTile` 实现）。用户选择排序方式后，弹窗关闭并将排序结果应用到图书列表。

验证：
- 点击排序按钮后，底部弹窗从屏幕下方滑入，三个排序选项以单选列表展示。
- 当前排序方式在弹窗中正确高亮（如之前选了"评分降序"，该项显示为选中状态）。
- 选择"评分降序"并关闭弹窗后，图书列表按评分从高到低排列。
- 再次打开弹窗，上次选中的排序方式仍然高亮（局部状态独立于弹窗生命周期）。

### 练习 3：多选筛选 Chip 状态切换

在首页搜索框下方实现一个分类筛选区域，使用 `FilterChip` 横向排列图书分类（计算机、文学、历史、科学），支持多选（用 `Set<BookCategory>` 存储选中状态）。选中一个或多个分类后，图书列表仅显示匹配分类的图书；未选中任何分类时显示全部。

验证：
- 所有分类 Chip 初始处于未选中状态，显示全部图书。
- 点击"计算机" Chip，它变为选中高亮，列表仅显示计算机类图书。
- 继续点击"文学" Chip，两个 Chip 同时高亮，列表显示计算机+文学类图书（并集）。
- 再次点击"计算机" Chip 取消选中，仅剩"文学"高亮，列表恢复仅文学类。
- 用户输入搜索词 + 选中分类时，两个过滤同时生效（交集逻辑）。

---

> **下一步**: [Chapter 24 — Provider + ChangeNotifier 跨组件状态共享](./Chapter-24-Provider与ChangeNotifier.md)
> **原始文档**: [flutter.cn/data-and-backend/state-mgmt/simple](https://docs.flutter.cn/data-and-backend/state-mgmt/simple)
