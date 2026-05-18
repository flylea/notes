# 第14章 keyof、typeof 与索引访问类型

本章介绍 TypeScript 中三个相互关联的类型操作符：`keyof` 获取对象类型的键、`typeof` 在类型层面引用变量的类型、**索引访问类型** `T[K]` 通过键获取属性类型。它们是类型编程的三大基础工具，也是泛型约束中最常见的模式 `K extends keyof T` 的核心。

## keyof——获取对象类型的键

`keyof` 操作符接受一个**对象类型**，产生该类型所有键名组成的**字符串/数字字面量的联合类型**：

```typescript
type Point = { x: number; y: number };
type P = keyof Point;  // "x" | "y"

interface User {
  id: number;
  name: string;
  email: string;
}

type UserKey = keyof User;  // "id" | "name" | "email"
```

### keyof 与索引签名

当对象类型有**字符串索引签名**时，`keyof` 返回 `string | number`：

```typescript
type Dict = { [key: string]: unknown };
type DictKeys = keyof Dict;  // string | number
```

注意这里返回了 `string | number`——为啥包含 `number`？因为在 JavaScript 中 `obj[0]` 等同于 `obj["0"]`，数字索引也会被转换为字符串。TypeScript 对此的一致性处理是让 `keyof` 返回两者。

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

getProperty(user, "name");   // ✅ 返回 string
getProperty(user, "age");    // ✅ 返回 number
// getProperty(user, "id");  // ❌ "id" 不是 user 的 key
```

`K extends keyof T` 是 TypeScript 中最常见的泛型约束模式之一——它保证 `K` 一定是 `T` 的属性名。

## typeof——在类型层面引用变量

TypeScript 中的 `typeof` 有**双重身份**：
1. **JavaScript 运行时 `typeof`**：返回 `"string"`、`"number"` 等字符串
2. **TypeScript 类型层面的 `typeof`**：返回一个变量（或属性）的**类型**

### 基本用法

```typescript
const message = "Hello";
type MessageType = typeof message;  // "Hello"（字面量类型，因为 message 是 const）

let count = 0;
type CountType = typeof count;      // number（不是 0，因为 let 可重新赋值）

const user = {
  name: "Alice",
  age: 25,
};
type UserType = typeof user;  // { name: string; age: number; }
```

类型层面的 `typeof` 只能用在**标识符**（变量名）或**标识符的属性**上，不能用在任意表达式上：

```typescript
// type T = typeof "hello";        // ❌ 不能用于字面量表达式
// type T = typeof Math.random();  // ❌ 不能用于函数调用

const arr = [1, 2, 3];
type T = typeof arr;         // ✅ 可以用于变量
type Item = (typeof arr)[number];  // ✅ 先 typeof 变量，再索引访问
```

### typeof 与 ReturnType 的组合

这是 `typeof` 最实用的场景——提取一个函数的返回值类型：

```typescript
function createUser(name: string, age: number) {
  return { id: Math.random(), name, age, createdAt: new Date() };
}

// 提取返回值类型，而不是手动维护
type User = ReturnType<typeof createUser>;
// { id: number; name: string; age: number; createdAt: Date; }
```

这种模式让你可以在**不导出类型声明**的情况下，从函数的实现自动推导出类型——单一信息源（Single Source of Truth）。

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

## 索引访问类型——T[K]

索引访问类型 `T[K]` 让你通过**类型**来访问某个对象类型中属性的类型——就像 JavaScript 中 `obj["key"]` 获取属性值，索引访问类型获取的是属性的**类型**：

```typescript
interface User {
  name: string;
  age: number;
  email: string;
}

type AgeType = User["age"];      // number
type NameType = User["name"];    // string
```

### 用联合类型一次性获取多个属性

括号内可以是**联合类型**，结果也是联合类型：

```typescript
type NameOrAge = User["name" | "age"];  // string | number
```

### 用 keyof 获取所有属性的类型

组合 `T[keyof T]` 可以得到所有属性类型的联合：

```typescript
type UserValue = User[keyof User];  // string | number
```

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
const key = "age";
// type T = User[key];  // ❌ key 是值，不是类型

// 正确的方式——使用 type 定义
type Key = "age";
type T = User[Key];     // ✅
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

request("/api/users", HttpMethod.GET);      // ✅
// request("/api/users", "PATCH");          // ❌
```

## 本章小结

- **`keyof T`** 获取对象类型 `T` 的所有键名组成的联合类型
- **索引签名**类型中：字符串索引 `→ string | number`，数字索引 `→ number`
- **`typeof x`**（类型层面）引用变量 `x` 的类型，只能用于标识符及其属性
- **`ReturnType<typeof fn>`** 是获取函数返回类型的标准模式，避免手动维护类型声明
- **`T[K]`** 索引访问类型通过键类型获取属性类型；`K` 可以是联合类型或 `keyof T`
- 三者组合（`keyof typeof obj`、`T[keyof T]`）是常用类型推导模式

下一章将介绍映射类型——在 `keyof` 和索引访问类型之上，将一种对象类型系统地"映射"为另一种对象类型。
