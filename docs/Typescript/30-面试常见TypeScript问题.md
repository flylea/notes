# 第30章 面试常见 TypeScript 问题

本章汇总 TypeScript 面试中的高频考点，每个问题按**基础回答**和**进阶回答**两层组织。基础回答确保你及格，进阶回答帮助你在面试中脱颖而出。

## 1. interface 与 type 的区别

### 基础回答

- **声明对象类型**：两者都可以描述对象、函数、类
- **扩展方式不同**：`interface` 用 `extends`，`type` 用交叉类型 `&`
- **同名合并**：同名 `interface` 会自动声明合并，`type` 不能
- **表达能力不同**：`type` 可以表达联合类型、元组、映射类型，`interface` 不能
- **类型编程**：`type` 可以使用映射类型、条件类型等所有类型工具，`interface` 仅支持基本的 `extends` 和泛型

```typescript
// interface 同名自动合并
interface User {
  name: string;
}
interface User {
  age: number;
}
// User = { name: string; age: number }

// type 可以表达联合类型和元组
type Status = 'active' | 'inactive';
type Point = [number, number];

// type 可以做映射类型
type ReadonlyUser = { readonly [K in keyof User]: User[K] };
```

### 进阶回答

在实际工程中，我个人采用这样的分工：

- **`interface` 用于描述对象对外暴露的接口**——其内部不应该有过于复杂的类型逻辑，最多到泛型约束和索引类型层面
- **`type` 用于类型别名和类型编程**——函数签名、联合类型、交叉类型、映射类型、条件类型等

另外，TypeScript 官方 Wiki 明确指出，在对象扩展场景下，`interface extends` 的性能优于交叉类型。这是因为 TypeScript 内部对接口继承有专门的缓存机制，而交叉类型每次都需要重新计算所有成员的兼容性。

```typescript
// ✅ 对象扩展：优先用 interface extends
interface Base { name: string; }
interface Derived extends Base { age: number; }

// ✅ 类型操作：用 type
type StringProps<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];
```

## 2. TypeScript 的类型兼容性原理

### 基础回答

TypeScript 使用**结构化类型系统**（Structural Typing），也叫"鸭子类型"——"如果它走起路来像鸭子，叫起来也像鸭子，那它就是鸭子"。即两个类型的兼容性取决于它们的结构（成员名称 + 类型），而非它们的声明名称。

```typescript
interface Point2D {
  x: number;
  y: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

// Point3D 是 Point2D 的子类型——因为它有 Point2D 的所有属性
let p2: Point2D;
const p3: Point3D = { x: 1, y: 2, z: 3 };
p2 = p3; // ✅
```

### 进阶回答

可以扩展到以下几个层面：

**与标称类型系统的对比**：Java、C# 等语言使用标称类型系统，两个类型即使结构完全一致，只要名称不同就不能相互赋值。在 TypeScript 中可以通过 `private` 或 `protected` 成员或 branded type 来模拟标称类型：

```typescript
// Branded type 模拟标称类型
type Brand<T, B> = T & { __brand: B };
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

function getUser(id: UserId) {}
const uid = 'abc' as UserId;
const oid = 'abc' as OrderId;
getUser(uid); // ✅
getUser(oid); // ❌ 即使结构相同也不能混用
```

**类型层级全景**：类型兼容性本质是在类型层级上做比较：

```
never → 字面量类型 → 字面量联合 → 原始类型 → 装箱类型 → Object → any/unknown
```

此外还需要提到**函数参数的双变**（strictFunctionTypes 下会收窄为逆变）、**返回值协变**、**any 在条件类型中的特殊表现**（`any extends T` 返回 `true | false` 的联合）等细节。

## 3. any、unknown 与 never

### 基础回答

- **`any`**：Top Type，所有类型都是它的子类型，它也是所有类型的子类型。相当于完全放弃了类型检查。
- **`unknown`**：Top Type，所有类型都是它的子类型，但它自身只允许赋值给 `unknown` 和 `any`。是类型安全的 "任意类型"。
- **`never`**：Bottom Type，是所有类型的子类型，但没有任何类型是它的子类型（除了它自己）。表示永远不会发生的类型。

