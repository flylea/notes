# 第10章 any、unknown、never、void

前面章节我们接触了 `string`、`number`、`boolean` 等基础类型，以及对象、数组、元组等结构化类型。这些类型覆盖了日常开发中的绝大多场景。但在某些情况下，我们需要表达"任意类型""未知类型""不会出现的类型"或"没有意义的返回值"——这就涉及到本章要讲的四个特殊类型：`any`、`unknown`、`never`、`void`。

理解这四个类型不仅有助于编写类型安全的代码，更是理解 TypeScript 类型系统全貌的关键——它们占据了类型层级中的两个极端位置：**Top Type** 和 **Bottom Type**。

## any——身化万千，无处不在

`any` 是 TypeScript 中能力最强大、也最危险的类型。用拟人化的方式理解：**`any` 就像是"我身化万千，无处不在"**——所有类型都把它当自己人，它也把所有类型当自己人。被标记为 `any` 的变量可以做任何事，TypeScript 不会对它进行任何类型检查。类型世界给你开了一个外挂，当然，运行时出了问题需要你自己负责。

### any 的来源

显式声明：
```typescript
let x: any = "hello";
x = 42;           // ✅
x.toFixed();      // ✅
x.foo.bar.baz();  // ✅ 完全无检查
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

`any` 的万能性导致它极易被滥用——类型不兼容了 `any` 一下，不想写了 `any` 一下，不知道啥类型 `any` 一下。久而久之，你的 TypeScript 就退化成了 **AnyScript**——挂着 TS 的牌子写 JS，类型系统形同虚设。

要避免这种退化，记住三条原则：

- **类型不兼容导致你想用 any** → 考虑用类型断言替代
- **类型太复杂不想全写导致你想用 any** → 断言为你需要的最简类型（你只需要调 `.bar()` 就把那一处断言为 `{ bar: () => void }` 即可）
- **不确定类型导致你想用 any** → 用 `unknown`，它同样接受任意值但不会破坏类型检查

### any 的类型兼容性：完全双向

`any` 类型的变量可以赋值给**任何类型**的变量，也可以接受**任何类型**的值：

```typescript
let anyVar: any = "hello";

// any 可以赋值给任意类型
const s: string = anyVar;    // ✅
const n: number = anyVar;    // ✅
const fn: () => void = anyVar;  // ✅

// any 可以接受任意类型的值
anyVar = 42;
anyVar = true;
anyVar = { name: "Alice" };
```

在类型系统层面，`any` 既是所有类型的子类型，也是所有类型的父类型——它打破了类型层级的一切约束。这意味着一旦你在类型链的任何地方引入 `any`，类型安全就会被它"穿透"。

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

## unknown——安全的"任意类型"

`unknown` 和 `any` 一样可以接受任意类型的值，但**不能随意使用**——在对 `unknown` 做任何操作之前，必须先收窄它的类型。

### unknown vs any

```typescript
let unknownVar: unknown = "hello";
unknownVar = 42;             // ✅ 可以接受任意值
unknownVar = { a: 1 };       // ✅

// 但使用时受限：
// unknownVar.toUpperCase();  // ❌ 不能直接调用方法
// unknownVar.foo.bar;        // ❌ 不能直接访问属性
// const s: string = unknownVar;  // ❌ 不能赋值给其他类型（除 unknown/any）
```

要使用 `unknown` 的值，必须先通过类型守卫收窄：

```typescript
let unknownVar: unknown = "hello";

