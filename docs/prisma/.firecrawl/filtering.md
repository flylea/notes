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

Filtering and sortingFiltering with where

Queries

# Filtering and sorting

Copy MarkdownOpen

Learn how to filter Prisma Client queries with where and sort results with orderBy.

Prisma Client lets you narrow results with `where` and order them with `orderBy`.

## [Filtering with where](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#filtering-with-where)

Use `where` to match records by field values:

```
const users = await prisma.user.findMany({
  where: {
    email: {
      endsWith: "prisma.io",
    },
  },
});
```

## [Combining operators](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#combining-operators)

You can compose filters with operators such as `OR`, `AND`, and `NOT`:

```
const users = await prisma.user.findMany({
  where: {
    OR: [\
      { email: { endsWith: "gmail.com" } },\
      { email: { endsWith: "company.com" } },\
    ],
    NOT: {
      email: {
        endsWith: "admin.company.com",
      },
    },
  },
});
```

## [Filter on related records](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#filter-on-related-records)

Relation filters let you match records based on related data:

```
const users = await prisma.user.findMany({
  where: {
    posts: {
      some: {
        published: true,
      },
    },
  },
});
```

For more relation-specific patterns, see [Relation queries](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries).

## [Sort results with orderBy](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#sort-results-with-orderby)

Use `orderBy` to control result ordering:

```
const posts = await prisma.post.findMany({
  orderBy: {
    title: "asc",
  },
});
```

You can also combine filtering and sorting:

```
const posts = await prisma.post.findMany({
  where: {
    published: true,
  },
  orderBy: {
    createdAt: "desc",
  },
});
```

## [Case-insensitive filtering](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#case-insensitive-filtering)

Case sensitivity depends on your database provider and collation settings. For PostgreSQL, Prisma Client also supports specific case-insensitive filter modes on supported operators. See the [Prisma Client API reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference#mode) for details.

## [Sort by relation](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#sort-by-relation)

You can sort by properties on related records when the query shape supports it. For example, you might order posts by their author's name or users by related aggregates.

## [Sort by relevance (PostgreSQL and MySQL)](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#sort-by-relevance-postgresql-and-mysql)

On supported databases, Prisma Client can sort search results by relevance using `_relevance`. This is especially useful when combined with [full-text search](https://www.prisma.io/docs/orm/prisma-client/queries/full-text-search).

## [Sort with null records first or last](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#sort-with-null-records-first-or-last)

Prisma Client supports explicit null ordering on supported databases so you can keep incomplete values grouped at the beginning or end of a result set.

## [Related pages](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting\#related-pages)

- [Pagination](https://www.prisma.io/docs/orm/prisma-client/queries/pagination)
- [Select fields](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields)
- [Prisma Client API reference](https://www.prisma.io/docs/orm/reference/prisma-client-reference#filter-conditions-and-operators)

[Edit on GitHub](https://github.com/prisma/docs/edit/main/apps/docs/content/docs/orm/prisma-client/queries/filtering-and-sorting.mdx)

[Relation queries\\
\\
Prisma Client provides convenient queries for working with relations, such as a fluent API, nested writes (transactions), nested reads and relation filters](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries) [Pagination\\
\\
Learn how to paginate Prisma Client query results with offset pagination and cursor-based pagination.](https://www.prisma.io/docs/orm/prisma-client/queries/pagination)

### On this page

[Filtering with where](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#filtering-with-where) [Combining operators](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#combining-operators) [Filter on related records](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#filter-on-related-records) [Sort results with orderBy](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#sort-results-with-orderby) [Case-insensitive filtering](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#case-insensitive-filtering) [Sort by relation](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#sort-by-relation) [Sort by relevance (PostgreSQL and MySQL)](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#sort-by-relevance-postgresql-and-mysql) [Sort with null records first or last](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#sort-with-null-records-first-or-last) [Related pages](https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#related-pages)

## Chat

### How can I help?

Ask me anything about Prisma

How do I migrate from Prisma ORM v6 to v7?How do I use Prisma with Next.js?How do I deploy Prisma to Railway?

Press `⌘`  `I` to toggle

Enable deep thinking

Send message

Powered by [kapa.ai](https://kapa.ai/)