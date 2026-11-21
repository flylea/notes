# 第 23 章 TSConfig 配置详解

项目里 `strict` 关着、`target` 还是 ES5、`paths` 配了却没生效，报错信息与配置项对不上。tsconfig 控制编译范围、产物形态和检查强度。这一章按分组解释常用选项，给出 TS 7.0.2 下的推荐值。

[tsconfig.json](https://www.typescriptlang.org/tsconfig) 决定三件事：哪些文件参与编译、代码按什么目标生成、类型检查有多严格。
[TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) 改了一批默认值，7.0 删掉旧选项并把编译器换成了 Go 原生实现。
下面列出的选项、报错和输出都来自 TypeScript 7.0.2 的实测结果，旧写法会标出对应错误码。

## 快速开始

### 生成配置文件

项目根目录运行：

```bash
$ npx tsc --init
Created a new tsconfig.json in /path/to/project
```

生成的文件带注释，主体是这些选项：

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "types": [],
    "jsx": "react-jsx",
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noUncheckedSideEffectImports": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

模板适合新项目起手，三处按项目改：

- 前端打包器项目把 `module` 改成 `esnext`，`moduleResolution` 用 `bundler`。
- Node 项目保留 `nodenext`，并在 package.json 里写 `"type": "module"`。
- `types` 默认是空数组，用 Node 时补 `"node"`。

### 最小配置

tsconfig.json 写空对象 `{}` 也能编译。7.0 的默认值已经足够严格，最小配置通常只写范围：

```json
{
  "include": ["src"]
}
```

7.0 的默认值：

| 选项 | 默认值 |
| --- | --- |
| target | es2025 |
| module | esnext |
| moduleResolution | bundler |
| strict | true |
| types | [] |
| rootDir | tsconfig.json 所在目录 |
| noUncheckedSideEffectImports | true |
| libReplacement | false |

这些默认值带来三个变化：

- 不用写 `"strict": true` 才能拿到严格检查，它已经开着。
- 不写 `types` 时不会自动加载 `node_modules/@types` 下的包，Node 项目会缺全局类型。
- 不写 `lib` 时按 target 推导，DOM 类型要显式加 `dom`。

### 命令行与 tsconfig.json 的关系

目录里有 tsconfig.json 时，命令行再列文件会报错：

```bash
$ tsc index.ts --noEmit
error TS5112: tsconfig.json is present but will not be loaded if files are specified on commandline. Use '--ignoreConfig' to skip this error.
```

要单独编译某个文件，加 `--ignoreConfig`：

```bash
$ tsc index.ts --noEmit --ignoreConfig
```

规则：项目内用 `tsc` 或 `tsc -p .`；只查单个文件时用 `--ignoreConfig`，此时不读取 tsconfig.json。

### 配置继承

公共配置放 base 文件：

```json
{
  "compilerOptions": {
    "target": "es2025",
    "strict": true,
    "skipLibCheck": true
  }
}
```

子项目写差异：

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"]
  },
  "include": ["src"]
}
```

`extends` 的路径相对当前文件解析。数组型选项（`include`、`files`、`lib`）在子配置里是覆盖，不是追加。`@tsconfig/*` 系列包仍可用，部分包的 target 偏旧，接手旧项目时先看它继承了什么。

### TS 6.0 与 7.0 的默认值变化

| 选项 | 5.x 默认 | 6.0 / 7.0 默认 | 影响 |
| --- | --- | --- | --- |
| strict | false | true | 不写也开严格检查 |
| module | commonjs | esnext | 无打包器时注意 ESM 语法 |
| target | es5（--init 曾给 es2018） | es2025 | 不再降级到 ES5 |
| types | 加载全部 @types | [] | 必须显式声明 |
| rootDir | 按输入推断 | tsconfig.json 所在目录 | 输出多一层目录，或报 TS5011 |
| noUncheckedSideEffectImports | false | true | 副作用导入缺声明报 TS2882 |
| libReplacement | true | false | 不再用 @typescript/lib-* 替换内置 lib |

补充两条：

- 6.0 新增 `--stableTypeOrdering`，让 6.0 的类型排序与 7.0 对齐，方便看迁移 diff。7.0 强制开启，不能关闭。
- 5.9 到 6.0 是过渡版本，7.0 才移除旧选项。从 5.x 直接升 7.0 时，把 6.0 的弃用清单当检查表。

## tsc 怎么读配置

tsc 启动后先解析命令行，再决定用哪份配置。优先级是命令行参数、`tsconfig.json`、内置默认值，左边的覆盖右边的。

不给文件参数时，tsc 从当前目录向上找最近的 `tsconfig.json`。在 `src/` 里执行，找到的是项目根的配置。`-p` 指定目录，`--ignoreConfig` 跳过配置，两者不必同时用。

给了文件参数，7.0 直接拒绝加载配置，原文见下面的 TS5112。加 `--ignoreConfig`，或者删掉文件参数，二选一。

`extends` 在读取阶段合并。子配置覆盖父配置的同名项，数组型选项整体替换，不拼接。相对路径按声明它的那份文件解析，`exclude` 会自动补上 `outDir`。`--showConfig` 打印合并结果，排查继承问题先看它。

实测一份子配置只写了 `outDir` 和 `include`，父配置的 `target`、`strict`、`moduleResolution` 都在，`include` 则整段换成了子配置的值。数组选项不是取并集，是后者替换前者。

`rootDir` 默认取 `tsconfig.json` 所在目录，这是 6.0 的改动。5.x 按输入文件的最长公共路径推断，7.0 不再推断。源码放在子目录又配了 `outDir` 时，必须显式写 `rootDir`，否则产物路径会多一层。

`include` 决定 program 的起点。被 import 的文件自动进 program，`exclude` 只过滤 `include` 的匹配结果，不挡依赖图里的文件。

为什么不能反过来，让配置文件覆盖命令行？临时试跑会被仓库配置改掉行为，排查时看不出谁生效。反过来让命令行完全无视配置也不行，项目级选项没法每次重复写。留两层覆盖，才有临时性。

配置层最容易撞上的三条报错：

```bash
$ tsc --noEmit -p t2
error TS18003: No inputs were found in config file '/private/tmp/d37/c23/t2/tsconfig.json'. Specified 'include' paths were '["src/**/*"]' and 'exclude' paths were '[]'.

