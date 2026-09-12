# 19 · 字体优化

> **一句话结论**：`next/font` 在**构建时**把字体文件下载下来自托管，浏览器不会向 Google 发请求；同时它自动生成一个「度量匹配」的回退字体，让字体加载前后文字占位宽度一致，**CLS 归零**。所以字体一律走 `next/font`，不要在 `globals.css` 里写 `@import url('https://fonts.googleapis.com/...')`。

## 最小可运行示例

```tsx
// app/layout.tsx
import { Geist } from 'next/font/google'

const geist = Geist({
  subsets: ['latin'],
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={geist.className}>
      <body>{children}</body>
    </html>
  )
}
```

装完就能用。没有 `@font-face` 声明，没有 `<link rel="preconnect">`，也没有网络请求发往 `fonts.googleapis.com`。

## Google 字体

从 `next/font/google` 导入字体函数，调用后拿到 `.className`：

```tsx
// app/layout.tsx
import { Roboto } from 'next/font/google'

// 非变量字体必须显式指定 weight
const roboto = Roboto({
  weight: '400',
  subsets: ['latin'],
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={roboto.className}>
      <body>{children}</body>
    </html>
  )
}
```

多词字体名用下划线：`Roboto Mono` → `Roboto_Mono`。

### 优先用变量字体

变量字体（variable font）一个文件包含整个字重区间，不需要为每个字重单独下载。所以：

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

// Inter 默认 weight 就是 'variable'，整段 100–900 都在一个文件里
const inter = Inter({ subsets: ['latin'] })
```

相比之下，非变量字体要这样写，每多一个 weight 就多一个文件：

```tsx
// 非变量字体：weight 用数组列出所有需要的字重
const roboto = Roboto({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
})
```

### 额外轴：`axes`

变量字体除了 `wght` 之外可能还有别的轴，默认**不包含**（为了减小体积）。需要时显式声明：

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

// Inter 的斜体轴是 slnt
const inter = Inter({ subsets: ['latin'], axes: ['slnt'] })
```

## 本地字体

用 `next/font/local`，`src` 路径**相对于调用它的那个文件**：

```tsx
// app/layout.tsx
import localFont from 'next/font/local'

const myFont = localFont({
  src: './fonts/my-font.woff2',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={myFont.className}>
      <body>{children}</body>
    </html>
  )
}
```

字体文件可以放在项目的任何位置，包括 `public/` 或与 `app/` 同目录。

### 一个字体系列多个文件

静态字体需要把每个字重、每个字形都列出来：

```tsx
// app/layout.tsx
import localFont from 'next/font/local'

const roboto = localFont({
  src: [
    { path: './fonts/Roboto-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Roboto-Italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/Roboto-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/Roboto-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
})
```

`localFont` 还支持 `declarations`，用来精细调整生成的 `@font-face`：

```tsx
// app/layout.tsx
import localFont from 'next/font/local'

const custom = localFont({
  src: './fonts/custom.woff2',
  declarations: [{ prop: 'ascent-override', value: '90%' }],
})
```

## 零布局偏移是怎么做到的

字体加载会造成布局偏移，原因是**回退字体的字符宽度和真实字体不一样**。浏览器先用系统字体排版，真实字体到了之后重新排版，文字宽度变化 → 元素尺寸变化 → 页面上的其他内容被推动。

`next/font` 的做法是**在构建期计算一个「度量匹配」的回退字体**：

1. 读取真实字体文件的度量信息（ascent、descent、line-gap、字符平均宽度）。
2. 用这些度量生成一个调整过的本地回退字体（通常是调整后的 Arial 或 Times New Roman），并注入 `@font-face`。
3. 字体加载期间，浏览器用这个回退字体渲染，**它的字符占位宽度和真实字体几乎一致**。
4. 真实字体到位后替换，因为宽度一致，不会产生位移。

对应两个配置项：

| 选项 | `next/font/google` 默认 | `next/font/local` 默认 |
|---|---|---|
| `adjustFontFallback` | `true`（自动回退字体） | `'Arial'` |

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

// 关闭自动回退（一般不需要关，除非回退字体本身引发问题）
const inter = Inter({ subsets: ['latin'], adjustFontFallback: false })
```

```tsx
// app/layout.tsx
import localFont from 'next/font/local'

// 本地字体的回退基准可以改成 Times New Roman，或完全关闭
const custom = localFont({
  src: './fonts/custom.woff2',
  adjustFontFallback: 'Times New Roman',
})
```

### `display` 与 `preload`

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // 默认值
  preload: true,   // 默认值
})
```

| 选项 | 默认 | 含义 |
|---|---|---|
| `display` | `'swap'` | 字体未就绪时先用回退字体渲染，到位后替换。可选 `'auto'` / `'block'` / `'swap'` / `'fallback'` / `'optional'` |
| `preload` | `true` | 是否注入 `<link rel="preload">` |

`preload: true` 但没指定 `subsets` 时会收到警告——因为不知道预加载哪个子集。

### 预加载的作用范围

`next/font` 只在**相关路由**上预加载字体：

| 声明位置 | 预加载范围 |
|---|---|
| 唯一页面（`page.tsx`） | 仅该页面对应路由 |
| 布局（`layout.tsx`） | 该布局包裹的所有路由 |
| 根布局 | 所有路由 |

这条规则意味着：**不要为了「图省事」把所有字体都塞进根布局**。每个字体都是一次额外下载，只在真正需要它的那棵子树上声明。

