# 第8章 Class 类型

TypeScript 为 ES6 的 Class 提供了全面的类型能力。除了对属性和方法进行类型标注外，还增加了访问修饰符（`public`/`protected`/`private`）、抽象类、`override` 等 JavaScript 所没有的概念。本章将系统讲解如何在 TypeScript 中安全地编写面向对象代码。

## 类成员的类型标注

### 属性声明

在 TypeScript 中，类的每个实例属性都**必须先声明，后使用**。属性的类型标注写在属性名之后：

```typescript
class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
```

这与 JavaScript 的一个关键区别是：你不能像在 JS 中那样不声明就直接 `this.x = x`。TypeScript 要求所有实例属性的类型在类体中声明。

如果属性有初始值，TypeScript 可以从初始值自动推导类型，此时可以省略类型标注：

```typescript
class Counter {
  count = 0;           // 推导为 number
  name = "default";    // 推导为 string
}
```

### 属性初始化检查

开启 `strictPropertyInitialization`（包含在 `strict` 中）后，TypeScript 会检查每个属性是否在构造结束前被初始化：

```typescript
class Bad {
  x: number;  // ❌ 属性没有初始化器，且未在构造函数中明确赋值
}

class Good {
  x: number = 0;  // ✅ 声明时有默认值
}

class AlsoGood {
  x: number;
  constructor() {
    this.x = 0;  // ✅ 在构造函数中赋值
  }
}
```

如果你能确定属性会在使用前被赋值（但 TypeScript 无法分析出来），可以使用**非空断言 `!`**：

```typescript
class MyComponent {
  container!: HTMLElement;  // 告诉 TS：我保证初始化后一定有值

  constructor() {
    this.init();  // 比如在 init 中赋值
  }

  init() {
    this.container = document.getElementById("app")!;
  }
}
```

`!` 只是告诉编译器跳过检查，真正的初始化责任在你。常用于 DOM 操作、依赖注入框架等 TypeScript 无法追踪初始化的场景。

### 方法标注

方法的参数和返回值标注与普通函数相同：

```typescript
class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  distance(other: Point): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
```

### getter / setter

如果只有 getter 而没有 setter，该属性会被推导为 `readonly`：

```typescript
class Circle {
  constructor(private radius: number) {}

  get diameter(): number {
    return this.radius * 2;
  }

  set diameter(value: number) {
    this.radius = value / 2;
  }
}
```

注意：
- **setter 不能标注返回值类型**（它的返回值在运行时被忽略），标注了会报错
- getter 和 setter 的访问修饰符必须一致
- 从 TypeScript 4.3 开始，getter 和 setter 的类型可以不同（例如 getter 返回 `string`，setter 接受 `string | number`）

### 类中的索引签名

类也可以声明索引签名，表示可以动态添加符合某类型的属性：

```typescript
class Config {
  [key: string]: string | number;

  apiUrl = "https://api.example.com";
  retryCount = 3;
}

const c = new Config();
c["timeout"] = 5000;    // ✅
// c["timeout"] = true;  // ❌ 值必须是 string | number
```

需要注意的是，类中声明的所有属性和方法都受索引签名约束——这可能导致方法被视为不符合索引签名的值类型：

```typescript
class Bad {
  [key: string]: string;

  // name = "ok";    // ✅
  // age = 18;       // ❌ number 不满足索引签名要求 string
  // greet() {}      // ❌ 方法被视为 ()=>void，不满足索引签名
}
```

## 访问修饰符

TypeScript 提供了三种访问修饰符，它们只在**编译时**生效，编译后的 JavaScript 代码中这些限制会消失（想要运行时真正的私有，请使用 JS 的 `#` 私有字段）：

| 修饰符 | 当前类内部 | 子类 | 实例 |
|--------|----------|------|------|
| `public`（默认） | ✅ | ✅ | ✅ |
| `protected` | ✅ | ✅ | ❌ |
| `private` | ✅ | ❌ | ❌ |

```typescript
class Animal {
  public name: string;
  protected age: number;
  private secret: string;

  constructor(name: string, age: number, secret: string) {
    this.name = name;
    this.age = age;
    this.secret = secret;
  }
}

class Dog extends Animal {
  bark(): void {
    console.log(this.name);     // ✅ public — 任意位置可访问
    console.log(this.age);      // ✅ protected — 子类中可访问
    // console.log(this.secret);// ❌ private — 子类中不可访问
  }
}

const dog = new Dog("Buddy", 3, "loves treats");
console.log(dog.name);          // ✅
// console.log(dog.age);        // ❌ protected 不可在实例上访问
// console.log(dog.secret);     // ❌ private 不可在实例上访问
```

### private 与 # 私有字段的区别

TypeScript 的 `private` 是"软私有"——编译后属性仍然可以被访问，且在运行时可以通过括号语法绕过：

