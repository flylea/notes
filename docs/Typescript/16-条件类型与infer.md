# 第16章 条件类型与 infer

如果说映射类型是 TypeScript 类型编程中的 `map` 操作，条件类型就是类型编程中的 `if/else`——根据条件分支产生不同的类型。配合 `infer` 关键字进行模式匹配，条件类型可以实现从任意类型结构中"提取"目标类型的能力。TypeScript 内置的 `ReturnType`、`Parameters`、`Exclude`、`Extract` 等工具类型，都是条件类型的杰作。

## 条件类型基础

### 基本语法

```typescript
TypeA extends TypeB ? TrueType : FalseType
```

含义：如果 `TypeA` 可以赋值给 `TypeB`（即 `TypeA` 是 `TypeB` 的子类型），则结果是 `TrueType`，否则是 `FalseType`。

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;   // true
type B = IsString<number>;   // false
type C = IsString<"hello">;  // true（字面量是 string 的子类型）
```

条件类型必须与**泛型**配合使用才有意义——单独的条件类型在编译时就能确定结果，没有"判断"的必要。

```typescript
// 条件类型几乎总是用泛型参数作为条件
type IsArray<T> = T extends unknown[] ? "array" : "not array";

type A = IsArray<string[]>;  // "array"
type B = IsArray<number>;    // "not array"
```

### 嵌套条件类型

条件类型可以嵌套，在多个分支之间选择：

```typescript
type TypeName<T> =
  T extends string ? "string" :
  T extends number ? "number" :
  T extends boolean ? "boolean" :
  T extends undefined ? "undefined" :
  T extends Function ? "function" :
  T extends null ? "null" :
  "object";

type A = TypeName<string>;   // "string"
type B = TypeName<number[]>; // "object"
type C = TypeName<() => void>; // "function"
```

### 条件类型与泛型约束的 `extends` 的区别

泛型约束 `T extends U` 和条件类型 `T extends U ? X : Y` 虽然都用 `extends` 关键字，但含义不同：

| | 泛型约束 | 条件类型 |
|---|---|---|
| 位置 | `<T extends U>` | `T extends U ? X : Y` |
| 作用 | 限制泛型参数的范围 | 类型层面的分支判断 |
| 违反时 | 编译报错 | 走 else 分支（不报错） |

```typescript
// 泛型约束：限制 T 必须是 { length: number }
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length > b.length ? a : b;
}

// 条件类型：根据判断结果选择类型
type ElementType<T> = T extends unknown[] ? T[number] : T;
```

## 分布式条件类型（Distributive Conditional Types）

这是条件类型**最重要也最容易让人困惑**的特性。规则是：**当条件类型的判断对象是一个裸泛型参数（naked type parameter），且传入的是一个联合类型时，条件类型会分布到联合的每个成员上**。

### 分布行为

```typescript
type ToArray<T> = T extends unknown ? T[] : never;

// 传递给联合类型
type Result = ToArray<string | number>;
// 等价于 (string extends unknown ? string[] : never) | (number extends unknown ? number[] : never)
// 结果是 string[] | number[]
```

如果没有分布特性，结果会是 `(string | number)[]`——这是数组的联合类型，与联合类型的数组是完全不同的概念。

### 利用分布特性的实战模式

**Exclude 的实现**：

```typescript
// 从 T 中排除可赋值给 U 的成员
type Exclude<T, U> = T extends U ? never : T;

type T = Exclude<"a" | "b" | "c", "a" | "b">;  // "c"
```

运作过程：
1. 联合分布：`("a" extends "a"|"b" ? never : "a") | ("b" extends "a"|"b" ? never : "b") | ("c" extends "a"|"b" ? never : "c")`
2. 计算：`never | never | "c"`
3. `never` 消除：`"c"`

**Extract 的实现**：

```typescript
type Extract<T, U> = T extends U ? T : never;

type T = Extract<"a" | "b" | "c", "a" | "c">;  // "a" | "c"
```

**NonNullable 的实现**：

```typescript
type NonNullable<T> = T extends null | undefined ? never : T;

type T = NonNullable<string | number | null | undefined>;  // string | number
```

### 阻止分布

有时你**不想要**分布行为——比如当你需要判断整个联合类型（而非每个成员）是否是某类型的子类型。阻止分布的方法是将泛型参数用方括号包裹：

```typescript
type IsUnion<T> = [T] extends [never] ? "is never" : "is not never";

// 如果不包裹：
type Direct<T> = T extends never ? "is never" : "is not never";
type DirectResult = Direct<string | number>;  // never！因为 never 是空联合

// 包裹后：
type WrappedResult = IsUnion<string | number>;  // "is not never"
```

为什么 `Direct<string | number>` 得到 `never`？因为 `string | number extends never` 被分到每个成员上：`string extends never ? ...` 和 `number extends never ? ...`，两个都走 false 分支，产生 `"is not never" | "is not never"` 即 `"is not never"`——但这里还有一个更反直觉的行为：`never extends ...` 时整个联合变成 `never`。这也解释了为什么判断 `T extends never` 需要包裹——裸的 `never` 在分布式条件类型中直接返回 `never`。

**通用规则**：当你不确定是否需要分布时，先想清楚——你是想"对联合的每个成员分别判断"还是"对整体判断"。如果是对整体判断，用 `[T] extends [U]` 包裹。

## infer——条件类型中的模式匹配

`infer` 是条件类型最强大的特性——它让你在条件判断的同时，从类型结构中**提取**一部分类型信息。`infer` 只能在条件类型的 `extends` 子句中（即 `true` 分支处）使用。

### 提取函数返回值类型

```typescript
// 如果 T 是函数类型，提取其返回值类型
type MyReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;

