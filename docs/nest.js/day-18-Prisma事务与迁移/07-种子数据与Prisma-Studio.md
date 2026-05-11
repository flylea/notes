# 种子数据与 Prisma Studio

## 什么是 Seed（种子数据）

种子数据是**项目的初始数据**，在数据库创建后自动插入。相当于给空数据库"播种"。

```
前端类比：

前端开发时，你会 mock 一些数据来跑页面：
  - Vue: mock/user.js 里的假数据
  - React: MSW handler 里的 mock 响应

Prisma Seed 就是后端的 mock 数据注入机制
但它不仅用于开发——生产环境的初始管理员账号也需要它
```

## 配置 Seed 脚本

在 `package.json` 中添加：

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

> 如果是 Nest 项目，可能需要 `ts-node` 或使用 `tsx`：
> ```json
> { "prisma": { "seed": "tsx prisma/seed.ts" } }
> ```

## 编写 Seed 脚本

```typescript
// prisma/seed.ts
import { PrismaClient, BookStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始播种数据...');

  // ============ 清理旧数据 ============
  // 注意顺序：先删子表，再删主表
  await prisma.borrowRecord.deleteMany();
  await prisma.book.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // ============ 创建用户 ============
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  const userPassword = await bcrypt.hash('user123', 10);
  const user1 = await prisma.user.create({
    data: {
      username: 'zhangsan',
      password: userPassword,
      role: 'USER',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      username: 'lisi',
      password: userPassword,
      role: 'USER',
    },
  });

  console.log(`✅ 创建了 ${3} 个用户`);

  // ============ 创建分类 ============
  const categories = await Promise.all([
    prisma.category.create({ data: { name: '计算机科学' } }),
    prisma.category.create({ data: { name: '文学小说' } }),
    prisma.category.create({ data: { name: '历史哲学' } }),
    prisma.category.create({ data: { name: '科学技术' } }),
    prisma.category.create({ data: { name: '经济管理' } }),
  ]);

  console.log(`✅ 创建了 ${categories.length} 个分类`);

  // ============ 创建图书 ============
  const booksData = [
    {
      title: 'NestJS 从入门到实践',
      author: '张三',
      isbn: '978-7-111-00001-1',
      price: 79.00,
      status: BookStatus.AVAILABLE,
      categoryId: categories[0].id,
    },
    {
      title: 'Prisma ORM 权威指南',
      author: '李四',
      isbn: '978-7-111-00002-2',
      price: 89.00,
      status: BookStatus.AVAILABLE,
      categoryId: categories[0].id,
    },
    {
      title: '深入理解 TypeScript',
      author: '王五',
      isbn: '978-7-111-00003-3',
      price: 69.00,
      status: BookStatus.AVAILABLE,
      categoryId: categories[0].id,
    },
    {
      title: '三体',
      author: '刘慈欣',
      isbn: '978-7-111-00004-4',
      price: 45.00,
      status: BookStatus.BORROWED,
      categoryId: categories[1].id,
    },
    {
      title: '人类简史',
      author: '尤瓦尔·赫拉利',
      isbn: '978-7-111-00005-5',
      price: 68.00,
      status: BookStatus.AVAILABLE,
      categoryId: categories[2].id,
    },
    {
      title: '经济学原理',
      author: '曼昆',
      isbn: '978-7-111-00006-6',
      price: 88.00,
      status: BookStatus.AVAILABLE,
      categoryId: categories[4].id,
    },
    {
      title: '时间简史',
      author: '霍金',
      isbn: '978-7-111-00007-7',
      price: 42.00,
      status: BookStatus.AVAILABLE,
      categoryId: categories[3].id,
    },
    {
      title: '活着',
      author: '余华',
      isbn: '978-7-111-00008-8',
      price: 28.00,
      status: BookStatus.BORROWED,
      categoryId: categories[1].id,
    },
  ];

  for (const bookData of booksData) {
    await prisma.book.create({
      data: {
        title: bookData.title,
        author: bookData.author,
        isbn: bookData.isbn,
        price: bookData.price,
        status: bookData.status,
        category: { connect: { id: bookData.categoryId } },
      },
    });
  }

  console.log(`✅ 创建了 ${booksData.length} 本图书`);

  // ============ 创建借阅记录（演示用） ============
  const borrowedBooks = await prisma.book.findMany({
    where: { status: BookStatus.BORROWED },
  });

  for (const book of borrowedBooks) {
    await prisma.borrowRecord.create({
      data: {
        userId: user1.id,
        bookId: book.id,
        borrowedAt: new Date('2024-01-10'),
      },
    });
  }

  console.log(`✅ 创建了 ${borrowedBooks.length} 条借阅记录`);
  console.log('🎉 种子数据播种完成！');
}

main()
  .catch((e) => {
    console.error('❌ Seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## 运行 Seed

```bash
# 直接运行
npx prisma db seed