```typescript
class Foo {
  private secret = "hidden";
}

const f = new Foo();
// f.secret;            // ❌ TS 报错，但编译后 JS 代码中仍可访问
// (f as any).secret;   // ✅ 可以通过 any 绕过
```

JavaScript 原生的 `#` 私有字段（ES2022）才是真正的运行时私有：

```typescript
class Foo {
  #secret = "hidden";    // 真正的 JS 私有字段
}

const f = new Foo();
// f.#secret;  // ❌ JS 运行时也会报错，无法绕过
```

选择建议：如果只是需要编译时的类型检查，`private` 足够；如果需要在运行时保证不可访问（比如库的公开 API），使用 `#` 私有字段。

### 受保护的跨实例访问

`protected` 和 `private` 的一个重要细节是：**允许在同一类的方法中访问同类的另一个实例的同名成员**（这在面向对象语言中很常见）：

```typescript
class Point {
  constructor(private x: number, private y: number) {}

  equals(other: Point): boolean {
    // ✅ 可以访问另一个 Point 实例的 private 属性
    return this.x === other.x && this.y === other.y;
  }
}
```

但 `protected` 成员在**不同层级的子类**之间仍受保护：

```typescript
class Base {
  protected x = 1;
}

class Derived1 extends Base {
  protected x = 5;
}

class Derived2 extends Base {
  method(d1: Derived1) {
    // d1.x;  // ❌ 只能在 Base 及其子类的实例上访问 protected，
               // 但 Derived2 不能访问 Derived1 的 protected
  }
}
```

### 私有构造函数

将构造函数设为 `private` 可以阻止类被 `new` 实例化，常用于工具类或单例模式：

```typescript
class Utils {
  private constructor() {}

  static formatDate(date: Date): string {
    return date.toISOString();
  }
}

Utils.formatDate(new Date());  // ✅
// new Utils();                 // ❌ 构造函数是私有的
```

单例模式的经典实现：

```typescript
class Singleton {
  private static instance: Singleton;

  private constructor() {}

  static getInstance(): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton();
    }
    return Singleton.instance;
  }
}
```

访问修饰符解决了"谁能看到这个成员"的问题。但 TypeScript 还提供了一个让你少写代码的语法糖——把声明、赋值和修饰三步合成一步。

## 构造函数参数属性简写

这是 TypeScript 提供的最便捷的语法糖之一——在构造函数参数上直接加修饰符，即可同时完成**声明、赋值和修饰**：

```typescript
class Point {
  // 下面一行等价于声明两个 public 属性 + 在构造函数中赋值
  constructor(public x: number, public y: number) {}
}

const p = new Point(3, 4);
console.log(p.x, p.y);  // 3 4
```

等价展开后：

```typescript
class Point {
  public x: number;
  public y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}
```

支持所有访问修饰符以及 `readonly`：

```typescript
class User {
  constructor(
    public id: number,         // 公开只读
    private password: string,  // 私有
    protected role: string,    // 受保护
    readonly createdAt: Date,  // 只读
  ) {}
}
```

## readonly 属性

`readonly` 属性只能在**声明时**或**构造函数中**被赋值，之后的任何修改都会报错：

```typescript
class Config {
  readonly apiUrl: string;
  readonly retryCount = 3;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;   // ✅ 构造函数中可以赋值
  }

  reset(): void {
    // this.apiUrl = "";    // ❌ 其他方法中不能赋值
    // this.retryCount = 5; // ❌
  }
}
```

注意 `readonly` 参数属性：构造完成后值就固定了，后续不能修改。

## 静态成员

`static` 成员属于类本身（挂在构造函数上），而非实例（不属于 `this`）：

```typescript
class Counter {
  static instances = 0;

  static create(): Counter {
    Counter.instances++;
    return new Counter();
  }

  constructor() {
    // console.log(this.instances);  // ❌ 静态成员不属于 this
  }
}

Counter.create();
console.log(Counter.instances);  // 1
```

静态成员同样支持 `public`/`protected`/`private` 修饰符：

```typescript
class Service {
  private static cache = new Map<string, unknown>();

  static getCached(key: string): unknown {
    return Service.cache.get(key);  // ✅ 类内部可以访问
  }
}

// Service.cache;  // ❌ private 不可从外部访问
```

静态成员会被子类继承：

```typescript
class Base {
  static greeting = "Hello";
}

class Derived extends Base {}

console.log(Derived.greeting);  // "Hello"
```

## 继承与 override

### extends 继承

```typescript
class Animal {
  constructor(public name: string) {}

  makeSound(): string {
    return `${this.name} makes a sound`;
  }
}

class Dog extends Animal {
  constructor(name: string, public breed: string) {
    super(name);  // 必须调用 super
  }

  makeSound(): string {
    return `${this.name} barks!`;
  }
}
```

