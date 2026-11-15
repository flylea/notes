# 第 38 章 Pages Router 对照

`pages/` 是 Next.js 的第一代路由方案。今天新开的项目不会用它，但你会从三个方向遇到它：接手的老代码、网上大量 2019 到 2022 年的教程、以及一个正在从 `pages` 迁到 `app` 的仓库。

本章讲两套路由的对应关系。内容包括文件怎么映射、数据获取函数换成什么、API Routes 怎么写、`_app` 和 `_document` 的职责去了哪里、ISR 的两种写法差在哪、`middleware.ts` 为什么改名 `proxy.ts`，最后给一份可以按顺序执行的迁移步骤。

范围先划清：本章只做对照，不在项目里新建第二套 `pages` 页面。teamstack 的所有页面都在 `src/app/` 下，示例中的 `src/pages/` 只用于说明旧写法，实际不会出现在仓库里。

两套路由可以共存，官方也支持同一项目里逐步迁移。代价是两套规则并行、两套构建产物、两套缓存语义。请求出错时，你首先要判断它落在哪套路由上。能一次迁完就别拖成两套。

## 38.1 两套路由的分工

`pages/` 下的每个文件导出一个 React 组件。文件路径就是 URL，`pages/about.tsx` 对应 `/about`。组件默认按客户端组件处理，构建时先预渲染出 HTML。页面需要数据时，在文件里额外导出 `getStaticProps` 或 `getServerSideProps`，框架在渲染前调用它们，把返回值作为 `pageProps` 传进组件。

`app/` 下的每个文件夹是一段路由，只有 `page.tsx` 让该路径存在。`page.tsx` 默认是服务端组件，可以是 `async` 函数，直接 `await` 数据库查询。数据获取没有单独的函数约定，取数据的代码就写在组件里。

两套方案的分水岭在这里：`pages` 把数据获取放在组件外面，`app` 把数据获取放进组件里面。前者能精确控制「构建时取」还是「每次请求取」，后者靠缓存语义和动态 API 推导出来。

Next.js 16 仍然完整支持 `pages/`。官方只修 bug，不加新特性。生态里的新指南、新 API 都以 `app/` 为默认，所以继续往 `pages` 里加功能会越写越孤立。

两套路由共存时，只有一份 `proxy`。请求先进 `proxy`，再按路径分派到 `app` 或 `pages`。构建产物里两套路由分开列出，共享组件会被打两次包，体积略增。这是共存阶段的成本，迁移结束就消失。

判断要不要迁移，看三个问题。

- 页面是否需要流式渲染、部分预渲染、`"use cache"` 这些新能力。需要就迁。
- 团队是否还要长期维护这个仓库。只是接手半年、页面不再大改，迁完的收益抵不上回归成本。
- 迁移面有多大。按四十个页面、每页一小时改写加半天回归算，大约两三周。页面越多，越要分批。

## 38.2 目录与文件对照

特殊文件是迁移里最容易搞错的部分，先看对照关系。

| Pages Router | App Router | 说明 |
| --- | --- | --- |
| `pages/index.tsx` | `app/page.tsx` | 首页 |
| `pages/about.tsx` | `app/about/page.tsx` | 普通页面，目录加 `page.tsx` |
| `pages/blog/[slug].tsx` | `app/blog/[slug]/page.tsx` | 动态段写法不变 |
| `pages/api/hello.ts` | `app/api/hello/route.ts` | 文件名从 `hello.ts` 变成目录加 `route.ts` |
| `pages/_app.tsx` | `app/layout.tsx` | 全局布局与全局样式 |
| `pages/_document.tsx` | `app/layout.tsx` | `html`、`body` 直接写在根布局里 |
| `pages/404.tsx` | `app/not-found.tsx` | 404 页面 |
| `pages/_error.tsx` | `app/error.tsx` | 错误边界，需要客户端组件 |
| `next/head` | `metadata` 导出 | 页面 head 不再用组件 |

先说三条位置规则。

