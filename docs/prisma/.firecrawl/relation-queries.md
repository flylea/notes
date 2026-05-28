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

Relation queriesNested reads

Queries

# Relation queries

Copy MarkdownOpen

Prisma Client provides convenient queries for working with relations, such as a fluent API, nested writes (transactions), nested reads and relation filters

A key feature of Prisma Client is the ability to query [relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations) between two or more models. Relation queries include:

- [Nested reads](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-reads) (sometimes referred to as _eager loading_) via [`select`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#select) and [`include`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#include)
- [Nested writes](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-writes) with [transactional](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) guarantees
- [Filtering on related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#relation-filters)

Prisma Client also has a [fluent API for traversing relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#fluent-api).

## [Nested reads](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#nested-reads)

Nested reads allow you to read related data from multiple tables in your database - such as a user and that user's posts. You can:

- Use [`include`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#include) to include related records, such as a user's posts or profile, in the query response.
- Use a nested [`select`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#select) to include specific fields from a related record. You can also nest `select` inside an `include`.

### [Relation load strategies (Preview)](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#relation-load-strategies-preview)

You can decide on a per-query-level _how_ you want Prisma Client to execute a relation query (i.e. what _load strategy_ should be applied) via the `relationLoadStrategy` option for PostgreSQL databases.

Because the `relationLoadStrategy` option is currently in Preview, you need to enable it via the `relationJoins` preview feature flag in your Prisma schema file:

schema.prisma

```
generator client {
  provider        = "prisma-client"
  output          = "./generated"
  previewFeatures = ["relationJoins"]
}
```

After adding this flag, you need to run `prisma generate` again to re-generate Prisma Client. The `relationJoins` feature is currently available on PostgreSQL, CockroachDB and MySQL.

Prisma Client supports two load strategies for relations:

- `join` (default): Uses a database-level `LATERAL JOIN` (PostgreSQL) or correlated subqueries (MySQL) and fetches all data with a single query to the database.
- `query`: Sends multiple queries to the database (one per table) and joins them on the application level.

Another important difference between these two options is that the `join` strategy uses JSON aggregation on the database level. That means that it creates the JSON structures returned by Prisma Client already in the database which saves computation resources on the application level.

#### [Examples](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#examples)

You can use the `relationLoadStrategy` option on the top-level in any query that supports `include` or `select`.

Here is an example with `include`:

```
const users = await prisma.user.findMany({
  relationLoadStrategy: "join", // or 'query'
  include: {
    posts: true,
  },
});
```

And here is another example with `select`:

```
const users = await prisma.user.findMany({
  relationLoadStrategy: "join", // or 'query'
  select: {
    posts: true,
  },
});
```

#### [When to use which load strategy?](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#when-to-use-which-load-strategy)

- The `join` strategy (default) will be more effective in most scenarios. On PostgreSQL, it uses a combination of `LATERAL JOINs` and JSON aggregation to reduce redundancy in result sets and delegate the work of transforming the query results into the expected JSON structures on the database server. On MySQL, it uses correlated subqueries to fetch the results with a single query.
- There may be edge cases where `query` could be more performant depending on the characteristics of the dataset and query. We recommend that you profile your database queries to identify these situations.
- Use `query` if you want to save resources on the database server and do heavy-lifting of merging and transforming data in the application server which might be easier to scale.

### [Include a relation](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#include-a-relation)

The following example returns a single user and that user's posts:

```
const user = await prisma.user.findFirst({
  include: {
    posts: true,
  },
});
```

```
{
  id: 19,
  name: null,
  email: 'emma@prisma.io',
  profileViews: 0,
  role: 'USER',
  coinflips: [],
  posts: [\
    {\
      id: 20,\
      title: 'My first post',\
      published: true,\
      authorId: 19,\
      comments: null,\
      views: 0,\
      likes: 0\
    },\
    {\
      id: 21,\
      title: 'How to make cookies',\
      published: true,\
      authorId: 19,\
      comments: null,\
      views: 0,\
      likes: 0\
    }\
  ]
}
```

### [Include all fields for a specific relation](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#include-all-fields-for-a-specific-relation)

The following example returns a post and its author:

```
const post = await prisma.post.findFirst({
  include: {
    author: true,
  },
});
```

```
{
  id: 17,
  title: 'How to make cookies',
  published: true,
  authorId: 16,
  comments: null,
  views: 0,
  likes: 0,
  author: {
    id: 16,
    name: null,
    email: 'orla@prisma.io',
    profileViews: 0,
    role: 'USER',
    coinflips: [],
  },
}
```

### [Include deeply nested relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#include-deeply-nested-relations)

You can nest `include` options to include relations of relations. The following example returns a user's posts, and each post's categories:

```
const user = await prisma.user.findFirst({
  include: {
    posts: {
      include: {
        categories: true,
      },
    },
  },
});
```

```
{
    "id": 40,
    "name": "Yvette",
    "email": "yvette@prisma.io",
    "profileViews": 0,
    "role": "USER",
    "coinflips": [],
    "testing": [],
    "city": null,
    "country": "Sweden",
    "posts": [\
        {\
            "id": 66,\
            "title": "How to make an omelette",\
            "published": true,\
            "authorId": 40,\
            "comments": null,\
            "views": 0,\
            "likes": 0,\
            "categories": [\
                {\
                    "id": 3,\
                    "name": "Easy cooking"\
                }\
            ]\
        },\
        {\
            "id": 67,\
            "title": "How to eat an omelette",\
            "published": true,\
            "authorId": 40,\
            "comments": null,\
            "views": 0,\
            "likes": 0,\
            "categories": []\
        }\
    ]
}
```

### [Select specific fields of included relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#select-specific-fields-of-included-relations)

You can use a nested `select` to choose a subset of fields of relations to return. For example, the following query returns the user's `name` and the `title` of each related post:

```
const user = await prisma.user.findFirst({
  select: {
    name: true,
    posts: {
      select: {
        title: true,
      },
    },
  },
});
```

```
{
  name: "Elsa",
  posts: [ { title: 'My first post' }, { title: 'How to make cookies' } ]
}
```

You can also nest a `select` inside an `include` \- the following example returns _all_`User` fields and the `title` field of each post:

```
const user = await prisma.user.findFirst({
  include: {
    posts: {
      select: {
        title: true,
      },
    },
  },
});
```

```
{
  "id": 1,
  "name": null,
  "email": "martina@prisma.io",
  "profileViews": 0,
  "role": "USER",
  "coinflips": [],
  "posts": [\
    { "title": "How to grow salad" },\
    { "title": "How to ride a horse" }\
  ]
}
```

Note that you **cannot** use `select` and `include` _on the same level_. This means that if you choose to `include` a user's post and `select` each post's title, you cannot `select` only the users' `email`:

```
// The following query returns an exception
const user = await prisma.user.findFirst({
  select: { // This won't work!
    email:  true
  }
  include: { // This won't work!
    posts: {
      select: {
        title: true
      }
    }
  },
})
```

```
Invalid `prisma.user.findUnique()` invocation:

{
  where: {
    id: 19
  },
  select: {
  ~~~~~~
    email: true
  },
  include: {
  ~~~~~~~
    posts: {
      select: {
        title: true
      }
    }
  }
}

Please either use `include` or `select`, but not both at the same time.
```

Instead, use nested `select` options:

```
const user = await prisma.user.findFirst({
  select: {
    // This will work!
    email: true,
    posts: {
      select: {
        title: true,
      },
    },
  },
});
```

## [Relation count](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#relation-count)

In [3.0.1](https://github.com/prisma/prisma/releases/3.0.1) and later, you can [`include` or `select` a count of relations](https://www.prisma.io/docs/orm/prisma-client/queries/aggregation-grouping-summarizing#count-relations) alongside fields - for example, a user's post count.

```
const relationCount = await prisma.user.findMany({
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

## [Filter a list of relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#filter-a-list-of-relations)

When you use `select` or `include` to return a subset of the related data, you can **filter and sort the list of relations** inside the `select` or `include`.

For example, the following query returns list of titles of the unpublished posts associated with the user:

```
const result = await prisma.user.findFirst({
  select: {
    posts: {
      where: {
        published: false,
      },
      orderBy: {
        title: "asc",
      },
      select: {
        title: true,
      },
    },
  },
});
```

You can also write the same query using `include` as follows:

```
const result = await prisma.user.findFirst({
  include: {
    posts: {
      where: {
        published: false,
      },
      orderBy: {
        title: "asc",
      },
    },
  },
});
```

## [Nested writes](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#nested-writes)

A nested write allows you to write **relational data** to your database in **a single transaction**.

Nested writes:

- Provide **transactional guarantees** for creating, updating or deleting data across multiple tables in a single Prisma Client query. If any part of the query fails (for example, creating a user succeeds but creating posts fails), Prisma Client rolls back all changes.
- Support any level of nesting supported by the data model.
- Are available for [relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#relation-fields) when using the model's create or update query. The following section shows the nested write options that are available per query.

### [Create a related record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#create-a-related-record)

You can create a record and one or more related records at the same time. The following query creates a `User` record and two related `Post` records:

```
const result = await prisma.user.create({
  data: {
    email: "elsa@prisma.io",
    name: "Elsa Prisma",
    posts: {
      create: [{ title: "How to make an omelette" }, { title: "How to eat an omelette" }],
    },
  },
  include: {
    posts: true, // Include all posts in the returned object
  },
});
```

```
{
  id: 29,
  name: 'Elsa',
  email: 'elsa@prisma.io',
  profileViews: 0,
  role: 'USER',
  coinflips: [],
  posts: [\
    {\
      id: 22,\
      title: 'How to make an omelette',\
      published: true,\
      authorId: 29,\
      comments: null,\
      views: 0,\
      likes: 0\
    },\
    {\
      id: 23,\
      title: 'How to eat an omelette',\
      published: true,\
      authorId: 29,\
      comments: null,\
      views: 0,\
      likes: 0\
    }\
  ]
}
```

### [Create a single record and multiple related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#create-a-single-record-and-multiple-related-records)

There are two ways to create or update a single record and multiple related records - for example, a user with multiple posts:

- Use a nested [`create`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#create) query
- Use a nested [`createMany`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#nested-createmany-options) query

In most cases, a nested `create` will be preferable unless the [`skipDuplicates` query option](https://www.prisma.io/docs/orm/reference/prisma-client-reference#nested-createmany-options) is required. Here's a quick table describing the differences between the two options:

| Feature | `create` | `createMany` | Notes |
| --- | --- | --- | --- |
| Supports nesting additional relations | ✔ | ✘ \* | For example, you can create a user, several posts, and several comments per post in one query.<br>\\* You can manually set a foreign key in a has-one relation - for example: `{ authorId: 9}` |
| Supports 1-n relations | ✔ | ✔ | For example, you can create a user and multiple posts (one user has many posts) |
| Supports m-n relations | ✔ | ✘ | For example, you can create a post and several categories (one post can have many categories, and one category can have many posts) |
| Supports skipping duplicate records | ✘ | ✔ | Use `skipDuplicates` query option. |

#### [Using nested `create`](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#using-nested-create)

The following query uses nested [`create`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#create) to create:

- One user
- Two posts
- One post category

The example also uses a nested `include` to include all posts and post categories in the returned data.

```
const result = await prisma.user.create({
  data: {
    email: "yvette@prisma.io",
    name: "Yvette",
    posts: {
      create: [\
        {\
          title: "How to make an omelette",\
          categories: {\
            create: {\
              name: "Easy cooking",\
            },\
          },\
        },\
        { title: "How to eat an omelette" },\
      ],
    },
  },
  include: {
    // Include posts
    posts: {
      include: {
        categories: true, // Include post categories
      },
    },
  },
});
```

```
{
    "id": 40,
    "name": "Yvette",
    "email": "yvette@prisma.io",
    "profileViews": 0,
    "role": "USER",
    "coinflips": [],
    "testing": [],
    "city": null,
    "country": "Sweden",
    "posts": [\
        {\
            "id": 66,\
            "title": "How to make an omelette",\
            "published": true,\
            "authorId": 40,\
            "comments": null,\
            "views": 0,\
            "likes": 0,\
            "categories": [\
                {\
                    "id": 3,\
                    "name": "Easy cooking"\
                }\
            ]\
        },\
        {\
            "id": 67,\
            "title": "How to eat an omelette",\
            "published": true,\
            "authorId": 40,\
            "comments": null,\
            "views": 0,\
            "likes": 0,\
            "categories": []\
        }\
    ]
}
```

Here's a visual representation of how a nested create operation can write to several tables in the database as once:

![Diagram showing how a nested create operation writes to multiple database tables (User, Post, Category) in a single transaction.](https://www.prisma.io/docs/_next/image?url=%2Fdocs%2Fimg%2Form%2Fnested-create.png&w=3840&q=75&dpl=dpl_BUqV1f214T6CBouV64SN4ErWjaws)

#### [Using nested `createMany`](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#using-nested-createmany)

The following query uses a nested [`createMany`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#createmany) to create:

- One user
- Two posts

The example also uses a nested `include` to include all posts in the returned data.

```
const result = await prisma.user.create({
  data: {
    email: "saanvi@prisma.io",
    posts: {
      createMany: {
        data: [{ title: "My first post" }, { title: "My second post" }],
      },
    },
  },
  include: {
    posts: true,
  },
});
```

```
{
    "id": 43,
    "name": null,
    "email": "saanvi@prisma.io",
    "profileViews": 0,
    "role": "USER",
    "coinflips": [],
    "testing": [],
    "city": null,
    "country": "India",
    "posts": [\
        {\
            "id": 70,\
            "title": "My first post",\
            "published": true,\
            "authorId": 43,\
            "comments": null,\
            "views": 0,\
            "likes": 0\
        },\
        {\
            "id": 71,\
            "title": "My second post",\
            "published": true,\
            "authorId": 43,\
            "comments": null,\
            "views": 0,\
            "likes": 0\
        }\
    ]
}
```

Note that it is **not possible** to nest an additional `create` or `createMany` inside the highlighted query, which means that you cannot create a user, posts, and post categories at the same time.

As a workaround, you can send a query to create the records that will be connected first, and then create the actual records. For example:

```
const categories = await prisma.category.createManyAndReturn({
  data: [{ name: "Fun" }, { name: "Technology" }, { name: "Sports" }],
  select: {
    id: true,
  },
});

const posts = await prisma.post.createManyAndReturn({
  data: [\
    {\
      title: "Funniest moments in 2024",\
      categoryId: categories.find((category) => category.name === "Fun")!.id,\
    },\
    {\
      title: "Linux or macOS — what's better?",\
      categoryId: categories.find((category) => category.name === "Technology")!.id,\
    },\
    {\
      title: "Who will win the next soccer championship?",\
      categoryId: categories.find((category) => category.name === "Sports")!.id,\
    },\
  ],
});
```

If you want to create _all_ records in a single database query, consider using a [`$transaction`](https://www.prisma.io/docs/orm/prisma-client/queries/transactions#the-transaction-api) or [type-safe, raw SQL](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/typedsql).

### [Create multiple records and multiple related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#create-multiple-records-and-multiple-related-records)

You cannot access relations in a `createMany()` or `createManyAndReturn()` query, which means that you cannot create multiple users and multiple posts in a single nested write. The following is **not** possible:

```
const createMany = await prisma.user.createMany({
  data: [\
    {\
      name: "Yewande",\
      email: "yewande@prisma.io",\
      posts: {\
        // Not possible to create posts!\
      },\
    },\
    {\
      name: "Noor",\
      email: "noor@prisma.io",\
      posts: {\
        // Not possible to create posts!\
      },\
    },\
  ],
});
```

### [Connect multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#connect-multiple-records)

The following query creates ( [`create`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#create) ) a new `User` record and connects that record ( [`connect`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#connect) ) to three existing posts:

```
const result = await prisma.user.create({
  data: {
    email: "vlad@prisma.io",
    posts: {
      connect: [{ id: 8 }, { id: 9 }, { id: 10 }],
    },
  },
  include: {
    posts: true, // Include all posts in the returned object
  },
});
```

```
{
  id: 27,
  name: null,
  email: 'vlad@prisma.io',
  profileViews: 0,
  role: 'USER',
  coinflips: [],
  posts: [\
    {\
      id: 10,\
      title: 'An existing post',\
      published: true,\
      authorId: 27,\
      comments: {},\
      views: 0,\
      likes: 0\
    }\
  ]
}
```

Note

Prisma Client throws an exception if any of the post records cannot be found: `connect: [{ id: 8 }, { id: 9 }, { id: 10 }]`

### [Connect a single record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#connect-a-single-record)

You can [`connect`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#connect) an existing record to a new or existing user. The following query connects an existing post (`id: 11`) to an existing user (`id: 9`)

```
const result = await prisma.user.update({
  where: {
    id: 9,
  },
  data: {
    posts: {
      connect: {
        id: 11,
      },
    },
  },
  include: {
    posts: true,
  },
});
```

### [Connect _or_ create a record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#connect-or-create-a-record)

If a related record may or may not already exist, use [`connectOrCreate`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#connectorcreate) to connect the related record:

- Connect a `User` with the email address `viola@prisma.io` _or_
- Create a new `User` with the email address `viola@prisma.io` if the user does not already exist

```
const result = await prisma.post.create({
  data: {
    title: "How to make croissants",
    author: {
      connectOrCreate: {
        where: {
          email: "viola@prisma.io",
        },
        create: {
          email: "viola@prisma.io",
          name: "Viola",
        },
      },
    },
  },
  include: {
    author: true,
  },
});
```

```
{
  id: 26,
  title: 'How to make croissants',
  published: true,
  authorId: 43,
  views: 0,
  likes: 0,
  author: {
    id: 43,
    name: 'Viola',
    email: 'viola@prisma.io',
    profileViews: 0,
    role: 'USER',
    coinflips: []
  }
}
```

### [Disconnect a related record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#disconnect-a-related-record)

To `disconnect` one out of a list of records (for example, a specific blog post) provide the ID or unique identifier of the record(s) to disconnect:

```
const result = await prisma.user.update({
  where: {
    id: 16,
  },
  data: {
    posts: {
      disconnect: [{ id: 12 }, { id: 19 }],
    },
  },
  include: {
    posts: true,
  },
});
```

```
{
  id: 16,
  name: null,
  email: 'orla@prisma.io',
  profileViews: 0,
  role: 'USER',
  coinflips: [],
  posts: []
}
```

To `disconnect` _one_ record (for example, a post's author), use `disconnect: true`:

```
const result = await prisma.post.update({
  where: {
    id: 23,
  },
  data: {
    author: {
      disconnect: true,
    },
  },
  include: {
    author: true,
  },
});
```

```
{
  id: 23,
  title: 'How to eat an omelette',
  published: true,
  authorId: null,
  comments: null,
  views: 0,
  likes: 0,
  author: null
}
```

### [Disconnect all related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#disconnect-all-related-records)

To [`disconnect`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#disconnect) _all_ related records in a one-to-many relation (a user has many posts), `set` the relation to an empty list as shown:

```
const result = await prisma.user.update({
  where: {
    id: 16,
  },
  data: {
    posts: {
      set: [],
    },
  },
  include: {
    posts: true,
  },
});
```

```
{
  id: 16,
  name: null,
  email: 'orla@prisma.io',
  profileViews: 0,
  role: 'USER',
  coinflips: [],
  posts: []
}
```

### [Delete all related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#delete-all-related-records)

Delete all related `Post` records:

```
const result = await prisma.user.update({
  where: {
    id: 11,
  },
  data: {
    posts: {
      deleteMany: {},
    },
  },
  include: {
    posts: true,
  },
});
```

### [Delete specific related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#delete-specific-related-records)

Update a user by deleting all unpublished posts:

```
const result = await prisma.user.update({
  where: {
    id: 11,
  },
  data: {
    posts: {
      deleteMany: {
        published: false,
      },
    },
  },
  include: {
    posts: true,
  },
});
```

Update a user by deleting specific posts:

```
const result = await prisma.user.update({
  where: {
    id: 6,
  },
  data: {
    posts: {
      deleteMany: [{ id: 7 }],
    },
  },
  include: {
    posts: true,
  },
});
```

### [Update all related records (or filter)](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#update-all-related-records-or-filter)

You can use a nested `updateMany` to update _all_ related records for a particular user. The following query unpublishes all posts for a specific user:

```
const result = await prisma.user.update({
  where: {
    id: 6,
  },
  data: {
    posts: {
      updateMany: {
        where: {
          published: true,
        },
        data: {
          published: false,
        },
      },
    },
  },
  include: {
    posts: true,
  },
});
```

### [Update a specific related record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#update-a-specific-related-record)

```
const result = await prisma.user.update({
  where: {
    id: 6,
  },
  data: {
    posts: {
      update: {
        where: {
          id: 9,
        },
        data: {
          title: "My updated title",
        },
      },
    },
  },
  include: {
    posts: true,
  },
});
```

### [Update _or_ create a related record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#update-or-create-a-related-record)

The following query uses a nested `upsert` to update `"bob@prisma.io"` if that user exists, or create the user if they do not exist:

```
const result = await prisma.post.update({
  where: {
    id: 6,
  },
  data: {
    author: {
      upsert: {
        create: {
          email: "bob@prisma.io",
          name: "Bob the New User",
        },
        update: {
          email: "bob@prisma.io",
          name: "Bob the existing user",
        },
      },
    },
  },
  include: {
    author: true,
  },
});
```

### [Add new related records to an existing record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#add-new-related-records-to-an-existing-record)

You can nest `create` or `createMany` inside an `update` to add new related records to an existing record. The following query adds two posts to a user with an `id` of 9:

```
const result = await prisma.user.update({
  where: {
    id: 9,
  },
  data: {
    posts: {
      createMany: {
        data: [{ title: "My first post" }, { title: "My second post" }],
      },
    },
  },
  include: {
    posts: true,
  },
});
```

## [Relation filters](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#relation-filters)

### [Filter on "-to-many" relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#filter-on--to-many-relations)

Prisma Client provides the [`some`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#some), [`every`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#every), and [`none`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#none) options to filter records by the properties of related records on the "-to-many" side of the relation. For example, filtering users based on properties of their posts.

For example:

| Requirement | Query option to use |
| --- | --- |
| "I want a list of every `User` that has _at least one_ unpublished `Post` record" | `some` posts are unpublished |
| "I want a list of every `User` that has _no_ unpublished `Post` records" | `none` of the posts are unpublished |
| "I want a list of every `User` that has _only_ unpublished `Post` records" | `every` post is unpublished |

For example, the following query returns `User` that meet the following criteria:

- No posts with more than 100 views
- All posts have less than, or equal to 50 likes

```
const users = await prisma.user.findMany({
  where: {
    posts: {
      none: {
        views: {
          gt: 100,
        },
      },
      every: {
        likes: {
          lte: 50,
        },
      },
    },
  },
  include: {
    posts: true,
  },
});
```

### [Filter on "-to-one" relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#filter-on--to-one-relations)

Prisma Client provides the [`is`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#is) and [`isNot`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#isnot) options to filter records by the properties of related records on the "-to-one" side of the relation. For example, filtering posts based on properties of their author.

For example, the following query returns `Post` records that meet the following criteria:

- Author's name is not Bob
- Author is older than 40

```
const users = await prisma.post.findMany({
  where: {
    author: {
      isNot: {
        name: "Bob",
      },
      is: {
        age: {
          gt: 40,
        },
      },
    },
  },
  include: {
    author: true,
  },
});
```

### [Filter on absence of "-to-many" records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#filter-on-absence-of--to-many-records)

For example, the following query uses `none` to return all users that have zero posts:

```
const usersWithZeroPosts = await prisma.user.findMany({
  where: {
    posts: {
      none: {},
    },
  },
  include: {
    posts: true,
  },
});
```

### [Filter on absence of "-to-one" relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#filter-on-absence-of--to-one-relations)

The following query returns all posts that don't have an author relation:

```
const postsWithNoAuthor = await prisma.post.findMany({
  where: {
    author: null, // or author: { }
  },
  include: {
    author: true,
  },
});
```

### [Filter on presence of related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#filter-on-presence-of-related-records)

The following query returns all users with at least one post:

```
const usersWithSomePosts = await prisma.user.findMany({
  where: {
    posts: {
      some: {},
    },
  },
  include: {
    posts: true,
  },
});
```

## [Fluent API](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries\#fluent-api)

The fluent API lets you _fluently_ traverse the [relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations) of your models via function calls. Note that the _last_ function call determines the return type of the entire query (the respective type annotations are added in the code snippets below to make that explicit).

This query returns all `Post` records by a specific `User`:

```
const postsByUser: Post[] = await prisma.user
  .findUnique({ where: { email: "alice@prisma.io" } })
  .posts();
```

This is equivalent to the following `findMany` query:

```
const postsByUser = await prisma.post.findMany({
  where: {
    author: {
      email: "alice@prisma.io",
    },
  },
});
```

The main difference between the queries is that the fluent API call is translated into two separate database queries while the other one only generates a single query (see this [GitHub issue](https://github.com/prisma/prisma/issues/1984))

This request returns all categories by a specific post:

```
const categoriesOfPost: Category[] = await prisma.post
  .findUnique({ where: { id: 1 } })
  .categories();
```

Note that you can chain as many queries as you like. In this example, the chaining starts at `Profile` and goes over `User` to `Post`:

```
const posts: Post[] = await prisma.profile
  .findUnique({ where: { id: 1 } })
  .user()
  .posts();
```

The only requirement for chaining is that the previous function call must return only a _single object_ (e.g. as returned by a `findUnique` query or a "to-one relation" like `profile.user()`).

The following query is **not possible** because `findMany` does not return a single object but a _list_:

```
// This query is illegal
const posts = await prisma.user.findMany().posts();
```

[Edit on GitHub](https://github.com/prisma/docs/edit/main/apps/docs/content/docs/orm/prisma-client/queries/relation-queries.mdx)

[Excluding fields\\
\\
Learn how to exclude fields from Prisma Client results with the omit option.](https://www.prisma.io/docs/orm/prisma-client/queries/excluding-fields) [Filtering and sorting\\
\\
Learn how to filter Prisma Client queries with where and sort results with orderBy.](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting)

### On this page

[Nested reads](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-reads) [Relation load strategies (Preview)](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#relation-load-strategies-preview) [Examples](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#examples) [When to use which load strategy?](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#when-to-use-which-load-strategy) [Include a relation](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#include-a-relation) [Include all fields for a specific relation](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#include-all-fields-for-a-specific-relation) [Include deeply nested relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#include-deeply-nested-relations) [Select specific fields of included relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#select-specific-fields-of-included-relations) [Relation count](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#relation-count) [Filter a list of relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#filter-a-list-of-relations) [Nested writes](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-writes) [Create a related record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#create-a-related-record) [Create a single record and multiple related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#create-a-single-record-and-multiple-related-records) [Using nested `create`](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#using-nested-create) [Using nested `createMany`](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#using-nested-createmany) [Create multiple records and multiple related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#create-multiple-records-and-multiple-related-records) [Connect multiple records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#connect-multiple-records) [Connect a single record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#connect-a-single-record) [Connect _or_ create a record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#connect-or-create-a-record) [Disconnect a related record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#disconnect-a-related-record) [Disconnect all related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#disconnect-all-related-records) [Delete all related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#delete-all-related-records) [Delete specific related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#delete-specific-related-records) [Update all related records (or filter)](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#update-all-related-records-or-filter) [Update a specific related record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#update-a-specific-related-record) [Update _or_ create a related record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#update-or-create-a-related-record) [Add new related records to an existing record](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#add-new-related-records-to-an-existing-record) [Relation filters](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#relation-filters) [Filter on "-to-many" relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#filter-on--to-many-relations) [Filter on "-to-one" relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#filter-on--to-one-relations) [Filter on absence of "-to-many" records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#filter-on-absence-of--to-many-records) [Filter on absence of "-to-one" relations](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#filter-on-absence-of--to-one-relations) [Filter on presence of related records](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#filter-on-presence-of-related-records) [Fluent API](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#fluent-api)

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