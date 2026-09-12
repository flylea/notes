# 31 · 测试

> **一句话结论**：**Vitest 不支持异步服务端组件**——这不是配置问题，是工具链还没跟上 RSC。官方给的建议很直接：异步组件用 E2E 测。所以正确的分层是「数据逻辑抽成纯函数用 Vitest 测 → 同步组件用 RTL 测 → 异步组件和真实交互用 Playwright 测」，而不是硬凑一套单测覆盖所有东西。

## 最小可运行示例

```bash
# 单元测试 + 组件测试
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
  },
})
```

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:run": "vitest run",
    "e2e": "playwright test"
  }
}
```

```tsx
// app/page.tsx
import Link from 'next/link'

export default function Page() {
  return (
    <div>
      <h1>Home</h1>
      <Link href="/about">About</Link>
    </div>
  )
}
```

```tsx
// __tests__/page.test.tsx
import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import Page from '../app/page'

test('Page', () => {
  render(<Page />)
  expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeDefined()
})
```

```bash
pnpm test        # watch 模式
pnpm test:run    # 跑一次，CI 用这个
```

`vite-tsconfig-paths` 让 Vitest 读 `tsconfig.json` 的 `paths`，否则 `@/components/...` 这类别名在测试里解析不了。`environment: 'jsdom'` 提供 `document`、`window` 等浏览器 API。

## 为什么异步服务端组件测不了

React Testing Library 的工作方式是：把组件渲染到 jsdom 的 DOM 上，然后断言 DOM 内容。它依赖 React 的客户端渲染路径（`createRoot`）。

异步服务端组件走的是完全不同的路径：React 的 Flight 协议在服务端把它 `await` 成序列化载荷，再由客户端 reconciler 消费。这条路径需要：

1. 一个真正的服务端渲染环境
2. 请求上下文（`cookies()`、`headers()` 要能拿到当前请求）
3. Flight 序列化/反序列化链路

Vitest 在 jsdom 里跑，这三样都没有。`cookies()` 会直接抛错，因为不存在请求上下文。

所以官方的表述是「Vitest 目前不支持异步服务端组件」，并给出建议：**用 E2E 测试覆盖异步组件**。

## 分层策略

| 层 | 测什么 | 工具 |
|---|---|---|
| 数据逻辑 | 查询、转换、权限过滤、缓存键计算 | Vitest（纯函数，不渲染） |
| 同步组件 | 客户端组件、纯展示服务端组件 | Vitest + RTL |
| 配置 | `headers` / `redirects` / `rewrites` | `next/experimental/testing/server` |
| 异步组件与真实交互 | 完整页面、导航、表单提交、流式加载 | Playwright |

核心思路是**把「取数据」和「渲染数据」拆开**，让每一半都能被测试。

## 策略一：数据逻辑抽成纯函数

```ts
// lib/posts.ts
import 'server-only'

export type Post = {
  id: string
  title: string
  authorId: string
}

// 纯函数：可单测，不需要请求上下文
export function canSeePost(viewerId: string | null, post: Post): boolean {
  return viewerId === post.authorId
}

export function toPostSummary(post: Post) {
  return { id: post.id, title: post.title }
}
```

```ts
// lib/posts.test.ts
import { describe, expect, test } from 'vitest'
import { canSeePost, toPostSummary, type Post } from './posts'

const post: Post = { id: '1', title: 'Hello', authorId: 'u1' }

describe('canSeePost', () => {
  test('作者可见', () => {
    expect(canSeePost('u1', post)).toBe(true)
  })

  test('未登录不可见', () => {
    expect(canSeePost(null, post)).toBe(false)
  })
})

test('toPostSummary 不泄漏 authorId', () => {
  expect(toPostSummary(post)).toEqual({ id: '1', title: 'Hello' })
})
```

这一层价值最高：授权判断、字段裁剪、DTO 映射这些**最容易出安全问题**的逻辑，恰好都是纯函数，也恰好都能用最快的方式测。

## 策略二：mock 数据层后调用异步组件

如果必须给异步组件本身写单测，可以把它当普通异步函数调用，再渲染返回的 React 元素：

```tsx
// app/posts/page.tsx
import { getPosts } from '@/lib/data'