`_app.tsx` 和 `_document.tsx` 只能放在 `pages/` 根目录，放进子目录不生效。`proxy.ts`、`instrumentation.ts`、`next.config.ts` 只能放在项目根或 `src/` 根。`route.ts` 与 `page.tsx` 不能同目录存在，一个目录要么是页面，要么是接口。

换算目录可以先用命令列出清单，再逐条处理。

```bash
find src/pages -name '*.tsx' -not -path '*/api/*' | sed -E 's#src/pages/##; s#\.tsx$##'
```

输出是去掉前缀和扩展名的路径，比如 `about`、`blog/[slug]`。每一行在 `src/app/` 下建同名目录，再放一个 `page.tsx`。

`pageExtensions`、`basePath`、`trailingSlash` 这几项配置同时作用于两套路由。迁移期间两套页面都受影响，改配置要一起回归。

文件名大小写也要检查。`pages/About.tsx` 在 macOS 上能跑，部署到 Linux 后请求 `/about` 会 404。迁移时顺手改成小写，别把这个问题带进新路由。

动态段完全一致：`[slug]` 匹配一段，`[...slug]` 匹配多段，`[[...slug]]` 连根路径也能匹配。`app/` 多了两种目录写法，`(group)` 只影响布局分组、不影响 URL，`_folder` 是私有目录、不参与路由。

还有两项配置只在 `pages` 侧完整可用。`i18n` 让框架按语言前缀分发页面，`app/` 没有对应配置。迁移时要么放弃多语言前缀，要么在 `proxy` 里自己读 `Accept-Language` 再 rewrite。`basePath` 两套都支持，但迁到 `app/` 后，`request.nextUrl.pathname` 不含 basePath，鉴权判断时要自己补上。

## 38.3 三个数据获取函数

`pages` 的数据获取靠具名导出。三个函数分工明确：`getStaticProps` 在构建时执行，`getServerSideProps` 在每次请求时执行，`getStaticPaths` 为动态路由列出要预渲染的路径。

三者只能在 `pages/` 的页面文件里导出。写进 `_app.tsx`、`_document.tsx` 或普通组件里，构建时会报错或静默忽略。

### 38.3.1 getStaticProps

`getStaticProps` 在构建时跑一次，返回值序列化成 props，页面预渲染成 HTML 文件。适合定价页、文档、博客列表这类不随用户变化的页面。

```tsx
// src/pages/pricing.tsx
import type { GetStaticProps, InferGetStaticPropsType } from "next";

type Plan = { id: string; name: string; price: number };

async function listPlans(): Promise<Plan[]> {
  // 顶层 import 的代码只在服务端执行，不会进客户端包
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("id, name, price");
  return data ?? [];
}

export const getStaticProps = (async () => {
  const plans = await listPlans();
  return { props: { plans }, revalidate: 3600 };
}) satisfies GetStaticProps<{ plans: Plan[] }>;

export default function PricingPage({
  plans,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <ul>
      {plans.map((plan) => (
        <li key={plan.id}>
          {plan.name}：{plan.price} 分
        </li>
      ))}
    </ul>
  );
}
```

`getStaticProps` 的返回值有四个键。

- `props`：传给组件的对象，必须能 JSON 序列化。`Date`、`Map`、函数、类实例都不行，会报 `Error serializing .props returned from getStaticProps`。
- `revalidate`：多少秒后允许后台重新生成。不写表示永不重新生成。
- `notFound`：返回 `true` 时该路径渲染 404。即使之前生成过页面，也会变成 404。
- `redirect`：`{ destination, permanent }`，或者用 `statusCode` 代替 `permanent`，两者不能同时给。

开发模式下 `getStaticProps` 每次请求都会执行，方便改数据后立刻看到效果。构建时的行为才是线上行为。

`preview` 和 `draftMode` 是两个容易混的参数。`context.preview` 为 `true` 表示这次请求来自预览模式，取数据时要绕过缓存查最新内容。`context.draftMode` 在 16.x 里取代了 `previewData`，页面里读它就自动变成按请求渲染。`app/` 里对应的是 `draftMode()` 加 `revalidatePath`，没有 `preview` 这个布尔值。

