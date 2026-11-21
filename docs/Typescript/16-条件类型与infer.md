# 第 16 章 条件类型与 infer

函数返回类型取决于入参类型，或者需要从 `Promise<User>` 里取出 `User` 而手头只有类型本身。条件类型在类型层面做分支，`infer` 从结构里提取子类型。这一章讲分支、分布行为和提取模式。

如果说映射类型是 TypeScript 类型编程中的 `map` 操作，条件类型就是类型编程中的 `if/else`（[TypeScript Handbook：Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)），根据条件分支产生不同的类型。配合 `infer` 关键字进行模式匹配，条件类型可以实现从任意类型结构中"提取"目标类型的能力。TypeScript 内置的 `ReturnType`、`Parameters`、`Exclude`、`Extract` 等工具类型，都是条件类型的杰作。

## 条件类型基础

### 基本语法

```text
TypeA extends TypeB ? TrueType : FalseType
```

含义：如果 `TypeA` 可以赋值给 `TypeB`（即 `TypeA` 是 `TypeB` 的子类型），则结果是 `TrueType`，否则是 `FalseType`。

```typescript
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;   // true
type B = IsString<number>;   // false
type C = IsString<"hello">;  // true（字面量是 string 的子类型）
```

条件类型必须与**泛型**配合使用才有意义：单独的条件类型在编译时就能确定结果，没有"判断"的必要。

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

如果没有分布特性，结果会是 `(string | number)[]`，这是数组的联合类型，与联合类型的数组是完全不同的概念。

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

有时你**不想要**分布行为，比如当你需要判断整个联合类型（而非每个成员）是否是某类型的子类型。阻止分布的方法是将泛型参数用方括号包裹：

```typescript
type IsUnion<T> = [T] extends [never] ? "is never" : "is not never";

// 如果不包裹：
type Direct<T> = T extends never ? "is never" : "is not never";
type DirectResult = Direct<string | number>;  // "is not never"（被分到每个成员上判断）

// 包裹后：
type WrappedResult = IsUnion<string | number>;  // "is not never"
```

注意一个容易记错的点：`Direct<string | number>` 的结果是 `"is not never"`，**不是** `never`。因为分布之后是 `string extends never` 和 `number extends never` 两个判断，都走 false 分支，联合起来仍是 `"is not never"`。真正会得到 `never` 的是 `Direct<never>`。裸的 `never` 出现在分布式条件类型的检查位置时，整个条件类型直接坍塌成 `never`。

所以 `T extends never` 的问题不是"联合会被分掉"，而是**当你无法确定 T 是否为 `never` 时，判断结果会随实例化不同而不同**（`Direct<never>` 是 `never`，`Direct<string>` 是 `"is not never"`）。用 `[T] extends [never]` 把参数包起来，可以同时关掉分布并让 `never` 参与整体比较，这才是 `IsUnion` 需要包裹的原因。

**通用规则**：当你不确定是否需要分布时，先想清楚：你是想"对联合的每个成员分别判断"还是"对整体判断"。如果是对整体判断，用 `[T] extends [U]` 包裹。

## infer：条件类型中的模式匹配

`infer` 是条件类型最强大的特性：它让你在条件判断的同时，从类型结构中**提取**一部分类型信息。`infer` 只能在条件类型的 `extends` 子句中（即 `true` 分支处）使用。

### 提取函数返回值类型

```typescript
// 如果 T 是函数类型，提取其返回值类型
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

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
// 约束必须用 (...args: any[])：用 unknown[] 时，带参数的构造函数（如 new (name: string) => ...）
// 不满足 unknown 的逆变要求，一实例化就报 TS2344
type ConstructorParameters<T extends abstract new (...args: any[]) => any> =
  T extends abstract new (...args: infer P) => any ? P : never;

// 提取构造函数实例类型
type InstanceType<T extends abstract new (...args: any[]) => any> =
  T extends abstract new (...args: any[]) => infer R ? R : never;

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

## infer 后直接加约束（TS 4.7）

`infer` 后面能跟 `extends`（[TypeScript 4.7 发布说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html) 的 extends Constraints on infer Type Variables），匹配的同时校验类型：

```typescript
type First<T> = T extends [infer F extends string, ...any[]] ? F : never;

