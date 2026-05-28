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

CRUDCreate

Queries

# CRUD

Copy MarkdownOpen

Learn how to perform create, read, update, and delete operations

This page describes how to perform CRUD operations with Prisma Client:

- [Create](https://www.prisma.io/docs/orm/prisma-client/queries/crud#create) \- Insert records
- [Read](https://www.prisma.io/docs/orm/prisma-client/queries/crud#read) \- Query records
- [Update](https://www.prisma.io/docs/orm/prisma-client/queries/crud#update) \- Modify records
- [Delete](https://www.prisma.io/docs/orm/prisma-client/queries/crud#delete) \- Remove records

See the [Prisma Client API reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference) for detailed method documentation.

## [Create](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#create)

### [Create a single record](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#create-a-single-record)

```
const user = await prisma.user.create({
  data: {
    email: "elsa@prisma.io",
    name: "Elsa Prisma",
  },
});
```

## [Where to go next](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#where-to-go-next)

- [Prisma Client API reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference) if you need the full method and option surface
- [Relation queries](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries) if your CRUD workflow needs nested writes or relational reads
- [Prisma Migrate getting started](https://www.prisma.io/docs/orm/prisma-migrate/getting-started) if you're still evolving the database schema behind these queries
- [Quickstart with Prisma Postgres](https://www.prisma.io/docs/prisma-orm/quickstart/prisma-postgres) if you want a managed database to try these examples against quickly

The `id` is auto-generated. Your schema determines which fields are mandatory.

### [Create multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#create-multiple-records)

```
const createMany = await prisma.user.createMany({
  data: [\
    { name: "Bob", email: "bob@prisma.io" },\
    { name: "Yewande", email: "yewande@prisma.io" },\
  ],
  skipDuplicates: true, // Skip records with duplicate unique fields
});
// Returns: { count: 2 }
```

`skipDuplicates` is not supported on MongoDB, SQLServer, or SQLite.

### [Create and return multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#create-and-return-multiple-records)

Supported by PostgreSQL, CockroachDB, and SQLite.

```
const users = await prisma.user.createManyAndReturn({
  data: [\
    { name: "Alice", email: "alice@prisma.io" },\
    { name: "Bob", email: "bob@prisma.io" },\
  ],
});
```

See [Nested writes](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-writes) for creating records with relations.

## [Read](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#read)

### [Get record by ID or unique field](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#get-record-by-id-or-unique-field)

```
// By unique field
const user = await prisma.user.findUnique({
  where: { email: "elsa@prisma.io" },
});

// By ID
const user = await prisma.user.findUnique({
  where: { id: 99 },
});
```

### [Get all records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#get-all-records)

```
const users = await prisma.user.findMany();
```

### [Get first matching record](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#get-first-matching-record)

```
const user = await prisma.user.findFirst({
  where: { posts: { some: { likes: { gt: 100 } } } },
  orderBy: { id: "desc" },
});
```

### [Filter records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#filter-records)

```
// Single field filter
const users = await prisma.user.findMany({
  where: { email: { endsWith: "prisma.io" } },
});

// Multiple conditions with OR/AND
const users = await prisma.user.findMany({
  where: {
    OR: [{ name: { startsWith: "E" } }, { AND: { profileViews: { gt: 0 }, role: "ADMIN" } }],
  },
});

// Filter by related records
const users = await prisma.user.findMany({
  where: {
    email: { endsWith: "prisma.io" },
    posts: { some: { published: false } },
  },
});
```

See [Filtering and sorting](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting) for more examples.

### [Select fields](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#select-fields)

```
const user = await prisma.user.findUnique({
  where: { email: "emma@prisma.io" },
  select: { email: true, name: true },
});
// Returns: { email: 'emma@prisma.io', name: "Emma" }
```

### [Include related records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#include-related-records)

```
const users = await prisma.user.findMany({
  where: { role: "ADMIN" },
  include: { posts: true },
});
```

See [Select fields](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields) and [Relation queries](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries) for more.

## [Update](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#update)

### [Update a single record](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#update-a-single-record)

```
const updateUser = await prisma.user.update({
  where: { email: "viola@prisma.io" },
  data: { name: "Viola the Magnificent" },
});
```

### [Update multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#update-multiple-records)

```
const updateUsers = await prisma.user.updateMany({
  where: { email: { contains: "prisma.io" } },
  data: { role: "ADMIN" },
});
// Returns: { count: 19 }
```

### [Update and return multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#update-and-return-multiple-records)

Supported by PostgreSQL, CockroachDB, and SQLite.

```
const users = await prisma.user.updateManyAndReturn({
  where: { email: { contains: "prisma.io" } },
  data: { role: "ADMIN" },
});
```

### [Upsert (update or create)](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#upsert-update-or-create)

```
const upsertUser = await prisma.user.upsert({
  where: { email: "viola@prisma.io" },
  update: { name: "Viola the Magnificent" },
  create: { email: "viola@prisma.io", name: "Viola the Magnificent" },
});
```

To emulate `findOrCreate()`, use `upsert()` with an empty `update` parameter.

### [Atomic number operations](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#atomic-number-operations)

```
await prisma.post.updateMany({
  data: {
    views: { increment: 1 },
    likes: { increment: 1 },
  },
});
```

See [Relation queries](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries) for connecting and disconnecting related records.

## [Delete](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#delete)

### [Delete a single record](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#delete-a-single-record)

The following query uses [`delete()`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#delete) to delete a single `User` record:

```
const deleteUser = await prisma.user.delete({
  where: {
    email: "bert@prisma.io",
  },
});
```

Attempting to delete a user with one or more posts result in an error, as every `Post` requires an author - see [cascading deletes](https://www.prisma.io/docs/orm/prisma-client/queries/crud#cascading-deletes-deleting-related-records).

### [Delete multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#delete-multiple-records)

The following query uses [`deleteMany()`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#deletemany) to delete all `User` records where `email` contains `prisma.io`:

```
const deleteUsers = await prisma.user.deleteMany({
  where: {
    email: {
      contains: "prisma.io",
    },
  },
});
```

Attempting to delete a user with one or more posts result in an error, as every `Post` requires an author - see [cascading deletes](https://www.prisma.io/docs/orm/prisma-client/queries/crud#cascading-deletes-deleting-related-records).

### [Delete all records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#delete-all-records)

The following query uses [`deleteMany()`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#deletemany) to delete all `User` records:

```
const deleteUsers = await prisma.user.deleteMany({});
```

Be aware that this query will fail if the user has any related records (such as posts). In this case, you need to [delete the related records first](https://www.prisma.io/docs/orm/prisma-client/queries/crud#cascading-deletes-deleting-related-records).

### [Cascading deletes (deleting related records)](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#cascading-deletes-deleting-related-records)

You can configure cascading deletes using [referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions).

The following query uses [`delete()`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#delete) to delete a single `User` record:

```
const deleteUser = await prisma.user.delete({
  where: {
    email: "bert@prisma.io",
  },
});
```

However, the example schema includes a **required relation** between `Post` and `User`, which means that you cannot delete a user with posts:

```
The change you are trying to make would violate the required relation 'PostToUser' between the `Post` and `User` models.
```

To resolve this error, you can:

- Make the relation optional:








```
model Post {
    id       Int   @id @default(autoincrement())
    author   User? @relation(fields: [authorId], references: [id])
    authorId Int?
    author   User  @relation(fields: [authorId], references: [id])
    authorId Int
}
```

- Change the author of the posts to another user before deleting the user.

- Delete a user and all their posts with two separate queries in a transaction (all queries must succeed):








```
const deletePosts = prisma.post.deleteMany({
    where: {
      authorId: 7,
    },
});

const deleteUser = prisma.user.delete({
    where: {
      id: 7,
    },
});

const transaction = await prisma.$transaction([deletePosts, deleteUser]);
```


### [Delete all records from all tables](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#delete-all-records-from-all-tables)

Sometimes you want to remove all data from all tables but keep the actual tables. This can be particularly useful in a development environment and whilst testing.

The following shows how to delete all records from all tables with Prisma Client and with Prisma Migrate.

#### [Deleting all data with `deleteMany()`](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#deleting-all-data-with-deletemany)

When you know the order in which your tables should be deleted, you can use the [`deleteMany`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#deletemany) function. This is executed synchronously in a [`$transaction`](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) and can be used with all types of databases.

```
const deletePosts = prisma.post.deleteMany();
const deleteProfile = prisma.profile.deleteMany();
const deleteUsers = prisma.user.deleteMany();

// The transaction runs synchronously so deleteUsers must run last.
await prisma.$transaction([deleteProfile, deletePosts, deleteUsers]);
```

✅ **Pros**:

- Works well when you know the structure of your schema ahead of time
- Synchronously deletes each tables data

❌ **Cons**:

- When working with relational databases, this function doesn't scale as well as having a more generic solution which looks up and `TRUNCATE`s your tables regardless of their relational constraints. Note that this scaling issue does not apply when using the MongoDB connector.

> **Note**: The `$transaction` performs a cascading delete on each models table so they have to be called in order.

#### [Deleting all data with raw SQL / `TRUNCATE`](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#deleting-all-data-with-raw-sql--truncate)

If you are comfortable working with raw SQL, you can perform a `TRUNCATE` query on a table using [`$executeRawUnsafe`](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/raw-queries#executerawunsafe).

In the following examples, the first tab shows how to perform a `TRUNCATE` on a Postgres database by using a `$queryRaw` look up that maps over the table and `TRUNCATES` all tables in a single query.

The second tab shows performing the same function but with a MySQL database. In this instance the constraints must be removed before the `TRUNCATE` can be executed, before being reinstated once finished. The whole process is run as a `$transaction`

PostgreSQL

MySQL

```
const tablenames = await prisma.$queryRaw<
  Array<{ tablename: string }>
>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

const tables = tablenames
  .map(({ tablename }) => tablename)
  .filter((name) => name !== "_prisma_migrations")
  .map((name) => `"public"."${name}"`)
  .join(", ");

try {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
} catch (error) {
  console.log({ error });
}
```

✅ **Pros**:

- Scalable
- Very fast

❌ **Cons**:

- Can't undo the operation
- Using reserved SQL key words as tables names can cause issues when trying to run a raw query

#### [Deleting all records with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#deleting-all-records-with-prisma-migrate)

If you use Prisma Migrate, you can use `migrate reset`, this will:

1. Drop the database
2. Create a new database
3. Apply migrations
4. Seed the database with data

## [Advanced query examples](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#advanced-query-examples)

### [Create a deeply nested tree of records](https://www.prisma.io/docs/orm/prisma-client/queries/crud\#create-a-deeply-nested-tree-of-records)

- A single `User`
- Two new, related `Post` records
- Connect or create `Category` per post

```
const u = await prisma.user.create({
  include: {
    posts: {
      include: {
        categories: true,
      },
    },
  },
  data: {
    email: "emma@prisma.io",
    posts: {
      create: [\
        {\
          title: "My first post",\
          categories: {\
            connectOrCreate: [\
              {\
                create: { name: "Introductions" },\
                where: {\
                  name: "Introductions",\
                },\
              },\
              {\
                create: { name: "Social" },\
                where: {\
                  name: "Social",\
                },\
              },\
            ],\
          },\
        },\
        {\
          title: "How to make cookies",\
          categories: {\
            connectOrCreate: [\
              {\
                create: { name: "Social" },\
                where: {\
                  name: "Social",\
                },\
              },\
              {\
                create: { name: "Cooking" },\
                where: {\
                  name: "Cooking",\
                },\
              },\
            ],\
          },\
        },\
      ],
    },
  },
});
```

[Edit on GitHub](https://github.com/prisma/docs/edit/main/apps/docs/content/docs/orm/prisma-client/queries/crud.mdx)

[Configure Prisma Client with PgBouncer\\
\\
Configure Prisma Client with PgBouncer and other poolers: when to use pgbouncer=true, required transaction mode, prepared statements, and Prisma Migrate workarounds](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer) [Select fields\\
\\
Learn how to return only the fields and relations you need with select and include in Prisma Client.](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields)

### On this page

[Create](https://www.prisma.io/docs/orm/prisma-client/queries/crud#create) [Create a single record](https://www.prisma.io/docs/orm/prisma-client/queries/crud#create-a-single-record) [Where to go next](https://www.prisma.io/docs/orm/prisma-client/queries/crud#where-to-go-next) [Create multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#create-multiple-records) [Create and return multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#create-and-return-multiple-records) [Read](https://www.prisma.io/docs/orm/prisma-client/queries/crud#read) [Get record by ID or unique field](https://www.prisma.io/docs/orm/prisma-client/queries/crud#get-record-by-id-or-unique-field) [Get all records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#get-all-records) [Get first matching record](https://www.prisma.io/docs/orm/prisma-client/queries/crud#get-first-matching-record) [Filter records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#filter-records) [Select fields](https://www.prisma.io/docs/orm/prisma-client/queries/crud#select-fields) [Include related records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#include-related-records) [Update](https://www.prisma.io/docs/orm/prisma-client/queries/crud#update) [Update a single record](https://www.prisma.io/docs/orm/prisma-client/queries/crud#update-a-single-record) [Update multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#update-multiple-records) [Update and return multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#update-and-return-multiple-records) [Upsert (update or create)](https://www.prisma.io/docs/orm/prisma-client/queries/crud#upsert-update-or-create) [Atomic number operations](https://www.prisma.io/docs/orm/prisma-client/queries/crud#atomic-number-operations) [Delete](https://www.prisma.io/docs/orm/prisma-client/queries/crud#delete) [Delete a single record](https://www.prisma.io/docs/orm/prisma-client/queries/crud#delete-a-single-record) [Delete multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#delete-multiple-records) [Delete all records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#delete-all-records) [Cascading deletes (deleting related records)](https://www.prisma.io/docs/orm/prisma-client/queries/crud#cascading-deletes-deleting-related-records) [Delete all records from all tables](https://www.prisma.io/docs/orm/prisma-client/queries/crud#delete-all-records-from-all-tables) [Deleting all data with `deleteMany()`](https://www.prisma.io/docs/orm/prisma-client/queries/crud#deleting-all-data-with-deletemany) [Deleting all data with raw SQL / `TRUNCATE`](https://www.prisma.io/docs/orm/prisma-client/queries/crud#deleting-all-data-with-raw-sql--truncate) [Deleting all records with Prisma Migrate](https://www.prisma.io/docs/orm/prisma-client/queries/crud#deleting-all-records-with-prisma-migrate) [Advanced query examples](https://www.prisma.io/docs/orm/prisma-client/queries/crud#advanced-query-examples) [Create a deeply nested tree of records](https://www.prisma.io/docs/orm/prisma-client/queries/crud#create-a-deeply-nested-tree-of-records)

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