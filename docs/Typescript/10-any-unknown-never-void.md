# 第 10 章 any、unknown、never、void

`catch (e)` 里的 `e` 是 `unknown`，直接读 `e.message` 报 TS18046；分支写全后 `never` 让遗漏分支报错。这四个特殊类型决定类型检查的松紧。这一章讲它们的语义差别和使用边界。

前面章节我们接触了 `string`、`number`、`boolean` 等基础类型，以及对象、数组、元组等结构化类型。这些类型覆盖了日常开发中的绝大多场景。但在某些情况下，我们需要表达"任意类型""未知类型""不会出现的类型"或"没有意义的返回值"：这就涉及下面四个特殊类型：`any`、`unknown`、`never`、`void`（[TypeScript Handbook：Basic Types](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)）。

理解这四个类型不仅有助于编写类型安全的代码，更是理解 TypeScript 类型系统全貌的关键，它们占据了类型层级中的两个极端位置：**Top Type** 和 **Bottom Type**。

一句话：`any` 是“别查了”，`unknown` 是“先查再用”。

`JSON.parse("1")` 返回 `any`，`JSON.parse("1").foo.bar()` 编译通过，运行时才炸；把同一个返回值标成 `unknown`，`u.foo` 立刻报 TS18046。

这个说法只在检查器内部成立：`any` 不产生任何类型事实，`unknown` 会留下“这里还没检查”的记录，两者运行时都是原来的值。

## any：身化万千，无处不在

`any` 是 TypeScript 中能力最强大、也最危险的类型。用拟人化的方式理解：**`any` 就像是"我身化万千，无处不在"**，所有类型都把它当自己人，它也把所有类型当自己人。被标记为 `any` 的变量可以做任何事，TypeScript 不会对它进行任何类型检查。类型世界给你开了一个外挂，当然，运行时出了问题需要你自己负责。

### any 的来源

显式声明：
```typescript
let x: any = "hello";
x = 42;           // 正确
x.toFixed();      // 正确
x.foo.bar.baz();  // 正确：完全无检查
```

隐式推导（当 `noImplicitAny` 关闭或推导失败时）：
```typescript
// 声明变量不提供初始值 → 推导为 any
let foo;  // any

// 函数参数不标注类型 → 推导为 any
function func(x, y) {  // x: any, y: any
  return x + y;
}
```

如果你开启了 `strict: true`（包含了 `noImplicitAny`），上面的隐式 `any` 会直接报错。这是每个 TypeScript 项目都应该开启的配置。

### AnyScript 警告

`any` 的万能性导致它极易被滥用（类型不兼容了 `any` 一下，不想写了 `any` 一下，不知道啥类型 `any` 一下。久而久之，你的 TypeScript 就退化成了 **AnyScript**），挂着 TS 的牌子写 JS，类型系统形同虚设。

要避免这种退化，记住三条原则：

- **类型不兼容导致你想用 any** → 考虑用类型断言替代
- **类型太复杂不想全写导致你想用 any** → 断言为你需要的最简类型（你只需要调 `.bar()` 就把那一处断言为 `{ bar: () => void }` 即可）
- **不确定类型导致你想用 any** → 用 `unknown`，它同样接受任意值但不会破坏类型检查

### any 的类型兼容性：完全双向

`any` 类型的变量可以赋值给**任何类型**的变量，也可以接受**任何类型**的值：

```typescript
let anyVar: any = "hello";

// any 可以赋值给任意类型
const s: string = anyVar;    // 正确
const n: number = anyVar;    // 正确
const fn: () => void = anyVar;  // 正确

// any 可以接受任意类型的值
anyVar = 42;
anyVar = true;
anyVar = { name: "Alice" };
```

在类型系统层面，`any` 既是所有类型的子类型，也是所有类型的父类型：它打破了类型层级的一切约束。这意味着一旦你在类型链的任何地方引入 `any`，类型安全就会被它"穿透"。

### 检查器遇到 any 直接放行

`any` 带 `TypeFlags.Any` 标记。可赋值性检查只要发现源或目标带这个标记，直接返回 true，不再逐成员比较。属性访问和调用走同一条捷径：`checkPropertyAccessExpressionOrQualifiedName` 先算 `apparentType`，是 any 就返回 `anyType`，成员在不在根本不查。（`src/compiler/checker.ts` 34885 行到 34889 行）

