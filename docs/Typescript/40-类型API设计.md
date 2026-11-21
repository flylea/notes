# 第 40 章 类型 API 设计

库的说明写着「类型完备」，用户第一次调用就卡在报错上，看不出该传什么。类型 API 的验收标准是调用方写得出正确调用，写错时看得懂错在哪。这一章从泛型参数讲到重载、报错文案、品牌和导出面控制。

库的类型设计只有两个验收标准：调用方能写出正确的调用，写错时能从报错里看出错在哪。下面这张表按需求选写法，先定方向再抠细节。

| 需求 | 首选写法 | 代价 |
|---|---|---|
| 返回值随输入的字面量变 | 重载 | 实现签名对调用方不可见 |
| 同一位置有多种互斥的输入形状 | 元组联合 | 报错信息变长 |
| 从一个类型推出另一个类型 | 条件类型加索引访问 | 推断容易失控，需要 `NoInfer` |
| 多处共用同一结构 | 泛型加约束 | 约束写宽了等于没写 |
| 只校验常量，不想改类型 | `satisfies` | 不能用在类型位置 |
| 同形状要区分语义 | 品牌类型 | 运行时数据没有品牌，要构造和剥离 |

下面每个部分对应表里的一行，最后合成一个能编译的请求客户端。

报错是写给调用方看的。参数写成内联联合，报错就列出候选值；包成别名，报错里只剩别名。省下的是自己那几个字，花掉的是调用方翻文档的时间。

选之前先回答两个问题：返回值是否随入参的字面量变化，报错时要不要列出候选值。前者决定用重载还是泛型，后者决定参数类型写成内联联合还是别名。两个问题都有答案，表里的行就只剩一行可选。

## 泛型参数

### 约束只写用得到的成员

约束越宽，调用方越自由，函数体越拿不到信息。写约束的标准是从函数体里反推：函数体访问了哪些成员，就约束哪些。

```ts
interface OrderRow {
  id: string;
  total: number;
}

export function idOfLoose<T extends Record<string, unknown>>(row: T): string {
  return String(row["id"]);
}

export function idOfStrict<T extends { id: string }>(row: T): string {
  return row.id;
}

export const loose = idOfLoose({ title: "没有 id" });
export const strict = idOfStrict({ title: "没有 id" });
```

`loose` 那一行能过，代价是 `row["id"]` 的类型是 `unknown`，函数体里还得再断言一次。`strict` 那一行报 `error TS2353: Object literal may only specify known properties, and 'title' does not exist in type '{ id: string; }'`，调用方在编译期就知道少了字段。

约束写成 `Record<string, unknown>` 还有个副作用：联合类型、交叉类型都能满足它，但 `keyof T` 会退化成 `string`。需要 key 的地方一定用具体结构约束。

`extends` 在类型参数位置是上界约束，不是继承。`T extends OrderRow` 表示 T 必须能赋给 OrderRow，传 OrderRow 本身、传带更多字段的结构都合法，传缺字段的结构报错。约束里可以省略字段，不能写错字段名。

### 类型参数至少出现两次

`function log<T>(value: T): void` 里的 `T` 只出现一次，调用方传什么都被丢掉，这个泛型没有意义，直接写 `value: unknown` 更清楚。

`function identity<T>(value: T): T` 里 `T` 出现两次，返回类型受入参约束，泛型才起作用。推断不出关系的地方，说明这个类型参数不该存在。

例外是约束位置。`function pick<T, K extends keyof T>(source: T, key: K): T[K]` 里 `K` 出现三次，`T` 出现两次，每个参数都在参与推导，这是正常的泛型。

单次类型参数可以交给 lint 挡。typescript-eslint 的 `no-unnecessary-type-parameters` 就是查这个的，开了之后 CI 会直接报。

### 默认值放尾部

默认类型参数必须排在必填参数后面，写反了报 `error TS2706: Required type parameters may not follow optional type parameters`。

```ts
interface PagedResponse<T, Meta = Record<string, never>> {
  items: T[];
  meta: Meta;
}

export type PlainRows = PagedResponse<{ id: string }>;
export type TimedRows = PagedResponse<{ id: string }, { tookMs: number }>;

declare const timed: TimedRows;
const took: number = timed.meta.tookMs;
```

默认值的作用是让简单场景少写一个参数。默认值不要选 `any` 或 `unknown`，那会让第二个参数失去约束意义。

### const 类型参数

普通类型参数遇到对象和数组字面量会拓宽，`const` 类型参数保留字面量。

