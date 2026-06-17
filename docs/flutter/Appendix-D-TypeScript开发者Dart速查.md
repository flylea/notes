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
> Dart 的库级私有（`_` 前缀）隔离粒度是文件级别，与 TS 的 `#` 真私有接近但机制不同。

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

## 级联操作符 `..` vs TS 链式调用

Dart 的 `..`（级联操作符）允许在同一个对象上执行多次操作，而无需重复引用：

```dart
// Dart: 级联操作符 —— 在同一个对象上执行一系列操作
final button = Button()
  ..text = 'Submit'
  ..color = Colors.blue
  ..width = 120
  ..onClick = () => print('clicked');

// TS: 链式调用 —— 每个方法必须返回 this
// builder.setName('Alice').setAge(30).build();  // 需要每个 setter 返回 this
```

级联操作符的优点：不需要类的方法返回 `this`，适用于任何对象上的 setter 和方法调用。

```dart
// ?.. 空安全级联：只在对象非 null 时执行
List<int>? maybeList;
maybeList
  ?..add(1)
  ..add(2);  // 如果 maybeList 为 null，整个级联被跳过
```

---

## 展开操作符 `...` 和 `...?`

```dart
// Dart: 集合展开（类似 TS 的 ...）
var list1 = [1, 2, 3];
var list2 = [0, ...list1, 4];     // [0, 1, 2, 3, 4]

var set1 = {1, 2, 3};
var set2 = {0, ...set1};          // {0, 1, 2, 3}

var map1 = {'a': 1};
var map2 = {'b': 2, ...map1};    // {b: 2, a: 1}

// ...? 空安全展开 —— 只在非 null 时展开
List<int>? maybeList;
var safe = [0, ...?maybeList];   // [0] —— maybeList 为 null 则跳过

// ❌ Dart 不支持对象展开（没有 TS 的 { ...obj, key: val }）
// ✅ 替代方案：用集合字面量或手动赋值
var merged = <String, dynamic>{}
  ..addAll(base)
  ..['extra'] = value;
```

---

## 模式匹配（Dart 3） vs TS Discriminated Unions

```dart
// Dart 3 sealed class + switch 表达式 —— 编译器强制穷举
sealed class Result<T> {}
class Success<T> extends Result<T> {
  final T data;
  Success(this.data);
}
class Failure<T> extends Result<T> {
  final String error;
  Failure(this.error);
}
class Loading<T> extends Result<T> {}

// switch 表达式：缺少任何分支会编译错误
Widget buildResult(Result<String> result) {
  return switch (result) {
    Success(data: var d) => Text(d),
    Failure(error: var e) => Text('Error: $e'),
    Loading() => const CircularProgressIndicator(),
  };
}

// Dart 3 模式解构
final (a, b) = (1, 2);               // 解构
if (json case {'name': String n}) {}  // 条件匹配

// TS 等价
type Result<T> = { kind: 'success'; data: T } | { kind: 'failure'; error: string };
// ...switch 穷举需依赖 noImplicitReturns + exhaustiveness 检查
```

**关键区别**：Dart 3 的 `sealed class` + `switch` 是**编译器级别**的穷举检查（遗漏分支产生编译错误），而 TS 的 discriminated union 的穷举检查依赖于配置和工具链。

---

## Records vs TS Tuples

```dart
// Dart 3 Records —— 匿名、不可变的聚合类型
var pair = (1, 'hello');                          // (int, String)
var named = (x: 10, y: 20);                       // 命名记录
var mixed = (1, label: 'start');                  // 混合

// 解构
var (id, name) = pair;
print(named.x);                                    // 通过名称访问

// 多返回值 —— Dart 的惯用模式
(int, String) getUser() => (1, 'Alice');
final (id, name) = getUser();

// TS 等价
let pair: [number, string] = [1, 'hello'];        // 位置元组
let named = { x: 10, y: 20 };                     // 对象解构 —— TS 无命名元组
function getUser(): [number, string] { return [1, 'Alice']; }
```

**关键区别**：Dart Records 支持位置+命名混合字段，是语言原生的不可变类型。TS 元组仅有位置字段，命名字段需用对象替代。

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

> ### Vue-TS 开发者特别关注
>
> 1. **没有 SFC（.vue 文件）**：Dart/Flutter 不存在 Vue 的 `template`/`script`/`style` 三段式结构。`Widget` 就等于 template，直接在 Dart 代码中描述 UI。
>
> 2. **没有 `ref()` / `reactive()` 的自动追踪**：Vue 3 的 `ref()` 包裹后自动收集依赖、触发更新——Flutter 需要显式调用 `setState(() { ... })` 或用状态管理方案（`Provider`、`Riverpod`、`Bloc`）来通知 UI 重建。
>
> 3. **Pinia → Riverpod 快速对照**：
>
> | 概念 | Pinia (Vue) | Riverpod (Flutter) |
> |------|------------|-------------------|
> | Store | `defineStore('id', ...)` | `Provider<T>(...)` 或 `NotifierProvider<Notifier, T>` |
> | State | `ref()` / `reactive()` | `state` 属性（不可变——每次返回新对象） |
> | Getter | `getters: { fullName: (s) => ... }` | 派生 Provider：`Provider((ref) => ref.watch(x) + y)` |
> | Action | `actions: { async fetch() {} }` | `Notifier` 中的方法 |
> | 组合 stores | `useOtherStore()` | `ref.watch(otherProvider)` |
>
> 4. **路由没有组件级别的守卫**：Vue Router 的 `beforeEnter` 可在路由配置中写 hook，Flutter 的 Navigator / GoRouter 通常将守卫逻辑写在 Widget 或路由回调中，不区分组件级/路由级守卫。

---

> 📖 完整官方文档：[dart.cn/language](https://dart.cn/language)
