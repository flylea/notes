> **Part**: Part VII — 用户与权限系统
> **上一章**: [Chapter 30 — RBAC 权限管理](./Chapter-30-RBAC权限管理.md)
> **下一章**: [Chapter 32 — 搜索与发现](./Chapter-32-搜索与发现.md)
> **官方文档**: [supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

# 第 31 章：借阅系统 — 状态机与并发控制

## 0. 本章目标

掌握借阅状态机设计（Available→Borrowed→Overdue→Returned）、到期日期计算与逾期罚款、并发控制策略（乐观锁/事务）、借阅限额与预约排队、借阅历史追踪。

> 🎯 **Library App 产出**：完整借阅/还书/续借流程、并发借阅保护、借阅历史页面（按状态筛选）、预约排队功能。

---

## 1. 借阅状态机

```
  Available ──[借阅]──→ Borrowed ──[逾期]──→ Overdue
     ↑                    │    ↑                │
     │                    │    └──[续借]─────────┘
     │                    ↓                     │
     └──────[归还]────────┴─────[归还]───────────┘
                        Returned

状态转移条件：
- Available → Borrowed: availableCopies > 0 && userBorrowCount < maxLimit
- Borrowed → Overdue: now > dueDate && status != 'returned'
- Borrowed/Overdue → Returned: 归还操作 + 计算逾期费用
- Borrowed → Borrowed: 续借（dueDate 延长 14 天）
```

## 2. 借阅业务逻辑

```dart
class BorrowService {
  Future<BorrowRecord> borrowBook({required String bookId, required String userId}) async {
    // ① 并发控制：使用 PostgreSQL 事务 + 行锁
    final result = await supabase.rpc('borrow_book', params: {
      'p_book_id': bookId,
      'p_user_id': userId,
      'p_duration_days': 14,
    });
    if (result['error'] != null) throw BorrowException(result['error']);
    return BorrowRecord.fromJson(result['data']);
  }
}
```

```sql
-- supabase/migrations/004_borrow_function.sql
CREATE OR REPLACE FUNCTION borrow_book(p_book_id UUID, p_user_id UUID, p_duration_days INT)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_available INT; v_active_count INT; v_record JSONB;
BEGIN
  -- 悲观锁：锁定图书行防止并发借出
  SELECT available_copies INTO v_available FROM books WHERE id = p_book_id FOR UPDATE;
  IF v_available <= 0 THEN RETURN jsonb_build_object('error', '暂无库存'); END IF;

  -- 检查用户借阅限额
  SELECT COUNT(*) INTO v_active_count FROM borrow_records WHERE user_id = p_user_id AND status = 'active';
  IF v_active_count >= 5 THEN RETURN jsonb_build_object('error', '已达到最大借阅数'); END IF;

  -- 扣减库存
  UPDATE books SET available_copies = available_copies - 1 WHERE id = p_book_id;

  -- 创建借阅记录
  INSERT INTO borrow_records (book_id, user_id, due_date, status)
  VALUES (p_book_id, p_user_id, NOW() + (p_duration_days || ' days')::INTERVAL, 'active')
  RETURNING row_to_json(borrow_records.*) INTO v_record;

  RETURN jsonb_build_object('data', v_record);
END;
$$;
```

## 3. 还书 + 逾期费用计算

```dart
Future<ReturnResult> returnBook(String recordId) async {
  final record = await supabase.from('borrow_records').select().eq('id', recordId).single();
  final dueDate = DateTime.parse(record['due_date']);
  final now = DateTime.now();
  final overdueDays = now.isAfter(dueDate) ? now.difference(dueDate).inDays : 0;
  final fine = overdueDays * 1.0; // 每天 1 元

  // 更新记录 + 恢复库存（事务）
  final result = await supabase.rpc('return_book', params: {
    'p_record_id': recordId, 'p_overdue_days': overdueDays, 'p_fine': fine,
  });
  return ReturnResult(overdueDays: overdueDays, fine: fine);
}
```

## 4. 预约排队

```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID REFERENCES books(id),
  user_id UUID REFERENCES auth.users(id),
  position INT NOT NULL,
  status TEXT DEFAULT 'waiting', -- waiting / fulfilled / cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

> **下一步**: [Chapter 32 — 搜索与发现](./Chapter-32-搜索与发现.md)
