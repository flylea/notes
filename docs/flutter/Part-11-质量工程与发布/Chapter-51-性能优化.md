> **Part**: Part XI | **上一章**: [Ch 50](./Chapter-50-集成测试.md) | **下一章**: [Ch 52](./Chapter-52-错误处理与监控.md)
> **官方文档**: [flutter.cn/perf](https://docs.flutter.cn/perf)

---

# 第 51 章：性能优化

## 0. 本章目标

DevTools 性能面板（Frame Chart/Widget Rebuild Count/CPU Profiler/Memory Profiler）、const Widget（编译时常量避免重建）、列表优化（itemExtent/prototypeItem/addAutomaticKeepAlives）、图片优化（cached_network_image + cacheWidth/cacheHeight）、RepaintBoundary 隔离重绘区域、Isolate 后台计算（compute/Isolate.run）、Shader Warm-up 消除首次卡顿、Impeller（Flutter 3.44 默认渲染引擎——AOT Shader 编译）、与 React useMemo/useCallback + Web Vitals 对照。

> 🎯 **Library App 产出**：Profile 模式性能审计、列表/图片/Isolate 三项优化、性能基线（首帧 < 200ms / 滚动 60fps / 内存 < 200MB）。

---

## 1. DevTools 性能面板

```bash
flutter run --profile  # Profile 模式（接近 Release 性能 + DevTools 可用）
# VS Code: F5 → 选择 "Flutter (profile mode)"
# DevTools: 自动打开 http://127.0.0.1:9100
```

关键面板：Frame Rendering Chart（每帧构建时间——红线=16ms 超限导致掉帧）、Widget Rebuild Counts（哪些 Widget 被频繁重建）、CPU Profiler（函数调用耗时火焰图）。

## 2. 六大优化手段

```dart
// ① const — 编译时常量不参与重建，性能第一原则
const Text('Hello'); const SizedBox(height: 8); const EdgeInsets.all(16);

// ② 列表 — itemExtent 告诉 Flutter 固定高度，跳过测量
ListView.builder(itemExtent: 120, itemBuilder: ...);

// ③ 图片 — 限制缓存解码尺寸减少内存
CachedNetworkImage(imageUrl: url, memCacheWidth: 300, memCacheHeight: 450);

// ④ RepaintBoundary — 动画绘制隔离，外层重建不触发 repaint
RepaintBoundary(child: AnimatedOpacity(opacity: ..., child: ...));

// ⑤ Isolate — JSON 解析移到后台线程
final books = await Isolate.run(() => parseLargeJson(jsonString));
// 或 compute(parseFn, jsonString)

// ⑥ Shader Warm-up — 预热 GPU Shader 消除首次动画抖动
MaterialApp.router(builder: (context, child) => ShaderWarmUpWidget(child: child!));
```

## 3. Impeller——默认渲染引擎

Flutter 3.44 起 Impeller 替代 Skia 成为默认。Skia 的问题：Shader 在**帧渲染期间**编译→首次动画掉帧。Impeller 的方案：AOT 编译所有 Shader→打包在 App 中→运行时不编译→帧率稳定。`flutter run --no-enable-impeller` 回退到 Skia（仅调试对比用）。

## 4. 性能基线

| 指标 | 目标 | 测量方式 |
|------|------|---------|
| 首帧时间 | < 200ms | DevTools Timeline |
| 列表滚动帧率 | 60fps | DevTools Frame Chart |
| 内存占用 | < 200MB | DevTools Memory 面板 |
| 图片缓存命中率 | > 90% | cached_network_image 统计 |
| APK 大小 | < 30MB | `flutter build apk --analyze-size` |

---

> **下一步**: [Ch 52](./Chapter-52-错误处理与监控.md)
