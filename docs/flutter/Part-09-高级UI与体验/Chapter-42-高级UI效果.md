> **Part**: Part IX | **上一章**: [Ch 41](./Chapter-41-无障碍.md) | **下一章**: [Part X](../Part-10-平台集成与设备能力/)
> **官方文档**: [flutter.cn/ui/design/graphics](https://docs.flutter.cn/ui/design/graphics)

---

# 第 42 章：高级 UI 效果

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

> **下一步**: [Part X — 平台集成](../Part-10-平台集成与设备能力/)
