> **Part**: Part VI — 应用架构
> **上一章**: [Chapter 27 — Bloc 对比学习](../Part-05-状态管理/Chapter-27-Bloc对比学习.md)
> **下一章**: [Chapter 29 — MVVM 模式](./Chapter-29-MVVM模式.md)
> **官方文档**: [flutter.cn/app-architecture/concepts](https://docs.flutter.cn/app-architecture/concepts) | [flutter.cn/app-architecture/guide](https://docs.flutter.cn/app-architecture/guide)

---

# 第 28 章：Flutter 应用架构设计理念

## 0. 本章目标与前置依赖

**前置依赖**：已完成 Supabase 集成（Chapter 21-22），使用 Riverpod 管理状态（Chapter 16）。

**本章目标**：
- 理解三层架构（Presentation → Domain → Data）的职责边界
- 掌握单向数据流（UDF）在 Flutter 中的具体实现
- 理解 MVVM 在 Flutter 中的映射关系（View=Widget, ViewModel=AsyncNotifier）
- 判断 Clean Architecture 的适用场景（何时带来价值 vs 何时是过度工程）
- 分析当前 Library App 的"面条代码"问题并画出重构路线

> 🎯 **本章定位**：这是 Part VI 的"设计蓝图"章——没有代码产出，但建立后面四章重构的全局视角。如果你跳过了本章直接写代码，你会不理解"为什么要这样分层"。

---

## 1. 为什么需要架构——从面条代码说起

### 1.1 当前 Library App 的问题

回顾我们 22 章积累的代码，打开 `home_screen.dart`：

```dart
// 😱 当前 home_screen.dart 中的问题
class _HomeScreenState extends ConsumerState<HomeScreen> {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // ① 直接在 Widget 中调用 Supabase
    final booksAsync = ref.watch(bookListProvider);

    return booksAsync.when(
      data: (books) {
        // ② 业务逻辑散落在 Widget 中
        final filtered = books.where((b) => b.rating > 4.0).toList();

        // ③ 点击事件中直接操作 Supabase
        return ListView.builder(
          itemCount: filtered.length,
          itemBuilder: (_, i) => ListTile(
            onTap: () async {
              // ④ Widget 直接调用数据层
              await Supabase.instance.client
                  .from('borrow_records')
                  .insert({...});
              ref.invalidate(bookListProvider);
            },
          ),
        );
      },
    );
  }
}
```

**四个具体问题**：

| 问题 | 表现 | 后果 |
|------|------|------|
| ① Widget 直接调 Supabase | `Supabase.instance.client.from(...)` 出现在 build() 中 | 换后端（比如换成自有 REST API）需要改所有 Widget |
| ② 业务逻辑散落 | 过滤/排序/计算逻辑写在 Widget 中 | 同样的逻辑在多个页面重复，改一处漏一处 |
| ③ 数据层无抽象 | 没有 Repository 接口 | 无法单元测试——测试必须连真实 Supabase |
| ④ 职责混杂 | Widget 同时承担渲染、业务逻辑、数据访问 | 单文件 300+ 行，难以阅读和维护 |

### 1.2 什么是好架构

好架构的核心指标只有三个：

1. **可测试**：核心业务逻辑能不依赖 UI 框架独立测试
2. **可替换**：更换数据源（Supabase → REST API → Mock）不需要改 UI 代码
3. **可理解**：新人打开项目，能根据目录结构猜到每个文件的职责

这些目标不是靠"写更多代码"达到的——是靠**把不同职责的代码放进不同的层**。

---

## 2. 三层架构

```
┌──────────────────────────────────────────────┐
│  Presentation Layer (UI 层)                   │
│  ─────────────────────────────────────────── │
│  包含：Widget + ViewModel                     │
│  职责：渲染 UI / 转发用户事件 / 持有 UI 状态   │
│  不碰：API 调用 / 数据库操作 / 纯业务计算      │
│  依赖方向：依赖 Domain 层（不依赖 Data 层）     │
├──────────────────────────────────────────────┤
│  Domain Layer (领域层，可选)                   │
│  ─────────────────────────────────────────── │
│  包含：Entity / Repository 抽象接口 / UseCase  │
│  职责：定义"核心业务规则"                      │
│  不碰：Flutter / Dio / Supabase / UI 任何东西  │
│  依赖方向：不依赖任何人（最内层）                │
├──────────────────────────────────────────────┤
│  Data Layer (数据层)                          │
│  ─────────────────────────────────────────── │
│  包含：Repository 实现 / DataSource / DTO      │
│  职责：调用 API / 操作数据库 / 数据序列化       │
│  依赖方向：依赖 Domain 层（实现其接口）          │
└──────────────────────────────────────────────┘
```

### 2.1 各层的具体职责

**Presentation 层**：
- Widget：纯渲染——接收 ViewModel 的状态，渲染 UI。唯一的逻辑是"根据状态决定显示什么"
- ViewModel（AsyncNotifier）：持有页面状态，暴露数据给 Widget，接收用户事件并调用 Domain 层或 Data 层

**Domain 层（可选）**：
- Entity：纯 Dart 数据类（freezed 生成）——不依赖任何框架
- Repository 接口：定义"需要什么数据操作"——不定义"怎么实现"
- UseCase：封装单个业务操作（如 `BorrowBookUseCase`）——仅在逻辑需要复用多个 Repository 时建

**Data 层**：
- Repository 实现：实现 Domain 层定义的 Repository 接口——协调 RemoteDataSource 和 LocalDataSource
- DataSource：具体的数据源——RemoteDataSource 调 Supabase/REST API，LocalDataSource 调 Drift/SharedPreferences
- DTO（Data Transfer Object）：API 返回的 JSON 对应的数据类——通过 extension 转换为 Domain Entity

### 2.2 依赖方向（依赖倒置原则）

```
Presentation ──→ Domain ←── Data
   (依赖)        (被依赖)     (依赖)

关键：Domain 层不依赖任何外层——它定义接口，Data 层实现接口
```

这意味着：
- Domain 层的 `abstract class BookRepository` 不知道数据来自 Supabase 还是本地 SQLite
- Data 层的 `SupabaseBookRepository` 实现了 `BookRepository` 接口——它知道数据来源
- Presentation 层只依赖 `BookRepository` 接口——换数据源只需注入不同的实现

---

## 3. 单向数据流（Unidirectional Data Flow）

```
用户点击借阅按钮
        ↓
Widget 调用 ViewModel 的方法
        ↓
ViewModel 调用 Repository
        ↓
Repository 调用 DataSource (Supabase)
        ↓
数据返回 → Repository → ViewModel → State 更新
        ↓
Widget 自动重建（ref.watch 触发）
```

**绝对不允许的方向**：
- ❌ Widget 直接调用 DataSource
- ❌ DataSource 直接更新 Widget 的 State（没有任何机制能做到，但逻辑上不能设计成这个方向）
- ❌ ViewModel 持有 BuildContext 或操作 UI

---

## 4. MVVM 在 Flutter 中的映射

| MVVM 角色 | Flutter 实现 | 职责 |
|-----------|-------------|------|
| **Model** | freezed 数据类 | 数据的不可变快照——Book、User、BorrowRecord |
| **View** | ConsumerWidget / ConsumerStatefulWidget | 接收 ViewModel 状态，声明式渲染 UI |
| **ViewModel** | Riverpod AsyncNotifier | 持有状态，暴露数据，接收事件，协调 Repository |

```dart
// View — 纯渲染
class BookListPage extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(homeViewModelProvider);  // 数据绑定

    return state.when(
      data: (books) => BookGridView(books: books),
      loading: () => const ShimmerBookGrid(),
      error: (e, _) => ErrorRetryWidget(message: e.toString()),
    );
  }
}

// ViewModel — 持有状态 + 处理事件
@riverpod
class HomeViewModel extends _$HomeViewModel {
  @override
  Future<List<Book>> build() async {
    return ref.watch(bookRepositoryProvider).getBooks();
  }

  Future<void> borrowBook(Book book) async {
    await ref.read(borrowRepositoryProvider).borrow(book.id, currentUserId);
    ref.invalidateSelf();  // 刷新自身
  }
}
```

---

## 5. Clean Architecture — 需要全部吗？

Clean Architecture 的完整版包括 Entities → Use Cases → Interface Adapters → Frameworks 四层。在 Flutter 中，**通常不需要全部**：

| 层 | 是否必须 | 何时加 |
|----|---------|--------|
| Entity (Domain) | ✅ 必须 | 从第一天就用 freezed 定义 |
| Repository 接口 (Domain) | ✅ 必须 | 从接入第一个数据源开始 |
| UseCase (Domain) | ⚠️ 按需 | 仅当单个操作涉及多个 Repository 或复杂业务规则时 |
| ViewModel (Presentation) | ✅ 必须 | 从有业务逻辑开始 |
| Repository 实现 (Data) | ✅ 必须 | 对应每个 Repository 接口 |
| DataSource (Data) | ✅ 必须 | 每个外部数据源一个 |

**决策框架**：如果你需要合并两个数据源（如 Supabase + Drift 缓存），建 UseCase。如果只是简单的 CRUD 传递，ViewModel 直接调 Repository 即可——不要为了"架构完整性"建空壳 UseCase。

---

## 6. Library App 重构路线图

当前状态 → 目标架构：

```
重构前（Chapter 22）:
  lib/
  ├── screens/     (Widget + 业务逻辑 + API 调用混在一起)
  ├── providers/   (半 ViewModel 半 Repository)
  └── models/      (freezed 数据类)

        ↓ Ch 24: 引入 ViewModel

  lib/
  ├── screens/     (View — 纯渲染)
  ├── view_models/ (AsyncNotifier — 状态+事件)
  └── models/

        ↓ Ch 25: 引入 Repository

  lib/
  ├── screens/
  ├── view_models/
  ├── repositories/   (接口 + 实现)
  ├── data_sources/   (remote / local)
  └── models/

        ↓ Ch 26: 引入 DI

  lib/
  ├── screens/
  ├── view_models/
  ├── repositories/
  ├── data_sources/
  ├── core/di/        (Provider 声明 + 环境切换)
  └── models/

        ↓ Ch 27: Feature-First 重组

  lib/
  ├── core/           (公共基础设施)
  ├── features/
  │   ├── books/      (screens + view_models + models)
  │   ├── auth/       (screens + view_models + services)
  │   ├── borrow/     (screens + view_models + models)
  │   └── search/     (screens + view_models)
  └── main.dart
```

---

## 7. 架构决策记录（ADR）

| 决策 | 选择 | 理由 |
|------|------|------|
| 状态管理 | Riverpod AsyncNotifier | 编译时安全，无 BuildContext，原生异步支持 |
| 数据层抽象 | Repository 模式 | 换数据源只改 DI 注册，不改业务代码 |
| 分层粒度 | 三层（无独立 Domain 层） | 当前规模下 UseCase 层的价值 < 维护成本 |
| 项目结构 | Feature-First | 功能内聚——改一个功能只在一个目录内操作 |
| DI 方案 | Riverpod Provider + get_it | Riverpod 管响应式依赖 / get_it 管全局单例 |

---

## 8. 本章小结

三层架构的核心是**依赖方向**：Presentation → Domain ← Data。Domain 层定义接口，Data 层实现，Presentation 层消费。MVVM 在 Flutter 中 = Widget (View) + AsyncNotifier (ViewModel) + freezed (Model)。Clean Architecture 的 UseCase 层按需添加——不要空壳。

---

## 9. 本章练习

1. 画出 Library App 的三层架构依赖图：在一张纸上（或用 draw.io / Excalidraw）画出 Presentation（Widget + ViewModel）、Domain（Repository 接口 + Model）、Data（Supabase DataSource + Local DataSource）三个分层，并用箭头标注依赖方向。检查：箭头是否全部指向 Domain 层？外部是否只能依赖 Domain？

2. 审查现有代码找出架构违规：打开 Library App 的 `home_screen.dart`，找出所有直接调用 Supabase 或 Dio 的代码行，列出清单并写出每处的重构方向（移到 ViewModel / 移到 Repository / 移到 DataSource）。验证标准：至少找出 3 处违规，每处都有明确的重构目标。

3. 为 Library App 写一份 ADR（架构决策记录）：选择"是否引入 Clean Architecture 的 UseCase 层"为题，按 ADR 格式（标题/状态/背景/决策/后果）撰写，列出至少两条不引入 UseCase 层的具体理由。验证标准：ADR 文档能帮助新成员在 3 分钟内理解决策背景。

> **下一步**: [Chapter 29 — MVVM 模式在 Flutter 中的实现](./Chapter-29-MVVM模式.md)
> **原始文档**: [flutter.cn/app-architecture/guide](https://docs.flutter.cn/app-architecture/guide)
