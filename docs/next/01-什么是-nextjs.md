# 第 1 章 什么是 Next.js

## 1.1 Next.js 是什么

Next.js 是一个基于 React 的全栈 Web 框架，由 Vercel 维护，开源，MIT 协议。

它负责 React 不管的那几层：URL 到组件的映射、服务端渲染、数据获取、构建与部署。React 只负责组件本身。

一句话概括分工：你写 React 组件，Next.js 决定这些组件在哪里运行、什么时候运行、运行结果怎么变成 HTTP 响应。

当前主线版本是 16.x，默认路由方案是 App Router。本书所有代码基于 16.4.x。

简单交代一下来历。Next.js 在 2016 年发布，最初解决的是“React 应用怎么做服务端渲染”这一个问题，路由方案是现在的 Pages Router：一个文件就是一个页面，数据获取靠 `getServerSideProps` 和 `getStaticProps`。

2023 年 App Router 稳定，把路由、布局、数据获取、缓存重新设计了一遍，核心是把组件分成服务端和客户端两类。2025 年发布的 16.x 把 Turbopack 变成默认构建器，`middleware` 改名 `proxy`，缓存 API 从函数参数搬到了组件内部。

读懂这段历史有实际用处：网上大量教程还在讲 Pages Router，遇到 `getServerSideProps` 不要以为是新写法，那是旧方案。

## 1.2 React 不负责的四件事

React 是 UI 库，它提供组件、状态、事件。它不提供下面这些能力：

- URL 到组件的映射。React 不知道 `/dashboard` 应该渲染哪个组件。需要另配 React Router 之类的库，还得自己决定哪些路由要预渲染。
- 首屏 HTML。React 在浏览器里把组件渲染成 DOM，服务器发出的 HTML 只有一个空容器。要出首屏，就得自己搭一套服务端渲染，处理 hydration、样式、静态资源路径。
- 数据来源。React 不规定数据从哪取、在服务端取还是客户端取。每个项目自己发明一套请求层，接不上框架的缓存和流式渲染。
- 构建与部署。React 不提供打包、代码分割、静态资源处理、运行环境。上面这些自己拼装，通常要三五个工具加一份自定义脚本。

Next.js 补的就是这四件事。它的定位是把 React 用到完整应用上的那层框架，不是替代 React。

这层框架有代价：多了一套约定要学，多了一层构建，出错时的调用栈更长。换来的是不用自己拼路由、渲染、打包、部署这四套东西。

## 1.3 主要特点

### 1.3.1 文件系统路由

`app/` 目录下的文件夹层级就是 URL 层级，文件夹里的 `page.tsx` 才是可访问的页面。

```tsx
// app/dashboard/settings/page.tsx
export default function SettingsPage() {
  return <h1>设置</h1>;
}
```

这个文件对应 `/dashboard/settings`。文件名固定，位置固定，不需要注册路由表。

同层还可以放 `layout.tsx`（布局）、`loading.tsx`（加载态）、`error.tsx`（错误边界）、`not-found.tsx`（404），它们按目录自动生效。

### 1.3.2 默认是服务端组件

`app/` 下的组件默认在服务端渲染，叫 React Server Component（RSC）。它可以 `async`，可以直接读数据库、读文件、读环境变量，这些代码不会进入浏览器产物。

```tsx
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const res = await fetch("https://api.example.com/stats");
  const stats = await res.json();
  return <p>今日请求 {stats.count} 次</p>;
}
```

组件树里需要交互的部分，加 `"use client"` 声明，才会被打包进浏览器。

```tsx
// app/components/counter.tsx
"use client";

import { useState } from "react";

export function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}
```

这个边界是 Next.js 最重要的概念，第 4 章专门讲。

### 1.3.3 嵌套布局

`layout.tsx` 包住同级和下级所有页面，切换页面时布局不重新渲染。

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
```

侧边栏的滚动位置、展开状态、正在播放的音频，在页面跳转时都会保留。这是 App Router 相对 Pages Router 的一处实质改动。

### 1.3.4 服务端数据获取

服务端组件里可以直接 `await`。没有 `useEffect`，没有加载态闪烁，数据在 HTML 里。

```tsx
// app/teams/[slug]/page.tsx
export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await db.team.findUnique({ where: { slug } });
  return <h1>{team?.name}</h1>;
}
```

注意 `params` 是 Promise，必须 `await`。16.x 起同步访问已被移除，不写 `await` 会拿到 Promise 对象本身。

### 1.3.5 Server Actions：表单直接提交函数

给函数加 `"use server"`，就可以在客户端组件里直接调用它，Next.js 自动生成请求、序列化参数、处理返回值。

```ts
// app/actions.ts
"use server";

