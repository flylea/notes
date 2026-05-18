# 第23章 TSConfig 配置详解

`tsconfig.json` 是 TypeScript 项目的核心配置文件。它的存在标志着一个目录是 TypeScript 项目的根目录。本章将从实际使用出发，按照**构建**、**类型检查**、**工程**三大类，逐一剖析每个重要配置项的含义、作用和推荐用法。

## 快速开始

### 生成配置文件

```bash
tsc --init
```

这会生成一个带详细注释的 `tsconfig.json`，包含绝大多数配置项及其说明。

### 最小配置

最简单的 `tsconfig.json` 可以是空对象 `{}`——此时 tsc 使用所有默认值。实际项目中至少需要指定编译目标和源码范围：

```json
{
  "compilerOptions": {
    "target": "es2018",
    "outDir": "./dist",
    "strict": true
  },
  "include": ["src/**/*"]
}
```

### 配置继承

通过 `extends` 可以复用已有配置，支持本地文件和 npm 包：

```json
{
  "extends": "@tsconfig/node18/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

`@tsconfig` 命名空间下提供了针对不同环境的预设配置：`@tsconfig/recommended`、`@tsconfig/node16`、`@tsconfig/deno` 等。

## 文件范围控制

### files、include 与 exclude

这三个顶级属性决定了哪些文件参与编译：

- **files**：适合小型项目，精确列出每个文件路径，不支持 glob pattern
- **include**：支持 glob pattern 批量匹配，适合大多数项目
- **exclude**：从 include 匹配到的文件中再排除一部分

```json
{
  "include": ["src/**/*", "generated/*.ts"],
  "exclude": ["src/**/*.test.ts", "src/**/*.e2e.ts"]
}
```

注意事项：
- `exclude` 只能剔除已被 `include` 包含的文件
- 不写扩展名时默认匹配 `.ts` / `.tsx` / `.d.ts`（以及开启 `allowJs` 后的 `.js` / `.jsx`）
- 如果 `files` 和 `include` 都未指定，TypeScript 会包含当前目录及子目录下所有 `.ts` / `.tsx` / `.d.ts` 文件

## 构建相关配置

### target——编译目标版本

`target` 决定编译后的 JavaScript 使用哪个 ECMAScript 版本的语法。常用值：

| 值 | 说明 |
|---|---|
| `es5` | 最大兼容性，支持几乎所有运行时 |
| `es2018` | **推荐**，支持 async/await、rest/spread、Promise.finally |
| `es2020` | 支持可选链、空值合并、BigInt |
| `es2022` | 支持 Top-Level Await、Array.at()、Error Cause |
| `esnext` | 基于当前 TS 版本支持的最新 ES 语法 |

```json
{
  "compilerOptions": {
    "target": "es2018"
  }
}
```

`target` 会影响 `lib` 的默认值——比如 `target` 设为 `es2021` 时，`es2021` 的库声明会被自动包含。

### lib——内置类型库

`lib` 指定编译时可用的内置 API 声明。常用值：

```json
{
  "compilerOptions": {
    "lib": ["es2021", "dom", "dom.iterable"]
  }
}
```

核心 lib 值说明：

| 值 | 包含的内容 |
|---|---|
| `es5` ~ `es2022` | 各版本 ES 标准库（String、Array、Promise 等） |
| `esnext` | 最新提案中的 ES 特性 |
| `dom` | DOM 类型（window、document 等） |
| `dom.iterable` | DOM 可迭代类型 |
| `webworker` | Web Worker 环境类型 |

实际注意事项：
- Node.js 项目**不应包含** `"dom"`——会导致 `window`/`document` 等全局变量可用，掩盖运行时错误
- 浏览器项目**应包含** `"dom"`
- 如果使用了 `String.prototype.replaceAll`，需要 `es2021` 或 `es2021.String`
- 设置 `noLib: true` 可以禁用所有内置 lib，此时你需要自行提供所有内置对象的类型定义

### module——输出模块格式

`module` 控制编译产物的模块系统：

```json
{
  "compilerOptions": {
    "module": "esnext"
  }
}
```

| 值 | 适用场景 |
|---|---|
| `commonjs` | Node.js 传统项目（配合 ts-node 等） |
| `es6` / `es2015` | 输出 ES Module |
| `es2020` / `es2022` / `esnext` | 配合打包工具（Webpack、Vite 等） |
| `node16` / `nodenext` | 纯 Node.js ESM 项目（TS 4.7+） |
| `umd` / `amd` / `system` | 特定模块加载器（较少使用） |

**推荐组合**：
- 前端项目（配合打包工具）：`module: "esnext"` + `moduleResolution: "bundler"`
- Node.js CJS 项目：`module: "commonjs"` + `moduleResolution: "node"`
- Node.js ESM 项目：`module: "nodenext"` + `moduleResolution: "nodenext"`（且 `package.json` 需设 `"type": "module"`）

### moduleResolution——模块解析策略

决定 TypeScript 如何找到模块文件。常用值：

| 策略 | 说明 | 需写扩展名 | 支持 exports |
|------|------|-----------|-------------|
| `node` | Node.js CJS 风格解析 | 否 | 否 |
| `bundler` | 为打包工具设计（TS 5.0+） | 否 | 是 |
| `nodenext` | Node.js ESM 严格解析 | 是（`.js`） | 是 |
| `classic` | 已过时，不推荐 | — | — |

`bundler` 是 TS 5.0 引入的，专为 Vite、Webpack、esbuild 等打包环境设计——它支持 `package.json` 中的 `exports` 字段，且不需要显式写扩展名。

```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

