## 第八章：服务端渲染与中间件

### 8.1 按需渲染（SSR）概述

Astro 默认在构建时生成静态 HTML。启用 SSR 后，页面在每次请求时由服务器动态生成。

**三种输出模式**：

| 模式 | `output` | 说明 |
|---|---|---|
| 静态（默认） | `'static'` | 构建时生成所有页面 |
| 服务端渲染 | `'server'` | 每次请求时渲染 |
| 混合模式 | `'hybrid'` | 默认静态，可指定页面按需渲染 |

### 8.2 配置 SSR 适配器

```bash
# 安装适配器（根据部署平台选择）
npx astro add netlify    # Netlify
npx astro add cloudflare # Cloudflare Pages
npx astro add vercel     # Vercel
npx astro add node       # Node.js 自托管
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
});
```

### 8.3 单页面 SSR

保持全局 `static` 模式，仅特定页面按需渲染：

```astro
---
// 标记此页面为按需渲染
export const prerender = false;

const data = await fetch('https://api.example.com/posts')
  .then(r => r.json());
---

<ul>
  {data.map(item => <li>{item.title}</li>)}
</ul>
```

### 8.4 使用 Astro.request

SSR 模式下可访问完整的请求对象：

```astro
---
export const prerender = false;

// 获取请求信息
const url = new URL(Astro.request.url);
const searchQuery = url.searchParams.get('q');
const pathname = url.pathname;

// 获取 Cookie
const theme = Astro.cookies.get('theme');
const preferredLang = Astro.cookies.get('lang')?.value;

// 获取请求头
const userAgent = Astro.request.headers.get('user-agent');
const referer = Astro.request.headers.get('referer');

// 服务端重定向
if (!Astro.cookies.has('auth-token')) {
  return Astro.redirect('/login');
}

// 获取中间件传递的数据
const { user } = Astro.locals;
---

<h1>搜索: {searchQuery}</h1>
<p>Hello, {user?.name || '访客'}!</p>
```

### 8.5 API 端点

`src/pages/api/` 目录下创建 REST API 端点：

```ts
// src/pages/api/posts.json.ts
export const prerender = false;

export async function GET({ request }) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || '1';

  const posts = await fetch(`https://api.example.com/posts?page=${page}`)
    .then(r => r.json());

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }) {
  const body = await request.json();

  // 保存数据...
  return new Response(JSON.stringify({ success: true, id: '123' }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### 8.6 Actions（表单处理）

Astro v6 的 Actions 提供类型安全的表单处理：

```ts
// src/actions/index.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';

export const server = {
  subscribe: defineAction({
    input: z.object({
      email: z.string().email('请输入有效邮箱'),
      name: z.string().min(2),
    }),
    handler: async ({ email, name }) => {
      // 保存到数据库
      await db.insert(Subscriber).values({ email, name });
      return { success: true };
    },
  }),

  search: defineAction({
    input: z.object({
      query: z.string().min(1),
      limit: z.number().optional().default(10),
    }),
    handler: async ({ query, limit }) => {
      const results = await searchAPI(query, limit);
      return { results };
    },
  }),
};
```

```astro
---
import { actions } from 'astro:actions';
---

<!-- 零 JS 表单提交 -->
<form method="POST" action={actions.subscribe}>
  <input type="text" name="name" placeholder="你的名字" required />
  <input type="email" name="email" placeholder="邮箱地址" required />
  <button type="submit">订阅</button>
</form>
```

### 8.7 中间件

中间件在请求到达页面之前执行，用于认证、日志、国际化等：

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. 记录请求日志
  console.log(`[${new Date().toISOString()}] ${context.request.method} ${context.url.pathname}`);

  // 2. 认证检查
  if (context.url.pathname.startsWith('/admin')) {
    const token = context.cookies.get('auth-token');
    if (!token) {
      return context.redirect('/login');
    }
    context.locals.user = await validateToken(token.value);
  }

  // 3. 国际化语言检测
  const acceptLang = context.request.headers.get('accept-language');
  context.locals.lang = acceptLang?.includes('zh') ? 'zh' : 'en';

  return next();
});
```

#### 路由级中间件

```ts
// 仅匹配特定路径的中间件
export const adminGuard = defineMiddleware(
  async (context, next) => {
    if (!context.locals.user?.isAdmin) {
      return new Response('Forbidden', { status: 403 });
    }
    return next();
  },
  { match: '/admin/**' }
);
```

### 8.8 服务器群岛

服务器群岛是静态 HTML 与动态内容的结合——页面主体静态生成，动态部分异步注入：

```astro
---
// src/pages/product/[id].astro
---

<Layout>
  <!-- 静态内容：产品名称和描述 -->
  <h1>{product.name}</h1>
  <p>{product.description}</p>

  <!-- 服务器群岛：实时库存和价格 -->
  <LiveStock productId={id} server:defer />
  <DynamicPrice productId={id} server:defer />
</Layout>
```

```astro
---
// src/components/LiveStock.astro
const { productId } = Astro.props;
const stock = await getStockStatus(productId);
---

<span class="stock">
  {stock > 0 ? `有货 (${stock}件)` : '暂时缺货'}
</span>
```

### 8.9 Sessions 会话管理

```js
// astro.config.mjs
export default defineConfig({
  output: 'server',
  session: {
    driver: 'cookie',
    cookie: {
      name: 'session',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    },
  },
});
```

```astro
---
// 设置会话
Astro.session.set('cart', { items: [], total: 0 });
Astro.session.set('lastVisit', new Date().toISOString());

// 读取会话
const cart = Astro.session.get('cart');
const lastVisit = Astro.session.get('lastVisit');
---
```

### 本章小结

- SSR 通过适配器与 Cloudflare/Netlify/Vercel/Node.js 集成
- 混合模式允许同一项目中有静态页面和动态页面
- Actions 提供类型安全的表单后端处理
- 中间件是认证、日志、i18n 的统一入口
- 服务器群岛将静态页面与动态组件完美结合
- Sessions 内建支持 Cookie、File、Redis 等驱动

下一章学习视图过渡动画与数据获取。