## 第二章：Astro 组件详解

### 2.1 组件结构

Astro 组件（`.astro` 文件）由两部分组成，用 `---` 代码围栏分隔：

```astro
---
// 第一部分：组件脚本（Component Script）
// 在服务端执行，永远不会发送到浏览器
import Header from '../components/Header.astro';
const name = "Astro";
---

<!-- 第二部分：组件模板（Component Template） -->
<!-- 纯 HTML + JSX 风格表达式 -->
<Header />
<main>
  <h1>你好，{name}！</h1>
  <p>欢迎学习组件语法。</p>
</main>
```

**两部分的关键区别**：

| 部分 | 执行位置 | 能做什么 |
|---|---|---|
| **组件脚本** (`---`) | 服务端（构建时或请求时） | 导入模块、获取数据、定义变量、访问 `Astro.props` |
| **组件模板** | 编译为 HTML | 渲染 HTML、使用表达式、展示数据 |

### 2.2 组件脚本（Component Script）

位于 `---` 围栏之间的 TypeScript/JavaScript 代码永远不会到达浏览器，你可以安全地执行敏感操作。

#### 可以做的事

```astro
---
// 1. 导入 Astro 组件
import SomeComponent from '../components/SomeComponent.astro';

// 2. 导入 UI 框架组件
import Counter from '../components/Counter.tsx';
import HelloWorld from '../components/HelloWorld.vue';

// 3. 导入数据文件
import products from '../data/products.json';

// 4. 从 API 或数据库获取内容
const response = await fetch('https://api.example.com/users');
const users = await response.json();

// 5. 定义模板中使用的变量
const isLoggedIn = true;
const pageName = "首页";
const today = new Date().toLocaleDateString('zh-CN');
---

<h1>{pageName}</h1>
<p>今天是 {today}</p>

{isLoggedIn ? <UserGreeting /> : <LoginButton />}

<ul>
  {users.map(user => <li>{user.name}</li>)}
</ul>
```

#### 注意事项

- 组件脚本中不能使用浏览器 API（`document`、`window`、`localStorage` 等）
- 需要浏览器环境的功能请放在 `<script>` 标签中（见 2.8 节）

### 2.3 组件模板语法

模版中的 JavaScript 表达式用 `{ }` 包裹。

#### 基本表达式

```astro
---
const name = "Astro";
const price = 99;
const items = ["苹果", "香蕉", "橙子"];
const isVisible = true;
---

<!-- 文本插值 -->
<p>框架名称：{name}</p>

<!-- 属性表达式 -->
<a href={`/product/${id}`}>查看详情</a>

<!-- 条件渲染 -->
{isVisible && <div>这个元素会显示</div>}

<!-- 三元表达式 -->
{isVisible ? <p>可见</p> : <p>隐藏</p>}

<!-- 列表渲染 -->
<ul>
  {items.map(item => (
    <li key={item}>{item}</li>
  ))}
</ul>

<!-- 数字计算 -->
<p>含税价格：¥{price * 1.13}</p>

<!-- 方法调用 -->
<p>{name.toUpperCase()}</p>
```

#### 模板中的注释

```astro
<!-- HTML 注释：会出现在构建产物中 -->

{/* JSX 风格注释：不会出现在构建产物中 */}
```

#### HTML 属性

```astro
---
const id = "main-content";
const isActive = true;
---

<!-- 静态属性 -->
<div class="container"></div>

<!-- 动态属性 -->
<div id={id}></div>

<!-- 布尔属性 -->
<button disabled={isActive}>按钮</button>

<!-- 展开属性（多个属性一次性传递）-->
<input {...attrs} />

<!-- HTML 直出（仅信任源使用！） -->
<article set:html={trustedHtmlContent} />
```

### 2.4 Props（组件属性）

Props 是父组件向子组件传递数据的方式。

#### 定义和接收 Props