### outDir 与 outFile

控制构建产物的输出：

```json
{
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

- **outDir**：指定输出目录，保持源码的目录结构
- **outFile**：将所有输出打包成单个文件（仅在 `module` 为 `None`/`System`/`AMD` 时可用）
- **rootDir**：控制输出目录结构的"起点"。默认由包含的所有 `.ts` 文件的最长公共路径推断

```text
// rootDir 默认为 "src"
src/
├── index.ts       → dist/index.js
├── app.ts         → dist/app.ts
└── utils/
    └── helper.ts  → dist/utils/helper.js
```

### declaration——生成声明文件

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationDir": "./dist/types",
    "declarationMap": true
  }
}
```

- **declaration**：是否生成 `.d.ts` 声明文件
- **declarationDir**：声明文件的输出目录（与 JS 文件分离）
- **declarationMap**：为声明文件也生成 source map，可以从 `.d.ts` 跳回 `.ts` 源码
- **emitDeclarationOnly**：只生成 `.d.ts` 不生成 `.js`（常配合 esbuild/swc 使用）

发布 npm 包时推荐开启 `declaration: true`。

### sourceMap 相关

```json
{
  "compilerOptions": {
    "sourceMap": true,
    "inlineSourceMap": false
  }
}
```

- **sourceMap**：生成独立的 `.js.map` 文件
- **inlineSourceMap**：将 source map 内联到 JS 文件中
- **inlineSources**：将原始 `.ts` 代码嵌入 source map，便于调试时直接查看源码

### 路径别名——paths

配合 `baseUrl` 使用，实现类似 Webpack alias 的路径映射：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

```typescript
// 使用时
import { Button } from "@components/Button";
import { formatDate } from "@utils/date";
```

**关键**：`paths` 仅影响 TypeScript 的类型检查，实际模块解析需要打包工具（Webpack、Vite）也配置对应的 alias，两者必须保持一致。

### resolveJsonModule

开启后可以直接导入 JSON 文件并获得完整的类型推导：

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  }
}
```

```typescript
import settings from "./settings.json";
// settings 的类型被自动推导为 JSON 的实际结构
```

### importHelpers

启用后，TypeScript 的降级辅助函数从 `tslib` 导入而非在每个文件中内联，可显著减少构建产物体积：

```json
{
  "compilerOptions": {
    "importHelpers": true
  }
}
```

```bash
npm install tslib
```

## 类型检查相关配置

这是 TSConfig 中最关键的部分，直接决定项目的类型安全程度。

### strict——总开关

**强烈推荐开启**。`strict: true` 会一次性启用以下全部子规则：

- `alwaysStrict`
- `strictNullChecks`
- `strictBindCallApply`
- `strictFunctionTypes`
- `strictPropertyInitialization`
- `noImplicitAny`
- `noImplicitThis`
- `useUnknownInCatchVariables`

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

如果某一项规则对你当前项目过于严格，可以在 `strict: true` 的同时单独关闭它：

```json
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false
  }
}
```

### strictNullChecks——空值检查

**最重要的单项检查**。关闭时 `null` 和 `undefined` 是任何类型的子类型，开启后它们成为独立类型，只能赋值给自身或 `any`/`unknown`：

```typescript
// strictNullChecks: false
const x: string = null;     // ✅ 不报错
const y: number = undefined; // ✅ 不报错