import { revalidatePath } from "next/cache";

export async function renameTeam(teamId: string, name: string) {
  await db.team.update({ where: { id: teamId }, data: { name } });
  revalidatePath("/dashboard");
}
```

```tsx
// app/components/rename-form.tsx
"use client";

import { renameTeam } from "@/app/actions";

export function RenameForm({ teamId }: { teamId: string }) {
  return (
    <form action={(fd) => renameTeam(teamId, String(fd.get("name")))}>
      <input name="name" />
      <button type="submit">保存</button>
    </form>
  );
}
```

表单在 JavaScript 加载完成前也能提交，这是它相对手写 `fetch` 的主要优势。

### 1.3.6 路由处理器：对外 HTTP 接口

需要给第三方或移动端提供接口时，写 `route.ts`，导出 `GET`、`POST` 等函数。

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
```

它和页面共用同一个部署单元，不需要另起一个服务。

### 1.3.7 缓存与静态化

默认情况下，能静态化的页面在构建时生成 HTML。需要按请求渲染的，在组件里读 `cookies()`、`headers()`，或者用动态 API。

需要显式缓存一段计算或查询，用 `"use cache"`（需要开启 Cache Components，第 14 章讲）。

```ts
// app/lib/stats.ts
export async function getStats(teamId: string) {
  "use cache";
  return db.query.stats({ teamId });
}
```

失效靠 `revalidateTag`、`updateTag`、`revalidatePath`。这几个 API 在 16.x 有行为变化，第 14 章逐条对照。

### 1.3.8 内置优化

- `next/image`：按需生成多尺寸图片、懒加载、防止布局抖动。
- `next/font`：构建时下载字体、自托管、消除字体闪烁。
- `next/script`：控制第三方脚本的加载时机。
- `next build`：默认用 Turbopack，输出每个路由是静态（○）、动态（ƒ）还是预渲染（●）。

这些优化手写也能做，但要处理一堆边界：图片格式协商、缓存头、尺寸计算、字体子集、脚本顺序。框架的价值在于这些边界已经处理过，你只需要用对组件。

代价是这些组件有自己的行为。`next/image` 需要配置允许的远程域名，`next/font` 在构建时下载字体、离线环境会失败，`next/script` 的策略选错会让统计脚本阻塞首屏。用之前先读对应章节，不要当成原生标签的替代品。

### 1.3.9 链接预取与代码分割

`<Link>` 进入视口时，Next.js 会在后台预取目标路由的数据和代码。点击时只需要切换，不白屏。

```tsx
// app/components/nav.tsx
import Link from "next/link";

export function Nav() {
  return <Link href="/dashboard">仪表盘</Link>;
}
```

每个路由的 JS 按需加载，首屏不下载全部页面代码。第 36 章讲预取策略和它的开关。

### 1.3.10 请求拦截

`proxy.ts` 在请求进入路由之前执行，适合做重定向、A/B 分流、粗粒度鉴权。它运行在 Node runtime，不能读数据库做复杂判断。

```ts
// src/proxy.ts
import { NextResponse } from "next/server";

export function proxy(request: Request) {
  const url = new URL(request.url);
  if (url.pathname === "/old") return NextResponse.redirect(new URL("/new", url));
}
```

16.x 起 `middleware.ts` 改名为 `proxy.ts`，旧名字仍可用但已废弃。第 16 章讲完整用法和它的边界。

## 1.4 四种渲染方式

Next.js 的很多设计都围绕“这段 HTML 什么时候生成”展开。App Router 里有四种情况。

静态生成（SSG）。构建时把页面渲染成 HTML，之后每次请求都返回同一份文件。适合内容不随用户变化的页面：首页、定价页、文档。

按请求渲染（SSR）。每次请求都执行组件，读 `cookies()`、`headers()` 或使用未缓存的数据库查询时自动进入这种模式。适合个性化页面：仪表盘、订单详情。

