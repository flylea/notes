# 第 2 章 组件与模板语法

## 2.1 组件由两段组成

`.astro` 文件的格式固定：`---` 围栏之间是脚本段，之后是模板。

```astro
---
import Header from '../components/Header.astro';
const name = "Astro";
---

<Header />
<main>
  <h1>你好，{name}。</h1>
  <p>欢迎学习组件语法。</p>
</main>
```

两段的分工决定了写法：

| 部分 | 在哪执行 | 能做什么 |
|---|---|---|
| 脚本段（`---` 内） | 服务端，构建时或请求时 | `import`、读文件、查数据库、调用接口、定义变量 |
| 模板 | 编译成 HTML 字符串 | 输出 HTML、执行 `{}` 表达式、引用脚本段里的变量 |

关键点：两段都在服务端执行，模板里的表达式不会变成浏览器里的 JS。构建完成后，`{name}` 的位置已经是字符串 `Astro`，不是等待赋值的占位符。

这带来一个常见误解。下面这样写，`count` 不会在浏览器里自增：

```astro
---
let count = 0;
---

<p>{count}</p>
<button>加一</button>
```

页面每次刷新都是 0。要在浏览器里改状态，得用 `<script>` 或者客户端框架组件，见 2.8 节。

## 2.2 脚本段

脚本段顶部可以放 import、接口定义、变量、顶层 `await`。

```astro
---
import products from '../data/products.json';

const response = await fetch('https://api.example.com/users');
const users = await response.json();

const isLoggedIn = true;
const today = new Date().toLocaleDateString('zh-CN');
---

{isLoggedIn ? <p>今天是 {today}</p> : <a href="/login">登录</a>}

<ul>
  {users.map((user) => <li>{user.name}</li>)}
</ul>
```

在 `static` 输出下，这段代码在构建时执行一次。接口在构建时不可用，页面就构建失败。需要每次请求都取数据，得改成按需渲染，见第 8 章。

不能做的事：碰浏览器 API。脚本段没有 `document` 和 `window`，写了会直接报错：

```
ReferenceError: document is not defined
    at src/pages/index.astro:5:1
```

同样的错在 SSR 请求时也会出现。判断方法很简单：这段代码需要用户点击、滚动、读取本地存储才能运行吗？需要就放到 `<script>` 里。

## 2.3 模板表达式

`{}` 里写 JavaScript 表达式，可以是变量、运算、三元、调用、`map`。

```astro
---
const name = "Astro";
const price = 99;
const items = ["苹果", "香蕉", "橙子"];
const isVisible = true;
---

<p>框架名称：{name}</p>
<p>含税价格：¥{price * 1.13}</p>

{isVisible && <div>这段会渲染</div>}
{isVisible ? <p>可见</p> : <p>隐藏</p>}

<ul>
  {items.map((item) => <li>{item}</li>)}
</ul>
```

几个边界：

- 只能放表达式，不能放语句。`{ if (x) {} }` 不合法，要在脚本段里算好再输出。
- `{}` 的值是 `null`、`undefined`、`false` 时不渲染内容，不报错。
- 列表不需要 React 的 `key`。写了 `key={item}` 会作为普通属性出现在 HTML 里，没有任何作用。

注释有两种，行为不同：

```astro
<!-- 这种注释会输出到 HTML -->
{/* 这种注释是 JSX 语法，编译后被删掉 */}
```

暴露在 HTML 注释里的内容会被人看到，调试信息、内网地址不要写在这类注释里。

## 2.4 Props

父组件通过属性传值，子组件用 `Astro.props` 接收。

```astro
---
// Greeting.astro
export interface Props {
  name: string;
  greeting?: string;
  age?: number;
}

const { name, greeting = "你好", age } = Astro.props;
---

<div class="greeting">
  <p>{greeting}，{name}。</p>
  {age && <p>年龄：{age} 岁</p>}
</div>
```