// strictNullChecks: true
const x: string = null;     // ❌
const y: number = undefined; // ❌
```

开启后，可能缺失的值会带上 `| undefined`，迫使你进行空值检查——避免了大量 `cannot read property of undefined` 运行时错误。

### noImplicitAny——禁止隐式 any

当变量或参数类型无法被推导时，默认会回退到 `any`。此规则禁止这种行为，强制显式标注：

```typescript
// noImplicitAny: false
function fn(s) {           // s 隐式 any
  console.log(s.toFixed());
}

// noImplicitAny: true
function fn(s) {           // ❌ 参数"s"隐式具有"any"类型
  console.log(s.toFixed());
}

function fn(s: string) {   // ✅ 显式标注
  console.log(s.toUpperCase());
}
```

### strictFunctionTypes——严格函数参数检查

开启正确的参数逆变检查（详见第19章 协变与逆变）。仅在函数类型以**属性方式**声明时生效：

```typescript
// strictFunctionTypes: true
type Handler = (x: string | number) => void;
const fn = (x: string) => console.log(x);

const h: Handler = fn; // ❌ 参数类型不兼容
```

### strictPropertyInitialization——类属性必须初始化

要求类的所有属性在声明时或构造函数中初始化：

```typescript
// strictPropertyInitialization: true
class User {
  name: string;          // ❌ 没有初始化
  age: number = 0;       // ✅ 声明时初始化
  email: string;

  constructor(email: string) {
    this.email = email;  // ✅ 构造函数中初始化
  }
}
```

如果属性确实会在其他地方初始化（如 `init()` 方法），可以用**确定赋值断言 `!`**：

```typescript
class User {
  name!: string;
  
  init(name: string) {
    this.name = name;
  }
}
```

此规则仅在 `strictNullChecks` 开启时生效。

### strictBindCallApply——bind/call/apply 参数检查

确保 `bind`、`call`、`apply` 的参数类型与原函数一致：

```typescript
function fn(x: string) {
  return parseInt(x);
}

fn.call(undefined, "10");   // ✅
fn.call(undefined, false);  // ❌ 类型"boolean"的参数不能赋给类型"string"的参数
```

### noImplicitThis——禁止隐式 this 类型

在使用 `this` 时必须显式声明其类型或确保上下文已推断：

```typescript
// noImplicitThis: true
function fn() {
  console.log(this.name); // ❌ "this"隐式具有类型"any"
}

function fn(this: { name: string }) {
  console.log(this.name); // ✅ 显式标注 this 类型
}
```

### useUnknownInCatchVariables

将 catch 的 error 类型从 `any` 改为 `unknown`（TS 4.0+）：

```typescript
try {
  throw new Error("Oops");
} catch (err) {
  // err 类型为 unknown，必须先缩小类型
  if (err instanceof Error) {
    console.log(err.message);
  }
}
```

### noUnusedLocals 与 noUnusedParameters

禁止声明了但未使用的局部变量和函数参数：

```typescript
// noUnusedLocals: true
function fn() {
  const x = 1; // ❌ 声明但未使用
}

// noUnusedParameters: true
function fn(x: number) {} // ❌ 参数 x 未使用
```

### noImplicitReturns

确保所有代码路径都有返回值：

```typescript
// noImplicitReturns: true
function fn(flag: boolean): string {
  if (flag) {
    return "yes";
  }
  // ❌ 不是所有路径都返回值
}
```

### noFallthroughCasesInSwitch

禁止 switch 的 case 穿透（无 break/return）：

```typescript
// noFallthroughCasesInSwitch: true
switch (x) {
  case 0:
    console.log("zero");
    // ❌ 缺少 break，会穿透到下一个 case
  case 1:
    console.log("one");
    break;
}
```

### noUncheckedIndexedAccess

为索引访问类型结果自动附加 `| undefined`：

```typescript
// noUncheckedIndexedAccess: true
const arr: string[] = ["a", "b"];
const item = arr[5];  // 类型为 string | undefined，而非 string
```

### exactOptionalPropertyTypes

禁止给可选属性显式赋值 `undefined`：

```typescript
// exactOptionalPropertyTypes: true
interface Config {
  theme?: "dark" | "light";
}

