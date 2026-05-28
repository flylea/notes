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

RelationsRelations in the database

Data ModelRelations

# Relations

Copy MarkdownOpen

A relation is a connection between two models in the Prisma schema. This page explains how you can define one-to-one, one-to-many and many-to-many relations in Prisma

A relation is a _connection_ between two models in the Prisma schema. For example, there is a one-to-many relation between `User` and `Post` because one user can have many blog posts:

```
model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id])
  authorId Int  // Foreign key connecting Post to User
  title    String
}
```

At a Prisma ORM level, the `User` / `Post` relation consists of:

- **Relation fields** (`author` and `posts`): Define connections at Prisma ORM level, do not exist in the database
- **Relation scalar field** (`authorId`): The foreign key that exists in the database

## [Relations in the database](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#relations-in-the-database)

### [Relational databases](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#relational-databases)

In SQL, you use a _foreign key_ to create a relation between two tables:

- A foreign key column (`authorId`) in `Post` references the primary key (`id`) in `User`

```
author     User        @relation(fields: [authorId], references: [id])
```

Relations in the Prisma schema represent relationships that exist between tables in the database.

### [MongoDB](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#mongodb)

MongoDB uses a normalized data model design where documents reference each other by ID:

```
// User document
{ "_id": { "$oid": "60d5922d00581b8f0062e3a8" }, "name": "Ella" }

// Post documents referencing the user
{ "_id": "...", "title": "How to make sushi", "authorId": { "$oid": "60d5922d00581b8f0062e3a8" } }
```

If using `ObjectId`, add `@db.ObjectId` to both the model ID and relation scalar field:

```
model Post {
  id       String @id @default(auto()) @map("_id") @db.ObjectId
  author   User   @relation(fields: [authorId], references: [id])
  authorId String @db.ObjectId
}
```

## [Relations in Prisma Client](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#relations-in-prisma-client)

### [Create records with nested relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#create-records-with-nested-relations)

```
const userAndPosts = await prisma.user.create({
  data: {
    posts: {
      create: [{ title: "Prisma Day 2020" }, { title: "How to write a Prisma schema" }],
    },
  },
});
```

### [Retrieve records with related data](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#retrieve-records-with-related-data)

```
const getAuthor = await prisma.user.findUnique({
  where: { id: "20" },
  include: { posts: true },
});
```

### [Connect existing records](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#connect-existing-records)

```
await prisma.user.update({
  where: { id: 20 },
  data: {
    posts: { connect: { id: 4 } },
  },
});
```

## [Types of relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#types-of-relations)