增量再生成（ISR）。页面按固定时间或事件重新生成，期间返回旧版本。适合更新频率中等的内容：列表页、商品页。写法是 `export const revalidate = 60`，或者用 `"use cache"` 配 `cacheLife`。

客户端渲染（CSR）。组件加 `"use client"` 后在浏览器执行，数据用 `useEffect` 或 SWR 拉取。适合强交互区域：图表、编辑器、实时列表。

四种模式各有各的坑，先记住症状，遇到再回头看。

静态生成的坑是“看起来更新了，其实没更新”：改了数据，页面还是旧的，因为 HTML 是构建时那份。内容是用户可见的数据时，要么用再生成，要么明确按请求渲染。

按请求渲染的坑是“整个页面被动起来了”：为了一个登录状态，把一页本来能静态化的内容也变成按请求渲染，首屏从 CDN 命中变回服务器计算。做法是把依赖请求的那一小块拆成独立组件，用 Suspense 包起来，外层保持静态。

增量再生成的坑是“第一次访问是旧的，第二次才新”：再生成是后台做的，触发的那次请求仍然返回旧页面。对强一致要求高的数据不要用。

客户端渲染的坑是“数据和页面分两趟来”：先出骨架，再请求数据，中间有闪烁；首屏没有内容，爬虫抓不到。能用服务端组件取的数据，不要下沉到客户端。

判断一段代码落在哪种模式，看构建输出的符号最快：

```bash
pnpm build
# ○ /              静态
# ƒ /dashboard     按请求渲染
# ● /posts/[slug]  预渲染的动态路由
```

四种模式可以在同一个页面里混用。外层布局静态，中间列表按请求渲染，里面一个图表是客户端组件。这正是 App Router 和纯 SSR 框架的区别：粒度是组件，不是整页。

最常见的误判是把“页面里有 `await`”当成按请求渲染。不是。`await` 本身不影响模式，影响模式的是有没有读请求相关的东西：`cookies()`、`headers()`、`searchParams`、`connection()`。一个只查数据库的 `await`，照样可以在构建时跑完。

反过来也有误判：以为加了 `"use client"` 就不做服务端渲染了。客户端组件照样会在服务端渲染出首屏 HTML，只是它的代码也会打包进浏览器。这两件事是独立的。

## 1.5 什么时候选 Next.js

以下场景，Next.js 是合理选项：

- 页面需要被搜索引擎抓到。内容站、电商、文档、博客。首屏 HTML 由服务器发出来，爬虫不用执行 JavaScript。
- 首屏速度直接影响业务指标。服务端直接给 HTML，不需要等 JS 下载执行。
- 需要服务端逻辑，但不想再维护一个独立后端。读数据库、调第三方、做鉴权，都可以写在同一个项目里。
- 团队以前端为主。一套 TypeScript 代码同时承担页面和接口，不用招后端也能做出可上线的产品。
- 需要一个带登录、权限、文件、支付的管理后台。这类应用的绝大部分页面是“查询 + 表单”，正好是 RSC 加 Server Actions 擅长的形态。

补充一句判断标准：如果页面上的内容依赖数据库，又要被外部访问，选 Next.js 通常比“Vite + 自建 API”省事。

## 1.6 什么时候不选

- 纯客户端应用。桌面端套壳（Electron、Tauri）、强交互编辑器、内部工具。这类应用不需要首屏 HTML，服务端渲染只会增加复杂度。
- 内容以静态文件为主。个人博客、文档站。Astro 的产物更小，构建更快。
- 后端逻辑重。有复杂事务编排、消息、定时、多服务调用。更适合独立后端（NestJS、Go、Java），前端只做展示。
- 只需要几个组件。引一个框架不划算。

常见方案对比：

| 方案 | 路由 | 首屏 HTML | 接口 | 适合 |
| --- | --- | --- | --- | --- |
| Vite + React | 第三方库 | 无（CSR） | 另建服务 | 内部系统、SPA |
| Next.js App Router | 文件系统 | 有 | route.ts 同项目 | 内容站、后台、全栈产品 |
| React Router 框架模式 | 配置式 | 有 | 需自行组织 | 已有服务端，想要 SSR |
| Astro | 文件系统 | 有 | 有限 | 内容站、文档站 |
| 前后端分离 | 由后端决定 | 视方案 | 独立后端 | 后端复杂、多人分工 |