### 38.3.2 getServerSideProps

`getServerSideProps` 在每次请求时执行，参数里带着请求对象。适合必须看登录状态、cookie、请求头的页面。

```tsx
// src/pages/dashboard.tsx
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";

type User = { id: string; email: string };

export const getServerSideProps = (async (context) => {
  const token = context.req.cookies["sb-access-token"];
  if (!token) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const res = await fetch(`${process.env.API_URL}/api/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { notFound: true };

  return { props: { user: (await res.json()) as User } };
}) satisfies GetServerSideProps<{ user: User }>;

export default function Dashboard({
  user,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <h1>欢迎，{user.email}</h1>;
}
```

`context` 里常用的字段有 `params`、`query`、`req`、`res`、`resolvedUrl`、`locale`。做重定向判断时用 `resolvedUrl`，它是去掉 `/_next/data` 前缀的规范地址，`req.url` 不一定是。`req` 是 Node 的 `IncomingMessage`，`req.cookies` 由 Next.js 补上；`res` 是 `ServerResponse`。

返回值只有 `props`、`notFound`、`redirect` 三种。函数里可以直接查数据库、读环境变量，这些代码不会进浏览器。

`redirect` 的 `permanent: false` 是 307，适合登录跳转。`permanent: true` 是 308，会进浏览器缓存，用它做域名或路径的永久迁移。

### 38.3.3 getStaticPaths

动态路由用 `getStaticPaths` 声明构建时要生成哪些路径。它必须和 `getStaticProps` 一起用，单独导出会报错。

```tsx
// src/pages/teams/[slug].tsx
import type { GetStaticPaths, GetStaticProps } from "next";

export const getStaticPaths = (async () => {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("slug").is("deleted_at", null);

  return {
    paths: (data ?? []).map((team) => ({ params: { slug: team.slug } })),
    fallback: "blocking",
  };
}) satisfies GetStaticPaths;

export const getStaticProps = (async (context) => {
  const slug = context.params?.slug as string;
  const team = await loadTeamBySlug(slug);
  if (!team) return { notFound: true };
  return { props: { team }, revalidate: 300 };
}) satisfies GetStaticProps;
```

`fallback` 有三个取值，行为差别很大。

- `false`：不在 `paths` 里的路径直接 404。团队新增之后，必须重新构建才能访问。
- `true`：不在 `paths` 里的路径先返回一个兜底页面，浏览器里要通过 `router.isFallback` 显示加载态，数据就绪后再渲染。
- `"blocking"`：服务端先把页面生成好再返回，用户不会看到兜底页，但首屏要等一次生成。

选哪个取决于数据量和可接受的首屏延迟。团队数量在几百以内，用 `"blocking"` 最简单。

### 38.3.4 App Router 里对应什么

`app/` 没有这三个函数。取数据的代码直接写进组件，缓存由 `fetch` 的选项和路由段配置决定。

```tsx
// src/app/pricing/page.tsx
export default async function PricingPage() {
  const res = await fetch(`${process.env.API_URL}/plans`, {
    next: { revalidate: 3600 },
  });
  const plans = (await res.json()) as Plan[];
  return (
    <ul>
      {plans.map((plan) => (
        <li key={plan.id}>{plan.name}</li>
      ))}
    </ul>
  );
}
```

三种缓存语义对应旧世界的三个函数。

- `fetch` 不写选项，等价 `getStaticProps`。结果会缓存，直到 `revalidate` 过期或手动失效。
- `fetch(url, { cache: "no-store" })`，等价 `getServerSideProps`。每次请求都执行。
- `fetch(url, { next: { revalidate: 60 } })`，等价 `getStaticProps` 里返回 `revalidate: 60`。

除了 `fetch`，读 `cookies()`、`headers()`、`searchParams` 也会让页面变成按请求渲染。

404 和重定向改成函数调用，不再从数据函数里返回对象。

```tsx
// src/app/teams/[slug]/page.tsx
import { notFound, redirect } from "next/navigation";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = await loadTeamBySlug(slug);
  if (!team) notFound();
  if (!team.id) redirect("/teams");
  return <h1>{team.name}</h1>;
}
```

`params` 是 Promise，必须 `await`。16.x 起同步访问已被移除，写成 `params.slug` 拿到的是一个 Promise 对象，渲染出来是 `[object Promise]`。

动态路由的预渲染改成 `generateStaticParams`，返回路径参数数组。是否允许未列出的路径按需生成，由 `dynamicParams` 决定，默认是 `true`，相当于 `fallback: "blocking"` 的效果但不需要兜底页。

```tsx
// src/app/teams/[slug]/page.tsx
export async function generateStaticParams() {
  const slugs = await listTeamSlugs();
  return slugs.map((slug) => ({ slug }));
}

