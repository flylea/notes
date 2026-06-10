# Monorepo 设计理念

## Monorepo vs Multirepo

```
Multirepo（多仓库）：
  github.com/team/book-backend        ← Nest API
  github.com/team/book-frontend       ← Vue 管理后台
  github.com/team/book-reader-app     ← 读者端 H5
  github.com/team/book-shared-types   ← 共享类型（npm 包）
  github.com/team/book-admin-nest     ← 管理后台 API

  问题：
  - 改一个接口，要提 4 个 PR
  - 共享类型版本管理头疼（@types/book@1.2.3 vs 1.2.4）
  - 跨仓库搜索代码困难
  - CI/CD 配置分散

Monorepo（单仓库）：
  github.com/team/book-management/
  ├── apps/
  │   ├── user-api/          # 用户端 API
  │   ├── admin-api/         # 管理端 API
  │   ├── web/               # Vue 管理后台
  │   └── reader-h5/         # 读者端 H5
  └── libs/
      ├── shared-dto/        # 共享 DTO
      ├── shared-utils/      # 共享工具
      └── prisma-client/     # 共享 PrismaService

  优势：
  - 一个 PR 改接口 + 前端 + 类型定义
  - 原子化提交（不会出现"后端发了但类型包还没发"）
  - 一次 grep 搜索全部代码
  - 统一的 lint/format/test/build 配置
```

> 前端类比：Vue 3 源码本身就是 Monorepo（packages/reactivity、runtime-core、compiler-sfc），用 pnpm workspace 管理。或者像你的公司项目用 `pnpm-workspace.yaml` 把多个项目放一起。

## 什么时候用 Monorepo

| 场景 | 建议 |
|------|------|
| 前后端共享 DTO 类型 | 强烈推荐 |
| 多个 Nest 应用共用 PrismaService | 强烈推荐 |
| 微服务间共享消息体定义 | 推荐 |
| 前后端代码需要原子化发布 | 推荐 |
| 只有一个应用 | 不需要 |
| 团队超过 50 人 | 考虑 Multirepo + 分包 |

**被高估的优势**：代码复用。**被低估的优势**：原子化变更、统一工具链、跨项目重构。

## NestJS Monorepo 的两种模式

### 模式 1：Nest CLI Monorepo（标准模式）

用 Nest CLI 的 `nest generate app` 和 `nest generate library` 管理：

```
nest-cli.json 中定义 projects
  → monorepo.json 映射到 tsconfig 路径别名
  → 共享库可以直接 import
```

```
my-project/
├── nest-cli.json
├── package.json            # 唯一的 package.json
├── tsconfig.json           # 根 tsconfig
├── apps/
│   ├── user-api/
│   │   ├── src/
│   │   └── tsconfig.app.json   # extends 根 tsconfig
│   └── admin-api/
│       ├── src/
│       └── tsconfig.app.json
└── libs/
    ├── shared-dto/
    │   ├── src/
    │   └── tsconfig.lib.json
    └── shared-utils/
        ├── src/
        └── tsconfig.lib.json
```

### 模式 2：pnpm Workspace（灵活模式）

适合前后端混排的仓库：

```
book-management/
├── pnpm-workspace.yaml
├── package.json                # 根（workspace 脚本）
├── apps/
│   ├── user-api/               # package: @book/user-api
│   │   ├── package.json
│   │   └── src/
│   ├── admin-api/              # package: @book/admin-api
│   │   ├── package.json
│   │   └── src/
│   └── web/                    # package: @book/web (Vue)
│       ├── package.json
│       └── src/
└── packages/
    ├── shared-dto/             # package: @book/shared-dto
    │   ├── package.json
    │   └── src/
    ├── shared-utils/           # package: @book/shared-utils
    │   ├── package.json
    │   └── src/
    └── eslint-config/          # package: @book/eslint-config
        ├── package.json
        └── index.js
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

两种模式的选择：

| 维度 | Nest CLI 模式 | pnpm Workspace |
|------|-------------|----------------|
| 纯 Nest 项目 | 完美匹配 | 也能用 |
| 前后端混合 | 不适用 | 推荐 |
| 构建工具 | Nest CLI 统一管理 | 各自独立配置 |
| 学习成本 | 低（Nest 生态内） | 中（需要了解 workspace 协议） |
| 灵活性 | 受限于 Nest CLI | 完全自由 |

## Nest CLI Monorepo 初始化

```bash
# 1. 创建标准 Nest 项目
nest new book-management
cd book-management