const c: Config = {};
c.theme = "dark";     // ✅
c.theme = undefined;  // ❌ 除非类型中包含 undefined
```

## 工程相关配置

### isolatedModules

当使用 Babel、esbuild、SWC 等**非 tsc 的编译器**处理 TS 文件时，**必须开启**。这些工具独立处理每个文件，无法理解跨文件的类型信息：

```json
{
  "compilerOptions": {
    "isolatedModules": true
  }
}
```

开启后的限制：
- 每个文件必须至少有一个 `import` 或 `export`
- 类型导出必须用 `export type`（而非混合导入）
- 不能使用 `const enum`（因为编译后需要内联值）
- 不能使用 `namespace`（非声明文件中的）

### verbatimModuleSyntax（TS 5.0+）

比 `isolatedModules` 更严格。强制所有类型导入使用 `import type`，编译后这些导入会被完全移除：

```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

```typescript
// 强制要求
import type { User } from "./user";     // ✅ 纯类型
import { createUser } from "./user";    // ✅ 值导入
import { User } from "./user";          // ❌ 虽然是类型但不能省略 type 关键字
```

### composite 与 Project References

`composite` 将项目标记为可被引用的子项目，必须配合 `declaration` 使用。Project References 允许将一个大型项目拆分为多个独立构建的子项目：

```json
// tsconfig.base.json（基础配置）
{
  "compilerOptions": {
    "strict": true,
    "target": "es2018"
  }
}

// app/tsconfig.json（主项目）
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../dist/app"
  },
  "references": [
    { "path": "../utils" },
    { "path": "../core" }
  ]
}

// utils/tsconfig.json（子项目）
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "../dist/utils"
  }
}
```

使用 `tsc --build` 而非 `tsc` 进行构建——它会分析引用关系图，按依赖顺序增量构建：

```bash
tsc --build app       # 构建 app 及其所有子项目
tsc --build --watch   # 监听模式增量构建
```

### incremental——增量编译

将上次编译的信息存入 `.tsbuildinfo` 文件，后续编译只处理变更的文件：

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  }
}
```

通常配合 `tsc --build` 和 `--watch` 使用，或大型项目中配合 CI 缓存。

### esModuleInterop——ESM/CJS 互操作

**强烈推荐始终开启**。解决 ESM 导入 CJS 模块时的兼容问题：

```json
{
  "compilerOptions": {
    "esModuleInterop": true
  }
}
```

为什么需要它？考虑导入 React 的情况：

```typescript
// React (CJS) 的真实导出结构：
// module.exports = { useState, useEffect, memo, ... }

import React from "react"; // 期望 React 是整个模块对象
```

如果没有 `esModuleInterop`，上面的 `import default` 会被编译为 `require("react").default`——但 React 并没有 `module.exports.default`，导致运行时 `React` 为 `undefined`。

开启后，TypeScript 会注入辅助函数 `__importDefault`，在运行时自动处理这种差异。同时也会启用 `allowSyntheticDefaultImports`（类型检查层面允许这种导入）。

此选项在 `module` 为 `node16`/`nodenext` 时默认为 `true`。

### allowJs 与 checkJs

允许在 TS 项目中导入 JS 文件，并对其进行类型检查：

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true
  }
}
```

`checkJs` 相当于对所有 JS 文件自动添加 `// @ts-check` 指令。如果只需要检查部分 JS 文件，可以关闭 `checkJs`，手动在需要检查的 JS 文件头部添加 `// @ts-check`。

### forceConsistentCasingInFileNames

强制文件名大小写一致。Windows 和 macOS 的文件系统不区分大小写，但 Linux 区分。开启此选项可以避免跨平台的文件引用问题。默认 `true`。

## 常用场景推荐配置

### 前端项目（React/Vue + Vite/Webpack）

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2020", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Node.js 后端项目

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["es2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "declaration": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### npm 库包

```json
{
  "compilerOptions": {
    "target": "es2018",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2018"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 仅做类型检查（配合其他构建工具）

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "esnext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

配合 `tsc --noEmit` 使用，只运行类型检查不产出文件。

## 本章小结

- **构建配置**：`target` + `module` + `moduleResolution` 是核心三件套，决定了编译产物和模块解析方式
- **类型检查**：`strict: true` 是一劳永逸的选择；`strictNullChecks` 是最重要的单项规则
- **工程配置**：`isolatedModules` 配合非 tsc 编译器使用；Project References 支持大型项目拆分；`esModuleInterop` 永远开启
- **路径别名**：`paths` 需与打包工具的 alias 保持一致
- 不同项目类型有不同的推荐配置组合，可以直接套用上面的模板进行微调

下一章将介绍装饰器——从实验性装饰器到 TC39 标准装饰器的演进与使用。
