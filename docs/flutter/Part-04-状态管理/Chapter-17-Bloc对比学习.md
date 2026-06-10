> **Part**: Part IV — 状态管理
> **上一章**: [Chapter 16 — Riverpod 2.x](./Chapter-16-Riverpod2-响应式状态管理.md)
> **下一章**: [Part V — 网络与数据（Chapter 18）](../Part-05-网络与数据/)
> **官方文档**: [pub.dev/packages/flutter_bloc](https://pub.dev/packages/flutter_bloc) | [bloclibrary.dev](https://bloclibrary.dev)

---

# 第 17 章：Bloc — 事件驱动状态管理（对比学习）

## 0. 本章目标与前置依赖

**前置依赖**：已掌握 Riverpod（Chapter 16），理解异步状态管理（Chapter 15）。

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

## 5. 本章小结

| 你学到了什么 | 核心要点 |
|-------------|---------|
| Cubit | 简化版 Bloc——方法调用 → emit 新状态 |
| Bloc 完整模式 | Event → on\<Event\> handler → emit State |
| BlocBuilder/Listener/Consumer | 渲染/副作用/两者 |
| EventTransformer | sequential/restartable/droppable/concurrent |
| Riverpod vs Bloc 决策 | 小团队选 Riverpod，大团队或合规选 Bloc |

---

> **下一步**: [Part V — 网络与数据（Chapter 18）](../Part-05-网络与数据/)
> **原始文档**: [bloclibrary.dev](https://bloclibrary.dev) | [pub.dev/packages/flutter_bloc](https://pub.dev/packages/flutter_bloc)
