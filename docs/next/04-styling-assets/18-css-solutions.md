# 18 · CSS 方案

> **一句话结论**：默认答案就是 **Tailwind v4 + CSS Modules**——全局样式只放真正全局的东西（Tailwind 的基础层、字体变量），组件级样式用 utility class，utility 覆盖不到的地方用 `.module.css`。CSS-in-JS 只在已经有强依赖（MUI、Chakra）时才用，它需要额外的 style registry 且与流式渲染有代价。

## 最小可运行示例

```bash
# Tailwind v4：只需要两个包，没有 tailwind.config.js
pnpm add -D tailwindcss @tailwindcss/postcss
```

```js
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

```css
/* app/globals.css */
@import 'tailwindcss';
```

```tsx
// app/layout.tsx
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/page.tsx
export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold">Hello</h1>
    </main>
  )
}
```

四步就位。注意 **v4 没有 `tailwind.config.js`，也没有 `@tailwind base/components/utilities` 三行指令**——这两点是 v3 教程里最容易被照抄过来的东西。

## 选型矩阵

| 方案 | 作用域 | 运行时开销 | 构建期开销 | 与 RSC / 流式渲染 | 适用场景 |
|---|---|---|---|---|---|
| **全局 CSS** | 全局 | 无 | 无 | 好 | 基础样式、CSS 变量、字体声明 |
| **CSS Modules** | 文件级 | 无 | 极低 | 好 | 组件私有样式、复杂选择器 |
| **Tailwind** | 全局 utility | 无 | 需扫描源码 | 好 | 绝大多数组件样式 |
| **CSS-in-JS** | 组件级 | **有**（运行时注入） | 高 | **需要 registry 适配** | 已有强依赖的存量项目 |
| **Sass** | 同 CSS | 无 | 中（需编译） | 好 | 需要 mixin / 嵌套 / 变量运算的存量代码 |

选型的三条判断：

1. **新项目直接 Tailwind**。它的代价是 HTML 里 class 变长，换来的是不用维护「命名」这件事——命名成本和样式冲突成本都消失了。
2. **CSS Modules 是补充而不是替代**。当 utility 表达不了（多层嵌套选择器、`::before` 定位、第三方组件覆写）时才用。
3. **CSS-in-JS 是负债而不是默认**。它的运行时开销和流式渲染适配成本，只有「项目已经重度依赖某个 CSS-in-JS 组件库」才值得付。

## Tailwind v4 与 v3 的配置差异

这是最容易照抄错的地方。官方在 CSS 文档里对 v3 只留了一个链接：需要更老浏览器支持时才用 v3。

| 项 | v3 | **v4** |
|---|---|---|
| 安装 | `tailwindcss postcss autoprefixer` | `tailwindcss @tailwindcss/postcss` |
| 初始化 | `npx tailwindcss init -p` 生成配置文件 | **不需要**，没有 init |
| 配置文件 | `tailwind.config.js`（必需） | **默认没有**，配置写进 CSS |
| PostCSS 插件 | `tailwindcss` + `autoprefixer` | `@tailwindcss/postcss` |
| 引入方式 | `@tailwind base; @tailwind components; @tailwind utilities;` | `@import 'tailwindcss';` |
| 内容扫描 | 手写 `content: [...]` 路径数组 | **自动检测**，无需配置 |
| 主题定制 | `theme.extend`（JS 对象） | `@theme` 指令（CSS 变量） |
| 浏览器支持 | 更宽（含老浏览器） | 需要现代浏览器 |

v3 的写法长这样，仅供对照，**新项目不要用**：

```js
// tailwind.config.js —— v3 才有这个文件
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
}
```

```css
/* app/globals.css —— v3 的三行指令 */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

v4 里定制主题直接用 CSS 变量，好处是这些值天然可被 JS 读到、也能在普通 CSS 里引用：

```css
/* app/globals.css */
@import 'tailwindcss';

@theme {
  --color-brand: oklch(0.62 0.19 259);
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui;
}
```

之后 `bg-brand`、`font-sans` 这类 utility 就能用，同时 `var(--color-brand)` 在任何地方都可读。