### `fallback`：控制字体完全加载失败时用什么

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  fallback: ['system-ui', 'arial'],
})
```

无默认值。不配置时，浏览器按自己的默认字体栈处理。

## 与 Tailwind 的 CSS 变量集成

`className` 方式在 Tailwind 里不好用——你没法在 utility 里引用一个 `className`。这时用 `variable`：

```tsx
// app/layout.tsx
import { Geist, Geist_Mono } from 'next/font/google'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // 把两个变量挂在 <html> 上，整棵树都能读到
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

然后在 Tailwind 的主题里把字体族指向这两个变量：

```css
/* app/globals.css */
@import 'tailwindcss';

@theme {
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}
```

之后 `font-sans` 和 `font-mono` 这两个 utility 就会用到你声明的字体。这就是 `create-next-app` 默认生成的形态——用 CSS 变量把 `next/font` 和 Tailwind 连起来，而不是在 `tailwind.config.js` 里写死字体名。

也可以用 `className` + 外部 CSS 的方式，效果相同：

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({ variable: '--font-inter' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  )
}
```

```css
/* app/globals.css */
.text {
  font-family: var(--font-inter);
}
```

## 自托管与缓存

`next/font` 把字体文件当作**静态资源**处理：

- Google 字体在**构建时**下载，和本地字体一样自托管，浏览器不向 Google 发请求。这既是性能优化也是隐私优化。
- 字体文件带上内容哈希，放在 `_next/static` 下，可以长期缓存（配合 `Cache-Control: immutable`）。
- 因为文件名带哈希，字体更新后 URL 会变，不存在缓存穿透问题。

所以**不需要**为字体单独配 CDN 或缓存规则。需要长期缓存策略时，给整个 `_next/static` 前缀加就行：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}

export default nextConfig
```

## 常见坑

- **现象**：字体加载过程中页面文字明显「跳」了一下，CLS 指标偏高。
  **原因**：回退字体和真实字体的字符宽度差异大，`adjustFontFallback` 被关掉了，或者用了 `display: 'block'` 让文字延迟出现。
  **解法**：保持 `adjustFontFallback` 默认开启，`display` 保持 `'swap'`。

- **现象**：控制台警告「preload is enabled but no subsets were specified」。
  **原因**：`preload` 默认 `true`，但没告诉框架预加载哪个子集。
  **解法**：加 `subsets: ['latin']`（按实际需要选），或显式 `preload: false`。

- **现象**：首屏同时下载了三四份字体文件，LCP 变差。
  **原因**：把所有字体都声明在根布局里，而根布局覆盖所有路由，于是每个路由都预加载全部字体。
  **解法**：把字体声明下沉到真正用到它的 layout 或 page；非必要的字重删掉。

- **现象**：非变量字体报错，提示缺少 `weight`。
  **原因**：静态字体没有内建字重信息，必须显式声明。
  **解法**：加 `weight: '400'` 或 `weight: ['400', '700']`；能换变量字体就换。

- **现象**：本地字体 `src` 路径一直报找不到文件。
  **原因**：`src` 是**相对于调用 `localFont` 的那个文件**解析的，不是相对项目根目录。
  **解法**：从调用文件出发写相对路径，例如 `app/layout.tsx` 里写 `./fonts/x.woff2` 表示 `app/fonts/x.woff2`。

- **现象**：Tailwind 的 `font-sans` 不生效，还是系统默认字体。
  **原因**：只写了 `variable: '--font-sans'` 但没在 `@theme` 里把 `--font-sans` 指向它；或者忘了把 `font.variable` 挂到祖先元素上。
  **解法**：在 `globals.css` 的 `@theme` 里写 `--font-sans: var(--font-geist-sans), ...`，并确保 `<html>` 或 `<body>` 上有 `${font.variable}`。

- **现象**：在 `globals.css` 里 `@import url('https://fonts.googleapis.com/...')` 仍然能用，为什么不能用。
  **原因**：那是浏览器在运行时向 Google 发请求，会阻塞渲染、破坏隐私、且无法参与构建期优化和 CLS 抑制。
  **解法**：换成 `next/font/google`。构建时下载，自托管。

## API / 配置速查

| 选项 | `next/font/google` | `next/font/local` | 默认值 |
|---|---|---|---|
| `src` | — | **必需** | — |
| `weight` | 可用 | 可用 | 变量字体为 `'variable'` |
| `style` | 可用 | 可用 | `'normal'` |
| `subsets` | 可用 | — | 无 |
| `axes` | 可用 | — | 仅 `wght` |
| `display` | 可用 | 可用 | `'swap'` |
| `preload` | 可用 | 可用 | `true` |
| `fallback` | 可用 | 可用 | 无 |
| `adjustFontFallback` | 可用 | 可用 | `true` / `'Arial'` |
| `variable` | 可用 | 可用 | 无 |
| `declarations` | — | 可用 | 无 |

| 返回值 | 用途 |
|---|---|
| `font.className` | 直接挂到元素上 |
| `font.style` | 行内 style 对象，含 `fontFamily` |
| `font.variable` | 挂到祖先元素，配合 `var(--x)` 使用 |

| 入口 | 导入路径 |
|---|---|
| Google 字体 | `next/font/google` |
| 本地字体 | `next/font/local` |

## 延伸阅读

- [官方文档：Font Optimization（Getting Started）](https://nextjs.org/docs/app/getting-started/fonts)
- [官方文档：next/font API 参考](https://nextjs.org/docs/app/api-reference/components/font)
- [Google Fonts 变量字体列表](https://fonts.google.com/variablefonts)
- [web.dev：Cumulative Layout Shift](https://web.dev/articles/cls)