`unknown` 走反方向。它同样是顶层类型，但没有这个标记，每个操作前都要过非空检查。`checkNonNullTypeWithReporter` 发现类型是 unknown 时，被检查的是标识符就报 TS18046 并带上变量名；是调用结果、断言表达式这类没名字的表达式就报 TS2571。（34697 行到 34705 行）两条报错是同一件事，差别只在检查器能不能把名字写进消息。

赋值方向也不同。`any` 两个方向都通，`unknown` 只能当源，赋给具体类型先要收窄，否则报 TS2322。这也是 `any` 会传染的原因：`any[]`、`Promise<any>`、索引签名里的 any 把标记带进后面每一层推导，每遇到一次就短路一次。

短路的位置决定传染范围。`Array<any>` 的元素访问结果是 any，`Promise<any>` 的 await 结果也是 any，链式调用一路都是 any，直到赋给具体类型才报一次错。项目里把 `JSON.parse` 的返回值留成 any，等于让后面的字段校验全部失效；换成 unknown 再写一个解析函数，错误会在真正越界的那一行出现。

反过来把 unknown 也做成短路，就没有安全网了：所有操作都通过，检查器只是换了个名字的 any。官方 [TypeScript 3.0 发布说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-0.html) 把 unknown 定位成 any 的安全替代，代价就是每次使用前必须收窄。

### any 的正确使用场景

尽管 `any` 危险，它也有合理的使用场景：

1. **渐进式迁移**：将 JavaScript 项目迁移到 TypeScript 时，用 `any` 做临时占位符
2. **第三方无类型库**：调用没有 `@types` 的第三方库时（虽然更好的做法是写 `.d.ts` 声明）
3. **真正的动态逻辑**：少数实在无法用类型表达的 JavaScript 模式（如 `console.log(...args: any[])`）

如果不是上面的场景，考虑用更安全的替代方案。

### any 的替代方案

如果只是因为不想写复杂的类型就用 `any`，更好的选择是：
- **类型不兼容想绕过报错** → 用类型断言 `as Type`
- **类型太复杂不想全写** → 把那一处断言为最简需要的类型
- **不确定是什么类型** → 用 `unknown`

## unknown：安全的"任意类型"

`unknown` 和 `any` 一样可以接受任意类型的值，但**不能随意使用**：在对 `unknown` 做任何操作之前，必须先收窄它的类型（[TypeScript Handbook：Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)）。

### unknown vs any

```typescript
let unknownVar: unknown = "hello";
unknownVar = 42;             // 正确：可以接受任意值
unknownVar = { a: 1 };       // 正确

// 但使用时受限：
// unknownVar.toUpperCase();  // error TS18046: 'unknownVar' is of type 'unknown'.
// unknownVar.foo.bar;  // error TS18046: 'unknownVar' is of type 'unknown'.
// const s: string = unknownVar;  // error TS2322: Type 'unknown' is not assignable to type 'string'.
```

要使用 `unknown` 的值，必须先通过类型守卫收窄：

```typescript
let unknownVar: unknown = "hello";

// 方式一：typeof 收窄
if (typeof unknownVar === "string") {
  console.log(unknownVar.toUpperCase());  // 正确
}

// 方式二：类型断言
(unknownVar as string).toUpperCase();

// 方式三：自定义类型守卫
function isString(val: unknown): val is string {
  return typeof val === "string";
}
if (isString(unknownVar)) {
  console.log(unknownVar.toUpperCase());
}
```

### 类型兼容性

`unknown` 只能赋值给 `unknown` 和 `any`：

```typescript
let u: unknown = "hello";
let a: any = u;         // 正确
let u2: unknown = u;    // 正确

// let s: string = u;  // error TS2322: Type 'unknown' is not assignable to type 'string'.
// let n: number = u;  // error TS2322: Type 'unknown' is not assignable to type 'number'.
```

这个限制正是 `unknown` 的价值：它阻止你在不经验证的情况下使用一个未知类型的值。

和 `any` 对比，二者的区别可以用同一套拟人化语言表达：

- **`any`**：身化万千，无处不在，所有类型都把它当自己人，它也是所有类型的自己人
- **`unknown`**：虽然身化万千，但我坚信在未来的某一刻会得到一个确定的类型，只有 `any` 和 `unknown` 把它当自己人

