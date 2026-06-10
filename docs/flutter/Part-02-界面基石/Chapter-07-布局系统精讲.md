> **Part**: Part II — 界面基石：Widget 与布局
> **上一章**: [Chapter 06 — 基础 Widget 全解析](./Chapter-06-基础Widget全解析.md)
> **下一章**: [Chapter 08 — 滚动与列表](./Chapter-08-滚动与列表.md)
> **官方文档**: [flutter.cn/ui/layout](https://docs.flutter.cn/ui/layout) | [flutter.cn/ui/layout/constraints](https://docs.flutter.cn/ui/layout/constraints)

---

# 第 7 章：布局系统精讲

## 0. 本章目标与前置依赖

**前置依赖**：已掌握 Container/Text/Image/Button 等基础 Widget（Chapter 6），理解 Widget 树和 build() 方法（Chapter 5）。

**本章目标**：
- 深入理解 Flutter 布局的核心规则："约束向下传递，尺寸向上传递"
- 掌握 BoxConstraints 的四种类型（tight/loose/unbounded/expanding）
- 精通 Row/Column（主轴/交叉轴对齐、尺寸分配）
- 掌握 Flex/Expanded/Flexible 的弹性空间分配
- 理解 Stack/Positioned 的层叠定位
- 熟悉 Wrap/Align/Padding/SizedBox/AspectRatio 等辅助布局 Widget
- 掌握 MediaQuery 和 LayoutBuilder 的响应式基础
- 建立与 CSS Flexbox 的完整属性对照

> 🎯 **本章会在图书馆 App 中做什么**：构建首页完整布局——顶部搜索栏 + 横向分类 Chips 滚动 + 图书网格 + 底部导航栏；构建图书详情页半成品（Stack 层叠封面 + 信息卡片）。

---

## 1. Flutter 布局核心规则

### 1.1 约束传递规则

Flutter 的布局系统遵循一个简单但深刻的原则：

```
约束向下传递 (Constraints go down)
尺寸向上传递 (Sizes go up)
父节点设置位置 (Parent sets position)
```

具体来说：

```
┌─────────────────────────────────────┐
│  父 Widget                           │
│  ① 给子 Widget 一套约束（Constraints） │
│     "你可以在 0~400px 宽 × 0~600px 高│
│      的范围内"                        │
│  ④ 收到子 Widget 的尺寸后               │
│     把子 Widget 放在自己的空间内       │
├─────────────────────────────────────┤
│  子 Widget                           │
│  ② 根据自身特性和约束，计算自己的尺寸    │
│  ③ 把尺寸报告给父 Widget               │
└─────────────────────────────────────┘
```

这不是"CSS 的盒模型"——在 CSS 中，一个元素可以强制超出父元素（`overflow: visible`）。在 Flutter 中，子 Widget **必须**在父给出的约束范围内——这是强制的。

### 1.2 BoxConstraints

`BoxConstraints` 是 Flutter 布局的核心数据结构：

```dart
// BoxConstraints 定义了四个边界
BoxConstraints({
  this.minWidth = 0.0,      // 最小宽度（默认 0）
  this.maxWidth = double.infinity,  // 最大宽度（默认无限）
  this.minHeight = 0.0,     // 最小高度
  this.maxHeight = double.infinity, // 最大高度
});

// 四种常见约束类型：
// ① tight — min == max（固定尺寸）
BoxConstraints.tight(Size(200, 100));
// 相当于：minWidth=200, maxWidth=200, minHeight=100, maxHeight=100

// ② loose — min=0, max=指定值（宽松约束，子 Widget 可以更小）
BoxConstraints.loose(Size(200, 100));

// ③ unbounded — max=infinity（无限约束）
const BoxConstraints();

// ④ expanding — min=0, max=infinity（填满可用空间）
const BoxConstraints.expand();

// BoxConstraints 的方法：
// .tighten(width, height)  — 创建更紧的约束
// .loosen()                — 创建更松的约束
// .enforce(other)          — 取两者的交集
// .constrain(size)         — 将 Size 限制在约束内
```

> **TS 经验**：BoxConstraints ≈ CSS 中 `min-width` / `max-width` / `min-height` / `max-height` 的组合，但有一个关键区别——Flutter 中**没有**"无约束"的概念（除非显式使用 `unbounded`）。

### 1.3 布局过程可视化

```dart
// 屏幕给 Scaffold:                 "你必须是 390×844"（tight）
// Scaffold 给 AppBar + Body:       "AppBar 高度不限，Body 占剩余空间"
// Body 给 Column:                  "你最大 390×800"
// Column 给子 Widget 1:             "你最大宽 390，高不限"
// 子 Widget 1 返回:                 "我要 390×100"
// Column 给子 Widget 2:             "你最大宽 390，剩余高 700"
// 子 Widget 2 (Expanded) 返回:      "我要 390×700"
// Column 给 Scaffold:               "我的总高是 100+700=800"
```

---

## 2. Row 和 Column — 线性布局

### 2.1 基本属性

```dart
// Row — 水平排列
Row(
  // 主轴（水平）对齐方式
  mainAxisAlignment: MainAxisAlignment.start,      // 默认
  // MainAxisAlignment.end                          // 尾部
  // MainAxisAlignment.center                       // 居中
  // MainAxisAlignment.spaceBetween                 // 两端对齐，中间均匀分布
  // MainAxisAlignment.spaceAround                  // 子项周围均匀分布
  // MainAxisAlignment.spaceEvenly                  // 间距完全均匀

  // 交叉轴（垂直）对齐方式
  crossAxisAlignment: CrossAxisAlignment.center,   // 默认
  // CrossAxisAlignment.start                       // 顶部
  // CrossAxisAlignment.end                         // 底部
  // CrossAxisAlignment.stretch                     // 拉伸填满交叉轴
  // CrossAxisAlignment.baseline                    // 基线对齐（需要 textBaseline）

  // 主轴尺寸
  mainAxisSize: MainAxisSize.max,  // 默认——占据父级给的最大宽度
  // MainAxisSize.min               // 收缩到子项总宽度

  // 文字方向（影响 start/end 的含义）
  textDirection: TextDirection.ltr,

  // 垂直方向
  verticalDirection: VerticalDirection.down,

  children: [
    Icon(Icons.star),
    Text('Item 1'),
    Text('Item 2'),
  ],
);

// Column — 垂直排列（属性与 Row 完全一致，只是主轴方向不同）
Column(
  mainAxisAlignment: MainAxisAlignment.center,     // 现在是垂直居中了
  crossAxisAlignment: CrossAxisAlignment.start,    // 现在是水平对齐了
  children: [...],
);
```

### 2.2 mainAxisAlignment 可视化

```
Row 的 mainAxisAlignment（水平主轴）:

start:        [A][B][C]················
end:          ················[A][B][C]
center:       ·······[A][B][C]·······
spaceBetween: [A]···········[B]···········[C]
spaceAround:  ··[A]······[B]······[C]··
spaceEvenly:  ···[A]···[B]···[C]···
```

### 2.3 crossAxisAlignment 可视化

```
Row 的 crossAxisAlignment（垂直交叉轴）:

start:    [A  ] [B  ] [C  ]     (顶部对齐——B 较矮)
center:   [A  ] [B  ] [C  ]     (居中对齐)
end:      [A  ] [   ] [C  ]     (底部对齐)
                    [B  ]
stretch:  [A  ] [B  ] [C  ]     (拉伸到最高子项的高度)
          [   ] [   ] [   ]
```

### 2.4 与 CSS Flexbox 对照

| CSS | Flutter | 说明 |
|-----|---------|------|
| `display: flex; flex-direction: row` | `Row(...)` | 水平弹性布局 |
| `display: flex; flex-direction: column` | `Column(...)` | 垂直弹性布局 |
| `justify-content: flex-start` | `mainAxisAlignment: MainAxisAlignment.start` | 主轴起始对齐 |
| `justify-content: center` | `mainAxisAlignment: MainAxisAlignment.center` | 主轴居中 |
| `justify-content: space-between` | `mainAxisAlignment: MainAxisAlignment.spaceBetween` | 主轴两端对齐 |
| `align-items: center` | `crossAxisAlignment: CrossAxisAlignment.center` | 交叉轴居中 |
| `align-items: stretch` | `crossAxisAlignment: CrossAxisAlignment.stretch` | 交叉轴拉伸 |

---

## 3. Expanded 和 Flexible — 弹性空间分配

```dart
// Expanded — 占据剩余空间（flex factor 控制比例）
Row(
  children: [
    // ① 固定宽度
    const SizedBox(width: 40, child: Icon(Icons.search)),
    // ② 占据剩余空间
    const Expanded(
      child: TextField(decoration: InputDecoration(hintText: '搜索图书...')),
    ),
    // ③ 固定宽度
    IconButton(icon: const Icon(Icons.filter_list), onPressed: () {}),
  ],
);

// Expanded 的 flex 比例分配
Row(
  children: [
    Expanded(
      flex: 2,               // 占 2 份
      child: Container(color: Colors.red, height: 50),
    ),
    Expanded(
      flex: 1,               // 占 1 份
      child: Container(color: Colors.blue, height: 50),
    ),
    Expanded(
      flex: 1,               // 占 1 份
      child: Container(color: Colors.green, height: 50),
    ),
  ],
);
// 结果：红色占 2/4 = 50% 宽度，蓝色和绿色各占 25%

// Flexible — 比 Expanded 多一个 fit 参数
Flexible(
  flex: 1,
  fit: FlexFit.tight,        // 强制占满分配的空间（= Expanded 的行为）
  // fit: FlexFit.loose,     // 不强制占满——子 Widget 可以小于分配的空间
  child: Container(color: Colors.red, height: 50),
);
```

| Widget | 行为 | 适用场景 |
|--------|------|---------|
| `Expanded` | 强制占满 `flex` 比例分配的全部空间 | 搜索框、列表中的内容区域 |
| `Flexible(fit: FlexFit.tight)` | 等同于 `Expanded` | — |
| `Flexible(fit: FlexFit.loose)` | 分配空间但不强制占满 | 可收缩的内容区域 |

> **TS 经验**：`Expanded(flex: 2)` ≈ CSS `flex: 2`。`Flexible(fit: FlexFit.loose)` 在 CSS 中没有直接等价——它给子 Widget 一个最大尺寸约束但不强制填满。

---

## 4. Stack 和 Positioned — 层叠布局

### 4.1 基础用法

```dart
// Stack — 子 Widget 从底向上层叠
Stack(
  // 未定位子 Widget 的对齐方式
  alignment: Alignment.center,

  // 超出 Stack 边界的子 Widget 的处理
  clipBehavior: Clip.hardEdge,  // 默认——裁剪溢出部分
  // Clip.none                   // 不裁剪（visible）

  children: [
    // ① 底层 — 全尺寸背景
    Container(
      width: 200,
      height: 200,
      color: Colors.blue[100],
    ),
    // ② 中层 — Positioned 精确定位
    Positioned(
      top: 16,
      right: 16,
      child: Container(width: 60, height: 60, color: Colors.red[300]),
    ),
    // ③ 顶层 — 对齐到中心
    const Align(
      alignment: Alignment.center,
      child: Text('居中文字'),
    ),
  ],
);
```

### 4.2 Positioned 的六种定位方式

```dart
Stack(
  children: [
    // ① 四边定位
    Positioned(
      top: 16,
      left: 16,
      right: 16,
      bottom: 16,     // 四边全部指定 → 子 Widget 被拉伸填满
      child: Container(color: Colors.blue),
    ),

    // ② 顶+左（固定尺寸）
    Positioned(
      top: 8,
      left: 8,
      child: Container(width: 40, height: 40, color: Colors.red),
    ),

    // ③ 顶+水平（填满水平空间）
    Positioned(
      top: 0,
      left: 0,
      right: 0,       // 不指定 bottom → 高度由子 Widget 自身决定
      child: Container(height: 56, color: Colors.black54),
    ),

    // ④ 百分比定位（Positioned.fill）
    Positioned.fill(
      child: Container(color: Colors.black12),
    ),

    // ⑤ 基于尺寸的偏移
    PositionedDirectional(
      start: 16,
      top: 16,
      child: Container(width: 40, height: 40, color: Colors.green),
    ),
  ],
);
```

### 4.3 典型模式：图片 + 叠加文字

```dart
Stack(
  children: [
    // 底层图片
    Image.network(coverUrl, width: double.infinity, height: 200, fit: BoxFit.cover),
    // 底部渐变遮罩 + 文字
    Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.transparent, Colors.black54],
          ),
        ),
        child: const Text('书名', style: TextStyle(color: Colors.white, fontSize: 20)),
      ),
    ),
    // 左上角返回按钮
    Positioned(
      top: MediaQuery.of(context).padding.top,  // 避开状态栏
      left: 8,
      child: IconButton(
        icon: const Icon(Icons.arrow_back),
        color: Colors.white,
        onPressed: () => Navigator.of(context).pop(),
      ),
    ),
  ],
);
```

---

## 5. Wrap — 自动换行布局

```dart
// Wrap — Row 的升级版：子项超出宽度时自动换行
Wrap(
  // 水平间距
  spacing: 8,
  // 垂直间距
  runSpacing: 4,
  // 主轴对齐（同 Row）
  alignment: WrapAlignment.start,
  // 每行的对齐
  runAlignment: WrapAlignment.start,
  // 文本方向
  textDirection: TextDirection.ltr,

  children: [
    _buildChip('小说'),
    _buildChip('科学'),
    _buildChip('技术'),
    _buildChip('历史'),
    _buildChip('哲学'),
    _buildChip('艺术'),
    _buildChip('计算机科学'),
    _buildChip('人工智能'),
    _buildChip('数据库'),
  ],
);

// _buildChip 辅助方法
Widget _buildChip(String label) {
  return Chip(
    label: Text(label),
    avatar: const Icon(Icons.category, size: 16),
  );
}
```

---

## 6. 辅助布局 Widget

### 6.1 Padding

```dart
// EdgeInsets — 内边距的四种构造方式
// ① 四边相同
Padding(padding: const EdgeInsets.all(16), child: Text('Hello'));

// ② 对称
Padding(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), child: Text('Hello'));

// ③ 分别指定
Padding(padding: const EdgeInsets.only(left: 16, top: 8, right: 24, bottom: 4), child: Text('Hello'));

// ④ 零边距
const EdgeInsets.zero;
```

### 6.2 SizedBox

```dart
// SizedBox — 固定尺寸的盒子（三种用途）
// ① 给子 Widget 强加固定尺寸
SizedBox(width: 100, height: 50, child: Text('Limited'));

// ② 充当固定间距（无 child 时）
const SizedBox(height: 16);  // 16px 垂直间距
const SizedBox(width: 24);   // 24px 水平间距

// ③ 强制填满父容器
SizedBox.expand(child: Text('Fill parent'));
// 等同于 SizedBox(width: double.infinity, height: double.infinity)
```

### 6.3 Align 和 Center

```dart
// Align — 将子 Widget 对齐到指定位置
Align(
  alignment: Alignment.topRight,       // 右上角
  // Alignment(-1, -1) → topLeft    // 左上角 (-1,-1)
  // Alignment(0, 0)   → center     // 中心 (0,0)
  // Alignment(1, 1)   → bottomRight // 右下角 (1,1)
  // Alignment(0.5, -0.5)            // 自定义
  child: Container(width: 50, height: 50, color: Colors.red),
);

// Center — Align(alignment: Alignment.center) 的便捷版本
Center(child: Text('居中'));
```

### 6.4 AspectRatio

```dart
// AspectRatio — 固定宽高比
AspectRatio(
  aspectRatio: 3 / 4,            // 宽:高 = 3:4（图书封面比例）
  child: Image.network(coverUrl, fit: BoxFit.cover),
);
```

---

## 7. MediaQuery 和 LayoutBuilder — 响应式基础

### 7.1 MediaQuery

```dart
// MediaQuery — 获取屏幕和设备信息
@override
Widget build(BuildContext context) {
  final mediaQuery = MediaQuery.of(context);
  final screenWidth = mediaQuery.size.width;
  final screenHeight = mediaQuery.size.height;
  final pixelRatio = mediaQuery.devicePixelRatio;
  final padding = mediaQuery.padding;            // 状态栏/底部导航栏高度
  final orientation = mediaQuery.orientation;    // portrait / landscape
  final textScale = mediaQuery.textScaleFactor;   // 系统字体缩放比例

  return Container(
    width: screenWidth * 0.9,    // 屏幕宽度的 90%
    padding: EdgeInsets.only(top: padding.top),  // 避开状态栏
    child: Text('Screen: ${screenWidth}x$screenHeight'),
  );
}
```

### 7.2 LayoutBuilder

```dart
// LayoutBuilder — 根据父 Widget 给出的约束做自适应
@override
Widget build(BuildContext context) {
  return LayoutBuilder(
    builder: (context, constraints) {
      // constraints.maxWidth 是当前可用宽度
      if (constraints.maxWidth < 600) {
        // 小屏幕——单列布局
        return _buildCompactLayout();
      } else if (constraints.maxWidth < 900) {
        // 中等屏幕——双列布局
        return _buildMediumLayout();
      } else {
        // 大屏幕——三列布局
        return _buildExpandedLayout();
      }
    },
  );
}
```

> **TS 经验**：`MediaQuery` ≈ `window.innerWidth/innerHeight` + 系统信息。`LayoutBuilder` ≈ CSS Container Query——根据父容器宽度而非屏幕宽度做自适应。

### 7.3 MediaQuery vs LayoutBuilder 选择

| 需求 | 用什么 | 原因 |
|------|--------|------|
| 根据屏幕宽度决定 | `MediaQuery` | 屏幕级信息 |
| 根据可用空间决定 | `LayoutBuilder` | 父级可能不是全屏（如 Drawer 内、Dialog 内） |
| 获取状态栏高度 | `MediaQuery.padding` | LayoutBuilder 不提供 |
| 获取设备像素比 | `MediaQuery.devicePixelRatio` | LayoutBuilder 不提供 |
| 获取约束信息 | `LayoutBuilder` | 直接拿到 BoxConstraints |

---

## 8. 图书馆 App 实战

### 8.1 首页完整布局

```dart
// lib/screens/home_screen.dart — 重构版本
import 'package:flutter/material.dart';
import '../models/book.dart';
import '../data/sample_books.dart';
import '../widgets/book_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  String? _selectedCategory;

  // 从测试数据中提取分类列表
  static const _categories = ['全部', '小说', '科学', '技术', '历史'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: _buildAppBar(),
      body: SafeArea(
        child: Column(
          children: [
            _buildSearchBar(),         // 搜索栏
            _buildCategoryChips(),     // 横向分类筛选
            _buildBookGrid(),          // 图书网格（Expanded 自动填满剩余空间）
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomNav(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
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
        IconButton(icon: const Icon(Icons.search), onPressed: () {}),
        PopupMenuButton<String>(
          onSelected: (v) => debugPrint('排序: $v'),
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'title', child: Text('按书名排序')),
            const PopupMenuItem(value: 'author', child: Text('按作者排序')),
            const PopupMenuItem(value: 'rating', child: Text('按评分排序')),
          ],
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: TextField(
        decoration: InputDecoration(
          hintText: '搜索图书、作者或 ISBN...',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: IconButton(
            icon: const Icon(Icons.clear),
            onPressed: () {},
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          filled: true,
          fillColor: Theme.of(context).colorScheme.surfaceContainerHighest,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = _categories[index];
          final isSelected = _selectedCategory == category;
          return FilterChip(
            label: Text(category),
            selected: isSelected,
            onSelected: (selected) {
              setState(() => _selectedCategory = selected ? category : null);
            },
          );
        },
      ),
    );
  }

  Widget _buildBookGrid() {
    // 根据分类筛选
    final filteredBooks = _selectedCategory == null
        ? sampleBooks
        : sampleBooks.where((b) => b.category.label == _selectedCategory).toList();

    if (filteredBooks.isEmpty) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey),
            SizedBox(height: 8),
            Text('该分类下暂无图书', style: TextStyle(color: Colors.grey)),
          ],
        ),
      );
    }

    return Expanded(
      child: LayoutBuilder(
        builder: (context, constraints) {
          // 根据宽度自适应列数
          final crossAxisCount = constraints.maxWidth > 600 ? 3 : 2;
          final aspectRatio = constraints.maxWidth > 600 ? 0.6 : 0.65;

          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: crossAxisCount,
              childAspectRatio: aspectRatio,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            itemCount: filteredBooks.length,
            itemBuilder: (context, index) {
              return BookCard(
                book: filteredBooks[index],
                onTap: () => debugPrint('打开: ${filteredBooks[index].title}'),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildBottomNav() {
    return NavigationBar(
      selectedIndex: _currentIndex,
      onDestinationSelected: (i) => setState(() => _currentIndex = i),
      destinations: const [
        NavigationDestination(icon: Icon(Icons.library_books_outlined), selectedIcon: Icon(Icons.library_books), label: '图书'),
        NavigationDestination(icon: Icon(Icons.swap_horiz_outlined), selectedIcon: Icon(Icons.swap_horiz), label: '借阅'),
        NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: '我的'),
      ],
    );
  }
}
```

### 8.2 图书详情页半成品（Stack 布局）

```dart
// lib/screens/book_detail_screen.dart
import 'package:flutter/material.dart';
import '../models/book.dart';

class BookDetailScreen extends StatelessWidget {
  final Book book;
  const BookDetailScreen({super.key, required this.book});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // SliverAppBar — 可折叠的顶部区域（Chapter 8 详解）
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  // 封面大图 + 暗色遮罩
                  Container(color: Colors.grey[300]),
                  Positioned.fill(
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Colors.black87],
                          stops: [0.4, 1.0],
                        ),
                      ),
                    ),
                  ),
                  // 书名 + 作者在底部
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 16,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          book.title,
                          style: const TextStyle(
                            color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${book.author} · ${book.publishYear}',
                          style: const TextStyle(color: Colors.white70, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                  // 返回按钮（左上角）
                  Positioned(
                    top: MediaQuery.of(context).padding.top,
                    left: 4,
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back),
                      color: Colors.white,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),
                ],
              ),
            ),
          ),
          // 详细信息（Chapter 8 完善为 SliverList）
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildInfoRow('ISBN', book.isbn),
                  _buildInfoRow('分类', book.category.label),
                  _buildInfoRow('评分', '${book.rating} / 5.0'),
                  _buildInfoRow('库存', '${book.availableCopies} / ${book.totalCopies} 本可借'),
                  const SizedBox(height: 16),
                  Text(book.description ?? '暂无简介', style: Theme.of(context).textTheme.bodyLarge),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            onPressed: () {},
            icon: const Icon(Icons.bookmark_add),
            label: const Text('借阅此书'),
            style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(width: 60, child: Text(label, style: const TextStyle(color: Colors.grey))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
```

---

## 9. 常见错误与最佳实践

### 9.1 常见错误

```dart
// ❌ 错误 1：Row 中的子 Widget 没有约束 → 溢出
// Row(children: [Text('a' * 5000)]) // 文字超长 → 黑黄条纹溢出警告
// ✅ 解决：Expanded 包裹
Row(children: [Expanded(child: Text('a' * 5000))]);

// ❌ 错误 2：Column 中的子项总和超过屏幕高度 → 溢出
// Column(children: [Container(height: 5000, ...)])
// ✅ 解决：Expanded + ListView 或 SingleChildScrollView
Column(children: [Expanded(child: ListView(...))]);

// ❌ 错误 3：Row 的 crossAxisAlignment: stretch 无效
// Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [...])
// 因为 Row 的高度由最高的子 Widget 决定——stretch 没有额外空间可分配
// ✅ 正确：给 Row 固定的高度或用 IntrinsicHeight
IntrinsicHeight(child: Row(children: [...]) // 子项可以 stretch 了

// ❌ 错误 4：忘记 SafeArea
// Scaffold(body: Column(...)) — 内容可能被状态栏/底部 Home 指示条遮挡
// ✅ 正确：
Scaffold(body: SafeArea(child: Column(...)));
```

### 9.2 最佳实践

1. **布局优先用 Column + Expanded，而不是计算高度**——让 Flutter 的约束系统自动计算
2. **Spacer() 是空的 Expanded**——`Spacer(flex: 1)` = `Expanded(flex: 1, child: SizedBox.shrink())`，用于在 Row/Column 中产生弹性间距
3. **Grid 比 Wrap 更可控**——能确定列数时用 GridView，不能时用 Wrap
4. **LayoutBuilder 优于 MediaQuery（如果父级不是全屏）**——在 Dialog、Drawer 等场景中，LayoutBuilder 给出的是实际可用空间

---

## 10. 本章小结

| 你学到了什么 | 对标 CSS | 在图书馆 App 中的体现 |
|-------------|---------|---------------------|
| 约束向下/尺寸向上规则 | 盒模型 + Flexbox | 理解布局行为的基础 |
| Row/Column + mainAxisAlignment/crossAxisAlignment | flex-direction + justify-content + align-items | 搜索栏布局、信息行 |
| Expanded/Flexible | flex: N | 搜索框填满剩余空间 |
| Stack/Positioned | position: absolute + top/left/right/bottom | 详情页封面叠加 |
| Wrap | flex-wrap: wrap | 分类标签流式排列 |
| MediaQuery/LayoutBuilder | @media query / container query | 图书网格响应式列数 |
| SafeArea | env(safe-area-inset-*) | 避开状态栏和底部指示条 |

---

> **下一步**: [Chapter 08 — 滚动与列表](./Chapter-08-滚动与列表.md)
> **原始文档**: [flutter.cn/ui/layout](https://docs.flutter.cn/ui/layout) | [flutter.cn/ui/layout/constraints](https://docs.flutter.cn/ui/layout/constraints)
