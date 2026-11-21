# 第 14 章 keyof、typeof 与索引访问类型

写 `get(obj, "name")` 时想约束第二个参数只能是 `obj` 的键，返回值类型跟着键变化。`keyof`、`typeof` 和索引访问类型就是这套约束的零件。这一章讲三者的用法和组合。

这一章介绍 TypeScript 中三个相互关联的类型操作符：`keyof` 获取对象类型的键、`typeof` 在类型层面引用变量的类型、**索引访问类型** `T[K]` 通过键获取属性类型。它们是类型编程的三大基础工具，也是泛型约束中最常见的模式 `K extends keyof T` 的核心。

## keyof：获取对象类型的键

`keyof` 操作符接受一个**对象类型**，产生该类型所有键名组成的**字符串/数字字面量的联合类型**（[TypeScript Handbook：Keyof Type Operator](https://www.typescriptlang.org/docs/handbook/2/keyof-types.html)）：

```typescript
type Point = { x: number; y: number };
type P = keyof Point;  // "x" | "y"

// User 沿用第 6 章的定义
type UserKey = keyof User;  // "id" | "name" | "email"
```

### keyof 与索引签名

当对象类型有**字符串索引签名**时，`keyof` 返回 `string | number`：

```typescript
type Dict = { [key: string]: unknown };
type DictKeys = keyof Dict;  // string | number
```

注意这里返回了 `string | number`，为啥包含 `number`？因为在 JavaScript 中 `obj[0]` 等同于 `obj["0"]`，数字索引也会被转换为字符串。TypeScript 对此的一致性处理是让 `keyof` 返回两者。

如果只有**数字索引签名**，`keyof` 返回 `number`：

```typescript
type NumArray = { [index: number]: string };
type NumKeys = keyof NumArray;  // number
```

### keyof 与 symbol

TypeScript 也支持 `symbol` 键：

```typescript
const idSym = Symbol("id");
const nameSym = Symbol("name");

type Obj = {
  [idSym]: number;
  [nameSym]: string;
};

type ObjKeys = keyof Obj;  // typeof idSym | typeof nameSym
```

### keyof 的核心应用：泛型约束

`keyof` 最常见的用法是配合泛型约束，确保一个键确实属于某对象类型：

```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 25, email: "alice@example.com" };

getProperty(user, "name");   // 正确，返回 string
getProperty(user, "age");    // 正确，返回 number
// getProperty(user, "id");  // error TS2345: Argument of type '"id"' is not assignable to parameter of type '"age" | "email" | "name"'.
```

`K extends keyof T` 是 TypeScript 中最常见的泛型约束模式之一：它保证 `K` 一定是 `T` 的属性名。

## typeof：在类型层面引用变量

TypeScript 中的 `typeof` 有**双重身份**：
1. **JavaScript 运行时 `typeof`**：返回 `"string"`、`"number"` 等字符串
2. **TypeScript 类型层面的 `typeof`**：返回一个变量（或属性）的**类型**（[TypeScript Handbook：Typeof Type Operator](https://www.typescriptlang.org/docs/handbook/2/typeof-types.html)）

### 基本用法

```typescript
const message = "Hello";
type MessageType = typeof message;  // "Hello"（字面量类型，因为 message 是 const）

let count = 0;
type CountType = typeof count;      // number（不是 0，因为 let 可重新赋值）

const account = {
  name: "Alice",
  age: 25,
};
type AccountType = typeof account;  // { name: string; age: number; }
```

类型层面的 `typeof` 只能用在**标识符**（变量名）或**标识符的属性**上，不能用在任意表达式上：

```typescript
// type T = typeof "hello";        // error TS1003: Identifier expected.
// type T = typeof Math.random();  // error TS1005: ';' expected.

const arr = [1, 2, 3];
type T = typeof arr;         // 正确，可以用于变量
type Item = (typeof arr)[number];  // 正确，先 typeof 变量，再索引访问
```

### typeof 与 ReturnType 的组合

这是 `typeof` 最实用的场景：提取一个函数的返回值类型。

```typescript
function createAccount(name: string, age: number) {
  return { id: Math.random(), name, age, createdAt: new Date() };
}

// 提取返回值类型，而不是手动维护
type CreatedAccount = ReturnType<typeof createAccount>;
// { id: number; name: string; age: number; createdAt: Date; }
```

这种模式让你可以在**不导出类型声明**的情况下，从函数的实现自动推导出类型，也就是单一信息源（Single Source of Truth）。

```typescript
// 实际场景：Redux reducer
function counterReducer(state = { count: 0 }, action: CounterAction) {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    default:
      return state;
  }
}

// 从初始状态推导状态类型，而不是手动写 interface
type CounterState = ReturnType<typeof counterReducer>;
```

### typeof 与 Parameters 的组合

类似地，可以提取函数的参数类型：

```typescript
function greet(name: string, times: number): string {
  return Array(times).fill(`Hello ${name}`).join(", ");
}

type GreetArgs = Parameters<typeof greet>;
// [name: string, times: number]

// 复用函数参数
function greetAndLog(...args: GreetArgs) {
  console.log(`Calling greet with`, args);
  return greet(...args);
}
```

## 索引访问类型：T[K]

索引访问类型 `T[K]` 让你通过**类型**来访问某个对象类型中属性的类型（[TypeScript Handbook：Indexed Access Types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)），就像 JavaScript 中 `obj["key"]` 获取属性值，索引访问类型获取的是属性的**类型**：

```typescript
type IdType = User["id"];        // string
type NameType = User["name"];    // string
```

### 用联合类型一次性获取多个属性

括号内可以是**联合类型**，结果也是联合类型：

```typescript
type NameOrEmail = User["name" | "email"];  // string
```

### 用 keyof 获取所有属性的类型

组合 `T[keyof T]` 可以得到所有属性类型的联合：

```typescript
type UserValue = User[keyof User];  // string
```

`User` 的三个字段都是 `string`，上面几种写法的结果都是 `string`。字段类型不同时，结果才是联合类型。

### 数组/元组的索引访问

用 `number` 索引数组类型可以获取元素类型：

```typescript
const arr = [1, 2, 3];
type ItemType = (typeof arr)[number];  // number

type StringArray = string[];
type Element = StringArray[number];     // string
```

用数字字面量索引元组可以获取特定位置的类型：

```typescript
type Tuple = [string, number, boolean];
type First = Tuple[0];   // string
type Second = Tuple[1];  // number
type All = Tuple[number];  // string | number | boolean
```

### 用字面量类型索引对象

```typescript
type StatusMap = {
  loading: "加载中";
  success: "成功";
  error: "失败";
};

type LoadingText = StatusMap["loading"];  // "加载中"
```

### 使用索引访问类型取值时不能用 const 变量

注意：索引访问类型括号内的必须是**类型**，不能是 `const` 变量：

```typescript
const key = "email";
// type T = User[key];  // error TS2749: 'key' refers to a value, but is being used as a type here. Did you mean 'typeof key'?

// 正确的方式：使用 type 定义
type Key = "email";
type T = User[Key];     // 正确
```

## 三者组合使用

`keyof`、`typeof` 和索引访问类型的组合是 TypeScript 类型编程的基础构造块：

```typescript
// 从常量对象推导出联合类型
const COLORS = {
  red: "#FF0000",
  green: "#00FF00",
  blue: "#0000FF",
} as const;

type ColorName = keyof typeof COLORS;    // "red" | "green" | "blue"
type ColorValue = (typeof COLORS)[ColorName];  // "#FF0000" | "#00FF00" | "#0000FF"

// 实践中常用的模式
const config = {
  apiBase: "https://api.example.com",
  timeout: 5000,
  retryCount: 3,
} as const;

type ConfigKey = keyof typeof config;
type ConfigValue = (typeof config)[ConfigKey];
```

### 实用案例：类型安全的对象映射

```typescript
// 创建一个类型安全的 pick 函数
function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    result[key] = obj[key];
  });
  return result;
}

const user = { id: 1, name: "Alice", email: "a@x.com", age: 25 };
const picked = pick(user, ["name", "email"]);
// picked: { name: string; email: string; }
```

### 实用案例：从枚举对象推导类型

```typescript
// 工作中常见的模式
const HttpMethod = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

type HttpMethod = (typeof HttpMethod)[keyof typeof HttpMethod];
// "GET" | "POST" | "PUT" | "DELETE"

// 用法
function request(url: string, method: HttpMethod) {
  // ...
}

request("/api/users", HttpMethod.GET);      // 正确
// request("/api/users", "PATCH");  // error TS2345: Argument of type '"PATCH"' is not assignable to parameter of type 'HttpMethod'.
```

## 检查器里发生了什么

`keyof` 没有独立算法，它复用取索引类型的那段代码。语法节点进入 `getTypeFromTypeOperatorNode`（checker.ts:18950），`KeyOfKeyword` 分支调用 `getIndexType`（18927）。

`getIndexType` 按对象类型分派：联合类型对每个成员取 `keyof` 再求交集，交叉类型取并集。所以 `keyof (A | B)` 只剩公共键，`keyof (A & B)` 是两边键的全集。索引签名由 `getLiteralTypeFromProperties` 收集，字符串索引同时收 `string` 和 `number` 两类键，结果才是 `string | number`。

`typeof` 走另一条路。类型位置的 `typeof x` 先解析标识符，拿到符号后调 `getTypeOfSymbol`（12885）取声明类型。符号表里没有 `fn()` 这种条目，所以它只接受标识符或属性访问。

索引访问 `T[K]` 由 `getIndexedAccessType`（19572）处理：用键类型查对象类型的属性，联合键逐个查完再合并，可选属性会把 `undefined` 并进结果。

遇到重载时，`getSignaturesOfType`（15872）返回签名列表。调用按声明顺序匹配，先匹配上的签名决定结果。`ReturnType`、`Parameters` 取列表里的最后一个签名，不是合并所有重载。

把这几条拼起来，就能回答“为什么不能反过来”。`keyof` 只能从已有类型里读键，读不出还没声明的属性；`typeof` 只能读符号表里的声明，读不了运行时才出现的值；索引访问只能在类型上查表，查不到运行时的实际字段。三者的输入都是声明，不是运行状态。

这也是 `as const` 重要的原因。没有它，`{ theme: "dark" }` 的属性类型会放宽成 `string`，键名清单没变，值的精度丢了。加了 `as const`，键和值都保留成字面量，后面的 `keyof` 与索引访问才能拿到窄类型。

行号取自 [TypeScript 5.9.3 的 src/compiler/checker.ts](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/checker.ts)；7.0 换成 Go 实现，逻辑相同但没有逐行核对。

### 报错现场

```ts
type Book = { title: string; pages: number };

const key = "title";
type T1 = Book[key];

function read<T, K extends keyof T>(obj: T, k: K) { return obj[k]; }
read({ title: "x" }, "pages");

const settings = { theme: "dark" } as const;
settings.fontSize = 14;
```

`repro-14.ts(4,16): error TS2538: Type 'key' cannot be used as an index type.`，紧跟着 `error TS2749: 'key' refers to a value, but is being used as a type here. Did you mean 'typeof key'?`。方括号里要类型，`key` 是值。改法：写 `Book[typeof key]`，或先定义 `type Key = "title"`。

`repro-14.ts(7,22): error TS2345: Argument of type '"pages"' is not assignable to parameter of type '"title"'.`。`K` 被约束成 `keyof { title: string }`，`pages` 不在里面。改法：给对象显式标注 `Book`，或改传 `"title"`。

`repro-14.ts(10,10): error TS2339: Property 'fontSize' does not exist on type '{ readonly theme: "dark"; }'.`。`as const` 把类型钉在字面量上，新属性没有进类型。改法：先声明更宽的类型，或用索引签名接收额外字段。

### 一句话记住

`keyof` 是属性名清单，`typeof` 是给变量拍的类型照片。清单和照片都只记录编译时的那一刻。运行时对象新加属性，旧清单不会自动更新，只能靠新类型或索引签名。

比喻不成立的地方：只是复印机不会凭空加属性，同态映射会按你写的修饰符和值类型改写每个属性。

```ts
const settings = { theme: "dark" } as const;
type Key = keyof typeof settings;   // "theme"

const next = { ...settings, fontSize: 14 };
type NextKey = keyof typeof next;   // "theme" | "fontSize"
```

## 小结

- **`keyof T`** 获取对象类型 `T` 的所有键名组成的联合类型
- **索引签名**类型中：字符串索引 `→ string | number`，数字索引 `→ number`
- **`typeof x`**（类型层面）引用变量 `x` 的类型，只能用于标识符及其属性
- **`ReturnType<typeof fn>`** 是获取函数返回类型的标准模式，避免手动维护类型声明
- **`T[K]`** 索引访问类型通过键类型获取属性类型；`K` 可以是联合类型或 `keyof T`
- 三者组合（`keyof typeof obj`、`T[keyof T]`）是常用类型推导模式

## 用不上的时候

### keyof 用在非对象类型

`keyof string` 得到字符串方法名，通常不是想要的结果。约束泛型时先确认 `T` 是对象类型。

### 值层面遍历

`keyof` 只在类型层可用，运行时遍历键仍然用 `Object.keys`，两者结果不一定一致。

### 索引访问遇到索引签名

`T[string]` 会退化成索引签名的值类型，丢失具体键的精确类型。

## 参考

- [TypeScript Handbook：Keyof Type Operator](https://www.typescriptlang.org/docs/handbook/2/keyof-types.html)：keyof 的定义与在泛型约束中的用法。
- [TypeScript Handbook：Typeof Type Operator](https://www.typescriptlang.org/docs/handbook/2/typeof-types.html)：类型层面的 typeof 与 ReturnType。
- [TypeScript Handbook：Indexed Access Types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html)：T[K] 的取值规则与联合键。
- [TypeScript Handbook：Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)：K extends keyof T 这一约束模式的上下文。
- [TypeScript 5.9.3 的 src/compiler/checker.ts](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/checker.ts)：检查器里 keyof、typeof 与索引访问的实现位置。