export default async function Page() {
  const posts = await getPosts()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```

```tsx
// __tests__/posts-page.test.tsx
import { expect, test, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// 必须 mock 数据层：它内部可能用 cookies()，在 jsdom 里会抛错
vi.mock('@/lib/data', () => ({
  getPosts: vi.fn(),
}))

import { getPosts } from '@/lib/data'
import Page from '@/app/posts/page'

beforeEach(() => {
  vi.mocked(getPosts).mockReset()
})

test('渲染帖子标题', async () => {
  vi.mocked(getPosts).mockResolvedValue([
    { id: '1', title: '第一篇' },
    { id: '2', title: '第二篇' },
  ])

  // 直接 await 组件函数，拿到已解析的 React 元素
  render(await Page())

  expect(screen.getByText('第一篇')).toBeDefined()
  expect(screen.getByText('第二篇')).toBeDefined()
})
```

**这个做法的限制必须说清楚**：

- `render(await Page())` 拿到的是**已经求值完的元素树**，随后按客户端组件渲染。组件内如果 import 了 `next/headers` 并调 `cookies()`，mock 不掉就会抛错。
- 测不到 `<Suspense>` 的流式行为——你已经把 Promise await 完了，流式被压平了。
- 测不到 `loading.tsx`、`error.tsx` 这类框架层约定的参与。
- 组件签名里的 `params` / `searchParams` 是 Promise，要手动传：`await Page({ params: Promise.resolve({ slug: 'x' }) })`。

所以这个做法适合「组件逻辑本身有分支、需要快速反馈」的场景，不适合当成主要手段。**它测的不是真实渲染路径**，别把它当端到端保证。

## 策略三：Playwright 做 E2E

```bash
pnpm create playwright
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

```ts
// tests/posts.spec.ts
import { expect, test } from '@playwright/test'

test('帖子列表渲染出数据', async ({ page }) => {
  await page.goto('/posts')
  await expect(page.locator('li')).toHaveCount(3)
})

test('从首页导航到关于页', async ({ page }) => {
  await page.goto('/')
  await page.click('text=About')
  await expect(page).toHaveURL('/about')
  await expect(page.locator('h1')).toContainText('About')
})
```

配了 `webServer` 之后 Playwright 会自己拉起服务器并等它就绪，不用手动开终端。**生产构建优先**：`pnpm build && pnpm start` 跑的是真实产物，比 dev server 更接近线上行为——dev 下有 HMR、有未压缩的代码、有额外的调试开销，某些问题在 dev 下不复现。

Playwright 默认跑 Chromium、Firefox、WebKit 三个引擎。CI 里先装依赖：

```bash
npx playwright install-deps
```

默认是 headless 模式，CI 友好。

**异步服务端组件的测试在这里是自然的**：Playwright 发真实 HTTP 请求，服务端完整执行 `await`、读 cookie、查库、流式返回。你不需要关心 Flight 协议，只需要断言最终 HTML。

## 测 `next.config` 的 headers / redirects / rewrites

Next.js 从 15.1 起提供 `next/experimental/testing/server`：

```ts
// __tests__/redirects.test.ts
import { expect, test } from 'vitest'
import { unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'

test('旧路径重定向到新路径', async () => {
  const response = await unstable_getResponseFromNextConfig({
    url: 'https://example.com/test',
    nextConfig: {
      async redirects() {
        return [{ source: '/test', destination: '/test2', permanent: false }]
      },
    },
  })

  expect(response.headers.get('location')).toBe('https://example.com/test2')
})
```

配套还有 `getRedirectUrl` 工具。

**限制**：这个函数只跑 `next.config` 里的 `headers` / `redirects` / `rewrites`，**不考虑 Proxy 和文件系统路由**。所以它的结论和真实生产行为可能不一致——用它做「配置写对了没」的快速校验，别用它替代 E2E。

## 常见坑

- **现象**：单测里 `render(await Page())` 报 `cookies was called outside a request scope`。
  **原因**：组件内调了 `next/headers` 的 `cookies()`，jsdom 里没有请求上下文。
  **解法**：`vi.mock` 掉数据层，让组件不碰 `cookies()`。或者干脆把这条用例挪到 Playwright。

- **现象**：单测里 `render(await Page())` 报 `async/await is not yet supported in Client Components`。
  **原因**：被测组件是客户端组件却被写成了 `async`。客户端组件不支持 `async`。
  **解法**：修组件本身——客户端组件里用 `useEffect` + state，或者把异步逻辑挪到服务端组件里。

- **现象**：测试能过，但线上白屏。
  **原因**：`render(await Page())` 压平了流式渲染，`<Suspense>` 边界后的错误路径、`loading.tsx` 的参与都没被覆盖。
  **解法**：关键页面必须有 Playwright 用例，别只靠组件单测。

- **现象**：`@/components/button` 在测试里解析失败。
  **原因**：Vitest 不自动读 `tsconfig.json` 的 `paths`。
  **解法**：装 `vite-tsconfig-paths` 并加进 `plugins`。

- **现象**：Playwright 测的页面数据和本地 dev 看到的不一样。
  **原因**：`webServer` 跑的是生产构建，缓存行为（ISR、`"use cache"`）和 dev 完全不同——dev 下页面始终按需渲染且不缓存。
  **解法**：这是预期行为。需要确定性数据就在测试里用固定的 seed 或 mock 接口，别依赖真实外部 API。

- **现象**：CI 里 Playwright 报缺浏览器依赖。
  **原因**：Playwright 的浏览器二进制和系统依赖没装。
  **解法**：CI 里加 `npx playwright install-deps`（以及 `npx playwright install`）。

## 旧写法 vs 新写法

| 场景 | 旧写法 | 16 写法 |
|---|---|---|
| 单元测试框架 | Jest + `next/jest` | **Vitest + `vite-tsconfig-paths`** |
| 异步服务端组件 | 尝试用 Jest/RTL 硬测 | **改用 Playwright E2E**（官方建议） |
| E2E 环境 | 常跑 dev server | **`pnpm build && pnpm start`** 生产产物 |
| 配置测试 | 手工起服务请求 | `unstable_getResponseFromNextConfig` |
| 路由参数类型 | 手写泛型 | `PageProps<'/path'>`（见第 29 章） |

## API / 配置速查

| 包 | 用途 |
|---|---|
| `vitest` | 测试 runner |
| `@vitejs/plugin-react` | JSX 转换 |
| `jsdom` | 浏览器环境模拟 |
| `@testing-library/react` | 组件渲染与查询 |
| `@testing-library/dom` | DOM 查询 |
| `vite-tsconfig-paths` | 读取 `tsconfig.json` 的 `paths` |
| `@playwright/test` | E2E |

| 工具函数 | 来源 | 作用 |
|---|---|---|
| `unstable_getResponseFromNextConfig` | `next/experimental/testing/server` | 跑 `next.config` 的路由规则 |
| `getRedirectUrl` | 同上 | 取重定向目标 URL |
| `vi.mock` | `vitest` | mock 模块 |
| `vi.mocked` | `vitest` | 给 mock 加类型 |
| `render` / `screen` | `@testing-library/react` | 渲染与断言 |
| `expect(page).toHaveURL` | `@playwright/test` | 断言导航结果 |

| 分层 | 覆盖内容 | 不覆盖 |
|---|---|---|
| Vitest 纯函数 | 授权、DTO、缓存键 | 渲染 |
| Vitest + RTL | 同步组件、客户端交互 | 异步服务端组件、流式 |
| `next/experimental/testing/server` | `next.config` 规则 | Proxy、文件系统路由 |
| Playwright | 真实异步渲染、导航、流式 | 极慢，不适合覆盖所有分支 |

## 延伸阅读

- [官方文档：Testing 总览](https://nextjs.org/docs/app/guides/testing)
- [官方文档：Vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- [官方文档：Playwright](https://nextjs.org/docs/app/guides/testing/playwright)
- [官方文档：Jest](https://nextjs.org/docs/app/guides/testing/jest)
- [官方文档：Cypress](https://nextjs.org/docs/app/guides/testing/cypress)
- [官方示例：with-vitest](https://github.com/vercel/next.js/tree/canary/examples/with-vitest)
- [官方示例：with-playwright](https://github.com/vercel/next.js/tree/canary/examples/with-playwright)
- [Vitest 配置文档](https://vitest.dev/config/)
- [React Testing Library 文档](https://testing-library.com/docs/react-testing-library/intro/)
