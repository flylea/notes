# 20 · 图片优化

> **一句话结论**：`next/image` 的核心是「按设备生成正确的尺寸」——这靠 `sizes` 告诉浏览器「这个图在不同断点占多宽」，不写 `sizes` 浏览器就会假设 `100vw` 然后下载过大的图。16 的默认值改了一大片（`qualities` 收窄到 `[75]`、`minimumCacheTTL` 提到 4 小时、`maximumRedirects` 限 3 次），`priority` 被 `preload` 取代，`images.domains` 彻底让位给 `remotePatterns`。

## 最小可运行示例

```tsx
// app/page.tsx
import Image from 'next/image'
import hero from './hero.png'

export default function Page() {
  return (
    <Image
      src={hero}
      alt="首页主视觉"
      sizes="(max-width: 768px) 100vw, 50vw"
      style={{ width: '100%', height: 'auto' }}
    />
  )
}
```

静态 import 的好处：`width`、`height`、`blurDataURL` 全部自动提供，不用手写。远程图片则必须手写宽高：

```tsx
// app/page.tsx
import Image from 'next/image'

export default function Page() {
  return (
    <Image
      src="https://s3.amazonaws.com/my-bucket/profile.png"
      alt="作者头像"
      width={500}
      height={500}
      sizes="(max-width: 768px) 100vw, 33vw"
    />
  )
}
```

远程图片还要在 `next.config.ts` 里白名单化，否则构建报错。

## 三个关键 prop

### `sizes`：决定浏览器下哪一档图

`next/image` 会生成一份 `srcset`，包含若干候选尺寸（来自 `deviceSizes` 和 `imageSizes`）。**浏览器需要知道图片在页面上占多宽，才能从 `srcset` 里挑一个**——这个信息就来自 `sizes`。

```tsx
// app/page.tsx
<Image
  src={photo}
  alt="风景"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

读法是：视口 ≤768px 时图宽 = 100vw；768–1200px 时 = 50vw；更大时 = 33vw。

| 场景 | 是否必须写 `sizes` |
|---|---|
| 用了 `fill` | **必须** |
| 用 CSS 让图响应式（`width: 100%`） | **必须** |
| 固定尺寸（如 100×100 头像） | 不需要 |
| 静态 import + 固定尺寸 | 不需要 |

不写 `sizes` 的后果：浏览器默认按 `100vw` 计算，在桌面端会挑一个接近屏幕宽度的大图。一个实际占 300px 的缩略图，可能下载 1920px 的版本。

另一个差异：**没有 `sizes`** 时生成的 `srcset` 很有限（基本是 1x / 2x），适合固定尺寸图；**有 `sizes`** 时才生成完整的宽度候选列表（640w、750w……）。

### `fill`：占满父容器

宽高未知或需要撑满容器时用 `fill`：

```tsx
// app/page.tsx
import Image from 'next/image'
import cover from './cover.jpg'

export default function Page() {
  return (
    // 父元素必须有定位，否则 fill 会相对更外层定位
    <div className="relative h-64 w-full">
      <Image
        src={cover}
        alt="封面"
        fill
        sizes="100vw"
        style={{ objectFit: 'cover' }}
      />
    </div>
  )
}
```

两条硬约束：

1. **父元素必须设 `position: relative` / `fixed` / `absolute`**。`fill` 生成的 `<img>` 是 `position: absolute`，父元素不定位就会跑到更外层去。
2. **必须写 `sizes`**，否则按 `100vw` 算。

`objectFit` 的两种取值：`'cover'` 填满容器并裁剪，`'contain'` 缩小到完整可见。不设的话图片会被拉伸变形。

### `preload`：告诉浏览器这是首屏关键图

```tsx
// app/page.tsx
import Image from 'next/image'
import hero from './hero.png'

export default function Page() {
  return <Image src={hero} alt="主视觉" preload sizes="100vw" />
}
```

`preload` 会在 `<head>` 里插入 `<link rel="preload">`，让这张图和其他关键资源一起被优先拉取。默认 `false`。

**用它的判据**：这张图是 LCP 元素（首屏最大可见图）。不要给多张图都加 `preload`——它们会互相抢带宽。

> **`priority` 已弃用**。16 起 `priority` prop 被标记为 deprecated，改用 `preload`，语义更直白。很多教程还在写 `priority`，能跑，但会有弃用提示。

如果只是想让它早点加载、不需要抢占 `<head>` 预加载，用 `loading` 和 `fetchPriority` 更合适：

```tsx
// app/page.tsx
import Image from 'next/image'
import hero from './hero.png'

