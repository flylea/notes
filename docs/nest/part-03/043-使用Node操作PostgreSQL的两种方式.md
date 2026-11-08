# 第 43 章 使用 Node 操作 PostgreSQL 的两种方式

你在 Node 里写了一段代码，想把一条会议室记录存进 PostgreSQL。代码是 JavaScript，数据库只认 SQL 和它自己的协议，两边说的不是一种话，中间得站一个翻译。

这个翻译叫**驱动（driver）**。你调 `pool.query('SELECT ...')`，它负责把 SQL 按 PostgreSQL 的协议送过去，再把结果翻译成 JS 对象。`pg` 是 Node 里最常用的那个。打个比方，驱动像随身翻译：没有它，你说的它听不懂，它说的你也接不住，这一层绕不过去。后面要讲的 Prisma 8，底层用的也是它。

光有翻译还不够。**连接（connection）**不是一根网线，而是数据库里一个真实的后端进程：占内存、有会话状态、数量有上限（`max_connections`）。每次查询都新建一条，就要付 TCP 握手、认证、分配进程的成本。像去银行办业务，来一个人就现盖一个窗口，人一多，光盖窗口就把大厅堵死了。

**连接池（pool）**就是那排常开的窗口：应用启动时先建一小队连接，查询来了借一条，用完还回去，下一位接着用。它省的是反复建连的成本，不是把数据库的连接上限变大——池子里的 `max` 乘以应用实例数，仍然要落在 `max_connections` 以内。这个区别很关键，后面的事故就是栽在这里。

再往上还有一层 **ORM**（Object-Relational Mapping，对象关系映射）：把表映射成代码里的类型和对象，用链式 API 代替手写 SQL。可以想成点菜——手写 SQL 是直接跟后厨报"牛肉 200 克、切 3 毫米、大火 2 分钟"，ORM 是看菜单点"黑椒牛柳"。菜单背后还是那些原料和火候，但你不必每次都说一遍。好处是类型安全，改表时编译器能提醒你哪里漏改；代价是多一层抽象，复杂查询最后还是得落回 SQL。

它和驱动差在哪：驱动负责"把话送到"，ORM 负责"把话组织好"。Prisma 8 属于后者，底层仍然是 `pg`。

