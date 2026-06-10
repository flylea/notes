> **Part**: Part II — 界面基石：Widget 与布局
> **上一章**: [Chapter 07 — 布局系统精讲](./Chapter-07-布局系统精讲.md)
> **下一章**: [Chapter 09 — 表单与用户输入](./Chapter-09-表单与用户输入.md)
> **官方文档**: [flutter.cn/ui/layout/scrolling](https://docs.flutter.cn/ui/layout/scrolling) | [flutter.cn/ui/layout/scrolling/slivers](https://docs.flutter.cn/ui/layout/scrolling/slivers)

---

# 第 8 章：滚动与列表

## 0. 本章目标与前置依赖

**前置依赖**：理解 Row/Column/Expanded 布局（Chapter 7），理解 build() 方法中 Widget 的创建模式（Chapter 5）。

**本章目标**：
- 掌握 ListView 三种构造方式（默认/builder/separated）及各自适用场景
- 掌握 GridView 的四种构造方式（count/extent/builder/custom）
- 理解 SingleChildScrollView 的正确用法和常见陷阱
- 深入 CustomScrollView + Slivers 体系（SliverAppBar/SliverList/SliverGrid/SliverToBoxAdapter/SliverPersistentHeader/SliverFillRemaining）
- 掌握 ScrollController 的四种用法（监听位置/跳转/动画滚动/分页）
- 理解 ScrollPhysics（BouncingScrollPhysics/ClampingScrollPhysics/NeverScrollableScrollPhysics）
- 建立与 CSS overflow + position:sticky 的对照

> 🎯 **本章会在图书馆 App 中做什么**：首页图书列表改为 `GridView.builder` 展示 30+ 本数据支持滚动性能监控，图书详情页用 `SliverAppBar` 实现可折叠 Header + 背景图。

---

## 1. ListView — 列表滚动

### 1.1 三种构造方式

```dart
// ① ListView() — 默认构造（少量固定子项时使用）
//    所有子 Widget 一次性创建——子项多时浪费内存
ListView(
  padding: const EdgeInsets.all(16),
  children: [
    ListTile(title: Text('Item 1')),
    ListTile(title: Text('Item 2')),
    ListTile(title: Text('Item 3')),
  ],
);

// ② ListView.builder() — 按需构建（大量/无限子项时使用）⭐️
//    只有可见区域的子项才会被创建——性能最佳
ListView.builder(
  padding: const EdgeInsets.all(16),
  itemCount: books.length,                    // 总项数
  itemBuilder: (context, index) {            // 只在需要显示第 index 项时调用
    return ListTile(title: Text(books[index].title));
  },
);

// ③ ListView.separated() — 带分隔线的懒加载列表
ListView.separated(
  padding: const EdgeInsets.all(16),
  itemCount: books.length,
  separatorBuilder: (context, index) => const Divider(height: 1),  // 分隔线
  itemBuilder: (context, index) => ListTile(title: Text(books[index].title)),
);
```

> **TS 经验**：`ListView.builder` ≈ React 虚拟列表（react-window / react-virtuoso）——只渲染可见区域的子项。Flutter 这个能力内置于框架中，不需要第三方库。

### 1.2 ListView 关键属性

```dart
ListView.builder(
  // 滚动方向
  scrollDirection: Axis.vertical,    // 默认垂直
  // scrollDirection: Axis.horizontal, // 水平滚动

  // 反向（聊天列表从底部开始）
  // reverse: true,

  // 滚动控制器
  // controller: _scrollController,

  // 滚动物理效果
  physics: const AlwaysScrollableScrollPhysics(),
  // AlwaysScrollableScrollPhysics — 即使内容不足也允许滚动
  // NeverScrollableScrollPhysics — 禁止用户滚动（只能用 controller）
  // BouncingScrollPhysics — iOS 风格的弹性回弹
  // ClampingScrollPhysics — Android 风格的硬边界

  // 子项原始尺寸（性能优化参数）
  prototypeItem: const ListTile(title: Text('Prototype')),
  // ↑ 告诉 Flutter 每个子项大概多大——避免遍历所有子项来计算总尺寸

  // 预构建区域（在可见区域之外提前构建多少项）
  // cacheExtent: 500,  // 在可见区域上/下各预构建 500px

  itemCount: items.length,
  itemBuilder: (context, index) => ...,
);
```

### 1.3 ListTile — 列表行标准组件

```dart
ListTile(
  // 左侧: 图标或图片
  leading: CircleAvatar(child: Text('A')),
  // 标题
  title: Text('Book Title'),
  // 副标题
  subtitle: Text('Author · 2024'),
  // 右侧: 操作或状态
  trailing: const Icon(Icons.chevron_right),
  // 是否三行（副标题可以更高）
  isThreeLine: false,
  // 紧凑模式
  dense: false,
  // 点击
  onTap: () {},
  // 长按
  onLongPress: () {},
  // 内容内边距
  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
  // 形状（Material 水波纹裁剪）
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
);
```

---

## 2. GridView — 网格滚动

### 2.1 四种构造方式

```dart
// ① GridView.count — 固定列数
GridView.count(
  crossAxisCount: 2,               // 2 列
  childAspectRatio: 0.7,           // 宽高比
  crossAxisSpacing: 12,
  mainAxisSpacing: 12,
  padding: const EdgeInsets.all(16),
  children: books.map((b) => BookCard(book: b)).toList(),
);

// ② GridView.extent — 固定每列最大宽度
GridView.extent(
  maxCrossAxisExtent: 180,         // 每列最大 180px → 自动计算列数
  childAspectRatio: 0.7,
  crossAxisSpacing: 12,
  mainAxisSpacing: 12,
  padding: const EdgeInsets.all(16),
  children: books.map((b) => BookCard(book: b)).toList(),
);

// ③ GridView.builder — 懒加载网格（大量数据）⭐️
GridView.builder(
  padding: const EdgeInsets.all(16),
  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,
    childAspectRatio: 0.65,
    crossAxisSpacing: 12,
    mainAxisSpacing: 12,
  ),
  itemCount: books.length,
  itemBuilder: (context, index) => BookCard(book: books[index]),
);

// ④ GridView.custom — 自定义 delegate（最灵活）
GridView.custom(
  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
    maxCrossAxisExtent: 200,
    childAspectRatio: 0.7,
  ),
  childrenDelegate: SliverChildBuilderDelegate(
    (context, index) => BookCard(book: books[index]),
    childCount: books.length,
  ),
);
```

### 2.2 两种 GridDelegate

| Delegate | 参数 | 列数 | 适用场景 |
|----------|------|------|---------|
| `SliverGridDelegateWithFixedCrossAxisCount` | `crossAxisCount: N` | 固定 N 列 | 手机端——列数不变 |
| `SliverGridDelegateWithMaxCrossAxisExtent` | `maxCrossAxisExtent: W` | 自动 = floor(可用宽/W) | 平板/桌面——列数随窗口大小自适应 |

---

## 3. SingleChildScrollView — 内容溢出时的救兵

```dart
// 场景：一个 Column 的内容可能超出屏幕高度
SingleChildScrollView(
  padding: const EdgeInsets.all(16),
  child: Column(
    children: [
      TextField(...),       // 键盘弹出后内容更高
      SizedBox(height: 400),
      TextField(...),
      SizedBox(height: 400),
      ElevatedButton(...),
    ],
  ),
);
```

**关键陷阱**：

```dart
// ❌ 不要在 SingleChildScrollView 内用 Expanded！
// SingleChildScrollView(
//   child: Column(
//     children: [
//       Expanded(child: Container()),  // ❌ Expanded 需要有限高度
//     ],
//   ),
// );
// SingleChildScrollView 给子 Widget 的是 unbounded 高度约束
// Expanded 需要知道"剩余空间"多大——在 unbounded 约束中无法计算

// ✅ 正确：给 Column 中的内容设置固定高度，或用 LayoutBuilder 手动计算
SingleChildScrollView(
  child: Column(
    children: [
      SizedBox(height: 200, child: Container(color: Colors.red)),
      SizedBox(height: 200, child: Container(color: Colors.blue)),
    ],
  ),
);
```

---

## 4. CustomScrollView + Slivers — 高级滚动

这是 Flutter 滚动系统最强大的部分——Sliver（薄片）协议允许你在同一个滚动容器中混合列表、网格、AppBar、固定头部等。

### 4.1 Sliver 体系全景

```dart
CustomScrollView(
  slivers: [
    // ① SliverAppBar — 可折叠的顶部栏（可浮回/固定）
    SliverAppBar(
      expandedHeight: 250,
      pinned: true,                     // 折叠后标题栏常驻
      floating: false,                  // 向下滚动时立即显示
      snap: false,                      // 配合 floating 使用，松手自动展开
      flexibleSpace: FlexibleSpaceBar(
        title: const Text('Book Title'),
        background: Image.network(coverUrl, fit: BoxFit.cover),
      ),
    ),

    // ② SliverPersistentHeader — 自定义的固定头部
    SliverPersistentHeader(
      pinned: true,
      delegate: _SearchBarDelegate(),    // 自定义 delegate（见下文）
    ),

    // ③ SliverList — 列表
    SliverList.builder(
      itemCount: 50,
      itemBuilder: (context, index) => ListTile(title: Text('Item $index')),
    ),

    // ④ SliverGrid — 网格
    SliverGrid.builder(
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 1.5,
      ),
      itemCount: 20,
      itemBuilder: (context, index) => Card(child: Center(child: Text('Grid $index'))),
    ),

    // ⑤ SliverToBoxAdapter — 在 Sliver 中插入普通 Widget
    SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text('Section Header', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      ),
    ),

    // ⑥ SliverFillRemaining — 填满剩余空间
    SliverFillRemaining(
      hasScrollBody: false,            // 内容不需要滚动
      child: Center(child: Text('No more items')),
    ),
  ],
);
```

### 4.2 SliverAppBar 的四种模式

```dart
// 模式 1：pinned — 折叠后标题保持在顶部（最常用）
SliverAppBar(
  pinned: true,                        // 折叠后标题栏常驻
  expandedHeight: 200,
  flexibleSpace: FlexibleSpaceBar(title: Text('Title'), background: Image(...)),
);
// 行为：向上滚动 → 背景图消失 → 标题栏固定

// 模式 2：floating — 向下滚动立即展开
SliverAppBar(
  floating: true,                      // 向下滚动一点点就显示完整 AppBar
  expandedHeight: 200,
  flexibleSpace: FlexibleSpaceBar(title: Text('Title'), background: Image(...)),
);

// 模式 3：floating + snap — 向下滚动自动吸附展开
SliverAppBar(
  floating: true,
  snap: true,                          // 必须配合 floating
  expandedHeight: 200,
  flexibleSpace: FlexibleSpaceBar(title: Text('Title'), background: Image(...)),
);

// 模式 4：无 pinned/无 floating — 折叠后完全消失（适合不需要常驻标题的场景）
SliverAppBar(
  expandedHeight: 200,
  flexibleSpace: FlexibleSpaceBar(title: Text('Title'), background: Image(...)),
);
```

### 4.3 自定义 SliverPersistentHeaderDelegate

```dart
class _SearchBarDelegate extends SliverPersistentHeaderDelegate {
  @override
  double get minExtent => 60;          // 折叠时最小高度
  @override
  double get maxExtent => 80;          // 展开时最大高度

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    // shrinkOffset: 0 = 完全展开, maxExtent - minExtent = 完全折叠
    // 根据 shrinkOffset 计算动画进度
    final progress = shrinkOffset / (maxExtent - minExtent);

    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      padding: EdgeInsets.only(
        left: 16, right: 16,
        top: lerpDouble(16, 8, progress)!,    // 展开时多 padding，折叠时少 padding
        bottom: lerpDouble(16, 8, progress)!,
      ),
      child: TextField(
        decoration: InputDecoration(
          hintText: '搜索...',
          prefixIcon: const Icon(Icons.search, size: 20),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          isDense: true,
        ),
      ),
    );
  }

  // lerpDouble 辅助函数
  double lerpDouble(double a, double b, double t) => a + (b - a) * t;

  @override
  bool shouldRebuild(covariant _SearchBarDelegate oldDelegate) => false;
}
```

---

## 5. ScrollController — 滚动控制与监听

```dart
class _BookListState extends State<BookList> {
  final _scrollController = ScrollController();
  bool _isLoadingMore = false;

  @override
  void initState() {
    super.initState();
    // ① 监听滚动位置 — 用于"滚动到顶部"按钮
    _scrollController.addListener(() {
      if (_scrollController.offset > 500) {
        setState(() => _showScrollToTop = true);
      } else {
        setState(() => _showScrollToTop = false);
      }
    });

    // ② 监听滚动到底部 — 用于无限滚动分页
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
              _scrollController.position.maxScrollExtent - 200 &&
          !_isLoadingMore) {
        _loadMore();
      }
    });
  }

  // ③ 跳转到指定位置
  void _scrollToTop() {
    _scrollController.animateTo(
      0,                                       // 目标位置
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  // ④ 跳转到指定项
  void _scrollToIndex(int index) {
    final itemHeight = 120.0;
    _scrollController.animateTo(
      index * itemHeight,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();               // ⚠️ 必须 dispose
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: _scrollController,
      itemCount: items.length,
      itemBuilder: (context, index) => ...,
    );
  }
}
```

### 5.1 ScrollController 属性速查

| 属性/方法 | 说明 |
|-----------|------|
| `offset` | 当前滚动偏移量 |
| `position.maxScrollExtent` | 最大可滚动距离 |
| `position.minScrollExtent` | 最小可滚动距离（通常为 0） |
| `position.pixels` | 当前精确位置 |
| `position.viewportDimension` | 视口高度 |
| `animateTo(offset, duration, curve)` | 动画滚动到指定位置 |
| `jumpTo(offset)` | 瞬间跳到指定位置 |
| `position.hasClients` | 检查是否有关联的滚动位置（dispose 后为 false） |
| `position.axis` | 滚动方向 |

---

## 6. 图书馆 App 实战

### 6.1 首页 — GridView.builder + ScrollController

```dart
// lib/screens/home_screen.dart 中的图书网格部分（完善）
class _HomeScreenState extends State<HomeScreen> {
  final _scrollController = ScrollController();
  bool _showScrollToTop = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      if (_scrollController.offset > 500 && !_showScrollToTop) {
        setState(() => _showScrollToTop = true);
      } else if (_scrollController.offset <= 500 && _showScrollToTop) {
        setState(() => _showScrollToTop = false);
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Widget _buildBookGrid() {
    return Expanded(
      child: Stack(
        children: [
          GridView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.65,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: sampleBooks.length,
            itemBuilder: (context, index) => BookCard(
              book: sampleBooks[index],
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => BookDetailScreen(book: sampleBooks[index]),
                  ),
                );
              },
            ),
          ),
          // 滚动到顶部按钮
          if (_showScrollToTop)
            Positioned(
              right: 16,
              bottom: 80,
              child: FloatingActionButton.small(
                onPressed: () {
                  _scrollController.animateTo(
                    0,
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeOut,
                  );
                },
                child: const Icon(Icons.arrow_upward),
              ),
            ),
        ],
      ),
    );
  }
}
```

### 6.2 图书详情页 — SliverAppBar 重构

```dart
// lib/screens/book_detail_screen.dart（基于 Chapter 7 的半成品重构）
class BookDetailScreen extends StatelessWidget {
  final Book book;
  const BookDetailScreen({super.key, required this.book});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // 可折叠的顶部封面
          SliverAppBar(
            expandedHeight: 320,
            pinned: true,
            stretch: true,                    // 下拉拉伸效果（iOS 风格）
            onStretchTrigger: () async {
              // 下拉超过阈值时触发刷新
            },
            flexibleSpace: FlexibleSpaceBar(
              title: Text(
                book.title,
                style: const TextStyle(fontSize: 16),
              ),
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // 封面图或占位
                  book.coverUrl != null
                      ? Image.network(book.coverUrl!, fit: BoxFit.cover)
                      : Container(color: Colors.blueGrey),
                  // 底部渐变遮罩
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black54],
                        stops: [0.5, 1.0],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 图书基本信息
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 作者 + 年份
                  Row(
                    children: [
                      const Icon(Icons.person, size: 16, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text(book.author, style: const TextStyle(fontSize: 16)),
                      const Spacer(),
                      Text('${book.publishYear}', style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // ISBN + 分类
                  _buildInfoChip(Icons.tag, book.isbn),
                  const SizedBox(height: 6),
                  _buildInfoChip(Icons.category, book.category.label),
                  const SizedBox(height: 6),
                  // 评分
                  Row(
                    children: [
                      ...List.generate(5, (i) => Icon(
                        i < book.rating.floor() ? Icons.star : Icons.star_border,
                        size: 20, color: Colors.amber,
                      )),
                      const SizedBox(width: 8),
                      Text(book.rating.toString(), style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  _buildInfoChip(
                    Icons.inventory,
                    '${book.availableCopies} / ${book.totalCopies} 本可借',
                  ),
                  const SizedBox(height: 20),

                  // 图书描述
                  Text('简介', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Text(
                    book.description ?? '暂无简介。',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.6),
                  ),

                  // 标签
                  if (book.tags.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: book.tags.map((tag) => Chip(
                        label: Text(tag, style: const TextStyle(fontSize: 12)),
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        visualDensity: VisualDensity.compact,
                      )).toList(),
                    ),
                  ],

                  const SizedBox(height: 100), // 给底部按钮留空间
                ],
              ),
            ),
          ),
        ],
      ),
      // 底部借阅按钮
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: book.isAvailable ? () {} : null,
            icon: Icon(book.isAvailable ? Icons.bookmark_add : Icons.block),
            label: Text(book.isAvailable ? '借阅此书' : '暂无库存'),
            style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoChip(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey),
        const SizedBox(width: 8),
        Text(text, style: const TextStyle(color: Colors.grey)),
      ],
    );
  }
}
```

---

## 7. 常见错误与最佳实践

```dart
// ❌ 错误 1：ListView 嵌套 ListView（没有限制内部 ListView 的高度）
// ListView(children: [ListView(...)])  // Shrink-wrapping 性能极差
// ✅ 正确：用 Slivers
CustomScrollView(slivers: [SliverList(...), SliverList(...)]);

// ❌ 错误 2：SingleChildScrollView 中用 Expanded
// ✅ 正确：Expanded 只在有限制约束的 Column 中使用（不嵌套在 ScrollView 中）

// ❌ 错误 3：忘记 dispose ScrollController
// ✅ 正确：在 dispose() 中调用 _scrollController.dispose()

// ❌ 错误 4：itemCount 传了空列表的长度但没有处理空态
// ✅ 正确：列表为空时显示 EmptyState Widget，不传空的 GridView/ListView
```

---

## 8. 本章小结

| 你学到了什么 | 对标 Web/CSS | 在图书馆 App 中的体现 |
|-------------|-------------|---------------------|
| ListView 三种构造 | overflow-y: scroll 容器 | 借阅记录列表 |
| GridView 四种构造 | CSS Grid | 首页图书网格 |
| SingleChildScrollView | overflow-y: auto | 表单页面滚动 |
| CustomScrollView + Slivers | 无直接等价 | 详情页可折叠 Header |
| SliverAppBar 四种模式 | position: sticky + 折叠 | 详情页背景折叠 |
| ScrollController | scrollTop + scroll event | 滚动到顶部按钮、分页 |
| SliverPersistentHeader | position: sticky | 搜索栏固定在顶部 |

---

> **下一步**: [Chapter 09 — 表单与用户输入](./Chapter-09-表单与用户输入.md)
> **原始文档**: [flutter.cn/ui/layout/scrolling](https://docs.flutter.cn/ui/layout/scrolling)
