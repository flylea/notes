# 第28章 ESLint 与 TypeScript

ESLint 是现代前端工程中不可或缺的代码质量工具。它的作用可分为两个层面：**风格统一**（缩进、引号、逗号等）和**代码优化**（禁止未使用变量、要求显式返回类型等）。当 TypeScript 与 ESLint 结合时，ESLint 不仅能约束 JS 代码，还能对类型标注、类型断言、泛型使用等 TS 特有语法进行规范。

## 基础配置

### 安装与初始化

最简单的方式是通过 ESLint 的交互式初始化：

```bash
npm init @eslint/config
```

选择 TypeScript 后，ESLint 会自动安装 `@typescript-eslint/parser` 和 `@typescript-eslint/eslint-plugin`。

如果是为已有项目手动添加：

```bash
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### 基本配置文件

```js
// .eslintrc.js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // 禁用 ESLint 基础规则中与 TS 版本冲突的规则
    indent: 'off',
    '@typescript-eslint/indent': ['error', 2],
    quotes: 'off',
    '@typescript-eslint/quotes': ['error', 'single'],
    semi: 'off',
    '@typescript-eslint/semi': ['error'],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
  },
};
```

关键点：ESLint 自带的 `indent`、`quotes`、`semi`、`no-unused-vars` 等规则与 `@typescript-eslint` 版本存在冲突，需要禁用原版并启用 TS 版本。

### .eslintignore

```ini
*.json
*.html
*.svg
*.css
dist
node_modules
```

### NPM Scripts

```json
{
  "scripts": {
    "lint": "eslint src/** --ext .js,.jsx,.ts,.tsx --cache",
    "lint:fix": "npm run lint -- --fix"
  }
}
```

## Prettier 集成

ESLint 负责代码逻辑层面的约束（禁用什么语法、推荐什么写法），Prettier 负责纯粹的格式美化（缩进、引号、换行、逗号）。二者各司其职，配合使用。

```bash
npm install -D prettier eslint-config-prettier
```

`eslint-config-prettier` 的作用是禁用 ESLint 中与 Prettier 冲突的格式相关规则。

**.prettierrc.js**：

```js
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  jsxSingleQuote: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
};
```

ESLint 配置中引入 Prettier：

```js
module.exports = {
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier', // 必须放在最后，确保覆盖
  ],
};
```

组合后的 NPM Scripts：

```json
{
  "scripts": {
    "lint": "eslint src/** --ext .js,.jsx,.ts,.tsx --cache",
    "lint:fix": "npm run lint -- --fix",
    "format": "prettier --check .",
    "format:fix": "prettier --write .",
    "check": "npm run lint && npm run format",
    "check:fix": "npm run lint:fix && npm run format:fix"
  }
}
```

## Git Hooks 自动化

为了确保每次提交的代码都经过格式化，可以引入 Husky + lint-staged：

```bash
npx husky-init && npm install
npm install -D lint-staged
```

在 `.husky/pre-commit` 中添加：

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

在 `package.json` 中配置 lint-staged：

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --cache --fix",
      "prettier --write"
    ],
    "*.{json,md,html,css,scss,less}": [
      "prettier --write"
    ]
  }
}
```

这样每次 `git commit` 时，暂存区的代码文件会自动执行 ESLint 修复 + Prettier 格式化。

## TypeScript ESLint 核心规则推荐

TypeScript ESLint 规则可以分为四类：

1. **基础语法统一**：在 ESLint 原有规则基础上支持 TS 语法（indent, quotes, comma 等）
2. **语法风格约束**：统一类型断言语法、数组类型声明方式、方法签名风格等
3. **类型标注约束**：禁止某些类型的使用、要求显式返回值类型等
4. **能力使用约束**：规范 `import type`、非空断言、`@ts-ignore` 等 TS 特性的使用

### 语法统一类

#### @typescript-eslint/array-type

统一数组类型的声明方式，`T[]` 与 `Array<T>` 只能选其一：

```typescript
// 配置为仅使用 T[]
// ❌
const list: Array<number> = [1, 2, 3];
// ✅
const list: number[] = [1, 2, 3];
```

#### @typescript-eslint/consistent-type-assertions

统一类型断言语法的使用（`as` 或尖括号）。在 `.tsx` 项目中必须使用 `as`，因为尖括号会与 JSX 语法冲突：

```typescript
// ✅ .tsx 中
const foo = bar as Foo;
// ❌ .tsx 中不能使用尖括号
const foo = <Foo>bar;
```

#### @typescript-eslint/consistent-type-definitions

统一对象类型的声明方式（`interface` 或 `type`）。推荐做法：**结构体用 `interface`，联合类型/工具类型/函数类型用 `type`**：