type A = First<["a", 1]>;   // "a"
type B = First<[1, "a"]>;   // never
```

4.7 之前要先取出来再判断，结果一样，但多一层嵌套：

```typescript
type FirstOld<T> = T extends [infer F, ...any[]]
  ? F extends string
    ? F
    : never
  : never;
```

判断的是整个推断结果能不能赋给约束，不是逐个成员判断。`any` 能通过任何约束，输入侧要自己拦住：

```typescript
type First<T> = T extends [infer F extends string, ...any[]] ? F : never;

type UnionCase = First<[string | number, 1]>;  // never
type LiteralUnion = First<["a" | "b", 1]>;     // "a" | "b"
type AnyCase = First<[any, 1]>;                // any
```

模板字面量里也能用，取完直接就是收窄后的类型：

```typescript
type EventName<T> = T extends `${infer N extends string}Changed` ? N : never;

type ThemeEvent = EventName<"themeChanged">;  // "theme"
```

三个容易踩的点。

约束失败等于匹配失败，走 false 分支，拿不到取出来的类型。想保留原类型做兜底，仍要用先取再判断的写法。

不能引用同一个模式里更早的 `infer`。`type Sibling<T> = T extends [infer A, infer B extends A] ? B : never` 报 `error TS2304: Cannot find name 'A'`。

语法门槛是 TS 4.7。项目里有旧编译器或旧版 tsserver 时，这段会在解析阶段就失败。

## 条件类型中的 any 与 never 的特殊表现

### any 在条件类型中

当 `any` 用于条件类型判断时，结果是两个分支的联合：

```typescript
type IsString<T> = T extends string ? "yes" : "no";

type Result = IsString<any>;  // "yes" | "no"
```

`any` 的特殊之处在于：它既是所有类型的子类型，也是所有类型的父类型。TypeScript 在条件类型中无法确定 `any` 走哪个分支，干脆两个都走。

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

## 检查器里发生了什么

条件类型是否分布，在声明时就定死了。`getTypeFromConditionalTypeNode`（checker.ts:19887）把 `isDistributive` 设为“检查类型是不是类型参数”：`isDistributive: !!(checkType.flags & TypeFlags.TypeParameter)`（19899）。`T extends U ? X : Y` 里 `T` 是裸参数，标志为真；`[T] extends [U] ? X : Y` 里检查类型是元组，标志为假。

真正展开在实例化时。`getConditionalTypeInstantiation`（20923）拿到实参后，如果 `isDistributive` 为真且实参是联合或 `never`，就用 `mapType` 对每个成员分别求值再合并。没有这个标志，联合整体只参与一次比较。

深度上限有两道闸。`getConditionalType`（19707）用 `while` 消化尾部的嵌套条件，`tailCount` 到 1000 就报 TS2589（19717）。`instantiateTypeWithAlias`（20955）另有一道总闸：实例化深度到 100，或同一语句累计 500 万次实例化，也报同一个错。

`infer` 的逆变发生在签名比较里。`inferFromSignature`（27421）对参数调用 `applyToParameterTypes(..., inferFromContravariantTypesIfStrictFunctionTypes)`，参数位置按逆变推。约束写 `(...args: unknown[]) => any` 时，`unknown` 必须能赋给实参类型，`(title: string)` 这一步就失败，报 TS2344。

标志位放在声明期，有一个直接后果：条件类型怎么写，决定了它会不会分布，跟传进来什么类型无关。同一个 `IsString<T>`，写成 `T extends string` 时对联合逐个判断，写成 `[T] extends [string]` 时整体判断。包一层就永久关掉分布，调用处不用再做特殊处理。

另一头是缓存。`getConditionalTypeInstantiation` 用类型参数的 id 列表做键，同一个条件类型配同一组实参只算一次。递归模板里重复出现的实例化结果因此能复用，这是类型体操跑得起来的前提，也是 `type X = Build<800>` 比三次内联便宜的原因。

判断是否分布，看源码比看现象可靠：`checkType` 是不是类型参数。是，分布；不是，整体比较。记住这一条，`[T] extends [U]`、`T extends any`、`T extends unknown` 这几种写法就不用挨个背了。

行号取自 [TypeScript 5.9.3 的 src/compiler/checker.ts](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/checker.ts)；7.0 换成 Go 实现，逻辑相同但没有逐行核对。

### 报错现场

```ts
type Sibling<T> = T extends [infer A, infer B extends A] ? B : never;

