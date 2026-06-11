# 第 12 章：Material 3 主题系统

> **Part**: Part II — 界面基石
> **上一章**: [Chapter 11 — 表单与用户输入](./Chapter-11-表单与用户输入.md)
> **下一章**: [Chapter 13 — Widget 测试入门](./Chapter-13-Widget测试入门.md)
> **官方文档**: [m3.material.io](https://m3.material.io) | [flutter.cn/ui/design/material](https://docs.flutter.cn/ui/design/material)

---

## 0. 本章目标

- 理解 Material 3 Design Token 体系
- 掌握 `ColorScheme.fromSeed` 一键生成完整配色方案
- 学会配置 light/dark 双主题 + 运行时切换
- 使用 `ThemeExtension` 自定义主题属性
- 掌握 `Theme.of(context)` 的正确用法

> 🎯 **本章产出**：`lib/core/theme/app_theme.dart` + Library App 的深色/浅色主题切换功能。

你现在已经学完了 Widget、布局、表单，Library App 有了完整的静态界面——但外观是 Flutter 默认蓝色。本章帮你给 App "上色"，后续所有章节的页面都能用上统一主题。

---

## 1. Material 3 Design Token 体系

Material 3 用 **Design Token** 替代了 Material 2 的硬编码颜色。一个种子色（seed color）自动生成 25+ 颜色角色：

```
ColorScheme.fromSeed(seedColor: 蓝色)
  ├─ primary          → 主色（FAB、选中态）
  ├─ onPrimary        → 主色上的文字色
  ├─ primaryContainer → 主色的容器背景
  ├─ secondary        → 次要色（filter chip、slider）
  ├─ tertiary         → 第三强调色（switch、badge）
  ├─ error            → 错误色
  ├─ surface          → 卡片/Sheet 背景
  ├─ surfaceContainerHighest → 输入框填充色
  ├─ outline          → 边框色
  └─ ... 15+ 其他角色

对应的文字样式 Tier：
  TextTheme:
  ├─ displayLarge/Medium/Small   → 展示文字（超大标题）
  ├─ headlineLarge/Medium/Small  → 标题文字
  ├─ titleLarge/Medium/Small     → 段落标题
  ├─ bodyLarge/Medium/Small      → 正文
  └─ labelLarge/Medium/Small     → 按钮/标签文字
```

---

## 2. 完整主题配置

```dart
// lib/core/theme/app_theme.dart
import 'package:flutter/material.dart';

class AppTheme {
  // ──── Light 主题 ────
  static ThemeData light() {
    const seedColor = Color(0xFF1565C0);  // 品牌蓝

    return ThemeData(
      useMaterial3: true,
      colorSchemeSeed: seedColor,
      brightness: Brightness.light,

      // 统一 AppBar 样式
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        scrolledUnderElevation: 1,
      ),

      // 统一 Card 样式
      cardTheme: CardTheme(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),

      // 统一输入框样式
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        filled: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),

      // 统一按钮样式
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
    );
  }

  // ──── Dark 主题 ────
  static ThemeData dark() {
    const seedColor = Color(0xFF42A5F5);  // 暗色模式下用更亮的蓝色

    return ThemeData(
      useMaterial3: true,
      colorSchemeSeed: seedColor,
      brightness: Brightness.dark,
      // 组件主题同上，或单独定制
      appBarTheme: const AppBarTheme(
        centerTitle: true,
        scrolledUnderElevation: 1,
      ),
      cardTheme: CardTheme(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        filled: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
    );
  }
}
```

### 在 MaterialApp 中接入

```dart
// lib/app.dart
MaterialApp.router(
  theme: AppTheme.light(),
  darkTheme: AppTheme.dark(),
  themeMode: _themeMode,  // ThemeMode.system / light / dark
  routerConfig: appRouter,
);
```

---

## 3. 主题模式切换

本章使用 `StatefulWidget` + `setState` 管理主题模式（因为你还没学到 Riverpod）。到 Ch26 会用 Riverpod 升级这个方案。

```dart
// lib/screens/settings_screen.dart

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  ThemeMode _themeMode = ThemeMode.system;

  void _updateTheme(ThemeMode mode) {
    setState(() => _themeMode = mode);
    // 持久化可选：后续用 SharedPreferences 存储用户选择
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: ListView(
        children: [
          const _SectionHeader('外观'),
          // 使用 SegmentedButton 切换主题
          Padding(
            padding: const EdgeInsets.all(16),
            child: SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(value: ThemeMode.system, label: Text('跟随系统')),
                ButtonSegment(value: ThemeMode.light, label: Text('浅色')),
                ButtonSegment(value: ThemeMode.dark, label: Text('深色')),
              ],
              selected: {_themeMode},
              onSelectionChanged: (v) => _updateTheme(v.first),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: Theme.of(context).colorScheme.primary,
          )),
    );
  }
}
```

### 让切换全局生效

需要将 `_themeMode` 提升到根 Widget。简单做法是让 `LibraryApp`（`lib/app.dart` 中）也变成 StatefulWidget：

```dart
class LibraryApp extends StatefulWidget {
  const LibraryApp({super.key});
  @override
  State<LibraryApp> createState() => _LibraryAppState();
}

class _LibraryAppState extends State<LibraryApp> {
  ThemeMode _themeMode = ThemeMode.system;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: _themeMode,
      routerConfig: appRouter,
    );
  }
}
```

> 到 Ch26 学会 Riverpod 后，你可以将 ThemeMode 交给 Riverpod 管理——任何页面都能读写，且自动持久化。

---

## 4. ThemeExtension — 自定义主题属性

当 ColorScheme 的 25 个颜色角色不够用时，用 `ThemeExtension` 扩展：

```dart
// 定义自定义主题属性
class AppColors extends ThemeExtension<AppColors> {
  final Color success;
  final Color warning;
  final Color bookmarkRibbon;

  const AppColors({
    required this.success,
    required this.warning,
    required this.bookmarkRibbon,
  });

  // 浅色模式值
  static const light = AppColors(
    success: Color(0xFF4CAF50),
    warning: Color(0xFFFF9800),
    bookmarkRibbon: Color(0xFFE91E63),
  );

  // 暗色模式值
  static const dark = AppColors(
    success: Color(0xFF81C784),
    warning: Color(0xFFFFB74D),
    bookmarkRibbon: Color(0xFFF06292),
  );

  @override
  AppColors copyWith({Color? success, Color? warning, Color? bookmarkRibbon}) {
    return AppColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      bookmarkRibbon: bookmarkRibbon ?? this.bookmarkRibbon,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) => this;
}

// 注册到 ThemeData
ThemeData(
  useMaterial3: true,
  extensions: const [AppColors.light],  // dark 主题用 AppColors.dark
);

// 使用
final appColors = Theme.of(context).extension<AppColors>()!;
Container(color: appColors.success);
```

---

## 5. Theme.of(context) 最佳实践

```dart
// ✅ 在 build 方法中使用——build 每次都会重新获取（响应主题切换）
Widget build(BuildContext context) {
  final colors = Theme.of(context).colorScheme;
  final textTheme = Theme.of(context).textTheme;

  return Container(
    color: colors.surface,
    child: Text('标题', style: textTheme.titleMedium),
  );
}

// ✅ 提取到 build 中的局部变量——简洁清晰
// ❌ 不要缓存在 initState 或字段中——主题切换时不会更新
// ❌ 不要在没有 BuildContext 的地方调用

// ❌ 永远不用硬编码颜色
// Container(color: Colors.blue);
// ✅ 使用主题色
// Container(color: Theme.of(context).colorScheme.primaryContainer);
```

---

## 6. 本章练习

1. 配置 Library App 的 `AppTheme.light()` 和 `AppTheme.dark()`
2. 在设置页面实现 SegmentedButton 主题切换（跟随系统/浅色/深色）
3. 为 Library App 定义一个 `AppColors` ThemeExtension（包含 success/warning/bookmark 颜色）
4. 将 Library App 中所有硬编码的颜色替换为 `Theme.of(context).colorScheme.*`

验证：切换主题模式后 App 全局颜色即时变化。

---

> **下一步**: [Chapter 13 — Widget 测试入门](./Chapter-13-Widget测试入门.md)
> 📖 **延伸阅读**: [Material 3 设计系统](https://m3.material.io) | [ColorScheme API](https://api.flutter.dev/flutter/material/ColorScheme-class.html) | [ThemeExtension API](https://api.flutter.dev/flutter/material/ThemeExtension-class.html)