> **要不要退回 v3**：只有当目标浏览器包含较老版本（Tailwind v4 依赖现代 CSS 特性）时才考虑。官方为此单独维护了一页 v3 安装说明。

## 样式加载顺序与优先级

Next.js 在生产构建时会自动**分块合并**（chunk）样式表。顺序规则很简单也很硬：

> **CSS 的最终顺序 = 代码里 import 的顺序。**

```tsx
// app/page.tsx
import { BaseButton } from './base-button'      // 先 import
import styles from './page.module.css'          // 后 import
```

```tsx
// app/base-button.tsx
import styles from './base-button.module.css'
export function BaseButton() {
  return <button className={styles.primary} />
}
```

因为 `<BaseButton>` 先被 import，`base-button.module.css` 会排在 `page.module.css` **之前**。后者能覆盖前者。

### 保持顺序可预测的做法

官方给了一组建议，核心是「别让顺序变成运气」：

- **把 CSS import 收敛到单一入口文件**，不要散落在深层组件里。
- **全局样式和 Tailwind 只在应用根部 import**。
- **不要开启自动排序 import 的 lint 规则**（例如 ESLint 的 `sort-imports`）——它会打乱你精心安排的顺序，进而打乱 CSS 顺序。
- 共享样式抽成共享组件，避免重复 import。
- 需要精细控制分块时用 `next.config.ts` 的 `cssChunking`。

### 开发与生产的差异

- **开发**（`next dev`）：CSS 更新即时生效（Fast Refresh），但**顺序可能与生产不一致**。
- **生产**（`next build`）：所有 CSS 被合并成若干**压缩且按路由分包**的 `.css` 文件，只加载当前路由需要的部分。

所以有一条硬规矩：**CSS 顺序的问题一定要在 `next build` 之后验证**，开发环境看到的顺序不算数。

另一个差异：生产环境下 CSS 在 JS 被禁用时仍能加载；开发环境需要 JS 来支撑 Fast Refresh。

## Sass

装了 `sass` 就自动支持 `.scss` 和 `.sass`：

```bash
pnpm add -D sass
```

```scss
/* app/blog/blog.module.scss */
$gap: 24px;

.blog {
  padding: $gap;

  &:hover {
    background: color-mix(in oklch, currentColor 10%, transparent);
  }
}
```

```tsx
// app/blog/page.tsx
import styles from './blog.module.scss'

export default function Page() {
  return <main className={styles.blog}>...</main>
}
```

`.scss` 是 CSS 的超集，`.sass` 是缩进语法。不确定选哪个就用 `.scss`。

Sass 变量可以导出到 JS，适合做设计 token 的单一来源：

```scss
/* app/variables.module.scss */
$primary-color: #64ff00;

:export {
  primaryColor: $primary-color;
}
```

```tsx
// app/page.tsx
import variables from './variables.module.scss'

export default function Page() {
  return <h1 style={{ color: variables.primaryColor }}>Hello</h1>
}
```

> **注意**：`:export` 属于旧版 CSS Modules 的 ICSS 规则，Turbopack 已不再支持这类遗留特性。新代码建议直接用 CSS 变量 + `@theme`，而不是 `:export`。

### Turbopack 下 `~` 前缀不再支持

这是从 webpack 迁移到 Turbopack 时最容易崩的一处。webpack 的 `sass-loader` 支持用 `~` 表示「从 `node_modules` 解析」：

```scss
/* ❌ 旧写法：webpack 专属，Turbopack 会报解析失败 */
@import '~bootstrap/dist/css/bootstrap.min.css';
```

Turbopack 直接支持从 `node_modules` 解析，不需要 `~`：

```scss
/* ✅ 新写法：去掉 ~ */
@import 'bootstrap/dist/css/bootstrap.min.css';
```

```ts
// next.config.ts
import type { NextConfig } from 'next'

// 暂时改不动导入语句时的过渡方案
const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      '~*': '*',
    },
  },
}

export default nextConfig
```

