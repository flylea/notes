# 第 42 章：Flutter 动画系统深度解析

## 0. 本章目标

- 理解 Flutter 动画的底层机制：Ticker → AnimationController → Tween → Curve 四件套的工作流
- 掌握隐式动画与显式动画的区别、选择决策框架
- 能独立实现 Hero 共享元素过渡、交错入场动画
- 能使用 `TweenAnimationBuilder` 创建自定义动画
- 知道如何避免常见的动画性能陷阱

> **前置依赖**: [Ch06 — StatefulWidget 生命周期](../Part-02-界面基石/Chapter-06-Widget哲学.md)（`initState`/`dispose`/`SingleTickerProviderStateMixin`）
>
> 🎯 **Library App 产出**：图书卡片交错入场动画、详情页 Hero 封面过渡、借阅按钮弹性回弹动画、AnimatedList 添加/移除动画、搜索栏展开/收起动画。

---

## 1. 动画底层机制：四件套

### 1.1 动画是如何运行的？

Flutter 动画的每一帧背后都有一套精密的协作机制：

```
硬件显示屏（60Hz/120Hz）
    ↓ 发出 vsync 信号
SchedulerBinding（Flutter 帧调度器）
    ↓ 调用所有注册的 Ticker 回调
Ticker（节拍器——每帧触发一次）
    ↓ 调用 AnimationController._tick()
AnimationController（时间控制器）
    ↓ elapsed = 当前时间 - 开始时间
    ↓ value = Curve.transform(elapsed / duration)  // 0.0 → 1.0
    ↓ value 传给 Tween.transform(value)             // 0.0→1.0 映射为 begin→end
Animation<T>（最终值）
    ↓ addListener 回调 → setState → build
Widget 重建（看到动画效果）
```

**关键认知**：动画不是"值的变化"，而是**帧序列的快照**。`AnimationController` 在每一帧计算当前时间对应的值（0.0→1.0），`Tween` 把这个 0.0→1.0 映射到你需要的范围（比如 0→300px），最后通过 `setState` 或 `AnimatedBuilder` 触发 Widget 重建。

### 1.2 Ticker — 动画的时钟

`Ticker` 是 Flutter 动画的时钟源。它通过 `SchedulerBinding` 注册到 vsync 信号，**每帧回调一次**。

- 60Hz 屏幕：每 16ms 触发一次
- 120Hz 屏幕（ProMotion）：每 8ms 触发一次

> 通俗类比：Ticker 像健身房教练的**节拍器**——每隔固定时间喊一次"下一拍"，`AnimationController` 听到节拍就知道该计算新的动画值了。`vsync` 是手机屏幕硬件发出的原始信号，Ticker 是这个信号的"接收器"。

`SingleTickerProviderStateMixin` 让你的 `State` 类能够**提供** Ticker 给 `AnimationController` 使用。

### 1.3 AnimationController — 时间线控制器

```dart
class _PageState extends State<MyPage> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,                               // 由当前 State 提供 vsync 信号
    duration: const Duration(milliseconds: 500), // 动画持续时间
    lowerBound: 0.0,                            // 最小值
    upperBound: 1.0,                            // 最大值
  );

  // _controller.value: 0.0 → 1.0 (随时间线性变化)
  // _controller.status: dismissed / forward / reverse / completed
}
```

**状态机**：

```
dismissed  →  forward()  →  completed
completed  →  reverse()  →  dismissed

中途调用 stop() → 停在当前值
中途调用 reset() → 回到 dismissed
```

```dart
// 控制方法
_controller.forward();           // 正向播放（0→1）
_controller.reverse();           // 反向播放（1→0）
_controller.repeat();            // 循环播放
_controller.repeat(reverse: true); // 来回循环
_controller.animateTo(0.5);      // 播放到指定值
_controller.animateBack(0.3);    // 反向播放到指定值
_controller.reset();             // 重置到 lowerBound
_controller.stop();              // 停止但不重置
```

### 1.4 Tween — 值区间映射

`Tween<T>`（补间）定义了 **begin→end 的插值规则**。Flutter 内置了多种 Tween：

