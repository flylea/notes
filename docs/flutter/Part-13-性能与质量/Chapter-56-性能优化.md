# 第 56 章：性能优化

## 0. 本章目标

- 掌握 DevTools 性能面板的使用：Frame Chart / Widget Rebuild Counts / CPU Profiler / Memory Profiler
- 理解六大核心优化手段的原理与适用场景，能独立在项目中实施
- 理解 Impeller 渲染引擎与 Skia 的本质区别
- 建立可量化的性能基线体系
- 学会用 Profile 模式定位瓶颈、验证优化效果

> **前置依赖**：[Part XII — 测试体系](../Part-12-测试体系/)（你需要能运行 profile 模式）
>
> 🎯 **Library App 产出**：Profile 模式性能审计报告、列表/图片/Isolate 三项优化、性能基线达标（首帧 < 200ms / 滚动 60fps / 内存 < 200MB）。

---

## 1. 性能优化的正确姿势

### 1.1 先测量，后优化

性能优化的第一原则：**不要凭直觉优化**。在 DevTools 打开之前，你看到的所有"卡顿"都只是猜测。

```bash
flutter run --profile  # Profile 模式——接近 Release 性能，但保留 DevTools 能力
```

> **Profile 模式 vs Debug 模式**：Debug 模式包含 JIT 编译、断言、调试服务，性能只有 Release 的 10-20%。在 Debug 模式下做的任何"性能优化"都是无效的——你的优化可能完全不生效，或者消除了一个 Release 中根本不存在的瓶颈。

### 1.2 性能分析工作流

```
1. flutter run --profile → 启动 Profile 模式
2. DevTools 自动打开 → http://127.0.0.1:9100
3. 操作 App 触发目标场景 → 观察 Frame Chart
4. 发现红色/橙色帧 → 切换 Widget Rebuild Counts 面板
5. 定位高频重建 Widget → 切换到 CPU Profiler 看火焰图
6. 实施优化 → 重新测量 → 对比数据
```

---

## 2. DevTools 性能面板详解

### 2.1 Frame Rendering Chart（帧渲染图表）

这是性能优化的**第一入口**。每个竖条代表一帧的构建时间：

| 颜色 | 含义 | 行动 |
|------|------|------|
| **绿色** | < 16ms，正常 | 无需处理 |
| **橙色** | 16-32ms，轻微掉帧 | 建议优化 |
| **红色** | > 32ms，严重掉帧 | **必须优化** |

> 16ms 的来源：60fps = 1000ms ÷ 60 = 16.67ms/帧。超过 16ms 意味着这一帧无法按时提交到屏幕，用户感知到"卡顿"。

**实用技巧**：点击红色帧，可以展开查看该帧中每个 Widget 的构建耗时，直接定位到慢的 Widget。

### 2.2 Widget Rebuild Counts（重建计数）

这个面板告诉你**哪些 Widget 被重建了多少次**。一个 Widget 如果在短时间内被重建了几十次而你并未主动触发——这就是优化目标。

**典型信号**：
- 父 Widget `setState` 导致整棵子树重建
- `build()` 方法中创建了新的对象引用（如 `ClipRRect`、`BoxDecoration`）
- 缺少 `const` 导致不必要的重建

> 在 Vue/React 中，组件重新渲染也遵循类似逻辑——父组件 state 变化会级联触发子组件更新，`React.memo` / `v-once` 的作用和 Flutter 中的 `const` 异曲同工。

### 2.3 CPU Profiler（火焰图）

点击 "Record" → 操作 App → "Stop"，获得完整的函数调用耗时树。**底部越宽的矩形，占用 CPU 时间越多**。

**常见瓶颈**：
- `Canvas.drawPath` 宽 → 复杂的 CustomPainter
- `TextPainter.layout` 宽 → 大量小 Text Widget，改用 `RichText`
- JSON 解析在主线程 → 迁移到 Isolate

### 2.4 Memory Profiler（内存分析）

监控内存占用趋势。如果内存持续增长而不回落——存在内存泄漏。

