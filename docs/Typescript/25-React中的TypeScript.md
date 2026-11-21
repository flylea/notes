# 第 25 章 React 中的 TypeScript

组件 props 少写一个字段，父组件传参处没有提示；`useRef` 的泛型写错，`.current` 变成 `never`。React 的类型大多来自 `@types/react`。这一章讲组件、Hooks、事件与 children 的标注模式。

React 与 TypeScript 的协作非常紧密自然：`.tsx` 文件本质上就是支持 JSX 语法的 `.ts` 文件。以下内容聚焦三个核心方面：**组件声明**、**Hooks 泛型坑位**和**内置类型定义**，同时介绍工程实践中的类型组织规范。

## JSX 与 TSX 基础

### 文件后缀与 as 断言

使用 JSX 的文件后缀必须是 `.tsx`。在 `.tsx` 文件中，类型断言**只能使用 `as` 语法**，因为尖括号写法会与 JSX 标签冲突：

```typescript
// 正确：as 断言可用
const foo = bar as string;

const foo = <string>bar; // error TS17008: JSX element 'string' has no corresponding closing tag.
```

### JSX 编译模式

TypeScript 提供多种 JSX 编译模式，通过 `tsconfig.json` 中的 `jsx` 选项控制：

| 模式 | 输入 | 输出 | 输出后缀 |
|------|------|------|---------|
| `preserve` | `<div />` | `<div />` | `.jsx` |
| `react` | `<div />` | `React.createElement("div")` | `.js` |
| `react-jsx` | `<div />` | `_jsx("div", {}, void 0)` | `.js` |
| `react-jsxdev` | `<div />` | `_jsxDEV("div", {}, ...)` | `.js` |
| `react-native` | `<div />` | `<div />` | `.js` |

现代 React 项目（React 17+）推荐使用 `react-jsx`，配合 `jsxImportSource` 指定运行时来源：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

### 项目初始化

使用 Vite 快速创建 React + TypeScript 项目：

```bash
npx create-vite my-app --template react-ts
```

项目创建后，`devDependencies` 中会自动包含 `@types/react` 和 `@types/react-dom`，提供所有 React 相关的类型定义。此外还有 `vite-env.d.ts` 声明文件，通过三斜线指令引入 Vite 的环境类型：

```typescript
/// <reference types="vite/client" />
```

这个声明文件包含了 CSS Modules、图片、字体等非代码文件的导入类型定义：

```typescript
declare module '*.module.css' {
  const classes: CSSModuleClasses;
  export default classes;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
```

## 组件声明

### 普通函数声明

最直接的声明方式：为函数的 props 参数添加类型标注：

```tsx
interface ContainerProps {
  visible: boolean;
  controller: () => void;
}

const Container = (props: ContainerProps) => {
  return <p>Hello TypeScript!</p>;
};
```

属性默认值通过解构默认值自然地声明：

```tsx
const Container = ({
  visible = false,
  controller = () => {},
}: ContainerProps) => {
  return <p>Hello TypeScript!</p>;
};
```

普通函数方式下，TypeScript 能正确推导出返回值类型为 `JSX.Element`。但为了显式约束组件必须返回有效元素，推荐加上返回值类型标注：

```tsx
const Container = (): JSX.Element => {
  return <p>Hello TypeScript!</p>;
};
```

### React.FC 声明

React 提供了 `FC`（FunctionComponent 的缩写）类型来声明函数组件：

```tsx
import { FC } from 'react';

interface ContainerProps {
  visible: boolean;
  controller: () => void;
}

const Container: FC<ContainerProps> = ({
  visible = false,
  controller = () => {},
}) => {
  return <p>Hello TypeScript!</p>;
};
```

`FC` 的类型定义如下：

```typescript
interface FunctionComponent<P = {}> {
  (props: PropsWithChildren<P>, context?: any): ReactElement<any, any> | null;
  propTypes?: WeakValidationMap<P> | undefined;
  contextTypes?: ValidationMap<any> | undefined;
  defaultProps?: Partial<P> | undefined;
  displayName?: string | undefined;
}

type PropsWithChildren<P> = P & { children?: ReactNode | undefined };
```