拿不准的时候，按顺序问五个问题：

1. 页面内容需要被搜索引擎或社交平台抓取吗？需要，排除纯 CSR 方案。
2. 首屏数据依赖登录用户吗？依赖，主体就是按请求渲染；不依赖，优先静态生成。
3. 服务端逻辑复杂到需要独立进程、独立扩缩容吗？需要，选前后端分离，Next.js 只做前端。
4. 团队有后端人力吗？没有，把接口放进 `route.ts` 更省沟通成本。
5. 内容几乎是静态文档吗？是，Astro 之类的静态站生成器更轻。

五条都能落在“用 Next.js”上，再往下读。有一条落在别的方案上，那个方案大概率更合适。

还有一层容易混淆的关系：Next.js 现在有两套路由，`app/`（App Router）和 `pages/`（Pages Router）。新项目用 `app/`。`pages/` 仍然支持，官方只做维护。两套可以共存，但不能有同名路由。第 38 章讲两者的差异和迁移顺序。

## 1.7 项目文件结构

用 `create-next-app` 生成的典型结构：

```text
my-app/
├── app/
│   ├── layout.tsx          根布局，必须有，包含 <html> 和 <body>
│   ├── page.tsx            首页，对应 /
│   ├── globals.css
│   ├── dashboard/
│   │   ├── layout.tsx      只作用于 /dashboard 及其子路由
│   │   ├── page.tsx        对应 /dashboard
│   │   └── settings/
│   │       └── page.tsx    对应 /dashboard/settings
│   └── api/
│       └── health/
│           └── route.ts    对应 GET /api/health
├── public/                 静态文件，按路径直接访问
├── src/                    可选，代码放这里时 app/ 也在 src/ 下
├── next.config.ts          构建与运行时配置
├── proxy.ts                请求拦截，可选
├── package.json
└── tsconfig.json
```

约定文件的对应关系：

约定文件各有分工，一个目录里放哪一个，就多一种行为：

- `layout.tsx`：包住下级页面，切换路由时不重新挂载，用来放导航、侧栏、全局样式。
- `page.tsx`：页面本体。只有它让一个目录成为路由。
- `loading.tsx`：该段路由的加载态，自动包一层 Suspense，服务端还在查数据时先显示它。
- `error.tsx`：该段路由的错误边界，必须是客户端组件，接收 `error` 和 `reset`。
- `not-found.tsx`：该段路由的 404 页面，由 `notFound()` 触发。
- `route.ts`：HTTP 接口，和 `page.tsx` 不能放在同一目录。
- `template.tsx`：和 layout 相似，但每次导航都重新挂载，适合需要重置状态的场景。
- `proxy.ts`：请求进入前的拦截，放在项目根或 `src/` 下，只能做轻量判断。

`app/` 下放一个没有 `page.tsx` 的文件夹，不会产生路由。放一个 `page.tsx`，路径就存在。

`public/` 下的文件按路径直接访问，`public/logo.png` 对应 `/logo.png`。它不参与打包，也不做压缩和哈希，适合放图标、验证文件、robots.txt。用户上传的文件不要放这里：构建产物是只读的，多实例部署下各机器也不共享。

`next.config.ts` 管构建和运行时行为，常用的几项是：`images.remotePatterns`（允许的图片域名）、`serverExternalPackages`（不打包的原生依赖）、`cacheComponents`（开启 Cache Components）、`output`（导出方式，自托管部署要用 `standalone`）。配置项写错不会报错，只会静默失效，改完记得看构建输出。

用不用 `src/` 都能跑。用 `src/` 时，`app/`、`components/`、`lib/` 都在它下面，根目录只剩配置文件和 `public/`。团队项目建议用，避免根目录堆满业务目录。

目录名还有几种写法，直接影响 URL 形态：

目录名还有几种写法，直接影响 URL 形态和布局归属：

- `[slug]`：单个动态段，`app/teams/[slug]/page.tsx` 匹配 `/teams/acme`，参数从 `params.slug` 取。
- `[...slug]`：捕获剩余所有层级，`app/docs/[...path]` 能匹配 `/docs/a/b/c`。
- `[[...slug]]`：可选捕获，连根路径也匹配，常用于同一套布局下切换标签页。
- `(group)`：路由组，只影响布局归属，不出现在 URL 里，`app/(marketing)/about` 仍是 `/about`。
- `_folder`：私有目录，不参与路由，用来放组件、工具函数、测试。
- `@name`：平行路由插槽，`app/@modal` 可以在同一层级并排渲染多个页面。

