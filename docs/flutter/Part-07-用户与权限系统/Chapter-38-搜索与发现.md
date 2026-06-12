> **Part**: Part VII — 用户与权限系统
> **上一章**: [Chapter 37 — 借阅系统状态机](./Chapter-37-借阅系统状态机.md)
> **下一章**: [Part VIII — 本地持久化与离线](../Part-08-本地持久化与离线/)
> **官方文档**: [supabase.com/docs/guides/database/full-text-search](https://supabase.com/docs/guides/database/full-text-search)

---

# 第 38 章：搜索与发现 — 全文搜索、筛选与推荐

## 0. 本章目标

掌握 PostgreSQL 全文搜索（to_tsvector/to_tsquery/ts_rank）、Supabase .textSearch()、复合搜索（书名+作者+ISBN+标签）、高级筛选（分类/评分/年份 多条件组合）、搜索防抖（Debounce 300ms）、搜索历史与建议。

> 🎯 **Library App 产出**：全文搜索（搜索框→Debounce→PostgreSQL FTS→结果）、高级筛选面板（分类+评分范围+年份范围）、排序切换、搜索历史（最近10条）。

---

## 1. PostgreSQL 全文搜索配置

```sql
-- supabase/migrations/003_full_text_search.sql
ALTER TABLE books ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(author, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(isbn, '')), 'C')
  ) STORED;

CREATE INDEX idx_books_search ON books USING GIN(search_vector);
```

## 2. Supabase 端搜索

```dart
// 基本全文搜索
final results = await supabase.from('books').select().textSearch('search_vector', query, config: 'english');

// 复合搜索（全文搜索 + 过滤 + 排序）
final results = await supabase.from('books').select()
  .textSearch('search_vector', query)
  .eq('category', selectedCategory)
  .gte('rating', minRating)
  .order('rating', ascending: false)
  .limit(20);
```

## 3. 搜索 ViewModel（防抖 + 历史）

```dart
@riverpod
class SearchViewModel extends _$SearchViewModel {
  Timer? _debounce;

  @override
  Future<SearchUiState> build() async => const SearchUiState();

  Future<void> onQueryChanged(String query) async {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      state = const AsyncValue.loading();
      state = await AsyncValue.guard(() async {
        final repo = ref.read(bookRepositoryProvider);
        if (query.trim().isEmpty) return const SearchUiState();
        final results = await repo.searchBooks(query);
        return SearchUiState(query: query, results: results);
      });
    });
  }
}

@freezed
class SearchUiState with _$SearchUiState {
  const factory SearchUiState({@Default('') String query, @Default([]) List<Book> results, @Default(SortBy.relevance) SortBy sortBy}) = _SearchUiState;
}
```

## 4. 高级筛选面板

```dart
class AdvancedFilterPanel extends ConsumerStatefulWidget {
  final void Function(SearchFilters filters) onApply;
  ...
}

@freezed
class SearchFilters with _$SearchFilters {
  const factory SearchFilters({BookCategory? category, @Default(0.0) double minRating, @Default(5.0) double maxRating, int? yearFrom, int? yearTo, @Default(SortBy.relevance) SortBy sortBy}) = _SearchFilters;
}
```

## 5. 搜索历史

```dart
// SharedPreferences 存储最近10条搜索
class SearchHistoryService {
  final _prefs = SharedPreferences.getInstance();
  static const _key = 'search_history';
  static const _maxItems = 10;

  Future<List<String>> getHistory() async {
    final prefs = await _prefs;
    return prefs.getStringList(_key) ?? [];
  }

  Future<void> addSearch(String query) async {
    final prefs = await _prefs;
    var history = prefs.getStringList(_key) ?? [];
    history.remove(query); // 去重
    history.insert(0, query);
    if (history.length > _maxItems) history = history.sublist(0, _maxItems);
    await prefs.setStringList(_key, history);
  }
}
```

---

## 6. 本章小结

PostgreSQL FTS（tsvector + GIN 索引）→ Supabase .textSearch() → Debounce 300ms → 搜索结果展示。高级筛选：category + rating range + year range + sortBy ——全链式组合查询。搜索历史：SharedPreferences 存最近10条。

---

## 7. 本章练习

1. **实现排序切换功能**：在搜索结果页顶部添加排序下拉选择器，支持"按相关度"、"按评分降序"、"按出版年份降序"三种排序方式。修改 `SearchUiState` 增加 `sortBy` 字段，切换排序后重新调用 Repository 的 `searchBooks` 方法并传入 `sortBy` 参数。验证标准：切换排序方式后搜索结果列表顺序改变；默认排序为按相关度。

2. **实现搜索建议下拉**：在搜索框获得焦点且输入为空时，从 `SearchHistoryService` 读取最近 5 条搜索历史，以 `PopupMenuButton` 或自定义下拉列表形式展示在搜索框下方。点击某条建议后自动填入搜索框并触发搜索。验证标准：点击空搜索框显示历史列表；点击某条历史记录后自动搜索；无历史记录时不显示下拉列表。

3. **扩展复合搜索**：在 `AdvancedFilterPanel` 的 `SearchFilters` 中增加 `language` 和 `publisher` 两个文本筛选字段。修改 PostgreSQL 搜索 RPC，在 WHERE 子句中增加 `language ILIKE` 和 `publisher ILIKE` 的模糊匹配条件。验证标准：筛选面板增加两个新输入框；填写后搜索结果只显示匹配语言和出版社的图书。

验证标准：以上 3 个练习在模拟器中手动测试，筛选 + 搜索 + 排序可组合使用。

---

> **下一步**: [Part VIII — 本地持久化与离线](../Part-08-本地持久化与离线/)