```typescript
// 对象结构 → interface
interface User {
  name: string;
  age: number;
}

// 联合类型、映射类型、函数类型 → type
type Status = 'active' | 'inactive';
type PartialUser = Partial<User>;
type Handler = (event: Event) => void;
```

配合 `naming-convention` 可以要求接口名以 `I` 开头，一目了然地辨认接口和类型别名：

```js
{
  "@typescript-eslint/naming-convention": [
    "error",
    {
      "selector": "interface",
      "format": ["PascalCase"],
      "custom": {
        "regex": "^I[A-Z]",
        "match": false
      }
    }
  ]
}
```

#### @typescript-eslint/consistent-type-imports

强制使用 `import type` 进行纯类型导入。这能带来两个好处：类型导入与值导入在编译后会被完全擦除，避免循环依赖问题；在编辑器中可以一眼区分类型导入和值导入：

```typescript
// ✅
import { useEffect } from 'react';
import type { ChangeEvent, ReactNode } from 'react';

// ❌ 类型和值混在一起
import { useEffect, ChangeEvent, ReactNode } from 'react';
```

配合 `consistent-type-exports` 约束类型导出同样使用 `export type`。

#### @typescript-eslint/prefer-for-of

当 for 循环的索引仅用于访问数组成员时，要求使用 `for...of`：

```typescript
// ❌
for (let i = 0; i < arr.length; i++) {
  console.log(arr[i]);
}

// ✅
for (const item of arr) {
  console.log(item);
}
```

#### @typescript-eslint/prefer-nullish-coalescing & prefer-optional-chain

要求使用 `??` 替代 `||`，使用 `?.` 替代 `a && a.b`：

```typescript
// ❌ 空字符串和 0 会被误判为 falsy
const name = user.name || 'Anonymous';
const city = user && user.address && user.address.city;

// ✅ 只有 null/undefined 才会触发
const name = user.name ?? 'Anonymous';
const city = user?.address?.city;
```

### 类型标注约束类

#### @typescript-eslint/no-explicit-any

禁止显式使用 `any`。这是一条 controversial 的规则——彻底消除 `any` 成本极高，建议设为 `warn` 级别作为渐进式目标。配合 tsconfig 的 `noImplicitAny` 来消除隐式 any 是更务实的做法。

#### @typescript-eslint/ban-types

禁止将特定类型用作标注，推荐配置：

```js
{
  "@typescript-eslint/ban-types": ["error", {
    "types": {
      "{}": { "message": "使用 Record<string, unknown> 代替" },
      "Function": { "message": "使用具体的函数签名，如 (arg: string) => void" },
      "object": { "message": "使用 Record<string, unknown> 代替" }
    }
  }]
}
```

- `{}`：空对象是万恶之源，"类型 `{}` 上不存在属性"会让使用者寸步难行
- `Function`：丢失了参数和返回值的全部类型信息
- `object`：实际上表示所有非原始类型，但大多数人误以为是"任意对象"

#### @typescript-eslint/no-empty-interface

禁止空的 `interface` 声明（单继承情况除外）。没有父类型的空接口实际上等于 `{}`。

```typescript
// ❌
interface Empty {}

// ✅ 有继承意图的占位
interface User extends BaseUser {}
```

#### @typescript-eslint/no-inferrable-types

禁止对可从初始值推导的类型做冗余标注：

```typescript
// ❌ 类型标注与推导结果完全一致，纯属多余
const name: string = 'Alice';
const count: number = 42;

// ✅ 类型标注提供额外信息时才需要
const timestamp: number = Date.now();
// 函数参数和类属性无初始值时仍需标注
function greet(name: string) {}
```

#### @typescript-eslint/explicit-module-boundary-types

要求导出的函数和类方法显式标注返回值类型：

```typescript
// ✅
export function fetchUser(id: string): Promise<User> { /* ... */ }

// ❌ 依赖推导——调用方需要 hover 才能看到返回类型
export function fetchUser(id: string) { /* ... */ }
```

显式标注返回值有两个好处：调用方无需查看实现即知返回值类型；编译器会在实现与标注不一致时立即报错，起到"类型断言"的作用。

### 能力使用约束类

#### @typescript-eslint/ban-ts-comment & prefer-ts-expect-error

禁用 `@ts-ignore`，或要求在提供说明的情况下使用。推荐使用 `@ts-expect-error` 替代 `@ts-ignore`：

```typescript
// ❌ 永远不报错——即使下一行没有错误也看不出来
// @ts-ignore
const x = calculate(1, 2);

// ✅ 如果下一行实际没有错误，TS 会报"Unused @ts-expect-error"
// @ts-expect-error 此处类型定义与运行时行为有差异，暂时跳过
const x = calculate(1, 2);
```

`@ts-ignore` 是无条件跳过，掩盖了可能已经不存在的错误。`@ts-expect-error` 在错误被修复后会自己报错提醒你删除它。

#### @typescript-eslint/prefer-as-const