```typescript
// unknown 比 any 安全——必须收窄后才能使用
let value: unknown;
value = 'hello';
value = 42;

if (typeof value === 'string') {
  console.log(value.toUpperCase()); // 类型收窄后安全使用
}

// never 表示不可能
function throwError(): never { throw new Error(); }
type Impossible = string & number; // never
```

### 进阶回答

**存在意义**：
- Top Type 的存在是因为实际开发中不可能对所有地方都精确描述类型。一个从 API 返回的 JSON 数据，在解析之前就是 `unknown`。
- Bottom Type 的存在是因为类型编程中的"空集"场景——两个互斥类型取交集得到 `never`，用于表示"不可能发生"的控制流。

**在条件类型中的特殊表现**：

```typescript
// any 在条件类型中：返回两个分支的联合
type IsString<T> = T extends string ? 'yes' : 'no';
type T1 = IsString<any>;   // 'yes' | 'no'  — 特殊行为！

// never 在条件类型中（作为泛型参数时）：直接返回 never
type T2 = IsString<never>;  // never
```

**完整类型层级链**：

```
never < 字面量 < 字面量联合 < 原始类型 < 装箱类型 < Object < any / unknown
```

## 4. 协变与逆变

### 基础回答

- **协变（Covariance）**：子类型可以赋值给父类型。函数返回值是协变的。
- **逆变（Contravariance）**：父类型可以赋值给子类型。在 `strictFunctionTypes` 开启时，函数参数是逆变的。

```typescript
class Animal { name = ''; }
class Dog extends Animal { breed = ''; }

// 返回值协变：() => Dog 是 () => Animal 的子类型
type ReturnCov = () => Dog extends () => Animal ? true : false; // true

// 参数逆变：(arg: Animal) => void 是 (arg: Dog) => void 的子类型
type ParamContra = (arg: Animal) => void extends (arg: Dog) => void ? true : false; // true
```

### 进阶回答

理解逆变的关键：如果一个函数声称能处理 `Dog` 类型（子类型），但实际上它内部只按 `Animal`（父类型）的方式使用参数——这当然没问题，因为 `Dog` 一定有 `Animal` 的全部属性。所以 `(arg: Animal) => void` 是 `(arg: Dog) => void` 的子类型。

这意味着：在需要"能处理任何 Dog 的函数"的位置，你可以传入"能处理任何 Animal 的函数"。

实际应用中最常见的逆变场景是事件回调：

```typescript
interface EventLike { type: string; }
interface MouseEventLike extends EventLike { clientX: number; }

type MouseHandler = (e: MouseEventLike) => void;
type EventHandler = (e: EventLike) => void;

// EventHandler 是 MouseHandler 的子类型
// 因为能处理任意 EventLike 的函数，当然也能处理 MouseEventLike
declare let f1: MouseHandler;
declare let f2: EventHandler;
f1 = f2; // ✅
```

在 `strictFunctionTypes` 关闭时，函数参数检查是双变的（既协变又逆变），这是一种为了兼容性的折中，但会隐藏类型错误。

## 5. 条件类型与 infer

### 基础回答

条件类型 `T extends U ? X : Y` 是类型层面的三元表达式。`infer` 关键字用于在条件类型的 extends 子句中声明一个待推断的类型变量：

```typescript
// 提取数组元素类型
type ElementOf<T> = T extends (infer E)[] ? E : never;
type E1 = ElementOf<string[]>; // string
type E2 = ElementOf<number>;   // never

// 提取 Promise 内的值类型
type Unwrap<T> = T extends Promise<infer V> ? V : T;
type U1 = Unwrap<Promise<number>>; // number
```

### 进阶回答

**分布式条件类型**：当条件类型的 checked type 是裸类型参数时，联合类型会被自动分发。这是实现 `Exclude`、`Extract` 等内置类型的基础：

```typescript
type ToArray<T> = T extends any ? T[] : never;
type Arr = ToArray<string | number>;  // string[] | number[] — 自动分发

// 禁用分发：用元组包裹
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type Arr2 = ToArrayNonDist<string | number>; // (string | number)[]
```

