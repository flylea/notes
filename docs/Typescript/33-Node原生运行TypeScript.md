# 第 33 章 Node 原生运行 TypeScript

本地 `node app.ts` 跑得好好的脚本，换到 CI 的 Node 22 上就报 `Unknown file extension ".ts"`。同一个文件能不能跑，取决于 Node 版本和语法写法。这一章讲版本节点、能剥离与不能剥离的语法边界，以及 tsconfig 为什么不起作用。

Node 22.18 和 24.3 之后，`node app.ts` 可以直接跑。（见 [Node.js 的类型剥离文档](https://nodejs.org/api/typescript.html)）跑的是剥掉类型注解的 JavaScript，不是完整 TypeScript。能不能跑由语法决定，不由版本决定。

`node app.ts` 只删类型，不生成新代码，所以它不需要 source map。`enum`、参数属性这类语法要生成新代码，它没有生成器，只能报错。反过来，`tsx` 带完整编译器，会生成代码，也就要 source map。能不能直接跑，看删掉类型后剩下的是不是合法 JavaScript。

## 版本节点

| Node 版本 | 变化 |
|---|---|
| 22.6.0 | 加入 type stripping，需要 `--experimental-strip-types` |
| 22.7.0 | 加入 `--experimental-transform-types`，能处理 `enum` 和 `namespace` |
| 23.6.0 / 22.18.0 | 默认开启，不用带 flag |
| 24.3.0 / 22.18.0 | 去掉 experimental 警告 |
| 25.2.0 / 24.12.0 | 标记为 Stable |
| 26.0.0 | 移除 `--experimental-transform-types` |

26 里只剩一个开关：`--no-strip-types`，用来关掉剥离。带旧 flag 会直接报错：

```bash
$ node --experimental-transform-types app.ts
node: bad option: --experimental-transform-types
```

网上很多文章还在教 `--experimental-transform-types`，在 26 上跑不通。

## 三种跑法

| 命令 | 读 tsconfig | 类型检查 | 支持的语法 | source map |
|---|---|---|---|---|
| `node app.ts` | 否 | 否 | 只有可擦除语法 | 无 |
| `node --import=tsx app.ts` | 是 | 否 | 全部 | 有 |
| `tsc && node dist/app.js` | 是 | 是 | 全部 | 有 |

内置剥离适合跑脚本、写小工具、临时验证一段代码。它启动最快，没有额外依赖。

`tsx` 适合日常开发。它读 tsconfig，处理 `enum`、装饰器、`.tsx`，抛错带原始行号。

`tsc` 产物适合 CI 和发布。三条路里只有它会做类型检查。

```bash
# 本机验证，Node 26.13.1
$ node ok.ts
hi
```

## 能剥离和不能剥离

判断标准一句话：这段语法会不会生成运行时代码。不生成就能删掉，生成就会报错。

### 为什么只删不转译

剥离只做删除。类型标注换成空白，`import type` 整句删掉，其余代码原样保留。输出里没有新增语句，行列号不变，所以不需要 source map。Node 文档的原话是 replace TypeScript syntax with whitespace，并注明 no type checking is performed。

需要生成代码的语法走不了这条路。`enum Mode { On, Off }` 要变成 `var Mode; (function (Mode) {...})(Mode || (Mode = {}))`，这是新语句，作用域和行号都要重排。参数属性要往构造函数里插赋值，带值的 `namespace` 要包一层闭包，装饰器要展开成函数调用。这些变换都要完整的类型信息和配置。

反过来做不成。要支持 `enum`，Node 就得内置一个转译器，还要读 `tsconfig.json`，处理 `paths` 和模块格式。官方把这类需求推给第三方包，`tsx` 就是这条路线。Node 选了最薄的一层：能直接执行就不多做事。

版本变化也说明了这条路的取舍。22.7 加过 `--experimental-transform-types`，把转译交给 Node 自己做，26.0 又把它移除。文档给出的方向是：要完整支持全部语法，装第三方包；内置只保留最好实现、最不容易出错的部分。转译器放进运行时意味着要跟 TypeScript 的语法演进同步，还要处理 `tsconfig` 语义，维护成本落到了 Node 身上。

判断标准可以再收紧：出现 `enum`、带值的 `namespace`、`constructor(public x: string)`、`import x = require()`，这四处就是它拒绝的地方。

可以剥离：

```ts
type User = { name: string };
interface Point { x: number; y: number }

function add(a: number, b: number): number {
  return a + b;
}

class A {
  private x = 1;
  declare y: string;
}

const v = { a: 1 } as const;
console.log(add(1, 2), v);
```

不能剥离的六种，报错原文都在下面。

`enum` 会生成双向映射对象，属于运行时代码：

```ts
enum Color { Red, Green }
console.log(Color.Red);
```

```text
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
```

带值的 `namespace` 同理，它会被编译成立即执行函数：

```ts
namespace N { export const x = 1; }
console.log(N.x);
```

```text
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript namespace declaration is not supported in strip-only mode
```

构造函数参数属性会在构造函数里生成赋值语句：

```ts
class P { constructor(public name: string) {} }
```

```text
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property is not supported in strip-only mode
```

`import x = require()` 会被编译成 `require` 调用：

```ts
import fs = require("node:fs");
```

按 ESM 编译这块报 `TS1202`，`import =` 只能用于 CommonJS 输出；缺 Node 类型时报 `TS2591`。

```text
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript import equals declaration is not supported in strip-only mode
```

装饰器要生成 `__decorate` 帮助函数：

```ts
class C { @dec method() {} }
```

`dec` 没定义，单块编译报 `TS2304: Cannot find name 'dec'`。装饰器还要编译器生成 `__decorate`，Node 的剥离模式不做这件事。

```text
SyntaxError: Invalid or unexpected token
```

`.tsx` 需要 JSX 转换，Node 不做：

```text
SyntaxError: Unexpected token '<'
```

汇总成一张表：

| 语法 | 能否剥离 | 原因 | 替代写法 |
|---|---|---|---|
| `enum` | 否 | 生成双向映射对象 | `as const` 对象加联合类型 |
| 带值的 `namespace` | 否 | 编译成立即执行函数 | 拆成独立模块 |
| 构造函数参数属性 | 否 | 构造函数里生成赋值 | 显式声明字段再赋值 |
| `import x = require()` | 否 | 生成 `require` 调用 | `import x from` |
| 装饰器 | 否 | 生成 `__decorate` | 用 `tsx` 或 `tsc` |
| `.tsx` | 否 | 需要 JSX 转换 | 用 `tsx` 或打包器 |
| 类型注解、`interface`、`type` | 是 | 只存在于类型层 | 直接写 |
| `as const`、`satisfies`、泛型 | 是 | 只存在于类型层 | 直接写 |

只有类型没有值的 `namespace` 可以剥离。它不生成代码，只是类型命名空间。

`enum` 的替代写法：

```ts
const Color = { Red: 0, Green: 1 } as const;
type Color = (typeof Color)[keyof typeof Color];

function paint(c: Color): string {
  return c === Color.Red ? "red" : "green";
}

console.log(paint(Color.Red));
```

## 两个高频报错

`erasableSyntaxOnly` 和 `verbatimModuleSyntax` 把 Node 运行时的两类失败提前到编译期。下面三段代码放在同一目录，每段开头的注释是文件名，存盘时不要写进文件：

```ts
// panel.ts
enum Mode {
  On,
  Off,
}

class Panel {
  constructor(public title: string) {}
}

export const mode: Mode = Mode.On;

// types.ts
export interface Profile {
  name: string;
}

export const version = 1;

// app.ts
import { Profile, version } from "./types";

export const label = (p: Profile): string => `${p.name}@${version}`;
```

两个开关一起打开，跑一次 `tsc`：

```bash
$ tsc --noEmit --erasableSyntaxOnly --verbatimModuleSyntax panel.ts app.ts types.ts
app.ts(1,10): error TS1484: 'Profile' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
panel.ts(1,6): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
panel.ts(7,15): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
```

`panel.ts` 的两条 TS1294 分别指向 `enum` 和参数属性，这两处都要生成代码。`app.ts` 的 TS1484 指向纯类型导入，补一个 `import type { Profile }` 就消掉。

同一份 `panel.ts` 交给 `node` 跑，报的不是类型错误，是解析失败：`SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode`。编译器管的是写法能不能过检查，Node 管的是能不能解析，两边的失败位置不一样。

两种失败不能互相代替。编译期全绿，运行时仍可能因为漏写 `type` 报错；`node` 能跑，也不代表类型对。前者说明语法可擦除，后者要 `tsc --noEmit` 才回答得了。

## 纯类型导入必须写 type

剥离模式只删类型注解，不做导入消除。`import { User }` 即使 `User` 是接口，也会保留成运行时导入。

```ts
// types.ts
export interface User { name: string }
export const version = 1;

// app.ts
import { User, version } from "./types.ts";
const u: User = { name: "a" };
console.log(u, version);
```

这一块把 `types.ts` 与 `app.ts` 放在一起：同文件里 `version` 既有导出又有本地声明，报 `TS2395`；`./types.ts` 单独编译报 `TS2307`。

```text
SyntaxError: The requested module './types.ts' does not provide an export named 'User'
```

改成 `import type` 就正常：

```ts
import type { User } from "./types.ts";
import { version } from "./types.ts";

const u: User = { name: "a" };
console.log(u, version);
```

`./types.ts` 就是上一块里的文件；单块编译报 `TS2307`，补上文件后通过。

`verbatimModuleSyntax` 会让 `tsc` 也按这个规则报错，提前发现而不是等运行时。开启方式：

```json
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

开完之后，只导入类型的地方必须写 `import type`，否则 `tsc` 报错。这条规则同时适用于 ESM 和 CJS 输出。

## tsconfig 被完全忽略

`node app.ts` 不读 `tsconfig.json`。这带来四个后果。（见 [tsconfig 参考](https://www.typescriptlang.org/tsconfig)）

第一，`paths` 不生效。`@/utils` 这类别名解析不到：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/src/utils' imported from /app.ts
```

用 `package.json` 的 `imports` 字段代替，导入路径写成 `#` 开头：

```json
{
  "type": "module",
  "imports": {
    "#utils/*": "./src/*.ts"
  }
}
```

```ts
import { add } from "#utils/math";
console.log(add(1, 2));
```

`#utils/math` 由 `package.json` 的 `imports` 映射到 `./src/math.ts`；单块编译报 `TS2307`。

`#utils/math` 映射到 `./src/math.ts`，运行正常。注意映射值要带 `.ts`，导入路径不要带。

第二，导入必须写扩展名。`import "./math"` 报 `ERR_MODULE_NOT_FOUND`：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/src/math' imported from /app.ts
```

写成 `import "./math.ts"`。漏写扩展名是迁移时最常见的错误。

第三，`node_modules` 里的 `.ts` 不处理。装一个只提供 TS 源码的包，导入时报：

```text
Error [ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING]: Stripping types is currently unsupported for files under node_modules
```

发布包时要出 `.js` 加 `.d.ts`，不能只发 `.ts`。

第四，`--lib` 之类的编译选项不生效，`Promise.withResolvers` 之类的新增 API 是否可用只取决于 Node 版本。

官方推荐的 tsconfig 是这六项：

```json
{
  "compilerOptions": {
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

- `noEmit`：`tsc` 只检查不产出，运行交给 Node。
- `target: esnext`：不降级语法，Node 26 认最新的 JS。
- `module: nodenext`：按 Node 的模块解析规则检查。
- `rewriteRelativeImportExtensions`：源码写 `./x.ts`，`tsc` 产物自动改成 `./x.js`。
- `erasableSyntaxOnly`：把 `enum`、参数属性这类不可剥离的语法提前报出来。
- `verbatimModuleSyntax`：强制区分类型导入和值导入。

`rewriteRelativeImportExtensions` 值得单独说。没有它时，源码写 `.ts` 会在 `tsc` 产物里留下 `.ts`，运行时找不到。开启后两边都能跑：

```ts
// 源码 error.ts
import { add } from "./math.ts";
export const sum = add(1, 2);
```

`./math.ts` 是本节的源文件；单块编译报 `TS2307`。

```js
// 产物 error.js
import { add } from "./math.js";
export const sum = add(1, 2);
```

`erasableSyntaxOnly` 的报错长这样，配合 `enum`：

```text
error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
```

这个开关把运行时才发现的错误提前到编译期。用内置剥离的项目建议一律打开。

## 什么时候不该用内置剥离

四条判断：

- 需要类型检查。内置剥离不做检查，`node app.ts` 不会告诉你参数类型错了。
- 代码里有 `enum`、装饰器、参数属性、`import x = require`。改用 `tsx`，或者先改写法。
- 要发产物。发布需要 `.js` 和 `.d.ts`，这是 `tsc` 的活。
- 依赖 `tsconfig` 的 `paths`、自定义 `lib`、装饰器元数据。这些 Node 都不读。

日常组合：`tsx` 跑开发，`tsc --noEmit` 跑检查，`tsc` 跑发布。内置剥离留给一次性脚本。

## 报错速查

| 报错 | 原因 | 处理 |
|---|---|---|
| `TypeScript enum is not supported in strip-only mode` | 用了 `enum` | 换 `as const` 对象，或改用 `tsx` |
| `TypeScript namespace declaration is not supported` | `namespace` 里有值 | 拆成模块 |
| `TypeScript parameter property is not supported` | 构造函数参数属性 | 显式声明字段 |
| `TypeScript import equals declaration is not supported` | `import x = require()` | 换 `import x from` |
| `does not provide an export named 'X'` | 纯类型未加 `type` | 写 `import type` |
| `Unexpected token '<'` | `.tsx` 文件 | 用 `tsx` 或打包器 |
| `Invalid or unexpected token` | 装饰器 | 用 `tsx` 或 `tsc` |
| `ERR_MODULE_NOT_FOUND` | 缺 `.ts` 扩展名，或 `paths` 失效 | 补扩展名，或用 `#` 子路径 |
| `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` | 依赖包只发了 `.ts` | 换包，或让发布方出 `.d.ts` |
| `bad option: --experimental-transform-types` | Node 26 已移除该 flag | 删掉 flag，或改用 `tsx` |
| `Unknown file extension ".ts"` | 带了 `--no-strip-types` | 去掉该 flag |

## 用不上的时候

### 语法本身跑不了

`enum`、带值的 `namespace`、构造函数参数属性、`import x = require()`、装饰器、`.tsx` 都过不去，报错是 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` 或普通语法错误。这是解析阶段的失败，`tsc --noEmit` 全绿也挡不住。要用这些语法，只能换 `tsx` 或先编译。

### 依赖 tsconfig 的机制全部失效

`paths`、自定义 `lib`、`types`、装饰器元数据，Node 一律不读，因为它根本不解析 `tsconfig.json`。靠别名组织的项目在 `node app.ts` 下会报 `ERR_MODULE_NOT_FOUND`。要么改用 `#` 子路径，要么回到 `tsc` 加 `tsx` 的组合。

### 发布场景和团队工程

包要给别人用，就必须发 `.js` 和 `.d.ts`，`node_modules` 下的 `.ts` 会被拒绝剥离，报 `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`。团队如果把类型检查寄托在 `node` 上，等于没有检查，CI 必须单独跑 `tsc --noEmit`。这两条不满足时，内置剥离只适合一次性脚本。

## 参考

- [Node.js 的类型剥离文档](https://nodejs.org/api/typescript.html)：支持范围、已移除的 flag。
- [tsconfig 参考](https://www.typescriptlang.org/tsconfig)：被忽略的那些选项各自的作用。
- [Node.js ESM 文档](https://nodejs.org/api/esm.html)：import 必须带扩展名的原因。