子类方法重写时，必须与父类方法兼容（参数类型可以更宽——但通常不建议，返回值类型必须与父类返回兼容）：

```typescript
class Base {
  greet(name: string): string {
    return `Hello, ${name}`;
  }
}

class Derived extends Base {
  // ✅ 函数重写：返回类型一致
  greet(name: string): string {
    return super.greet(name).toUpperCase();
  }
}
```

### override 关键字

TypeScript 4.3 引入了 `override` 关键字，用于**显式标记**一个方法是重写父类方法。如果父类没有同名方法，会直接报错：

```typescript
class Base {
  print(): void {}
  render(): void {}
}

class Derived extends Base {
  override print(): void {}   // ✅ 确实重写了父类方法
  // override show(): void {} // ❌ 父类中没有 show 方法
}
```

强烈建议开启 `noImplicitOverride` 编译选项，强制所有重写方法都使用 `override`。这在你修改父类 API 时能避免子类中的静默 bug（比如父类方法改名后，子类可能意外创建了一个新方法）。

### 类型层面的字段声明（declare）

从 TypeScript 3.7 开始，你可以在类中声明字段但不提供初始值，也不在构造函数中赋值——用 `declare` 关键字告诉 TypeScript"这个属性一定存在，不用检查初始化"：

```typescript
class MyComponent {
  declare element: HTMLElement;  // 不要求初始化，编译后不产生 JS 代码

  mount(container: HTMLElement) {
    this.element = container.querySelector(".my-component")!;
  }
}
```

这与非空断言（`!`）不同：
- `x!: number` —— 会产生 `x` 的属性声明，只是跳过初始化检查
- `declare x: number` —— 完全不产生 JS 代码，适用场景不同

## implements 实现接口

`implements` 让类保证自己满足某个接口的结构要求，**只检查不提供实现**：

```typescript
interface Printable {
  print(): void;
}

interface Serializable {
  toJSON(): string;
}

class Document implements Printable, Serializable {
  print(): void {
    console.log("printing...");
  }

  toJSON(): string {
    return JSON.stringify({ title: "doc" });
  }
}
```

与 `extends` 的关键区别：
- `extends` 只能继承**一个**类（单继承），提供实现
- `implements` 可以实现**多个**接口，只进行结构检查

一个类也可以 `implements` 另一个类：

```typescript
class Point {
  x = 0;
  y = 0;
}

// 此时 Point 被视为接口（只检查实例成员，忽略构造函数）
class Point3D implements Point {
  x = 1;
  y = 2;
  z = 3;
}
```

`implements` 只检查实例成员。这意味着接口中定义的方法签名只需保证"类有这个方法"，而不区分该方法是定义在原型上还是实例上：

```typescript
interface Alarm {
  alert(): void;
}

class Door implements Alarm {
  alert() {}  // ✅ 原型方法
}

class Car implements Alarm {
  alert = () => {}  // ✅ 实例属性方法（箭头函数）
}
```

如果 `implements` 的多个接口包含同名属性且类型冲突，会报错：

```typescript
interface A {
  value: string;
}

interface B {
  value: number;
}

// class C implements A, B { }  // ❌ value 类型冲突
```

前面我们用 `implements` 定义了"类必须有什么"，但那只是结构检查，不提供任何实现。如果既想定义契约，又想共享部分实现，就需要抽象类。

## 抽象类

`abstract` 类不能直接实例化，只能被继承。抽象方法必须在派生类中实现：

```typescript
abstract class Shape {
  abstract readonly name: string;    // 抽象属性
  abstract area(): number;           // 抽象方法

  // 抽象类可以包含具体实现
  describe(): string {
    return `${this.name} has area ${this.area()}`;
  }
}

class Circle extends Shape {
  readonly name = "Circle";

  constructor(public radius: number) {
    super();
  }

  area(): number {
    return Math.PI * this.radius ** 2;
  }
}

const c = new Circle(5);
console.log(c.describe());  // "Circle has area 78.539..."
// const s = new Shape();   // ❌ 不能实例化抽象类
```

抽象类的规则：
- 抽象方法只能在抽象类中声明
- 抽象方法不能有实现（不能有 `{ }` 体）
- `private` 和 `abstract` 不能同时用（逻辑矛盾——private 让子类不可见，abstract 又要求子类实现）
- 不能有静态的抽象成员
- 抽象类可以有抽象构造函数签名，用于"构造出该类的子类"的类型约束：

```typescript
abstract class Base {
  abstract getName(): string;
}

// 接受一个能构造出 Base 子类的构造函数
function greet(ctor: new () => Base) {
  const instance = new ctor();
  console.log(instance.getName());
}
```

### 抽象类 vs interface