官方文档（先看懂正文再点）：
- [node-postgres（`pg`）](https://node-postgres.com/)：驱动本身的用法，后面 `pool.query` 那段对应它的接口。
- [PostgreSQL 连接与 `max_connections`](https://www.postgresql.org/docs/17/runtime-config-connection.html)：数据库最多允许多少连接，池子的大小要照着它算。
- [Prisma](https://www.prisma.io/docs)：另一条 ORM 路线的总入口，下一章细讲。

现在看一个真实事故。

报表服务上线第二周，数据库开始间歇性拒绝连接，日志里是 `FATAL: sorry, too many clients already`。没人改过连接数。查下来是 PM2（Node 的进程管理器，cluster 模式起多个实例）起了 4 个实例，每个 `pg.Pool` 都吃默认的 `max: 10`，40 条常驻连接，再加上迁移脚本、psql 和监控探针，正好把 `max_connections = 100` 吃满——默认值乘以实例数，悄悄越过了上限。

同一天还出了另一件事。一个导出接口把查询参数直接拼进 SQL 字符串，测试时传的都是正常会议室名，上线后有人传了带引号的字符串，语句结构当场就变了。

这两件事都不是「会不会写 SQL」的问题，而是把连接和输入当成了不受约束的字符串。Node 连 PostgreSQL 有两条路：直接用驱动写 SQL，或者通过 ORM 把表映射成类型和查询 API。两条路都得先把这两件事处理对，否则换哪条都一样出事。

## 把池子建起来

概念说完了，直接写代码。先装驱动。虽然它作为 Prisma 的依赖可能已经在 `node_modules` 里，但别依赖传递依赖——版本跟着 ORM 走，哪天 ORM 换驱动，你的代码先崩：

```bash
pnpm add pg
pnpm add -D @types/pg
```

```ts
// src/db/pool.ts
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('缺少 DATABASE_URL：先复制 .env.example 为 .env');
}

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
  statement_timeout: 5_000,
  query_timeout: 10_000,
  application_name: 'meeting-report',
});

pool.on('error', (error) => {
  console.error('idle client error', error);
});
```

查一条真实数据：

```ts
// src/report.ts
import { pool } from './db/pool.js';

const rows = await pool.query<{ name: string; capacity: number }>(
  'SELECT name, capacity FROM rooms ORDER BY capacity DESC',
);

for (const row of rows.rows) {
  console.log(row.name, row.capacity);
}

await pool.end();
```

```bash
pnpm tsx src/report.ts
```

```text
木星厅 12
土星厅 6
```

（示例输出。）到这里一切正常。真正会咬人的是上面那几个参数——它们每一个都改过默认值，而且默认值大多是「能跑，但生产上会出事」的那种。

## 池子为什么会满

- `max`：每个进程最多持有的连接数。总数是 `实例数 × max`，还要留出迁移、`psql`、监控的余量。把 `max_connections` 当成「每个进程的配额」是连接打满的头号原因。就像每家分店都按总行的窗口数开窗口，开到最后总行没窗口可用了。
- `idleTimeoutMillis`：空闲连接多久回收，`pg` 默认 10 秒。太长占着窗口不放，太短客人刚走窗口就关，下一位又得重新开。
- `connectionTimeoutMillis`：池子空了、排队等连接的超时。默认是 0，也就是永远等——数据库慢的时候请求会一直挂着，而不是快速失败。
- `statement_timeout`：服务端执行超时，到点 PostgreSQL 主动取消，报 `57014`。它保护的是数据库，防止一条烂查询拖垮实例。
- `query_timeout`：客户端等待响应的超时，包含网络和排队时间。它和服务端超时互补：一个管厨房出菜，一个管传菜路上，两个都设。
- `application_name`：出现在 `pg_stat_activity` 里，排障时一眼看出是哪个服务。相当于外卖单上写清楚店名。

`pool.on('error')` 不能省。空闲连接被服务端掐断（重启、`pg_terminate_backend`（管理员主动断开某条连接的函数）、网络抖动）时，错误发在空闲 client 上，没人监听就是未捕获的 `error` 事件，Node 进程直接退出。像窗口挂了个没人接的报警器，一响整栋楼跳闸。

池子健康不健康不用猜，`pg` 把实时计数挂在实例上：

```ts
console.log({
  total: pool.totalCount,
  idle: pool.idleCount,
  waiting: pool.waitingCount,
});
```

```text
{ total: 4, idle: 3, waiting: 0 }
```

`waiting` 持续大于 0，说明 `max` 不够，或者有慢查询占着连接不放。`total` 长期等于 `max`、`idle` 为 0，先去查慢查询，再考虑加连接。数据库侧也能看（`pg_stat_activity` 是 PostgreSQL 的活动会话视图，每条连接一行）：

```sql
SELECT application_name, state, count(*)
  FROM pg_stat_activity
 WHERE application_name = 'meeting-report'
 GROUP BY application_name, state;
```

```text
 application_name | state  | count
------------------+--------+-------
 meeting-report   | idle   |     1
```

一条连接在 PostgreSQL 里就是一个后端进程，占几 MB 到几十 MB 内存，所以 `max` 不是越大越好，它是「用内存换并发」的旋钮。算配额先做减法：`max_connections = 100`，给迁移、备份、`psql`、监控留 20 条，剩下 80 条分给 4 个应用实例，每个实例的 `max` 最多 20，还别用满——连接池会随着并发慢慢爬到上限，不会刚好停在配额线上。

`waiting` 持续大于 0 时也别急着加 `max`。多数情况是某条慢查询占着连接不放，或者事务里夹了外部调用；加连接只是把排队从池子挪到数据库，`max_connections` 迟早还会被打满。

## 参数化：`$1` 不是拼字符串

上面那个事故的修法只有一行：

```ts
const findRoomsByCapacity = async (minCapacity: number) => {
  const { rows } = await pool.query<{ id: string; name: string; capacity: number }>(
    `SELECT id, name, capacity
       FROM rooms
      WHERE capacity >= $1
      ORDER BY capacity DESC, name`,
    [minCapacity],
  );
  return rows;
};

console.log(await findRoomsByCapacity(8));
```

```text
[ { id: '6f1c2d3e-...', name: '木星厅', capacity: 12 } ]
```

`$1` 是占位符，驱动把它单独发送，PostgreSQL 只当值，不参与语法解析。传 `8` 和传 `8; DROP TABLE rooms` 在解析器眼里没有区别，后者只是一个匹配不到任何行的字符串。

可以想成寄快递：参数化是把东西装进封好的盒子，盒子上只写「1 号件」，里面是什么快递员不管；拼字符串是把用户说的话直接写进合同条款，对方补一句「以上条款作废」，合同就变了。注入就是从拼接这里开始的。

两个边界容易忽略。第一，参数只能替代「值」，不能替代表名、列名、`ORDER BY` 的方向；这些位置要白名单映射，不能把用户输入拼进去。第二，`rowCount` 的类型是 `number | null`，`INSERT ... RETURNING` 用 `rows` 取结果，别拿 `rowCount` 当行数。

## 事务：连接必须自己拿、自己还

事务（transaction）是一组要么全成功、要么全回滚的语句。最熟的例子是转账：A 账户扣 100，B 账户加 100，扣钱成功了、加钱失败，这 100 块就凭空消失。事务就是要求这两步绑死。

它必须绑定在同一条连接上。`pool.query('BEGIN')` 是错的：Pool 每次 `query()` 可能换一条连接，`BEGIN` 在 A 上、`INSERT` 在 B 上、`COMMIT` 又回到 A，事务根本没包住任何东西。像三个人接力搬同一批货，每人都重新开一辆车，货压根没装在同一辆车上。

正确做法是从池子里取一条连接，全程用它：

```ts
// src/db/transaction.ts
import type { PoolClient } from 'pg';
import { pool } from './pool.js';

export const withTransaction = async <T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};
```

`client.release()` 必须在 `finally` 里。少写一次，这条连接就永远回不到池子，像借了图书馆的书不还，可借的书只会越来越少；几十次请求之后池子空、请求全卡在 `connectionTimeoutMillis` 上，现象和数据库挂了几乎一样。

用它订一次会议室：

```ts
// src/book.ts
import { withTransaction } from './db/transaction.js';

const bookingId = await withTransaction(async (client) => {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO bookings (user_id, room_id, start_time, end_time)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, roomId, start, end],
  );

  const [booking] = rows;
  if (!booking) {
    throw new Error('INSERT ... RETURNING 没有返回行');
  }
  return booking.id;
});
```

抛异常时先 `ROLLBACK` 再 `release`。如果连接在事务中途出现过协议错误，回滚也可能失败，这时 `release(error)` 会销毁连接而不是放回池子——宁可少一条连接，也别把状态可疑的连接交给下一个请求。

## 错误处理：认 SQLSTATE，不认 message

`pg` 抛出的错误是 `DatabaseError`，关键字段是 `code`（SQLSTATE）、`constraint`、`detail`、`table`、`column`。SQLSTATE 是 PostgreSQL 错误对象上的五位标准错误码，和错误文案、语言环境都无关，是应用层唯一该用来做分支的东西。

打个比方，SQLSTATE 像快递单号，全球唯一、不会因为换了个客服就变；`message` 像客服的口头描述，数据库语言设成中文还是英文，说法都不一样。拿 `message` 做判断，升个版本或换个环境就失效。

```ts
// src/db/errors.ts
import { DatabaseError } from 'pg';

type MappedError = { status: number; message: string };

export const mapDatabaseError = (error: unknown): MappedError => {
  if (error instanceof DatabaseError) {
    switch (error.code) {
      case '23505':
        return { status: 409, message: `已存在：${error.constraint ?? '唯一约束'}` };
      case '23503':
        return { status: 409, message: '引用的记录不存在' };
      case '57014':
        return { status: 504, message: '查询超时，请缩小时间范围' };
      default:
        console.error('database error', {
          code: error.code,
          detail: error.detail,
          constraint: error.constraint,
        });
        return { status: 500, message: '数据库错误' };
    }
  }

  return { status: 500, message: '未知错误' };
};
```

同一个会议室名插两次，拿到的是：

```text
{
  code: '23505',
  constraint: 'rooms_name_key',
  detail: 'Key (name)=(木星厅) already exists.'
}
```

`23505` 唯一键冲突，`23503` 外键引用失败，`57014` 查询被取消。`40001`（序列化失败）和 `40P01`（死锁）是另一类：它们不是业务错误，重试整个事务通常就能成功。重试包在事务外层，并且保证事务幂等：

```ts
const RETRYABLE = new Set(['40001', '40P01']);

export const withRetry = async <T>(work: () => Promise<T>, attempts = 3): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      const code = error instanceof DatabaseError ? error.code : undefined;
      if (!code || !RETRYABLE.has(code) || attempt >= attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** (attempt - 1)));
    }
  }
};
```

不要在事务内部重试单条语句。事务已经中止，后续语句只会报 `25P02`（当前事务已回滚）。要重试就重试整个 `withTransaction`——这就像一锅菜炒糊了，不能只把糊的那一勺倒掉再接着炒，得整锅重来。

`pool` 是长生命周期对象。脚本结束 `await pool.end()` 收尾；Nest 应用里不要在每个请求里 `end()`，那会把共享池关掉，应该放到 `onApplicationShutdown`（Nest 的关闭钩子，应用停机时触发）里。

## 方式二：Prisma 8，同一件事换个写法

Prisma 8 是 contract-first 的。契约（contract）是描述模型与关系的源文件 `contract.prisma`，它像一张建筑图纸：家里几间房、门朝哪开，都画在这一张图上。`contract emit` 则像把图纸复印成两份——一份是施工队照着干的材料清单（`contract.json`，运行时读它），一份是给设计软件看的标注（`contract.d.ts`，TypeScript 读它）。没有这一步，代码里的类型和数据库的真实结构就各说各话，改一列要等上线才发现。

这里和旧版 Prisma 的区别要分清：旧版先写 `schema.prisma`，再 `prisma generate` 生成一个客户端；Prisma 8 不生成客户端，运行时直接拿着契约产物开工。下一章会把这条链路整个拆开。

安装时两个包必须成对：CLI 用 `8.0.0-rc.29`，运行时用 `@prisma/orm-postgres@8.0.0-rc.21`。版本错配不会提示「版本不匹配」，只会给你各种看不懂的解析错误——像螺丝和螺母的型号差了一号，拧不进去，但工具不会告诉你「型号不对」，只会说「螺纹崩了」。

```bash
pnpm add @prisma/orm-postgres@8.0.0-rc.21 temporal-polyfill
pnpm add -D prisma@8.0.0-rc.29
```

```ts
// prisma.config.ts
import { defineConfig as definePostgresConfig } from '@prisma/orm-postgres/config';
import { definePrismaConfig } from 'prisma/config';

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: 'prisma/contract.prisma',
    output: 'src/generated/prisma8',
    db: { connection: process.env.DATABASE_URL ?? '' },
    migrations: { dir: 'prisma/migrations' },
  }),
});
```

```prisma
// prisma/contract.prisma
// use prisma-8

model Room {
  id       Uuid   @id @onCreate(uuid())
  name     String @unique
  capacity Int
  location String

  @@map("rooms")
}
```

```bash
pnpm prisma contract emit
pnpm prisma db init
```

运行时用生成的 `contract.json` 建客户端，没有 `new PrismaClient()`：

```ts
// src/db/prisma.ts
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';
import type { Contract } from '../generated/prisma8/contract.js';
import contractJson from '../generated/prisma8/contract.json' with { type: 'json' };

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('缺少 DATABASE_URL');
}

export const db = postgres({
  contract: contractFromJson<Contract>(contractJson),
  url,
});
```

模型入口长这样：`db.orm.public.模型名`。本章是 `db.orm.public.Room`，后面用户表就是 `db.orm.public.User`。同一条「容量不小于 8」的查询：

```ts
const rooms = await db.orm.public.Room
  .where((room, { fns }) => fns.gte(room.capacity, 8))
  .orderBy((room) => room.capacity.desc())
  .all();
```

事务形状和 `pg` 一样，只是把 `client` 换成了 `tx`：

```ts
await db.transaction(async (tx) => {
  const room = await tx.orm.public.Room.where({ id: roomId }).forUpdate().first();
  if (!room) {
    throw new Error('会议室不存在');
  }

  await tx.orm.public.Booking.create({
    userId,
    roomId,
    startTime: start,
    endTime: end,
  });
});
```

错误形态不一样。Prisma 8 的 `SqlQueryError` 没有 `code`，唯一键冲突在 `sqlState` 上，`constraint`、`detail` 仍可读：

```ts
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object'
  && error !== null
  && 'sqlState' in error
  && (error as { sqlState?: string }).sqlState === '23505';
```

把 `pg` 那套 `error.code === '23505'` 直接搬过来，会永远进不了分支，然后被当成 500 吞掉。

## 两条路怎么选，怎么混

| 场景 | 建议 |
| --- | --- |
| 业务 CRUD、需要类型约束 | Prisma 8，契约就是类型来源 |
| 报表、窗口函数、`EXPLAIN ANALYZE`（看真实执行耗时） | `pg`，SQL 直接写 |
| 批量导入、`COPY`（PostgreSQL 自带的批量导入命令） | `pg`，`COPY FROM STDIN` 比 ORM 快一个量级 |
| 迁移 | Prisma 8 的 `migration plan` + `db migrate` |
| 一次性脚本 | 要复用契约就用 Prisma，不要就 `pg` |

`pg` 不是「低级所以差」，它就是 Prisma 8 的底层驱动——`@prisma/orm-postgres` 自己就依赖 `pg`。理解 Pool 的行为，排障时用得上；理解契约流程，日常开发快得多。

混用最常见的坑是连接数翻倍：Prisma 8 内部有一个池，你自己再 `new Pool()` 又是一个池，两个 `max` 相加才是真实占用。混用时把两边都调小，监控里分开看。

第二个坑是事务不能跨客户端。用 `pg` 的 `client` 开的事务，Prisma 的 `db` 看不到；反过来也一样。一个业务事务只能在一个客户端里完成，别指望两边共享同一个 `BEGIN`。

第三个坑出在代理层。PgBouncer 是应用和数据库之间的连接池代理，让几百个应用连接复用几十条数据库连接。事务模式（transaction pooling）下，同一个客户端的不同事务可能落到不同后端连接，命名 prepared statement（预编译语句，名字绑在会话上）会失效。这不是它的 bug，是语义决定的：它复用的是事务，不是会话，`PREPARE`、`SET`、`LISTEN`、临时表这些会话级状态都不保证跟着走。`pg` 默认查询不带名字，影响小；一旦用了 `name` 选项，或者连接串走 Supabase 的 6543 端口，先确认 pooler 参数，别把「本地能跑」当成「线上能跑」。

> **图 43-1** 两种客户端到 PostgreSQL 的连接路径。
>

```mermaid
flowchart LR
  S["Nest service / CLI 脚本"] --> P["pg.Pool<br/>max = 10"]
  P -->|"connect() 取出"| C1["client<br/>事务期间独占"]
  P -->|"query() 后归还"| C2["client<br/>复用"]
  C1 --> PG[("PostgreSQL 17<br/>max_connections = 100")]
  C2 --> PG
  S --> D["Prisma 8 db"]
  D --> LP["内置连接池"]
  LP --> PG
```

生产上常见的组合是：业务模块走 Prisma 8，报表和运维脚本走 `pg`；两边都用 `DATABASE_URL`，但连接数预算单独算，给迁移和监控留余量。真正要避免的是「同一个查询维护两套实现」——那才是成本的来源。

`pg` 让你看清连接、事务、超时这些底层行为，Prisma 8 把它们包起来，用契约换开发效率。先把池和事务用对，再学契约流程，顺序反过来也能走，但排障时会缺一块拼图。下一章把 Prisma 8 拆开：契约、emit、迁移、CRUD，以及它和 5/6/7 到底差在哪。


<!-- chapter-nav:start -->
---

← 上一篇：[042 PostgreSQL的视图、存储过程和函数](042-PostgreSQL的视图、存储过程和函数.md) · [本 Part 目录](_part.md) · 下一篇：[044 快速掌握Prisma8](044-快速掌握Prisma8.md) →
<!-- chapter-nav:end -->