$ tsc --noEmit -p t1
error TS6059: File '/private/tmp/d37/c23/t1/extra/b.ts' is not under 'rootDir' '/private/tmp/d37/c23/t1/src'. 'rootDir' is expected to contain all source files.
  The file is in the program because:
    Matched by include pattern 'extra/**/*' in '/private/tmp/d37/c23/t1/tsconfig.json'

$ tsc --noEmit src/a.ts
error TS5112: tsconfig.json is present but will not be loaded if files are specified on commandline. Use '--ignoreConfig' to skip this error.
```

三条的读法不同。TS18003 是 include 没匹配到文件，先看目录名和 glob。TS6059 是文件落在 rootDir 外，改 rootDir 或把文件移进源码目录。TS5112 不是配置错，是命令行与配置同时存在，按上文的二选一处理。

配置文件的路径也影响结果。`include`、`exclude`、`outDir`、`rootDir` 里的相对路径都相对于 `tsconfig.json` 所在目录，不是相对于执行 tsc 的目录。从别处调用时这一点最容易踩。

`-p` 与文件参数的区别值得记。`-p` 走完整配置，`strict`、`types`、`paths` 都生效。文件参数加 `--ignoreConfig` 走内置默认值，只适合单文件试跑。TS 6.0 的新默认值，要在后一种情况下才直接生效。

排查配置还有两个命令。`--showConfig` 看合并后的最终值，`--explainFiles` 看每个文件为什么进 program。前者查继承，后者查 include 与依赖图。

一句话，tsconfig 是项目级的默认参数表，命令行是这一次的临时覆盖。比喻只到合并顺序为止，配置里还有改变文件选择的选项，不是纯参数。

## 文件范围控制

### files、include 与 exclude

```json
{
  "files": ["src/index.ts"],
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/*.test.ts", "dist"]
}
```

四条规则：

- `files` 只接受文件路径，不做 glob。
- `include` 支持 glob，`**/*` 匹配任意层级。
- `exclude` 默认排除 node_modules、bower_components、jspm_packages 和 outDir。
- `include` 里的文件 import 进来的文件，即使落在 exclude 里也会参与编译。exclude 只过滤 include 的匹配结果。

### rootDir 默认值的变化

7.0 把 `rootDir` 默认设为 tsconfig.json 所在目录。只要设置了 outDir、源码又放在子目录（比如 src/），7.0 就要求显式写 rootDir，否则报：

```bash
$ tsc -p .
tsconfig.json(3,5): error TS5011: The common source directory of 'tsconfig.json' is './src/nested'. The 'rootDir' setting must be explicitly set to this or another path to adjust your output's file layout.
  Visit https://aka.ms/ts6 for migration information.
```

上面这份配置只有 outDir 和 include，源码在 src/nested 下。7.0 要求显式写 rootDir。两种修法。

按源码目录输出：

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

保留 src 前缀：

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src"]
}
```

前者输出 `dist/nested/a.js`，后者输出 `dist/src/nested/a.js`。库包通常要前者。

## 构建相关配置

### target

默认 es2025。6.0 起不再支持 ES3 和 ES5：

```bash
$ tsc -p .
tsconfig.json(3,15): error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
```

允许值从 es6 到 esnext：

`es6`、`es2015`、`es2016`、`es2017`、`es2018`、`es2019`、`es2020`、`es2021`、`es2022`、`es2023`、`es2024`、`es2025`、`esnext`。

选择依据是运行环境支持的最低版本。Node 20 以上和现代浏览器用默认值即可；要兼容旧运行时，显式写 `es2017` 之类，最低只能到 es2015。

### lib

默认跟着 target 推导。加 DOM 类型要显式列：

```json
{
  "compilerOptions": {
    "target": "es2025",
    "lib": ["es2025", "dom"]
  }
}
```

6.0 的 lib 有三个变化：

- `dom` 已包含 `dom.iterable` 和 `dom.asynciterable`，后两个文件现在是空的，旧配置里的 `"dom.iterable"` 可以删。
- Temporal 类型放在 `esnext`，也可以只引 `esnext.temporal`。
- `es2025` 补了 RegExp.escape、Promise.try、Iterator 辅助方法和 Set 方法。

### module

允许值：

`commonjs`、`es2015`、`es2020`、`es2022`、`esnext`、`node16`、`node18`、`node20`、`nodenext`、`preserve`。

amd、umd、systemjs、none 已移除：

```bash
$ tsc -p .
tsconfig.json(2,3): error TS5095: Option 'bundler' can only be used when 'module' is set to 'preserve', 'commonjs', or 'es2015' or later.
tsconfig.json(3,15): error TS5108: Option 'module=AMD' has been removed. Please remove it from your configuration.
```

第一行是因为默认 moduleResolution 是 bundler，和 AMD 不兼容。要输出 AMD 或 UMD，改用 Rollup、esbuild 或 Vite 的库构建。

选择建议：

| 场景 | module | moduleResolution |
| --- | --- | --- |
| Vite、Next 等打包器 | esnext | bundler |
| Node 原生 ESM | nodenext | nodenext |
| 旧 CommonJS 项目 | commonjs | bundler |
| 只做类型检查 | preserve | bundler |

### moduleResolution

只剩三个值：`node16`、`nodenext`、`bundler`。node10 已移除：

```bash
$ tsc -p .
tsconfig.json(3,25): error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
```

绑定规则：

| module | moduleResolution 必须为 | 说明 |
| --- | --- | --- |
| nodenext | nodenext | 默认 |
| node16 / node18 / node20 | node16 | 默认 node16，写 bundler 报 TS5109 |
| esnext / commonjs / preserve | bundler | 默认 bundler |

写成对的 nodenext 最省事，或者只写 module 让 resolution 用默认值。只有 bundler 需要显式写。配错时报：

```bash
$ tsc -p .
tsconfig.json(3,15): error TS5110: Option 'module' must be set to 'Node16' when option 'moduleResolution' is set to 'Node16'.
```

```bash
$ tsc -p .
tsconfig.json(4,25): error TS5095: Option 'bundler' can only be used when 'module' is set to 'preserve', 'commonjs', or 'es2015' or later.
tsconfig.json(4,25): error TS5109: Option 'moduleResolution' must be set to 'Node16' (or left unspecified) when option 'module' is set to 'Node16'.
```

### outDir 与 outFile

outDir 决定产物目录。outFile 已移除：

```bash
$ tsc -p .
tsconfig.json(3,5): error TS5102: Option 'outFile' has been removed. Please remove it from your configuration.
```

单个 bundle 交给打包器。tsc 只负责逐文件产物和 .d.ts。

### declaration

`declaration` 生成 .d.ts，`declarationMap` 生成 .d.ts.map 便于跳回源码：

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

`emitDeclarationOnly` 只产类型文件，但必须有 `declaration` 或 `composite`，否则报 `error TS5069: Option 'emitDeclarationOnly' cannot be specified without specifying option 'declaration' or option 'composite'.`。

7.0 允许同时写 `noEmit` 和 `declaration`，但 `noEmit` 为 true 时不写任何文件。想要 .d.ts 就别开 noEmit。

### sourceMap 相关

- `sourceMap` 生成 .js.map。
- `inlineSourceMap` 把 map 写进 .js，两者不要同时开。
- `declarationMap` 生成 .d.ts.map。
- `sourceRoot` 告诉调试器源文件在哪。

库包建议 `sourceMap` 和 `declarationMap` 都开，使用者能跳回源码。

### 路径别名 paths

baseUrl 已移除：

```bash
$ tsc -p .
tsconfig.json(3,5): error TS5102: Option 'baseUrl' has been removed. Please remove it from your configuration.
  Use '"paths": {"*": ["./*"]}' instead.
tsconfig.json(4,24): error TS5090: Non-relative paths are not allowed. Did you forget a leading './'?
```

迁移分两步：删掉 baseUrl；paths 的值全部改成相对路径，前缀 `./`。

```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

以前靠 baseUrl 写根相对导入的项目，用 `"*": ["./*"]` 接住：

```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": {
      "*": ["./*"]
    }
  },
  "include": ["src", "*.ts"]
}
```

paths 只影响 TypeScript 的模块解析。运行时解析要同步：Vite 配 `resolve.alias`，Node 用 package.json 的 `imports` 字段。两边不一致时，tsc 通过而运行时报找不到模块。

### resolveJsonModule

允许 import JSON 并推导类型：

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "module": "nodenext",
    "moduleResolution": "nodenext"
  }
}
```