// 方式一：typeof 收窄
if (typeof unknownVar === "string") {
  console.log(unknownVar.toUpperCase());  // ✅
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
let a: any = u;         // ✅
let u2: unknown = u;    // ✅

// let s: string = u;   // ❌
// let n: number = u;   // ❌
```

这个限制正是 `unknown` 的价值——它阻止你在不经验证的情况下使用一个未知类型的值。

和 `any` 对比，二者的区别可以用同一套拟人化语言表达：

- **`any`**：身化万千，无处不在——所有类型都把它当自己人，它也是所有类型的自己人
- **`unknown`**：虽然身化万千，但我坚信在未来的某一刻会得到一个确定的类型——只有 `any` 和 `unknown` 把它当自己人

简单说：`any` 放弃了所有的类型检查，而 `unknown` 没有。用 `unknown` 相比 `any` 确实更麻烦——需要写类型守卫或类型断言——但这份麻烦是值得的，因为它保留了类型安全。

### 实践建议

当你不确定一个值的类型时，**永远优先用 `unknown` 而非 `any`**。这个简单的选择能把运行时错误从"神秘的 undefined is not a function"变成"编译时你必须先检查类型"。

常见的 `unknown` 使用场景：

```typescript
// 解析 JSON——结果类型未知
const data: unknown = JSON.parse(response);

// API 响应——在验证结构前类型未知
async function fetchData(): Promise<unknown> {
  const res = await fetch("/api/data");
  return res.json();
}

// 错误捕获——catch 中的 error 是 unknown（TS 4.0+）
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

TypeScript 4.0 起，`catch` 子句中的 `error` 默认类型从 `any` 改为 `unknown`。如果你的项目中 `catch (e)` 中的 `e` 还是 `any`，说明 `tsconfig` 可能未设置 `strict`。

### 从 any 到 unknown：渐进迁移模式

如果你的项目中已经散布了大量 `any`，不要指望一次性全部改为精确类型——这样成本极高且容易引入 bug。推荐的迁移路径是**分两步走**：

**第一步：`any` → `unknown`**

先把所有"不确定类型"的 `any` 替换为 `unknown`。这一步相对安全——`unknown` 强迫你在使用前做类型收窄，所以你能立刻看到所有依赖这个 `any` 的地方：

```typescript
// 迁移前：数据进来就是 any，下游随意使用
let data: any = fetchFromAPI();
const name = data.user.name;  // 没有任何检查，炸在运行时

// 迁移后：数据进来是 unknown，下游必须收窄
let data: unknown = fetchFromAPI();
// const name = data.user.name;  // ❌ 编译错误：类型 unknown 上没有 user 属性

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

这套两阶段迁移路径在大型 JS→TS 项目中已经被反复验证——**先用 `unknown` 止血，再用精确类型根治**。

## never——永远不会发生的类型

`never` 是所有类型中最特殊的一个——它表示**永远不会出现的类型**。如果说 `any` 是类型层级的顶端（Top Type），`never` 就是底端（Bottom Type）。

### never 的含义与产生

`never` 的主要来源有几个：

**1. 永远不会返回的函数**

```typescript
// 抛错函数——不会有正常的返回值
function throwError(message: string): never {
  throw new Error(message);
}

// 无限循环——永远不会执行到 return
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
let n: never;

let s: string = n;    // ✅ never 可以赋值给任意类型
let a: any = n;       // ✅
let u: unknown = n;   // ✅

// n = "hello";       // ❌ 其他类型不能赋值给 never
// n = 42;            // ❌
n = (() => { throw new Error(); })();  // ✅ 只有 never 才能赋给 never
```

### never 在联合类型中消失

`never` 在联合类型中会被自动消除——它不携带任何类型信息：

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

关键区别在于：`void` 类型的函数是会执行完毕的（隐式返回 `undefined`），而 `never` 类型的函数永远不会执行到 `return` 语句——要么抛错，要么无限循环。

类型兼容性的区别：

```typescript
declare let v1: void;
declare let v2: never;

// 不可以互相赋值
// v1 = v2;  // ❌ never 不能赋给 void
// v2 = v1;  // ❌ void 不能赋给 never
```

在联合类型中，`void` 不会消失（它有类型信息），而 `never` 会消失：

```typescript
type T1 = string | number | void;   // string | number | void
type T2 = string | number | never;  // string | number (never 消失了)
```

## void——无意义的返回值

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
// 你仍然可以 console.log(result) — 运行时会输出 undefined
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
- 在 `strictNullChecks` **开启**时，`void` 类型的变量不能赋给 `undefined` 类型的变量，反之亦然

```typescript
// strictNullChecks 开启时
let v: void;
let u: undefined;

// v = u;  // ❌
// u = v;  // ❌
```

### 函数类型中的 void 的特殊行为

在函数类型签名中，`void` 返回值有一个特殊的行为：**返回非 `void` 值的函数也可以赋值给返回 `void` 的函数类型**：

```typescript
type VoidFunc = () => void;

const f1: VoidFunc = () => { return "hello"; };  // ✅ 返回 string
const f2: VoidFunc = () => { return 42; };       // ✅ 返回 number
const f3: VoidFunc = () => { return true; };     // ✅ 返回 boolean
```

这是刻意设计的——它让回调函数的使用更加方便。比如 `Array.forEach` 的回调接受返回 `void` 的函数，但你传入一个返回值的函数也不会有问题：

```typescript
const nums = [1, 2, 3];
// forEach 期望一个返回 void 的回调
nums.forEach(n => n * 2);  // ✅ 即使箭头函数隐式返回 n*2

// 等价于
nums.forEach((n) => { n * 2; });  // void
```

如果 TypeScript 不允许这种行为，则每次给 `forEach` 传箭头函数时都需要显式加 `{ }` 包裹以消除隐式返回——非常繁琐。

## Object、object 和 {}

这三个名字容易混淆，但它们代表完全不同的概念。

### object（小写）

小写 `object` 表示**任何非原始类型的值**（即不是 `string`、`number`、`boolean`、`symbol`、`null`、`undefined` 的值）：

```typescript
let obj: object;

obj = { name: "Alice" };  // ✅
obj = [1, 2, 3];          // ✅ 数组也是 object
obj = () => {};           // ✅ 函数也是 object
obj = new Date();         // ✅

// obj = "hello";          // ❌ string 是原始类型
// obj = 42;               // ❌
// obj = undefined;        // ❌
```

`object` 在实际项目中用得不多——它"过于宽泛"。几乎所有对象相关的 API 都需要更具体的结构信息。

### Object（大写）

大写 `Object` 是 JavaScript 中所有对象的**装箱类型（Boxed Type）**的基类。它包含了 `toString()`、`valueOf()` 等基础方法：

```typescript
let obj: Object;

obj = { name: "Alice" };  // ✅
obj = "hello";             // ✅（原始类型可以赋值给 Object，因为会被自动装箱）
obj = 42;                  // ✅（同理）
// obj = undefined;        // ❌
```

**不要使用 `Object` 作为类型标注**——它是历史遗留产物，行为混乱且不精确。它的类型兼容性几乎等同于 `{}`，但在某些边界场景有细微差别。

### `{}`（空对象类型）

`{}` 表示一个**有 `toString()`、`valueOf()` 等基础方法但没有任何自有属性的对象类型**：

```typescript
let empty: {};

empty = { name: "Alice" };  // ✅ 结构类型系统——多出属性是允许的
empty = "hello";             // ✅ 字符串有 toString，满足 {}
empty = 42;                  // ✅ 数字有 toString
empty = [1, 2, 3];           // ✅
// empty = null;             // ❌ strictNullChecks 下
// empty = undefined;        // ❌
```

`{}` 的行为非常接近 `Object`，但更"正常"一些。不过在实际项目中几乎不需要显式使用 `{}`——如果真的需要"任何非 null/undefined 的值"，用 `NonNullable<unknown>` 或直接收窄 `unknown` 更合适。

### 快速对照表

| 类型 | 接受原始值 | 接受对象 | 常用度 | 推荐 |
|------|----------|---------|--------|------|
| `object` | ❌ | ✅ | 低 | 极少使用 |
| `Object` | ✅ | ✅ | 低 | **避免使用** |
| `{}` | ✅ | ✅ | 低 | 用更精确的类型替代 |

## 类型层级全景图

本章介绍的四个类型在 TypeScript 类型层级中占据关键位置：

```
        any / unknown          ← Top Type（顶层）
        ┌─────┴─────┐
        │   Object   │         ← 装箱类型（历史遗留）
        ├───────────┤
        │  string,   │
        │  number,   │         ← 原始类型
        │  boolean…  │
        ├───────────┤
        │ "hello",   │
        │  42,       │         ← 字面量类型（子类型）
        │  true…     │
        ├───────────┤
        │  never     │         ← Bottom Type（底层）
        └───────────┘
```

简要版理解：
- **any / unknown** 包含所有类型（Top Type）
- **never** 是所有类型的子类型（Bottom Type），不包含任何值
- **void** 不在这条层级链上——它是一个独立的"无意义返回值"类型
- **原始类型**包含对应的**字面量类型**，字面量类型是原始类型的子类型

类型层级的完整讨论将在第 18 章展开，包括交叉类型、联合类型和函数类型在层级中的位置。

## 本章小结

- **`any`** 是万能类型，跳过一切检查。只用在不写不行的极端场景
- **`unknown`** 是 `any` 的安全替代——接受任意值但不让随意使用，强制先收窄
- **`never`** 是 Bottom Type，表示不可能出现的类型。在联合类型中消失，用于穷尽检查和抛错函数
- **`void`** 表示返回值没有意义。函数类型中特别宽容：返回任意值的函数都可以赋值给 `void` 返回类型
- 小写 `object` 表示非原始类型，大写 `Object` 是历史遗留应避免，`{}` 行为接近 `Object`
- 类型层级上：`any/unknown` 是 Top Type，`never` 是 Bottom Type

下一章将介绍类型别名与常见的工具类型——如何利用 `type` 关键字和内置工具类型来减少模板代码。
