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

## 6. 本章练习

1. 为 Library App 实现五星级评分 CustomPainter：`canvas.drawPath` 绘制标准五角星路径，完整星用金色填充，半星用 `canvas.clipRect` 截取左半部分填充金色、右半部分灰色，支持 0.5 精度（如 3.5 星），用 `shouldRepaint` 正确判断是否需要重绘
2. 为 Library App 实现借阅到期倒计时环形进度条：`canvas.drawArc` 先画灰色背景圆环（sweepAngle 360），再画主题色前景圆弧（sweepAngle = 剩余天数/总天数 * 360），圆心处用 `TextPainter` 绘制剩余天数文字，剩余 <= 3 天时前景色变红，用 `RepaintBoundary` 包裹避免不必要重绘
3. 为 Library App 的分类标签实现自定义形状：用 `ClipPath` + `CustomClipper<Path>` 绘制带箭头尾巴的标签形状（左侧矩形 + 右侧三角形箭头），路径通过 `moveTo`/`lineTo`/`close` 构建，标签背景使用分类对应颜色（小说蓝/技术绿/历史橙），标签内文字居中

验证：运行 App，评分组件能正确渲染 0~5 星（含半星）；环形进度在不同剩余天数下颜色和弧度正确；分类标签形状完整无裁剪异常

---

> **下一步**: [Chapter 44 — 响应式设计](./Chapter-44-响应式设计.md)
> 📖 **延伸阅读**: [CustomPainter 文档](https://api.flutter.dev/flutter/rendering/CustomPainter-class.html) | [Canvas 类](https://api.flutter.dev/flutter/dart-ui/Canvas-class.html) | [Path API](https://api.flutter.dev/flutter/dart-ui/Path-class.html)
