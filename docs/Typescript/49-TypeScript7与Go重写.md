# 第 49 章 TypeScript 7 与 Go 重写

2026 年 7 月 8 日发布 TypeScript 7.0，编译器换了语言：原来的实现是 TypeScript 自己写的，7.0 是 Go。

命令行还是 `tsc`，配置还是 `tsconfig.json`，但跑起来是各平台的原生二进制。官方给的数字是全量构建快 8 到 12 倍（[7.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)）。

这一章讲三件事：为什么换成 Go、换完哪些地方不一样、升级时该验证什么。

第 47 章讲的是 5.9 版 JavaScript 实现里的检查器，行号都能在 `checker.ts` 里对上。这一章讲 7.0 的 Go 实现，以及它和 6.0 的边界。

## 先分清：一次移植，不是一次重写

官方在公告里用的词是 port（移植），不是 rewrite（重写）。两者的区别很实际。

重写是照着旧程序的行为重新设计实现，内部结构可以完全不同。移植是尽量保留原来的代码结构和逻辑，一段一段翻译过去，让两个编译器结果一致。

官方原话是：写新代码时“maintaining the structure and logic of the original codebase to keep results consistent and compatible between the two compilers”（[原生移植公告](https://devblogs.microsoft.com/typescript/typescript-native-port/)）。

所以你在 7.0 里看到的类型推断顺序、报错文本、`--checkers` 之外的默认行为，大多不是新设计，是同一个设计的另一份实现。

两个实现各有代号，在读源码、issue 和公告时会遇到：

| 代号 | 指什么 |
|---|---|
| Strada | 原来的 JavaScript 实现，5.x 与 6.x 用它 |
| Corsa | Go 实现，7.0 起用它 |

装 7.0 就是装普通的 `typescript` 包：

```bash
$ npm install -D typescript
$ npx tsc --version
Version 7.0.2
```

预览期用的是另一个包 `@typescript/native-preview`，命令叫 `tsgo`。7.0 RC 之后命令名改回 `tsc`，这个预览包也完成了使命，官方说 nightly 重新走 `typescript@next`。

原来的开发仓库 [`microsoft/typescript-go`](https://github.com/microsoft/typescript-go) 已经归档，说明里写的是"这次原生移植的过程已经完成"。代码并回了 `microsoft/TypeScript`。

## 为什么是 Go

语言选型当时争议很大，官方 FAQ 专门写了一篇（[typescript-go 的 discussions #411](https://github.com/microsoft/typescript-go/discussions/411)）。理由有四条。

第一条是最重要的：两套代码要长期并行维护，所以新实现要尽量像旧实现。

Go 的代码组织方式接近原 TypeScript 代码的风格，翻译过去的改动可以两边对照着改。官方原话是“Idiomatic Go strongly resembles the existing coding patterns of the TypeScript codebase”。换成 Rust 或 C# 这类要求重新思考内存管理与数据结构的语言，更适合从头写，不适合逐段移植。

第二条：Go 既能控制内存布局，又不用手工管理内存。

Go 允许在对象和字段层面安排内存布局，同时不要求整个代码库时刻关心释放。代价是有垃圾回收，但官方判断这个代价在本项目里很小：批处理编完进程就退出，回收器基本不用干活；长期存活的对象（AST 之类）本来就活到进程结束；而且编译器知道哪些时刻适合回收。

第三条：编译器里大量是图遍历。

类型检查要沿着语法树向上走、向下走，节点类型还多态。Go 写这类代码顺手，也不会让代码结构和 JavaScript 版差太远。

第四条是弱项，官方自己写了：Go 和 JavaScript 的进程内互操作不如其他方案。

这条直接决定了 7.0 不带编译器 API。老实现里所有东西都能被外部代码读写，新实现没法在不破坏兼容的前提下维持这种开放度。所以 7.0 只给命令行，7.1 才补一套重新设计的 API。

顺带说清一个常见误解：快不是因为“Go 这个语言快”，也不是社区里说的“用 Rust 重写”。快的主要原因在下一节，官方归为三点：原生代码、共享内存多线程、一批新优化。

## 快多少

官方给了一张构建时间表，口径是默认 `--checkers 4`、`--noEmit`：

| 仓库 | TypeScript 6 | TypeScript 7 | 倍数 |
|---|---|---|---|
| vscode | 125.7s | 10.6s | 11.9x |
| sentry | 139.8s | 15.7s | 8.9x |
| bluesky | 24.3s | 2.8s | 8.7x |
| playwright | 12.8s | 1.47s | 8.7x |
| tldraw | 11.2s | 1.46s | 7.7x |

内存也降了。官方口径是整个构建过程的累计内存，不是峰值：

| 仓库 | TypeScript 6 | TypeScript 7 | 变化 |
|---|---|---|---|
| vscode | 5.2GB | 4.2GB | -18% |
| sentry | 4.9GB | 4.6GB | -6% |
| bluesky | 1.8GB | 1.3GB | -26% |
| playwright | 1.0GB | 0.9GB | -11% |
| tldraw | 0.6GB | 0.5GB | -15% |

编辑器侧的收益更直观。在 VS Code 自己的代码库上，从打开编辑器到看见第一个错误，6.0 要 17.5 秒，7.0 不到 1.3 秒。

这些数字是官方在几个大型开源仓库上跑的，不是你的项目。想知道自己的收益，直接量：

```bash
$ time npx tsc --noEmit
```

小项目上 10 倍的收益可能只是几百毫秒，感受不到。项目越大、编辑器越卡，差别越明显。

## 并行分两层

7.0 把解析、类型检查、输出都并行化了，但这三步的并行方式不一样。

解析和输出基本按文件独立，自动并行，开销小，代码库越大越划算。

类型检查不独立。文件之间共享依赖的类型信息和全局作用域，如果每个检查器完全独立地跑，会重复大量计算，内存也翻倍。可另一头又有顺序要求：从头检查必须按固定顺序检查同一批文件，否则结果可能不同。

官方的做法是固定数量的检查器 worker，每个持有一份自己的世界视图。它们会重复一部分公共工作，但同样的输入文件永远得到同样的划分、同样的结果。

默认 4 个。用 `--checkers` 可以改：

```bash
$ npx tsc --noEmit --checkers 8
```

官方在同样机器上把 `--checkers` 调到 8：

| 仓库 | TypeScript 6 | TypeScript 7（`--checkers 8`） | 倍数 |
|---|---|---|---|
| vscode | 125.7s | 7.51s | 16.7x |
| sentry | 139.8s | 12.08s | 11.6x |
| bluesky | 24.3s | 2.01s | 12.1x |
| playwright | 12.8s | 1.16s | 11x |
| tldraw | 11.2s | 1.06s | 10.6x |

调高的代价是内存。CI 机器核少内存小，把它降到 1 反而更快：

```bash
$ npx tsc --noEmit --checkers 1
```

`--checkers 1` 等于类型检查单线程，重复工作也消失了。

项目引用（monorepo）还有第二层并行，用 `--builders` 控制 `--build` 下同时构建几个项目：

```bash
$ npx tsc -b --checkers 4 --builders 4
```

两个参数是相乘的。上面这条命令最多同时跑 16 个检查器，很容易把内存打满。官方提醒要按机器找平衡点。

改 `--builders` 不改变结果。改 `--checkers` 在极少数情况下会暴露本来就存在的顺序相关问题。团队最好在 CI 里写死一个值，别让不同机器各跑各的。

## 单线程模式

还有一个开关把并行全关掉：

```bash
$ npx tsc --noEmit --singleThreaded
```

它不只把检查器限到 1 个，解析和输出也改单线程。用途有四个：

- 调试编译器本身。
- 公平比较 6.0 和 7.0 的性能。
- 在外部已经并行调度时，避免两层并行互相抢核。
- 资源非常有限的容器里。

对比两个版本的检查结果时，也建议先跑一遍单线程。多线程下极少数顺序相关差异会被掩盖或放大，单线程的结果是确定的。

## watch 模式换了底座

`--watch` 整个重写了。官方在移植文件监视时碰到一个问题：Go 标准库没有文件监视 API，第三方库在稳定性、性能、跨平台、构建集成上各有毛病。

纯轮询方案能用，但在 `node_modules` 很大的项目里开销太高，动态调整轮询频率也压不住。

他们最后选了 VS Code 用了多年的 `@parcel/watcher`，把它从 C++ 移植成 Go，加少量汇编 shim，免得引入整套 C++ 工具链。

结果是 `--watch` 下的重建更快、资源占用更低。`tsc -b` 的增量信息仍写在 `tsconfig.tsbuildinfo` 里，文件名和位置没变。这个文件是编译器的缓存，不是公共接口，跨大版本升级前删掉重建更稳。

## 和 6.0 的兼容承诺

官方的承诺很明确：用 6.0 编译干净、开着 `stableTypeOrdering`、没设 `ignoreDeprecations` 的代码，7.0 应该编译出一致的结果（[7.0 公告的兼容段](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)）。

反过来说，7.0 继承了 6.0 的新默认值和硬报错。这些不是 7.0 新加的规则，是 6.0 就定了，7.0 只是不再给兼容开关。

要记住的几条：

- `strict` 默认 `true`，`module` 默认 `esnext`，`target` 默认当前稳定 ES，`types` 默认 `[]`，`rootDir` 默认 `./`。
- `target: "es5"`、`downlevelIteration`、`moduleResolution: "node"`、`baseUrl`、`module: "amd"` 这些在 7.0 直接报错。
- 命令行传文件路径、而当前目录有 `tsconfig.json` 时，必须加 `--ignoreConfig`，否则报 TS5112。

完整的默认值表、弃用清单和迁移顺序在第 39 章。这一章不重复。

`stableTypeOrdering` 还带来一个副作用：同一个项目反复编译，`.d.ts` 内容逐字节一致。做快照对比、二进制 diff、缓存校验的项目会因此变稳。

## 类型检查里三处有意变化

移植不是逐字节复制，官方留了三处会改变结果的差异。

### 模板字面量按 Unicode code point 切

旧实现按 UTF-16 码元切，emoji 会被切成两半。7.0 按 code point 切。

```typescript
type HeadTail<S> = S extends `${infer Head}${infer Tail}` ? [Head, Tail] : never;

type Result = HeadTail<"😀abc">;
const check: Result = ["😀", "abc"];
```

6.x 下 `Result` 是 `["\ud83d", "\ude00abc"]`，7.0 下是 `["😀", "abc"]`。

这条改动影响那些故意按 UTF-16 计数的类型工具，比如自己写的 `Length`。它们升级后会算出不同的数，需要按码点重写。

### skipLibCheck 下冲突声明的报错位置

6.x 里两个声明冲突时，有时只在其中一个位置报错，另一个被 `skipLibCheck` 压住就静默了。

7.0 改成所有涉及到的位置都报。结果是：以前靠 `skipLibCheck` 完全压住的声明冲突，现在可能从非 `.d.ts` 文件里冒出来。

开了 `skipLibCheck` 的项目升级时要留意这条。它不算隐藏 bug 被修好，只是报错位置变了。

### 关闭 strict 时参数不能随便省

`strict: false` 时，6.x 允许省略类型为 `undefined`、`unknown`、`any` 的参数实参。7.0 不允许了。

`void` 类型的参数仍然可以省，和 strict 开不开无关。

这条只在 `strict: false` 的项目里触发，而且是 JavaScript 或 JSDoc 场景更常见。原因在官方 CHANGES 里写得直接：旧实现在 JavaScript 检查里对这类参数走了另一条规则，7.0 让 JS 和 TS 用同一条规则。

## JavaScript 支持收窄

7.0 重新设计了 JavaScript 文件的检查方式，目标是让 `.js` 和 `.ts` 用同一套规则。代价是删掉了一批只存在于 JavaScript 历史的写法。

| 旧写法 | 7.0 怎么办 |
|---|---|
| `@enum {number}` | 用 `@typedef` 加 `Record<string, T>` |
| `@class` / `@constructor` | 用 `class` 声明 |
| 独立的 `?` 类型 | 用 `any` |
| 后缀 `!` 去空 | 直接写 `T` |
| `@typedef {T} */ Name;` | 名字写进标签：`@typedef {T} Name` |
| Closure 函数类型 `function(string): void` | `(s: string) => void` |
| 构造器函数 + `C.prototype.m` | `class C { m() {} }` |
| 顶层 `this.p = 1` 当 `module.exports` | `exports.p = 1` |
| `module.exports = {}` 和 `module.exports.x = 1` 混写 | 二选一 |

还有几条容易踩的：

- `@param` 最多只作用于一个函数。写在一行里声明多个函数的位置，只认第一个。
- `@typedef` 和 `@callback` 写在类体里会被提升到类外，可能和外部同名声明冲突。
- `@overload` 对箭头函数和函数表达式不生效，要写成带调用签名的 `@type`。
- `.js` 生成的 `.d.ts` 输出有意改了，不再追求和 6.0 逐字节一致。

迁移有 JSDoc 的项目，先跑一次 7.0 的 `tsc --noEmit`，报错会集中在这些模式上。

## API 空窗与 7.1

7.0 不带 API 是这次升级最实际的一道坎。

`typescript-eslint` 8.73.0 装到 7.0.2 上会直接拒绝启动，报 `typescript-eslint does not support TS 7.0.`。`ts-jest`、`ts-node`、部分 ESLint 插件、`dts-bundle-generator` 这类直接 `import ts from "typescript"` 的工具同理。

过渡方案是让 6.0 和 7.0 并存。官方发布了兼容包 `@typescript/typescript6`，提供一个 `tsc6` 命令，并再导出 6.0 的 API：

```json
{
  "devDependencies": {
    "typescript": "npm:@typescript/typescript6@^6.0.2",
    "@typescript/native": "npm:typescript@^7.0.2"
  }
}
```

这样 `typescript` 指向 6.0，工具链读到的 API 是 6.0 的；`@typescript/native` 提供 7.0 的 `tsc`，`npx tsc` 走 7.0。

7.1 开始有新的 API，不是一个巨大的 `typescript` 对象，而是拆成几个入口：

| 入口 | 用途 |
|---|---|
| `typescript/sync` | 同步编译器客户端，编译器选项、检查器、program API |
| `typescript/async` | 同一套能力的 Promise 版本 |
| `typescript/fs` | 请求级的完整文件系统与分层文件系统 |
| `typescript/ast` | 语法树节点类型与枚举，如 `SyntaxKind`、`ScriptTarget` |
| `typescript/ast/is` | 节点类型守卫 |
| `typescript/ast/factory` | `create*` 与不可变 `update*` 函数 |

下面这段用 7.1.0-beta 实测能编译。注意它需要 `--lib esnext`，因为 `using` 依赖 `Symbol.dispose`：

```text
import { API } from "typescript/sync";

using api = new API();
using program = api.createProgram(["/src/a.ts"], { strict: true, noEmit: true });
const count = program.getSemanticDiagnostics().length;
```

`API` 和 `Program` 都是 `Disposable`。它们在 Go 侧分配内存，JavaScript 的垃圾回收器管不到，必须显式释放，或者用 `using` 让作用域结束时自动释放。释放后不能再用。

7.1 还加了两个机制：

- 快照。`api.createSnapshot()` 建一个时间点的项目状态，`snapshot.update()` 从旧快照派生新快照，只重算变了的部分。编辑器式增量检查靠它。
- 内容映射器。给某个扩展名注册一个外部程序，把 `.vue`、`.svelte`、`.mdx` 这类单文件组件转成 TypeScript 能看的虚拟文件，再把位置映射回原文件。Volar 的模型因此成了一等公民。

内容映射器要显式允许执行外部程序。`tsconfig.json` 里写了 `contentMappers` 但没给标志时报错：

```text
tsconfig.json(3,3): error TS18068: Content mappers require the '--runExternalCode' command line flag to be enabled.
```

`--runExternalCode` 给了、包又没装时：

```text
tsconfig.json(3,35): error TS18075: The content mapper package '@vue/content-mapper' could not be resolved.
```

7.1 同时在语言层做了几件事，第 39 章有具体条目，这里只列名字：ambient module 支持导入属性、source phase imports、`--target es2026` 与对应的 lib、分布式类型参数检查变严。

7.1 的性能也比 7.0 好一截，[官方 beta 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/)给了表：mui-docs 22.2s 到 11.9s，sentry 19.6s 到 15.1s，vscode 21.6s 到 17.7s，内存最多降了一半。

7.1 现在是 beta，别在生产里锁 beta 版本。

## 编辑器与嵌入语言

语言服务换成了基于 LSP 的多线程实现。VS Code 有专门的 TypeScript 7 扩展（[TypeScriptTeam.native-preview](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview)），Visual Studio 按工作区自动启用。语义高亮、sort imports、remove unused imports 这些 7.0 beta 时缺的功能都补上了。

官方给的稳定性数据：新语言服务的失败命令减少 80% 以上，崩溃减少 60% 以上。

嵌入语言是另一回事。Vue、Svelte、Astro、MDX 的单文件组件，以及 Angular 模板里的类型检查，7.0 还用不了。原因还是 API：Volar 这类工具要把 TypeScript 嵌进自己的编译器，必须有稳定的编程接口，而 7.0 没有。

官方的建议是按场景拆开：

- 用 Vue、Svelte、Astro、MDX 的项目继续用 6.0。
- Angular 项目可以命令行用 7.0 做全项目报错检查，编辑器用 6.0。
- VS Code 里随时可以用命令面板的“Disable TypeScript 7 Language Server”退回 6.0。

这些是时间点问题。7.1 的内容映射器就是给这类工具准备的，各框架的 mapper 已经在跟进。

## 怎么验证自己的项目

升级前按顺序跑一遍，比在生产里试错便宜。

1. 装两套：7.0 的 `tsc` 和 6.0 的 `tsc6`。同一份代码各跑一次 `--noEmit`，把报错集合 diff 出来。

2. 固定检查器数量。CI 里写死 `--checkers 4` 或团队约定的值，别用默认值随机器核数漂。

3. 看 `.d.ts` 输出。开了 `stableTypeOrdering` 后应该逐字节稳定，拿升级前后的产物 diff，差异就是真实的类型变化。

4. 列一遍依赖 `typescript` API 的工具。能等的等 7.1，不能等的用别名包，别让工具链悄悄读到 7.0。

5. 量一次真实数据。`time npx tsc --noEmit` 跑三次取中位数，和 6.0 比；内存用 `/usr/bin/time -v`（Linux）或 `/usr/bin/time -l`（macOS）。

6. JSDoc 项目单独跑一遍。前面那张表里的写法会集中在这里报错，和类型错误分开处理。

## 用不上的时候

### 项目依赖编译器 API

直接 `import ts from "typescript"` 的工具在 7.0 下都跑不了。要么等 7.1 的 API，要么用 `tsc6`。这不是配置问题，是 7.0 根本没发布 API。

### 单文件组件的类型检查

Vue、Svelte、Astro、MDX 的单文件组件目前只能靠 6.0。命令行可以混用 7.0，编辑器不行。

### 只写业务页面

项目几万行以内，构建本来就在几秒内，8 到 12 倍换来的是几百毫秒。别为了这个数字折腾双版本工具链。

### 需要浏览器里跑编译器

7.0 不提供浏览器内可用的构建，也没有 JavaScript API。在线编辑器、 playground 这类场景继续用 6.0。

## 小结

- 7.0 是把 JavaScript 实现翻译成 Go，不是重新设计。官方承诺 6.0 的检查结果一致，差异只在明确列出的几处。
- 提速来自原生代码、共享内存多线程和一批优化，不是“Go 语法快”。
- 并行的两层是 `--checkers`（默认 4）和 `--builders`，相乘会把内存打满。
- `--checkers` 可能暴露顺序相关问题，团队要固定值；`--singleThreaded` 给确定性和对比用。
- 7.0 不带 API，工具链要用 `@typescript/typescript6` 的别名包；7.1 才补新 API。
- 类型层三处变化：Unicode code point、skipLibCheck 报错位置、strict 关闭时的参数省略。
- JavaScript 支持删掉了一批 Closure 时代的历史写法，JSDoc 项目要单独过一遍。
- 编辑器用 LSP 重写，嵌入语言（Vue、Angular 模板等）要等 7.1 的工具跟进。

## 参考

- [TypeScript 7.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)：性能表、并行参数、兼容承诺、JS 支持变化。
- [TS 7.1 Beta 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/)：新 API、内容映射器、`es2026` 与 7.1 性能表。
- [原生移植公告（2025-03）](https://devblogs.microsoft.com/typescript/typescript-native-port/)：Strada 与 Corsa、早期基准、路线图。
- [typescript-go 的 FAQ #411](https://github.com/microsoft/typescript-go/discussions/411)：为什么选 Go 的官方原话。
- [typescript-go 的 CHANGES.md](https://github.com/microsoft/typescript-go/blob/main/CHANGES.md)：有意差异的逐条清单。
- [TypeScript 6.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)：7.0 继承的默认值与硬报错。
