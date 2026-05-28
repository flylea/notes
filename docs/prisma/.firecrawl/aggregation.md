ORM

Latest

Introduction

[Prisma ORM](https://www.prisma.io/docs/orm)

Core Concepts

[Data modeling](https://www.prisma.io/docs/orm/core-concepts/data-modeling)

Supported databases

[API patterns](https://www.prisma.io/docs/orm/core-concepts/api-patterns)

Prisma Schema

Overview

Data Model

[What is introspection?](https://www.prisma.io/docs/orm/prisma-schema/introspection) [PostgreSQL extensions](https://www.prisma.io/docs/orm/prisma-schema/postgresql-extensions)

Prisma Client

[Prisma Client](https://www.prisma.io/docs/orm/prisma-client)

Setup and Configuration

Queries

Client Extensions

Deployment

Observability and Logging

Debugging and Troubleshooting

Special Fields and Types

Testing

Type Safety

Using Raw SQL

Prisma Migrate

[Overview of Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate) [Getting started with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate/getting-started) [Understanding Migrations](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/mental-model) [Migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories) [About the shadow database](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database) [Limitations and known issues](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/limitations-and-known-issues)

Workflows

Reference

[Prisma CLI reference](https://www.prisma.io/docs/orm/reference/prisma-cli-reference) [Prisma Client API](https://www.prisma.io/docs/orm/reference/prisma-client-reference) [Schema API](https://www.prisma.io/docs/orm/reference/prisma-schema-reference) [Config API](https://www.prisma.io/docs/orm/reference/prisma-config-reference) [Connection URLs](https://www.prisma.io/docs/orm/reference/connection-urls) [Environment Variables](https://www.prisma.io/docs/orm/reference/environment-variables-reference) [Database Features](https://www.prisma.io/docs/orm/reference/database-features) [Supported databases](https://www.prisma.io/docs/orm/reference/supported-databases) [System requirements](https://www.prisma.io/docs/orm/reference/system-requirements) [Error Reference](https://www.prisma.io/docs/orm/reference/error-reference) [Prisma Error Reference](https://www.prisma.io/docs/orm/reference/errors) [Prisma Client & Prisma schema](https://www.prisma.io/docs/orm/reference/preview-features/client-preview-features) [Prisma CLI Preview features](https://www.prisma.io/docs/orm/reference/preview-features/cli-preview-features)

More

[Best practices](https://www.prisma.io/docs/orm/more/best-practices) [ORM releases and maturity levels](https://www.prisma.io/docs/orm/more/releases)

Comparisons

Dev environment

Troubleshooting

The Next Evolution of Prisma ORMNew

Prisma Next: a full TypeScript rewrite with a new query API, SQL builder, and extensible architecture.

![The Next Evolution of Prisma ORM](https://www.prisma.io/docs/imgs/sidebar-banners/prisma-next.png)

[Read more](https://pris.ly/pn-anouncement) Dismiss

[All Systems Operational](https://www.prisma-status.com/)

[![Prisma](https://www.prisma.io/docs-static/_next/static/media/logo-dark.f61d6884.svg?dpl=dpl_BUqV1f214T6CBouV64SN4ErWjaws)![Prisma](https://www.prisma.io/docs-static/_next/static/media/logo-white.02012a6c.svg?dpl=dpl_BUqV1f214T6CBouV64SN4ErWjaws)](https://www.prisma.io/)/ [docs](https://www.prisma.io/docs)

Search
`⌘`  `K`

Ask AI
`Ctrl`  `I`

Ask AI

[GitHub](https://pris.ly/github?utm_source=docs&utm_medium=navbar)[Join Discord](https://pris.ly/discord?utm_source=docs&utm_medium=navbar)[Login](https://console.prisma.io/login?utm_source=docs&utm_medium=login)

[Getting Started](https://www.prisma.io/docs) [ORM](https://www.prisma.io/docs/orm) [Postgres](https://www.prisma.io/docs/postgres) [CLI](https://www.prisma.io/docs/cli) [Guides](https://www.prisma.io/docs/guides) More

Aggregation, grouping, and summarizingAggregate

Queries

# Aggregation, grouping, and summarizing

Copy MarkdownOpen

Use Prisma Client to aggregate, group by, count, and select distinct.

Prisma Client allows you to count records, aggregate number fields, and select distinct field values.

## [Aggregate](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#aggregate)

Prisma Client allows you to [`aggregate`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#aggregate) on the **number** fields (such as `Int` and `Float`) of a model. The following query returns the average age of all users:

```
const aggregations = await prisma.user.aggregate({
  _avg: { age: true },
});

console.log('Average age:' + aggregations._avg.age);
```

You can combine aggregation with filtering and ordering. For example, the following query returns the average age of users:

- Ordered by `age` ascending
- Where `email` contains `prisma.io`
- Limited to the 10 users

```
const aggregations = await prisma.user.aggregate({
  _avg: { age: true },
  where: {
    email: {
      contains: 'prisma.io',
    },
  },
  orderBy: { age: 'asc' },
  take: 10,
});

console.log('Average age:' + aggregations._avg.age);
```

### [Aggregate values are nullable](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#aggregate-values-are-nullable)

Aggregations on **nullable fields** can return a `number` or `null`. This excludes `count`, which always returns 0 if no records are found.

Consider the following query, where `age` is nullable in the schema:

```
const aggregations = await prisma.user.aggregate({
  _avg: { age: true },
  _count: { age: true },
});
```

```
{
  "_avg": { "age": null },
  "_count": { "age": 9 }
}
```

The query returns `{ _avg: { age: null } }` in either of the following scenarios:

- There are no users
- The value of every user's `age` field is `null`

This allows you to differentiate between the true aggregate value (which could be zero) and no data.

## [Group by](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#group-by)

Prisma Client's [`groupBy()`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#groupby) allows you to **group records** by one or more field values - such as `country`, or `country` and `city` and **perform aggregations** on each group, such as finding the average age of people living in a particular city.

The following example groups all users by the `country` field and returns the total number of profile views for each country:

```
const groupUsers = await prisma.user.groupBy({
  by: ['country'],
  _sum: { profileViews: true },
});
```

```
[\
  { country: 'Germany', _sum: { profileViews: 126 } },\
  { country: 'Sweden', _sum: { profileViews: 0 } },\
];
```

If you have a single element in the `by` option, you can use the following shorthand syntax to express your query:

```
const groupUsers = await prisma.user.groupBy({
  by: 'country',
});
```

### [`groupBy()` and filtering](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#groupby-and-filtering)

`groupBy()` supports two levels of filtering: `where` and `having`.

#### [Filter records with `where`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#filter-records-with-where)

Use `where` to filter all records **before grouping**. The following example groups users by country and sums profile views, but only includes users where the email address contains `prisma.io`:

```
const groupUsers = await prisma.user.groupBy({
  by: ['country'],
  where: {
    email: {
      contains: 'prisma.io',
    },
  },
  _sum: {
    profileViews: true,
  },
});
```

#### [Filter groups with `having`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#filter-groups-with-having)

Use `having` to filter **entire groups** by an aggregate value such as the sum or average of a field, not individual records - for example, only return groups where the _average_`profileViews` is greater than 100:

```
const groupUsers = await prisma.user.groupBy({
  by: ['country'],
  where: {
    email: {
      contains: 'prisma.io',
    },
  },
  _sum: { profileViews: true, },
  having: {
    profileViews: {
      _avg: {
        gt: 100,
      },
    },
  },
});
```

##### [Use case for `having`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#use-case-for-having)

The primary use case for `having` is to filter on aggregations. We recommend that you use `where` to reduce the size of your data set as far as possible _before_ grouping, because doing so ✔ reduces the number of records the database has to return and ✔ makes use of indices.

For example, the following query groups all users that are _not_ from Sweden or Ghana:

```
const fd = await prisma.user.groupBy({
  by: ['country'],
  where: {
    country: {
      notIn: ['Sweden', 'Ghana'],
    },
  },
  _sum: {
    profileViews: true,
  },
  having: {
    profileViews: {
      _min: {
        gte: 10,
      },
    },
  },
});
```

The following query technically achieves the same result, but excludes users from Ghana _after_ grouping. This does not confer any benefit and is not recommended practice.

```
const groupUsers = await prisma.user.groupBy({
  by: ['country'],
  where: {
    country: {
      not: 'Sweden',
    },
  },
  _sum: {
    profileViews: true,
  },
  having: {
    country: {
      not: 'Ghana',
    },
    profileViews: {
      _min: {
        gte: 10,
      },
    },
  },
});
```

> **Note**: Within `having`, you can only filter on aggregate values _or_ fields available in `by`.

### [`groupBy()` and ordering](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#groupby-and-ordering)

The following constraints apply when you combine `groupBy()` and `orderBy`:

- You can `orderBy` fields that are present in `by`
- You can `orderBy` aggregate (Preview in 2.21.0 and later)
- If you use `skip` and/or `take` with `groupBy()`, you must also include `orderBy` in the query

#### [Order by aggregate group](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#order-by-aggregate-group)

You can **order by aggregate group**. The following example sorts each `city` group by the number of users in that group (largest group first):

```
const groupBy = await prisma.user.groupBy({
  by: ['city'],
  _count: {
    city: true,
  },
  orderBy: {
    _count: {
      city: 'desc',
    },
  },
});
```

```
[\
  { city: 'Berlin', count: { city: 3 } },\
  { city: 'Paris', count: { city: 2 } },\
  { city: 'Amsterdam', count: { city: 1 } },\
];
```

#### [Order by field](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#order-by-field)

The following query orders groups by country, skips the first two groups, and returns the 3rd and 4th group:

```
const groupBy = await prisma.user.groupBy({
  by: ['country'],
  _sum: {
    profileViews: true,
  },
  orderBy: {
    country: 'desc',
  },
  skip: 2,
  take: 2,
});
```

### [`groupBy()` FAQ](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#groupby-faq)

#### [Can I use `select` with `groupBy()`?](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#can-i-use-select-with-groupby)

You cannot use `select` with `groupBy()`. However, all fields included in `by` are automatically returned.

#### [What is the difference between using `where` and `having` with `groupBy()`?](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#what-is-the-difference-between-using-where-and-having-with-groupby)

`where` filters all records before grouping, and `having` filters entire groups and supports filtering on an aggregate field value, such as the average or sum of a particular field in that group.

#### [What is the difference between `groupBy()` and `distinct`?](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#what-is-the-difference-between-groupby-and-distinct)

Both `distinct` and `groupBy()` group records by one or more unique field values. `groupBy()` allows you to aggregate data within each group - for example, return the average number of views on posts from Denmark - whereas distinct does not.

## [Count](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#count)

### [Count records](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#count-records)

Use [`count()`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#count) to count the number of records or non-`null` field values. The following example query counts all users:

```
const userCount = await prisma.user.count();
```

### [Count relations](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#count-relations)

To return a count of relations (for example, a user's post count), use the `_count` parameter with a nested `select` as shown:

```
const usersWithCount = await prisma.user.findMany({
  include: {
    _count: {
      select: { posts: true },
    },
  },
});
```

```
{ id: 1, _count: { posts: 3 } },
{ id: 2, _count: { posts: 2 } },
{ id: 3, _count: { posts: 2 } },
{ id: 4, _count: { posts: 0 } },
{ id: 5, _count: { posts: 0 } }
```

The `_count` parameter:

- Can be used inside a top-level `include` _or_`select`
- Can be used with any query that returns records (including `delete`, `update`, and `findFirst`)
- Can return [multiple relation counts](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#return-multiple-relation-counts)
- Can [filter relation counts](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#filter-the-relation-count) (from version 4.3.0)

#### [Return a relations count with `include`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#return-a-relations-count-with-include)

The following query includes each user's post count in the results:

```
const usersWithCount = await prisma.user.findMany({
  include: {
    _count: {
      select: { posts: true },
    },
  },
});
```

```
{ id: 1, _count: { posts: 3 } },
{ id: 2, _count: { posts: 2 } },
{ id: 3, _count: { posts: 2 } },
{ id: 4, _count: { posts: 0 } },
{ id: 5, _count: { posts: 0 } }
```

#### [Return a relations count with `select`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#return-a-relations-count-with-select)

The following query uses `select` to return each user's post count _and no other fields_:

```
const usersWithCount = await prisma.user.findMany({
  select: {
    _count: {
      select: { posts: true },
    },
  },
});
```

```
{
  _count: {
    posts: 3;
  }
}
```

#### [Return multiple relation counts](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#return-multiple-relation-counts)

The following query returns a count of each user's `posts` and `recipes` and no other fields:

```
const usersWithCount = await prisma.user.findMany({
  select: {
    _count: {
      select: {
        posts: true,
        recipes: true,
      },
    },
  },
});
```

```
{
  "_count": {
    "posts": 3,
    "recipes": 9
  }
}
```

#### [Filter the relation count](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#filter-the-relation-count)

Use `where` to filter the fields returned by the `_count` output type. You can do this on [scalar fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#scalar-fields) and [relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#relation-fields).

For example, the following query returns all user posts with the title "Hello!":

```
// Count all user posts with the title "Hello!"
await prisma.user.findMany({
  select: {
    _count: {
      select: {
        posts: { where: { title: 'Hello!' } },
      },
    },
  },
});
```

The following query finds all user posts with comments from an author named "Alice":

```
// Count all user posts that have comments
// whose author is named "Alice"
await prisma.user.findMany({
  select: {
    _count: {
      select: {
        posts: {
          where: { comments: { some: { author: { is: { name: 'Alice' } } } } },
        },
      },
    },
  },
});
```

### [Count non-`null` field values](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#count-non-null-field-values)

In [2.15.0](https://github.com/prisma/prisma/releases/2.15.0) and later, you can count all records as well as all instances of non-`null` field values. The following query returns a count of:

- All `User` records (`_all`)
- All non-`null``name` values (not distinct values, just values that are not `null`)

```
const userCount = await prisma.user.count({
  select: {
    _all: true, // Count all records
    name: true, // Count all non-null field values
  },
});
```

```
{ "_all": 30, "name": 10 }
```

### [Filtered count](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#filtered-count)

`count` supports filtering. The following example query counts all users with more than 100 profile views:

```
const userCount = await prisma.user.count({
  where: {
    profileViews: {
      gte: 100,
    },
  },
});
```

The following example query counts a particular user's posts:

```
const postCount = await prisma.post.count({
  where: {
    authorId: 29,
  },
});
```

## [Select distinct](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#select-distinct)

Prisma Client allows you to filter duplicate rows from a Prisma Query response to a [`findMany`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#findmany) query using [`distinct`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#distinct) . `distinct` is often used in combination with [`select`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#select) to identify certain unique combinations of values in the rows of your table.

The following example returns all fields for all `User` records with distinct `name` field values:

```
const result = await prisma.user.findMany({
  where: {},
  distinct: ['name'],
});
```

The following example returns distinct `role` field values (for example, `ADMIN` and `USER`):

```
const distinctRoles = await prisma.user.findMany({
  distinct: ['role'],
  select: {
    role: true,
  },
});
```

```
[\
  { role: 'USER', },\
  { role: 'ADMIN', },\
];
```

### [`distinct` under the hood](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing\#distinct-under-the-hood)

Prisma Client's `distinct` option does not use SQL `SELECT DISTINCT`. Instead, `distinct` uses:

- A `SELECT` query
- In-memory post-processing to select distinct

It was designed in this way in order to **support `select` and `include`** as part of `distinct` queries.

The following example selects distinct on `gameId` and `playerId`, ordered by `score`, in order to return **each player's highest score per game**. The query uses `include` and `select` to include additional data:

- Select `score` (field on `Play`)
- Select related player name (relation between `Play` and `User`)
- Select related game name (relation between `Play` and `Game`)

Expand for sample schema

schema.prisma

```
model User {
  id   Int     @id @default(autoincrement())
  name String?
  play Play[]
}

model Game {
  id   Int     @id @default(autoincrement())
  name String?
  play Play[]
}

model Play {
  id       Int   @id @default(autoincrement())
  score    Int?  @default(0)
  playerId Int?
  player   User? @relation(fields: [playerId], references: [id])
  gameId   Int?
  game     Game? @relation(fields: [gameId], references: [id])
}
```

```
const distinctScores = await prisma.play.findMany({
  distinct: ['playerId', 'gameId'],
  orderBy: {
    score: 'desc',
  },
  select: {
    score: true,
    game: {
      select: {
        name: true,
      },
    },
    player: {
      select: {
        name: true,
      },
    },
  },
});
```

```
[\
  {\
    "score": 900,\
    "game": { "name": "Pacman" },\
    "player": { "name": "Bert Bobberton" }\
  },\
  {\
    "score": 400,\
    "game": { "name": "Pacman" },\
    "player": { "name": "Nellie Bobberton" }\
  }\
]
```

Without `select` and `distinct`, the query would return:

```
[\
  {\
    "gameId": 2,\
    "playerId": 5\
  },\
  {\
    "gameId": 2,\
    "playerId": 10\
  }\
]
```

[Edit on GitHub](https://github.com/prisma/docs/edit/main/apps/docs/content/docs/orm/prisma-client/queries/aggregation-grouping-summarizing.mdx)

[Pagination\\
\\
Learn how to paginate Prisma Client query results with offset pagination and cursor-based pagination.](https://www.prisma.io/docs/orm/prisma-client/queries/pagination) [Transactions and batch queries\\
\\
This page explains the transactions API of Prisma Client](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)

### On this page

[Aggregate](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#aggregate) [Aggregate values are nullable](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#aggregate-values-are-nullable) [Group by](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#group-by) [`groupBy()` and filtering](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#groupby-and-filtering) [Filter records with `where`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#filter-records-with-where) [Filter groups with `having`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#filter-groups-with-having) [Use case for `having`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#use-case-for-having) [`groupBy()` and ordering](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#groupby-and-ordering) [Order by aggregate group](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#order-by-aggregate-group) [Order by field](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#order-by-field) [`groupBy()` FAQ](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#groupby-faq) [Can I use `select` with `groupBy()`?](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#can-i-use-select-with-groupby) [What is the difference between using `where` and `having` with `groupBy()`?](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#what-is-the-difference-between-using-where-and-having-with-groupby) [What is the difference between `groupBy()` and `distinct`?](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#what-is-the-difference-between-groupby-and-distinct) [Count](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#count) [Count records](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#count-records) [Count relations](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#count-relations) [Return a relations count with `include`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#return-a-relations-count-with-include) [Return a relations count with `select`](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#return-a-relations-count-with-select) [Return multiple relation counts](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#return-multiple-relation-counts) [Filter the relation count](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#filter-the-relation-count) [Count non-`null` field values](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#count-non-null-field-values) [Filtered count](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#filtered-count) [Select distinct](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#select-distinct) [`distinct` under the hood](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#distinct-under-the-hood)

## Chat

### How can I help?

Ask me anything about Prisma

How do I migrate from Prisma ORM v6 to v7?How do I use Prisma with Next.js?How do I deploy Prisma to Railway?

Press `⌘`  `I` to toggle

Enable deep thinking

Send message

Powered by [kapa.ai](https://kapa.ai/)

reCAPTCHA

Recaptcha requires verification.

protected by **reCAPTCHA**