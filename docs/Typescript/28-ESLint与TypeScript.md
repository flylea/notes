# 第 28 章 ESLint 与 TypeScript

ESLint 升级到 10 后 `.eslintrc` 完全不生效，`eslint` 直接报错退出；类型感知规则一开，lint 从两秒变两分钟。这一章讲 flat config、typescript-eslint 的接入与性能取舍。

ESLint 10.15.0 只读 `eslint.config.*`。仓库里还留着 `.eslintrc.js` 时，命令直接报错退出，旧配置一行都不会执行。typescript-eslint 8.73.0 同样只支持 flat config。（见 [typescript-eslint 文档](https://typescript-eslint.io/)）下面的配置、报错、命令都在 ESLint 10.15.0 与 typescript-eslint 8.73.0 下跑过。

flat config 的数据结构是一个数组，数组里每一项自己声明 `files`、`ignores`、`languageOptions`、`plugins`、`rules`。规则只对同一项声明覆盖的文件生效，没有旧配置那种 `extends` 字符串级联出的隐式作用域。`root`、`env`、`overrides` 这些字段在新格式里都找不到对应物。

## 旧配置失效的三个入口

三个变化各自对应一处报错。

- ESLint 10 删除了 `LegacyESLint` 与 `FlatESLint` 类，`.eslintrc.*` 不再解析。
- `.eslintignore` 不再读取，`--ignore-path` 参数被移除。
- `--ext` 仍然保留，官方定位是配合 `--no-config-lookup` 使用。普通 lint 由配置里的 `files` 决定扩展名。

只放 `.eslintrc.json` 的目录里执行 lint：

```bash
$ npx eslint a.ts
Oops! Something went wrong! :(

ESLint: 10.15.0

ESLint couldn't find an eslint.config.* file.

From ESLint v9.0.0, the default configuration file is now eslint.config.*.
If you are using a .eslintrc.* file, please follow the migration guide
to update your configuration file to the new format
```

注意报错文案。它说的是找不到配置文件，不是配置过时。`.eslintrc.json` 文件在磁盘上也不会被读取。

升级时最容易误判的一点，是以为装了新版 ESLint 就会继续读旧配置。实际只有 `eslint.config.*` 会被加载，旧文件留在仓库里不生效。迁移完成后应当直接删掉，避免后续有人改错文件。

迁移可以按文件类型分批。（见 [ESLint 10 迁移指南](https://eslint.org/docs/latest/use/migrate-to-10.0.0)）先用 flat config 覆盖 `.ts`，`.js` 保持原样，等类型规则跑顺再统一。两个配置共存期间，只有一份 `eslint.config.mjs` 生效，旧文件本来就不参与，分批没有额外成本。

`--ignore-path` 的实际报错：

```bash
$ npx eslint src/index.ts --ignore-path .gitignore
Invalid option '--ignore-path' - perhaps you meant '--ignore-pattern'?
```

忽略规则要写进配置里的 `globalIgnores()` 或某个对象的 `ignores`。`globalIgnores()` 只处理忽略，不参与规则计算，适合 `dist`、`coverage` 这类产物目录。它的效果是对所有文件生效，后续配置对象不会重新打开被忽略的路径。

`--ext` 现在仍然能被接受。`npx eslint src --ext .ts` 与 `npx eslint src` 的输出完全一致，因为扩展名早就由配置里的 `files` 决定。命令行再传一次不会报错，也没有额外作用。

## 安装

```bash
npm i -D eslint@10.15.0 @eslint/js typescript-eslint@8.73.0 eslint-config-prettier typescript@6.0.3
```

不用再单独装 `@typescript-eslint/parser` 与 `@typescript-eslint/eslint-plugin`。`typescript-eslint` 包内含 parser 和全部规则，flat config 里由它统一注册。

`@eslint/js` 只导出 `js.configs.recommended` 这一份核心规则集，版本 10.0.1。不装它也可以，代价是手写几十条核心规则。`eslint-config-prettier` 是给 prettier 用的兼容配置，下面 28.8 会用到。

依赖清单里没有 `typescript` 以外的类型包。tseslint 直接用项目里的 TypeScript，所以要保证 `node_modules/typescript` 的版本落在 peer 范围内。全局装过别的版本不影响项目内解析。

装包顺序也有讲究。先装 `eslint` 再装 `typescript-eslint`，npm 才能用 eslint 的版本去校验 peer。反过来装时，报错信息会先指向 eslint 缺失，看起来像另一个问题。

版本约束写在包的元数据里。ESLint 10.15.0 要求 Node 为 `^20.19.0 || ^22.13.0 || >=24`。typescript-eslint 8.73.0 声明 peer 依赖 `typescript >=4.8.4 <6.1.0`，同时声明 ESLint 为 `^8.57.0 || ^9.0.0 || ^10.0.0`。

装 TypeScript 7.0.2 时 npm 直接拒绝：

```bash
npm error While resolving: ch28-lab@undefined
npm error Found: typescript@7.0.2
npm error node_modules/typescript
npm error   dev typescript@"7.0.2" from the root project
npm error Could not resolve dependency:
npm error peer typescript@">=4.8.4 <6.1.0" from typescript-eslint@8.73.0
```

这条报错说明两件事。第一，tseslint 用的是 TypeScript 的编译器 API，不是文本解析。第二，装错版本时 npm 在解析依赖阶段就拒绝，不会等到运行才炸。

装完确认两个版本：

```bash
$ npx eslint --version
v10.15.0
$ node -e "console.log(require('typescript-eslint/package.json').version)"
8.73.0
```

## 最小可用配置

项目根目录建 `eslint.config.mjs`。扩展名用 `.mjs` 而不是 `.js`，是因为多数项目 `package.json` 里写了 `"type": "module"`，`.js` 会被当成 ESM 加载；没有写 `type` 的项目里，`.mjs` 同样能跑。两种项目共用一份文件名，迁移时不用改。

```js
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
```

四个位置各管一件事。

- `globalIgnores()` 替代 `.eslintignore`，只放全局忽略目录。
- `files` 决定哪些文件套这套配置。`.ts` 与 `.mjs` 的规则来源不同，所以要分开写对象。
- `extends` 接受共享配置数组。`js.configs.recommended` 是核心规则，`tseslint.configs.recommendedTypeChecked` 是带类型的规则集。（见 [typescript-eslint 共享配置](https://typescript-eslint.io/users/configs)）
- `projectService: true` 让 parser 自己找 tsconfig 建 program，替代旧的 `parserOptions.project`。`tsconfigRootDir` 固定解析起点，CI 与编辑器工作目录不同时必须写。

`defineConfig` 由 `eslint/config` 导出。它做的事很轻：给配置数组补类型，并把 `extends` 展开成普通数组。不用它也能写，直接 `export default [...]`，代价是 `extends` 要自己展开。

也可以改用 `tseslint.config()`，写法短一些：

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
);
```

两种写法都能跑。区别在 `extends`：`defineConfig` 支持嵌套 preset 数组，`tseslint.config()` 要自己展开。ESLint 10 文档推荐 `defineConfig`。

注意配置对象的顺序。数组从前往后应用，后面的对象覆盖前面同名规则。`ignores` 对象通常放第一个，带文件的规则对象放后面。

准备两个文件验证配置生效。

```ts
export function retry(times: number, task: () => Promise<string>): Promise<string> {
  return task().catch((error: unknown) => {
    if (times <= 1) {
      throw error;
    }
    return retry(times - 1, task);
  });
}
```

```ts
export function load(input: any) {
  const value = JSON.parse(input);
  return value;
}
```

干净文件应当零输出：

```bash
$ npx eslint src/index.ts
$ echo $?
0
```

再看解析器和规则数量：

```bash
$ npx eslint --print-config src/index.ts | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log(c.languageOptions.parser);console.log(Object.keys(c.rules).length)})'
typescript-eslint/parser@8.73.0
118
```

parser 是 `typescript-eslint/parser@8.73.0`，118 条规则来自两个 preset 的并集。同一个命令能把交接关系看清楚：

```bash
$ npx eslint --print-config src/index.ts | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);for(const k of ["no-unused-vars","@typescript-eslint/no-unused-vars","no-undef"])console.log(k,JSON.stringify(c.rules[k]))})'
no-unused-vars [0,{"vars":"all","args":"after-used",...}]
@typescript-eslint/no-unused-vars [2]
no-undef [0,{"typeof":false}]
```

核心 `no-unused-vars` 被关掉，改用 `@typescript-eslint/no-unused-vars`。核心 `no-undef` 也关掉，未定义变量交给 tsc 报 TS2304。这两条交接是 typescript-eslint 的固定做法，不要手动改回去。

解析器注入之后，`languageOptions` 里的 `sourceType` 是 `module`，`ecmaVersion` 为 2026。这两个值来自 parser 的默认行为，不用在配置里手写。旧配置里常见的 `env: { es2022: true }` 在 flat config 里同样不需要。

## 文件范围与 projectService

带类型的规则要为每个文件找 tsconfig。文件不在任何 `include` 里时，报错原文如下：

```bash
$ npx eslint scripts/cli.ts