```astro
---
// Greeting.astro — 子组件
export interface Props {
  name: string;
  greeting?: string;       // 可选属性
  age?: number;
  children?: any;          // 接收插槽内容
}

const { name, greeting = "你好", age } = Astro.props;
---

<div class="greeting">
  <p>{greeting}，{name}！</p>
  {age && <p>年龄：{age} 岁</p>}
</div>
```

```astro
---
// 父组件中使用
import Greeting from '../components/Greeting.astro';
---

<Greeting name="小明" greeting="早上好" age={25} />
<Greeting name="小红" />  <!-- 使用默认 greeting -->
```

#### Props 类型定义方式

```astro
---
// 方式一：interface
export interface Props {
  title: string;
  count: number;
}

// 方式二：type（推荐用于复杂类型）
export type Props = {
  variant: 'primary' | 'secondary';
  onClick?: () => void;
  items: { id: string; name: string }[];
};

const props = Astro.props;
```

### 2.5 插槽（Slots）

插槽允许父组件向子组件注入 HTML 内容。类似 React 的 `children` 但更强大。

#### 默认插槽

```astro
---
// Card.astro
---

<div class="card">
  <slot />  <!-- 默认插槽，父组件的内容注入此处 -->
</div>
```

```astro
<Card>
  <h2>卡片标题</h2>
  <p>卡片内容可以包含任意 HTML。</p>
</Card>
```

#### 具名插槽

```astro
---
// Layout.astro
---

<div class="layout">
  <header>
    <slot name="header" />
  </header>
  <main>
    <slot />     <!-- 默认插槽 -->
  </main>
  <footer>
    <slot name="footer">默认页脚文字</slot>  <!-- 具名插槽 + 后备内容 -->
  </footer>
</div>
```

```astro
<Layout>
  <h1 slot="header">网站标题</h1>
  <!-- 以下内容自动进入默认插槽 -->
  <p>正文内容...</p>
  <div slot="footer">© 2026 My Site</div>
</Layout>
```

#### 插槽中的回退内容

当父组件不提供对应插槽内容时，显示后备内容：

```astro
---
// Button.astro
---

<button>
  <slot>点击这里</slot>  <!-- 如果父组件没传内容，显示"点击这里" -->
</button>
```

### 2.6 组件嵌套与引用

#### 组件导入

```astro
---
// 支持多种导入方式
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { Card, Button } from '../components/ui/index.astro';
---

<Header />
<main>
  <Card title="卡片">
    <Button>了解更多</Button>
  </Card>
</main>
<Footer />
```

#### 组件目录索引文件

```
components/
├── index.astro    ← 统一导出
└── ui/
    ├── Card.astro
    ├── Button.astro
    └── Input.astro
```

### 2.7 条件渲染与列表渲染

#### 条件渲染

```astro
---
const user = null;
const role = 'admin';
const status = 'active';
---

<!-- 短路求值 -->
{user && <UserProfile user={user} />}

<!-- 三元表达式 -->
{role === 'admin' ? <AdminPanel /> : <UserPanel />}

<!-- if-else 逻辑（在脚本中提前计算） -->
---
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

#### 列表渲染

```astro
---
const posts = [
  { id: 1, title: '文章一', slug: 'post-1' },
  { id: 2, title: '文章二', slug: 'post-2' },
  { id: 3, title: '文章三', slug: 'post-3' },
];

// 筛选 + 排序
const published = posts.filter(p => p.id > 1);
---

<ul>
  {posts.map(post => (
    <li>
      <a href={`/blog/${post.slug}`}>{post.title}</a>
    </li>
  ))}
</ul>

<!-- 使用 Fragment 包裹多个元素 -->
{posts.map(post => (
  <>
    <h2>{post.title}</h2>
    <p>ID: {post.id}</p>
  </>
))}
```

#### 使用 Astro 内置 Fragment

```astro
---
import Fragment from 'astro-fragment';
---