nodenext 下 JSON import 要带 import attributes：

```ts
import data from "./data.json" with { type: "json" };

export const n = data.n;
```

旧的 assert 写法报：

```bash
$ tsc -p .
index.ts(1,32): error TS2880: Import assertions have been replaced by import attributes. Use 'with' instead of 'assert'.
```

### importHelpers

从 tslib 引入辅助函数，避免每个文件重复内联 `__awaiter` 之类的代码。需要先装 tslib。target 越高用得越少：应用一般不用开，库包可以开。

## 类型检查相关配置

`strict` 在 7.0 默认打开，它是一组开关的总闸。默认随 strict 变 true 的子项：

| 子选项 | 作用 |
| --- | --- |
| noImplicitAny | 隐式 any 报错 |
| strictNullChecks | null 和 undefined 单独成类型 |
| strictFunctionTypes | 函数类型参数逆变检查 |
| strictBindCallApply | call、apply、bind 保留参数类型 |
| strictPropertyInitialization | 类属性必须初始化 |
| noImplicitThis | this 隐式 any 报错 |
| useUnknownInCatchVariables | catch 变量类型为 unknown |
| alwaysStrict | 按严格模式生成，7.0 不能关闭 |

不随 strict 打开、常一起用的检查：

| 选项 | 作用 |
| --- | --- |
| noUncheckedIndexedAccess | 索引访问结果加 undefined |
| exactOptionalPropertyTypes | 可选属性不接受显式 undefined |
| noUnusedLocals | 未使用局部变量报错 |
| noUnusedParameters | 未使用参数报错 |
| noImplicitReturns | 部分分支没 return 报错 |
| noFallthroughCasesInSwitch | switch 落空报错 |
| noPropertyAccessFromIndexSignature | 索引签名的键必须用方括号访问 |
| allowArbitraryExtensions | 允许导入非 TS 扩展名，声明放在 `.d.<ext>.ts` |

