# 第 35 章 快速入门 PostgreSQL

## 两个人订到同一间房，问题出在哪

A301 在同一时段出现了两条预订。两行 `start_time` 都是 `09:00`，字段类型是 `timestamp`——一条按北京时间填，一条按 UTC 填，两串数字一模一样，含义差了八小时。谁都没填错，是字段类型把时区吞了。

再往前追一步，这两条记录本来就不该同时存在。现在的流程是「一间会议室一张 Excel，谁要订口头说一声，行政去改表」，问题从第一天就埋下了：

- 数据有两个副本，两个人同时打开、各存各的，后保存的把前一个覆盖了。
- 日期是手打的字符串，`11/4 上午` 和 `2026-11-04 09:00` 混在一列里，排序靠肉眼。
- 想统计「上周哪间房最忙」，只能一格格数；数错了也没有任何东西会报警。

数据库接管的就是这三件事：**同一份数据只有一个地方存**，谁改了别人下一次查就能看到；**每列有类型**，日期就是日期，塞不进一句话；**可以按条件问它**，不用自己数格子。

它不是一个更快的 Excel。它是个会替你守规矩的程序——规矩写进库里之后，绕过你写的 Nest 代码、直接敲 SQL 也破不了。这一章从最基础的几个词讲起，然后用 PostgreSQL 17 把会议室预订的三张表建起来，灌进 14 条数据，最后从 Node 里查一次。往后六章的查询、JOIN、事务，都在这套表和数据上做。

选 PG 不选 MySQL 的理由很实在：时区错一小时、金额差几分、两个人同时订到同一间房，这三件事在 PG 的类型和约束里有直接答案（`timestamptz`、`numeric`、`EXCLUDE`，第 41 章细讲），MySQL 的对应写法后面会随手标出来。

先说清一件事：下面所有输出都是**示例输出**，命令未实测。写作环境里没有真的跑起 PostgreSQL 17，数值是按这章灌进去的 14 条预订推算的，报错文本取自 PG 17 文档。你在自己机器上跑，UUID 和耗时会对不上，行数和结论应该一致。

## 表、行、列，先把词对上

关系数据库把数据放在二维表里。「关系」这个词跟表与表之间的关系没关系，它指的是数据按行和列摆整齐，是数学史留下来的包袱，先不用管。

- **表（table）**：一类东西的集合。`users` 表只放人，`rooms` 只放会议室，`bookings` 只放「谁在什么时候订了哪间房」。类比：文件柜的一层抽屉，里面每张卡片格式都一样。
- **行（row）**：表里的一条完整记录。`users` 的一行是一个用户，`bookings` 的一行是一次预订。也叫记录（record）。
- **列（column）**：一条记录里的一个字段。`users` 有 `name`、`email`、`created_at` 这几列，每列放同一类信息。也叫字段（field）。

为什么非要拆成行和列？把所有信息塞进一张大表也行——预订 id、用户名、房间名、房间容量、开始时间全在一行。问题是同一间房的容量会在几十条预订里重复几十遍，改一次要改几十行，改漏一行就出现「同一个房间两个容量」。这种重复叫冗余，第 38 章会讲怎么拆开。

每列都有一个**类型**：`start_time` 是时间，`seats` 是整数，`status` 是一小撮固定字符串。类型不只决定「能存什么」，还决定怎么比较、怎么排序、能不能带时区。开头那场事故的根子就在类型上：`timestamp` 不存时区，谁写进来的字面量就是什么，两个人各自以为的「九点」被存成了同一个数字。

## 主键：这一行的身份证

一行数据得能被唯一指认，否则「改陈默的手机号」这句话，数据库不知道你指哪一行——万一有两个陈默。

**主键（primary key）** 就是选定一列（或几列）当这一行的身份证：值不能重复、不能为空，一张表只能有一个主键。`users.id`、`rooms.id`、`bookings.id` 都是主键。

没有它会卡在哪？`UPDATE users SET phone = ...` 少写一个 `WHERE`，全表所有人的手机号一起被改；想删掉某一条预订，只能靠「房间名 + 时间 + 备注」拼条件，拼漏一个字段就删错。有主键，改和删都只说一句「id 等于这个」。

