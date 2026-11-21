# 第 36 章 从 JavaScript 迁移

接手一个几万行的 JavaScript 项目，直接打开 `strict`，报错能堆到几千条。迁移要按顺序走，官方在 [从 JavaScript 迁移](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html) 里给了同样的步骤：先让 tsc 读 JS，再用 JSDoc 补类型，最后一项一项开严格检查。这一章给每一步的开关、报错和卡点。

先开 `allowJs` 和 `checkJs`，用 JSDoc 补类型，不用改文件后缀。跑通后再逐文件改 `.ts`。严格开关最后加，一次一项。

一句话：`.js` 文件不会被区别对待，`checkJs` 打开后它和 `.ts` 走同一套检查，JSDoc 就是写在注释里的类型标注。同一段 `add(a, b)`，没有 JSDoc 时参数是 any，报 TS7006；补上 `@param {number} a` 之后，调用处传 `"3"` 报 TS2345。失效处：注释能表达的类型有限，`@param` 写不出泛型约束，`@typedef` 只能描述形状。

## 三个开关

`allowJs` 让 tsc 读 `.js`。`checkJs` 让 tsc 检查 `.js`。`// @ts-check` 是单文件开关，和 `checkJs` 独立。

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "module": "nodenext",
    "moduleResolution": "nodenext"
  },
  "include": ["src"]
}
```

只有 `allowJs` 时，JS 参与编译，不做类型检查。把 `checkJs` 关掉，下面这段不报错：

```js
/** @param {number} count */
function repeat(count) {
  return "x".repeat(count);
}

repeat("3");
```

加上 `--checkJs` 才报。输出是 `src/repeat.js(7,8): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.`

`// @ts-check` 写在文件第一行，只检查这个文件。项目配置可以关 `checkJs`，单个文件照样检查，报的还是同一个 `TS2345`：

```js
// @ts-check
/** @param {number} count */
function repeat(count) {
  return "x".repeat(count);
}

repeat("3");
```

`// @ts-nocheck` 反过来，单文件关检查。迁移期过渡用，别留在仓库里。

## 用 JSDoc 写类型

JS 里的类型写在注释里。常用标签有五个（完整列表看 [JSDoc 支持的类型](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)）：`@param`、`@returns`、`@typedef`、`@type`、`@satisfies`。

```js
// @ts-check
/** @typedef {{ id: string, title: string, done: boolean }} Task */

/**
 * @param {Task[]} tasks
 * @param {string} query
 * @returns {Task[]}
 */
function search(tasks, query) {
  return tasks.filter((task) => task.title.includes(query));
}

/** @type {Task[]} */
const queue = [{ id: "a", title: "Ship", done: false }];

console.log(search(queue, "Shi").length);
```

回调参数不用单独标注。`@param {Task[]}` 写好后，`filter` 里的 `task` 自动推成 `Task`。

`@import` 从别的文件引类型，替代 `import()` 注释：

```js
// @ts-check

/** @import { Task } from "./tasks" */

/** @param {Task[]} tasks */
function countOpen(tasks) {
  return tasks.filter((task) => !task.done).length;
}

console.log(countOpen([]));
```

`@satisfies` 校验值满足某个类型，同时保留字面量推断：

```js
// @ts-check
const limits = /** @satisfies {Record<string, number>} */ ({
  retries: 3,
  timeout: 1000,
});

console.log(limits.retries);
```

`@overload` 给同一个函数写多个签名。实现签名放最后，参数类型要能覆盖前面所有重载：

```js
// @ts-check

/**
 * @overload
 * @param {string} value
 * @returns {string}
 */
/**
 * @overload
 * @param {number} value
 * @returns {number}
 */
/**
 * @param {string | number} value
 * @returns {string | number}
 */
function identity(value) {
  return value;
}

console.log(identity("a"), identity(1));
```

`@type` 写错会按类型检查报错。下面这行报 `TS2322: Type 'string' is not assignable to type 'number'`：

```js
// @ts-check
/** @type {number} */
const port = "8080";
```

`@type` 是断言，不是转换。真要把字符串转成数字，写 `Number("8080")`，再交给 `@type {number}`。

### checkJs 只是开关，检查器没换

`.js` 文件以 SourceFile 的身份进入 program，由 `allowJs` 决定。JS 里没有类型标注，检查前要先推断：参数没有标注，调用点又不在同文件，只能推成 `any`；`noImplicitAny` 打开后这一步就暴露成 TS7006 或 TS7031。这条规则不专属 JS，`.ts` 里把参数留空、又没有上下文，报的是同一组错误码。

JSDoc 在解析阶段被读成类型节点，进入检查器后和 `.ts` 的标注是同一类输入。所以 `@param` 能反向推断函数内部，`@type` 能约束初始化表达式，引用不存在的类型会像未声明类型一样报 TS2304。迁移时同一个错误码在 `.js` 与 `.ts` 里都出现，不必怀疑配置，规则本来就共用。

两个开关分工不同：`allowJs` 管文件进不进 program、能不能被 import；`checkJs` 管进 program 之后要不要报错。`// @ts-check` 是文件级的同类开关，项目关掉 `checkJs`，单个文件照样检查。

