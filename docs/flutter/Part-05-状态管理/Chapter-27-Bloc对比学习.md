> **Part**: Part V — 状态管理
> **上一章**: [Chapter 26 — Riverpod 2.x](./Chapter-26-Riverpod2-响应式状态管理.md)
> **下一章**: [Part VI — 应用架构](../Part-06-应用架构/)
> **官方文档**: [pub.dev/packages/flutter_bloc](https://pub.dev/packages/flutter_bloc) | [bloclibrary.dev](https://bloclibrary.dev)

---

# 第 27 章：Bloc — 事件驱动状态管理（对比学习）

## 0. 本章目标与前置依赖

**前置依赖**：已掌握 Riverpod（Chapter 26），理解异步状态管理（Chapter 26）。

**本章目标**：
- 理解 Bloc 的事件驱动核心模式（Event → Bloc → State）
- 掌握 BlocBuilder / BlocListener / BlocConsumer
- 掌握 Cubit（Bloc 的简化版）
- 理解 EventTransformer（debounce/throttle）
- 建立 Riverpod vs Bloc 的选择决策框架——何时用哪个

> 🎯 **本章会在图书馆 App 中做什么**：创建实验性 `bloc` 分支，用 Bloc/Cubit 实现"借阅"功能（BorrowBookEvent/ReturnBookEvent + BorrowBloc），作为与 Riverpod 主分支的对比参考。

---

## 1. Bloc 的核心模式：Event → Bloc → State

```
用户操作 → Event 事件 → Bloc 处理 → 新 State → UI 更新
```

这个模式强制了**单向数据流**：UI 只能通过发送 Event 来改变状态，不能直接修改状态。

---

## 2. Cubit — 简化版 Bloc

```dart
// Cubit 是 Bloc 的简化版——没有 Event 类，直接调用方法
// lib/bloc/borrow/borrow_cubit.dart
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../models/book.dart';
import '../../models/borrow_record.dart';

// ① State — 不可变的状态对象
class BorrowState {
  final List<BorrowRecord> records;
  final bool isLoading;

  const BorrowState({this.records = const [], this.isLoading = false});

  BorrowState copyWith({List<BorrowRecord>? records, bool? isLoading}) =>
      BorrowState(records: records ?? this.records, isLoading: isLoading ?? this.isLoading);

  int get activeCount => records.where((r) => r.status == BorrowStatus.active).length;
}

// ② Cubit — 接收方法调用，产出新状态
class BorrowCubit extends Cubit<BorrowState> {
  BorrowCubit() : super(const BorrowState());

  void borrowBook(Book book, String userId) async {
    emit(state.copyWith(isLoading: true));

    await Future.delayed(const Duration(milliseconds: 500));

    if (state.activeCount >= 5) {
      emit(state.copyWith(isLoading: false));
      return;
    }

    final record = BorrowRecord.create(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      bookId: book.id,
      userId: userId,
    );

    emit(BorrowState(
      records: [...state.records, record],
      isLoading: false,
    ));
  }

  void returnBook(String recordId) {
    final updated = state.records.map((r) =>
      r.id == recordId ? r.returnBook() : r
    ).toList();
    emit(BorrowState(records: updated));
  }
}

// ③ UI — 用 BlocBuilder 响应状态变化
class BorrowPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocBuilder<BorrowCubit, BorrowState>(
      builder: (context, state) {
        if (state.isLoading) return const Center(child: CircularProgressIndicator());
        return ListView.builder(
          itemCount: state.records.length,
          itemBuilder: (_, i) => ListTile(title: Text(state.records[i].bookId)),
        );
      },
    );
  }
}
```

---

## 3. 完整 Bloc（Event + State + Bloc）

```dart
// ① Event — 抽象基类 + 具体事件
sealed class BorrowEvent {}
class BorrowBook extends BorrowEvent {
  final Book book;
  final String userId;
  BorrowBook(this.book, this.userId);
}
class ReturnBook extends BorrowEvent {
  final String recordId;
  ReturnBook(this.recordId);
}
class LoadBorrowHistory extends BorrowEvent {}

// ② State
class BorrowState {
  final AsyncStatus status;
  final List<BorrowRecord> records;
  final String? error;
  const BorrowState({this.status = AsyncStatus.loading, this.records = const [], this.error});
  BorrowState copyWith({AsyncStatus? status, List<BorrowRecord>? records, String? error}) =>
      BorrowState(status: status ?? this.status, records: records ?? this.records, error: error ?? this.error);
}

// ③ Bloc — on<Event> 注册事件处理器
class BorrowBloc extends Bloc<BorrowEvent, BorrowState> {
  BorrowBloc() : super(const BorrowState()) {
    // 注册事件处理器
    on<BorrowBook>(_onBorrowBook,
      transformer: sequential(),           // 事件按顺序处理
      // transformer: restartable(),       // 新事件取消旧事件
      // transformer: droppable(),         // 忽略处理中的新事件
      // transformer: concurrent(),         // 默认：并发处理
    );
    on<ReturnBook>(_onReturnBook);
    on<LoadBorrowHistory>(_onLoadHistory);
  }

  Future<void> _onBorrowBook(BorrowBook event, Emitter<BorrowState> emit) async {
    emit(state.copyWith(status: AsyncStatus.loading));
    try {
      final record = BorrowRecord.create(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        bookId: event.book.id,
        userId: event.userId,
      );
      emit(BorrowState(status: AsyncStatus.success, records: [...state.records, record]));
    } catch (e) {
      emit(state.copyWith(status: AsyncStatus.error, error: e.toString()));
    }
  }

  Future<void> _onReturnBook(ReturnBook event, Emitter<BorrowState> emit) async {
    final updated = state.records.map((r) => r.id == event.recordId ? r.returnBook() : r).toList();
    emit(state.copyWith(records: updated));
  }

  Future<void> _onLoadHistory(LoadBorrowHistory event, Emitter<BorrowState> emit) async {
    emit(state.copyWith(status: AsyncStatus.loading));
    // 从 API 加载...
    emit(state.copyWith(status: AsyncStatus.success));
  }
}

// ④ UI — BlocConsumer 同时处理监听和渲染
class BorrowPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return BlocConsumer<BorrowBloc, BorrowState>(
      // listener — 副作用（SnackBar、导航）
      listener: (context, state) {
        if (state.status == AsyncStatus.error) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.error!)),
          );
        }
      },
      // builder — 渲染 UI
      builder: (context, state) {
        return switch (state.status) {
          AsyncStatus.loading => const Center(child: CircularProgressIndicator()),
          AsyncStatus.error => Center(child: Text('Error: ${state.error}')),
          AsyncStatus.success || AsyncStatus.empty => ListView.builder(
              itemCount: state.records.length,
              itemBuilder: (_, i) => ListTile(title: Text(state.records[i].bookId)),
            ),
        };
      },
    );
  }
}
```

---

## 4. Riverpod vs Bloc 选择指南

| 维度 | Riverpod | Bloc |
|------|----------|------|
| **学习曲线** | 中等 | 较陡（Event/State/Bloc 三层） |
| **样板代码** | 少（codegen 后几乎零） | 多（需要定义 Event/State/Bloc 三类） |
| **类型安全** | 编译时 | 编译时 |
| **异步支持** | 内置（AsyncNotifier/FutureProvider） | 需要手动管理状态枚举 |
| **事件追溯** | 无（直接调方法） | 有（Event 记录可审计） |
| **时间旅行调试** | 无 | 官方 DevTools 支持 |
| **Testability** | 好 | 极好（事件隔离） |
| **10+人团队** | 可能混入不一致模式 | 强制统一模式 |
| **个人/小型团队** | ✅ 首选 | 可能过度工程 |

**决策框架**：
- **选 Riverpod**：个人项目/小团队、快速迭代优先、不想写 Event 样板代码
- **选 Bloc**：10+人团队、金融/医疗等合规性要求高、需要事件日志审计
- **混合**：Riverpod 管数据（API/Repository）+ Bloc 管复杂工作流（借阅状态机）

---

## 5. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 直接在 UI 中修改 Bloc/Cubit 的 State | 绕过单向数据流，状态变化不可追溯 | 只能通过 `add(Event)`（Bloc）或直接调方法 → `emit()`（Cubit）修改状态 |
| 忘记在 `dispose` 中 `close` Bloc/Cubit | 内存泄漏，Stream 未关闭 | 使用 `BlocProvider` 自动管理生命周期，或手动在 `dispose` 中 `close()` |
| Event handler 中用 `await` 未处理并发 | 多次事件触发导致竞态条件 | 使用 `EventTransformer`（`sequential`/`restartable`/`droppable`）控制处理顺序 |
| Cubit 中直接修改 state 字段而不 `emit` 新状态 | UI 不更新 | 始终通过 `emit(state.copyWith(...))` 产出不可变新 State |
| `BlocListener` 和 `BlocBuilder` 分开写重复处理同一 state | 代码冗余、逻辑分散 | 用 `BlocConsumer` 合并 `listener` 和 `builder` |

**最佳实践**：

- 简单状态/小功能优先用 Cubit，减少 Event 类样板代码
- 需要事件溯源、审计日志的场景使用完整 Bloc（Event + State + Bloc）
- State 类使用 `freezed` 或 `Equatable` 支持值比较，避免不必要的 UI 重建
- 搜索输入等高频操作务必使用 `debounce` transformer，延迟 300ms 触发请求
- `BlocProvider` 的 `create` 中做初始化，`BlocProvider.value` 用于传递已有 Bloc 实例
- 用 Dart 3 的 `sealed class` 定义 Event 层级，利用 exhaustive check 确保所有事件都有处理
- 单元测试时直接 `new Bloc()` 并 `emit` 特定 State，无需构建 Widget 树
- 复杂状态机（如审批流程、多步骤表单）优先选 Bloc，Event 天然适合建模状态转移

---

## 6. 本章小结

| 你学到了什么 | 核心要点 |
|-------------|---------|
| Cubit | 简化版 Bloc——方法调用 → emit 新状态 |
| Bloc 完整模式 | Event → on\<Event\> handler → emit State |
| BlocBuilder/Listener/Consumer | 渲染/副作用/两者 |
| EventTransformer | sequential/restartable/droppable/concurrent |
| Riverpod vs Bloc 决策 | 小团队选 Riverpod，大团队或合规选 Bloc |

---

## 7. 本章练习

1. 用 Cubit 实现借阅页面的借还操作：创建 `BorrowCubit`，包含 `loadRecords()` / `borrowBook(String bookId)` / `returnBook(String recordId)` 三个方法，用 `emit()` 更新 `BorrowState`。在 `BorrowPage` 中分别用 `BlocBuilder` 渲染列表、`BlocListener` 监听操作失败并弹出 SnackBar。验证标准：借书后列表新增记录，还书后记录状态变为"已还"。

2. 用完整 Bloc 模式重写借阅功能：定义 `BorrowEvent` 密封类（`LoadBorrows` / `BorrowBook` / `ReturnBook`），`BorrowState` 状态类，`BorrowBloc` 中包含 `on<LoadBorrows>` / `on<BorrowBook>` / `on<ReturnBook>` 事件处理器。对比实现与 Cubit 版本的代码量差异。验证标准：功能与 Cubit 版本等价，事件处理逻辑清晰。

3. 给搜索功能添加 `EventTransformer` 防抖：创建 `SearchBloc`，使用 `.debounce(const Duration(milliseconds: 300))` transformer 装饰 `on<SearchTextChanged>` 事件处理器，避免每次按键触发网络请求。验证标准：快速连续输入 5 个字符只触发 1 次搜索请求。

> **下一步**: [Chapter 28 — Flutter 应用架构设计理念](../Part-06-应用架构/Chapter-28-应用架构设计理念.md)
> **原始文档**: [bloclibrary.dev](https://bloclibrary.dev) | [pub.dev/packages/flutter_bloc](https://pub.dev/packages/flutter_bloc)