export default function Page() {
  return <Image src={hero} alt="主视觉" loading="eager" fetchPriority="high" />
}
```

## 16 的默认值大改

这是升级时最容易「行为静默变化」的一块：

| 配置项 | 旧默认 | **新默认（16）** |
|---|---|---|
| `minimumCacheTTL` | 60 秒 | **14400 秒（4 小时）** |
| `qualities` | `[1..100]` 全允许 | **`[75]`** |
| `imageSizes` | 含 `16` | **移除 16** |
| `maximumRedirects` | 无限 | **最多 3 次** |

对照表见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 8 条，这里只讲影响。

### `qualities` 收窄成 `[75]`：为什么

旧版本里 `quality` 参数是 1–100 的任意整数，任何人都能请求 `?q=99`、`?q=42`、`?q=7`……每一个不同的值都会在服务端触发一次独立的图像编码，并产生一份独立的磁盘缓存。

这意味着：**图片优化接口实际上成了一个「按任意参数生成图片」的公共服务**。恶意用户可以用一串不同的 quality 值把你的磁盘塞满、把 CPU 打满，而这些都是合法的 HTTP 请求，很难在业务层识别。

16 的处理是把可选值收窄成一个白名单：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // 只允许这三档，其余请求直接 400
    qualities: [50, 75, 100],
  },
}

export default nextConfig
```

行为细节：

- 只配置 `qualities: [75]`（默认）时，请求其他 quality 会返回 **400 Bad Request**。
- 组件里写 `quality={80}` 而配置是 `[50, 75, 100]` 时，会被**强制取最接近的允许值**（这里是 75），开发环境会打一条警告。
- 这个选项从 16 起是**必需**的——不显式配置就没有其他质量可选。

一句话：这个改动不是「限制你的能力」，是「防止别人把你的服务当免费图片生成 API 用」。

### `minimumCacheTTL` 从 60 秒提到 4 小时

优化后图片的过期时间取 `minimumCacheTTL` 和上游图片 `Cache-Control` 头里**较大的那个**。

60 秒的旧默认意味着每张图每分钟都要重新优化一次——对流量大的站点，这是纯浪费。4 小时是更贴近「图片内容不常变」这个事实的默认。

要注意的是：**目前没有缓存失效机制**。改了源图但 URL 不变，缓存里的旧版本会一直用到过期。所以要换图，就换 URL：

```tsx
// app/page.tsx
// 版本号写进查询字符串，等于换了 URL，缓存自然失效
<Image src={`/hero.png?v=${buildId}`} alt="主视觉" width={1200} height={630} />
```

### `maximumRedirects` 限 3 次

默认 loader 跟随 HTTP 重定向，最多 3 次。设 `0` 可完全禁用。

这个限制的意义在于：`remotePatterns` 白名单只校验**初始 URL**，重定向后的目标**不再重新校验**。如果允许无限跟随重定向，攻击者可以用一个白名单域名做跳板，跳到你内网或其他任意地址——典型的 SSRF 路径。3 次是「够用但不容易被滥用」的折中。

## `remotePatterns` 取代 `domains`

`images.domains` 从 14 起弃用，16 里新项目不该再用。

| | `domains` | `remotePatterns` |
|---|---|---|
| 能匹配的维度 | 仅主机名 | 协议 + 主机 + 端口 + 路径 + 查询串 |
| 通配符 | 不支持 | 支持（`*`、`**`） |
| 安全粒度 | 粗 | 细 |

`domains: ['assets.acme.com']` 的问题是：只要主机名对得上，**任意路径、任意协议、任意端口**都放行。攻击者可以构造 `https://assets.acme.com/../../internal/secret`，或者利用该域名上的任意一个开放重定向。

`remotePatterns` 让你精确到路径：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        port: '',
        pathname: '/my-bucket/**',
        search: '',
      },
    ],
  },
}

export default nextConfig
```

也支持 `URL` 对象写法：

```ts
// next.config.ts
images: {
  remotePatterns: [new URL('https://example.com/account123/**')],
}
```

### 通配符规则

| 通配符 | 含义 |
|---|---|
| `*` | 匹配**单个**路径段或单个子域 |
| `**` | 匹配**末尾**任意数量路径段，或**开头**任意数量子域 |

`**` **不能用在模式中间**。

### 省略字段 = 隐含通配符

```ts
// next.config.ts
// ⚠️ 不推荐：省略 pathname 等于 pathname: '/**'
images: {
  remotePatterns: [{ hostname: 'example.com' }],
}
```

省略 `protocol`、`port`、`pathname` 或 `search` 都会隐含 `**`。这等于把粒度退回到接近 `domains` 的水平。**尽可能写具体**。

### `localPatterns`：本地图片也收紧了

本地图片默认不做白名单，但 16 起有个变化：**本地 `src` 带查询字符串时需要配置 `localPatterns`**。

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: '/assets/images/**', search: '' },
    ],
  },
}

export default nextConfig
```