type Ctor<T extends abstract new (...args: unknown[]) => any> = T;
class Book { constructor(public title: string) {} }
type BadCtor = Ctor<typeof Book>;

type Loop<T> = T extends unknown ? Loop<T> : never;
type Deep = Loop<1>;
```

`repro-16.ts(1,55): error TS2304: Cannot find name 'A'.`。同一个模式里，后一个 `infer` 不能引用前一个。改法：先取出两个，再用嵌套条件判断。

`repro-16.ts(5,21): error TS2344: Type 'typeof Book' does not satisfy the constraint 'abstract new (...args: unknown[]) => any'.`，下一行接着 `Types of parameters 'title' and 'args' are incompatible.`。参数位置是逆变，`unknown` 不是 `string` 的子类型。改法：约束写 `any[]`。

`repro-16.ts(8,13): error TS2589: Type instantiation is excessively deep and possibly infinite.`。`Loop` 每层都生成新类型，没有基本情况。改法：补一个返回分支，或加计数器参数。

### 一句话记住

裸类型参数像分拣口：联合类型会一个个掉进去分开判断；套上方括号就变成整箱过秤。

比喻不成立的地方：分拣口只按成员拆一次，实际的条件类型可以嵌套多层，每一层都各自决定是否分布。

```ts
type Boxed<T> = T extends string ? T[] : never;
type A = Boxed<"a" | "b">;   // "a"[] | "b"[]

type Whole<T> = [T] extends [string] ? T[] : never;
type B = Whole<"a" | "b">;   // ("a" | "b")[]
```

## 小结

- **条件类型** `A extends B ? X : Y` 根据类型兼容性选择分支，是类型编程的 `if/else`
- 条件类型的 **`extends`** 和泛型约束的 **`extends`** 不同：前者做分支判断，后者做编译约束
- **分布式条件类型**：裸泛型参数 + 联合类型 → 条件分布到每个成员上；用 `[T]` 包裹可阻止分布
- `Exclude`、`Extract`、`NonNullable` 都是利用分布特性实现的
- **`infer`** 在条件类型中进行模式匹配，从类型结构中提取子类型
- `ReturnType`、`Parameters`、`InstanceType` 等内置类型都是用 `infer` 实现的
- `never` 在分布式条件类型中直接返回 `never`；`any` 返回两个分支的联合

## 用不上的时候

### 裸类型参数上的分布

`T extends U ? X : Y` 里 `T` 是裸参数，联合会被逐个成员处理。要整体判断得写 `[T] extends [U]`。

### any 进入条件类型

`any` 会让结果变成两个分支的联合，而不是走某一支，容易得到意外的类型。

### 递归解析深层结构

递归条件类型没有尾递归优化时层数有限，解析深层 JSON 容易报类型实例化过深。

## 参考

- [TypeScript Handbook：Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)：条件类型、infer 与分布式行为的官方说明。
- [TypeScript 4.7 发布说明](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html)：infer 上的 extends 约束。
- [TypeScript 5.9.3 的 src/compiler/checker.ts](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/checker.ts)：条件类型的求值入口与 infer 绑定位置。