简单说：`any` 放弃了所有的类型检查，而 `unknown` 没有。用 `unknown` 相比 `any` 确实更麻烦（需要写类型守卫或类型断言），但这份麻烦是值得的，因为它保留了类型安全。

### 实践建议

当你不确定一个值的类型时，**永远优先用 `unknown` 而非 `any`**。这个简单的选择能把运行时错误从"神秘的 undefined is not a function"变成"编译时你必须先检查类型"。

常见的 `unknown` 使用场景：

```typescript
// 解析 JSON：结果类型未知
const data: unknown = JSON.parse(response);

// API 响应：在验证结构前类型未知
async function fetchData(): Promise<unknown> {
  const res = await fetch("/api/data");
  return res.json();
}

// 错误捕获：catch 中的 error 是 unknown（TS 4.0+）
try {
  // ...
} catch (e: unknown) {
  if (e instanceof Error) {
    console.error(e.message);
  } else {
    console.error(String(e));
  }
}
```

TypeScript 4.0 起，`catch` 子句中的 `error` 类型从 `any` 改为 `unknown`；TypeScript 4.4 又加入 `useUnknownInCatchVariables` 开关并把它归入 `strict` 家族，所以只有在开启 `strict`（或显式打开该选项）时 `e` 才是 `unknown`。如果你的项目中 `catch (e)` 中的 `e` 还是 `any`，说明 `tsconfig` 没有开启 `strict`（或显式设了 `useUnknownInCatchVariables: false`）。

### 从 any 到 unknown：渐进迁移模式

如果你的项目中已经散布了大量 `any`，不要指望一次性全部改为精确类型：这样成本极高且容易引入 bug。推荐的迁移路径是**分两步走**：

**第一步：`any` → `unknown`**

先把所有"不确定类型"的 `any` 替换为 `unknown`。这一步相对安全：`unknown` 强迫你在使用前做类型收窄，所以你能立刻看到所有依赖这个 `any` 的地方：

```typescript
// 迁移前：数据进来就是 any，下游随意使用
let data: any = fetchFromAPI();
const name = data.user.name;  // 没有任何检查，炸在运行时

// 迁移后：数据进来是 unknown，下游必须收窄
let data: unknown = fetchFromAPI();
// const name = data.user.name;  // error TS18046: 'data' is of type 'unknown'.

if (
  typeof data === "object" &&
  data !== null &&
  "user" in data &&
  typeof (data as any).user === "object"
) {
  const user = data as { user: { name: string } };  // 显式收窄
}
```

**第二步：`unknown` → 精确类型**

为已知的数据结构编写接口，用类型守卫或运行时校验库（如 zod）替代手动收窄：

```typescript
import { z } from "zod";

const UserSchema = z.object({
  user: z.object({ name: z.string() }),
});

let data: unknown = fetchFromAPI();
const parsed = UserSchema.parse(data);  // 运行时校验 + 精确类型推导
// parsed 的类型是 { user: { name: string } }
```

这套两阶段迁移路径在大型 JS→TS 项目中已经被反复验证：**先用 `unknown` 止血，再用精确类型根治**。

### unknown 的三个报错

`unknown` 的报错全部出现在“用”的位置。复现文件：

```ts
declare const u: unknown;
u.foo;

declare function getUnknown(): unknown;
getUnknown().bar;

function takesString(s: string): void {}
takesString(u);
```

```text
anyu.ts(2,1): error TS18046: 'u' is of type 'unknown'.
anyu.ts(5,1): error TS2571: Object is of type 'unknown'.
anyu.ts(8,13): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.
```

TS18046 说这个标识符还没被检查过，先按 `typeof` 分支收窄再访问字段。

TS2571 是同一个问题换了对象：`getUnknown().bar` 的左边是调用结果，检查器没有名字可写；先把结果存进变量并收窄。

TS2345 说 unknown 不能当 `string` 参数传，调用前先判断类型，或者把参数签名改成 `unknown` 在函数内部收窄。

三条报错都出在“用”之前，把收窄写在使用之前就能消掉。`unknown` 与 `never` 的边界也在这里：never 是所有类型的子类型，赋给谁都不报错；unknown 是顶层类型，只能接收，不能直接使用。

## never：永远不会发生的类型