```astro
---
import Greeting from '../components/Greeting.astro';
---

<Greeting name="小明" greeting="早上好" age={25} />
<Greeting name="小红" />
```

导出 `Props` 接口后，编辑器会检查传入值。类型不匹配时 `astro check` 报错：

```
Argument of type 'string' is not assignable to parameter of type 'number'.
```

Props 的另一条边界和序列化有关。`<Greeting>` 是 Astro 组件，传函数没问题。如果 `Greeting` 换成客户端组件 `<ReactCounter client:load fn={...} />`，函数过不了序列化，浏览器里拿到的是 `undefined`。给客户端组件传的 props 必须是 JSON 能表示的值：字符串、数字、布尔、数组、普通对象、`null`。

## 2.5 插槽

插槽把父组件的 HTML 注入子组件。

```astro
---
// Card.astro
---

<div class="card">
  <slot />
</div>
```

```astro
---
import Card from '../components/Card.astro';
---

<Card>
  <h2>卡片标题</h2>
  <p>卡片内容。</p>
</Card>
```

具名插槽用 `slot` 属性对号入座：

```astro
---
// Layout.astro
---

<div class="layout">
  <header>
    <slot name="header" />
  </header>
  <main>
    <slot />
  </main>
  <footer>
    <slot name="footer">默认页脚</slot>
  </footer>
</div>
```

```astro
<Layout>
  <h1 slot="header">网站标题</h1>
  <p>正文进入默认插槽。</p>
  <div slot="footer">© 2026 My Site</div>
</Layout>
```

`<slot>` 里的内容是有默认值时的后备内容，父组件不传就用它。注意具名插槽不会落进默认插槽，把 `slot="header"` 拼错成 `slot="Header"` 时，这段内容会直接消失，页面不报错。排查时先看 HTML 里有没有这段内容。

## 2.6 组件嵌套

组件可以任意嵌套，组件之间的数据传递只有两条路：Props 向下，插槽注入 HTML。

```astro
---
import Header from '../components/Header.astro';
import Card from '../components/Card.astro';
import Button from '../components/Button.astro';
---

<Header />
<main>
  <Card title="卡片">
    <Button>了解更多</Button>
  </Card>
</main>
```

目录按职责分就行，`components/` 下的文件不会自动变成路由。只有 `src/pages/` 下的文件才是页面。

## 2.7 条件与列表

条件用短路或三元：

```astro
---
const user = null;
const role = 'admin';
---

{user && <UserProfile user={user} />}
{role === 'admin' ? <AdminPanel /> : <UserPanel />}
```

多个分支在脚本段里算好再输出，比在模板里嵌套三元好读：

```astro
---
const status = 'loading';

let content;
if (status === 'loading') {
  content = <Loading />;
} else if (status === 'error') {
  content = <Error message="加载失败" />;
} else {
  content = <DataView />;
}
---

{content}
```

列表用 `map`。需要包裹多个元素时用 `<>...</>`，Astro 内置 `Fragment`，不需要装包：

```astro
---
const terms = [
  { term: "SSR", definition: "服务端渲染" },
  { term: "MPA", definition: "多页应用" },
];
---

<dl>
  {terms.map((item) => (
    <>
      <dt>{item.term}</dt>
      <dd>{item.definition}</dd>
    </>
  ))}
</dl>
```

## 2.8 script 与客户端 JavaScript

模板里的 `<script>` 是唯一能在浏览器执行代码的地方。

```astro
<script>
  const button = document.querySelector('#my-button');
  button?.addEventListener('click', () => {
    console.log('按钮被点击了');
  });
</script>
```

默认的 `<script>` 会被 Vite 处理：打包、压缩、转成 ESM，放在构建产物里，按模块加载（等同于 `defer`）。同一次构建里，内容完全相同的多个 `<script>` 只会打包一份。

`is:inline` 关掉这套处理：

