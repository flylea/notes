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

One-to-one relationsMulti-field relations (relational databases only)

Data ModelRelations

# One-to-one relations

Copy MarkdownOpen

How to define and work with one-to-one relations in Prisma.

One-to-one (1-1) relations connect at most **one** record on each side. In this example, `User` and `Profile` have a 1-1 relation:

```
model User {
  id      Int      @id @default(autoincrement())
  profile Profile?
}

model Profile {
  id     Int  @id @default(autoincrement())
  user   User @relation(fields: [userId], references: [id])
  userId Int  @unique // Foreign key with unique constraint
}
```

This expresses:

- A user can have zero or one profile
- A profile must always be connected to exactly one user

You can also reference a non-ID field with `@unique`:

```
model Profile {
  id        Int    @id @default(autoincrement())
  user      User   @relation(fields: [userEmail], references: [email])
  userEmail String @unique
}
```

## [Multi-field relations (relational databases only)](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations\#multi-field-relations-relational-databases-only)

```
model User {
  firstName String
  lastName  String
  profile   Profile?
  @@id([firstName, lastName])
}

model Profile {
  id            Int    @id @default(autoincrement())
  user          User   @relation(fields: [userFirstName, userLastName], references: [firstName, lastName])
  userFirstName String
  userLastName  String
  @@unique([userFirstName, userLastName])
}
```

## [1-1 in the database](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations\#1-1-in-the-database)

In SQL, a 1-1 relation requires a `UNIQUE` constraint on the foreign key. Without this, it becomes a 1-n relation.

For MongoDB, documents reference each other by ID:

```
// User
{ "_id": { "$oid": "60d58e130011041800d209e1" }, "name": "Bob" }
// Profile
{ "_id": "...", "bio": "I like drawing.", "userId": { "$oid": "60d58e130011041800d209e1" } }
```

## [Required and optional 1-1 relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations\#required-and-optional-1-1-relation-fields)

The side _without_ a relation scalar must be optional:

```
model User {
  id      Int      @id @default(autoincrement())
  profile Profile? // No relation scalar - must be optional
}
```

The side _with_ a relation scalar can be required or optional:

**Mandatory 1-1** (cannot create User without Profile):

```
model User {
  id        Int     @id @default(autoincrement())
  profile   Profile @relation(fields: [profileId], references: [id])
  profileId Int     @unique
}
```

**Optional 1-1** (can create User without Profile):

```
model User {
  id        Int      @id @default(autoincrement())
  profile   Profile? @relation(fields: [profileId], references: [id])
  profileId Int?     @unique
}
```

## [Choosing which side stores the foreign key](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations\#choosing-which-side-stores-the-foreign-key)

In 1-1 relations, you can choose which side holds the `@relation` attribute and foreign key. Both approaches are valid:

**Option 1:** Foreign key on `Profile`

```
model User {
  id      Int      @id @default(autoincrement())
  profile Profile?
}

model Profile {
  id     Int  @id @default(autoincrement())
  user   User @relation(fields: [userId], references: [id])
  userId Int  @unique
}
```

**Option 2:** Foreign key on `User`

```
model User {
  id        Int      @id @default(autoincrement())
  profile   Profile? @relation(fields: [profileId], references: [id])
  profileId Int?     @unique
}

model Profile {
  id   Int   @id @default(autoincrement())
  user User?
}
```

[Edit on GitHub](https://github.com/prisma/docs/edit/main/apps/docs/content/docs/orm/prisma-schema/data-model/relations/one-to-one-relations.mdx)

[Relations\\
\\
A relation is a connection between two models in the Prisma schema. This page explains how you can define one-to-one, one-to-many and many-to-many relations in Prisma](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations) [One-to-many relations\\
\\
How to define and work with one-to-many relations in Prisma.](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-many-relations)

### On this page

[Multi-field relations (relational databases only)](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations#multi-field-relations-relational-databases-only) [1-1 in the database](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations#1-1-in-the-database) [Required and optional 1-1 relation fields](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations#required-and-optional-1-1-relation-fields) [Choosing which side stores the foreign key](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/one-to-one-relations#choosing-which-side-stores-the-foreign-key)

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