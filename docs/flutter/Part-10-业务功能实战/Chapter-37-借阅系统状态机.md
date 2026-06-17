> **Part**: Part VII — 用户与权限系统
> **上一章**: [Chapter 36 — RBAC 权限管理](./Chapter-36-RBAC权限管理.md)
> **下一章**: [Chapter 38 — 搜索与发现](./Chapter-38-搜索与发现.md)
> **官方文档**: [supabase.com/docs/guides/database/postgres/row-level-security](https://supabase.com/docs/guides/database/postgres/row-level-security)

---

# 第 37 章：借阅系统 — 状态机与并发控制

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

## 5. 常见错误与最佳实践

### 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|----------|
| 并发借阅无锁保护 | 两用户同时借最后一本书，`available_copies` 变为 -1 | PostgreSQL 函数内 `SELECT ... FOR UPDATE` 悲观行锁 |
| 扣库存与创建记录分两次请求 | 第一步成功第二步失败，库存已扣但无借阅记录 | 用单个 PostgreSQL 函数 + 事务原子提交 |
| 逾期判断依赖客户端时间 | 用户修改设备时间可无限绕过逾期 | 逾期状态由数据库定时任务或服务端 `NOW()` 判断 |
| 续借不限制次数 | 一本书被同一用户无限续借，永久占用 | `renewCount` 字段限制最多 2 次，函数内判断 |
| 归还时忘记恢复库存 | `available_copies` 未 +1，图书变成"幽灵库存" | 归还 RPC 中先更新记录状态再 `UPDATE books SET available_copies = available_copies + 1` |

### 最佳实践

- 借阅/归还/续借封装为单个 PostgreSQL RPC 函数，确保原子性和事务一致性
- 借阅限额（`maxLimit=5`）和续借次数（`maxRenew=2`）在函数内检查，不依赖客户端
- 逾期状态通过 `WHERE due_date < NOW() AND status = 'active'` 定时任务批量更新
- 预约队列在归还函数中自动通知下一位等待用户（`ORDER BY position LIMIT 1`）
- 借阅记录使用枚举字段 `status`：`active`/`overdue`/`returned`/`cancelled`，不用魔法字符串
- 逾期罚款计算为服务端逻辑（`overdueDays * finePerDay`），结果写入数据库防篡改
- 所有敏感操作记录审计日志：谁+何时+对哪本书+什么操作+结果
- 使用 `ON CONFLICT` 处理归还时的幂等性：同一记录不可归还两次

---

## 6. 本章练习

1. **实现续借功能**：在 `BorrowService` 中添加 `renewBook(String recordId)` 方法，调用 Supabase RPC `renew_book`（仿照 `borrow_book` 编写对应的 SQL 函数），将 `dueDate` 延长 14 天，限制每本书最多续借 2 次（通过 `renewCount` 字段判断）。验证标准：续借成功后到期日增加 14 天；第 3 次续借时返回错误提示"已达到最大续借次数"。

2. **添加逾期提醒 Banner**：在 Library App 首页顶部添加一个 MaterialBanner，通过 `authState` 监听登录状态，登录后从 Supabase `borrow_records` 表查询当前用户是否有 `status = 'overdue'` 的记录。如果有，显示红色横幅"您有 X 本书已逾期，请尽快归还"，并展示累计罚款金额。验证标准：无逾期时不显示 Banner；有逾期时显示红色横幅并展示正确的逾期数量和金额。

3. **实现预约取消功能**：在预约列表页面（`ReservationsScreen`）为每个 `status = 'waiting'` 的预约项添加"取消预约"按钮，点击后调用 Supabase 更新 `reservations` 表状态为 `cancelled`，同时调整后续排队用户的 `position` 值。验证标准：取消后预约列表不再显示该项；数据库中状态变为 cancelled，队列位置正确前移。

验证标准：所有 RPC 函数通过 Supabase SQL Editor 测试通过，Flutter 端功能在模拟器中手动验证。

---

> **下一步**: [Chapter 38 — 搜索与发现](./Chapter-38-搜索与发现.md)
