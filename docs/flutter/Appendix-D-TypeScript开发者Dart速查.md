# 附录 D：TypeScript 开发者 Dart 速查

> 如果你熟悉 TypeScript，本附录帮助你快速理解 Dart 与 TS 的核心差异。其他语言背景可跳过。

---

## 变量声明

| 概念 | Dart | TypeScript |
|------|------|-----------|
| 类型推断变量 | `var x = 1;` — 类型锁定 | `let x = 1;` — 可赋不同类型 |
| 运行时常量 | `final x = DateTime.now();` | `const x = getNow();` |
| 编译时常量 | `const x = 3.14;` — 递归不可变 | `const x = 3.14 as const;` |
| 延迟初始化 | `late String x;` | `let x!: string;` |
| 可空类型 | `String? x;` | `string \| null` |
| 动态类型 | `dynamic x;` | `any` |

> **关键区别**：
>
> Dart 的 `var` 比 TS 的 `let` 更严格——类型一旦推断就锁定。
>
> Dart 的 `const` 是递归不可变，类似 `Object.freeze()` 深度冻结。
>
> Dart 的库级私有（`_` 前缀）与 TS 的 `#` 真私有更接近，但隔离粒度是文件级别。

---

## 类型系统

| 概念 | Dart | TypeScript |
|------|------|-----------|
| 数字类型 | `int` / `double` / `num` | `number` |
| 字符串 | `String s = 'hello';` | `string` |
| 列表 | `List<int> list = [1, 2, 3];` | `number[]` |
| Map | `Map<String, int> m = {};` | `Record<string, number>` |
| **truthy/falsy** | **不存在！条件必须是 bool 表达式** | 存在（0、''、null 等均为 falsy） |
| Set | `var s = <String>{};` | `new Set<string>()` |

**关键区别**：

Dart 没有 truthy/falsy——`if (value)` 是编译错误，必须写成 `if (value != null)` 或 `if (list.isNotEmpty)`。

Dart 的整数和浮点数分开（`int`/`double` 都继承 `num`），而 TS 统一为 `number`。

---

## 函数

| 概念 | Dart | TypeScript |
|------|------|-----------|
| 箭头函数 | `() => expr;` — 仅 `{ return expr; }` 的语法糖 | `() => expr` — 同时创建闭包 |
| 必填位置参数 | `fn(a, b)` | `fn(a: T, b: U)` |
| 可选位置参数 | `fn(a, [b, c])` | `fn(a, b?: T, c?: U)` |
| 命名参数 | `fn({bool? x, required int y})` | `fn({x, y}: {x?: boolean, y: number})` |
| typedef | `typedef F = int Function(int, int);` | `type F = (a: number, b: number) => number;` |

**关键区别**：

Dart 的命名参数用 `{}` 包裹，调用时直接 `fn(x: 1, y: 2)`（不需要传对象）。

TS 则需要传对象 `fn({x: 1, y: 2})`。

Dart 的 `=>` 不是"箭头函数"——它只是单行返回的简写，不创建闭包。

---

## 类与面向对象

| 概念 | Dart | TypeScript |
|------|------|-----------|
| 类定义 | `class Person {}` | `class Person {}` |
| 私有成员 | `_privateField`（库级私有） | `private field` / `#privateField` |
| 构造方法 | `Person(this.name);` | `constructor(public name: string) {}` |
| 命名构造 | `Person.guest();` — 无直接等价 | 用静态工厂方法模拟 |
| 工厂构造 | `factory Person.fromJson(...)` | `static fromJson(...)` |
| 继承 | `class A extends B {}` | `class A extends B {}` |
| 实现接口 | `class A implements B {}` | `class A implements B {}` |
| Mixin | `class A with B, C {}` | 无原生对应——用组合/HOC 模拟 |
| sealed class | `sealed class Result {}` + switch 完备性检查 | discriminated union |
| 泛型 | `class Box<T> {}` | `class Box<T> {}` |
| 扩展方法 | `extension E on String {}` | 无原生对应 |

**关键区别**：

Dart 没有 `interface` 关键字——任何类都可以作为接口被实现（`implements`）。

Dart 的命名构造和 factory 构造是 TS 没有的特性。

Dart 的 Mixin（`with`）是语言级特性，比 TS 的 HOC/组合模式更直接。

Dart 3 的 `sealed class` + switch 表达式 ≈ TS 的 discriminated union + 穷举检查。

---

## 异步编程

| 概念 | Dart | TypeScript |
|------|------|-----------|
| 异步值 | `Future<T>` | `Promise<T>` |
| async/await | `async` / `await` — 几乎一样 | `async` / `await` |
| 错误处理 | `try-catch` / `.catchError()` | `try-catch` / `.catch()` |
| 并行等待 | `Future.wait([...])` | `Promise.all([...])` |
| 流/序列 | `Stream<T>` | `Observable<T>` (RxJS) |
| 流创建 | `async* { yield value; }` | `async function*` (AsyncGenerator) |
| 流消费 | `.listen()` / `await for` | `.subscribe()` / `for await of` |
| 取消订阅 | `subscription.cancel()` | `subscription.unsubscribe()` |
| 防抖 | `stream.debounceTime(d)` | `pipe(debounceTime(d))` |
| UI 集成 | `StreamBuilder` | `async` pipe (Angular) |

---

## 空安全

| 概念 | Dart | TypeScript |
|------|------|-----------|
| 可空类型 | `String?` | `string \| null` (with strictNullChecks) |
| 安全访问 | `obj?.prop` | `obj?.prop` (optional chaining) |
| 空值合并 | `a ?? b` | `a ?? b` (nullish coalescing) |
| 非空断言 | `x!` | `x!` (non-null assertion) |
| 健全性 | **健全空安全**——运行时绝不可能是 null | 编译时检查，运行时仍可能 null |

**关键区别**：

Dart 的空安全是健全的（Sound）——如果类型系统说变量不可为 null，它在运行时绝不可能是 null。

TS 的 `strictNullChecks` 只是编译时检查，运行时仍可能遇到 null 值。

---

> 📖 完整官方文档：[dart.cn/language](https://dart.cn/language)
