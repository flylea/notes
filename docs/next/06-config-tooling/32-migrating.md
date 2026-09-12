# 32 · 版本迁移（13/14 → 16）

> **一句话结论**：跑 codemod 能解决大约七成的机械改名，但**它不会跑完所有迁移**——`upgrade` codemod 明确不包含异步 Request API 迁移，那一项必须单独执行。剩下三成是 codemod 无法自动化的语义变更：`cacheComponents` 的缓存模型、`runtime = 'edge'` 的弃用、Proxy 的职责边界。别指望一条命令升完。

## 最小可运行示例

```bash
# 0. 先确保工作区干净，codemod 会改文件
git status

# 1. 主升级 codemod（config、lint、proxy、unstable_ 前缀、experimental_ppr）
npx @next/codemod@canary upgrade latest

# 2. 异步 Request API（必须单独跑，upgrade 不含这一步）
npx @next/codemod@canary next-async-request-api .

# 3. 如果还在用 next lint
npx @next/codemod@canary next-lint-to-eslint-cli .

# 4. 如果 turbopack 配置还在 experimental 下
npx @next/codemod@latest next-experimental-turbo-to-turbopack .

# 5. 检查
pnpm install
pnpm next typegen && tsc --noEmit
pnpm build
```

不要一次跑完所有 codemod 再统一验证。**每跑一个就提交一次**——出问题时能精确知道是哪个 codemod 改坏的，也能单独回滚。

## codemod 执行顺序与各自的职责

| 顺序 | 命令 | 解决什么 |
|---|---|---|
| 1 | `@next/codemod@canary agents-md` | 生成 `AGENTS.md`，让 AI 编码助手按 16 的 API 写代码 |
| 2 | `@next/codemod@canary upgrade latest` | 主力：改 `next.config` 的 turbopack 位置、`next lint` → ESLint CLI、`middleware` → `proxy`、去掉 `unstable_` 前缀、删掉 `experimental_ppr` |
| 3 | `@next/codemod@canary next-async-request-api .` | 给 `params` / `searchParams` / `cookies()` / `headers()` / `draftMode()` 补 `await` |
| 4 | `@next/codemod@canary next-lint-to-eslint-cli .` | 旧 ESLint 配置转 Flat Config，脚本从 `next lint` 改成 `eslint` |
| 5 | `@next/codemod@latest next-experimental-turbo-to-turbopack .` | `experimental.turbo` → 顶层 `turbopack` |

顺序不是随意的。第 2 步会重写 `next.config`，第 5 步也改同一份文件——先跑第 5 步再跑第 2 步，第 2 步可能基于已改过的结构再改一次。**主升级放前面，专项迁移放后面**，让每个 codemod 面对的都是它预期的输入结构。

第 1 步的 `agents-md` 值得单独说。它生成一份给 AI 助手看的说明文件，同时生成引用它的 `CLAUDE.md`。作用是让助手知道当前装的是 16，而不是按训练数据里的 13/14 写代码。升级期间代码变动大，助手跟着给出旧写法会显著增加返工。

### 为什么 `upgrade` 不含异步 API 迁移

异步 API 迁移（`next-async-request-api`）的改动面太广——它会动几乎所有含 `params` / `searchParams` 的文件，而且部分改动需要人判断（比如 `params` 被解构后传给了别的函数，是就地 await 还是改调用方签名）。把它塞进 `upgrade` 会让「跑一条命令升级完」变成「跑一条命令产生几百个需要人肉 review 的 diff」。

所以官方把它拆成独立步骤，让你能单独控制节奏：先跑 `upgrade` 把机械部分做完并验证通过，再单独处理异步 API。

## 异步 Request API 迁移

这是影响面最广的一项。

| 旧（同步） | 新（必须 await） |
|---|---|
| `params` | `await params` |
| `searchParams` | `await searchParams` |
| `cookies()` | `await cookies()` |
| `headers()` | `await headers()` |
| `draftMode()` | `await draftMode()` |

```tsx
// app/blog/[slug]/page.tsx —— 迁移前
export default function Page({ params }: { params: { slug: string } }) {
  return <h1>{params.slug}</h1>
}
```

```tsx
// app/blog/[slug]/page.tsx —— 迁移后
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <h1>{slug}</h1>
}
```

15 引入这些 API 的异步版本时保留了同步兼容层，16 把兼容层**完全移除**了。所以升级到 16 时这些调用会直接失效，不是警告。

受影响的位置比想象中多——不只是 `page.tsx`：