它跟唯一约束（`UNIQUE`）差在哪：两者都禁止重复，但主键额外禁止 `NULL`，而且一张表只能有一个；`UNIQUE` 可以有好几个，也允许 `NULL`（PG 认为两个 `NULL` 不算撞车）。一句话记：主键是身份，唯一约束是「这列不许重复」。

## 外键：指向另一张表的那一行

`bookings` 里存的是 `room_id`，不是房间名字。这个值必须是 `rooms` 里真实存在的一行，这条规则叫**外键（foreign key）**。类比：借条上写的「借款人身份证号」，得是派出所能查到的那个人；写个假号，借条就废了。

没有它会卡在哪？应用里一个手滑，`bookings` 里出现一个指向不存在房间的 `room_id`：报表按房间分组时多出一行「幽灵房」，JOIN 一查还是空，而且半年后你才发现，已经不知道该修哪一条。

外键和主键最容易混：主键回答「我是谁」，外键回答「我指向谁」。外键是子表上的列，值必须能在父表主键里找到。

外键顺带还决定了一件事：删掉父表那一行时，子表这些行怎么办。这个动作叫**级联**，`ON DELETE CASCADE` 是跟着删，`ON DELETE RESTRICT` 是拦住你。第 37 章会用「删一间会议室」把五种动作过一遍。

## 索引：书后面的目录

没有索引时，`WHERE id = '...'` 要从第一行扫到最后一行，几万行还能忍，几百万行就是每次查询都在等磁盘。

**索引（index）** 像书后面的目录：先查到位置，再直接翻到那一页。它是额外维护的一份有序结构，代价是每次写入都要顺手更新它。

它和主键的区别：主键底下**自动**配一个索引，但索引不等于主键——你可以在任意列上建索引，一个表也能建很多个。反过来，普通外键列在 PostgreSQL 里**不会**自动建索引，第 37 章会看到这条规则怎么让删房间变慢。

## 约束：把规矩写进库里

把这些规则写进数据库、而不是只写在 Nest 的 DTO 里，是这一章的主线。

理由很直接：DTO 只拦得住走你这个接口的请求。运维手敲一条 SQL、另一个服务直连、迁移脚本跑错，都绕过 DTO。而 `NOT NULL`、`UNIQUE`、`CHECK`、外键、`EXCLUDE`（禁止两行在指定范围上重叠）这些**约束**写在表上，谁进来都得先过这一关，坏数据在入口就被拒绝。

每个约束具体怎么写，下面用三张表的 DDL 逐个过；这里先知道它们各自在管什么就够。