```ts
export function routeTable<const T extends Record<string, string>>(table: T): T {
  return table;
}

const routes = routeTable({ list: "/orders", get: "/orders/:id" });
const listPath: "/orders" = routes.list;
```

不写 `const`，`routes.list` 的类型是 `string`，`"/orders"` 这行就过不了。这个特性适合定义常量和配置表，不适合函数参数是用户输入的场景。

`const` 只能加在函数、方法、类的类型参数上。`interface Box<const T>` 报 `TS1277`。

## 让推断符合预期

### 类型参数放在能推断的位置

调用方通常希望只写一个参数就能推出全部类型。把类型参数放在返回值里、而参数位置没有对应信息，调用方就只能显式指定。

```ts
export function createCache<T>(): Map<string, T> {
  return new Map<string, T>();
}

const numbers = createCache<number>();
```

`T` 只在返回类型里，调用时必然要显式写 `<number>`。改成 `createCache<T>(initial: T): Map<string, T>`，`T` 就能从入参推出来。

### NoInfer 挡住不需要的推断

有的参数只该被校验，不该参与推断。5.4 的 `NoInfer` 就是干这个的。

```ts
declare function configure<O>(options: O, overrides: NoInfer<O>): O;

export const ok = configure({ timeout: 3000 }, { timeout: 5000 });
export const bad = configure({ timeout: 3000 }, { timeout: 5000, retries: 2 });
```

`bad` 报 `error TS2353: Object literal may only specify known properties, and 'retries' does not exist in type '{ timeout: number; }'`。报错落在第二个参数上，指向明确。

不加 `NoInfer` 时，`O` 从两处同时推断，最终取并集或交集，报错点会挪到第一个参数，读起来像第一个参数写错了。

### satisfies 校验常量，不改类型

库的默认配置表既想被校验完整，又想保留字面量供后续使用。

```ts
type RouteKey = "orders.list" | "orders.get";

const retries = { "orders.list": 2, "orders.get": 0 } as const satisfies Record<RouteKey, number>;

const listRetries: 2 = retries["orders.list"];
```

`satisfies` 只检查结构，不替换类型，所以键少了或多了会报错，已有的字面量还在。去掉 `as const`，`retries["orders.list"]` 的类型被上下文拓宽成 `number`，`2` 这行就过不了。

`as const` 给的是只读字面量，`satisfies` 给的是校验。两个一起用才是配置表的正确写法。

## 重载、联合、条件类型

### 返回值随字面量变，用重载