```dart
Tween<double>(begin: 0, end: 300);       // 数值
ColorTween(begin: Colors.red, end: Colors.blue); // 颜色
SizeTween(begin: Size(100, 100), end: Size(200, 300)); // 尺寸
RectTween(begin: ..., end: ...);          // 矩形
AlignmentTween(begin: ..., end: ...);     // 对齐
BorderRadiusTween(begin: ..., end: ...);  // 圆角
```

**自定义 Tween**：

```dart
class ShadowTween extends Tween<BoxShadow> {
  ShadowTween({required BoxShadow begin, required BoxShadow end}) : super(begin: begin, end: end);

  @override
  BoxShadow lerp(double t) {
    return BoxShadow(
      color: Color.lerp(begin!.color, end!.color, t)!,
      offset: Offset.lerp(begin!.offset, end!.offset, t)!,
      blurRadius: lerpDouble(begin!.blurRadius, end!.blurRadius, t)!,
    );
  }
}
```

### 1.5 Curve — 速度曲线

`Curve` 控制动画值随时间变化的**速度节奏**，而非终值。

```dart
// 可视化理解（值为纵轴，时间为横轴）：
//
// Curves.linear        — 匀速直线  /
// Curves.easeIn         — 慢→快    _/
// Curves.easeOut        — 快→慢    ‾\
// Curves.easeInOut      — 慢→快→慢  S 形
// Curves.bounceOut      — 弹跳结束
// Curves.elasticOut     — 弹性结束
// Curves.decelerate     — 减速

_animation = Tween<double>(begin: 0, end: 300)
    .chain(CurveTween(curve: Curves.easeOut))  // chain：先做 Tween 映射，再套速度曲线
    .animate(_controller);
```

> **CSS 对照**：`Curves.easeOut` ≈ `transition-timing-function: ease-out`。`Tween` ≈ `transition` 的 `from → to`。两者的区别在于：CSS transition 是由浏览器在 compositor 线程自动处理的（几乎不消耗主线程），而 Flutter 动画在每帧都需要通过 Dart 代码更新并 rebuild Widget——这就是为什么动画性能优化（`RepaintBoundary`）如此重要。

---

## 2. 隐式动画 vs 显式动画：决策框架

### 2.1 什么时候用隐式动画？

> **隐式动画** = Flutter 帮你管理 AnimationController，你只需要告诉它"目标值变了"

**适用条件**：
- 动画比较简单（属性过渡：尺寸、颜色、透明度、位置）
- 动画方向单一（从 A 到 B，不需要反向控制）
- 不需要监听动画中间状态
- 不需要与其他动画协同

```dart
// ① AnimatedContainer — 最常用的隐式动画
AnimatedContainer(
  duration: const Duration(milliseconds: 300),
  curve: Curves.easeOut,
  width: _expanded ? 300 : 100,
  height: _expanded ? 200 : 100,
  decoration: BoxDecoration(
    color: _expanded ? Colors.blue : Colors.red,
    borderRadius: BorderRadius.circular(_expanded ? 20 : 4),
  ),
  child: const Text('Tap me'),
)

// ② AnimatedOpacity — 淡入淡出
AnimatedOpacity(
  opacity: _visible ? 1.0 : 0.0,
  duration: const Duration(milliseconds: 200),
  child: const Text('Fade me'),
)

// ③ AnimatedPadding — 间距过渡
AnimatedPadding(
  padding: EdgeInsets.all(_expanded ? 24 : 8),
  duration: const Duration(milliseconds: 300),
  child: ...,
)

// ④ AnimatedAlign — 对齐过渡
AnimatedAlign(
  alignment: _isRight ? Alignment.centerRight : Alignment.centerLeft,
  duration: const Duration(milliseconds: 300),
  child: ...,
)

// ⑤ AnimatedDefaultTextStyle — 文字样式过渡
AnimatedDefaultTextStyle(
  style: _active
      ? const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black)
      : const TextStyle(fontSize: 16, fontWeight: FontWeight.normal, color: Colors.grey),
  duration: const Duration(milliseconds: 200),
  child: const Text('Hello'),
)

// ⑥ AnimatedCrossFade — 两个 Widget 交叉淡入淡出
AnimatedCrossFade(
  firstChild: const FirstView(),
  secondChild: const SecondView(),
  crossFadeState: _showFirst ? CrossFadeState.showFirst : CrossFadeState.showSecond,
  duration: const Duration(milliseconds: 500),
)

// ⑦ AnimatedSwitcher — 子 Widget 切换自动动画
AnimatedSwitcher(
  duration: const Duration(milliseconds: 300),
  child: _currentPage,
  transitionBuilder: (child, animation) =>
      FadeTransition(opacity: animation, child: child),
)

// ⑧ TweenAnimationBuilder<T> — 万能隐式动画
TweenAnimationBuilder<double>(
  tween: Tween(begin: 0, end: _progress),
  duration: const Duration(milliseconds: 500),
  builder: (_, value, __) => LinearProgressIndicator(value: value),
)
```

