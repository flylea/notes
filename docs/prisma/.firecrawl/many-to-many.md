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

Many-to-many relationsRelational databases

Data ModelRelations

# Many-to-many relations

Copy MarkdownOpen

How to define and work with many-to-many relations in Prisma.

Many-to-many (m-n) relations connect zero or more records on one side to zero or more on the other. They can be [implicit](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#implicit-many-to-many-relations) (Prisma manages the relation table) or [explicit](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#explicit-many-to-many-relations) (you define the relation table).

## [Relational databases](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#relational-databases)

Use [implicit](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#implicit-many-to-many-relations) m-n unless you need to store additional metadata in the relation table.

### [Explicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#explicit-many-to-many-relations)

The relation table is represented as a model in the schema:

```
model Post {
  id         Int                 @id @default(autoincrement())
  title      String
  categories CategoriesOnPosts[]
}

model Category {
  id    Int                 @id @default(autoincrement())
  name  String
  posts CategoriesOnPosts[]
}

model CategoriesOnPosts {
  post       Post     @relation(fields: [postId], references: [id])
  postId     Int
  category   Category @relation(fields: [categoryId], references: [id])
  categoryId Int
  assignedAt DateTime @default(now())
  assignedBy String
  @@id([postId, categoryId])
}
```

The relation table can store additional fields like `assignedAt` and `assignedBy`.

#### [Querying explicit many-to-many](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#querying-explicit-many-to-many)

```
// Create post with new category
const post = await prisma.post.create({
  data: {
    title: "How to be Bob",
    categories: {
      create: [\
        {\
          assignedBy: "Bob",\
          category: { create: { name: "New category" } },\
        },\
      ],
    },
  },
});

// Connect to existing categories
await prisma.post.create({
  data: {
    title: "My Post",
    categories: {
      create: [\
        { assignedBy: "Bob", category: { connect: { id: 9 } } },\
        { assignedBy: "Bob", category: { connect: { id: 22 } } },\
      ],
    },
  },
});

// Query posts by category
const posts = await prisma.post.findMany({
  where: { categories: { some: { category: { name: "New Category" } } } },
});
```

### [Implicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#implicit-many-to-many-relations)

Prisma manages the relation table automatically:

```
model Post {
  id         Int        @id @default(autoincrement())
  title      String
  categories Category[]
}

model Category {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[]
}
```

#### [Querying implicit many-to-many](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#querying-implicit-many-to-many)

```
// Create post with categories
const post = await prisma.post.create({
  data: {
    title: "How to become a butterfly",
    categories: {
      create: [{ name: "Magic" }, { name: "Butterflies" }],
    },
  },
});

// Get posts with categories
const posts = await prisma.post.findMany({
  include: { categories: true },
});
```

#### [Rules for implicit m-n](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#rules-for-implicit-m-n)

- Both models must have a single `@id` (no composite IDs or `@unique`)
- No `@relation` attribute needed (unless disambiguating)
- Cannot use `fields`, `references`, `onUpdate`, or `onDelete` in `@relation`

#### [Relation table conventions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#relation-table-conventions)

For `prisma db pull` to recognize implicit m-n tables:

- Table name: `_CategoryToPost` (underscore + model names alphabetically + `To`)
- Columns: `A` (FK to first model alphabetically) and `B` (FK to second)
- Unique index on both columns, non-unique index on `B`

### [Configuring relation table name](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#configuring-relation-table-name)

Use `@relation("MyRelationTable")` on both sides to customize the table name.

## [MongoDB](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#mongodb)

MongoDB requires explicit ID arrays on both sides:

```
model Post {
  id          String     @id @default(auto()) @map("_id") @db.ObjectId
  categoryIDs String[]   @db.ObjectId
  categories  Category[] @relation(fields: [categoryIDs], references: [id])
}

model Category {
  id      String   @id @default(auto()) @map("_id") @db.ObjectId
  name    String
  postIDs String[] @db.ObjectId
  posts   Post[]   @relation(fields: [postIDs], references: [id])
}
```

### [Querying MongoDB m-n](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations\#querying-mongodb-m-n)

```
// Find posts by category IDs
const posts = await prisma.post.findMany({
  where: { categoryIDs: { hasSome: [id1, id2] } },
});

// Find posts by category name
const posts = await prisma.post.findMany({
  where: { categories: { some: { name: { contains: "Servers" } } } },
});
```

[Edit on GitHub](https://github.com/prisma/docs/edit/main/apps/docs/content/docs/orm/prisma-schema/data-model/relations/many-to-many-relations.mdx)

[One-to-many relations\\
\\
How to define and work with one-to-many relations in Prisma.](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-many-relations) [Self-relations\\
\\
How to define and work with self-relations in Prisma.](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/self-relations)

### On this page

[Relational databases](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#relational-databases) [Explicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#explicit-many-to-many-relations) [Querying explicit many-to-many](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#querying-explicit-many-to-many) [Implicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#implicit-many-to-many-relations) [Querying implicit many-to-many](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#querying-implicit-many-to-many) [Rules for implicit m-n](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#rules-for-implicit-m-n) [Relation table conventions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#relation-table-conventions) [Configuring relation table name](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#configuring-relation-table-name) [MongoDB](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#mongodb) [Querying MongoDB m-n](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#querying-mongodb-m-n)

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