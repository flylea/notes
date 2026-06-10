> **Part**: Part IX | **上一章**: [Ch 39](./Chapter-39-响应式设计.md) | **下一章**: [Ch 41](./Chapter-41-无障碍.md)
> **官方文档**: [flutter.cn/ui/internationalization](https://docs.flutter.cn/ui/internationalization)

---

# 第 40 章：国际化（i18n）

## 0. 本章目标

Flutter i18n 架构（LocalizationsDelegate/AppLocalizations）、ARB 文件格式、gen_l10n 工具自动生成、RTL 适配（Directionality/TextDirection）、运行时语言切换、日期/数字本地化（intl 包）。

> 🎯 **Library App 产出**：中/英/阿拉伯语三语支持、RTL 布局适配、语言切换设置。

---

## 1. 配置

```yaml
# l10n.yaml
arb-dir: lib/l10n
template-arb-file: app_zh.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
synthetic-package: false
```

## 2. ARB 文件

```json
// lib/l10n/app_zh.arb
{ "@@locale": "zh",
  "appTitle": "图书馆管理系统", "searchHint": "搜索图书...",
  "borrow": "借阅", "return": "归还",
  "bookCount": "{count} 本书", "@bookCount": { "placeholders": { "count": { "type": "int" } } }
}
// lib/l10n/app_en.arb
{ "appTitle": "Library Management", "searchHint": "Search books...", "borrow": "Borrow", "return": "Return", "bookCount": "{count} books" }
// lib/l10n/app_ar.arb
{ "@@locale": "ar", "appTitle": "نظام المكتبة", "searchHint": "بحث...", "borrow": "استعارة", "return": "إرجاع", "bookCount": "{count} كتب" }
```

## 3. MaterialApp 集成

```dart
MaterialApp.router(
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: ref.watch(localeProvider),
);
```

## 4. 运行时语言切换

```dart
final localeProvider = StateProvider<Locale?>((ref) => null);  // null=跟随系统

// 使用
Text(AppLocalizations.of(context)!.appTitle);
Text(AppLocalizations.of(context)!.bookCount(42));  // "42 本书"
```

## 5. RTL 适配

```dart
// 使用 EdgeInsetsDirectional——自动适配 LTR/RTL
Padding(padding: const EdgeInsetsDirectional.only(start: 16), ...);

// Row/Column 的 textDirection
Row(textDirection: TextDirection.rtl, children: ...);

// 阿拉伯语下自动 RTL——不需要手动设置
// 框架根据 Locale('ar') 自动推断 TextDirection.rtl
```

---

> **下一步**: [Ch 41](./Chapter-41-无障碍.md)
