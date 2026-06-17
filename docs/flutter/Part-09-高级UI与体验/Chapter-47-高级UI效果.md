> **Part**: Part IX — 高级 UI 与体验
> **上一章**: [Chapter 46 — 无障碍](./Chapter-46-无障碍.md)
> **下一章**: [Part X — 平台集成与设备能力](../Part-10-平台集成与设备能力/)
> **官方文档**: [flutter.cn/ui/design/graphics](https://docs.flutter.cn/ui/design/graphics)

---

# 第 47 章：高级 UI 效果

## 0. 本章目标

BackdropFilter 毛玻璃效果、ShaderMask 着色器遮罩、Transform 矩阵变换（3D 翻转）、Gradient 渐变全类型（Linear/Radial/Sweep）、AnnotatedRegion 状态栏控制。

> 🎯 **Library App 产出**：详情页封面毛玻璃背景、搜索栏渐变、3D 封面翻转、分类标签 ShaderMask。

---

## 1. BackdropFilter——毛玻璃

```dart
ClipRRect(
  borderRadius: BorderRadius.circular(16),
  child: BackdropFilter(
    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
    child: Container(
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.1), borderRadius: BorderRadius.circular(16)),
      padding: const EdgeInsets.all(24),
      child: Text('毛玻璃卡片', style: TextStyle(color: Colors.white)),
    ),
  ),
);
```

## 2. ShaderMask——渐变文字/图标着色

```dart
ShaderMask(
  shaderCallback: (bounds) => LinearGradient(colors: [Colors.blue, Colors.purple]).createShader(bounds),
  child: Text('推荐图书', style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white)),
);
```

## 3. Transform——3D 翻转

```dart
Transform(
  alignment: Alignment.center,
  transform: Matrix4.identity()
    ..setEntry(3, 2, 0.001)  // 透视
    ..rotateY(_flipAnimation.value * pi),
  child: _flipAnimation.value <= 0.5
      ? BookCover(book: book)          // 正面
      : Transform(alignment: Alignment.center, transform: Matrix4.rotationY(pi), child: BookBack(book: book)),  // 背面
);
```

## 4. Gradient 全类型

```dart
// 线性渐变
BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF667eea), Color(0xFF764ba2)]));
// 径向渐变
BoxDecoration(gradient: RadialGradient(center: Alignment.center, radius: 0.8, colors: [Colors.white, Colors.blue[100]!]));
// 扫描渐变（锥形）
BoxDecoration(gradient: SweepGradient(colors: [Colors.red, Colors.orange, Colors.yellow, Colors.red]));
```

## 5. AnnotatedRegion——状态栏控制

```dart
AnnotatedRegion<SystemUiOverlayStyle>(
  value: SystemUiOverlayStyle.light.copyWith(statusBarColor: Colors.transparent),
  child: Scaffold(...),
);
```

## 6. 与 CSS 对照

| Flutter | CSS |
|---------|-----|
| `BackdropFilter` + `ImageFilter.blur` | `backdrop-filter: blur(10px)` |
| `ShaderMask` + `LinearGradient` | `background-clip: text` + `linear-gradient()` |
| `Transform(transform: Matrix4.rotationY(...))` | `transform: rotateY(180deg)` |
| `BoxDecoration(gradient: LinearGradient(...))` | `background: linear-gradient(...)` |

---

## 7. 常见错误与最佳实践

### 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|----------|
| `BackdropFilter` 未套 `ClipRRect` | 模糊效果溢出 Widget 边界，边缘出现模糊拖影 | `ClipRRect(borderRadius: ..., child: BackdropFilter(...))` |
| `ShaderMask` 使用 `BlendMode.srcOver` | 渐变不可见，因为 srcOver 不修改像素 alpha | 文字渐变着色用 `BlendMode.srcIn`，图标着色用 `BlendMode.srcATop` |
| `setEntry(3, 2, ...)` 透视值过大 | 3D 翻转时图像严重畸变，视觉效果失真 | 透视值控制在 `0.001`~`0.003` 之间 |
| `Gradient` 只有 2 个颜色 stop | 大尺寸屏幕渐变过渡生硬，缺乏层次 | 使用 3~5 个颜色 stop，如 `[红, 橙, 黄, 红]` 扫描渐变 |
| 3D 翻转未处理背面可见性 | 旋转超过 90° 时背面文字镜像反转，不可读 | 在 90° 处用 `Visibility`/`Opacity` 切换正反面内容，背面套 `Transform(rotationY(pi))` 反转回来 |

### 最佳实践

- `BackdropFilter` 始终配合 `ClipRRect` 或 `ClipRect` 裁剪边界，性能开销大需控制使用数量
- 文字渐变着色：`ShaderMask(blendMode: BlendMode.srcIn, shaderCallback: ..., child: Text(...))`
- 3D 翻转使用 `AnimationController(duration: 600ms)` + `CurvedAnimation(curve: Curves.easeInOut)`
- `Transform` 的 `alignment: Alignment.center` 确保旋转中心在 Widget 中心
- 渐变效果在深色/浅色主题下使用 `Theme.of(context).colorScheme` 的颜色，而非硬编码
- 使用 `AnnotatedRegion<SystemUiOverlayStyle>` 按页面控制状态栏样式（透明/深色/浅色图标）
- 视觉特效在低端设备上可考虑降级：检查 `Platform.isAndroid && androidInfo.isLowRamDevice`
- `ShaderMask` 性能优于 `BackdropFilter`，优先用于文字/图标着色而非全屏模糊

---

## 8. 本章练习

1. 为 Library App 的图书详情页实现毛玻璃封面背景：Stack 底层平铺封面图片（用 `ImageFiltered` 或 `BackdropFilter` + `ImageFilter.blur(sigmaX: 10, sigmaY: 10)`），上层叠加半透明白色 Container 显示书名、作者和评分，整体用 `ClipRRect` 裁剪圆角
2. 为 Library App 搜索页标题实现渐变 ShaderMask：使用 `LinearGradient(colors: [主题色, Colors.transparent])` 作为 shader，通过 `ShaderMask` + `BlendMode.srcIn` 渲染标题 Text Widget，文字从左到右由主题色渐变为透明，结合 `AnnotatedRegion` 设置搜索页状态栏为透明背景配合白色图标
3. 为 Library App 的图书卡片实现 3D 翻转效果：正面显示封面，点击后 `Transform(transform: Matrix4.rotationY(...))` 沿 Y 轴旋转 180 度显示背面（图书简介摘要），使用 `AnimationController(duration: 600ms)` + `CurvedAnimation` 驱动，翻转前后用 `Visibility` 切换正反面内容显示

验证：毛玻璃叠层在深色和浅色背景下均有模糊穿透效果；渐变文字在深色主题下对比度清晰；卡片翻转过渡流畅无闪烁

---

> **下一步**: [Part X — 业务功能实战](../Part-10-业务功能实战/Chapter-37-借阅系统状态机.md)
> 📖 **延伸阅读**: [BackdropFilter](https://api.flutter.dev/flutter/widgets/BackdropFilter-class.html) | [ShaderMask](https://api.flutter.dev/flutter/widgets/ShaderMask-class.html) | [Transform](https://api.flutter.dev/flutter/widgets/Transform-class.html)