type F1 = () => string;
type R1 = MyReturnType<F1>;  // string

type F2 = (x: number, y: string) => boolean;
type R2 = MyReturnType<F2>;  // boolean

type F3 = string;
type R3 = MyReturnType<F3>;  // never（string 不是函数类型）
```

### 提取数组元素类型

```typescript
type ElementOf<T> = T extends (infer E)[] ? E : never;

type E1 = ElementOf<string[]>;     // string
type E2 = ElementOf<number[]>;     // number
type E3 = ElementOf<string>;       // never
```

### 提取 Promise 包裹的类型

```typescript
type Awaited<T> = T extends Promise<infer V> ? V : T;

type A1 = Awaited<Promise<string>>;  // string
type A2 = Awaited<Promise<number[]>>;  // number[]
type A3 = Awaited<string>;           // string

// 递归解包：处理嵌套 Promise
type DeepAwaited<T> = T extends Promise<infer V> ? DeepAwaited<V> : T;

type A4 = DeepAwaited<Promise<Promise<number>>>;  // number
```

### 提取构造函数参数和实例类型

```typescript
// 提取构造函数参数类型
type ConstructorParameters<T extends abstract new (...args: unknown[]) => unknown> =
  T extends abstract new (...args: infer P) => unknown ? P : never;

// 提取构造函数实例类型
type InstanceType<T extends abstract new (...args: unknown[]) => unknown> =
  T extends abstract new (...args: unknown[]) => infer R ? R : never;

class User {
  constructor(public name: string, public age: number) {}
}

type UserParams = ConstructorParameters<typeof User>;  // [name: string, age: number]
type UserInstance = InstanceType<typeof User>;         // User
```

### 提取元组的元素

```typescript
// 提取第一个元素
type First<T extends unknown[]> = T extends [infer F, ...unknown[]] ? F : never;

type F = First<[string, number, boolean]>;  // string

// 提取最后一个元素
type Last<T extends unknown[]> = T extends [...unknown[], infer L] ? L : never;

type L = Last<[string, number, boolean]>;  // boolean

// 提取剩余元素（去掉第一个）
type Tail<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : never;

type T = Tail<[string, number, boolean]>;  // [number, boolean]
```

### 在模板字符串类型中 infer

```typescript
// 提取第一个单词
type FirstWord<S extends string> = S extends `${infer Word} ${infer _Rest}` ? Word : S;

type W1 = FirstWord<"hello world">;     // "hello"
type W2 = FirstWord<"typescript">;      // "typescript"
```

### 多个 infer 位置

条件类型中可以同时有多个 `infer`，根据类型结构匹配对应位置：

```typescript
// 交换元组前两个元素
type Swap<T extends unknown[]> = T extends [infer A, infer B, ...infer Rest] ? [B, A, ...Rest] : T;

type S1 = Swap<[1, 2, 3, 4]>;  // [2, 1, 3, 4]
```

## 条件类型中的 any 与 never 的特殊表现

### any 在条件类型中

当 `any` 用于条件类型判断时，结果是两个分支的联合：

```typescript
type IsString<T> = T extends string ? "yes" : "no";

type Result = IsString<any>;  // "yes" | "no"
```

`any` 的特殊之处在于——它既是所有类型的子类型，也是所有类型的父类型。TypeScript 在条件类型中无法确定 `any` 走哪个分支，干脆两个都走。

利用这一特性可以判断类型是否为 `any`：

```typescript
type IsAny<T> = 0 extends (1 & T) ? true : false;

type T1 = IsAny<any>;     // true
type T2 = IsAny<string>;  // false
```

原理：`1 & any` 的结果是 `any`（而不是 `never`），`0 extends any` 是 `true`。而 `1 & string` 是 `never`，`0 extends never` 是 `false`。

### never 在条件类型中

`never` 在分布式条件类型中会直接返回 `never`（前面已经解释过）。这是因为 `never` 是空联合，分布到空联合上不会执行任何分支。

## 实战案例

### 案例：深度只读

```typescript
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K];
};
```

### 案例：值为特定类型的键

```typescript
// 获取值类型为 V 的所有键名
type KeysByType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

interface User {
  name: string;
  age: number;
  email: string;
  active: boolean;
}

type StringKeys = KeysByType<User, string>;  // "name" | "email"
```

### 案例：将联合类型转为交叉类型

```typescript
// 利用分布式条件类型 + 函数逆变
type UnionToIntersection<U> =
  (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
    ? I
    : never;

type T = UnionToIntersection<{ a: string } | { b: number }>;
// { a: string; b: number; }
```

## 本章小结

- **条件类型** `A extends B ? X : Y` 根据类型兼容性选择分支，是类型编程的 `if/else`
- 条件类型的 **`extends`** 和泛型约束的 **`extends`** 不同：前者做分支判断，后者做编译约束
- **分布式条件类型**：裸泛型参数 + 联合类型 → 条件分布到每个成员上；用 `[T]` 包裹可阻止分布
- `Exclude`、`Extract`、`NonNullable` 都是利用分布特性实现的
- **`infer`** 在条件类型中进行模式匹配，从类型结构中提取子类型
- `ReturnType`、`Parameters`、`InstanceType` 等内置类型都是用 `infer` 实现的
- `never` 在分布式条件类型中直接返回 `never`；`any` 返回两个分支的联合

下一章将介绍模板字符串类型——TypeScript 4.1 引入的、让类型层面也能进行字符串拼接和匹配的能力。