| 写法 | 处理方式 | 什么时候用 |
|---|---|---|
| `<script>` | 打包、压缩、ESM、去重 | 默认，业务代码 |
| `<script is:inline>` | 原样输出，不打包不去重 | 需要 `var`、需要调用外部全局、代码必须出现在原位置 |
| `<script hoist>` | 提到 `<head>` 并去重 | 需要在 DOM 解析前执行 |
| `<script src="...">` | 引用外部文件 | 第三方脚本 |

代价要说清：`is:inline` 的脚本不会被 TypeScript 检查和压缩，也不会去重。同一个组件在页面里用 5 次，`is:inline` 脚本就输出 5 份。引第三方脚本时必须加 `is:inline`，否则 Astro 会尝试解析这个路径并在构建时报错：

```
Failed to resolve import "/scripts/analytics.js" from "src/pages/index.astro".
```

另外，`<script>` 里的代码是独立模块，拿不到脚本段里的变量：

```astro
---
const userId = "u_123";
---

<script>
  // ReferenceError: userId is not defined
  console.log(userId);
</script>
```

需要把服务端数据交给浏览器，用 `data-` 属性或 `define:vars`：

```astro
<script define:vars={{ userId }}>
  console.log(userId);
</script>
```

`define:vars` 的实现是把变量序列化后拼进内联脚本，等价于 `is:inline`，所以它同样不打包、不去重，只适合少量配置值。

## 2.9 动态组件与标签

标签名可以是变量：

```astro
---
const Element = 'h2';
---

<Element>动态标签内容</Element>
```

也可以在脚本段里选组件：

```astro
---
import PostLayout from '../layouts/PostLayout.astro';
import PageLayout from '../layouts/PageLayout.astro';

const layouts = { post: PostLayout, page: PageLayout };
const type = 'post';
const Layout = layouts[type];
---

<Layout>
  <p>内容</p>
</Layout>
```

`Layout` 是 `undefined` 时 Astro 直接报 `TypeError: Layout is not a function`。外部输入决定组件类型时，先校验再取值。

## 2.10 全局对象 Astro

脚本段可以访问 `Astro` 对象。

| 属性 | 说明 | 可用场景 |
|---|---|---|
| `Astro.props` | 组件收到的属性 | 所有组件 |
| `Astro.params` | 动态路由参数 | 页面 |
| `Astro.url` | 当前 URL | 所有组件 |
| `Astro.request` | 原始请求 | 按需渲染 |
| `Astro.cookies` | Cookie 读写 | 按需渲染 |
| `Astro.locals` | 中间件写入的数据 | 有中间件时 |
| `Astro.session` | 会话，需配置驱动 | 按需渲染 |
| `Astro.redirect(path)` | 返回重定向响应 | 页面 |
| `Astro.site` | 配置里的 `site` | 所有组件 |
| `Astro.generator` | 生成器标识 | 所有组件 |

```astro
---
const { id } = Astro.params;
const url = new URL(Astro.request.url);
const q = url.searchParams.get('q');

if (!isLoggedIn) {
  return Astro.redirect('/login');
}
---
```

在 `static` 输出下访问 `Astro.request`，拿到的是构建时的占位请求，`url` 是页面自身路径。用它判断登录态永远不会成立，这类逻辑必须放到按需渲染的页面或中间件里。

## 2.11 本章小结

- 组件分脚本段与模板，两段都在服务端执行，模板表达式不会变成客户端代码。
- 模板表达式只能放表达式，列表不需要 `key`。
- Props 用 `Props` 接口约束；传给客户端组件的值必须可序列化。
- 具名插槽拼错时不报错，内容会消失。
- `<script>` 默认打包去重，`is:inline` 原样输出，`define:vars` 用于传少量服务端数据。
- `Astro.request` 只在按需渲染时有真实请求。

下一章讲路由：文件如何映射到 URL，动态路由怎么取参数，以及静态与按需渲染下 `getStaticPaths` 的差别。