# migrate reset 后自动运行 seed
npx prisma migrate reset
# → 清空数据库 → 应用 migration → prisma db seed

# 指定 ts-node 编译器选项
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

## Seed 的最佳实践

```typescript
// ✅ 良好的 Seed 脚本结构

// 1. 幂等性：多次运行不会重复插入
//    使用 upsert 或在开头 deleteMany 清理

// 2. 使用环境变量区分环境
const isProduction = process.env.NODE_ENV === 'production';

// 3. 生产环境只插入必要数据
if (isProduction) {
  // 只创建默认管理员账号和必要配置
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
} else {
  // 开发/测试环境插入丰富的示例数据
  await createMockUsers(50);
  await createMockBooks(200);
  await createMockBorrowRecords(30);
}

// 4. 使用 faker 生成随机数据（仅开发环境）
import { faker } from '@faker-js/faker';

async function createMockUsers(count: number) {
  const users = Array.from({ length: count }, () => ({
    username: faker.internet.userName(),
    nickname: faker.person.fullName(),
    password: bcrypt.hashSync('password123', 10),
  }));

  await prisma.user.createMany({ data: users });
}
```

## Prisma Studio——可视化数据库管理

```bash
# 启动 Prisma Studio
npx prisma studio

# 默认在 http://localhost:5555 打开
# 一个 Web UI，可以查看和编辑数据库数据
```

### Studio 的功能

```
┌───────────────────────────────────────────────┐
│  Prisma Studio                                │
│                                               │
│  左侧：数据模型列表                             │
│  ├── User                                     │
│  ├── Book                                     │
│  ├── BorrowRecord                             │
│  ├── Category                                 │
│  └── Tag                                      │
│                                               │
│  右侧：数据表格视图                             │
│  ┌────┬──────────┬────────┬───────┬──────┐   │
│  │ id │ username │ role   │ phone │ ...  │   │
│  ├────┼──────────┼────────┼───────┼──────┤   │
│  │ 1  │ admin    │ ADMIN  │       │      │   │
│  │ 2  │ zhangsan │ USER   │       │      │   │
│  └────┴──────────┴────────┼───────┴──────┘   │
│                                               │
│  可以：新增行 / 编辑单元格 / 删除行 / 筛选 / 排序 │
│                                               │
└───────────────────────────────────────────────┘
```

### Studio 的适用场景

| 场景 | 说明 |
|------|------|
| 开发调试 | 快速查看数据库中的数据是否正确 |
| 手动修正 | 临时改一条数据，不需要写 SQL |
| 数据探索 | 了解表之间的关系，查看关联数据 |
| 给非技术人员用 | 产品经理/测试可以用来看数据 |
| 学习 SQL | 操作对应 SQL 可以在日志中看到 |

> ⚠️ Studio 是一个轻量级管理工具，不适合作为正式的生产数据管理后台。生产环境建议使用专门的数据库管理工具（DBeaver、DataGrip 等）。

## 完整的开发环境初始化流程

```bash
# 新成员加入项目时的完整初始化步骤：

# 1. 克隆项目
git clone <项目地址>

# 2. 安装依赖
npm install

# 3. 配置 .env
cp .env.example .env
# 编辑 .env，填入本地数据库连接信息

# 4. 初始化数据库
npx prisma migrate dev    # 创建数据库并应用所有 migration

# 5. 播种数据
npx prisma db seed        # 插入示例数据

# 6. 启动开发
npm run start:dev

# 7. （可选）打开 Studio 查看数据
npx prisma studio
```

---

## 参考链接

- [Prisma — Seeding](https://www.prisma.io/docs/guides/migrate/seed-database)
- [Prisma — Prisma Studio](https://www.prisma.io/docs/concepts/components/prisma-studio)
- [Prisma — Configuring Your Prisma Seed](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#example-1)
