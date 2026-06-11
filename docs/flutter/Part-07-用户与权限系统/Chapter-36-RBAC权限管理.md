# 第 36 章：RBAC 权限管理与角色系统

> **Part**: Part VII — 用户与权限系统
> **上一章**: [Chapter 35 — 安全存储与生物识别](./Chapter-35-安全存储与生物识别.md)
> **下一章**: [Chapter 37 — 借阅系统状态机](./Chapter-37-借阅系统状态机.md)
> **官方文档**: [supabase.com/docs/guides/auth/custom-claims](https://supabase.com/docs/guides/auth/custom-claims)

---

## 0. 本章目标

- 掌握 RBAC 三级角色模型设计与实现
- 理解 Supabase 自定义 Claims（app_metadata）存储角色
- 学会 RLS 按角色策略 + Flutter 端权限控制
- 实现路由权限守卫和 UI 自适应

> 🎯 **Library App 产出**：三级角色系统、管理员面板、RBAC 权限组件库。

---

## 1. 角色模型设计

```dart
enum UserRole {
  reader(label: '读者', level: 0),
  librarian(label: '图书管理员', level: 1),
  admin(label: '系统管理员', level: 2);

  final String label;
  final int level;
  const UserRole({required this.label, required this.level});

  // 权限判断（集中管理，不散落在 UI 中）
  bool get canBorrowBooks => level >= 0;
  bool get canManageBooks => level >= 1;
  bool get canManageUsers => level >= 2;
  bool get canViewReports => level >= 1;
}
```

### 权限矩阵

| 操作 | Reader (0) | Librarian (1) | Admin (2) |
|------|:--:|:--:|:--:|
| 浏览/搜索图书 | ✅ | ✅ | ✅ |
| 借阅/归还图书 | ✅ | ✅ | ✅ |
| 添加/编辑/删除图书 | ❌ | ✅ | ✅ |
| 管理分类和标签 | ❌ | ✅ | ✅ |
| 查看借阅报告 | ❌ | ✅ | ✅ |
| 管理用户角色 | ❌ | ❌ | ✅ |
| 配置系统设置 | ❌ | ❌ | ✅ |

---

## 2. Supabase 端角色存储

```sql
-- 赋予管理员角色（Supabase Dashboard → SQL Editor）
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
WHERE id = 'user-uuid';

-- 查询用户角色
SELECT id, raw_app_meta_data->>'role' AS role FROM auth.users;
```

### Edge Function 管理角色（防止客户端直接修改）

```typescript
// supabase/functions/set-role/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { targetUserId, newRole } = await req.json();

  // 验证调用者是否为 admin
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user: caller } } = await supabase.auth.getUser(req.headers.get('Authorization')!.split(' ')[1]);

  const callerRole = caller?.app_metadata?.role;
  if (callerRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  // 更新目标用户角色
  const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
    app_metadata: { role: newRole },
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ success: true }));
});
```

---

## 3. Flutter 端角色读取

```dart
// lib/features/auth/providers/role_provider.dart

@riverpod
UserRole? currentUserRole(CurrentUserRoleRef ref) {
  final user = Supabase.instance.client.auth.currentUser;
  final roleStr = user?.appMetadata['role'] as String?;
  return roleStr != null
      ? UserRole.values.firstWhere((r) => r.name == roleStr)
      : null;  // 未登录用户
}

// 便捷判断 Provider
@riverpod
bool canManageBooks(CanManageBooksRef ref) {
  final role = ref.watch(currentUserRoleProvider);
  return role?.canManageBooks ?? false;
}
```

---

## 4. UI 权限控制组件

```dart
// lib/widgets/role_gate.dart

class RoleGate extends ConsumerWidget {
  final Widget child;
  final UserRole minRole;
  final Widget? fallback; // 权限不足时的替代 UI

  const RoleGate({
    required this.child,
    required this.minRole,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentUserRoleProvider);
    final hasAccess = role != null && role.level >= minRole.level;

    if (hasAccess) return child;
    return fallback ?? const SizedBox.shrink();
  }
}

// 使用
RoleGate(
  minRole: UserRole.librarian,
  child: FilledButton.icon(
    icon: const Icon(Icons.add),
    label: const Text('添加图书'),
    onPressed: () => _showAddBookDialog(),
  ),
);
```

---

## 5. RLS 按角色策略

```sql
-- 所有人可查看
CREATE POLICY "books_read_all" ON public.books
  FOR SELECT USING (true);

-- 管理员和图书管理员可增删改
CREATE POLICY "books_manage_privileged" ON public.books
  FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'librarian'))
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'librarian'));

-- 用户管理仅限管理员
CREATE POLICY "users_manage_admin" ON public.profiles
  FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

---

## 6. 路由权限守卫

```dart
GoRoute(
  path: '/admin',
  redirect: (context, state) {
    final container = ProviderScope.containerOf(context);
    final role = container.read(currentUserRoleProvider);
    if (role == null) return '/login';
    if (role.level < 2) return '/403';
    return null;
  },
  builder: (context, state) => const AdminDashboard(),
);

// 403 页面
GoRoute(
  path: '/403',
  builder: (context, state) => const ForbiddenScreen(),
);
```

---

## 7. 本章练习

1. 为 Library App 实现三级角色模型和权限矩阵
2. 创建 `RoleGate` 组件并在 3 个位置使用（添加图书按钮、删除按钮、管理入口）
3. 配置 Supabase RLS 策略，验证 reader 无法直接修改数据库
4. 实现 `/admin` 路由的权限守卫

---

> 📖 **延伸阅读**: [Supabase 自定义 Claims](https://supabase.com/docs/guides/auth/custom-claims-and-rbac)