可以看到 `FC` 自动为 props 附加了 `children` 属性，并且提供了 `propTypes`、`displayName` 等 React 特有属性的类型支持。但在 React 18 的 `@types/react` 中，`FC` 已经不再隐式包含 `children`，需要手动声明。

### 普通函数 vs FC

两者各有优劣，主要差异如下：

| 对比项 | 普通函数 | FC |
|--------|---------|-----|
| 组件泛型 | 支持 | 不支持 |
| 返回值校验 | 需手动标注 | 自动约束 |
| children | 需手动声明 | React 18 后也需手动声明 |
| displayName 等 | 需手动处理 | 内置支持 |
| 子组件挂载 | 直接挂载即可 | 需要交叉类型补充 |
| 代码简洁度 | 较灵活 | 较简洁 |

**推荐做法**：在生产项目中优先使用普通函数 + 返回值标注的方式。这样可以自由使用组件泛型，且代码不会因类型包装器的限制而影响灵活性。Create-React-App 的最新模板也已经不再使用 `FC`。

### 组件泛型

这是普通函数组件的一个重要优势：可以为组件添加泛型参数。

```tsx
import { PropsWithChildren } from 'react';

interface CellProps<TData> {
  field: keyof TData;
}

const Cell = <T extends Record<string, any>>(
  props: PropsWithChildren<CellProps<T>>
) => {
  return <p></p>;
};

interface UserData {
  name: string;
  age: number;
}

const App = () => {
  return (
    <>
      <Cell<UserData> field="name" />  {/* field 只能填 'name' | 'age' */}
      <Cell<UserData> field="age" />
    </>
  );
};
```

在这个例子中，`Cell` 组件通过泛型 `T` 将 `field` 属性的类型约束为 `keyof T`。当在父组件中通过 `<Cell<UserData>>` 显式指定泛型后，`field` 就只能传入 `'name'` 或 `'age'`，实现了更精准的类型安全。这种模式在内网表格、列表等数据展示组件中非常实用。

## Hooks 泛型坑位

React 核心 Hooks 都预留了泛型参数，合理利用可以大幅提升类型安全性。

### useState

useState 支持隐式推导和显式声明两种方式：

```tsx
// 隐式推导为 string
const [name, setName] = useState('hello');

// 显式声明为 string | undefined（未提供初始值时）
const [name, setName] = useState<string>();

// 显式声明联合类型
const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
```

useState 对是否提供初始值有两种重载：

```typescript
// 提供了初始值 → state 类型为 S
function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];

// 未提供初始值 → state 类型为 S | undefined
function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
```

常见踩坑：初始状态为空对象时，不要使用类型断言来欺骗类型系统：

```tsx
// 错误做法：后续使用时可能遗漏必填属性
const [data, setData] = useState<User>({} as User);

// 正确：用 Partial 明确标记为"不完整"
const [data, setData] = useState<Partial<User>>({});
```

需要消费 useState 的返回值类型时，可配合 `ReturnType` 工具类型：

```typescript
// 等同于 useState<number> 的返回值类型：[number, Dispatch<SetStateAction<number>>]
type State = ReturnType<typeof useState<number>>;
```

### useCallback 与 useMemo

两者都支持隐式推导和显式泛型参数：

```tsx
const App = () => {
  // 隐式推导为 (input: number) => boolean
  const handler1 = useCallback((input: number) => {
    return input > 100;
  }, []);

  // 显式提供完整的函数签名
  const handler2 = useCallback<(input: number, compare: boolean) => boolean>(
    (input, compare) => {
      return compare ? input > 100 : input < 100;
    },
    []
  );

  // 隐式推导为 string
  const result1 = useMemo(() => computeExpensiveValue(), []);

  // 显式提供返回类型
  const result2 = useMemo<{ name?: string }>(() => {
    return {};
  }, []);
};
```