一组重载的调用签名可以按入参字面量返回不同类型，联合类型做不到这一点，写法的细节见 [函数重载](https://www.typescriptlang.org/docs/handbook/2/functions.html)。

```ts
interface OrderRecord {
  id: string;
  total: number;
}

interface CustomerRecord {
  name: string;
  level: number;
}

export function recordOf(kind: "order"): OrderRecord;
export function recordOf(kind: "customer"): CustomerRecord;
export function recordOf(kind: "order" | "customer"): OrderRecord | CustomerRecord {
  return kind === "order" ? { id: "ord_1", total: 0 } : { name: "c", level: 0 };
}

const order = recordOf("order");
const total: number = order.total;
```

调用 `recordOf("invoice")` 报 `error TS2769: No overload matches this call.`，下面一行说明 `Argument of type '"invoice"' is not assignable to parameter of type '"customer"'`。

同一件事用泛型也能写，但表达的意思不同。泛型说「所有入参都属于同一族」，重载说「这几种入参各有各的返回」。入参是一个联合、返回也是对应的联合时，重载更直接；入参和返回是同一类型变量的变换时，泛型更合适。

重载的三条规矩：

1. 调用签名从具体到宽泛排列，宽泛的放前面会让后面的不可达。
2. 实现签名不参与调用检查，参数写宽一点，通常写 `unknown` 或联合。
3. 重载超过四个，考虑改成元组联合或可辨识联合。

### 互斥的输入形状，用元组联合

一个函数接受「两个参数」或「一个参数」两种调用方式时，重载能写，元组联合更短。

```ts
type CancelReason = "customer" | "fraud" | "timeout";
type CancelArgs = [orderId: string, reason?: CancelReason];

export function cancelOrder(...args: CancelArgs): void {
  const [orderId, reason = "customer"] = args;
  void orderId;
  void reason;
}

cancelOrder("ord_123");
cancelOrder("ord_123", "customer");
```

传三个参数报 `error TS2554: Expected 1-2 arguments, but got 3.`，参数的语义也写在元组标签里。这种写法只适合参数少、形状固定的场景，参数一多，可辨识联合更好读。

### 从一个类型推出另一个，用索引访问

路由表定义一次，参数和响应类型都从表里推，调用方不用重复写。

```ts
interface OrderRecord {
  id: string;
  total: number;
}

interface RouteTable {
  "orders.list": {
    params: { cursor?: string; limit?: number };
    response: { rows: OrderRecord[]; nextCursor: string | null };
  };
  "orders.get": {
    params: { id: string };
    response: OrderRecord;
  };
}

export type RouteKey = keyof RouteTable;
export type ParamsOf<K extends RouteKey> = RouteTable[K]["params"];
export type ResponseOf<K extends RouteKey> = RouteTable[K]["response"];

declare const params: ParamsOf<"orders.get">;
const id: string = params.id;
```

这里用的是索引访问类型，没用条件类型。差别在于：每个路由都有 `params`，索引访问就够了；如果某些路由没有某个字段，才需要 `RouteTable[K] extends { body: infer B } ? B : never`。

条件类型（[手册](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)）用得越多，推断越难控制。能从索引访问拿到的，不要绕条件类型。

## 让报错可读

报错信息里出现什么，由参数类型决定。三种写法的实际输出差别很大：

```ts
declare function readA(key: keyof { "orders.list": 1; "orders.get": 1 }): Promise<void>;
declare function readB(key: RouteKeyAlias): Promise<void>;
declare function readC(key: "orders.list" | "orders.get" | "orders.cancel"): Promise<void>;

type RouteKeyAlias = "orders.list" | "orders.get" | "orders.cancel";

// readA("orders.fetch")
// error TS2345: Argument of type '"orders.fetch"' is not assignable to
//   parameter of type '"orders.get" | "orders.list"'.
// readB("orders.fetch")
// error TS2345: Argument of type '"orders.fetch"' is not assignable to
//   parameter of type 'RouteKeyAlias'.
// readC("orders.fetch")
// error TS2345: Argument of type '"orders.fetch"' is not assignable to
//   parameter of type '"orders.cancel" | "orders.get" | "orders.list"'.
```

`readA` 和 `readC` 直接在报错里列出候选值，`readB` 只给一个别名，读者还要去翻定义。给业务代码用的 API，参数位置宁可多写几个字，也别用别名包一层。

### 报错文本怎么拼出来

报错里的两段文字都是打印出来的：源类型打一次，目标类型打一次。打印按符号走，有名字写名字，没名字展开结构。`RouteKeyAlias` 有名字，报错写别名；内联联合没有名字，只能列成员。

打印的不是类型定义，是类型在当前上下文里的展开结果。同一个类型在 A 处打印成别名，在 B 处可能展开成结构，取决于那一处有没有符号名。

打印还有长度上限。联合成员多的时候报错会截断，只留前几项和计数。参数类型别指望报错来教用户，候选清单要写进文档。

7.0 改了一处打印：重载全部失败时，5.9 逐条列出每个重载的原因，7.0.2 只给最后一个（`The last overload gave the following error.`）。重载多的时候，报错不再给全部候选，签名的顺序开始影响可读性。

打印结果还受写法影响。同一份签名，参数写成内联联合，报错列出成员；包成类型别名，报错只写别名。本节开头那组 `readA`、`readB`、`readC` 就是这个差别，改一行写法，读报错的人从三个候选值变成一个名字。

名字来自符号表，不来自源码路径。同一个类型从两个入口导入，指向同一个符号，打印的名字一样。要让调用方看清来源，别名起得具体一些，别用 `Options` 这种到处重名的名字。

参数名也会进报错和编辑器提示。`key` 改叫 `route`、`v` 改叫 `params`，成本为零，读起来更顺。

`key` 这类参数名也有用。把 `key: K` 写成 `route: K`，报错和编辑器提示都读着更顺。

### 三个报错原文

下面这个文件存成 `api.ts`，同时踩三个坑：重载参数不匹配、对象字面量多字段、字符串没走品牌构造。

```ts
declare function pick(x: string): string;
declare function pick(x: number): number;

interface RequestOptions {
  retries: number;
}

declare function request(path: string, options: RequestOptions): Promise<unknown>;

type UserId = string & { readonly __brand: "UserId" };

export async function run(id: string): Promise<void> {
  const v = pick(true);
  await request("/orders", { retries: 3, timeout: 1000 });
  const userId: UserId = id;
  console.log(v, userId);
}
```

```bash
$ tsc --noEmit --strict --target es2022 --module esnext --moduleResolution bundler api.ts
api.ts(13,18): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'boolean' is not assignable to parameter of type 'number'.
api.ts(14,42): error TS2353: Object literal may only specify known properties, and 'timeout' does not exist in type 'RequestOptions'.
api.ts(15,9): error TS2322: Type 'string' is not assignable to type 'UserId'.
  Type 'string' is not assignable to type '{ readonly __brand: "UserId"; }'.
```

TS2769 说明所有重载都失败，7.0 只讲最后一个的原因。TS2353 是多余属性检查，`RequestOptions` 里没有 `timeout`。TS2322 的第二行把品牌类型的结构打印出来，调用方一眼能看出缺了哪一层。

修法各不同：`pick(true)` 改成传字符串或数字；`timeout` 要么加进接口，要么从这个调用里去掉；`UserId` 要经过 `asUserId(id)` 这类构造函数，不能直接赋值。

品牌那行的第二句还打印了结构，`{ readonly __brand: "UserId" }`，说明品牌没有被擦除，它留在类型里，运行时没有对应数据。想藏住内部结构，可以换成 `unique symbol` 做键，报错里就只剩别名。

### never 兜底，让遗漏变成报错

联合类型加了成员，穷尽检查会立刻报错，而不是等运行时。

```ts
interface CreatedEvent {
  type: "created";
}

interface PaidEvent {
  type: "paid";
}

interface RefundedEvent {
  type: "refunded";
}

type OrderEvent = CreatedEvent | PaidEvent;
type NextOrderEvent = OrderEvent | RefundedEvent;

function assertNever(value: never): never {
  throw new Error("未覆盖的类型: " + JSON.stringify(value));
}

export function handle(event: OrderEvent): void {
  switch (event.type) {
    case "created":
      return;
    case "paid":
      return;
    default:
      assertNever(event);
  }
}

export function handleNext(event: NextOrderEvent): void {
  switch (event.type) {
    case "created":
      return;
    case "paid":
      return;
    default:
      assertNever(event);
  }
}
```

`handleNext` 报 `error TS2345: Argument of type 'RefundedEvent' is not assignable to parameter of type 'never'.`。新加的事件类型没处理，编译就过不去。

`assertNever` 要自己写，TypeScript 不提供。

## 品牌类型

`string` 和 `string` 之间可以互相赋值，订单号和客户 ID 撞了也发现不了。品牌类型给同一个底层类型加上区分。

```ts
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type OrderId = Brand<string, "OrderId">;
export type Cents = Brand<number, "Cents">;
```

`unique symbol` 是标准库层面保证唯一的符号，外部模块声明不出第二个，所以品牌无法伪造。`readonly` 让品牌字段不可写。

另一种常见写法是用字符串属性：

```ts
type InvoiceId = string & { readonly __brand: "InvoiceId" };
type QuoteId = string & { readonly __brand: "QuoteId" };

function asInvoiceId(raw: string): InvoiceId {
  return raw as InvoiceId;
}

declare function loadInvoice(id: InvoiceId): void;

loadInvoice(asInvoiceId("inv_1"));
```

两种写法的区别：

| | `unique symbol` | 字符串属性 |
|---|---|---|
| 能否被外部伪造 | 不能 | 能，同名属性可以交叉出同样结构 |
| 声明合并风险 | 无 | 有，接口扩展可能撞上 |
| 调试时的可读性 | 差，打印成 `[brand]` | 好，能直接看到 `__brand` |
| 跨包共享品牌 | 要导出符号类型 | 直接引用字符串 |

库对外发布时用 `unique symbol`，团队内部工具用字符串属性更省事。

### 构造与剥离

品牌类型不能凭空产生，构造时必须做运行时校验，把校验和品牌绑在一起。

```ts
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };
export type OrderId = Brand<string, "OrderId">;
export type Cents = Brand<number, "Cents">;

export function asOrderId(raw: string): OrderId {
  if (!/^ord_[0-9a-zA-Z]+$/.test(raw)) {
    throw new TypeError("订单号格式不对: " + raw);
  }
  return raw as OrderId;
}

export function asCents(raw: number): Cents {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new RangeError("金额必须是非负整数分: " + raw);
  }
  return raw as Cents;
}
```

品牌是底层类型的子类型，所以能直接当 `string` 或 `number` 用。反过来不行：

```ts
declare const brand: unique symbol;
type OrderId = string & { readonly [brand]: "OrderId" };

declare function asOrderId(raw: string): OrderId;

const orderId = asOrderId("ord_123");
const raw: string = orderId;
const cents: number = orderId;
```

`cents` 那行报 `error TS2322: Type 'OrderId' is not assignable to type 'number'`。要拿回底层类型，用条件类型剥：

```ts
declare const brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [brand]: string };
type Unbrand<T> = T extends Brand<infer Raw, string> ? Raw : T;

declare const orderId: Brand<string, "OrderId">;
const raw: Unbrand<typeof orderId> = orderId;
```

JSON 往返是品牌的现实问题。`JSON.parse` 的结果是 `unknown`，从网络拿到的订单号必须重新过 `asOrderId`，不能直接标成 `OrderId`。品牌只在类型层存在，序列化后什么都不剩。

品牌参与算术会退回底层类型。`Cents + Cents` 的结果是 `number`，想继续当金额用，要重新过构造器：

```ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };
type Cents = Brand<number, "Cents">;

declare function asCents(raw: number): Cents;
declare const price: Cents;
declare const tax: Cents;

const total = price + tax;
const wrapped: Cents = total;
```

`total` 的类型是 `number`，`wrapped` 那行报 `error TS2322: Type 'number' is not assignable to type 'Cents'`，改写成 `asCents(price + tax)` 才过。

这条限制看着麻烦，实际是保护：加法和乘法可能产生负数或小数，必须再过一次范围校验。比较运算不受影响，`price < tax` 照常能写。

品牌的 `readonly` 字段只在类型层存在。`JSON.stringify(price)` 输出一个数字，`Object.keys(price)` 不会列出 `brand`。所以品牌能挡住写错的代码，挡不住恶意的 `as`，代码审查时仍要关注断言。

`asCents` 这类构造器还把业务规则写进了类型入口：金额以分为单位、不能为负、必须是整数。后期想改单位，改构造器一处就够。

## 向后兼容

库的次要版本升级不该破坏调用方。判断标准是「调用方的代码能不能不改就编过」。

| 改动 | 是否破坏 | 原因 |
|---|---|---|
| 给参数对象加可选属性 | 不破坏 | 调用方不传也能过 |
| 给参数对象加必填属性 | 破坏 | 调用方全部要补字段 |
| 给联合类型加成员 | 破坏 | 穷尽检查的 switch 要补分支 |
| 给返回值加字段 | 不破坏 | 多出的字段不影响旧用法 |
| 把返回类型改窄 | 破坏 | 旧代码可能依赖宽类型 |
| 放宽参数类型 | 不破坏 | 旧的调用形式仍然合法 |
| 收紧参数类型 | 破坏 | 旧的调用形式可能不合法 |

加可选属性是标准做法，调用方的旧代码不受影响：

```ts
interface ListParamsV1 {
  limit?: number;
}

interface ListParamsV2 {
  limit?: number;
  cursor?: string;
}

type RequestV1 = (params: ListParamsV1) => Promise<void>;

const callWithV2: RequestV1 = async (params: ListParamsV2) => {
  void params.cursor;
};

export async function oldCaller(): Promise<void> {
  await callWithV2({ limit: 20 });
}
```

加必填属性就破坏兼容：

```ts
interface ListParamsV1 {
  limit?: number;
}

interface ListParamsV3 {
  limit?: number;
  cursor: string;
}

type RequestV1 = (params: ListParamsV1) => Promise<void>;

const callWithV3: RequestV1 = async (params: ListParamsV3) => {
  void params.cursor;
};
```

报 `error TS2322: Type '(params: ListParamsV3) => Promise<void>' is not assignable to type 'RequestV1'. Property 'cursor' is missing in type 'ListParamsV1' but required in type 'ListParamsV3'`。函数参数的兼容性检查是逆向的：实现方接受更少字段，就满足不了要求更多的调用方。

同一条规则也解释了为什么给联合加成员算破坏性变更：函数的参数类型从三个成员变成三个成员，接受面变窄了，而穷尽检查依赖接受面完整。

类型兼容不等于行为兼容。放宽参数类型、返回值类型不变，类型检查全过，但实现可能开始接受以前会报错的输入，运行时行为变了。这种改动要进变更日志，不能只靠类型检查判断。

泛型约束收紧也是破坏性变更。`<T extends object>` 改成 `<T extends Record<string, unknown>>`，以前能过的调用方全部报错。约束放宽则相反，旧的调用形式仍然合法。

`@types` 包的版本号跟库版本走，补丁号只改类型错误，次版本号可以加可选属性，主版本号才允许破坏性变更。自己的库按这个节奏发布，下游升级才省心。

## 导出面控制

库的 `index.ts` 决定下游能看到什么。原则是只导出调用方需要的形状，内部实现不导出。

只导出调用方需要的形状，内部实现不导出。导出的每个符号都是承诺：改名、删除、改语义都算破坏性变更。库的作者按这个成本决定导出面。

下面的 `index.ts` 放在 `src/api/` 下，是客户端的公开入口。

`verbatimModuleSyntax` 打开后，类型导出必须带 `type`：

```ts
export type { ApiClient, ApiError, Result } from "./client.js";
export type { OrderRow, ParamsOf, ResponseOf } from "./routes.js";
export { createClient } from "./client.js";
```

这块是 `src/api/index.ts`，`./client.js`、`./routes.js` 在本节前面给出；单块编译报 `TS2307`。

把 `export type` 写成 `export`，报 `error TS1205: Re-exporting a type when 'verbatimModuleSyntax' is enabled requires using 'export type'.`；导入类型时不写 `type`，报 `error TS1484: 'ApiError' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.`。好处是类型导入在编译后消失，运行时不留空 import。

导出面还要对 `isolatedDeclarations` 友好。打开这个选项后，每个导出符号的类型必须能从声明本身推出来，编译器不跨文件分析。

```ts
const defaults = { retries: 2 };

export const retryCount = defaults.retries;
```

报 `error TS9010: Variable must have an explicit type annotation with --isolatedDeclarations.` 加上 `: number` 就好。导出的函数也一样，返回类型必须显式写，否则报 `TS9013`。

`isolatedDeclarations` 的意义是让 d.ts 生成可以按文件并行，超大库能显著缩短构建时间。对外的类型包值得打开。

## 完整例子：类型安全的请求客户端

下面是一个能编译的请求客户端，三个源文件加一个入口。项目根目录跑 `tsc -p .`，退出码为 0。

```json
{
  "compilerOptions": {
    "strict": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "es2025",
    "types": [],
    "noEmit": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true
  },
  "include": ["./src"]
}
```

`exactOptionalPropertyTypes` 和 `noUncheckedIndexedAccess` 在这里不是装饰。前者让可选属性不能写 `undefined`，后者让 `rows[0]` 的类型带上 `undefined`，调用方必须处理空数组。

`package.json` 里写 `"type": "module"`，源码里的相对导入带 `.js` 后缀。`types` 留空，客户端不引入 Node 类型。

### 领域类型

`src/domain/brand.ts`。

```ts
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };
export type Unbrand<T> = T extends Brand<infer Raw, string> ? Raw : T;

export type OrderId = Brand<string, "OrderId">;
export type Cents = Brand<number, "Cents">;

export function asOrderId(raw: string): OrderId {
  if (!/^ord_[0-9a-zA-Z]+$/.test(raw)) {
    throw new TypeError("订单号格式不对: " + raw);
  }
  return raw as OrderId;
}

export function asCents(raw: number): Cents {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new RangeError("金额必须是非负整数分: " + raw);
  }
  return raw as Cents;
}
```

`OrderId` 是 `string` 的子类型，能直接当字符串用，不用包一层对象。包成 `{ value: string }` 的话，每个读写点都要写 `.value`，业务代码会被 `.value` 填满。

构造器是品牌的唯一入口。`asOrderId` 校验格式，`asCents` 校验单位和范围。规则写在构造器里，改规则只改一处。

### 路由表

`src/api/routes.ts`。

```ts
import type { Cents, OrderId } from "../domain/brand.js";

export interface OrderRow {
  id: OrderId;
  customer: string;
  total: Cents;
  status: "draft" | "paid" | "cancelled";
}

export type CancelReason = "customer" | "fraud" | "timeout";

export interface RouteTable {
  "orders.list": {
    params: { cursor?: string; limit?: number };
    response: { rows: OrderRow[]; nextCursor: string | null };
  };
  "orders.get": {
    params: { id: OrderId };
    response: OrderRow;
  };
  "orders.cancel": {
    params: { id: OrderId; reason: CancelReason };
    response: { status: "cancelled" };
  };
}

export type RouteKey = keyof RouteTable;
export type ParamsOf<K extends RouteKey> = RouteTable[K]["params"];
export type ResponseOf<K extends RouteKey> = RouteTable[K]["response"];
```

从这一节起按文件分段展示。每块只含一个文件的一段，单独编译会报 `TS2307: Cannot find module`；`RouteKey`、`ParamsOf` 这类名字在别的块里定义，单独编译报 `TS2304` 或 `TS2552`。

一张表同时定义了路由名、参数、响应三样。加一个路由只改这张表，客户端实现不用动。

`ParamsOf` 用的是索引访问类型。每个路由都有 `params` 字段，索引访问就够了。如果有的路由没有 `params`、有的只有 `body`，才需要条件类型加 `infer`。

### 客户端签名

`src/api/client.ts` 第一部分。

```ts
import type { OrderId } from "../domain/brand.js";
import type { OrderRow, ParamsOf, ResponseOf, RouteKey } from "./routes.js";

export type ApiError =
  | { kind: "network"; cause: unknown }
  | { kind: "http"; status: number; requestId: string }
  | { kind: "parse"; raw: string }
  | { kind: "validation"; issues: readonly string[] };

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError };

export interface ClientConfig {
  baseUrl: string;
  token: string;
}

export interface ApiClient {
  request<K extends RouteKey>(key: K, params: ParamsOf<K>): Promise<Result<ResponseOf<K>>>;
}
```

`request` 的 `K` 从第一个参数推出来，`ParamsOf<K>` 和 `ResponseOf<K>` 跟着变。调用方写 `client.request("orders.get", { id })` 时不用写任何类型参数。

这一行签名是整个库的核心：路由名、参数形状、响应类型三者由同一个 `K` 串起来。改路由表，三处同时更新。

### 解码器

`src/api/client.ts` 接上。

```ts
type Decoder<K extends RouteKey> = (raw: unknown) => ResponseOf<K>;

function asRecord(raw: unknown, where: string): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new TypeError(`${where}: 期望对象`);
  }
  return raw as Record<string, unknown>;
}

function asOrderRow(raw: unknown): OrderRow {
  const record = asRecord(raw, "OrderRow");
  const { id, customer, total, status } = record;
  if (typeof id !== "string" || typeof customer !== "string") {
    throw new TypeError("OrderRow: id 或 customer 不是字符串");
  }
  if (typeof total !== "number") {
    throw new TypeError("OrderRow: total 不是数字");
  }
  if (status !== "draft" && status !== "paid" && status !== "cancelled") {
    throw new TypeError("OrderRow: status 越界");
  }
  return { id: id as OrderId, customer, total: total as OrderRow["total"], status };
}

const decoders: { [K in RouteKey]: Decoder<K> } = {
  "orders.list": (raw) => {
    const record = asRecord(raw, "orders.list");
    const rows = record["rows"];
    if (!Array.isArray(rows)) {
      throw new TypeError("orders.list: rows 不是数组");
    }
    for (const row of rows) {
      asOrderRow(row);
    }
    const nextCursor = record["nextCursor"];
    if (nextCursor !== null && typeof nextCursor !== "string") {
      throw new TypeError("orders.list: nextCursor 类型不对");
    }
    return { rows, nextCursor };
  },
  "orders.get": (raw) => asOrderRow(raw),
  "orders.cancel": (raw) => {
    const record = asRecord(raw, "orders.cancel");
    if (record["status"] !== "cancelled") {
      throw new TypeError("orders.cancel: status 不是 cancelled");
    }
    return { status: "cancelled" };
  },
};
```

`{ [K in RouteKey]: Decoder<K> }` 是一张编译期清单。少写一个路由，报 `TS2741` 缺属性；多写一个，报 `TS2353` 属性不存在。

每个解码器只做一件事：把 `unknown` 收窄成响应类型。断言都落在函数体里，调用方看不到。

### 入口函数

`src/api/client.ts` 接上。

```ts
export function createClient(config: ClientConfig): ApiClient {
  return {
    async request<K extends RouteKey>(key: K, params: ParamsOf<K>): Promise<Result<ResponseOf<K>>> {
      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/rpc/${key}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${config.token}` },
          body: JSON.stringify(params),
        });
      } catch (cause) {
        return { ok: false, error: { kind: "network", cause } };
      }
      if (!response.ok) {
        const requestId = response.headers.get("x-request-id") ?? "";
        return { ok: false, error: { kind: "http", status: response.status, requestId } };
      }
      const text = await response.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return { ok: false, error: { kind: "parse", raw: text } };
      }
      try {
        return { ok: true, value: decoders[key](raw) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: { kind: "validation", issues: [message] } };
      }
    },
  };
}
```

`fetch` 只在这一处出现。四种失败都在函数内部转成 `ApiError`，调用方拿到 `Result` 就能处理，不用写 `try/catch`。

`decoders[key]` 的类型靠 `K` 保证：`key` 是 `RouteKey` 的成员，`decoders` 的键也是 `RouteKey` 的成员，两边对齐。

### 错误文案

`src/api/errors.ts`。

```ts
import type { ApiError } from "./client.js";

