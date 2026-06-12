> **Part**: Part VIII — 本地持久化与离线
> **上一章**: [Chapter 38 — 搜索与发现](../Part-07-用户与权限系统/Chapter-38-搜索与发现.md)
> **下一章**: [Chapter 40 — Drift 本地数据库](./Chapter-40-Drift本地数据库.md)
> **官方文档**: [flutter.cn/data-and-backend/persistence](https://docs.flutter.cn/data-and-backend/persistence) | [pub.dev/packages/shared_preferences](https://pub.dev/packages/shared_preferences)

---

# 第 39 章：SharedPreferences 与用户偏好

## 0. 本章目标与前置依赖

**前置依赖**：已完成用户认证体系（Chapter 28），理解 Riverpod Provider 声明（Chapter 16）。

**本章目标**：
- 理解 SharedPreferences 的底层原理（Android SharedPreferences vs iOS NSUserDefaults）
- 掌握完整读写 API（getString/getBool/getInt/getDouble/getStringList + set 方法）
- 理解 SharedPreferences vs Hive CE vs flutter_secure_storage 的选型边界
- 掌握 Riverpod + SharedPreferences 的响应式集成模式
- 实现用户偏好持久化（主题/语言/排序/每页数量/生物识别开关/搜索历史）

> 🎯 **本章会在图书馆 App 中做什么**：持久化用户的所有偏好设置——主题选择（浅色/深色/跟随系统）、排序方式、每页显示数量、生物识别开关、搜索历史——让 App 记住用户的个性化选择。

---

## 1. SharedPreferences 底层原理

### 1.1 各平台存储介质

```
Android:
  SharedPreferences → /data/data/<package>/shared_prefs/*.xml
  本质：一个键值对 XML 文件，全部加载到内存中
  ⚠️ 不适合大量数据——每次读取都从 XML 解析整个文件

iOS:
  SharedPreferences → NSUserDefaults → .plist 文件
  本质：属性列表文件，系统级缓存，内存+磁盘双层

Web:
  SharedPreferences → window.localStorage
  本质：浏览器键值存储，同源策略隔离
```

### 1.2 数据加载时机

```dart
// SharedPreferences 在首次使用时异步加载整个文件到内存
// 之后的所有读写操作都是同步的（内存操作）

// ① 初始化——必须 await
final prefs = await SharedPreferences.getInstance();

// ② 之后的读——同步（内存命中，极快）
final theme = prefs.getString('theme') ?? 'system';  // O(1)

// ③ 写——同步内存 + 异步磁盘（框架自动处理）
await prefs.setString('theme', 'dark');  // await 仅等待磁盘写入确认
```

> **TS 经验**：SharedPreferences ≈ `localStorage`（Web）。都是同步读、异步写、键值对存储。区别是 SharedPreferences 有类型化 API（`getInt`/`getBool`），localStorage 只有 `getItem` 返回字符串。

---

## 2. 完整 API 速查

```dart
final prefs = await SharedPreferences.getInstance();

// ──── 读取（都有默认值参数）────
String theme = prefs.getString('theme_mode') ?? 'system';
bool isGrid = prefs.getBool('is_grid_view') ?? true;
int pageSize = prefs.getInt('page_size') ?? 20;
double rating = prefs.getDouble('min_rating') ?? 0.0;
List<String> history = prefs.getStringList('search_history') ?? [];

// ──── 写入（都是异步——返回 Future<bool>）────
await prefs.setString('theme_mode', 'dark');
await prefs.setBool('is_grid_view', false);
await prefs.setInt('page_size', 50);
await prefs.setDouble('min_rating', 3.5);
await prefs.setStringList('search_history', ['Flutter', 'Dart']);

// ──── 删除 ────
await prefs.remove('search_history');      // 删除单个键
await prefs.clear();                        // 清空所有（谨慎！）

// ──── 检查 ────
bool hasKey = prefs.containsKey('theme_mode');
Set<String> allKeys = prefs.getKeys();

// ──── 批量操作（减少磁盘 I/O）────
// 没有原生批量 API——但多次 set 会自动合并为一次磁盘写入（框架优化）
```

---

## 3. 数据存储选型决策树

```
数据是敏感的吗（Token/密码/密钥）？
  ├─ 是 → flutter_secure_storage（Keychain/EncryptedSharedPreferences）
  └─ 否 → 继续判断

数据结构是简单的键值对吗？
  ├─ 是 → 键值对 < 50 个？
  │   ├─ 是 → SharedPreferences ✅（本章）
  │   └─ 否 → Hive CE（更快的大规模键值存储）
  └─ 否 → 需要复杂查询（join/filter/sort）？
      ├─ 是 → Drift（SQLite ORM，Chapter 34）
      └─ 否 → Hive CE / ObjectBox
```

| 方案 | 数据类型 | 容量上限 | 加密 | 查询能力 | 适用场景 |
|------|---------|---------|------|---------|---------|
| **SharedPreferences** | String/int/double/bool/StringList | ~50 键 | ❌ | 无 | 用户偏好/设置 |
| **Hive CE** | 任意 Dart 对象 | 大 | ❌ | 按 key 读取 | 本地缓存/离线数据 |
| **flutter_secure_storage** | String 键值对 | ~50 键 | ✅ 系统级加密 | 无 | Token/密码/密钥 |
| **Drift** | 结构化数据（表） | 大 | ❌（可加 SQLCipher） | ✅ 完整 SQL | 复杂业务数据 |

---

## 4. PreferencesService — 统一偏好管理

```dart
// lib/core/local/preferences_service.dart
import 'package:shared_preferences/shared_preferences.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'preferences_service.g.dart';

/// 全局偏好管理服务——集中管理所有 SharedPreferences 键
class PreferencesService {
  late final SharedPreferences _prefs;

  // ──── 键名常量（防止拼写错误）────
  static const _kThemeMode = 'theme_mode';
  static const _kLocale = 'locale';
  static const _kSortBy = 'sort_by';
  static const _kPageSize = 'page_size';
  static const _kGridView = 'is_grid_view';
  static const _kBiometric = 'biometric_enabled';
  static const _kSearchHistory = 'search_history';
  static const _kMaxHistoryItems = 10;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // ──── 主题模式 ────
  // 'system' | 'light' | 'dark'
  String get themeMode => _prefs.getString(_kThemeMode) ?? 'system';
  Future<bool> setThemeMode(String mode) async {
    if (!['system', 'light', 'dark'].contains(mode)) {
      throw ArgumentError('Invalid theme mode: $mode');
    }
    return _prefs.setString(_kThemeMode, mode);
  }

  // ──── 语言偏好 ────
  // 'zh' | 'en' | 'ar' | null (跟随系统)
  String? get locale => _prefs.getString(_kLocale);
  Future<bool> setLocale(String? locale) {
    if (locale == null) return _prefs.remove(_kLocale);
    return _prefs.setString(_kLocale, locale);
  }

  // ──── 图书列表偏好 ────
  String get sortBy => _prefs.getString(_kSortBy) ?? 'title';
  Future<bool> setSortBy(String sortBy) => _prefs.setString(_kSortBy, sortBy);

  int get pageSize => _prefs.getInt(_kPageSize) ?? 20;
  Future<bool> setPageSize(int size) {
    if (size < 10 || size > 100) throw ArgumentError('Page size must be 10-100');
    return _prefs.setInt(_kPageSize, size);
  }

  bool get isGridView => _prefs.getBool(_kGridView) ?? true;
  Future<bool> setGridView(bool value) => _prefs.setBool(_kGridView, value);

  // ──── 安全偏好 ────
  bool get isBiometricEnabled => _prefs.getBool(_kBiometric) ?? false;
  Future<bool> setBiometricEnabled(bool value) => _prefs.setBool(_kBiometric, value);

  // ──── 搜索历史 ────
  List<String> get searchHistory => _prefs.getStringList(_kSearchHistory) ?? [];

  Future<void> addToSearchHistory(String query) async {
    if (query.trim().isEmpty) return;
    var history = _prefs.getStringList(_kSearchHistory) ?? [];
    history.remove(query);                    // 去重——相同搜索词移到最前面
    history.insert(0, query);
    if (history.length > _kMaxHistoryItems) {
      history = history.sublist(0, _kMaxHistoryItems);
    }
    await _prefs.setStringList(_kSearchHistory, history);
  }

  Future<void> clearSearchHistory() async {
    await _prefs.remove(_kSearchHistory);
  }

  // ──── 批量重置 ────
  Future<void> resetAll() async {
    await _prefs.clear();
  }
}

// ──── Riverpod Provider ────
@Riverpod(keepAlive: true)
PreferencesService preferencesService(PreferencesServiceRef ref) {
  throw UnimplementedError('Must be overridden in main() after init');
}
```

---

## 5. Riverpod + SharedPreferences 响应式集成

### 5.1 偏好读取 Provider

```dart
// lib/features/settings/view_models/settings_view_model.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'settings_view_model.g.dart';

// ① 主题模式 Provider——改变时自动通知 UI
@riverpod
class ThemeModeNotifier extends _$ThemeModeNotifier {
  @override
  String build() {
    // build() 中读取 SharedPreferences 初始值
    return ref.watch(preferencesServiceProvider).themeMode;
  }

  Future<void> setThemeMode(String mode) async {
    await ref.read(preferencesServiceProvider).setThemeMode(mode);
    state = mode;  // 更新状态 → ref.watch 的 Widget 自动重建
  }
}

// ② 排序偏好 Provider
@riverpod
class SortByNotifier extends _$SortByNotifier {
  @override
  String build() => ref.watch(preferencesServiceProvider).sortBy;

  Future<void> setSortBy(String sortBy) async {
    await ref.read(preferencesServiceProvider).setSortBy(sortBy);
    state = sortBy;
  }
}

// ③ 搜索历史 Provider
@riverpod
class SearchHistoryNotifier extends _$SearchHistoryNotifier {
  @override
  List<String> build() => ref.watch(preferencesServiceProvider).searchHistory;

  Future<void> addSearch(String query) async {
    await ref.read(preferencesServiceProvider).addToSearchHistory(query);
    state = ref.read(preferencesServiceProvider).searchHistory;
  }

  Future<void> clearHistory() async {
    await ref.read(preferencesServiceProvider).clearSearchHistory();
    state = [];
  }
}
```

### 5.2 main() 中初始化

```dart
// lib/main.dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ① 初始化 SharedPreferences
  final prefsService = PreferencesService();
  await prefsService.init();

  // ② 初始化 Supabase
  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseKey);

  runApp(
    ProviderScope(
      overrides: [
        // ③ 将已初始化的实例注入 Riverpod
        preferencesServiceProvider.overrideWithValue(prefsService),
      ],
      child: const LibraryApp(),
    ),
  );
}
```

---

## 6. 图书馆 App 实战——设置页面完整实现

```dart
// lib/features/settings/screens/settings_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeNotifierProvider);
    final sortBy = ref.watch(sortByNotifierProvider);
    final searchHistory = ref.watch(searchHistoryNotifierProvider);
    final isBiometric = ref.watch(preferencesServiceProvider).isBiometricEnabled;
    final isGrid = ref.watch(preferencesServiceProvider).isGridView;
    final pageSize = ref.watch(preferencesServiceProvider).pageSize;

    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: ListView(
        children: [
          // ──── 外观 ────
          _buildSectionHeader(context, '外观'),
          ListTile(
            leading: const Icon(Icons.palette),
            title: const Text('主题模式'),
            subtitle: Text(_themeLabel(themeMode)),
            trailing: SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'system', label: Text('自动')),
                ButtonSegment(value: 'light', label: Text('浅色')),
                ButtonSegment(value: 'dark', label: Text('深色')),
              ],
              selected: {themeMode},
              onSelectionChanged: (v) => ref.read(themeModeNotifierProvider.notifier).setThemeMode(v.first),
            ),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.grid_view),
            title: const Text('网格视图'),
            value: isGrid,
            onChanged: (v) => ref.read(preferencesServiceProvider).setGridView(v),
          ),

          // ──── 图书列表 ────
          _buildSectionHeader(context, '图书列表'),
          ListTile(
            leading: const Icon(Icons.sort),
            title: const Text('默认排序'),
            subtitle: Text(_sortLabel(sortBy)),
            trailing: DropdownButton<String>(
              value: sortBy,
              onChanged: (v) => ref.read(sortByNotifierProvider.notifier).setSortBy(v!),
              items: const [
                DropdownMenuItem(value: 'title', child: Text('按书名')),
                DropdownMenuItem(value: 'author', child: Text('按作者')),
                DropdownMenuItem(value: 'rating', child: Text('按评分')),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.list_alt),
            title: const Text('每页显示数量'),
            subtitle: Text('$pageSize 本'),
            trailing: Slider(
              value: pageSize.toDouble(),
              min: 10, max: 100, divisions: 9,
              label: '$pageSize',
              onChanged: (v) => ref.read(preferencesServiceProvider).setPageSize(v.round()),
            ),
          ),

          // ──── 安全 ────
          _buildSectionHeader(context, '安全'),
          SwitchListTile(
            secondary: const Icon(Icons.fingerprint),
            title: const Text('生物识别登录'),
            subtitle: const Text('使用指纹或面部识别解锁 App'),
            value: isBiometric,
            onChanged: (v) => ref.read(preferencesServiceProvider).setBiometricEnabled(v),
          ),

          // ──── 搜索历史 ────
          _buildSectionHeader(context, '搜索历史'),
          if (searchHistory.isEmpty)
            const ListTile(subtitle: Text('暂无搜索记录'))
          else ...[
            ...searchHistory.map((query) => ListTile(
              leading: const Icon(Icons.history, size: 20),
              title: Text(query),
              dense: true,
            )),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Colors.red),
              title: const Text('清除搜索历史', style: TextStyle(color: Colors.red)),
              onTap: () => ref.read(searchHistoryNotifierProvider.notifier).clearHistory(),
            ),
          ],

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(
        color: Theme.of(context).colorScheme.primary,
      )),
    );
  }

  String _themeLabel(String mode) => switch (mode) {
    'system' => '跟随系统', 'light' => '浅色模式', 'dark' => '深色模式', _ => mode,
  };

  String _sortLabel(String sort) => switch (sort) {
    'title' => '按书名', 'author' => '按作者', 'rating' => '按评分', _ => sort,
  };
}
```

---

## 7. 常见错误与最佳实践

```dart
// ❌ 错误 1：忘记 await SharedPreferences.getInstance()
// final prefs = SharedPreferences.getInstance();  // ❌ 返回 Future
// prefs.getString('key');                          // ❌ 类型错误
final prefs = await SharedPreferences.getInstance();  // ✅

// ❌ 错误 2：用 SharedPreferences 存敏感数据
// await prefs.setString('access_token', token);    // ❌ 明文存储！
// ✅ 正确：Token 用 flutter_secure_storage
await secureStorage.write(key: 'access_token', value: token);

// ❌ 错误 3：用 SharedPreferences 存大量结构化数据
// await prefs.setString('books', jsonEncode(books));  // ❌ 每次读取都要反序列化全部
// ✅ 正确：结构化数据用 Drift 数据库

// ❌ 错误 4：在 build() 中直接 await SharedPreferences
// @override
// Widget build(BuildContext context) async {  // ❌ build 不能是 async
//   final prefs = await SharedPreferences.getInstance();
// }
// ✅ 正确：在 initState 或 Provider 中异步加载

// ❌ 错误 5：键名拼写不一致
// await prefs.setString('themeMode', 'dark');
// final theme = prefs.getString('theme_mode');  // ❌ 键名不一致！返回 null
// ✅ 正确：使用常量定义键名
static const _kThemeMode = 'theme_mode';
await prefs.setString(_kThemeMode, 'dark');
final theme = prefs.getString(_kThemeMode);
```

| 最佳实践 | 说明 |
|---------|------|
| 用常量定义键名 | 防止拼写错误，方便全局搜索和重命名 |
| 使用类型化 API | `getBool`/`getInt` 而非 `get` + 手动转换 |
| 始终提供默认值 | `getString('key') ?? 'default'`——键不存在时返回 null |
| 写操作只做一次 | 批量修改时合并为一次 notifyListeners |
| 不要存敏感数据 | Token/密码/密钥 → flutter_secure_storage |
| 不要存大量数据 | > 50 键或 > 1MB → Hive CE 或 Drift |

---

## 8. 与 Web localStorage 完整对照

| localStorage (JavaScript) | SharedPreferences (Dart/Flutter) |
|--------------------------|-------------------------------|
| `localStorage.setItem('key', 'value')` | `await prefs.setString('key', 'value')` |
| `localStorage.getItem('key')` | `prefs.getString('key') ?? 'default'` |
| `localStorage.removeItem('key')` | `await prefs.remove('key')` |
| `localStorage.clear()` | `await prefs.clear()` |
| `JSON.parse(localStorage.getItem('key'))` | `prefs.getStringList('key')` (仅字符串列表) |
| 数据永久保留（除非清除） | 数据永久保留（除非清除/卸载） |
| ~5-10MB 限制 | Android 无硬限制，iOS 无硬限制 |
| 同步读写 | 初始化异步 + 之后同步读 / 异步写 |

---

## 9. 本章小结

| 你学到了什么 | 核心要点 |
|-------------|---------|
| SharedPreferences 原理 | Android XML / iOS plist / Web localStorage——全部加载到内存，小数据极快 |
| 选型决策 | Token → SecureStorage / 偏好 → SharedPreferences / 缓存 → Hive CE / 数据 → Drift |
| 完整 API | getString/getBool/getInt/getDouble/getStringList + set/remove/clear |
| Riverpod 集成 | AsyncNotifier 封装——写磁盘 + 更新 state → 自动通知 UI |
| 图书馆 App 实战 | 主题/语言/排序/每页数量/生物识别/搜索历史——完整设置页 |

---

## 10. 本章练习

1. **添加"每页显示数量"设置项**：在 `PreferencesService` 中添加 `pageSize` 的 getter/setter（默认 20），在设置页面的"显示"分组中添加下拉选择（10/20/50 三项），通过 `AsyncNotifier` 模式创建 `PageSizeNotifier` Provider。在图书列表页使用 `ref.watch(pageSizeNotifierProvider)` 控制每页加载数量。验证标准：修改每页数量后图书列表立即刷新；重启 App 后设置仍然保持。

2. **实现"清除全部偏好"功能**：在设置页面底部添加"重置所有设置"按钮，点击后弹出确认对话框，确认后调用 `preferencesService.clearAll()` 清除所有偏好，并将所有 `StateNotifier` 重置为默认值（主题→跟随系统、排序→默认、每页数量→20）。验证标准：清除后所有设置恢复默认值，重启 App 后确认设置未恢复（已持久化清除）。

3. **添加首次启动引导标记**：在 `PreferencesService` 中添加 `isFirstLaunch` 布尔值（默认 true），在 `SplashScreen` 中检查该标记，首次启动时跳转到引导页（`OnboardingScreen`，包含 3 页功能简介的 PageView），用户滑动到最后点击"开始使用"后将该值设为 false。验证标准：全新安装 App 后显示引导页；第二次启动直接进入主页。

验证标准：以上 3 个练习编译通过，在模拟器中完整走通修改→重启→验证流程。

---

> **下一步**: [Chapter 40 — Drift 本地数据库](./Chapter-40-Drift本地数据库.md)
> **原始文档**: [flutter.cn/data-and-backend/persistence](https://docs.flutter.cn/data-and-backend/persistence) | [pub.dev/packages/shared_preferences](https://pub.dev/packages/shared_preferences)
