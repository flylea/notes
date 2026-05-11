# RBAC 的 Prisma Schema 设计

## 在现有 Schema 基础上新增

```prisma
// prisma/schema.prisma（在现有模型基础上新增以下内容）

// ==================== 权限表 ====================
model Permission {
  id          Int      @id @default(autoincrement())
  code        String   @unique @db.VarChar(50)   // 权限码：book:read
  name        String   @db.VarChar(50)            // 中文名：查看图书
  description String?  @db.VarChar(200)
  resource    String   @db.VarChar(50)            // 资源：book
  action      String   @db.VarChar(50)            // 操作：read
  createdAt   DateTime @default(now())

  roles       RolePermission[]

  @@map("permissions")
}

// ==================== 角色表 ====================
model Role {
  id          Int       @id @default(autoincrement())
  code        String    @unique @db.VarChar(30)   // 角色码：ADMIN
  name        String    @db.VarChar(50)            // 中文名：管理员
  description String?   @db.VarChar(200)
  isSystem    Boolean   @default(false)            // 系统角色不可删除
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  users       UserRole[]
  permissions RolePermission[]

  @@map("roles")
}

// ==================== 用户-角色关联表（M:N） ====================
model UserRole {
  userId    Int
  roleId    Int

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)

  assignedAt DateTime @default(now())

  @id([userId, roleId])
  @@map("user_roles")
}

// ==================== 角色-权限关联表（M:N） ====================
model RolePermission {
  roleId       Int
  permissionId Int

  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @id([roleId, permissionId])
  @@map("role_permissions")
}
```

## 修改 User Model

在现有 User 模型中添加 roles 关联：

```prisma
model User {
  id          Int       @id @default(autoincrement())
  username    String    @unique @db.VarChar(50)
  password    String    @db.VarChar(255)
  nickname    String?   @db.VarChar(50)
  avatar      String?   @db.VarChar(500)
  role        UserRole  @default(USER)  // 保留简单角色字段（兼容过渡）
  borrowCount Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  borrows     BorrowRecord[]
  roles       UserRole[]  // ← 新增：支持多角色

  @@map("users")
}
```

## 权限表数据设计

```sql
-- 权限码按资源分组
INSERT INTO permissions (code, name, resource, action) VALUES
-- 图书权限
('book:read',   '查看图书', 'book', 'read'),
('book:create', '新增图书', 'book', 'create'),
('book:update', '编辑图书', 'book', 'update'),
('book:delete', '删除图书', 'book', 'delete'),
('book:borrow', '借阅图书', 'book', 'borrow'),
('book:return', '归还图书', 'book', 'return'),

-- 用户权限
('user:read',   '查看用户', 'user', 'read'),
('user:create', '创建用户', 'user', 'create'),
('user:update', '编辑用户', 'user', 'update'),
('user:delete', '删除用户', 'user', 'delete'),

-- 分类权限
('category:read',   '查看分类', 'category', 'read'),
('category:create', '新增分类', 'category', 'create'),
('category:delete', '删除分类', 'category', 'delete'),

-- 借阅管理权限
('borrow:read',   '查看借阅记录', 'borrow', 'read'),
('borrow:return', '确认归还',     'borrow', 'return');
```

## 角色设计

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  USER（普通用户）                                      │
│  ├── book:read                                       │
│  ├── book:borrow                                     │
│  └── book:return                                     │
│                                                      │
│  LIBRARIAN（图书管理员）                                │
│  ├── USER 全部权限                                    │
│  ├── book:create                                     │
│  ├── book:update                                     │
│  ├── category:read                                   │
│  ├── category:create                                 │
│  └── borrow:read                                     │
│                                                      │
│  ADMIN（系统管理员）                                    │
│  ├── LIBRARIAN 全部权限                               │
│  ├── book:delete                                     │
│  ├── category:delete                                 │
│  ├── user:read                                       │
│  ├── user:update                                     │
│  ├── user:delete                                     │
│  └── borrow:return                                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

> 角色设计遵循"最小权限原则"：普通用户只能看和借，管理员有全部操作权限。

## 执行 Migration

```bash
# 修改 prisma/schema.prisma 后
npx prisma migrate dev --name add-rbac-tables
```

---

## 参考链接

- [Prisma — Many-to-many Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/many-to-many-relations)
- [Prisma — Explicit Many-to-many](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/many-to-many-relations#explicit-many-to-many-relations)