`never` 是所有类型中最特殊的一个：它表示**永远不会出现的类型**。如果说 `any` 是类型层级的顶端（Top Type），`never` 就是底端（Bottom Type）。

### never 的含义与产生

`never` 的主要来源有几个：

**1. 永远不会返回的函数**

```typescript
// 抛错函数：不会有正常的返回值
function throwError(message: string): never {
  throw new Error(message);
}

// 无限循环：永远不会执行到 return
function infiniteLoop(): never {
  while (true) {
    // ...
  }
}
```

**2. 类型守卫排空了所有可能**

```typescript
function process(value: string | number) {
  if (typeof value === "string") {
    // value: string
  } else if (typeof value === "number") {
    // value: number
  } else {
    // 在这里，value 的类型是 never
    // 因为 string | number 已经穷尽了
    const _check: never = value;
  }
}
```

**3. 交叉类型冲突**

```typescript
// string 和 number 的交集是空集 → never
type Impossible = string & number;
// 等价于 never
```

### never 的类型兼容性

`never` 是**所有类型的子类型**（可以赋值给任何类型），但**没有任何类型可以赋值给 `never`**（never 自身除外）：

```typescript
declare let n: never;

let s: string = n;    // 正确：never 可以赋值给任意类型
let a: any = n;       // 正确
let u: unknown = n;   // 正确

// n = "hello";  // error TS2322: Type '"hello"' is not assignable to type 'never'.
// n = 42;  // error TS2322: Type '42' is not assignable to type 'never'.
n = (() => { throw new Error(); })();  // 正确：只有 never 才能赋给 never
```

### never 在联合类型中消失

`never` 在联合类型中会被自动消除：它不携带任何类型信息：

```typescript
type T = string | number | never;
// 等价于 string | number

type U = never | never;
// 等价于 never
```

这个特性在条件类型和工具类型的实现中非常重要（第 16 章会详细展开）。

### void vs never

`void` 表示"这里的值**没有意义**"，而 `never` 表示"这里的值**永远不会存在**"：

```typescript
// void：函数正常返回，但没有有意义的返回值
function log(msg: string): void {
  console.log(msg);
  // 隐式返回 undefined
}

// never：函数根本不会正常返回
function abort(message: string): never {
  throw new Error(message);
}
```

关键区别在于：`void` 类型的函数是会执行完毕的（隐式返回 `undefined`），而 `never` 类型的函数永远不会执行到 `return` 语句：要么抛错，要么无限循环。

类型兼容性的区别：

```typescript
declare let v1: void;
declare let v2: never;

// 赋值只在一个方向上成立
// v1 = v2;  // 正确：never 是底部类型，可以赋给任何类型（包括 void）
// v2 = v1;  // error TS2322: Type 'void' is not assignable to type 'never'.
```

在联合类型中，`void` 不会消失（它有类型信息），而 `never` 会消失：

```typescript
type T1 = string | number | void;   // string | number | void
type T2 = string | number | never;  // string | number (never 消失了)
```

## void：无意义的返回值

`void` 是 TypeScript 中用于表示"返回值没有意义"的类型。它最常见的用法是作为**没有返回值的函数的返回值类型**。

### void 的基本用法

```typescript
// 不返回值的函数
function greet(name: string): void {
  console.log(`Hello, ${name}`);
}

// 箭头函数
const log = (msg: string): void => {
  console.log(msg);
};
```

在 JavaScript 中，不写 `return` 的函数实际上返回 `undefined`。TypeScript 中 `void` 表达的正是"这个返回值不要用，没有意义"：

```typescript
function greet(name: string): void {
  console.log(`Hello, ${name}`);
}

const result = greet("Alice");
// result 类型是 void
// 你仍然可以 console.log(result)，运行时会输出 undefined
// 但 TypeScript 在语义上告诉你：不要依赖这个返回值
```

### void 与 undefined 的关系

在 TypeScript 中，`void` 和 `undefined` 不是同一个类型：

```typescript
function returnNothing(): void {
  // 隐式返回 undefined
}

function returnUndefined(): undefined {
  return undefined;  // 必须显式写 return undefined
}
```

类型兼容性上：
- 在 `strictNullChecks` **关闭**时，`void` 和 `undefined` 可以互相赋值
- 在 `strictNullChecks` **开启**时，赋值方向是单向的：`undefined` 可以赋给 `void`，但 `void` 不能赋给 `undefined`，即 `undefined` 是 `void` 的子类型，反过来不成立