一份打开常用检查的配置：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### strict

7.0 默认 true，写不写都一样。要放宽个别检查，关掉对应子项，别关整个 strict。

### strictNullChecks

null 和 undefined 各自成为类型，赋值给别的类型要收窄。关掉它会让 null 混进所有类型，7.0 仍允许关，不建议关。

### noImplicitAny

参数、变量漏了类型标注会报 `error TS7006: Parameter 'a' implicitly has an 'any' type.`。随 strict 默认打开。

### strictFunctionTypes

函数类型的位置做逆变检查。方法参数是双变的，所以 `Array<T>` 这类接口方法不受影响，写回调时要注意参数类型。

### strictPropertyInitialization

构造函数没赋值的类属性报错。需要 strictNullChecks 一起开。处理方式：构造函数里赋值、用 `!` 断言、或写 `declare` 声明。

### strictBindCallApply

`call`、`apply`、`bind` 的参数和返回值保留类型，调用参数不对会报错。

### noImplicitThis

独立函数里的 `this` 不能是隐式 any，需要显式标注 this 类型。

### useUnknownInCatchVariables

`catch (e)` 里的 e 是 unknown，使用前要收窄：

```ts
try {
  throw new Error("boom");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.log(msg);
}
```

### noUnusedLocals 与 noUnusedParameters