通常情况下 useCallback 不需要显式声明泛型，因为参数类型已由回调函数自身确定。useMemo 则更常使用显式泛型来约束返回值。

### useReducer

useReducer 是最能体现 TypeScript 类型优势的 Hook，结合可辨识联合类型（Discriminated Union）可以实现极精准的状态管理：

```tsx
import { useReducer } from 'react';

// 状态类型
interface CounterState {
  count: number;
}

// Action 类型：可辨识联合类型
type CounterAction =
  | {
      type: 'inc';
      payload: {
        amount: number;
        max?: number;
      };
    }
  | {
      type: 'dec';
      payload: {
        amount: number;
        min?: number;
      };
    };

// reducer 函数
function reducer(state: CounterState, action: CounterAction): CounterState {
  switch (action.type) {
    case 'inc':
      return {
        count: action.payload.max
          ? Math.min(state.count + action.payload.amount, action.payload.max)
          : state.count + action.payload.amount,
      };
    case 'dec':
      return {
        count: action.payload.min
          ? Math.max(state.count - action.payload.amount, action.payload.min)
          : state.count - action.payload.amount,
      };
    default:
      // never 类型保证所有分支已穷尽
      const _exhaustive: never = action;
      throw new Error('Unexpected action');
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });

  return (
    <>
      <span>Count: {state.count}</span>
      <button onClick={() => dispatch({ type: 'inc', payload: { amount: 1 } })}>
        +1
      </button>
      <button onClick={() => dispatch({ type: 'dec', payload: { amount: 1, min: 0 } })}>
        -1 (min: 0)
      </button>
    </>
  );
}
```

TypeScript 在 `switch-case` 的每个分支中会自动收窄 `action` 的类型：当 `action.type === 'inc'` 时，`action.payload` 的类型就被精确收窄为 `{ amount: number; max?: number }`，不会误拿到 `min` 属性。

useReducer 的类型推断链路：

```typescript
type Reducer<S, A> = (prevState: S, action: A) => S;
type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;

function useReducer<R extends Reducer<any, any>>(
  reducer: R,
  initialState: ReducerState<R>,
): [ReducerState<R>, Dispatch<ReducerAction<R>>];
```

泛型 `R` 被填完整个 reducer 函数类型，`ReducerState<R>` 通过 `infer` 提取其中的 `S` 参数作为状态类型。

### useRef

useRef 有三种类型重载，分别对应不同的使用场景：

```typescript
function useRef<T>(initialValue: T): MutableRefObject<T>;
function useRef<T>(initialValue: T | null): RefObject<T>;
function useRef<T = undefined>(): MutableRefObject<T | undefined>;
```

实际使用：

```tsx
const App = () => {
  // DOM 引用：初始值为 null → RefObject（不可变）
  const inputRef = useRef<HTMLInputElement>(null);

  // 值引用：初始值非 null → MutableRefObject（可变）
  const countRef = useRef<number>(0);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const increment = () => {
    countRef.current += 1; // MutableRefObject 允许直接修改
  };

  return <input ref={inputRef} />;
};
```

关键规则：**初始值为 `null` 的 ref 会被推导为 `RefObject`（只读的 `current`），初始值非 `null` 的则被推导为 `MutableRefObject`（可写的 `current`）**。

DOM 引用应使用尽可能精确的元素类型，例如 `HTMLInputElement`、`HTMLButtonElement`、`HTMLDivElement` 等，而不是宽泛的 `HTMLElement`。精确的类型包含了特定元素的所有属性和事件方法。

### forwardRef 与 useImperativeHandle

当需要父组件调用子组件暴露的方法时，需要组合使用 `forwardRef` 和 `useImperativeHandle`：