```typescript
// strictNullChecks 开启时
let v: void;
let u: undefined;

// v = u;  // 正确：undefined 可以赋给 void
// u = v;  // error TS2322: Type 'void' is not assignable to type 'undefined'.
```

### 函数类型中的 void 的特殊行为

在函数类型签名中，`void` 返回值有一个特殊的行为：**返回非 `void` 值的函数也可以赋值给返回 `void` 的函数类型**：

```typescript
type VoidFunc = () => void;

const f1: VoidFunc = () => { return "hello"; };  // 正确：返回 string
const f2: VoidFunc = () => { return 42; };       // 正确：返回 number
const f3: VoidFunc = () => { return true; };     // 正确：返回 boolean
```

这是刻意设计的：它让回调函数的使用更加方便。比如 `Array.forEach` 的回调接受返回 `void` 的函数，但你传入一个返回值的函数也不会有问题：

```typescript
const nums = [1, 2, 3];
// forEach 期望一个返回 void 的回调
nums.forEach(n => n * 2);  // 正确：即使箭头函数隐式返回 n*2

// 等价于
nums.forEach((n) => { n * 2; });  // void
```

如果 TypeScript 不允许这种行为，则每次给 `forEach` 传箭头函数时都需要显式加 `{ }` 包裹以消除隐式返回，非常繁琐。

## Object、object 和 {}

这三个名字容易混淆，但它们代表完全不同的概念。

### object（小写）

小写 `object` 表示**任何非原始类型的值**（即不是 `string`、`number`、`boolean`、`symbol`、`null`、`undefined` 的值）：

```typescript
let obj: object;

obj = { name: "Alice" };  // 正确
obj = [1, 2, 3];          // 正确：数组也是 object
obj = () => {};           // 正确：函数也是 object
obj = new Date();         // 正确

// obj = "hello";  // error TS2322: Type 'string' is not assignable to type 'object'.
// obj = 42;  // error TS2322: Type 'number' is not assignable to type 'object'.
// obj = undefined;  // error TS2322: Type 'undefined' is not assignable to type 'object'.
```

`object` 在实际项目中用得不多：它"过于宽泛"。几乎所有对象相关的 API 都需要更具体的结构信息。

### Object（大写）

大写 `Object` 是 JavaScript 中所有对象的**装箱类型（Boxed Type）**的基类。它包含了 `toString()`、`valueOf()` 等基础方法：

```typescript
let obj: Object;

obj = { name: "Alice" };  // 正确
obj = "hello";             // 正确：原始类型可以赋值给 Object，因为会被自动装箱
obj = 42;                  // 正确：同理
// obj = undefined;  // error TS2322: Type 'undefined' is not assignable to type 'Object'.
```

**不要使用 `Object` 作为类型标注**：它是历史遗留产物，行为混乱且不精确。它的类型兼容性几乎等同于 `{}`，但在某些边界场景有细微差别。

### `{}`（空对象类型）

`{}` 表示一个**有 `toString()`、`valueOf()` 等基础方法但没有任何自有属性的对象类型**：

```typescript
let empty: {};

empty = { name: "Alice" };  // 正确：结构类型系统下多出属性是允许的
empty = "hello";             // 正确：字符串有 toString，满足 {}
empty = 42;                  // 正确：数字有 toString
empty = [1, 2, 3];           // 正确
// empty = null;  // error TS2322: Type 'null' is not assignable to type '{}'.
// empty = undefined;  // error TS2322: Type 'undefined' is not assignable to type '{}'.
```

`{}` 的行为非常接近 `Object`，但更"正常"一些。不过在实际项目中几乎不需要显式使用 `{}`：如果真的需要"任何非 null/undefined 的值"，用 `NonNullable<unknown>` 或直接收窄 `unknown` 更合适。

### 快速对照表

| 类型 | 接受原始值 | 接受对象 | 常用度 | 推荐 |
|------|----------|---------|--------|------|
| `object` | ❌ | ✅ | 低 | 极少使用 |
| `Object` | ✅ | ✅ | 低 | **避免使用** |
| `{}` | ✅ | ✅ | 低 | 用更精确的类型替代 |

## 类型层级

把赋值方向排出来，这些类型的位置就清楚了。下面每条都能用条件类型当场验证，注释里的数字是实际结果。

