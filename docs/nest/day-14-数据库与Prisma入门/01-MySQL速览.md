# MySQL 速览

## MySQL 是什么

MySQL 是世界上最流行的开源关系型数据库。它以"数据库 → 表 → 行 → 列"的层级结构组织数据。

## 核心概念

```
MySQL Server (服务实例)
 ├── database_1 (数据库 = 一个独立的数据空间)
 │    ├── table_users (表 = 一个实体集合)
 │    │    ├── row: { id: 1, username: 'john' } (行 = 一条记录)
 │    │    └── row: { id: 2, username: 'jane' }
 │    └── table_books
 ├── database_2
 └── ...
```

## 常用数据类型

| 类型 | 用途 | 示例 |
|------|------|------|
| `INT` / `BIGINT` | 整数 | `id INT AUTO_INCREMENT` |
| `VARCHAR(n)` | 变长字符串 | `username VARCHAR(50)` |
| `TEXT` / `LONGTEXT` | 长文本 | `description TEXT` |
| `DECIMAL(m,n)` | 精确小数（金额） | `price DECIMAL(10,2)` |
| `BOOLEAN` / `TINYINT(1)` | 布尔值 | `is_active TINYINT(1)` |
| `DATETIME` / `TIMESTAMP` | 日期时间 | `created_at DATETIME DEFAULT NOW()` |
| `JSON` | JSON 文档 | `metadata JSON` |

## 建库建表

```sql
-- 创建数据库（utf8mb4 支持 emoji）
CREATE DATABASE book_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE book_management;

-- 创建用户表
CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建图书表
CREATE TABLE books (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  author VARCHAR(50) NOT NULL,
  isbn VARCHAR(13),
  price DECIMAL(10,2) DEFAULT 0,
  description TEXT,
  cover VARCHAR(255),
  status ENUM('available', 'borrowed') DEFAULT 'available',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## MySQL 的关键特性

| 特性 | 说明 |
|------|------|
| AUTO_INCREMENT | 自动递增主键 |
| ENUM | 枚举类型，限制字段取值 |
| ON UPDATE CURRENT_TIMESTAMP | 自动更新修改时间 |
| utf8mb4 | 完整 Unicode 支持（含 emoji） |

## 与前端视角的类比

```
MySQL 数据库    ↔  Vuex/Pinia Store （全局状态容器）
表 (Table)      ↔  Store 中的 Module （user module, book module）
行 (Row)        ↔  Module 中的一条数据
列 (Column)     ↔  数据对象的属性
索引 (Index)    ↔  计算属性缓存 （加速查找）
事务 (Transaction) ↔  Pinia $patch （一组操作的原子性）
```

> Day 2 已经安装过 MySQL 8.0。如果还没安装，回顾 [day-02/01-dev-environment.md](../day-02-nest-cli-setup/01-dev-environment.md)。

---

## 参考链接

- [MySQL Documentation](https://dev.mysql.com/doc/refman/8.0/en/)
- 开源笔记：《Nest 通关秘籍》.doc/30.MySQL数据库基本概念.md