**嵌套 infer**：复杂类型提取的核心技巧：

```typescript
// 提取函数最后一个参数的类型
type LastParameter<T> = T extends (...args: infer P) => any
  ? P extends [...any, infer Last]
    ? Last
    : never
  : never;
```

**any 与 never 在条件类型中的特殊表现**（见第 3 题进阶回答）。

## 6. 工具类型手写

面试中常要求手写几个内置工具类型。

### Partial / Required / Readonly

```typescript
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyRequired<T> = { [K in keyof T]-?: T[K] };
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
```

### Pick / Omit

```typescript
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
type MyOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```

### Record / Exclude / Extract

```typescript
type MyRecord<K extends keyof any, V> = { [P in K]: V };
type MyExclude<T, U> = T extends U ? never : T;
type MyExtract<T, U> = T extends U ? T : never;
```

### ReturnType / Parameters

```typescript
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

type MyParameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;
```

### 进阶：展示增强版实现

在完成基础手写后，可以主动展示对它们的增强——这表明你不仅看过文档，还实际使用过：

```typescript
// 深层版本
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// 按值类型 Pick
type PickByValueType<T, V> = Pick<T, {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T]>;

// 互斥类型
type XOR<T, U> = (T & { [K in Exclude<keyof U, keyof T>]?: never }) |
                 (U & { [K in Exclude<keyof T, keyof U>]?: never });
```

## 7. keyof 与 typeof

### 基础回答

- **`keyof`**：获取一个类型的所有键名，返回键名的联合类型
- **`typeof`**（类型查询）：在类型上下文中，获取一个**值**的类型

```typescript
interface User {
  name: string;
  age: number;
}
type UserKeys = keyof User; // 'name' | 'age'

const config = { host: 'localhost', port: 3000 };
type Config = typeof config; // { host: string; port: number }
```

### 进阶回答

两者结合可以实现强大的类型推导：

```typescript
const colors = {
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
} as const;

// 从值推导出精确的字面量联合类型
type ColorName = keyof typeof colors;     // 'red' | 'green' | 'blue'
type ColorValue = typeof colors[ColorName]; // '#FF0000' | '#00FF00' | '#0000FF'
```

与索引访问类型结合，可以在完全不重复声明的情况下实现类型安全的代码：

```typescript
function getColor(name: ColorName): ColorValue {
  return colors[name];
}
```

## 8. 泛型约束与泛型默认值

### 基础回答

```typescript
// extends 约束泛型参数必须具有某些属性
function getLength<T extends { length: number }>(arg: T): number {
  return arg.length;
}

// 泛型默认值
interface ApiResponse<TData = unknown> {
  code: number;
  data: TData;
}
```

### 进阶回答

泛型约束不仅可以约束"有这个属性"，还能做类型关联：

```typescript
// 约束第二个参数必须是第一个对象的某个键
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: 'Alice', age: 30 };
getProperty(user, 'name'); // ✅ 类型为 string
getProperty(user, 'email'); // ❌ 编译错误

// 泛型约束链
interface HasId { id: number; }
interface Timestamped { createdAt: Date; updatedAt: Date; }
function update<T extends HasId & Timestamped>(entity: T): T { /* ... */ }
```

## 9. 装饰器的原理

### 基础回答

装饰器是一类特殊的声明式语法，使用 `@expression` 的形式附加在类、方法、属性或参数上。本质是一个函数，参数由框架约定：

```typescript
// 类装饰器
function Sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

@Sealed
class MyClass {}

// 方法装饰器：包装原方法
function Log(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`调用 ${key}, 参数:`, args);
    return original.apply(this, args);
  };
}
```

### 进阶回答

当前存在两套装饰器规范：

- **旧版（实验性）**：需要 `experimentalDecorators: true`，分为类、方法、访问符、属性、参数五种。NestJS、Angular 等框架仍基于旧版。
- **新版（TC39 Stage 3）**：TS 5.0+ 默认支持，使用统一的 `context` 参数，引入 `accessor` 关键字，移除了参数装饰器。