上面这条规则的含义：`src` 必须以 `/assets/images/` 开头，**且不能有查询字符串**。不满足就返回 400。

```tsx
// app/page.tsx
// ✅ 通过
<Image src="/assets/images/a.png" alt="" width={100} height={100} />

// ❌ 400：带查询字符串但 search 是空串
<Image src="/assets/images/a.png?v=2" alt="" width={100} height={100} />
```

要允许带查询串，就写具体的 `search`：

```ts
// next.config.ts
images: {
  localPatterns: [{ pathname: '/assets/images/**', search: '?v=2' }],
}
```

> **注意**：省略 `search` 会允许**所有**查询参数，可能被恶意利用（每个不同的查询串都是一次独立编码 + 一份独立缓存）。给具体值。

### `dangerouslyAllowLocalIP`：默认阻止本地 IP

16 新增的安全限制：**默认阻止指向本地 IP 的图片请求**。

```ts
// next.config.ts
// ⚠️ 打开前先理解 SSRF 风险
images: {
  dangerouslyAllowLocalIP: true,
}
```

为什么默认关：如果 `remotePatterns` 被配得过宽，或者有开放重定向，攻击者可以让图片优化器去请求 `http://127.0.0.1:8080/admin`、`http://169.254.169.254/latest/meta-data/`（云厂商元数据服务）这类地址，把内网响应当作「图片」拉出来。这是标准的 SSRF 攻击面。

只在明确知道自己在做什么（例如图片确实部署在内网、且已隔离）时才打开。

## 其他常用配置

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 14400,
    maximumRedirects: 3,
  },
}