为什么不反过来，先检查再补类型：几万行 JS 里绝大多数没有标注，全量检查的结果是几千条无法定位的报错。开关分层的作用是让每一步只面对一类错误。

JSDoc 与 d.ts 分工不同：JSDoc 跟着实现走，适合还在改的文件；d.ts 单独描述模块的形状，适合不打算改的第三方包，或者要发布出去的库。同一个类型两处都写就有了两份真相，迁移期只留一处；给包补类型时优先装 `@types/*`，找不到再自己写。

还有一处容易混：`// @ts-check` 与 `checkJs` 都只影响检查，不影响 emit。关掉 `checkJs` 之后 `.js` 仍会被复制或转换到 outDir，报错消失不等于文件没进构建。

`checkJs` 的默认值与作用范围见 [tsconfig 参考](https://www.typescriptlang.org/tsconfig#checkJs)。

### 迁移期最常见的三个报错

```js
// @ts-check
export function pick([first, second]) { return first; }

/** @type {{ url: string, timeout: number }} */
export const query = { url: "/api" };

/** @param {Missing} task */
export function finish(task) { return task; }
```

tsc 7.0.2 的输出（`--allowJs --checkJs --strict`）：

```text
src/pick.js(2,23): error TS7031: Binding element 'first' implicitly has an 'any' type.
src/pick.js(2,30): error TS7031: Binding element 'second' implicitly has an 'any' type.
src/pick.js(5,14): error TS2741: Property 'timeout' is missing in type '{ url: string; }' but required in type '{ url: string; timeout: number; }'.
src/pick.js(7,13): error TS2304: Cannot find name 'Missing'.
```

TS7031 是解构出的名字没有类型，改法是给整个参数写 `@param {[string, string]} pair`，逐个标注也行。TS2741 是 JSDoc 声明的对象缺必填字段，改法是补上 `timeout`，或把它改成可选属性。TS2304 是 JSDoc 引用了不存在的类型，改法是补一个 `@typedef`，或从别的文件用 `@import` 引进来。

三条都落在同一个检查点上：JSDoc 写下的类型当作标注，没有标注的地方推成 any，然后照常比较。

## 先给没有类型的包补声明

导入没有声明的包，`TS7016` 会告诉你缺什么：

```ts
import { parse } from "legacy-lib";

export const data = parse("{}");
```

`legacy-lib` 是示例包，单块编译报 `TS2307`。补上后面的声明文件，`TS7016` 才会变成能用的类型。

```bash
error TS7016: Could not find a declaration file for module 'legacy-lib'.
'/app/node_modules/legacy-lib/index.js' implicitly has an 'any' type.
```

先看包里有没有 `types` 字段，再看 `@types/legacy-lib` 是否存在。都没有就自己写：

```ts
// types/legacy-lib.d.ts
declare module "legacy-lib" {
  export interface ParseOptions {
    revive?: boolean;
  }

  export function parse(input: string, options?: ParseOptions): unknown;
}
```

这份声明要存成 `.d.ts`；存成 `.ts` 报 `TS2664`。

这样写的声明不进类型检查器的推断链，改包升级后要手动同步。`include` 记得覆盖 `types` 目录。

## 改后缀与 import 路径

`.js` 改 `.ts` 后，相对导入的写法跟着模块格式走。

CommonJS 项目直接改后缀，`require` 不动。ESM 项目里，源码 import 要写 `.js`：

```ts
// src/main.ts
import { double } from "./util.js";

console.log(double(21));
```

`./util.js` 对应磁盘上的 `util.ts`；单块编译报 `TS2307`，`node16`、`nodenext` 会把它映射回 `.ts`。

`util.js` 实际不存在，存在的是 `util.ts`。TypeScript 把 `.js` 映射回 `.ts`，这是 `module: nodenext` 的规定。Node 运行时也按 `.js` 找文件，编译后才对得上。

写 `.ts` 扩展名反而报错：

```bash
error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.
```

CJS 包混进 ESM 项目，默认导入要开 `esModuleInterop`。`export =` 的包在开启后可以 `import pkg from "pkg"`。不开时用 `import pkg = require("pkg")`，但后者不能和 ESM 输出共存。

## 严格项一项一项开

`strict` 一次打开八项检查。老项目直接开，报错会堆到几千条。按依赖顺序加，每加一项先修完：

| 顺序 | 选项 | 主要报错 |
|---|---|---|
| 1 | `noImplicitAny` | `TS7006` 参数没有类型 |
| 2 | `strictNullChecks` | `TS18048` 值可能是 undefined |
| 3 | `noImplicitThis` | `TS2683` this 没有类型 |
| 4 | `strictFunctionTypes` | `TS2322` 函数参数不兼容 |

第一项，`noImplicitAny`：

```ts
export function add(a, b) {
  return a + b;
}
```

报 `error TS7006: Parameter 'a' implicitly has an 'any' type.`，`b` 同样。

补参数类型：

```ts
export function add(a: number, b: number): number {
  return a + b;
}
```

第二项，`strictNullChecks`：

```ts
interface Settings {
  endpoint?: string;
}

export function host(settings: Settings): number {
  return settings.endpoint.length;
}
```

报 `error TS18048: 'settings.endpoint' is possibly 'undefined'.`

先判空再取值：

```ts
export function host(settings: { endpoint?: string }): string {
  if (settings.endpoint === undefined) {
    return "localhost";
  }
  return settings.endpoint;
}
```

第三项，`noImplicitThis`。函数里的 `this` 没有类型就报：

```ts
export function increment() {
  this.count += 1;
}
```

报 `error TS2683: 'this' implicitly has type 'any' because it does not have a type annotation.`

把函数挂到对象上，`this` 就有类型：

```ts
const counter = {
  count: 0,
  increment(): void {
    this.count += 1;
  },
};
```

第四项，`strictFunctionTypes`。参数类型是逆变位置，收窄会报错：

```ts
type Wide = (event: Event) => void;

const narrow: Wide = (event: MouseEvent) => {
  console.log(event.clientX);
};
```

报 `error TS2322: Type '(event: MouseEvent) => void' is not assignable to type 'Wide'.`

在回调里先用 `event.type` 判断，或把参数写宽：

```ts
type Wide = (event: Event) => void;

const handleEvent: Wide = (event) => {
  console.log(event.type);
};
```

四项加完，再打开 `strict: true`。剩下的 `strictBindCallApply`、`strictPropertyInitialization`、`useUnknownInCatchVariables`、`alwaysStrict` 一般不会一次爆出大量错误。

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true
  }
}
```

`noUncheckedIndexedAccess` 不在 `strict` 里。它让数组下标和对象索引访问都带上 `undefined`，按需开。

## 常见卡点

`any` 会沿调用链扩散。一个 `JSON.parse` 的结果直接赋值，下游全是 `any`：

```ts
export function firstId(text: string): string {
  const raw = JSON.parse(text);
  return raw.items[0].id;
}
```

把边界收窄成 `unknown`，再逐层校验：

```ts
export function readItems(text: string): string[] {
  const data: unknown = JSON.parse(text);
  if (typeof data !== "object" || data === null || !("items" in data)) {
    return [];
  }
  const items = (data as { items: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter((item): item is string => typeof item === "string");
}
```

`catch` 的变量在 `strict` 下是 `unknown`，不能直接读 `.message`：

```ts
export function message(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
```

ESM 文件里没有 `__dirname`。用 `import.meta.dirname`（Node 20.11 起），或 `fileURLToPath(import.meta.url)`。CJS 文件里两者都不能用。

## 清 @ts-ignore

迁移期的 `@ts-ignore` 要列清单。换成 `@ts-expect-error`，它会在断言失效时报错，防止注释永久留着：

```ts
// @ts-expect-error 上游类型漏了 size 字段
export const size: number = "text";
```

这行能过。把下一行改成真没错误的代码，`@ts-expect-error` 立刻报 `TS2578`：

```ts
// @ts-expect-error 这行其实没有错误
export const size: number = 1;
```

```bash
error TS2578: Unused '@ts-expect-error' directive.
```

查一遍还剩多少：

```bash
grep -rn "@ts-ignore" src | wc -l
grep -rn "@ts-expect-error" src
```

`skipLibCheck` 只跳过 `.d.ts` 的检查，不跳过自己的代码。迁移期开着能减少噪音，收尾时再评估。它掩盖不了业务代码里的类型错误。

## 收尾检查

```bash
npx tsc --noEmit
npx tsc --noEmit --allowJs --checkJs
grep -rn "@ts-nocheck" src
```

第一条查全部源码。第二条把剩余 JS 也检查一遍。第三条确认没有遗留的关闭注释。

`checkJs` 只在还有 JS 文件时需要。全部改成 `.ts` 后，删掉 `allowJs` 和 `checkJs`，让未登记的 JS 文件直接报错。

## 用不上的时候

### 项目已经冻结或只剩维护

改动频率低、只剩零星修复的项目，迁移的收益是编辑器提示，成本是几百个文件的改动和一轮回归。一次性脚本、即将下线的系统同样如此。这类项目开 `allowJs` 和 `checkJs` 就够，不必改后缀。

### CI 里没有类型检查这一关

迁移靠 `tsc --noEmit` 守住结果。没有这一关，`@ts-ignore` 和 `any` 会慢慢堆回来，一年后严格项又要重开一遍。先让 `tsc --noEmit` 进 CI，再迁代码；顺序反了，成果守不住。

### 依赖普遍没有类型且补不了

关键依赖只发 JS、社区没有 `@types`、内部又没人手写声明时，迁移后这些调用点全是 `any`，严格检查绕不过去。先把声明补上，或者把这些边界隔离到一个文件里，再整体迁移。

## 参考

- [TypeScript 手册：从 JavaScript 迁移](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html)：`allowJs`、`checkJs` 与分步迁移的官方顺序。
- [JSDoc 支持的类型](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)：`@param`、`@typedef`、`@type` 等标签能表达哪些类型。
- [tsconfig 参考](https://www.typescriptlang.org/tsconfig)：`checkJs`、`allowJs` 的默认值与影响范围。