### 2.2 什么时候用显式动画？

> **显式动画** = 你手动创建和管理 AnimationController，完全控制播放

**适用条件**：
- 需要手动控制播放（play/pause/reverse/repeat）
- 需要监听动画状态和值变化
- 多个动画需要协同（交错、串联）
- 动画需要与用户交互绑定（如跟随拖拽）

```dart
class _BorrowButtonState extends State<BorrowButton>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  );
  late final _scale = Tween<double>(begin: 1.0, end: 0.92)
      .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

  Future<void> _onTap() async {
    await _controller.forward();   // 缩小
    _controller.reverse();         // 弹回 → 不需要 await，让用户看到回弹
    widget.onBorrow();             // 不等回弹结束就执行业务逻辑
  }

  @override
  void dispose() {
    _controller.dispose();  // 必须 dispose！
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _scale,         // 只监听 _scale 变化
      builder: (_, child) => Transform.scale(
        scale: _scale.value,
        child: child,
      ),
      child: FilledButton.icon(  // ← 这个 child 不会因动画而重建！
        onPressed: _onTap,
        icon: const Icon(Icons.bookmark_add),
        label: const Text('借阅'),
      ),
    );
  }
}
```

> **AnimatedBuilder 的 child 参数是关键优化**：传给 `builder` 的 `child` 是预先构建好的，动画过程中不会重建，只有 `builder` 回调中的 Widget 每帧重建。这类似于在 Vue/React 中把不变的部分缓存在 `v-once`/`React.memo` 里。

### 2.3 决策流程图

```
需要动画？
├── 属性过渡（尺寸/颜色/透明度）→ 隐式动画 (AnimatedFoo)
├── 需要手动控制（play/reverse/repeat）→ 显式动画 (AnimationController)
├── 页面间共享元素过渡 → Hero
├── 多个 item 依次出现 → 交错动画 (Interval)
└── 任意值动画 + 代码简洁优先 → TweenAnimationBuilder
```

---

## 3. Hero — 共享元素过渡

Hero 动画让同一个元素在两个页面之间平滑飞行。Flutter 自动处理：源位置 → 飞行路径 → 目标位置。

**使用条件**：两个 Hero Widget 必须有**相同的 tag**。

```dart
// 列表页 —— 每个封面都有唯一的 Hero tag
Hero(
  tag: 'book-cover-${book.id}',
  child: ClipRRect(
    borderRadius: BorderRadius.circular(8),
    child: CachedNetworkImage(
      imageUrl: book.coverUrl!,
      fit: BoxFit.cover,
      width: 120,
      height: 180,
    ),
  ),
)

// 详情页 —— 相同的 tag，Flutter 自动匹配
Hero(
  tag: 'book-cover-${book.id}',
  child: CachedNetworkImage(
    imageUrl: book.coverUrl!,
    fit: BoxFit.cover,
    width: double.infinity,
    height: 300,
  ),
)
```

**Hero 的局限**：
- Tag 必须在当前路由树中唯一
- 两个 Hero 需要是"同一类型的元素"（列表项→详情头部），否则看起来奇怪
- 如果图片尚未加载完成就触发 Hero，会出现短暂的空白

---

## 4. 交错动画 — 多个动画依次执行

交错动画让多个子 Widget 依次入场，比所有 Widget 同时飞入更有设计感。