另外 `sassOptions.functions`（用 JS 定义 Sass 函数）在 Turbopack 下**不支持**——Turbopack 是 Rust 实现，无法在编译期执行任意 JS。需要这个能力只能 `next build --webpack`。

### Sass 的其他 Turbopack 差异

| 项 | webpack | Turbopack |
|---|---|---|
| `~` 前缀 | 支持 | **不支持** |
| `sassOptions.functions` | 支持 | **不支持** |
| 小数精度 | 10 位 | **5 位**（Lightning CSS） |

小数精度差异意味着 `25/17` 在 webpack 下是 `1.4705882353`，在 Turbopack 下是 `1.47059`。如果布局依赖像素级精确计算，可能看到细微位移。

## CSS-in-JS

App Router 里用 CSS-in-JS 需要一个**三步 opt-in**：

1. 一个 **style registry**，收集单次渲染里产生的所有 CSS 规则。
2. `useServerInsertedHTML`，在任何可能用到这些样式的**内容之前**注入规则。
3. 一个**客户端组件**，在首次服务端渲染时用 registry 包住应用。

以 `styled-jsx` 为例（需要 v5.1.0 以上）：

```tsx
// app/registry.tsx
'use client'

import React, { useState } from 'react'
import { useServerInsertedHTML } from 'next/navigation'
import { StyleRegistry, createStyleRegistry } from 'styled-jsx'

export default function StyledJsxRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  // 用惰性初始化，保证 stylesheet 只创建一次
  const [jsxStyleRegistry] = useState(() => createStyleRegistry())

  useServerInsertedHTML(() => {
    const styles = jsxStyleRegistry.styles()
    jsxStyleRegistry.flush()
    return <>{styles}</>
  })

  return <StyleRegistry registry={jsxStyleRegistry}>{children}</StyleRegistry>
}
```

```tsx
// app/layout.tsx
import StyledJsxRegistry from './registry'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html>
      <body>
        <StyledJsxRegistry>{children}</StyledJsxRegistry>
      </body>
    </html>
  )
}
```

**为什么必须有 registry**：服务端渲染是「先算完再一次性吐出 HTML」。如果样式在组件渲染过程中被动态生成，它们必须被收集起来、在内容之前注入 `<head>`——否则浏览器会先渲染无样式内容再突然套上样式（FOUC）。

**为什么 registry 放在客户端组件里**：这样可以在服务端渲染时避免重复生成样式，也避免样式被塞进 Server Component 的 payload 里传输。

已支持的库（`app` 目录下的客户端组件）：`ant-design`、`chakra-ui`、`@fluentui/react-components`、`kuma-ui`、`@mui/material`、`@mui/joy`、`pandacss`、`styled-jsx`、`styled-components`、`stylex`、`tamagui`、`tss-react`、`vanilla-extract`。`emotion` 的支持仍在推进中。

## 外部样式表

第三方包发布的 CSS 可以在 `app` 目录下任意位置 import，包括与组件同目录：

```tsx
// app/layout.tsx
import 'bootstrap/dist/css/bootstrap.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="container">{children}</body>
    </html>
  )
}
```

React 19 也支持直接写 `<link rel="stylesheet" href="..." />`。

## 常见坑

- **现象**：按 v3 教程写了 `@tailwind base; @tailwind components; @tailwind utilities;`，样式全不生效。
  **原因**：v4 改成了 `@import 'tailwindcss';`，三行指令已不存在。
  **解法**：删掉三行，改成一行 `@import 'tailwindcss';`。

- **现象**：装了 Tailwind v4 但找不到 `tailwind.config.js`，以为装错了。
  **原因**：v4 默认没有配置文件，主题定制走 CSS 里的 `@theme`。
  **解法**：不需要该文件。要定制就在 `globals.css` 里写 `@theme { --color-xxx: ...; }`。

- **现象**：Sass 里 `@import '~bootstrap/...'` 报模块找不到。
  **原因**：Turbopack 不支持 webpack 的 `~` 前缀语法。
  **解法**：去掉 `~`，写成 `@import 'bootstrap/dist/css/bootstrap.min.css';`；临时过渡可用 `turbopack.resolveAlias` 把 `~*` 映射到 `*`。