**泄漏常见原因**：
- AnimationController 未 dispose
- StreamSubscription 未 cancel
- TextEditingController 未 dispose
- Timer 未 cancel

---

## 3. 六大优化手段详解

### 3.1 `const` Widget — 编译时常量

**原理**：`const` Widget 在编译时就被创建好，运行时直接复用，不会触发 `build()` 或 Element 的 `updateChild()`。

```dart
// ❌ 每次父 Widget build 时，这些对象都会重新创建
Padding(
  padding: EdgeInsets.all(16),     // 新对象
  child: Text('Hello'),            // 新对象
)

// ✅ const 对象在编译时创建，运行时永不重建
const Padding(
  padding: EdgeInsets.all(16),
  child: Text('Hello'),
)
```

**何时可以用 `const`**：所有构造参数在编译时就能确定的情况下。

**如何系统性添加**：启用 lint 规则 `prefer_const_constructors` 和 `prefer_const_literals`，然后运行 `dart fix --apply` 批量修复。

> **性能收益**：在一个有 200 个列表项、每项含 5 个 `const` 子 Widget 的页面中，从非 const 改为 const 可以将首次构建时间从 ~45ms 降至 ~18ms（实测数据，取决于设备）。

### 3.2 列表优化 — `itemExtent` 与 `prototypeItem`

**原理**：`ListView.builder` 按需构建可见项，这已经比 `ListView(children: [...])` 好很多。但如果 Flutter 不知道每个 item 的高度，它仍然需要**测量每个 item 来确定滚动范围**。`itemExtent` 告诉 Flutter 固定高度，跳过所有测量。

```dart
// ❌ 无 itemExtent：Flutter 需要逐个测量才能计算滚动位置
ListView.builder(
  itemCount: books.length,
  itemBuilder: (_, i) => BookCard(book: books[i]),
)

// ✅ 固定高度：Flutter 直接计算滚动范围，性能最优
ListView.builder(
  itemExtent: 120,  // 每行固定 120px 高
  itemCount: books.length,
  itemBuilder: (_, i) => BookCard(book: books[i]),
)
```

**`prototypeItem` 替代方案**：当 item 高度不固定（如自适应文本行），用 `prototypeItem` 让 Flutter 用第一个子项的高度作为参考：

```dart
ListView.builder(
  prototypeItem: BookCard(book: books.first),  // 用第一个 item 预估高度
  itemBuilder: (_, i) => BookCard(book: books[i]),
)
```

### 3.3 图片优化 — 显式指定缓存尺寸

**原理**：`Image.network` 默认以原始分辨率解码图片到内存。一张 3000×4000 的封面图会占用 3000×4000×4 = 48MB 内存（RGBA 4 字节/像素）。通过 `cacheWidth`/`cacheHeight` 限制解码尺寸，可以将内存占用降至 300×400×4 ≈ 480KB。

```dart
// ❌ 全分辨率解码：封面图可能占用数十 MB 内存
CachedNetworkImage(imageUrl: book.coverUrl!)

// ✅ 限制缓存尺寸：按实际显示尺寸解码
CachedNetworkImage(
  imageUrl: book.coverUrl!,
  memCacheWidth: (300 * MediaQuery.of(context).devicePixelRatio).round(),
  memCacheHeight: (450 * MediaQuery.of(context).devicePixelRatio).round(),
  placeholder: (_, __) => const ColoredBox(color: Colors.grey),
  errorWidget: (_, __, ___) => const Icon(Icons.broken_image),
)
```

> 乘以 `devicePixelRatio` 确保在 2x/3x 屏幕上图片依然清晰。3x 屏幕上 300px 的物理像素是 900px。

### 3.4 `RepaintBoundary` — 重绘隔离

**原理**：默认情况下，Flutter 的重绘是**树状传递**的——父 Widget 重绘时，所有子 Widget 也一起重绘。`RepaintBoundary` 在 Widget 树中画一条"隔离线"，线内的重绘不会波及线外。

