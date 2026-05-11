# nest-cli.json 配置详解

## 默认配置

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

## compilerOptions — 编译选项

### deleteOutDir

```json
{
  "compilerOptions": {
    "deleteOutDir": true   // 每次编译前清理 dist/ 目录
  }
}
```

推荐保持 `true`。否则删除的源文件，其编译产物会残留在 dist/ 中，可能造成难以排查的运行时问题。

### assets

```json
{
  "compilerOptions": {
    "assets": [
      {
        "include": ".env",              // 编译时复制 .env 到 dist/
        "outDir": "dist"
      },
      {
        "include": "**/*.hbs",          // 复制所有 handlebars 模板
        "outDir": "dist"
      },
      {
        "include": "uploads/**/*",      // 复制上传文件
        "watchAssets": true,            // --watch 也监控这些文件
        "outDir": "dist"
      }
    ]
  }
}
```

> 重要：`.env` 文件默认不会被 TypeScript 编译器处理（不是 .ts 文件）。如果不配置 assets，编译后的 `dist/` 里没有 `.env`，运行时 `ConfigModule` 找不到配置文件。

### tsConfigPath

```json
{
  "compilerOptions": {
    "tsConfigPath": "tsconfig.build.json"  // 使用非默认的 tsconfig
  }
}
```

### webpack

```json
{
  "compilerOptions": {
    "webpack": true,                 // 启用 webpack 编译
    "webpackConfigPath": "webpack.config.js"  // 自定义 webpack 配置
  }
}
```

### builder

```json
{
  "compilerOptions": {
    "builder": "swc"  // 使用 SWC 编译器（比 tsc 快 20x）
  }
}
```

SWC 是用 Rust 写的 TypeScript/JavaScript 编译器，速度极快。需要安装：

```bash
pnpm add -D @swc/cli @swc/core
```

> tsc vs webpack vs SWC：tsc 最稳，webpack 生态最全，SWC 最快。开发阶段选 SWC（节省大量编译时间），生产部署选 tsc（稳定性优先）。

## generateOptions — 生成器选项

```json
{
  "generateOptions": {
    "spec": false,           // 全局关闭测试文件生成
    "flat": false,           // 全局关闭平铺模式
    "specFileSuffix": "spec" // 测试文件后缀（默认 .spec.ts）
  }
}
```

设置 `"spec": false` 后，`nest g xxx` 不再生成 `.spec.ts` 文件，省去手动加 `--no-spec` 的麻烦。

> 推荐初学者设置 `"spec": false`——在还没学会写测试之前，测试文件是给你添乱的。等 Day 30 之后再回来学测试。

## collection — 代码模板集合

```json
{
  "collection": "@nestjs/schematics"  // Nest 官方模板
}
```

你可以创建自己的 schematics 集合（比如公司内部的代码模板），然后改为指向自定义集合。团队项目统一代码风格时很有用。

## sourceRoot — 源码根目录

```json
{
  "sourceRoot": "src"  // 默认值
}
```

Monorepo 项目中可能需要改：

```json
{
  "sourceRoot": "apps/api/src"
}
```

## 实战配置推荐

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [
      {
        "include": ".env",
        "outDir": "dist",
        "watchAssets": true
      }
    ]
  },
  "generateOptions": {
    "spec": false
  }
}
```

## Monorepo 场景下的 nest-cli.json

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/api/src",
  "monorepo": true,
  "root": "apps/api",
  "compilerOptions": {
    "webpack": true,
    "tsConfigPath": "apps/api/tsconfig.app.json"
  },
  "projects": {
    "api": {
      "type": "application",
      "root": "apps/api",
      "entryFile": "main",
      "sourceRoot": "apps/api/src",
      "compilerOptions": {
        "tsConfigPath": "apps/api/tsconfig.app.json"
      }
    },
    "admin": {
      "type": "application",
      "root": "apps/admin",
      "entryFile": "main",
      "sourceRoot": "apps/admin/src",
      "compilerOptions": {
        "tsConfigPath": "apps/admin/tsconfig.app.json"
      }
    }
  }
}
```

Monorepo 配置我们会在 Day 29 详细介绍。

---

## 参考链接

- [NestJS CLI — nest-cli.json](https://docs.nestjs.com/cli/monorepo#nest-cli-properties)
- [SWC — TypeScript Compilation](https://swc.rs/docs/usage/typescript)
- 开源笔记：《Nest 通关秘籍》.doc/4. 快速掌握 Nest CLI.md
