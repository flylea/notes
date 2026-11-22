# 第 8 章 按需渲染与服务端能力

## 8.1 静态与按需渲染

Astro 默认在构建时把每个页面渲染成 HTML，部署产物是纯静态文件。需要按请求生成页面时，装一个适配器，再在页面上声明。

两种模式：

| 模式 | 配置 | 页面行为 |
|---|---|---|
| 静态（默认） | `output: 'static'` | 全部构建时生成，可逐页改成按需 |
| 服务端 | `output: 'server'` | 默认全部按需，可逐页改成静态 |

v4 还有 `output: 'hybrid'`，v5 已移除。`output` 现在只有 `'static'` 和 `'server'` 两个值，写 `'hybrid'` 会在启动时配置校验失败。

按需渲染不是"更强"，它有明确的代价：

- 每次请求都要跑一遍服务端代码，CPU 和延迟都上去了。
- 需要部署到能跑 Node、Serverless 或边缘函数的环境，不能扔到纯静态托管。
- 缓存要自己设计，静态页面天然可以上 CDN。
- 本地 `astro dev` 和 `astro preview` 行为不一致的地方变多，`preview` 要用适配器的方式跑。

反过来，只要页面内容依赖登录态、实时数据、请求参数，静态渲染就做不了。判断标准是：**同一 URL 对所有用户是否永远返回相同内容**。是，静态；否，按需。

## 8.2 安装适配器

```bash
npx astro add netlify     # Netlify
npx astro add vercel      # Vercel
npx astro add cloudflare  # Cloudflare Workers
npx astro add node        # 自托管 Node.js
```

命令会装包、改 `astro.config.mjs`、按需创建入口文件。手动配置形如：

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
});
```

配了 `output: 'server'` 却没有适配器，启动就报错：

```
NoAdapterInstalled: Cannot use server-rendered pages without an adapter. Please install and configure the appropriate server adapter for your final deployment.
```

服务器群岛也有对应的报错 `NoAdapterInstalledServerIslands`，原因相同。

适配器还决定了运行时能力。Cloudflare Workers 没有 Node 的 `fs` 和原生二进制，Sharp 用不了，图片服务要换成 passthrough（见第 6 章）；Node 适配器可以用 `fs` 和长连接。写代码之前先确认目标运行时有什么。

## 8.3 逐页控制

静态站点里给个别页面开按需渲染，装好适配器后在页面顶部声明：

```astro
---
// src/pages/dashboard.astro
export const prerender = false;

const user = await getUser(Astro.cookies.get('session')?.value);
---
```

其余页面不受影响，仍然是构建时生成的静态页。这是最常见的用法：营销页静态、后台页面按需。

反向操作也支持。`output: 'server'` 的项目里，把内容页改成静态：

```astro
---
// src/pages/about.astro
export const prerender = true;
---
```

两个限制：

- `prerender` 必须是字面量 `false`，不能是变量或表达式。构建时要在不执行页面代码的情况下判断这页是不是静态的。
- 静态页面不能用 `getStaticPaths()` 之外的路由生成方式。按需页面里写 `getStaticPaths()` 没有意义，它只在构建时执行。

`astro build` 结束时会打印哪些路由是静态预渲染的，`astro dev` 里也会用图标标出来。部署前扫一眼，能发现"忘了加 `prerender = false`"的页面。

## 8.4 请求对象

按需页面才能拿到真实请求：

```astro
---
// src/pages/search.astro
export const prerender = false;

const url = new URL(Astro.request.url);
const query = url.searchParams.get('q') ?? '';
const pathname = url.pathname;

const theme = Astro.cookies.get('theme')?.value ?? 'light';
const token = Astro.cookies.get('token');

const userAgent = Astro.request.headers.get('user-agent') ?? '';
const referer = Astro.request.headers.get('referer');

if (!token) {
  return Astro.redirect('/login');
}

const { user } = Astro.locals;
---

