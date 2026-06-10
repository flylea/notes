# ACL vs RBAC 权限模型

## 前端类比：Vue 的权限控制

```
前端权限控制的方式：

1. v-if 控制按钮显示
   <button v-if="user.role === 'admin'">删除</button>

2. 路由守卫控制页面访问
   { path: '/admin', component: Admin, meta: { role: 'admin' } }

3. 指令控制元素级别权限
   <button v-permission="'book:delete'">删除</button>

后端权限控制是同一件事，但在服务端 API 层面做判断。
```

## ACL（Access Control List）——访问控制列表

**直接给每个用户分配权限**。

```
┌─────────────────────────────────┐
│  用户 → 权限列表                  │
│                                 │
│  Alice: [看书, 借书, 还书]        │
│  Bob:   [看书]                   │
│  Admin: [看书, 借书, 还书,        │
│          增书, 删书, 改书,        │
│          管理用户, 看统计]         │
└─────────────────────────────────┘
```

```typescript
// ACL 实现方式
const userPermissions = {
  1: ['book:read', 'book:borrow', 'book:return'],
  2: ['book:read'],
  3: ['book:read', 'book:borrow', 'book:return', 'book:create', 'book:delete', 'user:manage'],
};

function hasPermission(userId: number, permission: string): boolean {
  return userPermissions[userId]?.includes(permission) ?? false;
}
```

**问题**：用户多了以后，每个用户都要手动分配一堆权限。新增一个操作（如 `book:export`）需要给 100 个用户逐个添加。

## RBAC（Role-Based Access Control）——基于角色的访问控制

**用户有角色，角色有权限。用户通过角色间接获得权限**。

```
┌──────────────────────────────────────────────────────────┐
│                                                           │
│   用户 ──┬── USER 角色 ──┬── book:read                    │
│          │               ├── book:borrow                  │
│          │               └── book:return                  │
│          │                                                │
│          ├── LIBRARIAN 角色 ──┬── USER 全部权限（继承）      │
│          │                    ├── book:create              │
│          │                    └── book:update              │
│          │                                                │
│          └── ADMIN 角色 ──┬── LIBRARIAN 全部权限（继承）    │
│                           ├── book:delete                 │
│                           └── user:manage                 │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

```typescript
// RBAC 的核心公式
function hasPermission(user: User, permission: string): boolean {
  // 用户的角色 → 角色的权限 → 判断是否包含目标权限
  const roles = getUserRoles(user.id);
  const permissions = roles.flatMap(role => getRolePermissions(role.id));
  return permissions.includes(permission);
}

// 新增一个操作：
// ACL：给每个需要的用户加权限
// RBAC：给角色加权限，所有拥有该角色的用户自动获得
```

## 三张核心表

```
┌──────────┐     ┌──────────────┐     ┌────────────┐
│   User   │     │     Role     │     │ Permission │
├──────────┤     ├──────────────┤     ├────────────┤
│ id       │     │ id           │     │ id         │
│ username │     │ name         │     │ code       │
│ ...      │     │ description  │     │ description│
└────┬─────┘     └──────┬───────┘     └──────┬─────┘
     │                  │                    │
     │    M:N           │      M:N          │
     └───→ UserRole ←───┘  RolePermission ←──┘

UserRole:         RolePermission:
┌────────────┐    ┌────────────────┐
│ userId (FK)│    │ roleId (FK)    │
│ roleId (FK)│    │ permissionId   │
│            │    │     (FK)       │
└────────────┘    └────────────────┘
```

## 图书管理系统的权限码设计

```
权限码命名规范：资源:操作

book:read       — 查看图书
book:create     — 新增图书
book:update     — 修改图书
book:delete     — 删除图书
book:borrow     — 借书
book:return     — 还书

user:read       — 查看用户
user:create     — 创建用户
user:update     — 修改用户
user:delete     — 删除用户

category:read   — 查看分类
category:create — 创建分类
category:delete — 删除分类

borrow:read     — 查看借阅记录
borrow:return   — 归还确认（管理员帮用户归还）

格式：{资源}:{操作}
资源用小写单数，操作用小写动词
```

## 前后端权限对应关系

```
前端（UI 层）                             后端（API 层）
─────────────────                      ─────────────────
v-if="hasPermission('book:create')"    @RequirePermission('book:create')
→ 不显示"新增"按钮                      → 没有权限直接返回 403

router meta: { permission: 'admin' }   Guard 中检查权限
→ 无法进入管理页面                      → 无法调用管理接口

两者的关系：
- 前端权限：提升用户体验（看不到就不想点）
- 后端权限：保证数据安全（前端权限可被绕过）

永远不要只在前端做权限控制！
```

---

## 参考链接

- [NIST RBAC Standard](https://csrc.nist.gov/projects/role-based-access-control)
- [OWASP — Access Control](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