```typescript
type V1 = string extends {} ? 1 : 2;        // 1
type V2 = string extends object ? 1 : 2;    // 2
type V3 = string extends Object ? 1 : 2;    // 1
type V4 = {} extends object ? 1 : 2;        // 1
type V5 = object extends {} ? 1 : 2;        // 1
type V6 = undefined extends void ? 1 : 2;   // 1
type V7 = void extends undefined ? 1 : 2;   // 2
type V8 = null extends {} ? 1 : 2;          // 2
type V9 = never extends string ? 1 : 2;     // 1
type V10 = string extends never ? 1 : 2;    // 2
type V11 = unknown extends string ? 1 : 2;  // 2
type V12 = string extends unknown ? 1 : 2;  // 1
```

| 类型 | 能接收的值 | 能赋给谁 | 怎么用 |
|---|---|---|---|
| `unknown` | 全部 | 只有 `unknown` 和 `any` | 外部输入的默认类型，用之前先收窄 |
| `any` | 全部 | 全部 | 只在迁移或与无类型的库对接时短期使用 |
| `never` | 没有值 | 全部 | 穷尽检查、抛错函数的返回类型 |
| `void` | `undefined` | 只有 `unknown`、`any` | 只做函数返回类型；返回别的值的函数也能赋给它 |
| `{}` | 除 `null`、`undefined` 外的全部，含原始类型 | `object`、`Object`、`unknown`、`any` | 少用，需要时用 `NonNullable<unknown>` 更直白 |
| `object` | 非原始类型（对象、数组、函数） | `{}`、`Object`、`unknown`、`any` | 需要"任意非原始值"时用 |
| `Object` | 全部，原始类型会装箱 | `{}`、`object`、`unknown`、`any` | 别用，是历史遗留 |
| `null` / `undefined` | 只有自身 | 自身、`any`、`unknown`（`undefined` 还能给 `void`） | 配合 `strictNullChecks` 收窄 |

两个容易被顺序误导的地方：

- `{}` 和 `object` 互相能赋值（V4、V5 都是 1），但值域不同。`string` 能赋给 `{}`，不能赋给 `object`（V1、V2）。所以它们不是父子关系。
- `never` 在赋值方向的最下层（V9 成立），但没有任何值能赋给它（V10 不成立）。它表示"这里不会有值"，不是"最小的值"。

交叉类型、联合类型和函数类型在层级里的位置放在第 18 章。

## 小结

- **`any`** 是万能类型，跳过一切检查。只用在不写不行的极端场景
- **`unknown`** 是 `any` 的安全替代：接受任意值但不让随意使用，强制先收窄
- **`never`** 是 Bottom Type，表示不可能出现的类型。在联合类型中消失，用于穷尽检查和抛错函数
- **`void`** 表示返回值没有意义。函数类型中特别宽容：返回任意值的函数都可以赋值给 `void` 返回类型
- 小写 `object` 表示非原始类型，大写 `Object` 是历史遗留应避免，`{}` 行为接近 `Object`
- 类型层级上：`unknown` 是 Top Type，`never` 是 Bottom Type，`any` 双向兼容

## 用不上的时候

### 迁移期的边界

`allowJs`、第三方库没有类型时，`any` 是暂时的口子。长期保留 `any` 的地方等于没有类型检查。

### 只想表示「可能为空」

`void` 表示返回值无意义，不表示空值。空值用 `undefined` 或 `null`，混用会让调用方困惑。

### never 用错位置

函数声明返回 `never` 但实际会返回时，调用方其后的代码会被判定为不可达，类型检查也随之中断。

## 参考

- [TypeScript Handbook：Basic Types](https://www.typescriptlang.org/docs/handbook/2/basic-types.html)：any、unknown、never、void 的入门说明。
- [TypeScript Handbook：Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)：unknown 每次使用前如何收窄。
- [TypeScript 3.0 发布说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-0.html)：unknown 作为 any 安全替代的定位。
- [TypeScript 4.4 发布说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html)：useUnknownInCatchVariables：catch 变量默认变成 unknown。
- [TypeScript Design Goals](https://github.com/microsoft/TypeScript/wiki/TypeScript-Design-Goals)：non-goal 里写明类型系统不保证运行时正确，any 的口子由此而来。