```tsx
import { useRef, useImperativeHandle, forwardRef, ForwardedRef } from 'react';

// 定义 ref 上暴露的方法类型
interface ChildRef {
  focus: () => void;
  reset: () => void;
}

// 属性类型
interface ChildProps {
  label: string;
}

// forwardRef 的两个泛型：<Ref类型, Props类型>
const Child = forwardRef<ChildRef, ChildProps>((props, ref) => {
  useImperativeHandle(ref, () => ({
    focus: () => console.log('focused'),
    reset: () => console.log('reset'),
  }));

  return <div>{props.label}</div>;
});

// 父组件
const Parent = () => {
  const childRef = useRef<ChildRef>(null);

  return (
    <>
      <Child ref={childRef} label="子组件" />
      <button onClick={() => childRef.current?.focus()}>调用子组件 focus</button>
      <button onClick={() => childRef.current?.reset()}>调用子组件 reset</button>
    </>
  );
};
```

`forwardRef` 接受两个泛型参数：第一个是 ref 暴露的方法类型，第二个是组件的 props 类型。`useImperativeHandle` 的返回值类型会自动从传入的 ref 泛型推导。

## 事件处理类型

`@types/react` 提供了丰富的事件类型，最常用的是 `ChangeEvent` 和 `MouseEvent`：

```tsx
import { useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';

const Form = () => {
  const [value, setValue] = useState('');

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    console.log(e.clientX, e.clientY);
  };

  return (
    <>
      <input value={value} onChange={handleChange} />
      <button onClick={handleClick}>Click me</button>
    </>
  );
};
```

事件类型都有一个泛型参数，用于指定触发事件的元素类型，这样可以获得精确的 `e.target` 类型。

React 还提供了完整的事件处理函数类型，使用后无需再标注参数类型：

```tsx
import type { ChangeEventHandler, MouseEventHandler } from 'react';

// e 自动被推导为 ChangeEvent<HTMLInputElement>
const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
  console.log(e.target.value);
};

const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
  console.log(e.clientX);
};
```

常见事件类型一览：

| 事件类型 | 对应的 Handler 类型 |
|---------|-------------------|
| `ChangeEvent<T>` | `ChangeEventHandler<T>` |
| `MouseEvent<T>` | `MouseEventHandler<T>` |
| `KeyboardEvent<T>` | `KeyboardEventHandler<T>` |
| `FormEvent<T>` | `FormEventHandler<T>` |
| `FocusEvent<T>` | `FocusEventHandler<T>` |
| `DragEvent<T>` | `DragEventHandler<T>` |
| `TouchEvent<T>` | `TouchEventHandler<T>` |
| `PointerEvent<T>` | `PointerEventHandler<T>` |

## 内置工具类型

### CSSProperties

用于约束 style 属性的类型，包含了所有 CSS 属性及其合法的值类型：

```tsx
import type { CSSProperties } from 'react';

const styles: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
};

const Card = () => <div style={styles}>content</div>;
```

### ComponentProps

当需要封装原生 HTML 元素或第三方组件、并且保留其所有原生属性时，使用 `ComponentProps`：

```tsx
import type { ComponentProps } from 'react';

// 封装原生 button，继承所有 HTMLButtonElement 属性
interface ButtonProps extends ComponentProps<'button'> {
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary';
}

const Button = ({ size, variant, children, ...rest }: ButtonProps) => {
  return (
    <button className={`btn btn-${variant} btn-${size}`} {...rest}>
      {children}
    </button>
  );
};
```

同样可以提取第三方组件的 props 类型：

```tsx
import { Button } from 'some-ui-lib';
import type { ComponentProps } from 'react';

// 提取 Button 组件的属性类型，在此基础上扩展
type EnhancedButtonProps = ComponentProps<typeof Button> & {
  loading?: boolean;
};
```

`ComponentProps` 的内部实现区分了原生元素和 React 组件两种情况：

```typescript
type ComponentProps<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>> =
  T extends JSXElementConstructor<infer P>
    ? P
    : T extends keyof JSX.IntrinsicElements
    ? JSX.IntrinsicElements[T]
    : {};
```

如果需要区分是否携带 ref，可以使用 `ComponentPropsWithRef` 和 `ComponentPropsWithoutRef`。

