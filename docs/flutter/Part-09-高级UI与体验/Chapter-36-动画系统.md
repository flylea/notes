> **Part**: Part IX | **上一章**: [Ch 35](../Part-08-本地持久化与离线/Chapter-35-离线优先策略.md) | **下一章**: [Ch 37](./Chapter-37-CustomPainter.md)
> **官方文档**: [flutter.cn/ui/animations](https://docs.flutter.cn/ui/animations)

---

# 第 36 章：Flutter 动画系统深度解析

## 0. 本章目标

动画底层原理（Ticker/SchedulerBinding/Tween/Curve/AnimationController 工作流）、隐式动画 8 种 Widget 全覆盖、显式动画（AnimationController + AnimatedBuilder）、Hero 动画、交错动画（Interval + StaggeredAnimation）、动画性能优化。

> 🎯 **Library App 产出**：图书卡片入场交错动画、详情页 Hero 封面过渡、借阅按钮 Loading 动画、AnimatedList 添加/移除、页面 SharedAxisTransition。与 CSS/Framer Motion 对照。

---

## 1. 动画底层四件套

```
Ticker              — 每帧回调（硬件 vsync 信号同步，16ms/帧 = 60fps）
Animation<T>        — 0.0→1.0 的可监听值，含状态（dismissed/forward/reverse/completed）
Tween<T>            — 起点→终点插值器（支持 double/Color/Size/Rect/Offset 等）
Curve               — 变化速率控制（easeIn/Out/InOut/bounce/elastic/linear）
AnimationController — Ticker + Tween + Curve 的组装工厂
```

```dart
// 创建动画控制器
class _PageState extends State<MyPage> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,                             // 垂直同步信号源
    duration: const Duration(milliseconds: 500),
    lowerBound: 0.0,                         // 最小值
    upperBound: 1.0,                         // 最大值
  );
  late final _animation = Tween<double>(begin: 0, end: 300)
      .chain(CurveTween(curve: Curves.easeOut))
      .animate(_controller);

  // 控制
  void _play() => _controller.forward();     // 正向播放
  void _reverse() => _controller.reverse();  // 反向播放
  void _repeat() => _controller.repeat();    // 循环
  void _stop() => _controller.stop();        // 停止

  @override void dispose() { _controller.dispose(); super.dispose(); }
}
```

> **TS 经验**：AnimationController ≈ `useAnimation()` + `animation.play()`。Curve ≈ CSS `transition-timing-function`。Tween ≈ CSS transition 的 `from → to`。

---

## 2. 隐式动画（8 种 Widget）

```dart
// ① AnimatedContainer — 尺寸/颜色/圆角/阴影/边距全部自动过渡
AnimatedContainer(
  duration: const Duration(milliseconds: 300),
  curve: Curves.easeOut,
  width: _expanded ? 200 : 100,
  height: _expanded ? 200 : 100,
  decoration: BoxDecoration(color: _expanded ? Colors.blue : Colors.red, borderRadius: BorderRadius.circular(_expanded ? 20 : 4)),
);

// ② AnimatedOpacity — 透明度
AnimatedOpacity(opacity: _visible ? 1.0 : 0.0, duration: const Duration(milliseconds: 200), child: Text('Fade'));

// ③ AnimatedPadding
AnimatedPadding(padding: EdgeInsets.all(_expanded ? 24 : 8), duration: ..., child: ...);

// ④ AnimatedAlign
AnimatedAlign(alignment: _right ? Alignment.centerRight : Alignment.centerLeft, duration: ..., child: ...);

// ⑤ AnimatedDefaultTextStyle — 文字样式过渡
AnimatedDefaultTextStyle(style: _bold ? TextStyle(fontSize: 24, fontWeight: FontWeight.bold) : TextStyle(fontSize: 16), duration: ..., child: Text('Hello'));

// ⑥ AnimatedCrossFade — 两个 Widget 交叉淡入淡出
AnimatedCrossFade(firstChild: Image.network(url1), secondChild: Image.network(url2), crossFadeState: _showFirst ? CrossFadeState.showFirst : CrossFadeState.showSecond, duration: ...);

// ⑦ AnimatedSwitcher — 子 Widget 切换自动动画
AnimatedSwitcher(duration: ..., child: _currentPage, transitionBuilder: (child, animation) => FadeTransition(opacity: animation, child: child));

// ⑧ TweenAnimationBuilder<T> — 任意值的动画万能工具
TweenAnimationBuilder<double>(tween: Tween(begin: 0, end: _progress), duration: ..., builder: (_, value, __) => LinearProgressIndicator(value: value));
```

---

## 3. 显式动画

```dart
// 借阅按钮——按压回弹动画
class AnimatedBorrowButton extends StatefulWidget { ... }
class _State extends State<AnimatedBorrowButton> with SingleTickerProviderStateMixin {
  late final _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 600));
  late final _scale = Tween<double>(begin: 1.0, end: 0.92).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));

  void _onTap() async {
    await _ctrl.forward();   // 缩小
    _ctrl.reverse();         // 弹回
    widget.onBorrow();
  }

  @override
  Widget build(BuildContext context) => ScaleTransition(scale: _scale, child: FilledButton.icon(onPressed: _onTap, icon: const Icon(Icons.bookmark_add), label: const Text('借阅')));
}
```

## 4. Hero 动画——跨页面共享元素

```dart
// 列表页
Hero(tag: 'book-cover-${book.id}', child: ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.network(book.coverUrl!, fit: BoxFit.cover)));

// 详情页（相同的 tag）
Hero(tag: 'book-cover-${book.id}', child: Image.network(book.coverUrl!, fit: BoxFit.cover, width: double.infinity));

// Flutter 自动：列表页位置 → 飞行 → 详情页位置
```

## 5. 交错动画——图书卡片依次出现

```dart
class StaggeredBookList extends StatefulWidget { ... }
class _State extends State<StaggeredBookList> with SingleTickerProviderStateMixin {
  late final _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, child) => GridView.builder(
        itemCount: books.length,
        itemBuilder: (_, i) {
          final start = i * 0.05;  // 每张卡片比前一张延迟 5%
          final anim = Tween<Offset>(begin: Offset(0, 0.3), end: Offset.zero).animate(
            CurvedAnimation(parent: _ctrl, curve: Interval(start, start + 0.3, curve: Curves.easeOut)));
          return SlideTransition(position: anim, child: FadeTransition(
            opacity: Tween(begin: 0.0, end: 1.0).animate(CurvedAnimation(parent: _ctrl, curve: Interval(start, start + 0.3))),
            child: BookCard(book: books[i])));
        },
      ),
    );
  }
}
```

## 6. 动画性能优化

| 规则 | 做法 |
|------|------|
| 不在 build() 中创建 AnimationController | 在 initState 创建，dispose 释放 |
| 不用 setState 触发动画 | 用 AnimatedBuilder——只重建动画部分 |
| 重动画用 RepaintBoundary | 隔离重绘区域 |
| 离开页面时停止动画 | dispose 中 stop + dispose |

---

## 7. 本章小结

| 类型 | Widget | CSS 对照 |
|------|--------|---------|
| 隐式动画 | AnimatedContainer/Opacity/Padding... | `transition: all 300ms` |
| 显式动画 | AnimationController + AnimatedBuilder | `animation:` CSS + JS 控制 |
| 共享元素 | Hero | 无直接等价——最接近 Shared Element Transition |
| 交错动画 | Interval + CurvedAnimation | CSS animation-delay 串联 |
| 万能 | TweenAnimationBuilder | Framer Motion `useSpring` |

---

> **下一步**: [Ch 37 — CustomPainter](./Chapter-37-CustomPainter.md)