/private/tmp/ch28/demo/scripts/cli.ts
  0:0  error  Parsing error: /private/tmp/ch28/demo/scripts/cli.ts was not found by the project service. Consider either including it in the tsconfig.json or including it in allowDefaultProject

✖ 1 problem (1 error, 0 warnings)
```

报错位置是 `0:0`，说明失败发生在解析阶段，规则还没开始跑。看到 0:0 的 Parsing error，先查解析器和 tsconfig，不要查规则配置。

两个修法。把 `scripts` 加进 tsconfig 的 `include`，或者给 projectService 开白名单：

```js
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["scripts/*.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
```

改完再跑同一条命令，退出码 0。

白名单适合构建脚本、生成器这类边缘文件。业务源码还是放进 tsconfig 的 `include` 更稳，跨文件类型信息才完整。

`include` 里也不要写太宽。把仓库根目录整个包进去时，`dist`、`coverage` 里的 `.ts` 也会进 program，typed lint 的耗时跟着上涨。`include` 只列源码目录，产物目录交给 `globalIgnores`。

一个 tsconfig 覆盖多包时，`projectService` 会把所有包的文件放进同一个 program。包之间没有类型依赖时，按包拆 tsconfig 再加 project references，每个 program 只装自己那份，内存和耗时都会降。

配置文件自身也是 `.mjs`。如果像 28.3 第二个例子那样不限定 `files`，lint 根目录时 `eslint.config.mjs` 也会被解析，并报同一个错：

```bash
/private/tmp/ch28/demo/eslint.config.mjs
  0:0  error  Parsing error: /private/tmp/ch28/demo/eslint.config.mjs was not found by the project service. Consider either including it in the tsconfig.json or including it in allowDefaultProject
```

这就是 28.3 第一个例子把 typed 配置限定在 `files: ["**/*.ts"]` 的原因。配置文件本身不需要类型规则，让它走核心推荐规则即可。

## 旧配置对照表

| `.eslintrc` 写法 | flat config 写法 |
|---|---|
| `.eslintrc.js` / `.eslintrc.json` | `eslint.config.mjs` |
| `parser: "@typescript-eslint/parser"` | 由 `tseslint` 配置注入，`--print-config` 显示 `typescript-eslint/parser@8.73.0` |
| `plugins: ["@typescript-eslint"]` | `tseslint.configs.*` 对象自带 |
| `extends: ["plugin:@typescript-eslint/recommended"]` | `tseslint.configs.recommended` |
| `extends: [..., "plugin:@typescript-eslint/recommended-requiring-type-checking"]` | `tseslint.configs.recommendedTypeChecked`（v6 起更名） |
| `parserOptions.project: "./tsconfig.json"` | `parserOptions.projectService: true` |
| `parserOptions.tsconfigRootDir` | 同名，值改成 `import.meta.dirname` |
| `env: { node: true }` | `languageOptions.globals`，值来自 `globals` 包 |
| `overrides: [{ files, rules }]` | 配置数组里的一项 `{ files, rules }` |
| `.eslintignore` | `globalIgnores()` 或对象里的 `ignores` |
| `eslint src --ext .ts` | `eslint src`，扩展名由 `files` 决定 |
| `extends: ["prettier"]` | `eslint-config-prettier/flat` |

迁移时最大的机械改动是字符串变成对象。旧配置里 `parser`、`plugins`、`extends` 都写包名字符串，flat config 里 `parser` 是导入进来的模块，`plugins` 是名字到对象的映射，`extends` 只在 `defineConfig` 里有。

`env` 里的全局变量要自己补。`node: true` 对应 `globals` 包导出的 `globals.node`，`browser: true` 对应 `globals.browser`。漏了这一步，`process`、`window` 会被核心 `no-undef` 报错。TypeScript 项目里核心 `no-undef` 已关，但 JS 文件仍然会命中。

`overrides` 也不再需要。配置数组里每一项就是一个 override，按数组顺序叠加。旧配置里靠 `files` 和 `excludedFiles` 控制的作用范围，拆成数组项即可。

## 已删除与已废弃的规则

typescript-eslint v8 删掉了一批规则。旧配置里写着它们时，报错是找不到规则：

```bash
$ npx eslint --config eslint.bantypes.mjs src/index.ts
Oops! Something went wrong! :(

ESLint: 10.15.0

TypeError: Key "rules": Key "@typescript-eslint/ban-types": Could not find "ban-types" in plugin "@typescript-eslint".
```

报错要分两类读。`could not find plugin` 是配置里没注册插件，`could not find "ban-types" in plugin` 是插件还在、规则没了。

| 旧规则 | 现状 | 替代 |
|---|---|---|
| `@typescript-eslint/indent`、`quotes`、`semi` | v8 删除 | `@stylistic/eslint-plugin` 同名规则 |
| 核心 `indent`、`quotes`、`semi` | 8.53.0 起 deprecated，标记到 11.0.0 移除 | `@stylistic/eslint-plugin`，或交给 prettier |
| `@typescript-eslint/ban-types` | v8 删除 | `no-restricted-types`、`no-empty-object-type`、`no-unsafe-function-type`、`no-wrapper-object-types` |
| `@typescript-eslint/no-empty-interface` | deprecated | `no-empty-object-type` |
| `@typescript-eslint/prefer-ts-expect-error` | deprecated | `ban-ts-comment` |
| `@typescript-eslint/no-var-requires` | deprecated | `no-require-imports` |
| `@typescript-eslint/no-throw-literal` | v8 删除 | `only-throw-error` |

格式化规则的迁移分两步走。ESLint 核心在 8.53.0 把 `indent`、`quotes`、`semi` 标为 deprecated，规则元数据里写 `availableUntil: 11.0.0`，10.x 仍能跑，但会提示迁移。typescript-eslint 的对应版本在 v8 直接删除，没有过渡期。旧配置如果同时写了两套，升级时会连报两处。

`ban-types` 拆成四条各有分工：`no-restricted-types` 接自定义禁名单，`no-empty-object-type` 管 `{}`，`no-unsafe-function-type` 管 `Function`，`no-wrapper-object-types` 管 `Object`、`Number` 这类包装类型。逐条替换比整段删除更稳。

升级前先盘点用到的规则。`npx eslint --print-config src/index.ts` 会打印当前生效的完整规则表，把输出存一份，升级后再打一份对比，删掉的规则和改级别的规则都会显出来。这比逐条翻文档快。

规则被删除时还有一个信号：配置校验阶段就抛异常，退出码是 2，没有任何文件被 lint。看到退出码 2 而不是 1，先查配置层，文件本身通常没问题。

## type-aware 检查的成本

typescript-eslint 提供四档共享配置。

| 配置 | 需要类型信息 | 内容 |
|---|---|---|
| `recommended` | 否 | 基础规则，等价旧 recommended |
| `recommendedTypeChecked` | 是 | 加 `no-floating-promises`、`no-unsafe-*` 等 |
| `strictTypeChecked` | 是 | 在上面再加更严的规则 |
| `stylisticTypeChecked` | 是 | 风格类规则，可与前两者叠加 |

上一节的 `load` 文件套 `recommendedTypeChecked`，输出四条：

```bash
$ npx eslint .

/private/tmp/ch28/demo/src/bad.ts
  1:29  error  Unexpected any. Specify a different type                                @typescript-eslint/no-explicit-any
  2:9   error  Unsafe assignment of an `any` value                                     @typescript-eslint/no-unsafe-assignment
  2:28  error  Unsafe argument of type `any` assigned to a parameter of type `string`  @typescript-eslint/no-unsafe-argument
  3:3   error  Unsafe return of a value of type `any`                                  @typescript-eslint/no-unsafe-return

✖ 4 problems (4 errors, 0 warnings)
```

四条里只有 `no-explicit-any` 来自 `recommended`，另外三条 `no-unsafe-*` 需要类型。去掉类型检查成本的办法是把 `extends` 换成 `tseslint.configs.recommended`，同时删掉 `projectService`。

反过来，开了类型规则却没配解析器时，报错长这样：

```bash
Oops! Something went wrong! :(

ESLint: 10.15.0

Error: Error while loading rule '@typescript-eslint/no-floating-promises': You have used a rule which requires type information, but don't have parserOptions set to generate type information for this file. See https://tseslint.com/typed-linting for enabling linting with type information.
Parser: typescript-eslint/parser
Occurred while linting /private/tmp/ch28/demo/src/index.ts
```

这条报错说明规则需要类型信息，和前面 0:0 的解析错不同。它发生在规则加载阶段，堆栈里有规则名。

`projectService` 与旧 `parserOptions.project` 的差别在建 program 的时机。旧写法一次把 tsconfig 覆盖的所有文件塞进 program，`projectService` 按被 lint 的文件按需建。大仓库上差别明显。CI 里不要对生成目录和 `node_modules` 跑 typed 规则。

带类型的规则也不都一样重。`no-unsafe-*` 系只看局部类型，开销小；`switch-exhaustiveness-check` 要看联合类型全量，开销大。规则集里混着两类，挑选时按文件规模权衡量。

规则级别只有三档：off、warn、error。没有第四种。warn 不挡 CI，除非加 `--max-warnings`。团队里常见做法是新增规则先 warn，清完存量再改 error，中间不会有大批失败。

`extends` 数组的顺序也有影响。后面的配置覆盖前面同名规则，所以严格程度递增的 preset 要放在后面，想放宽的规则对象再放到最后。

单条规则要改级别时，在配置对象里写 `rules`。下面把 `no-floating-promises` 降为 warning，并给测试文件单独关掉：

```js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-floating-promises": "off" },
  },
]);
```

对应文件里有一个没 await 的调用，输出是一条 warning：

```bash
$ npx eslint src/queue.ts