官方文档（先看懂正文再点）：
- [关系模型与建表](https://www.postgresql.org/docs/17/tutorial-table.html)：讲一张表怎么建、每列放什么，对应开头「表、行、列」那段。
- [DDL](https://www.postgresql.org/docs/17/ddl.html)：建表、改表语句的总目录，后面三张表的写法都从这里查。
- [约束](https://www.postgresql.org/docs/17/ddl-constraints.html)：`NOT NULL`、`UNIQUE`、`CHECK`、外键各管什么，对应上面「把规矩写进库里」。
- [索引](https://www.postgresql.org/docs/17/indexes.html)：为什么没有索引就要全表扫，对应「索引」那段。

> **图 35-1** 从应用和 psql 到三张表的路径

```mermaid
flowchart LR
  A["Nest 应用<br/>pg Pool"] -->|"TCP 5432"| B["Docker 端口映射<br/>5432:5432"]
  C["psql / 迁移脚本"] -->|"docker exec"| D["容器 pg17"]
  B --> D
  D --> E["database: booking"]
  E --> F["schema: public"]
  F --> G["users"]
  F --> H["rooms"]
  F --> I["bookings"]
```

## 用容器起一个 17

本机装没装 PG 不重要，容器里跑一个更接近线上：版本固定、CI 和同事机器一致、卸载不留残渣。先确认 5432 没被占：

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
# 没有输出才继续；有输出就换 5433，或者先停掉占用进程
```

```bash
docker run --name pg17 \
  -e POSTGRES_PASSWORD='booking_dev_pwd' \
  -e POSTGRES_DB=booking \
  -e TZ=Asia/Shanghai \
  -p 5432:5432 \
  -v pg17-data:/var/lib/postgresql/data \
  -d postgres:17
```

`POSTGRES_DB` 让镜像初始化时直接建出 `booking`，省掉手动 `createdb`。`POSTGRES_PASSWORD` 只在数据目录为空的第一次初始化时生效；卷里已经有数据，改这个环境变量不会改密码，你会对着「密码明明改了却登不上」发呆。`-v` 挂的是命名卷，删容器不删数据——匿名卷在 `docker rm` 之后会变成悬空卷，数据找得回来但很难认。镜像标签用 `17` 而不是 `latest`：前者只跟 17.x 小版本走，不会哪天重启就跳到 18。

等两秒，确认它真能接受连接：

```bash
docker exec pg17 pg_isready -U postgres -d booking
# /var/run/postgresql:5432 - accepting connections
```

`accepting connections` 只说明进程在听端口，不代表你的库、表、权限都对。容器反复重启就看 `docker logs pg17`，九成是数据目录权限或旧卷版本不兼容；换个卷名重来，别在旧数据上硬修。

## 进 psql，先认清三层

```bash
docker exec -it pg17 psql -U postgres -d booking
```

提示符变成 `booking=#`。`psql` 是 PG 自带的命令行客户端，相当于「直接进数据库里说话」的窗口，不经任何应用代码。

MySQL 的层级是「库 → 表」，PG 中间多一层 **schema**。类比：database 是一栋楼，schema 是楼层，table 是抽屉——你要找东西，得先说哪栋楼、哪层、哪个抽屉。所以一张表的完整名字是 `database.schema.table`。跨 database 查询在 PG 里做不到，要跨库只能上 `postgres_fdw` 或者在应用层拼。

```text
booking=# \dn
  Name  |  Owner
--------+----------
 public | postgres
(1 row)

booking=# \dt
Did not find any relations.
```

`public` 是默认 schema，库刚建出来时它就是空的；`template0` / `template1` 是建库模板，别往里写业务数据。还有一个容易误会的点：`public` 不等于「公共可写」，PG 15 起它默认就不再对所有人开放建表权限，后面授权那一节会撞上。

几个够用的元命令（反斜杠开头，是 psql 自己的命令，不是 SQL）：

| 命令 | 作用 |
| --- | --- |
| `\l` | 列出所有 database |
| `\dn` | 列出当前库的 schema |
| `\dt` | 列出当前 schema 的表 |
| `\d bookings` | 看列、索引、外键、约束 |
| `\di` | 只看索引 |
| `\x` | 切换扩展显示，宽表必备 |
| `\timing` | 打开后每条语句显示耗时 |

`\dt` 查的是 `search_path` 里的 schema，默认 `"$user", public`。建表时没写 schema 就落在 `public`；哪天 `search_path` 被改过，`\dt` 看不见表不代表表没了，`\dt *.*` 才是全库扫。

psql 里还有一条隐式规则要习惯：不加双引号的标识符会被折叠成小写，`CREATE TABLE Users` 建出来其实叫 `users`；只有加了引号的 `"Users"` 才保留大小写，之后每次查询也都得带引号。这就像门牌号默认不区分大小写，你非要用大写登记，之后每次找它都得一字不差地念。这是从 MySQL 迁过来最常见的「表明明建了却说不存在」。

## 三张表，把规则写进 DDL

会议室系统的核心就三张表：谁（`users`）、在哪（`rooms`）、订了什么时段（`bookings`）。

建表用的 `CREATE TABLE` 属于 **DDL**（数据定义语言），管的是「结构」；`SELECT`/`INSERT` 那类属于 DML，管的是「数据」。第 36 章会给你一张四类语句的对照表，这里先记住一件事：**PG 的 DDL 是事务性的**，`BEGIN; ALTER TABLE ...; ROLLBACK;` 真的能撤销；MySQL 的 DDL 会隐式提交，写迁移脚本时这条差异很关键——迁移失败时 PG 能把半截 DDL 一起回滚，MySQL 可能给你留一个改了一半的表。

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'USER'
                CHECK (role IN ('ADMIN', 'USER')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  capacity   integer NOT NULL CHECK (capacity > 0),
  location   text NOT NULL,
  equipment  text[] NOT NULL DEFAULT '{}',
  status     text NOT NULL DEFAULT 'AVAILABLE'
             CHECK (status IN ('AVAILABLE', 'MAINTENANCE')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  room_id    uuid NOT NULL REFERENCES rooms (id) ON DELETE RESTRICT,
  start_time timestamptz NOT NULL,
  end_time   timestamptz NOT NULL,
  status     text NOT NULL DEFAULT 'PENDING'
             CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  remark     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_bookings_room_time
  ON bookings (room_id, start_time, end_time);
CREATE INDEX idx_bookings_user ON bookings (user_id);
```

这段 DDL 里有几处是在「把规则写进库里」，值得逐个交代：

- **主键** 是能唯一标识一行的列，隐含 `NOT NULL` + `UNIQUE`，底下自动配一个 B-tree 索引；没有它，两行就分不开，`UPDATE` 可能改错行。这里用 `uuid`：订单 id 一进 URL，自增整数就等于把「这个月有多少单」写给所有人看。代价是 16 字节、v4 随机分布会打散 B-tree 的页，写放大高一点——会议室这个量级不用纠结。
- **`timestamptz` 存绝对时刻**。它内部是 UTC（微秒精度），显示时按会话的 `TimeZone` 换算；`timestamp` 只存字面量，谁写进来就永远是什么，跨时区必出事。开头那场事故就是 `timestamp` 干的。`now()` 返回的也是 `timestamptz`，两者能直接比。
- **`CHECK` 是写在表上的规则**，绕过 Nest 直接跑 SQL 的脚本也破不了。注意它的三值逻辑：表达式结果是 `NULL` 时视为通过——所以 `end_time > start_time` 要真的兜住，两列都得 `NOT NULL`。
- **外键动作（`ON DELETE`）先想清楚语义**。用户注销，他的预订跟着 `CASCADE` 删掉；会议室不能删，历史预订要留证据，所以用 `RESTRICT` 挡住。`NO ACTION` 默认也是拒绝，但可以配 `DEFERRABLE` 延迟到事务末尾检查，日常写 `RESTRICT` 表意更明确。
- **索引** 是为了不必全表扫而额外维护的有序结构，代价是每次写入都要维护它。查「某间房某天有没有空」走 `(room_id, start_time)`；复合索引只能从最左列开始用，`WHERE start_time > ...` 单独出现时用不上它。第三列 `end_time` 帮不上过滤，它的价值是让「只取这三列」的查询走覆盖索引，少回表。

`equipment` 用 `text[]` 存标签，比逗号拼接好查：`@>` 判断包含，`&&` 判断有交集，都能直接用 GIN 索引；逗号串只能 `LIKE '%projector%'`，既走不了索引，还会把 `projector2` 误匹配进来。

## 别让应用拿超级用户连

现在表是 `postgres` 建的。应用继续用超级用户连，等于把整栋楼的万能钥匙交给一个刚毕业的 ORM 配置错误：一条拼错的 `DELETE`、一次误执行的迁移，都没有第二道闸。

建一个只够用的角色：

```sql
ALTER DATABASE booking SET timezone TO 'Asia/Shanghai';
CREATE ROLE booking_app LOGIN PASSWORD 'booking_app_pwd';

GRANT CONNECT ON DATABASE booking TO booking_app;
GRANT USAGE ON SCHEMA public TO booking_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO booking_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO booking_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO booking_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO booking_app;
```

这几类权限是分层的，缺一层就报错，像进楼的三道门禁：`CONNECT` 决定能不能进这栋楼（连库），`USAGE ON SCHEMA` 决定能不能看见这一层（少了它连上去也报 `permission denied for schema public`），表级 `SELECT/INSERT/...` 才决定进屋能做什么。

`ALTER DATABASE ... SET timezone` 只对新会话生效，验证要重连：

```text
booking=# \c booking
You are now connected to database "booking" as user "postgres".
booking=# SHOW timezone;
   TimeZone
---------------
 Asia/Shanghai
(1 row)
```

两个容易踩的点。第一，PG 15 起 `public` 不再默认对所有人可写，`GRANT CREATE` 要显式给；反过来，应用角色通常**不该**有 `CREATE`，建表是迁移账号的事。第二，`ALTER DEFAULT PRIVILEGES` 只影响**执行者**之后建的对象；迁移是 `postgres` 跑的、应用是 `booking_app` 连的，这套默认权限才生效，换个人跑迁移就得用 `FOR ROLE` 再补一遍。生产上把「迁移账号」和「运行账号」固定下来，别今天用 A 明天用 B。

## 灌 14 条预订

用户和会议室直接插。注意 `equipment` 的数组字面量写法是 `'{projector,whiteboard}'`：

```sql
INSERT INTO users (id, name, email, password_hash, role) VALUES
  ('11111111-1111-4111-8111-111111111111', '林岚', 'linlan@example.com', '$2b$12$demo', 'ADMIN'),
  ('22222222-2222-4222-8222-222222222222', '陈默', 'chenmo@example.com', '$2b$12$demo', 'USER'),
  ('33333333-3333-4333-8333-333333333333', '周雨', 'zhouyu@example.com', '$2b$12$demo', 'USER'),
  ('44444444-4444-4444-8444-444444444444', '赵启', 'zhaoqi@example.com', '$2b$12$demo', 'USER'),
  ('55555555-5555-4555-8555-555555555555', '孙禾', 'sunhe@example.com', '$2b$12$demo', 'USER'),
  ('66666666-6666-4666-8666-666666666666', '吴桐', 'wutong@example.com', '$2b$12$demo', 'USER');

INSERT INTO rooms (id, name, capacity, location, equipment, status) VALUES
  ('a1111111-1111-4111-8111-111111111111', 'A301', 8,  'A 座 3 层', '{projector,whiteboard}', 'AVAILABLE'),
  ('a2222222-2222-4222-8222-222222222222', 'A302', 12, 'A 座 3 层', '{projector,video,speakerphone}', 'AVAILABLE'),
  ('a3333333-3333-4333-8333-333333333333', 'B201', 4,  'B 座 2 层', '{whiteboard}', 'AVAILABLE'),
  ('a4444444-4444-4444-8444-444444444444', 'B202', 20, 'B 座 2 层', '{projector,video,speakerphone,whiteboard}', 'AVAILABLE'),
  ('a5555555-5555-4555-8555-555555555555', 'C101', 6,  'C 座 1 层', '{tv}', 'MAINTENANCE');
```

用户和会议的 `id` 都是手写的，没用 `gen_random_uuid()` 的默认值。因为后面几章要反复按固定 id 查：A301 是 `a1111111-...`，陈默是 `22222222-...`。随机生成的 id 每台机器都不一样，示例和输出就对不上了。默认值只在没给 id 时兜底。

预订表要引真实 id，手写 14 条子查询太脏，用 `VALUES` 拼一张临时表，再 `JOIN` 换出 id：

```sql
INSERT INTO bookings (id, user_id, room_id, start_time, end_time, status, remark)
SELECT v.id::uuid, u.id, r.id, v.start_time, v.end_time, v.status, v.remark
FROM (VALUES
  ('b1111111-1111-4111-8111-111111111111', 'chenmo@example.com', 'A301', '2026-11-02 09:00+08'::timestamptz, '2026-11-02 10:00+08'::timestamptz, 'APPROVED', '周会'),
  ('b2222222-2222-4222-8222-222222222222', 'zhouyu@example.com', 'A301', '2026-11-02 14:00+08'::timestamptz, '2026-11-02 15:30+08'::timestamptz, 'APPROVED', '需求评审'),
  ('b3333333-3333-4333-8333-333333333333', 'zhaoqi@example.com', 'A302', '2026-11-02 10:00+08'::timestamptz, '2026-11-02 11:00+08'::timestamptz, 'APPROVED', '客户拜访'),
  ('b4444444-4444-4444-8444-444444444444', 'chenmo@example.com', 'A302', '2026-11-03 09:30+08'::timestamptz, '2026-11-03 10:30+08'::timestamptz, 'PENDING', '技术方案讨论'),
  ('b5555555-5555-4555-8555-555555555555', 'sunhe@example.com', 'B201', '2026-11-03 13:00+08'::timestamptz, '2026-11-03 14:00+08'::timestamptz, 'APPROVED', '设计走查'),
  ('b6666666-6666-4666-8666-666666666666', 'zhouyu@example.com', 'B202', '2026-11-03 15:00+08'::timestamptz, '2026-11-03 17:00+08'::timestamptz, 'APPROVED', '季度复盘'),
  ('b7777777-7777-4777-8777-777777777777', 'zhaoqi@example.com', 'A301', '2026-11-04 09:00+08'::timestamptz, '2026-11-04 10:00+08'::timestamptz, 'APPROVED', '销售晨会'),
  ('b8888888-8888-4888-8888-888888888888', 'chenmo@example.com', 'A301', '2026-11-04 09:30+08'::timestamptz, '2026-11-04 10:30+08'::timestamptz, 'PENDING', '临时插会'),
  ('b9999999-9999-4999-8999-999999999999', 'linlan@example.com', 'A302', '2026-11-04 14:00+08'::timestamptz, '2026-11-04 16:00+08'::timestamptz, 'APPROVED', '全员会'),
  ('baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'sunhe@example.com', 'B202', '2026-11-05 10:00+08'::timestamptz, '2026-11-05 12:00+08'::timestamptz, 'APPROVED', '培训'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'zhouyu@example.com', 'B201', '2026-11-05 15:00+08'::timestamptz, '2026-11-05 16:00+08'::timestamptz, 'CANCELLED', '临时取消'),
  ('bccccccc-cccc-4ccc-8ccc-cccccccccccc', 'zhaoqi@example.com', 'A301', '2026-11-06 09:00+08'::timestamptz, '2026-11-06 09:30+08'::timestamptz, 'APPROVED', NULL),
  ('bddddddd-dddd-4ddd-8ddd-dddddddddddd', 'linlan@example.com', 'A302', '2026-11-05 09:00+08'::timestamptz, '2026-11-05 10:00+08'::timestamptz, 'REJECTED', '场地重复申请'),
  ('beeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'chenmo@example.com', 'A302', '2026-11-06 16:00+08'::timestamptz, '2026-11-06 18:00+08'::timestamptz, 'CANCELLED', '客户改期')
) AS v (id, email, room, start_time, end_time, status, remark)
JOIN users u ON u.email = v.email
JOIN rooms r ON r.name = v.room;
```

`+08` 是时区偏移，`timestamptz` 认；写成 `'2026-11-02 09:00'` 会按会话时区解释，换台机器结果就变——这正是开头那场事故的另一种形态。

这 14 条覆盖四种状态、五个工作日，后面章节的统计都基于它。`INSERT ... SELECT` 从 `VALUES` 读数据、再按邮箱和房名换真实 id，比手写 14 条子查询清爽，也不怕 id 顺序变；`JOIN users` 在这里兼当校验，邮箱写错的行会直接插不进去，而不是塞一条对不上人的预订。

## 写进去，马上把行拿回来

增删改一律带 `RETURNING`：`INSERT`/`UPDATE`/`DELETE` 本来只回报影响几行，`RETURNING` 让你在同一个往返里拿到刚写的那行，少一次 `SELECT`，也少一次「刚才那条 id 是多少」的心算。

```sql
BEGIN;

INSERT INTO rooms (id, name, capacity, location, equipment)
VALUES ('a9999999-9999-4999-8999-999999999999', 'A303', 10, 'A 座 3 层', '{projector}')
RETURNING id, name, capacity;

UPDATE rooms SET capacity = 12
WHERE name = 'A303'
RETURNING name, capacity, status;

DELETE FROM rooms
WHERE name = 'A303'
RETURNING name;

ROLLBACK;
```

```text
                  id                  | name | capacity
--------------------------------------+------+----------
 a9999999-9999-4999-8999-999999999999 | A303 |       10
(1 row)

 name | capacity | status
------+----------+---------
 A303 |       12 | AVAILABLE
(1 row)

 name
------
 A303
(1 row)

ROLLBACK
```

包在事务里再回滚，是为了不给第 40 章的统计留下一条 A303；`BEGIN` / `ROLLBACK` 的细节在第 41 章，这里先当成「试验完就撤销」。

再单独撞一次唯一约束，看清报错长什么样：

```sql
INSERT INTO users (name, email, password_hash)
VALUES ('陈默二号', 'chenmo@example.com', '$2b$12$demo');
```

```text
ERROR:  duplicate key value violates unique constraint "users_email_key"
DETAIL:  Key (email)=(chenmo@example.com) already exists.
```

约束名 `users_email_key` 是「表名 + 列名 + key」拼出来的。应用里按 `err.constraint` 判断「邮箱已注册」比匹配整段错误文本稳——错误文案随语言环境变，约束名是你自己定的。

要「有就跳过、没有就插」，用 `ON CONFLICT (email) DO NOTHING` 或 `DO UPDATE`，它只处理你指定的冲突目标，不会把别的唯一约束一起吞掉，也就是 MySQL `INSERT ... ON DUPLICATE KEY UPDATE` 的对应物。

## 从 Node 里查一次

连接串长这样：

```text
postgresql://booking_app:booking_app_pwd@localhost:5432/booking?sslmode=disable
```

拆开看：协议、用户名、密码、主机、端口、database、参数。密码里有 `@`、`:`、`/` 必须 percent-encode，否则解析位置全乱；本地开发 `sslmode=disable`，线上至少 `require`，能验证书就 `verify-full`。连接串只说明「连哪台库、以谁的身份」，能干什么由上面那组 `GRANT` 决定。

Node 侧先用最朴素的 `pg`（node-postgres），不经过 ORM，这样 SQL 和数据库之间没有翻译层：

```ts
// src/db.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 3_000,
});
```

`Pool` 维持一组长连接，用完归还，像一叠预先办好的月卡：不用每个请求都排队办卡（重新握手、认证），代价是占着资源。`max` 是上限，不是越大越好：数据库的连接数、内存、CPU 都有限，十个并发配十个连接通常够用，调到 100 只会让锁等待更长。`connectionTimeoutMillis` 必须设，否则数据库挂掉时请求一直排队，直到把整个进程拖死。

```ts
// src/rooms/rooms.repository.ts
import { pool } from '../db.js';

type Room = { id: string; name: string; capacity: number };

export const listAvailableRooms = async (): Promise<Room[]> => {
  const { rows } = await pool.query<Room>(
    `SELECT id, name, capacity
       FROM rooms
      WHERE status = $1
      ORDER BY capacity DESC`,
    ['AVAILABLE'],
  );
  return rows;
};
```

`$1` 是参数占位符，值单独传。别用模板字符串拼 SQL——那是在给注入留门，而注入不是「前端会转义」，是任何能控制输入的人都能读走整张表。等价 SQL 在 psql 里跑出来：

```sql
SELECT name, capacity FROM rooms
WHERE status = 'AVAILABLE'
ORDER BY capacity DESC;
```

```text
 name | capacity
------+----------
 B202 |       20
 A302 |       12
 A301 |        8
 B201 |        4
(4 rows)
```

C101 不在结果里，因为它的 `status` 是 `MAINTENANCE`。还有个 `pg` 特有的坑：`integer` 会解析成 JS `number`，`numeric` 默认返回**字符串**，因为 JS 的 `number` 是双精度浮点，装不下任意精度。金额字段别顺手 `parseFloat`，要么保持字符串交给 `decimal` 库，要么在 SQL 里 `::float8` 并明确接受精度损失。

上面那个 `Room` 类型是照着 `SELECT` 的列手写的，它是一个 **PO**（Persistent Object，持久化对象）：字段和表列一一对应，只负责把行装回来。再给它加上 `reschedule()` 这类行为，就更接近 **Entity**（实体）——有唯一标识、生命周期可追踪的业务对象。类比：PO 是「从抽屉里拿出来的一张卡片」，Entity 是「这张卡片背后那个能改期、能取消的会议」。

把查询收在 `rooms.repository.ts` 这种文件里、方法名用业务语义（`findAvailableRooms`），就是 **Repository**；贴着表写、方法粒度是「按表 + 条件」的叫 **DAO**。小项目里两者常合成一个文件，关键不是叫法，是别让 SQL 散进 Controller 和 Service。

接口那一层用的是另外两个词：**DTO** 是请求形状（`CreateBookingDto`，第 20 章用 `ValidationPipe` 校验），**VO** 是给页面裁剪过的展示形状（只留 id、name、capacity）。example 项目里 `src/modules/bookings/bookings.service.ts` 放业务规则，`src/modules/bookings/dto/create-booking.dto.ts` 放接口形状。

等第 45 章接入 Prisma，这些 SQL 会被 `db.orm.public.Room` 取代，但「Service 不关心 SQL」这条边界仍然保留——分层不是文件数量，是依赖方向。

## 类型选错，后面全是补丁

| 你要存 | 用 | 别用 | 原因 |
| --- | --- | --- | --- |
| 主键 | `uuid` 或 `bigint GENERATED ALWAYS AS IDENTITY` | 无符号自增 `int` | PG 没有 `unsigned`；`uuid` 不泄露规模 |
| 时间点 | `timestamptz` | `timestamp` | 后者不存时区，跨时区必错 |
| 金额 | `numeric(8,2)` | `real` / `double precision` | 二进制浮点存不下 0.1 |
| 是 / 否 | `boolean` | `char(1)` / `tinyint` | 可读，且能直接 `WHERE has_window` |
| 固定枚举 | `text` + `CHECK`，或 `CREATE TYPE ... AS ENUM` | 魔法数字 | 约束在库里，ORM 改不坏 |
| 标签 | `text[]` | 逗号串 | `@>`、`&&` 可走 GIN 索引 |
| 半结构化 | `jsonb` | `json` | 可索引、键去重，查询函数齐全 |
| 时间区间 | `tstzrange` | 两列 + 手工比较 | `&&` 一行判重叠，可配 GiST |

`numeric` 和浮点的差别值得单独说一句：`double precision` 是二进制浮点，`0.1` 在二进制里是无限循环小数，只能近似；`numeric` 按十进制数字存，`sum(25.00 * 18)` 得 `450.00`，一分不差。金额、单价、税率一律 `numeric`，别用 `float` 再在应用层四舍五入——误差会累积到对账那天。

从 MySQL 迁过来，几个写法要换：`AUTO_INCREMENT` → `GENERATED ALWAYS AS IDENTITY`；`DATETIME` → `timestamptz`；`TINYINT(1)` → `boolean`；反引号 → 双引号（且只有需要保留大小写时才加）；`LIMIT 10, 20` → `LIMIT 20 OFFSET 10`。

## 几个会咬人的地方

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `port is already allocated` | 本机已有 PG 或旧容器占着 5432 | 映射成 `-p 5433:5432`，连接串同步改 |
| 删了容器，数据没了 | 没挂卷，或挂了匿名卷 | 用命名卷 `pg17-data`，备份用 `pg_dump` |
| 密码对，仍 `password authentication failed` | 密码里有特殊字符没转义 | percent-encode，或改用 `.pgpass` |
| `relation "Users" does not exist` | 建表时加了双引号，保留了大小写 | 统一小写；必须保留时，查询也得带引号 |
| 时间总差 8 小时 | 列是 `timestamp`，或会话时区不对 | 列改 `timestamptz`，`SET TIME ZONE` 后重连 |
| 新表应用没权限 | 只对旧表 `GRANT` 过 | 补 `ALTER DEFAULT PRIVILEGES` |
| `docker exec` 进不去 psql | 脚本里用了 `-it`，没有 TTY | 非交互用 `docker exec -i pg17 psql ... -c` |

最后一条在 CI 里特别常见：`-it` 会报 `the input device is not a TTY`，换成 `-i` 或直接 `psql -c "..."` 就好。这类错误不影响数据，但会让流水线在第一步就红，排查时先看环境有没有 TTY，别去怀疑密码。

库跑起来了，三张表带着约束，连接串也能通，你现在知道表、行、主键、外键、约束、索引分别在哪一层起作用。下一章把运营每天问的那几个问题——「今天还剩哪间房」「谁订得最多」「哪间最闲」——逐个写成查询，顺便看清同一条需求为什么能写出三种结果不同的 SQL。


<!-- chapter-nav:start -->
---

← 上一篇：[034 为什么Node应用要用PM2来跑](../part-02/034-为什么Node应用要用PM2来跑.md) · [本 Part 目录](_part.md) · 下一篇：[036 SQL查询语句的所有语法和函数PostgreSQL版](036-SQL查询语句的所有语法和函数PostgreSQL版.md) →
<!-- chapter-nav:end -->
