> **Part**: Part IX — 高级 UI 与体验
> **上一章**: [Chapter 42 — 动画系统](./Chapter-42-动画系统.md)
> **下一章**: [Chapter 44 — 响应式设计](./Chapter-44-响应式设计.md)
> **官方文档**: [flutter.cn/ui/design/graphics](https://docs.flutter.cn/ui/design/graphics)

---

# 第 43 章：CustomPainter 与自定义绘制

## 0. 本章目标

Canvas API（drawRect/drawCircle/drawPath/drawArc/drawImage/drawParagraph）、Paint 配置（color/style/strokeWidth/shader/maskFilter）、CustomPainter 生命周期（paint/shouldRepaint）、RepaintBoundary 隔离重绘、ClipPath/CustomClipper、与 HTML Canvas API 对照。

> 🎯 **Library App 产出**：评分五角星 CustomPainter、ISBN 条形码生成器、到期倒计时环形进度、分类标签自定形状。

---

## 1. Canvas API 速查

```dart
class DemoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.blue..style = PaintingStyle.fill..strokeWidth = 4..strokeCap = StrokeCap.round;

    // 几何形状
    canvas.drawRect(Rect.fromLTWH(10, 10, 100, 50), paint);       // 矩形
    canvas.drawCircle(Offset(60, 35), 30, paint);                  // 圆
    canvas.drawArc(Rect.fromLTWH(0, 0, 100, 100), 0, pi / 2, true, paint); // 扇形
    canvas.drawLine(Offset(0, 0), Offset(100, 100), paint);        // 线
    // 文字
    final textPainter = TextPainter(text: TextSpan(text: 'Hi', style: TextStyle(fontSize: 24)), textDirection: TextDirection.ltr)..layout();
    textPainter.paint(canvas, Offset(50, 50));
  }
  @override bool shouldRepaint(covariant DemoPainter old) => false;
}
```

---

## 2. 评分五角星 CustomPainter

```dart
class StarRatingPainter extends CustomPainter {
  final double rating; final Color color;
  StarRatingPainter({required this.rating, this.color = Colors.amber});

  @override
  void paint(Canvas canvas, Size size) {
    final starW = size.width / 5;
    for (int i = 0; i < 5; i++) {
      final fill = (rating - i).clamp(0.0, 1.0);
      _drawStar(canvas, Offset(i * starW, 0), starW, fill, color);
    }
  }

  Path _starPath(Offset o, double s) {
    final cx = o.dx + s / 2, cy = o.dy + s / 2, r = s * 0.45, innerR = r * 0.38;
    final path = Path();
    for (int i = 0; i < 5; i++) {
      final angle = -pi / 2 + i * 2 * pi / 5;
      path.lineTo(cx + r * cos(angle), cy + r * sin(angle));
      path.lineTo(cx + innerR * cos(angle + pi / 5), cy + innerR * sin(angle + pi / 5));
    }
    path.close();
    return path;
  }

  void _drawStar(Canvas c, Offset o, double s, double fill, Color color) {
    final path = _starPath(o, s);
    c.drawPath(path, Paint()..color = color.withOpacity(0.2)..style = PaintingStyle.fill);
    c.drawPath(path, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 1);
    if (fill > 0) {
      c.save();
      c.clipRect(Rect.fromLTWH(o.dx, o.dy, s * fill, s));
      c.drawPath(path, Paint()..color = color..style = PaintingStyle.fill);
      c.restore();
    }
  }

  @override bool shouldRepaint(covariant StarRatingPainter o) => o.rating != rating;
}
```

## 3. 到期倒计时环形进度

```dart
class DueDateProgressPainter extends CustomPainter {
  final double progress;  // 0.0~1.0（1.0=已逾期）
  DueDateProgressPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 4;
    final isOverdue = progress >= 1.0;
    final color = isOverdue ? Colors.red : Color.lerp(Colors.green, Colors.orange, progress)!;

    canvas.drawCircle(center, radius, Paint()..color = Colors.grey[200]!..style = PaintingStyle.stroke..strokeWidth = 6);
    canvas.drawArc(Rect.fromCircle(center: center, radius: radius), -pi / 2, 2 * pi * progress.clamp(0.0, 1.0), false, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 6..strokeCap = StrokeCap.round);
  }
  @override bool shouldRepaint(covariant DueDateProgressPainter o) => o.progress != progress;
}
```

## 4. RepaintBoundary——隔离重绘

```dart
// 包裹在 CustomPaint 外层——防止父 Widget 的重建触发不必要的 repaint
RepaintBoundary(child: CustomPaint(painter: ExpensivePainter(), size: const Size(200, 200)));
```

## 5. 与 HTML Canvas 对照

| Canvas API | Dart/Flutter |
|-----------|-------------|
| `ctx.fillRect(x,y,w,h)` | `canvas.drawRect(Rect.fromLTWH(x,y,w,h), Paint()..style=fill)` |
| `ctx.beginPath(); ctx.arc(...); ctx.fill()` | `canvas.drawCircle(Offset(x,y), r, paint)` |
| `ctx.fillStyle = 'red'` | `paint.color = Colors.red` |
| `ctx.lineWidth = 3` | `paint.strokeWidth = 3` |
| `ctx.save(); ctx.clip(); ... ctx.restore()` | `canvas.save(); canvas.clipRect(...); ... canvas.restore()` |

---

## 6. 常见错误与最佳实践

### 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|----------|
| `shouldRepaint` 永远返回 `true` | 每次父 Widget `build` 都触发完整重绘，帧率严重下降 | 精确比较影响绘制的属性：`o.rating != rating` |
| 在 `paint()` 方法内创建对象 | 每帧 `new Paint()`/`new Path()` 产生大量 GC，造成卡顿 | 将 `Paint`/`Path` 提升为成员变量或复用 `paint` 参数 |
| 忽略 `Size` 参数使用硬编码 | 在不同容器尺寸下绘制变形或溢出 | 使用 `size.width`/`size.height` 按比例计算坐标 |
| `canvas.clipRect()` 后忘记 `restore()` | 裁剪状态污染后续所有绘制操作 | `canvas.save()` 和 `canvas.restore()` 严格成对使用 |
| `CustomPaint` 未设置 `size` 或 `child` | 绘制区域为 `Size.zero`，图形完全不可见 | 显式指定 `size` 或通过 `child` 约束尺寸 |

### 最佳实践

- `shouldRepaint` 中精确比较属性：`o.rating != rating || o.color != color`，避免不必要的重绘
- `paint()` 方法内复用的 `Paint` 对象在 `CustomPainter` 构造时创建并缓存
- 用 `RepaintBoundary` 包裹 `CustomPaint`，阻止父 Widget 重建触发子级重绘
- 复杂路径提取为独立方法（如 `_starPath()`），既复用又便于测试
- `TextPainter` 先 `layout()` 再 `paint(canvas, offset)`，textDirection 必须指定
- 涉及透明度的绘制使用 `canvas.saveLayer()` 而非 `save()`，避免叠加色差
- 在 `shouldRepaint` 中返回 `false` 的 Painter 可作为静态背景，性能最优
- 使用 `ClipPath` + `CustomClipper<Path>` 而非 `CustomPainter` 做裁剪，更符合语义

---

## 7. 本章练习

1. 为 Library App 实现五星级评分 CustomPainter：`canvas.drawPath` 绘制标准五角星路径，完整星用金色填充，半星用 `canvas.clipRect` 截取左半部分填充金色、右半部分灰色，支持 0.5 精度（如 3.5 星），用 `shouldRepaint` 正确判断是否需要重绘
2. 为 Library App 实现借阅到期倒计时环形进度条：`canvas.drawArc` 先画灰色背景圆环（sweepAngle 360），再画主题色前景圆弧（sweepAngle = 剩余天数/总天数 * 360），圆心处用 `TextPainter` 绘制剩余天数文字，剩余 <= 3 天时前景色变红，用 `RepaintBoundary` 包裹避免不必要重绘
3. 为 Library App 的分类标签实现自定义形状：用 `ClipPath` + `CustomClipper<Path>` 绘制带箭头尾巴的标签形状（左侧矩形 + 右侧三角形箭头），路径通过 `moveTo`/`lineTo`/`close` 构建，标签背景使用分类对应颜色（小说蓝/技术绿/历史橙），标签内文字居中

验证：运行 App，评分组件能正确渲染 0~5 星（含半星）；环形进度在不同剩余天数下颜色和弧度正确；分类标签形状完整无裁剪异常

---

> **下一步**: [Chapter 44 — 响应式设计](./Chapter-44-响应式设计.md)
> 📖 **延伸阅读**: [CustomPainter 文档](https://api.flutter.dev/flutter/rendering/CustomPainter-class.html) | [Canvas 类](https://api.flutter.dev/flutter/dart-ui/Canvas-class.html) | [Path API](https://api.flutter.dev/flutter/dart-ui/Path-class.html)