未使用的局部变量和参数报错。参数以下划线开头的仍算未使用，需要显式标注或加 `void 参数`。

### noImplicitReturns

函数有些分支 return，有些分支不 return 时报错。适合所有分支都必须给值的函数。

### noFallthroughCasesInSwitch

switch 的 case 没写 break 且不是空 case 时报错。

### noUncheckedIndexedAccess

索引访问结果加上 undefined：`arr[0]` 的类型从 `T` 变成 `T | undefined`，`Record` 索引同理。取值前要判空。

### exactOptionalPropertyTypes

`{ a?: string }` 不再接受 `{ a: undefined }`，能区分“属性不存在”和“属性值是 undefined”。和 `noUncheckedIndexedAccess` 一起开最严格。

### noPropertyAccessFromIndexSignature

对象上有索引签名时，键只能走方括号，不能走点号。目的是让“这个键是写死的还是查出来的”在代码里看得出来。

```bash
$ tsc -p .
a.ts(5,18): error TS4111: Property 'MODE' comes from an index signature, so it must be accessed with ['MODE'].
```

修法有三种：改用 `env["MODE"]`；把常用键在接口里单独声明；或者把签名写成已知键的联合类型。环境变量、翻译字典、配置对象这类结构容易碰到。

### allowArbitraryExtensions

默认只认 `.ts`、`.js` 这些扩展名。开了之后可以 `import styles from "./button.css"`，编译器去找同名声明 `button.d.css.ts`。

```typescript
import styles from "./button.css";

const className: string = styles.primary;
```

声明文件要自己写或由工具生成，内容是普通模块声明：`declare const styles: { primary: string }; export default styles;`。

需要配合 `moduleResolution: "bundler"` 或 `"nodenext"`。样式、图片、字体这类被构建工具处理过的导入，靠它拿到类型。

## 工程相关配置

### isolatedModules

要求每个文件能单独转译：类型导出必须写 `export type`，跨文件 const enum 不能当值用，全局脚本里不能用 namespace。7.0 默认 false，打包器项目建议开 true。

常见的三条报错：

- `error TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'.`
- `error TS2748: Cannot access ambient const enums when 'isolatedModules' is enabled.`
- `error TS1280: Namespaces are not allowed in global script files when 'isolatedModules' is enabled. If this file is not intended to be a global script, set 'moduleDetection' to 'force' or add an empty 'export {}' statement.`

模块文件里的 const enum 在 7.0 不再报错，旧文档里“不能使用 const enum”的说法已经过时。

### verbatimModuleSyntax

导入导出原样保留，不做 CommonJS 与 ESM 互转。类型导入必须标 `import type`：

```bash
$ tsc -p .
src/a.ts(1,10): error TS1484: 'Id' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```

文件被当成 CommonJS 时，顶层 export 会报：

```bash
$ tsc -p .
src/server.ts(1,10): error TS1295: ECMAScript imports and exports cannot be written in a CommonJS file under 'verbatimModuleSyntax'. Adjust the 'type' field in the nearest 'package.json' to make this file an ECMAScript module, or adjust your 'verbatimModuleSyntax', 'module', and 'moduleResolution' settings in TypeScript.
src/server.ts(3,1): error TS1287: A top-level 'export' modifier cannot be used on value declarations in a CommonJS module when 'verbatimModuleSyntax' is enabled.
```

修法：package.json 加 `"type": "module"`，或者把 module 换成 commonjs。

### erasableSyntaxOnly

只允许能擦除的语法：类型标注、interface、type、declare。禁止 enum、namespace、参数属性、`import x = require()`。适合 Node 的类型剥离和 tsx 这类运行时。

