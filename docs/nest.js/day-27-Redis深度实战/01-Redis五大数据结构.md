# Redis 五大结构回顾

## 前端类比

```
Redis 数据结构    →  前端类比
─────────────────  ──────────────────
String            →  localStorage 的一个 key
List              →  Array（push/pop/shift/unshift）
Set               →  new Set()（唯一集合 + 交并差）
Sorted Set (ZSet) →  带权重的排名数组（按 score 排序）
Hash              →  Map / Object（字段-值对）
```

## String——缓存与计数

```bash
# 基础操作
SET book:1:title "NestJS 实战"
GET book:1:title                    # "NestJS 实战"

# 过期时间
SETEX session:abc123 3600 "userId=1" # 设置 1 小时过期

# 原子增减
INCR book:1:view_count              # 阅读量 +1
INCRBY book:1:view_count 10         # 阅读量 +10
DECR book:1:stock                   # 库存 -1
```

```typescript
// Nest 中的应用
await this.redis.set(`book:${id}:detail`, JSON.stringify(book), 'EX', 3600);
const cached = await this.redis.get(`book:${id}:detail`);

// 原子递增
await this.redis.incr(`book:${id}:viewCount`);
```

## List——消息队列

```bash
LPUSH notifications:1 "您借的书还有3天到期"
LPUSH notifications:1 "新书上架：《三体2》"
LRANGE notifications:1 0 9          # 最近 10 条通知
LLEN notifications:1                # 通知总数
LPOP notifications:1                # 弹出最早的一条
```

```typescript
// 用户通知队列
await this.redis.lpush(`notifications:${userId}`, JSON.stringify(notification));
await this.redis.ltrim(`notifications:${userId}`, 0, 99); // 只保留最近 100 条
```

## Set——标签、去重

```bash
SADD book:1:tags "NestJS" "TypeScript" "后端"
SMEMBERS book:1:tags                # 所有标签
SISMEMBER book:1:tags "NestJS"      # 是否包含
SINTER book:1:tags book:2:tags      # 两本书的交集标签

# 统计
SCARD book:1:tags                   # 标签个数
```

```typescript
// 今日访问用户集合
await this.redis.sadd('visitors:today', userId.toString());
const todayVisitors = await this.redis.scard('visitors:today');
```

## Sorted Set (ZSet)——排行榜

```bash
# 借阅排行榜
ZADD hot:weekly 15 "book:1"   # book:1 本周被借 15 次
ZADD hot:weekly 23 "book:2"   # book:2 本周被借 23 次
ZADD hot:weekly 8  "book:3"

# 查询
ZREVRANGE hot:weekly 0 9 WITHSCORES  # Top 10（从高到低）
ZRANK hot:weekly "book:1"            # book:1 的排名
ZSCORE hot:weekly "book:1"           # book:1 的分数
```

```typescript
// 借阅排行榜
await this.redis.zincrby('borrow:leaderboard', 1, `book:${bookId}`);

// 查询 Top 10
const top10 = await this.redis.zrevrange('borrow:leaderboard', 0, 9, 'WITHSCORES');
```

## Hash——对象存储

```bash
HSET user:1 username "alice" role "USER" borrowCount "5"
HGET user:1 username               # "alice"
HGETALL user:1                     # 全部字段
HINCRBY user:1 borrowCount 1       # borrowCount +1
```

```typescript
// 用户信息缓存
await this.redis.hset(`user:${userId}`, {
  username: user.username,
  nickname: user.nickname || '',
  role: user.role,
  borrowCount: String(user.borrowCount),
});

const username = await this.redis.hget(`user:${userId}`, 'username');
```

## 数据结构速查总结

```
需要缓存数据选：String（JSON 序列化整个对象）
需要排名、分数选：Sorted Set
需要唯一集合选：Set（去重、交集、并集）
需要队列、时间线选：List
需要字段操作选：Hash（单独更新某个字段，不用整体序列化）
```

---

## 参考链接

- [Redis — Data Types](https://redis.io/docs/data-types/)
- [ioredis — API](https://github.com/redis/ioredis)