### ReactElement 与 ReactNode

这是两个容易被混淆的类型，理解它们的区别很重要：

```typescript
type ReactText = string | number;
type ReactChild = ReactElement | ReactText;
type ReactNode = ReactChild | ReactFragment | ReactPortal | boolean | null | undefined;
```

- **`ReactElement`**：`createElement` 的返回值，本质上等价于 `JSX.Element`。指一个具体的 JSX 元素。
- **`ReactNode`**：范围更广的超集，包含 `ReactElement`、字符串、数字、`null`、`undefined`、`boolean`、`ReactFragment`、`ReactPortal` 等。通常用于 `children` 的类型标注。

```tsx
import type { ReactElement, ReactNode } from 'react';

// 严格来说 children 应该是 ReactNode 而不是 ReactElement
interface CardProps {
  title: string;
  children: ReactNode;  // 可接受字符串、null、多个元素等
}

// 组件的返回值是 ReactElement（或 null）
const Card = ({ title, children }: CardProps): ReactElement | null => {
  if (!title) return null;
  return (
    <div>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
};
```

## JSX 的类型为什么搬进了 React 命名空间

JSX 不是 React 独有的语法。旧版 `@types/react` 用一个全局的 `namespace JSX` 描述 JSX 的规则，React、Preact、自定义运行时都往这个名下挂，类型系统只能合并，不能互斥。项目里同时出现两个 UI 库时，全局声明会互相干扰。