/private/tmp/ch28/demo/src/queue.ts
  4:3  warning  Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator  @typescript-eslint/no-floating-promises

✖ 1 problem (0 errors, 1 warning)
```

warning 默认不改变退出码，这条命令的退出码是 0。要让它挡住 CI，加 `--max-warnings 0`：

```bash
$ npx eslint src/queue.ts --max-warnings 0; echo $?
1
```

把测试文件单独放一个配置对象，靠 `files` 匹配。同一个规则在不同文件上可以给不同级别，这就是旧配置里 `overrides` 的替代写法。

## 配置数组怎么合并

ESLint 10 从被 lint 的文件所在目录向上找 `eslint.config.*`，第一个命中的就用，找到即停，不继续向上合并。一个进程只有一份配置，旧版的目录级联没有了。

文件是逐个匹配的。每个文件依次与数组项的 `files` 和 `ignores` 比较，命中的项叠加，后面的覆盖前面的同名规则。`defineConfig` 的 `extends` 在合并时展开成普通数组项，顺序仍是先来后到。

平铺成对象的代价是同名键必须唯一。同一个插件名注册两次，校验阶段直接抛错：

```bash
$ npx eslint src/index.ts
Oops! Something went wrong! :)

ESLint: 10.15.0
ConfigError: Config (unnamed): Key "plugins": Cannot redefine plugin "@typescript-eslint".
```

这条错在 lint 开始前抛出，退出码 2，一个文件都没检查。看到退出码 2 先查配置合并，不要翻源码。规则名写错也走同一条路，报 `Could not find "x" in plugin`。

为什么改成数组？旧配置按目录级联，结果取决于 cwd 和文件位置，同一份代码从不同目录跑会得到不同规则集。数组把匹配条件写进对象，合并顺序由书写顺序决定，可预测。

代价是每个包要自己管 `files`。单仓库里多个子包，可以每包一份配置，也可以根配置按路径分段写多个对象。前者隔离好，后者少装依赖。

`ignores` 与 `globalIgnores` 的范围不同。配置对象里的 `ignores` 只排除该对象匹配到的文件，对象不带 `files` 时排除整组。`globalIgnores` 是全局排除，等价于旧版的 `ignorePatterns`，最后统一生效。

共享配置包的形状也变了。旧版发布 `eslint-config-xxx`，用字符串 `extends` 引用。flat config 里共享配置就是一个导出数组的包，在 `extends` 里写包名或者直接展开数组，靠 npm 依赖管版本，没有命名约定。

`defineConfig` 与 `tseslint.config` 的差别只在写法。前者是 ESLint 内置的辅助函数，后者是 typescript-eslint 的包装，两个都返回数组。新项目用 `defineConfig`，已经写了 `tseslint.config` 的项目不必改。

规则集的顺序要留意。`...tseslint.configs.recommended` 展开在前，自己的覆盖对象写在后面，后者才生效。顺序反过来，自定义规则会被预设盖掉。

`files` 的匹配范围也要写全。`**/*.ts` 不匹配 `.mts` 和 `.cts`，这三种扩展名在 Node 项目里经常同时出现，写成 `**/*.{ts,mts,cts}` 更稳妥。

一句话，flat config 是一张按文件匹配的规则表，不是一棵按目录继承的配置树。比喻在插件处失效，插件按名字注册，同名第二次注册是报错，不是覆盖。

## 忽略与 prettier

prettier 管格式，ESLint 管规则。两者冲突的部分用 `eslint-config-prettier` 关掉：

```js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      eslintConfigPrettier,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
]);
```

`eslintConfigPrettier` 只把冲突规则设为 off，不做格式化。它必须放在 `extends` 最后，否则前面打开的格式规则又会盖回去。加上它之后：

```bash
$ npx eslint --print-config src/index.ts | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log("curly:",JSON.stringify(c.rules.curly))})'
curly: [0,"all"]
```

`curly` 被关掉，规则总数从 118 涨到 475，多出来的都是显式设为 0 的项。规则数变多不代表检查变多，值是 0 的项不会执行。

用 `@stylistic/eslint-plugin` 的人不要再装 prettier 一侧的配置，两套格式化规则同时开会互相覆盖。项目已有 prettier 就只用 eslint-config-prettier，没有 prettier 且想全在 ESLint 里管格式，再上 @stylistic。

格式化规则从核心搬走之后，ESLint 的定位更清楚了：管正确性和团队约定，不管空格和分号。格式化交给 prettier，一键 `prettier --write` 就能改完，不需要 lint 的 fix 流程。

## TypeScript 7 下的过渡

ESLint 侧跑的是 TypeScript 的 API。`typescript@7.0.2` 配 `typescript-eslint@8.73.0` 时启动即失败：

```bash
$ npx eslint src/index.ts
typescript-eslint does not support TS 7.0.
Please see https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0 to run typescript-eslint using the TS 6 API.
See also https://github.com/typescript-eslint/typescript-eslint/issues/10940 for tracking typescript-eslint's support for TS >=7.1