# 2. 转为 Monorepo 模式（自动生成 nest-cli.json 的 projects 配置）
nest generate app user-api      # 创建 apps/user-api
nest generate app admin-api     # 创建 apps/admin-api

# 3. 创建共享库
nest generate library shared-dto     # 创建 libs/shared-dto
nest generate library shared-utils   # 创建 libs/shared-utils
```

生成后的 `nest-cli.json`：

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "monorepo": true,
  "root": "apps/user-api",
  "projects": {
    "user-api": {
      "type": "application",
      "root": "apps/user-api",
      "entryFile": "main",
      "sourceRoot": "apps/user-api/src",
      "compilerOptions": {
        "tsConfigPath": "apps/user-api/tsconfig.app.json"
      }
    },
    "admin-api": {
      "type": "application",
      "root": "apps/admin-api",
      "entryFile": "main",
      "sourceRoot": "apps/admin-api/src",
      "compilerOptions": {
        "tsConfigPath": "apps/admin-api/tsconfig.app.json"
      }
    },
    "shared-dto": {
      "type": "library",
      "root": "libs/shared-dto",
      "entryFile": "index",
      "sourceRoot": "libs/shared-dto/src",
      "compilerOptions": {
        "tsConfigPath": "libs/shared-dto/tsconfig.lib.json"
      }
    },
    "shared-utils": {
      "type": "library",
      "root": "libs/shared-utils",
      "entryFile": "index",
      "sourceRoot": "libs/shared-utils/src",
      "compilerOptions": {
        "tsConfigPath": "libs/shared-utils/tsconfig.lib.json"
      }
    }
  }
}
```

## Monorepo 常见命令

```bash
# 构建全部项目
nest build

# 构建指定项目
nest build user-api
nest build admin-api

# 启动指定应用（开发模式）
nest start user-api --watch
nest start admin-api --watch

# 同时启动多个应用（开两个终端或用 concurrently）
npx concurrently "nest start user-api --watch" "nest start admin-api --watch"

# 生成代码到指定项目
nest g controller books --project user-api
nest g service books --project admin-api

# 生成代码到指定库
nest g class pagination.dto --project shared-dto

# 运行测试
nest test user-api
nest test shared-dto
```

## 依赖管理

库之间的依赖需要在各自的 `tsconfig` 中通过路径映射声明：

```json
// apps/user-api/tsconfig.app.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "paths": {
      "@app/shared-dto": ["libs/shared-dto/src"],
      "@app/shared-utils": ["libs/shared-utils/src"]
    }
  }
}
```

库也可以依赖其他库：

```typescript
// libs/shared-dto/src/user.dto.ts
import { PaginationDto } from '@app/shared-utils';  // ← 库引用库
```

> 注意避免循环依赖：A 库引用 B 库，B 库又引用 A 库。保持依赖方向单向。

## 编译产物与路径别名

```json
// 根 tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@app/shared-dto": ["libs/shared-dto/src"],
      "@app/shared-dto/*": ["libs/shared-dto/src/*"],
      "@app/shared-utils": ["libs/shared-utils/src"],
      "@app/shared-utils/*": ["libs/shared-utils/src/*"]
    }
  }
}
```

Nest CLI 构建时会自动解析这些路径别名，把库的代码打包进去。但如果你用 pnpm workspace，则需要额外处理——通常用 tsc-alias 或 ts-patch 来转换路径。

---

## 参考链接

- [NestJS — CLI Monorepo Mode](https://docs.nestjs.com/cli/monorepo)
- [NestJS — Libraries](https://docs.nestjs.com/cli/libraries)
- [pnpm — Workspace](https://pnpm.io/workspaces)
- [Turborepo — Monorepo Tool](https://turbo.build/repo/docs)