- `layout.tsx` / `page.tsx` / `route.ts` / `default.tsx` 的 `params`
- `page.tsx` 的 `searchParams`
- 元数据图像路由：`opengraph-image` / `twitter-image` / `icon` / `apple-icon` 的 `params` 和 `id`
- `generateSitemaps` 返回的 `id`

元数据图像的 `params` 和 `id` 现在都是 Promise，但 `generateImageMetadata` 接收的仍是同步 `params`。这个不对称容易搞混：

```tsx
// app/blog/[slug]/opengraph-image.tsx
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return new ImageResponse(<div>{slug}</div>)
}
```

`sitemap` 函数收到的 `id` 也是 Promise：

```ts
// app/sitemap.ts
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }]
}

export default async function sitemap({ id }: { id: Promise<number> }) {
  const resolvedId = await id
  return [{ url: `https://example.com/page-${resolvedId}` }]
}
```

配套变化是**用 `PageProps` 替代手写泛型**。官方推荐用 `next typegen` 生成的全局类型，而不是手写 `{ params: Promise<{ slug: string }> }`——手写类型和文件系统没有关联，路由改名时不会报错。

```bash
pnpm next typegen
```

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条，以及第 29 章的 `PageProps` 用法。

## AMP 支持完全移除

所有 AMP API 和配置项都被移除：

| 已移除 | 说明 |
|---|---|
| `useAmp` | 组件内判断是否 AMP 的 hook |
| `export const config = { amp: true }` | 路由级 AMP 开关 |
| `amp` 相关配置项 | `next.config` 里的 AMP 选项 |

AMP（Accelerated Mobile Pages）是 Google 2016 年推的移动端加速方案，核心做法是限制 HTML/CSS/JS 子集让页面能被极速加载。到 2025 年，Core Web Vitals 已经成为更通用的性能衡量标准，AMP 那套限制的价值大幅下降——它要求你放弃大量现代能力（自定义 JS、部分 CSS 特性），而同样的性能目标现在用 `next/image`、字体优化、流式渲染能更自由地达成。

迁移方式是直接删掉：删 `useAmp` 的 import 和调用，删路由里的 `amp` 配置导出，删 `next.config` 里的 AMP 选项。如果之前靠 AMP 变体做性能优化，改用标准的图片和字体优化手段。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 14 条。

## `runtime = 'edge'` 在 cacheComponents 下弃用

```ts
// app/api/fast/route.ts
export const runtime = 'edge'
```

`runtime` 这个段配置本身还在，默认值是 `'nodejs'`，类型签名是 `'nodejs' | 'edge'`，但 **`'edge'` 已标记弃用**。

弃用的直接原因是 Cache Components：官方明确说它**需要 Node.js runtime**，其他服务端 JS runtime 不保证能工作。Cache Components 依赖 Node 侧的缓存存储、文件系统追踪、以及一些 Node 专有 API，这些在 Edge runtime 里没有等价物。

同一逻辑也适用于 Proxy：`proxy.ts` 的 runtime 固定是 Node.js 且不可配置，想继续用 Edge runtime 必须留在 `middleware.ts`（它仍可用但已废弃，未来会移除）。

迁移动作：

1. 如果用了 `cacheComponents`，删掉所有 `export const runtime = 'edge'`，让路由回到 Node.js。
2. 如果没有用 `cacheComponents` 且依赖 Edge 的低延迟，可以暂时保留，但要把它列入技术债清单——它是通往 `cacheComponents` 路上的阻塞项。

```ts
// app/api/fast/route.ts —— cacheComponents 下的写法
// 删掉 runtime 导出即可，默认就是 nodejs
export async function GET() {
  return Response.json({ ok: true })
}
```

`preferredRegion` 同样已弃用。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 1 条（Proxy）和第 3 条（cacheComponents）。

## 迁移 checklist

按下面顺序逐条过。每条都标注了 `MIGRATION-16.md` 的对应条目——那份文件是全仓库唯一的版本纠错基准，这里不重复解释。

### 阶段一：环境与工具链

- [ ] Node.js 升到 **20.9+**（不再支持 Node 18）—— 第 15 条
- [ ] TypeScript 升到 **5.1.3+**，`@types/react` 升到 18.2.8+ —— 第 15 条
- [ ] 跑 `agents-md` codemod 生成 `AGENTS.md`
- [ ] 跑 `upgrade latest` codemod
- [ ] 跑 `next-async-request-api` codemod
- [ ] 跑 `next-lint-to-eslint-cli` codemod
- [ ] 跑 `next-experimental-turbo-to-turbopack` codemod
- [ ] 每步单独提交，逐步验证

### 阶段二：机械改名

- [ ] `middleware.ts` → `proxy.ts`，导出函数 `middleware` → `proxy` —— 第 1 条
- [ ] `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`
- [ ] `experimental.turbo` → 顶层 `turbopack` —— 第 12 条
- [ ] `unstable_cacheLife` → `cacheLife` —— 第 4 条
- [ ] `unstable_cacheTag` → `cacheTag` —— 第 4 条
- [ ] 删掉 `next.config` 里的 `eslint` 字段 —— 第 13 条
- [ ] `package.json` 里 `next lint` → `eslint` —— 第 13 条
- [ ] 删掉所有 `export const runtime = 'edge'`（若启用 cacheComponents）
- [ ] 删掉所有 `export const experimental_ppr` —— 第 3 条
- [ ] 删掉所有 `useAmp` 与 `amp: true` 配置 —— 第 14 条

### 阶段三：API 签名

- [ ] `await params` —— 第 7 条
- [ ] `await searchParams` —— 第 7 条
- [ ] `await cookies()` —— 第 7 条
- [ ] `await headers()` —— 第 7 条
- [ ] `await draftMode()` —— 第 7 条
- [ ] 元数据图像的 `params` / `id` 加 `await` —— 第 7 条
- [ ] `sitemap` 的 `id` 加 `await` —— 第 7 条
- [ ] 改用 `PageProps` / `LayoutProps` / `RouteContext` 替代手写泛型 —— 第 7 条
- [ ] `revalidateTag('tag')` → `revalidateTag('tag', 'max')` —— 第 5 条

### 阶段四：行为变更

- [ ] 所有平行路由 slot 补 `default.js` —— 第 11 条
- [ ] `images.domains` → `images.remotePatterns` —— 第 9 条
- [ ] `images.qualities` 显式列出需要的档位（默认只剩 `[75]`）—— 第 8 条
- [ ] 本地图带查询串的补 `images.localPatterns` —— 第 8 条
- [ ] `minimumCacheTTL` 从 60 秒变 4 小时，确认图片更新时效可接受 —— 第 8 条
- [ ] 检查 `maximumRedirects` 默认从无限变 3 次 —— 第 8 条
- [ ] `next/legacy/image` → `next/image` —— 第 9 条
- [ ] `devIndicators` 里的 `appIsrStatus` / `buildActivity` / `buildActivityPosition` 移除 —— 附条
- [ ] 需要平滑滚动的话，`<html>` 加 `data-scroll-behavior="smooth"` —— 第 17 条
- [ ] 检查 `next.config.ts` 里依赖 `process.argv` 的副作用 —— 第 16 条
- [ ] Sass 用户：`sass-loader` 升到 v16，检查 `~` 前缀导入 —— 附条

### 阶段五：缓存模型（工作量最大）

- [ ] `experimental.ppr` / `dynamicIO` / `useCache` → `cacheComponents: true` —— 第 3 条
- [ ] 删掉 `dynamic` / `revalidate` / `fetchCache` 段配置（启用 cacheComponents 后移除）
- [ ] 给需要缓存的函数加 `"use cache"` + `cacheLife` + `cacheTag`
- [ ] 给动态内容加 `<Suspense>` 边界
- [ ] 读 cookie 的组件确认落在 `<Suspense>` 边界之后
- [ ] 评估是否需要 `updateTag` / `refresh`（16 新增，仅 Server Actions）—— 第 6 条
- [ ] 评估 `runtime = 'edge'` 残留 —— 第 3 条

### 阶段六：可选能力

- [ ] `next.config.ts` 原生 TS 支持 —— 第 18 条
- [ ] React Compiler（稳定但默认关闭）—— 第 18 条
- [ ] `partialPrefetching`（16.3 新增，需 `cacheComponents`）
- [ ] Next.js DevTools MCP 接入 AI 工作流 —— 第 18 条
- [ ] Build Adapters API（Alpha，平台侧能力）—— 第 18 条

## 常见坑

- **现象**：跑完 `upgrade latest` 后构建报一堆「`params` 是 Promise」的类型错误。
  **原因**：`upgrade` codemod 不包含异步 Request API 迁移。
  **解法**：单独跑 `npx @next/codemod@canary next-async-request-api .`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

- **现象**：`next build` 报错说存在自定义 webpack 配置。
  **原因**：16 的 build 默认用 Turbopack，有 `webpack` 字段就直接失败，这是有意的保护。
  **解法**：迁移到 `turbopack` 字段，或临时 `next build --webpack`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2 条。

- **现象**：`revalidateTag('posts')` 报 TypeScript 错误。
  **原因**：新签名需要第二个参数（cacheLife profile）。
  **解法**：改成 `revalidateTag('posts', 'max')`。如果压制类型错误它仍能跑，但行为等同 `{ expire: 0 }`（立即过期、不走 SWR），是**行为退化**不是「还能用」。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 5 条。

- **现象**：某个平行路由槽位构建失败，提示缺 `default.js`。
  **原因**：16 起所有 slot 必须显式提供 `default.js`，这是硬性构建约束。
  **解法**：给每个 slot 建 `default.tsx`，返回 `null` 或调 `notFound()`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 11 条。

- **现象**：升级后图片质量参数失效，所有图都是同一档。
  **原因**：`images.qualities` 默认从「全允许」收窄到 `[75]`。
  **解法**：在 `next.config.ts` 显式列出，如 `qualities: [50, 75, 100]`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 8 条。

- **现象**：`next dev` 下配置文件的判断逻辑行为变了。
  **原因**：配置文件在 dev 下只加载一次，且 `process.argv` 里不再有 `'dev'`。
  **解法**：改用 `NODE_ENV === 'development'` 或 `phase` 参数。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 16 条。

- **现象**：页面导航时的平滑滚动没了。
  **原因**：16 默认不再覆盖你的 `scroll-behavior`（旧行为会和 `prefers-reduced-motion` 打架）。
  **解法**：需要的话在 `<html>` 上加 `data-scroll-behavior="smooth"`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 17 条。

- **现象**：多实例部署后，调用 `revalidateTag()` 只有部分实例生效。
  **原因**：这是自托管场景的固有问题（默认缓存是每实例内存），不是 16 引入的回归。
  **解法**：实现自定义 `cacheHandler` 并实现 `refreshTags()` 从共享存储同步标签。见第 35、36 章。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| 中间件文件 | `middleware.ts` / `export function middleware` | **`proxy.ts` / `export function proxy`** |
| 打包器 | webpack 默认 | **Turbopack 默认** |
| 缓存开关 | `experimental.ppr` / `dynamicIO` / `useCache` | **`cacheComponents: true`** |
| 路由级 PPR | `export const experimental_ppr = true` | **移除** |
| 缓存 API | `unstable_cacheLife` / `unstable_cacheTag` | **`cacheLife` / `cacheTag`** |
| 失效标签 | `revalidateTag('posts')` | **`revalidateTag('posts', 'max')`** |
| 请求 API | 同步 `params` / `cookies()` | **全部 `await`** |
| 路由参数类型 | 手写泛型 | **`PageProps<'/path'>`** |
| lint | `next lint` | **ESLint CLI** |
| AMP | `useAmp` / `amp: true` | **完全移除** |
| Edge runtime | `export const runtime = 'edge'` | **弃用**（cacheComponents 下不可用） |
| 平行路由 slot | `default.js` 可省 | **必须提供** |
| Node.js | 18 | **20.9+** |
| TypeScript | 4.x | **5.1.3+** |

完整对照见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 全部 18 条。

## API / 配置速查

| codemod | 用途 |
|---|---|
| `@next/codemod@canary agents-md` | 生成 `AGENTS.md` |
| `@next/codemod@canary upgrade latest` | 主升级（不含异步 API） |
| `@next/codemod@canary next-async-request-api .` | 异步 Request API |
| `@next/codemod@canary next-lint-to-eslint-cli .` | `next lint` → ESLint CLI |
| `@next/codemod@latest next-experimental-turbo-to-turbopack .` | turbopack 配置上移 |

| 升级命令 | 作用 |
|---|---|
| `pnpm next upgrade` | 升级 Next.js 并更新内置文档 |
| `pnpm add next@latest react@latest react-dom@latest` | 手动升级 |
| `pnpm create next-app@latest` | 新建项目 |
| `pnpm next typegen && tsc --noEmit` | 验证类型 |

| 16 新增能力 | 涉及章节 |
|---|---|
| React 19.2（View Transitions、`useEffectEvent()`、`<Activity />`） | 03、11 |
| React Compiler（稳定，默认关） | 39 |
| Build Adapters API（Alpha） | 33 |
| Next.js DevTools MCP | 30 |
| `next.config.ts` 原生 TS | 27 |
| 构建输出精简（移除 `size` / `First Load JS`） | 30 |

## 延伸阅读

- [官方文档：Upgrading to Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [官方文档：Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods)
- [官方文档：Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components)
- [官方文档：Next.js 16 发布博客](https://nextjs.org/blog)
- [官方文档：Upgrading 总览](https://nextjs.org/docs/app/getting-started/upgrading)