export default nextConfig
```

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `deviceSizes` | `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` | 设备宽度断点 |
| `imageSizes` | `[32, 48, 64, 96, 128, 256, 384]` | 小于全宽时的候选宽度 |
| `formats` | `['image/webp']` | 按 `Accept` 头协商，取**第一个**匹配项 |
| `qualities` | `[75]` | 允许的 quality 白名单 |
| `minimumCacheTTL` | `14400` | 秒 |
| `maximumRedirects` | `3` | 设 0 禁用跟随 |
| `maximumResponseBody` | `50_000_000` | 源图最大 50 MB |
| `maximumDiskCacheSize` | 启动时探测可用空间，取 50% | 磁盘缓存上限 |
| `path` | `/_next/image` | 优化接口路径前缀 |
| `contentDispositionType` | `attachment` | 强制下载而非内联渲染 |
| `dangerouslyAllowSVG` | `false` | 默认不优化 SVG |
| `dangerouslyAllowLocalIP` | `false` | 默认阻止本地 IP |
| `unoptimized` | `false` | 全局关闭优化 |

### 启用 AVIF 的取舍

```ts
// next.config.ts
images: {
  // AVIF 优先，不支持的浏览器回退到 WebP
  formats: ['image/avif', 'image/webp'],
}
```

AVIF 通常比 WebP 再小 20%，但编码慢约 50%。首次请求会更慢（编码耗时），之后命中缓存就快了。另外**每种格式各存一份缓存**，磁盘占用翻倍。自托管且有 CDN / Proxy 时，必须确保 Proxy 转发 `Accept` 头，否则格式协商失效。

### SVG 的处理

默认不优化 SVG——矢量格式本来就不需要缩放，而且 SVG 可以内嵌脚本和样式，属于 XSS 载体。`src` 以 `.svg` 结尾时会自动应用 `unoptimized`。

确实需要开启时，务必配套设置 CSP 和下载策略：

```ts
// next.config.ts
images: {
  dangerouslyAllowSVG: true,
  contentDispositionType: 'attachment',
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
}
```

## 常见坑

- **现象**：移动端加载的图比实际显示尺寸大好几倍，LCP 很差。
  **原因**：没写 `sizes`，浏览器按 `100vw` 选图。
  **解法**：按布局写 `sizes="(max-width: 768px) 100vw, 33vw"` 这类描述。

- **现象**：用了 `fill`，图片跑到页面左上角或者溢出到别的元素上。
  **原因**：父元素没有 `position: relative`。
  **解法**：给直接父元素加定位类（Tailwind 里是 `relative`）。

- **现象**：图片被拉伸变形。
  **原因**：`fill` 下未设 `objectFit`。
  **解法**：`style={{ objectFit: 'cover' }}` 或 `'contain'`。

- **现象**：改了 `quality={90}` 但拿到的图看起来没变化，开发环境还有警告。
  **原因**：`qualities` 默认只有 `[75]`，超出白名单的值会被强制取最接近的允许值。
  **解法**：在 `next.config.ts` 里显式列出需要的质量：`qualities: [50, 75, 90]`。

- **现象**：直接请求 `/_next/image?url=...&q=60` 返回 400。
  **原因**：60 不在 `qualities` 白名单里。
  **解法**：加进白名单，或改用 75。

- **现象**：换了源图文件，页面上的图还是旧的。
  **原因**：`minimumCacheTTL` 现在是 4 小时，且没有缓存失效机制。
  **解法**：改 `src`（例如加版本号查询串）绕过缓存，或手动删除 `<distDir>/cache/images`。

- **现象**：升级到 16 后，本地图片 `src` 带了查询串就 400。
  **原因**：16 起本地 `src` 带查询字符串需要 `images.localPatterns` 配置。
  **解法**：加 `localPatterns: [{ pathname: '/assets/images/**', search: '?v=2' }]`。

- **现象**：配置了 `remotePatterns` 但仍然报「hostname not configured」。
  **原因**：`remotePatterns` 匹配的是**初始 URL**，但如果源站做了重定向且超过 `maximumRedirects`（默认 3），请求会失败；或者协议/端口没对上。
  **解法**：用 `curl -I` 看源站是否重定向，把最终的协议、主机、端口、路径都写进白名单。

- **现象**：想用 `images.domains` 的写法，但文档里找不到。
  **原因**：`domains` 从 14 起弃用。
  **解法**：改用 `remotePatterns`。见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 9 条。

- **现象**：图片在内网地址上，优化请求全部失败。
  **原因**：16 默认阻止指向本地 IP 的请求。
  **解法**：确认没有 SSRF 风险后设 `dangerouslyAllowLocalIP: true`；更安全的做法是把内网图片换成公开可达的地址。

- **现象**：`next/legacy/image` 导入报弃用警告。
  **原因**：`next/legacy/image` 已弃用。
  **解法**：改成 `next/image`，按上面的 `fill` / `sizes` 规则调整。见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 9 条。

## 旧写法 vs 新写法

| 场景 | 旧 | 新（16.3） |
|---|---|---|
| 首屏关键图 | `priority` | **`preload`**（`priority` 已弃用） |
| 远程图片白名单 | `images.domains: ['x.com']` | **`images.remotePatterns`** |
| 图片组件 | `next/legacy/image` | **`next/image`** |
| 允许的 quality | 1–100 任意 | **`qualities` 白名单，默认 `[75]`** |
| 缓存 TTL | 60 秒 | **14400 秒** |
| 重定向跟随 | 无限 | **最多 3 次** |
| 本地图片带查询串 | 直接可用 | **需要 `images.localPatterns`** |
| 加载完成回调 | `onLoadingComplete` | **`onLoad`** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 8、9 条。

## API / 配置速查

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `src` | `string \| StaticImport` | **必需** | 图片地址 |
| `alt` | `string` | **必需** | 装饰性图片用 `""` |
| `width` / `height` | `number` | — | 固有像素尺寸，用于计算宽高比 |
| `fill` | `boolean` | `false` | 撑满定位父元素 |
| `sizes` | `string` | — | 响应式宽度描述，用 `fill` 时必需 |
| `quality` | `number` | `75` | 须在 `qualities` 白名单内 |
| `preload` | `boolean` | `false` | 插入 `<link rel="preload">` |
| `loading` | `'lazy' \| 'eager'` | `'lazy'` | 原生懒加载 |
| `placeholder` | `'empty' \| 'blur'` | `'empty'` | 占位符 |
| `blurDataURL` | `string` | 静态 import 自动提供 | 配合 `placeholder="blur"` |
| `style` | `CSSProperties` | — | 注意同时设 `height: 'auto'` |
| `unoptimized` | `boolean` | `false` | 跳过优化 |
| `loader` | `function` | — | 自定义 URL 生成 |
| `onLoad` / `onError` | `function` | — | 需客户端组件 |
| `decoding` | `'async' \| 'sync' \| 'auto'` | `'async'` | 解码提示 |

| 辅助 API | 用途 |
|---|---|
| `getImageProps()` | 取底层 `<img>` 的 props，用于 `<picture>` / 背景图 / canvas |

## 延伸阅读

- [官方文档：Image Optimization（Getting Started）](https://nextjs.org/docs/app/getting-started/images)
- [官方文档：Image 组件 API 参考](https://nextjs.org/docs/app/api-reference/components/image)
- [官方文档：next.config.js 的 images 配置](https://nextjs.org/docs/app/api-reference/config/next-config-js/images)
- [web.dev：Cumulative Layout Shift](https://web.dev/articles/cls)
- [OWASP：Server-Side Request Forgery](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery)