{items.map(item => (
  <Fragment>
    <dt>{item.term}</dt>
    <dd>{item.definition}</dd>
  </Fragment>
))}
```

### 2.8 Script 与客户端 JavaScript

组件模板中的 `<script>` 标签用于客户端交互。

#### 基本脚本

```astro
<script>
  // 在浏览器中执行
  const button = document.querySelector('#my-button');
  button.addEventListener('click', () => {
    alert('按钮被点击了！');
  });
</script>
```

#### 脚本处理方式

| 属性 | 效果 |
|---|---|
| 默认（无属性） | 打包、处理、作用域隔离、使用 ESM |
| `is:inline` | 不打包、不处理、直接输出原文 |
| `hoist` | 提升到 `<head>` 中，去重 |
| `src` | 引用外部脚本文件 |

```astro
<!-- 打包处理的脚本（默认） -->
<script>
  console.log('这个脚本会被 Vite 打包处理');
</script>

<!-- 内联脚本（不处理） -->
<script is:inline>
  console.log('这个脚本保持原样');
</script>

<!-- 提升到 head 中 -->
<script hoist>
  // 该脚本去重后放入 <head>
</script>

<!-- 外部脚本 -->
<script src="/scripts/custom.js"></script>
```

#### TypeScript 客户端脚本

```astro
<script>
  // 需要设置 tsconfig 或使用 .ts 文件
  interface User {
    name: string;
    age: number;
  }

  const user: User = { name: 'Alice', age: 30 };
  console.log(user.name);
</script>
```

### 2.9 动态组件与标签

#### 动态标签名

```astro
---
const Element = 'h2';  // 变量作为标签名
---

<Element>动态标签内容</Element>
<!-- 等价于 <h2>动态标签内容</h2> -->
```

#### 动态组件

```astro
---
import PostLayout from '../layouts/PostLayout.astro';
import PageLayout from '../layouts/PageLayout.astro';

const layouts = {
  post: PostLayout,
  page: PageLayout,
} as const;

const type = 'post';
const Layout = layouts[type];
---

<Layout>
  <p>内容</p>
</Layout>
```

### 2.10 内置全局对象 `Astro`

`Astro` 是可以在任何 `.astro` 文件的组件脚本中使用的全局对象。

| 属性/方法 | 说明 | 可用场景 |
|---|---|---|
| `Astro.props` | 组件接收的属性 | 所有组件 |
| `Astro.params` | URL 路由参数 | 页面组件 |
| `Astro.request` | 请求对象 | SSR 页面 |
| `Astro.url` | 请求 URL | SSR 页面 |
| `Astro.cookies` | Cookie 对象 | SSR 页面 |
| `Astro.locals` | 中间件传递的数据 | 所有组件 |
| `Astro.redirect(path)` | 重定向 | 页面组件 |
| `Astro.site` | 配置中的 `site` 值 | 所有组件 |
| `Astro.generator` | Astro 版本标识 | 所有组件 |
| `Astro.session` | 会话对象 | SSR 页面 |

```astro
---
// 访问当前页面路由参数
const { slug } = Astro.params;

// 获取请求中的查询参数（SSR 模式）
const url = new URL(Astro.request.url);
const search = url.searchParams.get('q');

// 服务端重定向
if (!isLoggedIn) {
  return Astro.redirect('/login');
}
---
```

### 本章小结

- `.astro` 组件由**服务端脚本**（`---`）和**HTML 模板**两部分组成
- 模板用 `{ }` 支持 JavaScript 表达式，包括条件、循环、方法调用
- **Props** 支持 TypeScript 类型定义，让编辑器智能提示生效
- **插槽**分默认插槽和具名插槽，支持后备内容
- **客户端脚本**默认打包处理，可通过 `is:inline`、`hoist` 等属性控制
- **Astro 全局对象**提供了丰富的运行时 API

下一章我们学习路由与导航系统。