[React 19](https://react.dev/blog/2024/12/05/react-19) 的类型删掉了全局声明，把 `namespace JSX` 搬进 `declare namespace React`。@types/react 19.3.0 的 `index.d.ts` 里，这个命名空间在第 4226 行，外层是第 70 行的 `declare namespace React`，整个文件没有 `declare global`。

搬进包内的意义是归属明确。`jsxImportSource` 指向哪个包，JSX 类型就从哪个包取，多个运行时不再争同一份全局声明。代价是老代码里的 `JSX.Element` 失去解析目标，升级后报 TS2503。

反过来做不到。全局命名空间在 TypeScript 里按名字合并，两份声明不会报冲突，只会混成一份。合并之后 `JSX.Element` 只有一个含义，React 元素和 Preact 元素分不开，泛型组件也没法按运行时区分。把命名空间关进包内，合并范围缩到单个包。

影响面不止业务代码。一些老库的 `.d.ts` 里还写着 `JSX.Element`，主包升级后这些声明同样失去解析目标，报错位置不在自己的文件里。[React 19 的升级说明](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) 把这条列为破坏性变更，建议的替换就是 `React.JSX.Element` 或 `ReactNode`。

改法有两种，从 `react` 导入 `JSX` 类型，或者写完整的 `React.JSX.Element`。组件返回值更推荐用 `ReactNode`，React 19 的 `FunctionComponent` 本身就以 `ReactNode` 作为返回类型。

导入写法是 `import type { JSX } from 'react';`，之后 `JSX.Element` 照常可用。名字空间里的 `Element` 与 `ReactElement` 指向同一个类型，两者可以互换。需要给事件参数标注类型时，从 `react` 导入 `MouseEvent` 之类的类型，它们没有跟着搬进 `JSX` 命名空间。

第三方库如果还写着 `declare global { namespace JSX }`，全局名字会重新出现。那份声明和 React 的类型是两套，元素类型可能对不上，遇到底层库报错先查这一点。

```tsx
import { useRef } from 'react';

function Inner({ label }: { label: string }): JSX.Element {
  return <span>{label}</span>;
}

export function Form() {
  const inputRef = useRef<HTMLInputElement>(null);
  return <Inner ref={inputRef} label="名称" />;
}
```

这段代码编译报两处错。返回类型这一行报 `error TS2503: Cannot find namespace 'JSX'.`。`ref` 那一行报 `error TS2322`，正文是 `Property 'ref' does not exist on type 'IntrinsicAttributes & { label: string; }'.`，原因是 `Inner` 的 props 里没有声明 `ref`。

改法是把返回值改成 `ReactNode`，并在 `Inner` 的 props 里加 `ref?: Ref<HTMLSpanElement>`。React 19 里 `ref` 就是普通 prop，不需要 `forwardRef`。

## 一句话理解 JSX 类型

JSX 类型像户口本，以前全项目共用一本，谁都能翻；现在只挂在 React 名下，引用时要写明户主。这个比喻在切换运行时的时候失效，`jsxImportSource` 指到 Preact 时，户口本跟着换到那个包，React 的名字不再出现。

## 工程实践：类型文件组织

在中小型项目中，类型定义可以就近放在组件文件中。但在大型项目中，推荐建立统一的类型目录：

```
src/
├── types/
│   ├── shared.ts      # 被多处引用的通用类型
│   ├── user.ts        # 按业务域划分的类型
│   ├── order.ts
│   ├── request.ts     # 请求/响应相关的类型
│   └── tool.ts        # 工具类型
├── typings.d.ts       # 全局类型声明
```

**请求类型的封装模式**：

```typescript
// types/request.ts
import type { Status } from './shared';

// 通用响应体
export interface ApiResponse<TData = never> {
  status: Status;
  code: number;
  data: TData;
  message: string;
}

// 分页响应体
export interface PaginatedResponse<TData = never> {
  status: Status;
  curPage: number;
  totalCount: number;
  hasNextPage: boolean;
  data: TData[];
}

// types/user.ts
export interface UserProfile {
  id: number;
  name: string;
  email: string;
}

// api/user.ts
import type { ApiResponse, PaginatedResponse } from '@/types/request';
import type { UserProfile } from '@/types/user';

export function fetchUser(id: number): Promise<ApiResponse<UserProfile>> { /* ... */ }
export function fetchUsers(page: number): Promise<PaginatedResponse<UserProfile>> { /* ... */ }
```

这样就建立起了清晰的、与业务模型一致的引用关系。请求层、类型层、业务层各司其职。

## 小结

- **`.tsx` 文件**中类型断言必须使用 `as` 语法，JSX 编译模式推荐使用 `react-jsx`
- **组件声明**：普通函数 + 返回值标注的方式更灵活，支持组件泛型；FC 更简洁但有局限性
- **组件泛型**允许为组件添加类型参数，在表格、列表等数据展示场景非常实用
- **Hooks 泛型**：useState 注意空初始值的类型问题，useReducer 结合可辨识联合可实现穷尽性检查，useRef 的初始值是否为 null 决定了 MutableRefObject 还是 RefObject
- **事件类型**：`ChangeEvent<T>`、`MouseEvent<T>` 等都有对应的 Handler 类型，泛型参数指定触发的元素类型
- **内置工具类型**：`ComponentProps` 提取组件属性，`CSSProperties` 约束样式对象，`ReactNode` 是比 `ReactElement` 更宽泛的类型
- **工程规范**：按业务域划分类型文件，请求类型用泛型封装，与业务类型建立清晰的引用关系

## 用不上的时候

### props 简单

只有一两个字段的组件，让 TS 从默认值和用法推断即可，显式写 `FC<Props>` 反而增加噪音。

### 数据来自接口

props 上的类型不会校验运行时数据。接口返回的结构要在进入组件前校验。

### ref 与泛型组件

React 19 里 `ref` 可以作为普通 prop，旧的 `forwardRef` 写法只在兼容旧版本时需要。

## 参考

- [React 19 发布说明](https://react.dev/blog/2024/12/05/react-19)：ref 作为普通 prop 等变更。
- [React 19 升级指南](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)：`JSX` 命名空间迁移等破坏性变更。
- [Using TypeScript](https://react.dev/learn/typescript)：React 官方的 TypeScript 用法。
- [@types/react 类型定义](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/react/index.d.ts)：`declare namespace React` 与 `JSX` 的实际位置。