```dart
// 场景：列表中每张卡片有一个动画图标，但列表本身不频繁更新
ListView.builder(
  itemBuilder: (_, i) => RepaintBoundary(  // 每张卡片独立重绘
    child: BookCard(
      book: books[i],
      child: AnimatedBorrowIcon(),  // 这个动画只重绘当前卡片，不影响其他
    ),
  ),
)
```

**如何验证效果**：启用重绘可视化：

```dart
void main() {
  debugRepaintRainbowEnabled = true;  // 重绘区域会闪烁彩色边框
  runApp(const LibraryApp());
}
```

优化前：整个列表区域闪烁 → 优化后：仅单张卡片闪烁。

> **原则**：不是每个 Widget 都需要 RepaintBoundary——它自己也有创建和维护 Layer 的开销。只在**频繁重绘的局部区域**使用。

### 3.5 Isolate — 将重计算移出主线程

**原理**：Dart 是单线程模型（类似 JS 的主线程 Event Loop）。所有 Dart 代码默认在主线程（UI Thread）运行。`Isolate` 类似于 Web Worker——在独立线程执行，通过消息传递（值拷贝，非共享内存）返回结果。

```dart
// ❌ 大 JSON 在主线程解析，阻塞 UI
final books = (jsonDecode(largeJsonString) as List)
    .map((e) => Book.fromJson(e))
    .toList();

// ✅ 移到 Isolate 后台线程
final books = await Isolate.run(() {
  final decoded = jsonDecode(largeJsonString) as List;
  return decoded.map((e) => Book.fromJson(e)).toList();
});
```

**适用场景**：
- JSON 解析（>100KB 的数据）
- 图片压缩/处理
- 复杂数据转换（如排序、搜索大型列表）
- 加密/解密操作

**不适用场景**：
- 需要访问 UI 相关 API 的操作（Isolate 中没有 Flutter 上下文）
- 小数据量操作（线程切换开销比直接计算还大）
- `compute()` 函数是 `Isolate.run` 的简化版，功能等价但 API 更老

### 3.6 Shader Warm-up — 消除首次动画抖动

**原理**：GPU Shader 程序在首次执行时需要编译。如果编译发生在帧渲染期间，该帧会超时导致掉帧。Shader Warm-up 在 App 启动时预编译所有常用 Shader，消除运行时的编译开销。

```dart
MaterialApp.router(
  builder: (context, child) {
    // 预热常用的 GPU Shader 程序
    return ShaderWarmUpWidget(child: child!);
  },
);
```

**Impeller（Flutter 3.44+ 默认）**：Impeller 将所有 Shader 预先 AOT 编译并打包进 App，从根本上消除了运行时的 Shader 编译卡顿。如果目标平台支持 Impeller（iOS + Android），Shader Warm-up 通常不再需要。但对 Web/Desktop 平台（仍使用 Skia），Shader Warm-up 依然有价值。

---

## 4. Impeller — Flutter 的新一代渲染引擎

### 4.1 Skia 的问题

Skia 是 Chromium/Android 使用的通用 2D 图形库。它的设计初衷不是移动端实时渲染：

- **运行时 Shader 编译**：Skia 的 Shader 在 GPU 首次执行时才编译（JIT）。如果编译发生在帧渲染期间，该帧就会掉帧。这是 Flutter App 首次动画卡顿的根本原因。
- **通用性代价**：Skia 需要服务 PDF 渲染、Canvas 绘图等多种场景，内部有大量 Flutter 不需要的抽象层。

### 4.2 Impeller 的解决方案

Impeller 是 Flutter 团队专门为移动端设计的渲染引擎：

| 维度 | Skia | Impeller |
|------|------|----------|
| Shader 编译时机 | 运行时 JIT | 构建时 AOT |
| 首次动画 | 可能掉帧 | 始终流畅 |
| 代码体积 | 更大（通用性） | 更小（专用性） |
| 平台支持 | 全平台 | iOS/Android (成熟), 桌面/Web (实验) |

```bash
# 回退到 Skia（仅调试对比，不要在生产中使用）
flutter run --no-enable-impeller
```