## 1.8 从零跑起来

```bash
pnpm create next-app@latest my-app
# 依次选：TypeScript、ESLint、Tailwind、src/ 目录、App Router、Turbopack、别名 @/*
cd my-app
pnpm dev
```

打开 `http://localhost:3000`，看到默认页。

改 `app/page.tsx`：

```tsx
// app/page.tsx
export default function Home() {
  return <h1>我的第一个 Next.js 页面</h1>;
}
```

保存后浏览器自动刷新。查看网页源代码，`<h1>` 在初始 HTML 里，不是由 JavaScript 插入的。

加一个页面：

```tsx
// app/about/page.tsx
export default function About() {
  return <p>关于页</p>;
}
```

访问 `/about` 能打开，访问 `/about/xxx` 是 404。

加一个接口：

```ts
// app/api/health/route.ts
export async function GET() {
  return Response.json({ ok: true });
}
```

```bash
curl -s localhost:3000/api/health
# {"ok":true}
```

构建：

```bash
pnpm build
```

输出里每个路由前面有一个符号，`○` 是静态预渲染，`ƒ` 是按请求渲染，`●` 是带 `generateStaticParams` 的预渲染。

`pnpm dev` 时，Next.js 用 Turbopack 按需编译：访问哪个路由才编译哪个，所以第一次打开某个页面会慢一两秒，之后是热更新。构建产物在 `.next/`，这个目录不要提交到仓库。

`pnpm build` 会先做一次类型检查（如果项目开了 TypeScript），再逐路由预渲染。构建失败最常见的原因是某段代码在构建时执行了、而它需要运行时才有的东西，比如读 `cookies()` 却没被 Suspense 包住，或者顶层就 `fetch` 了一个内网地址。

## 1.9 一次请求在 Next.js 里的顺序

以 `GET /dashboard` 为例：

1. 请求进入 `proxy.ts`（如果存在）。这里可以改写请求、重定向、直接返回响应。
2. Next.js 按文件系统匹配路由，找到 `app/dashboard/page.tsx` 和它上层的 `app/layout.tsx`。
3. 执行服务端组件。这里的 `await`、数据库查询、`fetch` 都在服务器上跑。
4. 渲染结果转成 RSC Payload，与 HTML 一起流式返回。
5. 浏览器先显示 HTML，再下载 JS，完成 hydration，页面变为可交互。
6. 之后点击 `<Link>`，只请求 RSC Payload，不重新下载整页 JS。

第 4 步里同时返回两种东西：HTML 给浏览器首屏和爬虫，RSC Payload 给客户端做后续更新。这个双产物模型是 App Router 运行时的核心，第 3 章会逐段展开。

理解这条链路，后面讲缓存、流式、预取、错误边界时才有落点。

## 1.10 本书要做的项目与版本基线

全书围绕一个项目推进：teamstack，一个多租户团队管理后台。功能包括登录、团队与成员、邀请、文件上传、订阅付费、邮件、定时任务、对外 API、审计日志。

选这个题目的原因：它覆盖了企业项目里最常被问到的能力，每一项都能落到具体代码，而不是玩具页面。

项目由十块组成，正好对应全书的部：

1. 工程骨架与路由渲染（第 2–7 章）。
2. 数据库、迁移、事务、缓存（第 8–14 章）。
3. 登录、会话、权限、行级安全（第 15–21 章）。
4. 团队、文件、图片、支付、邮件、定时任务（第 22–27 章）。
5. 实时、搜索、对外 API、客户端数据（第 28–32 章）。
6. 呈现质量：SEO、图片字体、可访问性、流式渲染（第 33–37 章）。
7. 兼容与质量：迁移、测试、容量、可观测、性能、依赖（第 38–45 章）。
8. 上线与交付：自托管、Vercel、CI、备份、成本、合规、清单（第 46–53 章）。

每一块都能单独跑起来，也都能删掉。第 8 章的建表脚本是全书的数据契约，后面的模块都在这套表上长。

版本基线：