- **现象**：开发环境样式覆盖关系正常，构建后某些样式被错误覆盖。
  **原因**：生产构建会合并分块样式表，顺序由 import 顺序决定，与开发环境可能不同。
  **解法**：用 `next build && next start` 验证；把 CSS import 收敛到单一入口；关掉自动排序 import 的 lint 规则。

- **现象**：全局 CSS 写在某个深层 layout 里，切换路由后旧样式还在。
  **原因**：Next.js 用 React 内置的样式表支持与 Suspense 集成，**当前不会在路由切换时移除样式表**。
  **解法**：全局样式只用于「真正全局」的东西，其余用 CSS Modules 或 Tailwind。

- **现象**：用了 MUI 但页面首屏闪一下无样式内容。
  **原因**：没配 style registry，样式在 hydration 之后才注入。
  **解法**：按上面三步配 registry，并用 `useServerInsertedHTML` 在内容之前注入。

- **现象**：Turbopack 下 Sass 编译出来的像素值位数比 webpack 少。
  **原因**：Lightning CSS 用 5 位小数精度，webpack 用 10 位。
  **解法**：避免依赖超高位小数的计算结果；需要完全一致时用 `next build --webpack`。

- **现象**：`sassOptions.functions` 在 Turbopack 下无效。
  **原因**：Turbopack 的 Rust 架构无法在编译期执行 JS 函数。
  **解法**：改用纯 CSS 方案，或退回 `next build --webpack`。

- **现象**：`.module.css` 里 `composes: xxx from './other.css'` 报错。
  **原因**：Turbopack 里 `.css` 始终被视为全局文件，不能跨文件 `composes`。
  **解法**：把被引用的文件改成 `.module.css`。

## 旧写法 vs 新写法

| 场景 | 旧 | 新（16.3） |
|---|---|---|
| Tailwind 引入 | `@tailwind base/components/utilities` | **`@import 'tailwindcss';`** |
| Tailwind 配置 | `tailwind.config.js` + `content` 数组 | **CSS 内 `@theme`**，内容自动检测 |
| PostCSS 插件 | `tailwindcss` + `autoprefixer` | **`@tailwindcss/postcss`** |
| Sass 从 node_modules 导入 | `@import '~pkg/...'` | **`@import 'pkg/...'`** |
| 打包器 | webpack 默认 | **Turbopack 默认** |

打包器变更详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2 条。

## API / 配置速查

| 文件 | 作用 |
|---|---|
| `app/globals.css` | 全局样式 + Tailwind 入口 |
| `app/registry.tsx` | CSS-in-JS 的 style registry（客户端组件） |
| `postcss.config.mjs` | PostCSS 插件配置 |
| `*.module.css` / `*.module.scss` | 文件级作用域样式 |
| `next.config.ts` 的 `sassOptions` | Sass 编译选项 |
| `next.config.ts` 的 `cssChunking` | CSS 分块策略 |
| `next.config.ts` 的 `turbopack.resolveAlias` | 路径别名（含 `~` 过渡映射） |

| 指令 | 说明 |
|---|---|
| `@import 'tailwindcss';` | Tailwind v4 入口 |
| `@theme { --color-x: ...; }` | 定义设计 token，同时生成 utility 和 CSS 变量 |
| `:export { }` | Sass 变量导出到 JS（遗留特性，Turbopack 不推荐） |

## 延伸阅读

- [官方文档：CSS（Getting Started）](https://nextjs.org/docs/app/getting-started/css)
- [官方文档：Tailwind CSS v3 安装](https://nextjs.org/docs/app/guides/tailwind-v3-css)
- [官方文档：Sass](https://nextjs.org/docs/app/guides/sass)
- [官方文档：CSS-in-JS](https://nextjs.org/docs/app/guides/css-in-js)
- [官方文档：Turbopack 支持范围](https://nextjs.org/docs/app/api-reference/turbopack)
- [官方文档：cssChunking](https://nextjs.org/docs/app/api-reference/config/next-config-js/cssChunking)
