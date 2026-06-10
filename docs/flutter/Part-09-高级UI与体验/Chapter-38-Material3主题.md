> **Part**: Part IX | **上一章**: [Ch 37](./Chapter-37-CustomPainter.md) | **下一章**: [Ch 39](./Chapter-39-响应式设计.md)
> **官方文档**: [flutter.cn/ui/design/material](https://docs.flutter.cn/ui/design/material)

---

# 第 38 章：Material 3 主题系统完整定制

## 0. 本章目标

ThemeData 完整配置（ColorScheme/TextTheme/Component Themes）、ColorScheme.fromSeed（Dynamic Color——一个种子色自动生成 25+ 颜色角色）、暗黑模式（darkTheme + ThemeMode）、TextTheme 排版层级（display/headline/title/body/label 五级各三档）、google_fonts 自定义字体、与 CSS 变量体系 + Tailwind 设计系统对照。

> 🎯 **Library App 产出**：品牌色完整主题 fromSeed、深色/浅色切换（设置页+全局状态）、统一组件样式（Button/Card/Input 全一致）。

---

## 1. 完整主题配置

```dart
// lib/core/theme/app_theme.dart
import 'package:flutter/material.dart';

class AppTheme {
  static ThemeData light() => ThemeData(
    useMaterial3: true,
    colorSchemeSeed: const Color(0xFF1565C0),  // 品牌蓝——自动生成 25+ 颜色角色
    brightness: Brightness.light,
    textTheme: _textTheme,
    appBarTheme: const AppBarTheme(centerTitle: true, scrolledUnderElevation: 1),
    cardTheme: CardTheme(elevation: 1, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    inputDecorationTheme: InputDecorationTheme(border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), filled: true, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14)),
    elevatedButtonTheme: ElevatedButtonThemeData(style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)))),
  );

  static ThemeData dark() => ThemeData(
    useMaterial3: true,
    colorSchemeSeed: const Color(0xFF42A5F5),
    brightness: Brightness.dark,
    textTheme: _textTheme,
    // Component themes 同上...
  );

  static const _textTheme = TextTheme(
    displayLarge: TextStyle(fontSize: 57, fontWeight: FontWeight.w400),
    headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w400),
    titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w500),
    titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
    bodyLarge: TextStyle(fontSize: 16, fontWeight: FontWeight.w400),
    bodyMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w400),
    labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
  );
}
```

## 2. 主题切换集成

```dart
// MaterialApp 接入
MaterialApp.router(
  theme: AppTheme.light(),
  darkTheme: AppTheme.dark(),
  themeMode: ref.watch(themeModeProvider),  // ThemeMode.system/light/dark
);

// 主题模式 Provider
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.system);

// 设置页切换
SegmentedButton<ThemeMode>(
  segments: const [
    ButtonSegment(value: ThemeMode.system, label: Text('自动')),
    ButtonSegment(value: ThemeMode.light, label: Text('浅色')),
    ButtonSegment(value: ThemeMode.dark, label: Text('深色')),
  ],
  selected: {ref.watch(themeModeProvider)},
  onSelectionChanged: (v) => ref.read(themeModeProvider.notifier).state = v.first,
);
```

## 3. ColorScheme 颜色角色

| 角色 | 用途 |
|------|------|
| primary / onPrimary | 主色 / 主色上的文字 |
| secondary / onSecondary | 次要色 |
| tertiary / onTertiary | 第三色（强调） |
| error / onError | 错误色 |
| surface / onSurface | 表面色（卡片/Sheet 背景） |
| surfaceContainerHighest | 输入框/搜索栏填充色 |
| outline | 边框色 |

```dart
// 使用主题色——永远不用 Colors.blue 硬编码
Container(color: Theme.of(context).colorScheme.primaryContainer);
Text('标题', style: Theme.of(context).textTheme.titleMedium);
```

## 4. google_fonts + ColorScheme.fromSeed

```dart
// 自定义字体
final textTheme = GoogleFonts.notoSansTextTheme(Theme.of(context).textTheme);

// 动态取色（Android 12+ 壁纸取色）
final dynamicScheme = ColorScheme.fromSeed(
  seedColor: const Color(0xFF1565C0),
  dynamicSchemeVariant: DynamicSchemeVariant.tonalSpot,
);
```

## 5. 与 CSS Tailwind 对照

| Flutter | Tailwind |
|---------|----------|
| `Theme.of(context).colorScheme.primary` | `var(--color-primary)` / `text-primary` |
| `Theme.of(context).textTheme.titleMedium` | `text-lg font-medium` |
| `ThemeData(colorSchemeSeed: ...)` | `tailwind.config.ts` theme.extend |
| `ThemeMode.system` | `prefers-color-scheme: dark` media query |
| Component Themes（Card/Button/Input） | `@layer components` 统一样式 |

---

> **下一步**: [Ch 39 — 响应式设计](./Chapter-39-响应式设计.md)