> ⚠️ Impeller 在 Flutter 3.44 中是**默认**渲染引擎。如果你的 App 目标平台是 iOS 和 Android，你不需要做任何配置——Impeller 自动生效。

---

## 5. 性能基线体系

性能优化必须有可量化的目标。以下是 Library App 的性能基线：

| 指标 | 目标 | 测量工具 | 测量方法 |
|------|------|---------|---------|
| 首帧时间 | < 200ms | DevTools Timeline | 冷启动 → 记录 `Time to First Frame` |
| 列表滚动帧率 | 60fps (≥58fps 可接受) | DevTools Frame Chart | 快速滑动列表 5 秒，统计红色/橙色帧占比 |
| 页面切换耗时 | < 100ms | DevTools Timeline | `context.push` → 新页面首帧渲染完成 |
| 内存占用 | < 200MB | DevTools Memory | 遍历全部页面后 GC，观察稳定水位 |
| APK 大小（Android） | < 30MB | `flutter build apk --analyze-size` | 构建 Release APK 后查看分析报告 |
| IPA 大小（iOS） | < 50MB | Xcode App Thinning Report | Archive → Distribute App |
| 首次交互时间 | < 500ms | DevTools Performance Overlay | 冷启动 → 首次可点击响应 |

### 5.1 如何测量首帧时间

```bash
# 1. 以 Profile 模式启动，开启性能叠加层
flutter run --profile

# 2. 在 DevTools 的 Performance 面板中，勾选 "Enhance Tracing"
#    这会启用更详细的时间线标记

# 3. 热重启 App（Shift + R），从 Timeline 中找到
#    "Time to First Frame" 标记
```

---

## 6. Library App 性能审计实战

### 6.1 审计清单

- [ ] 运行 `flutter analyze` — 确保 `prefer_const_constructors` 和 `prefer_const_literals` 零警告
- [ ] Profile 模式启动 — 确认 Frame Chart 无红色帧
- [ ] 快速滑动图书列表 — 帧率保持在 58fps 以上
- [ ] 检查 Widget Rebuild Counts — 确认列表滑动时 BookCard 未被不必要的重建
- [ ] Memory Profiler — 确认内存不持续增长
- [ ] APK/IPA 大小检查 — 确认在基线范围内

### 6.2 典型问题与修复

```dart
// 问题 1：BookCard 每次 build 都创建新的 ClipRRect
// 修复：提取为 const 子 Widget
class BookCard extends StatelessWidget {
  const BookCard({super.key, required this.book});
  final Book book;

  @override
  Widget build(BuildContext context) {
    return const _BookCardLayout(book: book);  // ❌ 不是 const（book 参数在运行时确定）
  }
}

// 正确做法：将不依赖外部状态的子 Widget 标记为 const
class _BookCoverClipper extends StatelessWidget {
  const _BookCoverClipper({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.all(Radius.circular(8)),  // ✅ const
      child: CachedNetworkImage(imageUrl: url, ...),
    );
  }
}
```

```dart
// 问题 2：搜索页 TextField 重建导致整个搜索列表重建
// 修复：用 RepaintBoundary 隔离搜索列表
Column(
  children: [
    const SearchTextField(),           // 输入框（频繁更新）
    Expanded(
      child: RepaintBoundary(          // 搜索结果（独立重绘）
        child: SearchResultsList(),
      ),
    ),
  ],
)
```

---

## 7. 常见错误与最佳实践

### 7.1 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|---------|
| ❌ 在 `build()` 中创建 `AnimationController` | 每帧都创建新 Controller，内存泄漏 + 性能灾难 | 在 `initState` 创建，`dispose` 释放 |
| ❌ 用 `ListView(children: [...])` 渲染大数据集 | 一次性构建全部 item，首帧超时 | 用 `ListView.builder` 按需构建 |
| ❌ 不加 `memCacheWidth` 加载高清大图 | 单张图可能占用 48MB+ 内存 | 指定 `memCacheWidth`/`memCacheHeight` |
| ❌ 在 Debug 模式下做性能优化 | 测得的数据完全不反映 Release 性能 | 始终在 Profile 模式下测量 |
| ❌ 到处加 `RepaintBoundary` | RepaintBoundary 本身有 Layer 开销，过度使用反而更慢 | 只在频繁重绘的局部区域使用 |