export function assertNever(value: never): never {
  throw new Error("未覆盖的类型: " + JSON.stringify(value));
}

export function formatApiError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return "网络不可用，稍后重试";
    case "http":
      return `HTTP ${error.status}，requestId ${error.requestId}`;
    case "parse":
      return "响应不是合法 JSON";
    case "validation":
      return `响应字段不对：${error.issues.join("；")}`;
    default:
      return assertNever(error);
  }
}
```

四个 `case` 覆盖了 `ApiError` 的全部成员，`default` 里 `error` 的类型是 `never`，`assertNever` 才接受。

给 `ApiError` 加一种错误，`assertNever` 那行立刻报 `TS2345`。这就是 never 兜底的作用：漏处理会变成编译错误，不会留到线上。

### 调用方

`src/main.ts`。

```ts
import { asOrderId } from "./domain/brand.js";
import { createClient } from "./api/client.js";
import { formatApiError } from "./api/errors.js";

const client = createClient({ baseUrl: "https://api.example.test", token: "dev" });

export async function loadFirstPage(): Promise<void> {
  const page = await client.request("orders.list", { limit: 20 });
  if (!page.ok) {
    console.error(formatApiError(page.error));
    return;
  }
  const rows = page.value.rows;
  const first = rows[0];
  if (first !== undefined) {
    console.log(first.id, first.total, first.status);
  }
  console.log(page.value.nextCursor);
}