Oops! Something went wrong! :(

ESLint: 10.15.0

Error: typescript-eslint does not support TS 7.0.
    at Object.<anonymous> (/private/tmp/ch28/ts7/node_modules/typescript-eslint/dist/index.js:52:11)
```

官方给的过渡方案是别名装 6.x，让 lint 走 TS 6 API：

```bash
npm i -D typescript@npm:@typescript/typescript6@^6.0.2
```

安装后确认：

```bash
$ node -e "console.log(require('typescript/package.json').version)"
6.0.2
$ npx eslint src/index.ts
$ echo $?
0
```

别名把 `typescript` 这个包名指向 6.x，`require('typescript')` 拿到 6.0.2 的 API。本地的 `tsc` 命令也跟着变成 6.x，`npx tsc --version` 会打印 6.0.3。要用 tsc 7 做类型检查，得把 tsc 装在别的目录，或者用全局命令。

别名安装只影响包解析，不改代码。`import ts from "typescript"` 拿到的仍是 6.x API，写自定义规则时要注意版本差异。

判断某个 tseslint 版本是否支持当前 TypeScript，看两处就够。包的 peer 范围，以及发布说明里对 TS 版本的声明。范围不满足时 npm 会拦，绕过去装上的组合运行时会再拦一次，两次报错内容不同，别混为一谈。

等 typescript-eslint 支持 7.1 及以上，再换回 `typescript@7`。在那之前，CI 里同时保留两个检查：用项目的 tsc 7 做类型检查，用 ESLint 做规则检查，两边互不阻塞。

## CI 与编辑器

`package.json` 里放三条脚本：

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "check": "npm run typecheck && eslint . --max-warnings 0"
  }
}
```

CI 里加缓存，第二次只跑改动过的文件：

```bash
npx eslint . --cache --max-warnings 0
```

`.eslintcache` 要写进 `.gitignore`。`--max-warnings 0` 让 warning 也返回非零，CI 不会慢慢积累告警。缓存按文件内容和配置生成，改配置后第一次会全量重跑，这是正常的。

缓存文件不要跨分支复用。不同分支的 tsconfig 与配置不同，缓存命中率会掉，还可能拿到旧结果。CI 的缓存 key 带上分支名和配置文件的哈希，问题就没了。

VS Code 的 ESLint 扩展 4.x 起直接读 flat config，不需要 `eslintrc` 相关选项。工作目录不是仓库根时，靠配置里的 `tsconfigRootDir` 兜底。改完配置后执行一次 `ESLint: Restart ESLint Server`，否则扩展可能还用旧配置。

从 `recommended` 切到 `recommendedTypeChecked` 时，先全量跑一遍，把新增报错按规则分类。规则太多可以先把一部分降为 warn，逐个文件修完再恢复 error。

## 常见报错

| 报错原文 | 原因 | 修法 |
|---|---|---|
| `ESLint couldn't find an eslint.config.* file.` | 只有 `.eslintrc.*` | 新建 `eslint.config.mjs` |
| `was not found by the project service` | 文件不在 tsconfig 的 `include` 里 | 加进 `include`，或配 `allowDefaultProject` |
| `Could not find "ban-types" in plugin "@typescript-eslint"` | 规则在 v8 被删除 | 换 28.6 表里的替代规则 |
| `Invalid option '--ignore-path'` | ESLint 10 移除该参数 | 用 `globalIgnores()` |
| `requires type information, but don't have parserOptions set` | 类型规则没有配 `projectService` | 加 `projectService: true` |
| `typescript-eslint does not support TS 7.0.` | TS 版本超出支持范围 | 别名安装 TS 6 API，见「TypeScript 7 的兼容问题」 |

判断顺序可以按报错位置走。`ESLint couldn't find` 是配置没找到；`0:0` 的 Parsing error 是解析器或 tsconfig 的问题；带规则名的错误才是规则本身。三种情况改的地方完全不同，先分类能省很多时间。

退出码也能帮忙。0 是全部通过，1 是有 lint 错误，2 是配置或运行错误。脚本里判断退出码等于 2 时应该直接失败并打印日志，不要当成普通 lint 失败去改代码。

## 与 tsc 的分工

ESLint 与 tsc 检查的东西不重叠。tsc 负责类型关系：赋值兼容、泛型约束、null 检查、模块解析。ESLint 负责类型之外的约定：未处理的 Promise、any 的传播、命名风格、导出顺序。

分工写在 CI 里就是两个命令，不是一条。`eslint . && tsc --noEmit` 谁先跑都行，但两者都要出现在流水线里，不能只留一个。

同一段代码两边都可能报。调用 async 函数不加 await，tsc 不报，只有 ESLint 的 `no-floating-promises` 报。把 string 赋给 number，tsc 报 TS2322，ESLint 不报。CI 里两条命令都要跑，缺一条就漏一类问题。

`projectService` 会让 ESLint 读 tsconfig，但读到的只是文件范围和少量编译选项，不做完整类型检查。tsconfig 写错时，ESLint 可能先报解析错误，也可能用默认配置继续跑。改完 tsconfig 先跑一次 tsc，再跑 ESLint，报错归属才清楚。

编辑器里同理。保存时由 ESLint 扩展修规则问题，类型错误由语言服务显示。两边都开时，同一个文件可能同时出现红线和黄线，看消息来源区分。

规则数量不代表检查强度。`recommendedTypeChecked` 的 118 条规则里，真正需要类型的只有一部分，但这部分能抓到异步和 any 相关的错误。规则全开、类型检查关掉，得到的是格式偏好，不是正确性。

性能上可以错开。类型检查与 lint 都吃 CPU，本地开发不必每次全量。CI 里拆成两个 job，失败信息更清楚，缓存也各自独立。

大仓库 typed lint 的常见瓶颈在 tsconfig 拆分。一个 tsconfig 覆盖全部源码时，每个文件都进同一个 program。按目录拆 project references 后，projectService 只加载命中文件所属的那个。拆分属于工程配置，不属于 lint 规则。

拆完要验证一遍。`npx eslint . --print-config` 只能看单个文件，范围的正确性靠实际 lint 全仓库来确认。漏掉的目录不会报错，只是不被检查。

规则冲突要一次清完。core 与 typescript-eslint 存在多对同名规则，交接方向固定：用 typescript-eslint 的版本，core 的关掉。自己写 `rules` 覆盖时，注意别又把 core 打开。同名规则同时开，同一行代码可能报两次，级别还可能不同。

## 验收

提交前跑三条命令：

```bash
npx eslint --version
npx eslint .
npx tsc --noEmit
```

第一条确认版本是 10.x。第二条要零错误、零 warning，退出码 0。第三条类型检查通过。三条都过再提交，CI 上的结果才一致。

本地跑和 CI 跑要用同一条命令、同一个 Node 版本。编辑器里的结果只作参考，扩展缓存过旧时会和命令行不一致。

## 用不上的时候

### 只想要格式化

缩进、引号、换行交给 Prettier。ESLint 再开格式规则只会和 Prettier 打架。

### 类型感知规则

`recommendedTypeChecked` 需要类型信息，大仓库全量跑很慢。可以只对改动文件跑，或放进 CI。

### 小项目

几个文件的脚本用默认规则即可，不必接 typescript-eslint 全家桶。

## 参考

- [ESLint 10 迁移指南](https://eslint.org/docs/latest/use/migrate-to-10.0.0)：flat config 与移除项的一手说明。
- [typescript-eslint 文档](https://typescript-eslint.io/)：当前版本、flat config 要求。
- [typescript-eslint 共享配置](https://typescript-eslint.io/users/configs)：recommended、recommendedTypeChecked 等预设。
- [typescript-eslint issue #10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)：TS 7 兼容进度，正文报错输出里提到过。
