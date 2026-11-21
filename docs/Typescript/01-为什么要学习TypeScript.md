# 第 1 章 为什么要学习 TypeScript

你在维护一个几千行的 JavaScript 项目，改了函数参数顺序，测试没覆盖到的调用点一路跑到线上才报错。TypeScript 把这类检查提前到编辑器和 CI 里。这一章说明它解决什么问题、哪些项目值得引入，以及引入后要付什么代价。

## 一句话说清

类型只活在检查器里，产物里看不到。把类型想成上路前的检查站，车过站之后没有留下标记。

```ts
const port: number = 8080;
```

`tsc` 输出 `const port = 8080;`，冒号和类型都不见了（本书用 7.0.2 实测）。

有几种语法不守这条规则：`enum`、带运行时逻辑的 `namespace`、构造函数参数属性、装饰器，它们会留下代码。Node 直接运行 `.ts` 时恰好不支持这几样，原因见第 33 章。

`as` 断言也不改变运行时，它只让检查器放过这一次。报错来自工具，不来自运行时。

## TypeScript 是什么

TypeScript（简称 TS）是微软开发的开源编程语言。它在 JavaScript 的语法之上加了静态类型系统，通常被称为 JavaScript 的**超集（Superset）**。

这个说法只到语法层，不等于接受所有 JavaScript 程序。严格模式禁用的写法在 TS 里直接报错，比如 `with` 报 TS1101，八进制字面量 `010` 报 TS1121。

```
JavaScript + 类型系统 = TypeScript
```

### 编译分四步，类型只在前三步

编译器读一份源码分四步：解析语法树、绑定名字、检查类型、输出 JavaScript。类型只在前三步的内存里存在，第四步写出的文件已经没有它们。

“语法超集”只承诺第一步：解析器接受 JavaScript 的写法。它不承诺通过第三步的检查。把 `function greet(name) { return name; }` 存成 `.ts` 文件，`noImplicitAny` 一开就报 TS7006，而这段代码在 JavaScript 里完全合法。反过来也做不到：如果为了兼容所有 JavaScript 而让隐式 `any` 不报错，检查器对没标注的地方就没有判断依据，类型系统会退化成注释。这也是 `.js` 文件默认不检查、要开 `checkJs` 才查的原因。

运行时也没有类型可查。`interface` 编译后不留痕迹，`instanceof` 需要类（类有运行时形态），`typeof` 只区分 JavaScript 的值。要在运行时区分两种形状，只能自己写判断函数或引校验库。

依据：TS1101、TS1121 两条报错可在 7.0.2 下当场复现。`noImplicitAny` 的行为见这一章「起步最常撞的三个报错」。

还有一个常见误解：类型错误也算编译错误，所以 `tsc` 不通过就没有产物。默认不是这样，`tsc` 遇到类型错误仍会写出 JavaScript，只有打开 `noEmitOnError` 才拦住。类型检查失败不阻止输出，反过来证明标注不进入运行，检查只是把问题提前。

TypeScript 由 Anders Hejlsberg（也是 C# 和 Turbo Pascal 的设计者）主导开发，2012 年首次公开发布，2014 年发布 1.0 版本，2023 年 3 月发布 5.0，2026 年 3 月发布 6.0，同年 7 月发布 [7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)。本书写作时 npm 上的 latest 是 7.0.2，7.1 处于 beta。各版公告都在[官方博客](https://devblogs.microsoft.com/typescript/)上。

## 为什么需要类型系统

JavaScript 是一门**动态类型语言**，变量的类型在运行时才能确定：

```javascript
let message = "hello";
message = 42;     // 完全合法，但可能埋下 bug
message.foo();    // 运行时才会报错：TypeError  // error TS2339: Property 'foo' does not exist on type 'string'.
```

这种灵活性在小项目中有利于快速迭代，规模上来后问题变多。最常见的运行时错误集中在三处：

- `Cannot read property 'xxx' of undefined`
- `undefined is not a function`
- `Cannot read property 'xxx' of null`

这些错误大都和空值、拼错属性名有关，把值声明成具体类型就能在编译阶段拦住一部分。来自接口、表单、`localStorage` 的数据仍然要在运行时校验，类型不会替你做。

TypeScript 的类型系统在**编译时**（而非运行时）检查代码，在你写下代码的瞬间就告诉你哪里可能出问题。同一段代码存成 `.ts` 文件，两个错误会立刻出现，真实输出与改法见这一章「起步最常撞的三个报错」。

## TypeScript 的核心价值

### 1. 提前发现错误

类型系统在你的代码运行之前就验证数据类型流转是否正确，将大量运行时错误消灭在编码阶段。

### 2. 强大的编辑器支持

得益于类型信息，IDE 可以提供：

- **智能补全**：输入 `.` 时精确提示可用的属性和方法
- **重构支持**：安全地重命名变量、提取函数，自动更新所有引用
- **即时代码提示**：鼠标悬停即可看到变量的完整类型信息
- **跳转定义**：快速定位类型和函数的定义位置

### 3. 代码即文档