**核心思路**：用一个 `AnimationController` 驱动多个子动画，每个子动画用 `Interval` 指定它在总时间线中的位置。

```dart
class StaggeredBookGrid extends StatefulWidget {
  final List<Book> books;
  // ...
}

class _StaggeredBookGridState extends State<StaggeredBookGrid>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _controller.forward(); // 页面出现时自动播放
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _buildAnimatedCard(Book book, int index, int total) {
    final itemFraction = 1.0 / total;                      // 每个 item 占据总时长的份额
    final start = index * itemFraction * 0.5;               // 每张卡片起始点错开
    final end = (start + itemFraction * 0.8).clamp(0.0, 1.0); // 结束点

    final slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.4),  // 从下方 40% 处开始
      end: Offset.zero,              // 滑到原位
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Interval(start, end, curve: Curves.easeOut),
    ));

    final fadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: Interval(start, end, curve: Curves.easeIn),
      ),
    );

    return SlideTransition(
      position: slideAnim,
      child: FadeTransition(
        opacity: fadeAnim,
        child: BookCard(book: book),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) => GridView.builder(
        itemCount: widget.books.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.7,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
        ),
        itemBuilder: (_, i) => RepaintBoundary(
          child: _buildAnimatedCard(widget.books[i], i, widget.books.length),
        ),
      ),
    );
  }
}
```

> **Interval 的三个参数**：`Interval(begin, end, curve)` — `begin` 和 `end` 是 0.0→1.0 的时间位置，表示该子动画在总时间线的哪一段执行。`curve` 控制这一段内部的速率曲线。

---

## 5. Library App 实战：四个动画场景

### 5.1 搜索栏展开/收起

```dart
class AnimatedSearchBar extends StatefulWidget { ... }

class _AnimatedSearchBarState extends State<AnimatedSearchBar> {
  bool _isExpanded = false;
  final _controller = TextEditingController();

  void _toggle() => setState(() => _isExpanded = !_isExpanded);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOutBack,  // 弹性感
          width: _isExpanded ? 250 : 48,
          height: 48,
          child: _isExpanded
              ? TextField(
                  controller: _controller,
                  autofocus: true,
                  decoration: const InputDecoration(
                    hintText: '搜索图书...',
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 16),
                  ),
                )
              : const SizedBox.shrink(),
        ),
        IconButton(
          icon: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: Icon(
              _isExpanded ? Icons.close : Icons.search,
              key: ValueKey(_isExpanded),
            ),
          ),
          onPressed: _toggle,
        ),
      ],
    );
  }
}
```

### 5.2 筛选面板展开动画

```dart
AnimatedCrossFade(
  firstChild: const SizedBox(height: 0),
  secondChild: Container(
    height: 200,
    child: const FilterPanelContent(),
  ),
  crossFadeState: _showFilters
      ? CrossFadeState.showSecond
      : CrossFadeState.showFirst,
  duration: const Duration(milliseconds: 300),
)
```

### 5.3 列表项添加/移除（AnimatedList）

```dart
final _listKey = GlobalKey<AnimatedListState>();

void _addBook(Book book) {
  _books.insert(0, book);
  _listKey.currentState?.insertItem(0, duration: const Duration(milliseconds: 500));
}

void _removeBook(int index) {
  final removed = _books.removeAt(index);
  _listKey.currentState?.removeItem(
    index,
    (context, animation) => SizeTransition(
      sizeFactor: animation,
      child: FadeTransition(
        opacity: animation,
        child: BookCard(book: removed),
      ),
    ),
    duration: const Duration(milliseconds: 300),
  );
}
```

### 5.4 页面切换动画

```dart
// 在 GoRouter 配置中自定义页面过渡
GoRoute(
  path: '/book/:id',
  pageBuilder: (context, state) => CustomTransitionPage(
    key: state.pageKey,
    child: const BookDetailScreen(),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(1.0, 0),   // 从右侧滑入
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut)),
        child: child,
      );
    },
  ),
)
```

---

## 6. 常见错误与最佳实践