两者都能定义结构契约，如何选择？

| 维度 | 抽象类 | interface |
|------|--------|-----------|
| 提供部分实现 | ✅ | ❌ |
| protected 成员 | ✅ | ❌ |
| 单继承/多实现 | 单继承 | 多实现 |
| 运行时存在 | ✅（有 JS 代码） | ❌（编译后擦除） |
| 构造函数约束 | ✅ | ❌ |

选择建议：
- 需要共享实现、受保护成员或构造函数约束 → **抽象类**
- 纯粹的契约描述、跨不相关类共享结构 → **interface**

## 泛型类

类可以接受泛型参数，使得同一个类适用于不同类型的数据：

```typescript
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }
}

// 使用时指定具体类型
const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);
const n = numStack.pop();  // number | undefined

const strStack = new Stack<string>();
strStack.push("hello");
```

泛型参数可以有约束和默认值：

```typescript
class BoundedStack<T extends { id: number }> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  findById(id: number): T | undefined {
    return this.items.find(item => item.id === id);
  }
}
```

**注意**：静态成员不能使用类的泛型参数。静态成员属于类本身，只有实例化时才有具体的类型：

```typescript
class Box<T> {
  // static default: T;  // ❌ 静态成员不能引用类型参数
  // static create(): T { }  // ❌ 同理
}
```

## this 的类型

### this 参数

在方法中声明 `this` 的类型（作为第一个假参数），用于验证函数调用时的上下文：

```typescript
class Button {
  constructor(public label: string) {}

  handleClick(this: Button, event: Event): void {
    console.log(`Clicked: ${this.label}`);
  }
}

const btn = new Button("Submit");
btn.handleClick(new Event("click"));     // ✅

// const handler = btn.handleClick;
// handler(new Event("click"));       // ❌ this 上下文丢失
```

`this` 参数只在编译时验证，编译后会被完全擦除，不产生运行时代码。

### 多态 this 类型

在父类方法中使用 `this` 作为返回类型，子类继承时可以自动推导为子类类型：

```typescript
class Builder {
  setName(name: string): this {
    // ...
    return this;
  }
}

class AdvancedBuilder extends Builder {
  setExtra(extra: string): this {
    // ...
    return this;
  }
}

const builder = new AdvancedBuilder()
  .setName("foo")     // 返回 AdvancedBuilder 类型
  .setExtra("bar");   // 可以链式调用子类方法
```

如果 `setName` 的返回类型写死为 `Builder`，则链式调用将无法访问 `setExtra`。`this` 类型能自动适配子类，非常适合**链式调用的构建器模式**。

### this 类型守卫

方法可以返回 `this is Type` 作为类型守卫，在条件判断后收窄 `this` 的类型：

```typescript
class FileSystemObject {
  isFile(): this is FileRep {
    return this instanceof FileRep;
  }
  isDirectory(): this is Directory {
    return this instanceof Directory;
  }
}
```

## 类表达式

和函数表达式一样，类也可以以表达式形式定义，不需要名字：

```typescript
const Point = class {
  constructor(public x: number, public y: number) {}
};

const p = new Point(3, 4);
```

## 类作为类型

在 TypeScript 中，**类名既是值（构造函数）也是类型（实例类型）**：

```typescript
class User {
  constructor(public name: string, public age: number) {}
}

// User 作为类型——指的是实例的类型
const user: User = new User("Alice", 25);

// typeof User 作为类型——指的是构造函数本身的类型
const UserCtor: typeof User = User;
const user2: User = new UserCtor("Bob", 30);
```

这个二元性意味着你可以在需要类型的地方（如函数参数、泛型）直接使用类名：

```typescript
function createUser(data: Partial<User>): User {
  return { name: "default", age: 0, ...data };
}
```

## 本章小结

- 类成员（属性、方法、存取器）默认 `public`，类型标注写在冒号后
- `strictPropertyInitialization` 强制属性在构造结束前被初始化；确定会初始化但 TS 无法分析到时用 `!` 或 `declare`
- 访问修饰符 `public`/`protected`/`private` 提供编译时封装；运行时真私有用 `#`
- 构造函数参数简写（`constructor(public x: number)`）一次性完成声明和赋值
- `readonly` 属性只能在声明时或构造函数中修改
- 静态成员属于类本身，通过 `ClassName.member` 访问，不能使用泛型参数
- `extends` 单继承，`override`（4.3+）确保正确重写
- `implements` 确保类满足接口结构，可多实现，只检查不提供实现
- 抽象类定义未完成契约，不能实例化，由子类填充
- 泛型类让逻辑复用与类型安全兼得；`this` 类型让链式调用的返回类型随子类自动适配

下一章将介绍类型断言与类型守卫——TypeScript 中判断和收窄变量类型的重要能力。