```bash
$ tsc -p .
src/color.ts(1,13): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
src/point.ts(2,15): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
```

### 三个选项的关系

| 选项 | 检查什么 | 典型报错 | 适用场景 |
| --- | --- | --- | --- |
| isolatedModules | 单文件能否独立转译 | TS1205、TS1280、TS2748 | 打包器、tsx |
| verbatimModuleSyntax | 导入导出是否原样保留 | TS1484、TS1287、TS1295 | ESM 项目 |
| erasableSyntaxOnly | 语法能否直接擦除 | TS1294 | Node 类型剥离 |

三个都开最保险，代价是要清理旧写法。只做类型检查的项目可以只开前两个。

### 增量构建与项目引用

`incremental` 为 true 时生成 .tsbuildinfo，下次构建复用。monorepo 用 composite 加 references：

```json
{
  "files": [],
  "references": [
    { "path": "./packages/utils" },
    { "path": "./packages/app" }
  ]
}
```

子包的 tsconfig 打开 `composite`（会自动带 declaration），构建用：

```bash
$ tsc -b
```

`tsc -b` 按依赖顺序构建，产物分目录输出。细节见第 35 章。

### esModuleInterop

7.0 默认 true，不能关：

```bash
$ tsc -p .
tsconfig.json(3,24): error TS5108: Option 'esModuleInterop=false' has been removed. Please remove it from your configuration.
```

`allowSyntheticDefaultImports` 同理，默认 true 且不能写 false。从 CommonJS 模块做 default import 现在默认可用，不用再补配置。

### allowJs 与 checkJs

`allowJs` 让 .js 文件参与编译，`checkJs` 对 .js 做类型检查，JSDoc 注解会生效。迁移旧项目时先开 allowJs 把文件纳入，再逐步开 checkJs。

### forceConsistentCasingInFileNames

默认 true。import 路径大小写和磁盘不一致会直接报错。Linux 上开发、Windows 或 macOS 上协作时尤其重要，保持默认即可。

## 7.0 硬移除清单

| 旧选项 | 处理方式 | 报错 |
| --- | --- | --- |
| moduleResolution node 或 node10 | 改 nodenext 或 bundler | TS5108 |
| moduleResolution classic | 改 bundler 或 nodenext | TS5108 |
| baseUrl | 删掉，paths 用相对路径 | TS5102、TS5090 |
| target es5 | 改 es2015 及以上 | TS5108 |
| target es3 | 改 es2015 及以上 | TS6046 |
| outFile | 改用打包器 | TS5102 |
| module amd | 改用打包器 | TS5095、TS5108 |
| module umd | 改用打包器 | TS5095、TS5108 |
| module systemjs 或 none | 删掉 | TS6046 |
| downlevelIteration | 现代 target 不需要 | TS5102 |
| esModuleInterop false | 删掉，永远为 true | TS5108 |
| allowSyntheticDefaultImports false | 删掉 | TS5108 |
| alwaysStrict false | 删掉，全部按严格模式 | TS5108 |
| out | 改 outDir | TS5023 |
| importsNotUsedAsValues | 改 verbatimModuleSyntax | TS5023 |
| `module Foo {}` 声明命名空间 | 改 `namespace Foo {}` | TS1540 |
| `import ... assert { type: "json" }` | 改 `with { type: "json" }` | TS2880 |
| `/// <reference no-default-lib>` | 删掉 | 6.0 起报错 |

命名空间用 module 关键字的报错：

```bash
$ tsc --noEmit --ignoreConfig index.ts
index.ts(1,8): error TS1540: A 'namespace' declaration should not be declared using the 'module' keyword. Please use the 'namespace' keyword instead.
```

### ignoreDeprecations

6.0 给弃用项留了静音开关，值为 `"5.0"` 或 `"6.0"`：

```json
{
  "compilerOptions": {
    "ignoreDeprecations": "6.0"
  }
}
```

它只静音“还能用但将移除”的警告。已经移除的选项救不回来：配置里写 baseUrl 再加这一项，仍然报 TS5102。7.0 里所有弃用项都已移除，这一项可以删掉。

## 常用场景推荐配置

四份配置都在 7.0.2 下实测通过。

### 前端项目

打包器负责产物，tsc 只做类型检查，所以开 noEmit：