<h1>搜索：{query}</h1>
<p>当前路径：{pathname}</p>
<p>你好，{user?.name ?? '访客'}</p>
```

几个容易混的点：

- `Astro.request.url` 是完整 URL 字符串，取值前要 `new URL()`。
- `Astro.url` 是已经解析好的 `URL` 对象，`Astro.url.pathname` 直接可用，日常更常用。
- `Astro.cookies.get()` 返回带 `value` 的对象，也可能返回 `undefined`，直接取 `.value` 会崩。
- `Astro.redirect()` 必须 `return`，光调用不返回，页面会继续渲染。
- `Astro.request.headers.get()` 的键不区分大小写，值是字符串或 `null`。

静态页面在构建时没有真实请求，`Astro.request` 拿到的是构建期的占位请求，`Astro.cookies` 也不能用。想在页面里读 cookie，先确认它是按需渲染的。

## 8.5 API 端点

`src/pages/api/` 下的 `.ts` 文件导出 HTTP 方法名，每个方法返回 `Response`：

```ts
// src/pages/api/posts.ts
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  const page = Number(url.searchParams.get('page') ?? '1');
  if (Number.isNaN(page) || page < 1) {
    return new Response(JSON.stringify({ error: 'page 参数不合法' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(`https://api.example.com/posts?page=${page}`);
  if (!res.ok) {
    return new Response(JSON.stringify({ error: '上游服务不可用' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(await res.text(), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  if (!body.title) {
    return new Response(JSON.stringify({ error: 'title 必填' }), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ id: '123' }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
```

几点约定：

- 文件路径就是路由，`api/posts.ts` 对应 `/api/posts`。
- 只导出 `GET` 就只接受 `GET`，其他方法返回 405。
- `request.json()` 对空 body 会抛错，读之前判断 `content-length` 或 `try/catch`。
- 静态模式下 API 端点也会被预渲染成静态文件，`GET` 能跑，`POST` 无效。要真正的接口必须按需渲染。
- 写操作有默认的 CSRF 防护：`security.checkOrigin` 默认为 `true`，按需渲染页面上的 `POST`、`PUT`、`PATCH`、`DELETE` 请求会校验 `Sec-Fetch-Site`（没有则退回 `Origin`），跨站来源返回 403。判断依据是浏览器发来的头，所以 `curl`、服务端到服务端以及 `application/json` 请求不受这层保护，需要鉴权的接口仍要自己验证 token。

## 8.6 Actions

Actions 是把"表单提交"和"客户端调用的服务端函数"统一成一套带类型的东西，配置在 `src/actions/index.ts`：

```ts
// src/actions/index.ts
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro/zod';

export const server = {
  subscribe: defineAction({
    accept: 'form',
    input: z.object({
      email: z.string().email(),
      name: z.string().min(2),
    }),
    handler: async ({ email, name }) => {
      await db.insert(subscribers).values({ email, name });
      return { ok: true };
    },
  }),

  search: defineAction({
    input: z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(10),
    }),
    handler: async ({ query, limit }) => {
      if (query === 'blocked') {
        throw new ActionError({ code: 'BAD_REQUEST', message: '关键词被拒绝' });
      }
      const results = await searchAPI(query, limit);
      return { results };
    },
  }),
};
```

`input` 是 Zod schema，服务端会自动校验，校验失败不会进 `handler`。`accept` 默认是 `'json'`，要从 HTML 表单直接提交必须写 `accept: 'form'`。

表单直接提交，不需要写一行客户端 JS：

```astro
---
import { actions } from 'astro:actions';
---

<form method="POST" action={actions.subscribe}>
  <input type="text" name="name" placeholder="你的名字" required />
  <input type="email" name="email" placeholder="邮箱地址" required />
  <button type="submit">订阅</button>
</form>
```

这个表单要求页面按需渲染，纯静态页上提交会报：

```
ActionsWithoutServerOutputError: A server is required to create callable backend functions. To deploy routes to a server, add an adapter to your Astro config and configure your route for on-demand rendering.
```

客户端调用用同一个 `actions` 对象：

```tsx
// src/components/Search.tsx
import { actions, isInputError } from 'astro:actions';
import { useState } from 'react';

export default function Search() {
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await actions.search({ query: 'astro', limit: 5 });

    if (error) {
      setMessage(isInputError(error) ? '参数不合法' : error.message);
      return;
    }
    setResults(data.results);
  }

  return (
    <form onSubmit={onSubmit}>
      <button type="submit">搜索</button>
      {message && <p>{message}</p>}
    </form>
  );
}
```

结果是 `{ data, error }` 而不是抛异常，因为输入校验失败属于正常分支。不想每次都判断就 `await actions.search.orThrow(...)`，失败时抛错，交给上层 `try/catch`。

服端页面里要调另一个 action，必须用 `Astro.callAction()`，直接 `actions.xxx()` 会报：

```
ActionCalledFromServerError: Action called from a server-rendered page or endpoint without using `Astro.callAction()`.
```

Actions 会暴露成 `/_actions/<name>` 的公开端点，凡是能写在 action 里的敏感操作，权限判断必须写在 `handler` 内，不能只靠页面上的 UI 隐藏。

## 8.7 中间件

`src/middleware.ts` 导出一个 `onRequest`：

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const started = Date.now();

  if (context.url.pathname.startsWith('/admin')) {
    const token = context.cookies.get('auth-token');
    if (!token) {
      return context.redirect('/login');
    }

    const user = await validateToken(token.value);
    if (!user) {
      return context.redirect('/login');
    }
    context.locals.user = user;
  }

  const response = await next();
  response.headers.set('X-Response-Time', `${Date.now() - started}ms`);
  return response;
});
```

中间件在页面渲染之前执行，能做的事：

- 改 `locals`，把认证结果传给页面。
- 统一重定向，比如未登录跳登录页。
- 拦请求，直接返回 401、403。
- 改响应头，加缓存策略、安全头、耗时统计。
- 用 `context.rewrite()` 在不改 URL 的前提下换一个页面渲染。

`locals` 的类型在 `src/env.d.ts` 里声明：

```ts
// src/env.d.ts
declare namespace App {
  interface Locals {
    user?: { id: string; name: string; isAdmin: boolean };
  }
}
```

不声明也能跑，但 `context.locals.user` 会报类型错误。

多个中间件用 `sequence()` 组合，按顺序执行：

```ts
// src/middleware.ts
import { sequence } from 'astro:middleware';
import { auth } from './middleware/auth';
import { logging } from './middleware/logging';

export const onRequest = sequence(auth, logging);
```

`defineMiddleware` 只接受一个参数，就是 `onRequest` 函数。网上有 `defineMiddleware(fn, { match: '/admin/**' })` 这种写法，这个 API 不存在，跑了会忽略第二个参数，等于全站生效，容易出事。要按路径区分，在函数里判断 `context.url.pathname`。

两个边界：

- 中间件跑在**构建期**也会执行一次，预渲染页面在构建时就要经过它。所以中间件里不能假设有真实 cookie、真实 IP，构建时这些是空的。
- 中间件里抛错会让整个请求 500，认证失败应该 `return context.redirect()` 或返回 `Response`，不要 `throw`。

## 8.8 服务器群岛

页面主体静态、局部按需，用 `server:defer`：

```astro
---
// src/pages/product/[id].astro
import LiveStock from '../../components/LiveStock.astro';
import DynamicPrice from '../../components/DynamicPrice.astro';

const { id } = Astro.params;
---

<Layout>
  <h1>商品详情</h1>
  <p>静态描述，构建时就生成好了。</p>

  <LiveStock productId={id} server:defer>
    <span slot="fallback">加载库存中…</span>
  </LiveStock>

  <DynamicPrice productId={id} server:defer>
    <span slot="fallback">加载价格中…</span>
  </DynamicPrice>
</Layout>
```

```astro
---
// src/components/LiveStock.astro
const { productId } = Astro.props;
const stock = await getStock(productId);
---

<span>{stock > 0 ? `有货（${stock} 件）` : '暂时缺货'}</span>
```

构建产物里，被标记的组件被换成一段脚本和 `slot="fallback"` 的内容，浏览器加载后发请求取回真实 HTML 再替换。页面主体仍可上 CDN 缓存。

使用限制：

- 要装适配器，否则报 `NoAdapterInstalledServerIslands`。
- 传给 `server:defer` 组件的 props 必须能序列化。函数不行，循环引用对象不行。
- props 会加密后放进 GET 请求的查询串，传一整个对象或数组会让 URL 很长，尽量只传 id 这类必要字段。
- 数据通过 GET 拿，可以用 `Cache-Control` 控制缓存。这是服务器群岛最大的好处：静态主体 + 可缓存的动态片段。
- 每个 `server:defer` 是一个独立请求。一页放十个，浏览器就发十个请求，首屏加载的并发压力要算。

服务器群岛适合"价格、库存、推荐位、登录后头像"这类小块。整页都动态的，直接按需渲染，不要拆成十几个岛。

## 8.9 Sessions

Cookie 只能存几 KB，且明文可被用户看到。会话数据存在服务端，客户端只留一个会话 ID：

```js
// astro.config.mjs
import { defineConfig, sessionDrivers } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  adapter: vercel(),
  output: 'server',
  session: {
    driver: sessionDrivers.redis({
      url: process.env.REDIS_URL,
    }),
  },
});
```

驱动用 `sessionDrivers` 选，可用的有 `redis`、`fs`、`lruCache` 等，本质是 Unstorage 的驱动，有些需要额外装包和凭据。Node、Cloudflare、Netlify 三个适配器会自动配一个默认驱动，用其他适配器时要手动指定。

不需要会话时可以关掉，减小 SSR 包体积：

```js
export default defineConfig({
  session: false,
});
```

读写都是异步的：

```astro
---
// src/pages/cart.astro
export const prerender = false;

const cart = (await Astro.session?.get('cart')) ?? { items: [], total: 0 };

if (Astro.request.method === 'POST') {
  cart.items.push({ id: 'shirt-001', price: 299 });
  cart.total += 299;
  await Astro.session?.set('cart', cart);
  return Astro.redirect('/cart');
}

const lastVisit = await Astro.session?.get('lastVisit');
await Astro.session?.set('lastVisit', new Date().toISOString());
---

<p>购物车共 {cart.items.length} 件，合计 ¥{cart.total}</p>
<p>上次访问：{lastVisit ?? '首次'}</p>
```

`Astro.session` 在没配会话时是 `undefined`，所以要写 `?.`。`Astro.session?.get()` 返回 Promise，漏了 `await` 会得到 `[object Promise]`，这个错误很隐蔽。

其他操作：

```ts
Astro.session?.destroy();        // 删除会话数据
const id = Astro.session?.id;    // 会话 ID
```

`destroy()` 会清掉服务端数据，但会话 cookie 还在，下次访问会创建新会话。要彻底退出，还得清掉自己存的登录态。

三个代价：

- 每个请求都要访问一次存储（Redis、文件、内存）。会话数据多了，这会变成延迟的主要来源。
- 驱动配置在构建期内联环境变量，运行时改不了。要动态配置得写自定义驱动入口文件。
- `lruCache` 驱动只在单进程内有效，多实例部署时会话会丢，仅限本地开发或单实例服务。

## 8.10 本章小结

- 默认静态；装适配器后可在页面上 `export const prerender = false` 开按需渲染。
- `output` 只有 `'static'` 和 `'server'`，`'hybrid'` 已移除。
- 会读 cookie、请求头、实时数据的页面必须按需渲染。
- API 端点导出 `GET`、`POST` 等函数，返回 `Response`；静态模式下 `POST` 无效。
- Actions 用 Zod 校验输入，表单可以零 JS 提交，结果是 `{ data, error }`。
- 中间件在构建期对预渲染页面也会执行，不能假设有真实请求。
- 服务器群岛让静态页里嵌可缓存的动态片段，props 必须可序列化。
- 会话要配驱动，读写是异步的，单进程驱动不能用于多实例。

下一章讲数据获取与环境变量：构建期和请求期的取数差异，以及密钥怎么管。