| 项 | 版本 |
| --- | --- |
| Next.js | 16.4.x |
| React | 19.3 |
| TypeScript | 5.x |
| Tailwind CSS | 4.3 |
| Node.js | >= 20.9 |
| 包管理器 | pnpm |
| 数据库 | PostgreSQL 16（本地用 Supabase CLI 起，线上用 Supabase 托管） |

版本会变。本书写作时逐条核对了官方文档，容易变化的行为在正文里标了出处；确实没验证过的命令标“未验证”。

## 1.11 术语表

后面每一章都会用到这些词，先统一说法。

- App Router：`app/` 目录下的路由方案，基于文件系统和 React Server Components。
- Pages Router：`pages/` 目录下的旧路由方案，靠 `getServerSideProps` 一类函数取数据。
- RSC（React Server Component）：只在服务端执行的组件，产物里没有它的 JS。
- 客户端组件：带 `"use client"` 的组件，会在服务端渲染首屏，同时打包进浏览器。
- hydration：浏览器拿到 HTML 后，把事件和状态挂上去，让页面可交互的过程。
- RSC Payload：服务端组件树的序列化结果，客户端用它更新页面，比整页 HTML 小。
- 路由段（segment）：`app/` 下的一个文件夹，对应 URL 的一段。
- 布局（layout）：包住下级页面的组件，导航时不重新挂载。
- Server Action：带 `"use server"` 的函数，可以从客户端直接调用，在服务端执行。
- Route Handler：`route.ts` 里导出的 HTTP 处理函数，用来做接口。
- proxy：16.x 的请求拦截层，取代原来的 `middleware`。
- 静态生成 / 按请求渲染 / 增量再生成：三种 HTML 生成时机，见 1.4 节。
- cache tag：给缓存数据打的标签，用于按标签失效。
- revalidate：让缓存失效或过期的动作，有按路径和按标签两种。
- 多租户：一套应用服务多个组织，数据按组织隔离。本书的项目就是这种形态。

## 1.12 检查点

做完这一节，你应该能自己回答下面几条：

1. `pnpm dev` 能起来，`http://localhost:3000` 显示默认页，控制台无报错。
2. 新建 `app/about/page.tsx` 后 `/about` 可访问；不建文件时访问 `/about` 得到 404。
3. `pnpm build` 成功，输出里能看到 `○ /` 和以 `ƒ` 开头的动态路由。
4. 查看网页源代码，首页的文本出现在 HTML 里；给某个组件加 `"use client"` 后，用 `curl` 拿到的 HTML 里那段内容变成空容器或骨架。
5. `curl -s localhost:3000/api/health` 返回 JSON。
6. 能说清楚 `app/`、`public/`、`next.config.ts`、`proxy.ts` 各自的作用。

任一条做不到，回到对应小节重做。

## 1.13 常见错误

1. 在服务端组件里用 `useState`

报错大意是 `You're importing a component that needs useState`。服务端组件不能有状态和事件，需要的部分拆成客户端组件并加 `"use client"`。

2. 加了 `onClick` 却没加 `"use client"`

构建直接失败，或者运行时报事件处理器不能传给服务端组件。交互逻辑必须放在客户端组件里。

3. 目录建了，但没有 `page.tsx`

`app/dashboard/` 存在不代表 `/dashboard` 存在，必须有 `page.tsx`。这类 404 最常见的原因是文件名写成了 `Page.tsx` 或 `index.tsx`。

4. 在客户端组件里读服务端环境变量

只有 `NEXT_PUBLIC_` 前缀的变量会进入浏览器产物，其余在客户端读到 `undefined`。带密钥的变量只能在服务端组件、Server Action、route handler 里用。

5. 同时保留 `pages/` 和 `app/` 的同名路由

两套路由同时存在会冲突。迁移期间保留 `pages/` 可以，但不能有同名路径。

6. 同步访问 `params`、`cookies()`

16.x 起这些都是异步的。写成 `params.slug` 拿到的是 Promise，页面会渲染成 `[object Promise]`。要 `await params`。

## 1.14 这一章在做什么

这一章只建立地图：Next.js 是什么、补了 React 的哪几层、有哪些固定套路、什么项目适合用、代码放哪里。

接下来每一章都按“这层能力解决什么问题、怎么写、边界在哪、什么时候不该用”展开。第 2 章从项目结构和工程配置开始，先把工程跑顺，再谈功能。
