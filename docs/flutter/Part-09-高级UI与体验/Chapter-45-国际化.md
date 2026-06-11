# 第 45 章：国际化（i18n）

> **Part**: Part IX — 高级 UI 与体验
> **上一章**: [Chapter 44 — 响应式设计](./Chapter-44-响应式设计.md)
> **下一章**: [Chapter 46 — 无障碍](./Chapter-46-无障碍.md)
> **官方文档**: [flutter.dev/ui/internationalization](https://docs.flutter.dev/ui/internationalization)

---

## 0. 本章目标

- 掌握 Flutter 国际化完整方案：ARB 文件、gen_l10n 代码生成
- 学会复数规则、带参数消息、日期/数字/货币本地化
- 实现运行时语言切换并记忆用户选择
- 理解 RTL（阿拉伯语等）布局适配

> 🎯 **本章产出**：Library App 的中/英双语支持 + 运行时语言切换 + 语言偏好持久化。

---

## 1. 国际化架构概览

> **ARB（Application Resource Bundle）**是 Google 定义的翻译文件格式——本质是 JSON，但额外支持复数规则、占位符等国际化特性。**gen_l10n** 是 Flutter SDK 自带的代码生成工具，读取 ARB 文件后自动生成类型安全的 Dart 翻译类。**l10n.yaml** 是配置文件——告诉 gen_l10n 去哪找 ARB 文件、输出什么文件名。

```
l10n.yaml           → 告诉 gen_l10n 去哪找 ARB 文件
lib/l10n/
  app_zh.arb        → 中文翻译（模板文件）
  app_en.arb        → 英文翻译
gen_l10n 自动生成 →
  lib/l10n/app_localizations.dart      → 翻译类
  lib/l10n/app_localizations_zh.dart   → 中文具体翻译
  lib/l10n/app_localizations_en.dart   → 英文具体翻译
```

---

## 2. 基础配置

### 2.1 添加依赖

```yaml
# pubspec.yaml
dependencies:
  flutter_localizations:
    sdk: flutter
  intl: ^0.19.0
```

### 2.2 创建 l10n.yaml

```yaml
# l10n.yaml（项目根目录）
arb-dir: lib/l10n                     # ARB 翻译文件存放目录
template-arb-file: app_zh.arb         # 模板文件（以哪种语言为基准；新增 key 只需加入此文件）
output-localization-file: app_localizations.dart  # 生成的 Dart 文件名
output-class: AppLocalizations        # 生成的类名（调用时 AppLocalizations.of(context)!）
nullable-getter: false                # false=生成非空 getter（推荐；true 则返回可空类型）
synthetic-package: false              # false=生成在项目目录下而非虚拟包中（便于查看和调试）
```

### 2.3 ARB 文件

```json
// lib/l10n/app_zh.arb（模板文件，@@locale 可省略）
{
  "@@locale": "zh",
  "appTitle": "图书馆管理系统",
  "searchHint": "搜索图书...",
  "borrow": "借阅",
  "returnBook": "归还",
  "settings": "设置",
  "language": "语言",
  "noBooks": "暂无图书",
  "errorNetwork": "网络连接失败，请检查网络设置"
}
```

```json
// lib/l10n/app_en.arb
{
  "appTitle": "Library Manager",
  "searchHint": "Search books...",
  "borrow": "Borrow",
  "returnBook": "Return",
  "settings": "Settings",
  "language": "Language",
  "noBooks": "No books found",
  "errorNetwork": "Network error. Please check your connection."
}
```

---

## 3. 复数规则

ARB 支持 ICU 复数规则，语法为 `{variable, plural, ...}`。

> **ICU MessageFormat 的本质是"模板选择"**——根据数值（比如书籍数量）选择不同的文本模板。中文比较简单只有一种复数形式，但英文有 single/plural 两种，阿拉伯语有 6 种。这套语法让你用统一的方式处理所有语言的复数规则。

```json
// app_zh.arb
{
  "bookCount": "{count, plural, =0{书架上空空如也} =1{1 本书} other{{count} 本书}}",
  "@bookCount": {
    "placeholders": {
      "count": { "type": "int" }
    }
  }
}
```

```json
// app_en.arb
{
  "bookCount": "{count, plural, =0{No books} =1{1 book} other{{count} books}}"
}
```

使用：
```dart
Text(AppLocalizations.of(context)!.bookCount(0));  // "书架上空空如也"
Text(AppLocalizations.of(context)!.bookCount(1));  // "1 本书"
Text(AppLocalizations.of(context)!.bookCount(42)); // "42 本书"
```

---

## 4. 带参数的复杂消息

### 4.1 基本占位符

```json
{
  "greeting": "欢迎回来，{userName}",
  "@greeting": {
    "placeholders": {
      "userName": { "type": "String" }
    }
  }
}
```

```dart
Text(AppLocalizations.of(context)!.greeting('Alice'));
// 中文：欢迎回来，Alice
// 英文需对应翻译：Welcome back, Alice
```

### 4.2 ICU Select 模式

```json
{
  "borrowStatus": "{status, select, available{可借} borrowed{已借出} reserved{已预约} other{未知}}",
  "@borrowStatus": {
    "placeholders": {
      "status": { "type": "String" }
    }
  }
}
```

```dart
// 根据 enum 值选择翻译
String statusLabel(BookStatus status) {
  return AppLocalizations.of(context)!.borrowStatus(status.name);
}
```

---

## 5. 日期、数字、货币本地化

```dart
import 'package:intl/intl.dart';

// 日期格式化
final now = DateTime.now();
DateFormat.yMMMd('zh').format(now);    // "2026年6月11日"
DateFormat.yMMMd('en_US').format(now); // "Jun 11, 2026"

// 数字格式化
NumberFormat.decimalPattern('zh').format(12345); // "12,345"

// 货币格式化
final price = NumberFormat.currency(locale: 'zh_CN', symbol: '¥');
price.format(99.9);  // "¥99.90"

final usd = NumberFormat.currency(locale: 'en_US', symbol: '\$');
usd.format(99.9);    // "$99.90"
```

---

## 6. MaterialApp 集成

```dart
// lib/app.dart
class LibraryApp extends ConsumerWidget {
  const LibraryApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      title: 'Library App',
      // ① 注册翻译
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      // ② 当前 locale（null 时跟随系统）
      locale: locale,
      routerConfig: appRouter,
      // ...
    );
  }
}
```

---

## 7. 运行时语言切换与持久化

```dart
// lib/core/i18n/locale_provider.dart
import 'package:shared_preferences/shared_preferences.dart';

// 支持的语言列表
const supportedLanguageCodes = ['zh', 'en'];

// Provider
final localeProvider = StateProvider<Locale?>((ref) {
  // 初始为 null，表示跟随系统
  return null;
});

// 切换语言并持久化
class LocaleService {
  static const _key = 'app_locale';

  static Future<void> setLocale(String languageCode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, languageCode);
  }

  static Future<String?> getSavedLocale() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_key);
  }

  static Locale? localeFromCode(String? code) {
    if (code == null) return null;
    return Locale(code);
  }
}
```

```dart
// lib/screens/settings_screen.dart — 语言切换 UI
class LanguageSetting extends ConsumerWidget {
  const LanguageSetting({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentLocale = ref.watch(localeProvider);
    final l10n = AppLocalizations.of(context)!;

    return ListTile(
      title: Text(l10n.language),
      subtitle: Text(_localeDisplayName(currentLocale)),
      onTap: () => _showLanguagePicker(context, ref),
    );
  }

  String _localeDisplayName(Locale? locale) {
    return switch (locale?.languageCode) {
      'zh' => '中文',
      'en' => 'English',
      _ => '跟随系统',
    };
  }

  void _showLanguagePicker(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        children: [
          _buildOption(ctx, ref, null, '跟随系统'),
          _buildOption(ctx, ref, const Locale('zh'), '中文'),
          _buildOption(ctx, ref, const Locale('en'), 'English'),
        ],
      ),
    );
  }

  Widget _buildOption(
    BuildContext ctx,
    WidgetRef ref,
    Locale? locale,
    String label,
  ) {
    return SimpleDialogOption(
      onPressed: () {
        ref.read(localeProvider.notifier).state = locale;
        if (locale != null) {
          LocaleService.setLocale(locale.languageCode);
        } else {
          LocaleService.setLocale('system');
        }
        Navigator.pop(ctx);
      },
      child: Text(label),
    );
  }
}
```

---

## 8. RTL 布局适配

阿拉伯语等 RTL 语言需要镜像布局。Flutter 通过 `Directionality` 和 `EdgeInsetsDirectional` 自动适配：

```dart
// ✅ 使用 EdgeInsetsDirectional — 自动适配 LTR/RTL
Padding(
  padding: const EdgeInsetsDirectional.only(start: 16, end: 8),
  child: Text(l10n.appTitle),
);

// ✅ 使用 start/end 代替 left/right
Row(
  children: [
    const Icon(Icons.book),
    const SizedBox(width: 8),
    Text(l10n.appTitle),
  ],
);

// ❌ 避免硬编码 left/right（RTL 下不会自动翻转）
// padding: const EdgeInsets.only(left: 16),
```

**测试 RTL**：在 MaterialApp 中临时设置 `locale: const Locale('ar')` 验证布局是否正确翻转。

---

## 9. 翻译工作流

对于真实项目，推荐以下翻译管理流程：

1. **开发阶段**：只维护中文 ARB（模板文件），英文 ARB 用机器翻译填充初稿
2. **提审前**：将 ARB 文件发给翻译人员或使用翻译平台
3. **持续维护**：新增 key 后在所有语言的 ARB 中同步添加
4. **验证**：`flutter gen-l10n` 后检查生成代码无编译错误

---

## 10. 本章练习

1. 配置 Library App 的中英双语支持，至少包含 appTitle、searchHint、borrow、returnBook、noBooks 5 个 key
2. 实现 bookCount 的复数翻译（中英文各有一套复数规则）
3. 在设置页面实现语言切换功能并持久化用户选择
4. 为 Library App 的所有可见文本查找并替换为 `AppLocalizations.of(context)!` 调用
5. **选做**：添加第三种语言（如日语）的 ARB 文件

验证：切换系统语言后 App 文本自动切换；在 App 内手动切换语言后立即生效，关闭重开后保持选择。

---

> 📖 **延伸阅读**: [Flutter 国际化](https://docs.flutter.dev/ui/accessibility-and-internationalization/internationalization) | [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/) | [ARB 规范](https://github.com/google/app-resource-bundle/wiki/ApplicationResourceBundleSpecification)