类型标注本身就是最好的文档：

```typescript
function fetchUser(id: number): Promise<{
  name: string;
  email: string;
  createdAt: Date;
}> {
  // 返回类型写清楚，调用处不用翻实现
  throw new Error("未实现");
}
```

### 4. 更好的架构设计

类型系统迫使你在编码前思考数据的结构，这自然引导出更好的模块设计和更清晰的接口边界。

## 起步最常撞的三个报错

```ts
let message: string = "hello";
message = 42;
message.foo();
function greet(name) {
  return name;
}
```

编译这段代码，先撞 TS2322，再撞 TS2339，最后是 TS7006。原文照抄，文件名换成本书的示例文件：

- `e01.ts(2,1): error TS2322: Type 'number' is not assignable to type 'string'.` 赋值方向反了，右边的值必须能装进左边的类型。改法：确实要存两种类型就写 `string | number`，不然别中途塞数字。
- `e01.ts(3,9): error TS2339: Property 'foo' does not exist on type 'string'.` 类型上没有这个成员。常见原因是拼错了，或者变量根本不是你以为的类型。改法：确认 `message` 的类型，删掉不存在的调用。
- `e01.ts(4,16): error TS7006: Parameter 'name' implicitly has an 'any' type.` 参数没标注，`noImplicitAny` 拒绝替你猜。改法：写 `name: string`。

## TypeScript 的代价

几个绕不开的成本：

- **学习曲线**：类型系统本身有相当的复杂度
- **额外的类型代码**：需要编写类型标注和类型声明
- **工具链**：类型检查要跑 `tsc`，CI 里多一步。Node 22.6 之后可以直接运行 `.ts`（见 [Node 的类型剥离文档](https://nodejs.org/api/typescript.html)），但只剥离类型、不检查类型，真正的检查仍要 `tsc`
- **灵活性降低**：某些 JavaScript 的动态模式需要额外的类型体操来表达

从项目整个生命周期看，这些投入在规模变大后会摊薄。

## TypeScript 与 JavaScript 的关系

TypeScript 对 JavaScript 的改动分为两部分：

1. **类型部分**（编译时擦除）：类型标注、`interface`、泛型、类型工具等，编译后全部删除。例外是 `enum`、带运行时逻辑的 `namespace`、构造函数参数属性、装饰器，它们会留下代码
2. **语法部分**（按 `--target` 决定）：可选链 `?.`、空值合并 `??`、`#private` 早已进入 ECMAScript 标准，`tsc` 只是根据目标决定降级还是原样输出。装饰器是例外，TS 的实现与 TC39 提案并不相同，Node 剥离也不支持

最终运行的仍是 JavaScript：

```
TypeScript 源码 → tsc 编译 → JavaScript 代码
```

TypeScript 没有另起炉灶：标准库对象都有现成类型声明，语法上除严格模式禁用的少数写法外都能直接写。

## 这本书怎么组织

全书 49 章，分八部分：

| 部分 | 章节 | 讲什么 |
|---|---|---|
| 一 基础 | 01–08 | 类型标注、函数、接口、类 |
| 二 类型进阶 | 09–13 | 断言、联合交叉、泛型 |
| 三 类型编程 | 14–20 | 映射、条件、`infer`、工具类型 |
| 四 工程实践 | 21–30 | 配置、模块、框架、ESLint |
| 五 机制与诊断 | 31–34 | 报错、模块解析、Node 原生运行、类型性能 |
| 六 交付与演进 | 35–40 | 发布类型、迁移、工具链、升级 |
| 七 类型体操与元数据 | 41–46 | 递归、解析器、类型测试、装饰器元数据、运行时闭环、设计模式 |
| 八 原理与心智模型 | 47–49 | 检查器内部、把类型当集合、7.0 的 Go 重写 |

第一次读按顺序看前四部分。第 31 章之后是诊断手册，遇到具体问题再翻。

> 提示：遇到不理解的类型错误时，先看错误码，别急着用 `any`。第 31 章按错误码列了最小复现和改法。

## 用不上的时候

### 一次性脚本与胶水代码

几十行、用完即弃的脚本，写 `.ts` 得配 `tsc`、`tsx` 或较新的 Node，收益抵不过成本。

### 类型声明长期没人维护

声明包或手写类型落后于实现时，编辑器给出的类型是错的，比没有类型更容易误导人。

### 数据来自外部

接口返回值、表单、`localStorage` 的内容在运行时仍需校验。类型只覆盖编译期，`as` 不会替你检查。

## 参考

- [TypeScript 7.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)：6.0 默认值、7.0 移除清单，以及文中版本时间线的后续。
- [TypeScript 5.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/)：2023 年 3 月这一版的原始说明。
- [Node.js 的类型剥离文档](https://nodejs.org/api/typescript.html)：哪些语法能直接跑、哪些不能，以及版本节点。
- [TypeScript Handbook 开篇](https://www.typescriptlang.org/docs/handbook/intro.html)：官方对「TypeScript 是 JavaScript 的超集」的原始表述。