### 6.1 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|---------|
| ❌ `AnimationController` 忘记 `dispose()` | 内存泄漏 + Ticker 永不停止 = 电池消耗 | 始终在 `dispose()` 中 `_controller.dispose()` |
| ❌ 在 `build()` 中创建 `AnimationController` | 每帧创建新 Controller，内存飙升 + 动画错乱 | 在 `initState` 创建 |
| ❌ 用 `setState` 触发动画帧（非 `AnimatedBuilder`） | 整棵 Widget 树每帧重建 | 用 `AnimatedBuilder` 隔离重建范围 |
| ❌ 隐式动画的 `duration` 设为 0 或不设 | 动画不生效（瞬变） | 始终设 `duration` > 0 |
| ❌ Hero tag 在多处重复 | 运行时崩溃（Hint: tag 冲突） | 使用唯一标识：`'book-${book.id}'` |
| ❌ 没有 `RepaintBoundary` 的独立动画 | 动画触发兄弟 Widget 不必要的重绘 | 动画 Widget 包裹 `RepaintBoundary` |

### 6.2 最佳实践

1. **隐式优先**：能用 `AnimatedFoo` 解决的，不写 `AnimationController`
2. **AnimatedBuilder + child 隔离**：把不变的子树传给 `child` 参数
3. **`dispose` 检查清单**：每个 `AnimationController` 和 `ScrollController` 都需要 dispose
4. **vsync 只拿一个**：如果只有一个 Controller，用 `SingleTickerProviderStateMixin`；多 Controller 用 `TickerProviderStateMixin`
5. **Curve 不是可选的**：`Curves.linear` 的动画看起来机械，`easeOut` 才有自然感
6. **动画时间 300-500ms 为宜**：短于 200ms 太突然，长于 1000ms 让用户等待

---

## 7. 本章小结

| 类型 | 核心 Widget | 控制方式 | CSS/JS 对照 |
|------|-----------|---------|-----------|
| 隐式动画 | `AnimatedContainer` / `AnimatedOpacity` / ... | 改变属性值自动过渡 | `transition: all 300ms` |
| 显式动画 | `AnimationController` + `AnimatedBuilder` | 手动 forward/reverse/stop | JS `requestAnimationFrame` + 手动插值 |
| 万能隐式 | `TweenAnimationBuilder` | 改变 tween 的值自动过渡 | Framer Motion `useSpring` |
| 共享元素 | `Hero` | tag 匹配自动飞行 | 无直接 CSS 等价物 |
| 交错动画 | `Interval` + `CurvedAnimation` | 一个 Controller 驱动多段 | CSS `animation-delay` 串联 |
| 动画列表 | `AnimatedList` | insertItem/removeItem | Vue `<TransitionGroup>` |

---

## 8. 本章练习

**练习 1：搜索栏弹性展开动画**

为 Library App 的搜索栏添加展开/收起动画：默认宽度 48px（只显示搜索图标），点击后宽度过渡到 250px。使用 `Curves.easeOutBack` 曲线（会超出目标值再回弹，产生弹性感）。用 `AnimatedSwitcher` 切换搜索图标和关闭图标。

**练习 2：图书卡片交错入场**

实现首页图书卡片的交错入场动画：6 张卡片从下方偏移 0.4 处开始，透明度从 0 开始。每张比前一张延迟 60ms，通过 `Interval` + `SlideTransition` + `FadeTransition` 组合实现。用 `RepaintBoundary` 包裹每张卡片。

**练习 3：列表页→详情页 Hero 过渡**

在 Library App 的列表页封面缩略图和详情页封面大图之间实现 Hero 动画。tag 使用 `bookCover-${book.id}` 格式。确保图片加载状态下的过渡体验（placeholder 期间也能触发 Hero）。

验证标准：以上三个练习在 Profile 模式下测试，帧率稳定在 60fps，无明显的跳变或闪烁。

---

> **下一步**: [Chapter 43 — CustomPainter](./Chapter-43-CustomPainter.md)
> 📖 **延伸阅读**: [Flutter 动画概览](https://docs.flutter.dev/ui/animations) | [Hero 动画](https://docs.flutter.dev/ui/animations/hero-animations) | [TweenAnimationBuilder](https://api.flutter.dev/flutter/widgets/TweenAnimationBuilder-class.html)