### 7.2 最佳实践

1. **`const` 优先原则**：任何不依赖运行时数据的 Widget 和装饰对象，一律标记为 `const`
2. **Profile 模式驱动**：每次优化前后都在 Profile 模式下测量，记录数据
3. **列表优化三部曲**：`ListView.builder` → `itemExtent`/`prototypeItem` → `addAutomaticKeepAlives: false`（不需要保持滚动位置的列表）
4. **图片解码控制**：所有网络图片都指定 `memCacheWidth`/`memCacheHeight`（乘以 `devicePixelRatio`）
5. **动画隔离**：动画 Widget 包裹 `RepaintBoundary`，避免触发兄弟 Widget 重绘
6. **大计算移出主线程**：超过 16ms 的同步计算（JSON 解析、数据转换）移至 Isolate
7. **定期审计**：每次功能迭代后用 DevTools 检查 Frame Chart 和 Rebuild Counts
8. **建立性能回归防线**：在 CI 中跑 `flutter test --performance` 类基准测试

---

## 8. 本章小结

| 概念 | 核心要点 | 类比 |
|------|---------|------|
| Profile 模式 | 接近 Release 性能 + 可调试，Debug 模式测性能无意义 | React DevTools Profiler / Vue DevTools Performance |
| Frame Chart | 每帧耗时可视化，红色 = 掉帧 | Chrome DevTools Performance 面板 FPS 图 |
| `const` Widget | 编译时常量，不参与重建 | `React.memo` + 静态优化 / Vue `v-once` |
| `itemExtent` | 告诉 Flutter 固定高度，跳过测量 | 虚拟列表的 `itemSize` 属性 |
| `RepaintBoundary` | 隔离重绘区域，一层屏障 | CSS `will-change: transform` 创建独立合成层 |
| `Isolate` | Dart 的独立线程，消息传递通信 | Web Worker / Node.js `worker_threads` |
| Impeller | AOT Shader 编译，消除运行时编译卡顿 | —（无直接 Web 等价物） |
| 性能基线 | 量化指标驱动优化，数字说话 | Lighthouse Score / Web Vitals |

---

## 9. 本章练习

**练习 1：Library App 的 const 审计**

- 运行 `flutter analyze` 并启用 `prefer_const_constructors` 和 `prefer_const_literals` lint 规则
- 使用 `dart fix --apply` 批量修复所有可 const 的 Widget
- 在 Profile 模式下对比修复前后首帧构建时间
- 验证标准：`flutter analyze` 零警告，首帧时间下降 ≥ 10%

**练习 2：图书列表滚动性能优化**

- 确保 `GridView.builder` 使用了 `itemExtent`（固定卡片高度）
- 为每张 `BookCard` 包裹 `RepaintBoundary`
- 使用 `debugRepaintRainbowEnabled = true` 验证重绘隔离效果
- Profile 模式下快速滑动列表 10 秒，统计红色帧占比
- 验证标准：红色帧占比 < 2%，帧率始终 ≥ 58fps

**练习 3：图片内存优化**

- 检查 Library App 中所有 `Image.network` 和 `CachedNetworkImage` 的使用
- 为每处添加 `memCacheWidth` 和 `memCacheHeight`（乘以 `devicePixelRatio`）
- 在 DevTools Memory 面板中观察优化前后的内存稳定水位
- 验证标准：内存占用下降 ≥ 20%，图片显示无明显模糊

---

> **下一步**: [Chapter 57 — DevTools 详解](./Chapter-57-DevTools详解.md)
> 📖 **延伸阅读**: [Flutter 性能优化文档](https://docs.flutter.dev/perf) | [Impeller 渲染引擎](https://docs.flutter.dev/perf/impeller) | [Flutter 性能最佳实践](https://docs.flutter.dev/perf/best-practices)