export const dynamicParams = true;
```

构建输出的符号可以帮你确认改动生效。`○` 是静态，`●` 是带 `generateStaticParams` 的预渲染，`ƒ` 是按请求渲染。

路由段还能用 `export const dynamic = "force-dynamic"` 强制按请求渲染，用 `"force-static"` 强制构建时生成。这两个开关对应 `pages` 侧两个数据函数的选择。写错不报错，只会让页面行为偏离预期，改完用构建符号确认。

## 38.4 API Routes

`pages/api/` 下的文件映射到 `/api/*`。这些文件只在服务端打包，不会进客户端产物。每个文件默认导出一个处理函数，签名是 Node 的请求和响应对象。

```ts
// src/pages/api/webhooks/stripe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy");

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) return res.status(400).json({ error: "missing signature" });

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return res.status(400).json({ error: "bad signature" });
  }

  await handleStripeEvent(event);
  return res.status(200).json({ received: true });
}
```

`bodyParser: false` 是验签的前提。默认情况下 Next.js 会把请求体解析成对象，原始字节丢掉，签名就没法验。`config` 里还能设 `maxDuration` 和 `responseLimit`。

请求对象上有三个便利属性：`req.cookies`、`req.query`、`req.body`。响应对象上有 `status`、`json`、`send`、`redirect`、`revalidate` 这些方法，写起来接近 Express。

同一件事在 `app/` 里用 `route.ts` 加 Web 标准的 `Request` 和 `Response`。

```ts
// src/app/api/webhooks/stripe/route.ts
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy");

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  await handleStripeEvent(event);
  return Response.json({ received: true });
}
```

两种写法的差别集中在三处。

参数取法不同。`req.query.slug` 在旧写法里直接可用；新写法要从 URL 里取：`new URL(request.url).searchParams.get("slug")`。取不到时前者是 `undefined`，后者是 `null`，`Number(null)` 是 `0`，这类隐式转换是接口 400 的常见来源。

流式响应只有 `route.ts` 能做。处理函数返回 `ReadableStream` 时，浏览器能逐块收到数据；`pages/api` 这条路径要先攒完整响应再发。

CORS 默认关闭。两种写法都不自动加跨域头，需要自己设 `Access-Control-Allow-Origin`。预检请求在 `route.ts` 里要单独导出 `OPTIONS`。

两边都能声明 `maxDuration`，单位是秒，超过时限会被平台终止。自托管时真正生效的是进程管理器，Next.js 只读取这个值。接口超时不要先调大时限，先看连接池：一个接口变慢，往往是它排队等数据库连接，加时限只是把失败推后。

## 38.5 _app 与 _document

`_app.tsx` 是 Pages Router 的根组件。每个页面都渲染在它里面，全局样式、全局 Provider、全局错误处理放这里。

```tsx
// src/pages/_app.tsx
import type { AppProps } from "next/app";
import "@/styles/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

`Component` 是当前页面组件，`pageProps` 是数据函数预取的 props。`_app.tsx` 里不能导出 `getStaticProps` 或 `getServerSideProps`，需要全局数据就在组件里用 SWR 拉，或者在每个页面自己取。

项目一开始没有 `_app.tsx` 时，新建它会要求重启开发服务器。文件在运行期间被创建，热更新加载不到。

`_document.tsx` 只在服务端渲染，负责输出 `html`、`head`、`body` 的骨架。

```tsx
// src/pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
```

四个组件必须都渲染。`Main` 是页面内容的挂载点，`NextScript` 负责注入运行时代码，缺一个页面就是白屏。

`_document.tsx` 不能写事件处理器，不能读 `window`，不支持数据获取函数。`<Head />` 来自 `next/document`，只放全站公共的 head 标签，比如统计脚本的 `<script>` 和字符集声明。页面级的标题和描述要用 `next/head`。

`Main` 之外不要放需要 hydration 的组件。React 不会初始化那部分，交互会失效。

`_app.tsx` 里 import 的全局样式作用于所有页面。迁到 `app/` 后，全局样式放在根布局，页面级样式用 CSS Modules 或工具类。两套样式方案混用会出现优先级冲突，排查时先看注入顺序。

第三方脚本要放进 `_document.tsx` 时，用 `next/script` 的 `strategy` 控制时机，别直接写 `<script>`。直接写会阻塞首屏解析，页面加载时间随脚本数量线性上升。

迁移到 `app/` 后，这两件事合并进根布局。

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Teamstack", template: "%s · Teamstack" },
  description: "多租户团队管理后台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

对应关系是这样的：`_app.tsx` 的全局样式和 Provider 搬进 `layout.tsx`；`_document.tsx` 的 `html`、`body` 直接写进根布局；`next/head` 换成 `metadata` 导出或 `generateMetadata` 函数；`_document.tsx` 里用 `<link>` 引的字体换成 `next/font`。

16.x 还有一处细节：默认不再覆盖 `scroll-behavior`。需要恢复旧版在 `_document.tsx` 里加 `<style>` 的写法时，改成给 `<html>` 加 `data-scroll-behavior="smooth"`。

## 38.6 ISR 的两种写法

ISR 让静态页面在后台重新生成，用户始终拿到已有版本。两套路由的触发方式一样，写法不同。

时间型最直接。`pages` 里在 `getStaticProps` 的返回值里写 `revalidate`。

```tsx
// src/pages/posts/index.tsx
export const getStaticProps = (async () => {
  const posts = await listPosts();
  return { props: { posts }, revalidate: 60 };
}) satisfies GetStaticProps;
```

`app/` 里在路由段上导出常量，或者写在 `fetch` 的选项里。

```tsx
// src/app/posts/page.tsx
export const revalidate = 60;

export default async function PostsPage() {
  const posts = await listPosts();
  return <PostList posts={posts} />;
}
```

两个常量可以共存。`fetch` 上的 `revalidate` 只管这一个请求，路由段上的管整页的默认值。

按需触发就不同了。`pages` 里没有对应的缓存 API，要在 API Route 里调 `res.revalidate(path)`。

```ts
// src/pages/api/revalidate.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.query.secret !== process.env.REVALIDATE_SECRET) {
    return res.status(401).json({ error: "invalid secret" });
  }

  const path = req.query.path;
  if (typeof path !== "string") {
    return res.status(400).json({ error: "path required" });
  }

  try {
    await res.revalidate(path);
    return res.json({ revalidated: true, path });
  } catch {
    return res.status(500).json({ error: "revalidate failed" });
  }
}
```

`res.revalidate('/posts/1')` 是立即重新生成，调用返回时新页面已经就绪。传的路径是页面真实路径，写成 rewrite 之后看到的地址无效。

`app/` 里改成两个函数，语义从「立即生成」变成「标记失效」。

```ts
// src/app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const secret = request.headers.get("x-revalidate-secret");
  if (secret !== process.env.REVALIDATE_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = (await request.json()) as { path?: string; tag?: string };

  if (body.path) revalidatePath(body.path);
  if (body.tag) revalidateTag(body.tag, "max");

  return Response.json({ ok: true });
}
```

`revalidatePath` 只把缓存标脏，下一次请求才重新生成，触发的那次请求仍拿旧内容。`revalidateTag` 的第二参是缓存生命周期配置，16.x 起必填，只写一个参数会报 `Expected 2 arguments, but got 1.`

想确认缓存在哪个状态，看响应头。

```bash
curl -sI localhost:3000/posts | grep -i x-nextjs-cache
# x-nextjs-cache: HIT
```

四个取值，含义分别是：`MISS` 首次生成，`STALE` 已过期、正在后台更新，`HIT` 命中未过期缓存，`REVALIDATED` 刚被按需重新生成。

CDN 在前面时，`res.revalidate` 只更新源站，边缘节点仍按 `Cache-Control` 返回旧内容。要连带清 CDN，得在接口里调服务商的 purge API，或者把响应头的 `s-maxage` 调小。

多实例部署时要注意缓存的位置。默认缓存写在各实例的本地文件系统里，按需失效只会通知收到请求的那个实例，其余实例继续给旧页面。生产环境要把 `cacheHandler` 换成共享实现，或者改用对象存储做缓存层。

## 38.7 middleware.ts 与 proxy.ts

`middleware.ts` 在 Next.js 16 里改名为 `proxy.ts`，导出名也一起改了。功能没变，位置没变，还是放在项目根或 `src/` 根。

```ts
// src/proxy.ts
import { NextResponse } from "next/server";

export function proxy(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === "/old-dashboard") {
    return NextResponse.redirect(new URL("/dashboard", url));
  }

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

`proxy` 只能跑在 Node runtime。在文件里写 `export const runtime = "edge"` 会直接抛错，官方文档的原话是 `Setting the runtime config option in Proxy will throw an error.`。旧版 `middleware.ts` 在 15.5 之后也可以选 Node runtime，迁移到 `proxy` 时不需要改运行时假设。

`matcher` 必须写负向断言。不写 `matcher` 时 `proxy` 对每个请求都执行，包括 `/_next/static` 下的 JS 和图片。鉴权逻辑放进去，未登录用户会被重定向到登录页，页面样式和脚本也一起被拦掉。

官方提供了 codemod，把文件名和导出名一起改掉。

```bash
npx @next/codemod@canary middleware-to-proxy .
```

**未验证**：这条命令在当前 16.4.6 环境里没跑过，执行前先提交工作区。

`matcher` 只接受字符串数组。正则写错一个字符，结果是整段路由没被拦截，或者静态资源被拦。改完用 `curl -I` 分别打一个静态资源和一个页面，确认真实行为。

旧 `middleware.ts` 默认跑在 edge runtime，`proxy.ts` 只能跑在 Node。这个差别影响可用 API：edge 里没有 `node:async_hooks`、`fs`，`crypto` 也有限。旧中间件里 import 了 Node 内置模块的，改名为 `proxy` 之后反而能跑了；反过来，之前依赖 edge 冷启动快这一点的，要重新量延迟。

`proxy` 能做的事：重定向、重写、改请求头、直接返回响应。不能做的事：读请求体做业务判断、查数据库做复杂鉴权、当权限层用。它是请求进入路由之前的粗粒度过滤，细粒度授权要放在页面和接口里，靠 RLS 和 `requireMembership()` 兜底。

## 38.8 路由 hooks 与布局

`next/router` 是 Pages Router 的 hooks，`next/navigation` 是 App Router 的。名字相近，返回值差很多。

| Pages Router | App Router | 说明 |
| --- | --- | --- |
| `useRouter().pathname` | `usePathname()` | 当前路径 |
| `useRouter().query` | `useSearchParams()` | 查询参数，app 里不含动态段 |
| `useRouter().asPath` | 用 `usePathname()` 拼 `useSearchParams()` | 旧 API 没有直接对应 |
| `useRouter().isReady` | 无 | 客户端组件首次渲染即可读参数 |
| `useRouter().push` | `useRouter().push` | 导航 |
| `router.events.on("routeChangeStart")` | 无 | 用 `usePathname` 加 `useEffect` 模拟 |

在 `app/` 里 import `next/router`，运行时会报 `NextRouter was not mounted.`。共享组件被两套路由同时引用时，用 `next/compat/router` 的 `useRouter`，它返回 `null` 表示当前在 App Router 里。

```tsx
// src/components/back-button.tsx
"use client";

import { useRouter as usePagesRouter } from "next/compat/router";
import { useRouter as useAppRouter } from "next/navigation";

export function BackButton() {
  const pagesRouter = usePagesRouter();
  const appRouter = useAppRouter();

  function goBack() {
    if (pagesRouter) pagesRouter.back();
    else appRouter.back();
  }

  return <button onClick={goBack}>返回</button>;
}
```

`useSearchParams` 在 `app/` 里有一个硬约束：读它的组件必须包在 `<Suspense>` 里，否则构建时报 `useSearchParams() should be wrapped in a suspense boundary`。原因是查询参数要到请求时才确定，不能参与静态预渲染。

`getLayout` 是 Pages Router 的布局方案，页面文件上挂一个函数，框架按函数返回值包一层布局。`app/` 里改用嵌套的 `layout.tsx`，布局按目录生效，不需要每页登记。

`useRouter().push` 在 `next/navigation` 里不再返回 Promise，需要等待导航完成时，用 `startTransition` 包住调用。旧的 `router.events` 也没有替代物，进度条要靠 `usePathname` 变化触发。

两套 hooks 不要在同一个组件里混用。`next/compat/router` 的返回值可能为空，使用前先判空，否则 `strict` 模式下类型检查不过。

两套路由之间跳转会触发整页刷新，`<Link>` 的预取也只在自己那套里生效。迁移期间用户点一次跨路由链接，页面会白一下。这是共存阶段的已知代价。

## 38.9 迁移顺序

按这个顺序执行，每一步都能单独验证，出问题可以回退。

第一步，先建 `app/layout.tsx` 和 `app/page.tsx`，让 `app/` 能跑起来，`pages/` 继续服务其余路径。此时两套并存，访问旧路径仍落 `pages/`。

第二步，从叶子页面开始搬。先搬静态页，再搬列表页，最后搬带表单和动态数据的页面。越往后依赖越多，先易后难能提前暴露配置问题。

第三步，就地改写数据函数。`getStaticProps` 变成 `async` 组件加 `fetch`；`getServerSideProps` 变成组件里读 `cookies()` 或 `headers()`。返回值里的 `notFound` 换成 `notFound()`，`redirect` 换成 `redirect()`。

第四步，共享组件加 `"use client"`。`app/` 默认服务端渲染，带 `useState`、事件处理、浏览器 API 的组件必须显式声明。

第五步，替换路由 hooks。`next/router` 改成 `next/navigation`，拿不准就先用 `next/compat/router`。

第六步，删掉搬完的 `pages/` 文件，跑一遍全站回归。旧 URL 需要保留的，在 `next.config.ts` 里配 `redirects`。

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/old-dashboard", destination: "/dashboard", permanent: true },
    ];
  },
};

export default nextConfig;
```

`permanent: true` 是 308，浏览器和搜索引擎都会记住。路径只是内部调整、以后可能改回来的，用 `permanent: false`（307）。

迁移到后半程要准备回滚。做法是保留旧页面一段时间，用 `proxy` 按 cookie 把流量分到两套，出问题时切回来。同一路径因此要维护两份代码，只适合迁移窗口期。开关写进环境变量，切流量不需要重新部署。

每搬完一批页面，用 `curl` 把旧路径抓一遍，和迁移前的输出做 diff。只比状态码不够，`<head>` 里的 canonical、JSON-LD、meta 描述也要比。抓取脚本放进仓库，下次迁移直接复用。

API 里的权限判断不能只靠前端传来的 teamId。两种写法都要先取会话，再用 `requireMembership()` 校验，最后查数据。漏掉这一步，任何登录用户都能读到别人团队的数据。

迁移期间最容易忽略的是数据库层的假设。页面搬完、接口搬完，但权限判断还写着旧路由的 cookie 名，登录态就断了。迁移前把鉴权入口列一遍，改完逐个验证。

## 38.10 检查点

1. `pnpm build` 输出里 `src/pages` 下的路径逐个有对应符号，`○` 或 `●` 表示预渲染，`ƒ` 表示按请求渲染。打开构建日志，确认没有「两个页面解析到同一路径」的警告。
2. `curl -sI localhost:3000/posts | grep -i x-nextjs-cache` 第一次返回 `MISS`，第二次返回 `HIT`；调用按需失效接口后再请求，返回 `REVALIDATED` 或 `STALE`。
3. 在 `src/proxy.ts` 顶部临时写 `export const runtime = "edge"`，`pnpm dev` 应立刻报错。删掉后恢复正常，说明运行时约束生效。
4. 在 App Router 的客户端组件里 import `next/router` 的 `useRouter`，页面应报 `NextRouter was not mounted.`；换成 `next/navigation` 后消失。
5. `grep -rn "getStaticProps\|getServerSideProps" src/app` 结果为空。`app/` 里出现这两个名字，说明有页面没搬干净。
6. `git grep -n "next/head" -- src` 只剩说明性注释。还有真实 import 的话，head 写法没换完。

## 38.11 常见错误

1. 两个路由解析到同一路径

报错原文：`You cannot have two parallel pages that resolve to the same path.`。原因是 `src/pages/about.tsx` 和 `src/app/about/page.tsx` 同时存在。迁移期间只能保留一个，搬完立刻删旧文件。

2. 动态路由缺少 getStaticPaths

报错原文：`getStaticPaths is required for dynamic SSG pages and is missing for '/blog/[slug]'.`。动态页面同时导出了 `getStaticProps`，就必须导出 `getStaticPaths`。不想逐个列路径，改成 `getServerSideProps`，或者迁到 `app/` 用 `generateStaticParams`。

3. API Route 收不到原始请求体

现象是验签永远失败，日志里的 `raw` 是空 Buffer。原因是默认开启了 body parser。加上 `export const config = { api: { bodyParser: false } }`，然后用 `for await` 读 `req`。

**4. 请求体超过限制**

报错原文：`PayloadTooLargeError: request entity too large`。`pages/api` 默认限制 1MB。文件上传不该走接口，确实要传大 body 时调大 `config.api.bodyParser.sizeLimit`，同时把 `responseLimit` 一起考虑。

5. res.revalidate 不存在

报错原文：`TypeError: res.revalidate is not a function`。这个方法是 `pages/api` 的响应对象上的，在 `route.ts` 的 Web `Response` 上没有。App Router 里改用 `revalidatePath` 或 `revalidateTag`。

6. 在 _document 里读 window

报错原文：`ReferenceError: window is not defined`。`_document.tsx` 只在服务端执行，任何浏览器 API 都会报错。需要客户端逻辑时放进 `useEffect`，或者搬到 `_app.tsx` 之外的组件里。

## 38.12 这一章在做什么

这一章把 Pages Router 与 App Router 放在一起对照。对照项包括：文件怎么映射、三个数据函数换成什么、API Routes 与 route handler 的差别、`_app` 和 `_document` 的职责去哪了、ISR 的两种触发方式、`middleware.ts` 到 `proxy.ts` 的改名、路由 hooks 的替换。最后给出六步迁移顺序。

读完之后，看到一段 `getServerSideProps` 应该知道它对应 `app/` 里的什么写法，看到一个 `pages/api` 文件应该知道它的替代物是 `route.ts`。迁移的判断标准也清楚：需要新特性、长期维护、页面数量可控，就迁；否则先放着。

遇到旧代码，先判断请求落在哪套路由上，再决定查哪份文档。

第 39 章开始讲质量保障。第一件事是测试：怎么在本地和 CI 里跑起来，哪些东西能测、哪些测不了。