export async function cancelOrder(rawId: string): Promise<void> {
  const result = await client.request("orders.cancel", {
    id: asOrderId(rawId),
    reason: "customer",
  });
  if (result.ok) {
    console.log(result.value.status satisfies "cancelled");
  }
}
```

`./domain/brand.js`、`./api/client.js`、`./api/errors.js` 都在本节前面给出；单块编译报 `TS2307`。

`loadFirstPage` 里没有一处类型标注，`page.value` 的字段全部来自路由表。把 `"orders.list"` 写成 `"orders.fetch"`，报 `TS2345`，候选值是 `keyof RouteTable`。

`cancelOrder` 里 `id` 必须过 `asOrderId`。直接传 `rawId` 报 `TS2322`，提示 `Type 'string' is not assignable to type 'OrderId'`。漏校验的代码写不出来，这是品牌类型最直接的价值。

### 断言的位置

整个库只有三处类型断言：`asRecord` 的返回值、`asOrderRow` 里的两个字段、构造器的返回值。前两处把 `unknown` 收窄成具体形状，后两处把校验过的值标成品牌。

断言集中在解码层，业务层一处都没有。审查代码时只要看这几个函数，就知道外部数据在哪里被信任。

另一种做法是用 zod 之类的运行时校验库。断言会消失，换成一个 schema，代价是多一个依赖，打包体积和冷启动时间都会涨。类型 API 的目标不是消灭断言，是让断言少、位置固定、可复查。

三个文件的依赖方向也是设计的一部分：`routes.ts` 不依赖任何文件，`client.ts` 依赖 `routes.ts` 和 `brand.ts`，`errors.ts` 依赖 `client.ts`。加路由不会动客户端实现，改错误文案不会动请求逻辑。

类型也要有测试。运行时测试覆盖不到类型错误，用 `expect-type` 或 `tsd` 这类库写类型断言，把关键签名钉住：`request` 的参数错了必须报错，`formatApiError` 的返回值必须是 `string`，品牌不能和裸字符串互相赋值。改签名时这些测试先红，比等下游用户报 issue 快。

## 用不上的时候

### 调用方只有一两个

内部函数、私有工具，调用点就那几处。上重载、条件类型、品牌之后，维护成本立刻超过收益。直接写联合类型或具体函数签名，出错时改调用点比读类型定义快。

### 形状少但取值多

参数是几个枚举字段时，用类型层穷举组合，类型数量会随字段个数相乘。这类输入该用 `string` 加运行时校验，zod 能给出字段和原因。类型层只描述已经确定的形状，不负责穷举运行时取值。

### 推断已经够用

`<T>(value: T) => T` 这类签名，调用方不写类型参数也能推出来。再加一层条件类型或品牌，只是让报错变长。`satisfies` 能解决的地方，不要引入泛型约束和类型运算。

## 参考

- [TypeScript 手册：泛型](https://www.typescriptlang.org/docs/handbook/2/generics.html)：约束、默认值与类型参数推断的规则。
- [TypeScript 手册：函数重载](https://www.typescriptlang.org/docs/handbook/2/functions.html)：调用签名、实现签名与重载挑选顺序。
- [TypeScript 手册：条件类型](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)：`extends` 判断、`infer` 与分配规则。