要求使用 `as const` 而非 `<const>` 进行常量断言：

```typescript
// ✅
const colors = ['red', 'green', 'blue'] as const;
// ❌
const colors = <const>['red', 'green', 'blue'];
```

#### @typescript-eslint/no-non-null-asserted-optional-chain

禁止非空断言与可选链同时使用——这两种操作语义矛盾：

```typescript
// ❌ 到底能不能为 null？
const x = foo?.bar!;
```

#### @typescript-eslint/no-unnecessary-type-assertion

禁止与实际类型一致的类型断言：

```typescript
// ❌ 多此一举
const foo = 'hello' as string;
```

#### @typescript-eslint/switch-exhaustiveness-check

要求 switch 语句覆盖联合类型的所有分支：

```typescript
type Action = 'create' | 'update' | 'delete';

// ❌ 缺少 'delete' 分支
function handleAction(action: Action) {
  switch (action) {
    case 'create': return create();
    case 'update': return update();
  }
}
```

配合 TypeScript 的 `never` 类型做运行时穷尽检查：

```typescript
function handleAction(action: Action) {
  switch (action) {
    case 'create': return create();
    case 'update': return update();
    case 'delete': return remove();
    default: {
      const _exhausted: never = action;
      throw new Error(`未处理的 action: ${action}`);
    }
  }
}
```

#### @typescript-eslint/method-signature-style

约束方法签名的声明方式。推荐使用 property 方式而非 method 方式：

```typescript
// ✅ property 方式——享受 strictFunctionTypes 的逆变检查
interface Handler {
  onClick: (event: MouseEvent) => void;
}

// ❌ method 方式——参数类型检查较宽松（双变）
interface Handler {
  onClick(event: MouseEvent): void;
}
```

原因在于 `strictFunctionTypes` 配置下，property 方式定义的函数类型会经历更严格的逆变检查，能捕获更多潜在的类型错误。

#### @typescript-eslint/prefer-reduce-type-parameter

要求 `Array.reduce` 显式传入泛型参数，避免依赖推导导致的 `never[]` 错误：

```typescript
// ❌ prev 被推导为 never[]，因为 [] 没有类型信息
const result = arr.reduce((prev, curr) => [...prev, curr], []);

// ✅ 显式指定泛型
const result = arr.reduce<number[]>((prev, curr) => [...prev, curr], []);
```

#### @typescript-eslint/restrict-template-expressions

限制模板字符串插槽中可使用的类型，推荐配置只允许字符串和数字：

```typescript
// ❌ 对象会被转成 '[object Object]'，数组被转成 '1,2,3'
const msg = `User: ${userObj}`;
const list = `Items: ${[1, 2, 3]}`;

// ✅ 显式转换
const msg = `User: ${JSON.stringify(userObj)}`;
const list = `Items: ${[1, 2, 3].join(', ')}`;
```

#### @typescript-eslint/no-unnecessary-boolean-literal-compare

禁止对布尔类型变量做 `=== true` / `=== false` 比较：

```typescript
// ❌ TS 项目中，布尔变量就是布尔类型
if (isValid === true) {}

// ✅
if (isValid) {}
```

## 完整配置示例

```js
// .eslintrc.js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    // 类型标注
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'warn',
    '@typescript-eslint/no-inferrable-types': 'error',

    // 语法统一
    '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

    // 能力约束
    '@typescript-eslint/ban-ts-comment': ['error', {
      'ts-ignore': 'allow-with-description',
    }],
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/restrict-template-expressions': ['error', {
      allowNumber: true,
      allowBoolean: false,
      allowAny: false,
      allowNullish: false,
    }],
  },
};
```

注意 `plugin:@typescript-eslint/recommended-requiring-type-checking` 比 `recommended` 更严格，它需要 `parserOptions.project` 配置，因为有些规则（如 `switch-exhaustiveness-check`）依赖完整的类型信息。

## 本章小结

- **ESLint + TypeScript**：通过 `@typescript-eslint/parser` 和 `@typescript-eslint/eslint-plugin` 实现，需禁用冲突的基础规则
- **Prettier 配合**：ESLint 管逻辑、Prettier 管格式，通过 `eslint-config-prettier` 消除冲突
- **Git Hooks 自动化**：Husky + lint-staged 确保每次提交前代码都经过格式化和检查
- **核心规则**：语法统一类（`array-type`、`consistent-type-imports`、`method-signature-style`）、类型约束类（`ban-types`、`no-explicit-any`、`explicit-module-boundary-types`）、能力约束类（`prefer-ts-expect-error`、`switch-exhaustiveness-check`、`restrict-template-expressions`）
- **渐进式采用**：不建议一次性开启所有严格规则，先引入基础规则集，再根据团队情况逐步提升约束

下一章将介绍 TypeScript 生态中常用的工具库和辅助工具。