装饰器配合 `reflect-metadata` 实现依赖注入的原理：`emitDecoratorMetadata` 开启后，TS 自动为装饰成员添加 `design:type`（属性类型）、`design:paramtypes`（参数类型）、`design:returntype`（返回值类型）三条元数据。框架通过这些元数据知道构造函数需要什么依赖，从而自动完成注入。

装饰器的执行顺序是：实例成员 → 静态成员 → 构造函数参数 → 类装饰器，同类装饰器从下往上执行。

## 10. declare 与 .d.ts 文件

### 基础回答

`declare` 关键字用于声明**编译时存在但运行时不存在**的类型，或声明**来自外部环境**的变量/函数/模块。`.d.ts` 文件是纯粹的类型声明文件，不包含可执行代码。

```typescript
// 声明全局变量
declare const VERSION: string;

// 声明模块
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// 扩展已有类型
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
  }
}
```

### 进阶回答

`@types` 包的工作原理：TypeScript 会自动加载 `node_modules/@types` 下的所有 `.d.ts` 文件。`@types/react` 中就定义了 `JSX` 命名空间、`React.FC`、`ReactElement`、所有事件类型等。

三斜线指令 `/// <reference types="..." />` 是另一种引入类型声明的方式，但现在更推荐使用 `import type`。在 Vite 项目中，`vite-env.d.ts` 里的 `/// <reference types="vite/client" />` 就是一个典型例子。

## 11. 枚举 vs 联合类型

### 基础回答

```typescript
// 数字枚举（默认从 0 开始）
enum Direction { Up, Down, Left, Right }

// 字符串枚举
enum Status { Active = 'active', Inactive = 'inactive' }

// 联合类型 + as const 的替代方案
const StatusAlt = { Active: 'active', Inactive: 'inactive' } as const;
type StatusType = typeof StatusAlt[keyof typeof StatusAlt]; // 'active' | 'inactive'
```

### 进阶回答

枚举在编译后会生成 JavaScript 对象（以及反向映射表），这是联合类型不具备的。这带来了好处（运行时可用、有实际值）和代价（增加打包体积）。

在生产实践中：
- 如果值需要在运行时使用（如遍历枚举成员），用枚举
- 如果仅用于类型标注，优先用字符串字面量联合类型——零运行时开销
- 跨前后端共享的常量，建议用 `as const` 对象 + 类型提取，因为 JSON 序列化不关心枚举

`const enum` 可以完全消除运行时开销，但存在跨模块引用时的兼容性问题，在 `isolatedModules` 模式下可能失效。

## 12. 泛型在 React 中的常见坑位

### 基础回答

```tsx
// useState 的初始值问题
const [list, setList] = useState<string[]>([]);  // ✅ 显式指定

// useRef 的两种类型
const inputRef = useRef<HTMLInputElement>(null);    // RefObject (只读)
const countRef = useRef<number>(0);                 // MutableRefObject (可写)

// 事件处理
const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
  console.log(e.target.value);
};
```

### 进阶回答

常见的坑：

1. **`FC` 的限制**：`FC` 不能使用组件泛型。推荐用普通函数 + 显式返回值标注。
2. **`useReducer` 的 action 类型**：使用可辨识联合类型，在 switch 的每个 case 分支中获得精确的 action 类型。
3. **`forwardRef` 的泛型顺序**：第一个泛型是 ref 的类型，第二个才是 props。
4. **`ComponentProps`**：当第三方库只导出组件而不导出 props 类型时，用 `ComponentProps<typeof Comp>` 提取。

## 本章小结

以上 12 个考点覆盖了 TypeScript 面试中最常见的知识领域。记住面试的核心原则——**不仅要答 WHAT，更要答 WHY**：

- interface vs type：不仅说区别，还要说工程分工和性能差异
- 类型兼容性：不仅说鸭子类型，还要扩展到标称类型和类型层级
- 工具类型手写：不仅写基础版，还要展示增强版
- any/unknown/never：不仅说定义，还要解释存在意义和条件类型中的特殊行为

至此，本教程的全部 30 章内容完结。从基础类型标注到类型编程实战，从 React 到 Node.js，从工程规范到面试准备——希望这套教程能成为你 TypeScript 之路上的可靠向导。