There are three different types (or [cardinalities](https://en.wikipedia.org/wiki/Cardinality_(data_modeling))) of relations in Prisma ORM:

- [One-to-one](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations) (also called 1-1 relations)
- [One-to-many](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-many-relations) (also called 1-n relations)
- [Many-to-many](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations) (also called m-n relations)

The following Prisma schema includes every type of relation:

- one-to-one: `User` ↔ `Profile`
- one-to-many: `User` ↔ `Post`
- many-to-many: `Post` ↔ `Category`

Relational databases

MongoDB

```
model User {
  id      Int      @id @default(autoincrement())
  posts   Post[]
  profile Profile?
}

model Profile {
  id     Int  @id @default(autoincrement())
  user   User @relation(fields: [userId], references: [id])
  userId Int  @unique // relation scalar field (used in the `@relation` attribute above)
}

model Post {
  id         Int        @id @default(autoincrement())
  author     User       @relation(fields: [authorId], references: [id])
  authorId   Int // relation scalar field  (used in the `@relation` attribute above)
  categories Category[]
}

model Category {
  id    Int    @id @default(autoincrement())
  posts Post[]
}
```

This schema is the same as the [example data model](https://www.prisma.io/docs/orm/prisma-schema/data-model/models) but has all [scalar fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/models#scalar-fields) removed (except for the required [relation scalar fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#relation-fields)) so you can focus on the [relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#relation-fields).

This example uses [implicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#implicit-many-to-many-relations). These relations do not require the `@relation` attribute unless you need to [disambiguate relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#disambiguating-relations).

Notice that the syntax is slightly different between relational databases and MongoDB - particularly for [many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations).

For relational databases, the following entity relationship diagram represents the database that corresponds to the sample Prisma schema:

![The sample schema as an entity relationship diagram](https://www.prisma.io/docs/_next/image?url=%2Fdocs%2Fimg%2Form%2Fprisma-schema%2Fdata-model%2Frelations%2Fsample-schema.png&w=3840&q=75&dpl=dpl_BUqV1f214T6CBouV64SN4ErWjaws)

For MongoDB, Prisma ORM uses a [normalized data model design](https://www.mongodb.com/docs/manual/data-modeling/), which means that documents reference each other by ID in a similar way to relational databases. See [the MongoDB section](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#mongodb) for more details.

### [Implicit and explicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#implicit-and-explicit-many-to-many-relations)

Many-to-many relations in relational databases can be modelled in two ways:

- [explicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#explicit-many-to-many-relations), where the relation table is represented as an explicit model in your Prisma schema
- [implicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#implicit-many-to-many-relations), where Prisma ORM manages the relation table and it does not appear in the Prisma schema.

Implicit many-to-many relations require both models to have a single `@id`. Be aware of the following:

- You cannot use a [multi-field ID](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
- You cannot use a `@unique` in place of an `@id`

To use either of these features, you must set up an explicit many-to-many instead.

The implicit many-to-many relation still manifests in a relation table in the underlying database. However, Prisma ORM manages this relation table.

If you use an implicit many-to-many relation instead of an explicit one, it makes the [Prisma Client API](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction) simpler (because, for example, you have one fewer level of nesting inside of [nested writes](https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries#nested-writes)).

If you're not using Prisma Migrate but obtain your data model from [introspection](https://www.prisma.io/docs/orm/prisma-schema/introspection), you can still make use of implicit many-to-many relations by following Prisma ORM's [conventions for relation tables](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#relation-table-conventions).

## [Relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#relation-fields)

Relation fields are fields on a Prisma model whose type is another model (not a scalar type). Every relation needs exactly two relation fields, one on each model.

```
model User {
  id    Int    @id @default(autoincrement())
  posts Post[] // relation field
}

model Post {
  id       Int    @id @default(autoincrement())
  author   User   @relation(fields: [authorId], references: [id]) // annotated relation field
  authorId Int    // relation scalar field (foreign key)
}
```

**Key concepts:**

- `posts` and `author` are relation fields (exist at Prisma ORM level only)
- `authorId` is the relation scalar field (exists in the database as foreign key)

### [Annotated relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#annotated-relation-fields)

Relations annotated with `@relation` attribute (one-to-one, one-to-many, and many-to-many for MongoDB) represent the side that stores the foreign key:

```
author     User    @relation(fields: [authorId], references: [id])
authorId   Int     // relation scalar field
```

**Naming convention:** Relation scalar fields typically use the pattern `fieldName` \+ `Id` (e.g., `author` → `authorId`).

## [The `@relation` attribute](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#the-relation-attribute)

The `@relation` attribute is required when:

- Defining one-to-one or one-to-many relations
- Disambiguating multiple relations between the same models
- Defining [self-relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/self-relations)
- Defining many-to-many relations for MongoDB

[Implicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/many-to-many-relations#implicit-many-to-many-relations) in relational databases do not require `@relation`.

## [Disambiguating relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations\#disambiguating-relations)

When you have two relations between the same models, use the `name` argument in `@relation` to disambiguate:

```
model User {
  id           Int     @id @default(autoincrement())
  writtenPosts Post[]  @relation("WrittenPosts")
  pinnedPost   Post?   @relation("PinnedPost")
}

model Post {
  id         Int     @id @default(autoincrement())
  author     User    @relation("WrittenPosts", fields: [authorId], references: [id])
  authorId   Int
  pinnedBy   User?   @relation("PinnedPost", fields: [pinnedById], references: [id])
  pinnedById Int?    @unique
}
```

The `name` must be the same on both sides of the relation.

[Edit on GitHub](https://github.com/prisma/docs/edit/main/apps/docs/content/docs/orm/prisma-schema/data-model/relations/index.mdx)

[Models\\
\\
Learn about the concepts for building your data model with Prisma: Models, scalar types, enums, attributes, functions, IDs, default values and more](https://www.prisma.io/docs/orm/prisma-schema/data-model/models) [One-to-one relations\\
\\
How to define and work with one-to-one relations in Prisma.](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations)

### On this page

[Relations in the database](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#relations-in-the-database) [Relational databases](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#relational-databases) [MongoDB](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#mongodb) [Relations in Prisma Client](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#relations-in-prisma-client) [Create records with nested relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#create-records-with-nested-relations) [Retrieve records with related data](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#retrieve-records-with-related-data) [Connect existing records](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#connect-existing-records) [Types of relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#types-of-relations) [Implicit and explicit many-to-many relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#implicit-and-explicit-many-to-many-relations) [Relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#relation-fields) [Annotated relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#annotated-relation-fields) [The `@relation` attribute](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#the-relation-attribute) [Disambiguating relations](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations#disambiguating-relations)

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