```json
{
  "compilerOptions": {
    "target": "es2025",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2025", "dom"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

验证：

```bash
$ tsc -p .
```

paths 要在 vite.config.ts 的 `resolve.alias` 里同步，否则运行时报找不到模块。

### Node.js 后端

package.json 先声明 ESM：

```json
{
  "name": "server",
  "type": "module",
  "private": true
}
```

```json
{
  "compilerOptions": {
    "target": "es2025",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["es2025"],
    "types": ["node"],
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "sourceMap": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

```bash
$ tsc -p .
```

漏掉 `"type": "module"` 时，nodenext 把 .ts 当 CommonJS，verbatimModuleSyntax 会报 TS1295 和 TS1287。

### npm 库包

```json
{
  "compilerOptions": {
    "target": "es2025",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["es2025"],
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

package.json 的入口与类型字段：

```json
{
  "name": "@demo/vec2",
  "version": "0.1.0",
  "type": "module",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

```bash
$ tsc -p .
```

dist 下应有 index.js、index.d.ts、index.d.ts.map、index.js.map。发布前用 `npm pack --dry-run` 检查 files 字段。

### 仅做类型检查

CI 里常见的配置：

```json
{
  "compilerOptions": {
    "target": "es2025",
    "module": "preserve",
    "moduleResolution": "bundler",
    "lib": ["es2025"],
    "types": [],
    "strict": true,
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

```bash
$ tsc -p . --noEmit
```

`preserve` 保留 import 和 export 原样，产物交给打包器或运行时。

## 从 5.x 升级到 7.0

按顺序做。

1. 装编译器。纯应用：

```bash
$ npm i -D typescript@^7.0.2
```

ESLint 等依赖编译器 API 的工具还需要 6.0：

```bash
$ npm i -D typescript@npm:@typescript/typescript6@^6.0.2
$ npm i -D @typescript/native@npm:typescript@^7.0.2
```

前者提供 API，后者提供 tsc 命令。7.0 本身不带 API，7.1 才补。

2. 跑一遍类型检查：

```bash
$ npx tsc --noEmit
```

看到 TS5102、TS5108、TS5090、TS5110、TS5109、TS6046，对照硬移除清单删改配置。

3. 处理默认值变化：

- strict 变 true：修隐式 any（TS7006）、null 访问（TS18047、TS2531）、属性未初始化（TS2564）。
- types 变 []：加 `"types": ["node"]` 或 `"types": ["jest"]`。Node 全局缺失报 TS2591。
- target 变 es2025：输出不再降级到 ES5。要兼容旧运行时显式写低 target，最低 es2015。
- module 变 esnext：Node 项目改 nodenext，并给 package.json 加 `"type": "module"`。
- rootDir 变 tsconfig 目录：设置 outDir 时补 `"rootDir": "./src"`，否则报 TS5011 或多一层目录。

4. baseUrl 换 paths：

删掉 baseUrl，给每个 paths 值加 `./` 前缀。打包器 alias 同步改。

5. outFile、amd、umd、systemjs 换打包器。tsc 不再合并文件。

6. 开 verbatimModuleSyntax 后批量修类型导入。`tsc --noEmit` 会列全 TS1484，把 `import { Foo }` 改成 `import type { Foo }`。

7. 过渡期可用 `"ignoreDeprecations": "6.0"` 静音弃用警告，已移除的选项救不回来。7.0 里删掉这一项。

8. 大项目先用 6.0 的 `--stableTypeOrdering` 跑一遍，确认类型排序差异，再切 7.0。构建用 `tsc -b` 和项目引用，见第 35 章。

9. 最后验证两个命令都退出 0：

```bash
$ npx tsc -p . --noEmit
$ npx tsc -b
```

## 用不上的时候

### 一次性试跑

验证几行类型代码时，命令行给 `--target`、`--lib` 更快，`tsc` 7 还能用 `--ignoreConfig` 跳过 tsconfig。

### 复制别人的配置

网上配置常绑着特定框架和版本，`moduleResolution`、`jsx`、`types` 抄错会引发成片报错。

### 升级大版本

6.0 改了默认值，7.0 删了旧选项。老项目一次切换会暴露大量错误，需要分开关闭。

## 参考

- [TSConfig Reference](https://www.typescriptlang.org/tsconfig)：全部配置项的语义与默认值。
- [TypeScript 6.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/)：6.0 的默认值变化与弃用清单。
- [TypeScript 7.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)：7.0 的硬移除与原生实现。
