> **Part**: Part VII — 用户与权限系统
> **上一章**: [Chapter 29 — 安全存储与生物识别](./Chapter-29-安全存储与生物识别.md)
> **下一章**: [Chapter 31 — 借阅系统：状态机与并发控制](./Chapter-31-借阅系统状态机.md)
> **官方文档**: [supabase.com/docs/guides/auth/custom-claims](https://supabase.com/docs/guides/auth/custom-claims)

---

# 第 30 章：RBAC 权限管理与角色系统

## 0. 本章目标

掌握 RBAC 角色设计（Reader / Librarian / Admin）、Supabase 自定义 Claims（app_metadata 存储角色）、RLS 按角色策略、Flutter 端角色读取与 UI 权限控制、路由权限守卫（角色不匹配 → 403）。

> 🎯 **Library App 产出**：三级角色系统、管理员面板（图书 CRUD + 用户管理）、UI 自适应（管理员看到"管理"Tab）、403 无权限页面、Edge Function 管理角色提升/降级。

---

## 1. 角色定义

```dart
enum UserRole { reader(label: '读者', level: 0), librarian(label: '图书管理员', level: 1), admin(label: '系统管理员', level: 2); }
```

## 2. Supabase 端角色存储（app_metadata）

```sql
-- 赋予管理员角色（在 Supabase Dashboard → SQL Editor 中执行）
UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb WHERE id = 'user-uuid';

-- Edge Function 中通过 service_role 管理角色
-- supabase/functions/admin-set-role/index.ts
```

## 3. Flutter 端角色读取

```dart
@riverpod
UserRole? currentUserRole(CurrentUserRoleRef ref) {
  final user = Supabase.instance.client.auth.currentUser;
  final roleStr = user?.appMetadata['role'] as String?;
  return roleStr != null ? UserRole.values.firstWhere((r) => r.name == roleStr) : null;
}

// UI 权限控制
class RoleBasedWidget extends ConsumerWidget {
  final Widget child;
  final UserRole minRole;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(currentUserRoleProvider);
    if (role == null || role.level < minRole.level) return const SizedBox.shrink();
    return child;
  }
}

// 使用：
RoleBasedWidget(minRole: UserRole.librarian, child: const FilledButton.icon(icon: Icon(Icons.add), label: Text('添加图书'), onPressed: ...));
```

## 4. RLS 按角色策略

```sql
CREATE POLICY "books_manage_admin" ON public.books
  FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

## 5. 路由权限守卫

```dart
GoRoute(
  path: '/admin',
  redirect: (context, state) {
    final role = ref.read(currentUserRoleProvider);
    if (role == null || role.level < 2) return '/403';
    return null;
  },
);
```

---

> **下一步**: [Chapter 31 — 借阅系统状态机](./Chapter-31-借阅系统状态机.md)
