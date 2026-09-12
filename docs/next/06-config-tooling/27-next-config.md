# 27 · next.config 全解

> **一句话结论**：`next.config.ts` 是唯一能改框架默认行为的地方，但 16 里它**变小了**——`experimental.turbopack` 搬到了顶层 `turbopack`，`experimental.ppr` / `dynamicIO` / `useCache` 三个开关合并成一个 `cacheComponents`，而只要你保留 `webpack` 字段，`next build` 会直接失败。先清掉过时配置，再谈调优。

## 最小可运行示例

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 打包器配置：16 起在顶层，不再嵌套在 experimental 下
  turbopack: {
    resolveAlias: {
      // 例：把 node 内置 fs 替换成空模块
      fs: { browser: './empty.ts' },
    },
  },

  // 缓存模型总开关：一次启用 use cache / cacheLife / cacheTag + PPR
  cacheComponents: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.example.com',
        pathname: '/uploads/**',
      },
    ],
    // 16 起 qualities 必填，默认只有 [75]
    qualities: [50, 75, 100],
  },
}

export default nextConfig
```

类型来自 `next` 包导出的 `NextConfig`。不写这个类型也能跑，但写了编辑器才会在你把 `turbopack` 错放进 `experimental` 时报错——这是最省事的版本校验手段。

## 配置文件的四种形态

```ts
// next.config.ts —— 16 起原生支持，推荐
import type { NextConfig } from 'next'
const nextConfig: NextConfig = {}
export default nextConfig
```

```js
// next.config.mjs —— ESM
// @ts-check
/** @type {import('next').NextConfig} */
const nextConfig = {}
export default nextConfig
```

```js
// next.config.js —— CommonJS
// @ts-check
/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig
```

```ts
// next.config.ts —— 函数式：按 phase 或环境返回不同配置
import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

export default (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER
  return {
    // dev 下开启 React 严格模式，生产下不开
    reactStrictMode: isDev,
  }
}
```

**`.cjs` / `.cts` 扩展名不支持**，配置文件里也不能使用当前 Node 版本不支持的语法——它不经过打包器处理，是 Node 直接读的。

函数式配置支持 `async`，但**不要**在配置文件顶层做副作用（写文件、改 `process.env`、读数据库）。原因见第 30 章的「配置文件只加载一次」。

## 为什么 `turbopack` 搬到了顶层

旧配置长这样：

```js
// next.config.js —— 15.2 及以前
module.exports = {
  experimental: {
    turbo: { /* ... */ },
  },
}
```

`experimental` 这个命名空间的语义是「签名可能随时改，别在生产依赖」。Turbopack 在 16 里成了 dev 和 build 的**默认打包器**——一个默认启用的东西还挂在 `experimental` 下面，语义是自相矛盾的。所以配置项上移，同时 `experimental.turbo` 改名为顶层 `turbopack`。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 12 条。

> **名称考据**：`MIGRATION-16.md` 里写的旧名是 `experimental.turbopack`，官方文档记录的旧名是 `experimental.turbo`（13.0.0–15.2.x）。`turbo` 才是实际存在过的键名，`next-experimental-turbo-to-turbopack` 这个 codemod 也印证了这点。迁移时按 `turbo` 去找。

`turbopack` 的字段不多：

| 字段 | 作用 |
|---|---|
| `root` | 应用根目录，**必须是绝对路径**。不配则自动向上找 lockfile 推断 |
| `rules` | 文件扩展名 → webpack loader 列表，按顺序执行 |
| `resolveAlias` | 别名映射，取代 webpack 的 `resolve.fallback` |
| `resolveExtensions` | 解析扩展名列表，**提供即覆盖默认值**，所以要写全 |
| `debugIds` | 在 bundle 和 source map 里注入 debug ID，便于线上定位栈帧 |

`rules` 里的 loader 有个硬限制：**只支持返回 JavaScript 代码的 loader**。转换样式表或图片的 loader 目前用不了。

## 为什么有 webpack 配置就构建失败

```ts
// next.config.ts
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { fs: false }
    return config
  },
}
```

这份配置跑 `next dev` 没事，跑 `next build` 会报错。因为 16 的 `next build` 默认走 Turbopack，而 Turbopack **不读 `webpack` 字段**。与其静默忽略你的配置、让产物和预期不一致，框架选择直接拒绝构建。

三种处理方式：

```json
// package.json —— 方案一：整体退回 webpack
{
  "scripts": {
    "build": "next build --webpack"
  }
}
```

方案二是把配置翻译成 Turbopack 等价物（`resolve.fallback` → `turbopack.resolveAlias`）。方案三是删除不再需要的配置。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2 条。

## `cacheComponents`：一个开关取代三个

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}
export default nextConfig
```

16 之前有三个实验开关在管缓存：`experimental.ppr`、`experimental.dynamicIO`、`experimental.useCache`。它们互相耦合，组合起来能出现一堆互相矛盾的状态。16 把它们合并成 `cacheComponents: true`：

| 旧开关 | 16 的状态 |
|---|---|
| `experimental.ppr` | 移除。PPR 成为 App Router 默认渲染行为 |
| `experimental.dynamicIO` | 重命名为 `cacheComponents` |
| `experimental.useCache` | 并入 `cacheComponents` |
| `export const experimental_ppr`（路由级） | 移除 |

**它带来的语义变化比配置本身重要**：旧 App Router 的缓存是隐式的（`fetch` 默认行为一变再变，很多人吃过亏）。开启 `cacheComponents` 后，页面、布局、Route Handler 里的动态代码**默认在请求时执行**，想缓存必须显式写 `"use cache"`。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 3 条。

一个附带影响：启用后 Next.js 用 React 的 `<Activity>` 保留导航前的组件状态——返回上一页时表单输入、展开状态还在。代价是「组件不再卸载」，依赖卸载清理的逻辑要重新审视。

## `images` 常用项

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.example.com' },
      { protocol: 'https', hostname: '**.amazonaws.com', pathname: '/media/**' },
    ],
    localPatterns: [{ pathname: '/assets/**', search: '' }],
    qualities: [50, 75, 100],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 14400,
    dangerouslyAllowSVG: false,
  },
}
export default nextConfig
```

| 字段 | 默认值 | 说明 |
|---|---|---|
| `remotePatterns` | `[]` | 远程图白名单，可精确到协议 / 主机 / 端口 / 路径 / 查询串 |
| `localPatterns` | — | 本地图白名单。**带查询串的本地 src 必须配 `search`** |
| `qualities` | `[75]` | **16 起必填**，不写就只有 75 一档 |
| `formats` | `['image/webp']` | 数组顺序有意义，`Accept` 命中多个时取第一个 |
| `deviceSizes` | `[640,750,828,1080,1200,1920,2048,3840]` | 生成 `srcset` 的宽度档位 |
| `imageSizes` | `[32,48,64,96,128,256,384]` | **16 移除了 16 这一档** |
| `minimumCacheTTL` | `14400`（4 小时） | 16 从 60 秒改成 4 小时 |
| `maximumRedirects` | `3` | 16 从「无限」改成最多 3 次，设 `0` 关闭 |
| `dangerouslyAllowLocalIP` | `false` | 默认阻止指向内网 IP 的图片请求 |
| `dangerouslyAllowSVG` | 不优化 SVG | SVG 能内嵌脚本，除非有 CSP 否则别开 |

`qualities` 变必填是安全考量：之前 `[1..100]` 全允许，攻击者可以用 `?q=1`、`?q=2`……把图片优化端点当成缓存填充器，撑爆磁盘。现在只有你显式列出的档位能用。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 8、9 条。

## 常见坑

- **现象**：`next build` 报错说不支持自定义 webpack 配置。
  **原因**：16 的 build 默认用 Turbopack，不读 `webpack` 字段，这是有意的保护而非 bug。
  **解法**：迁移到 `turbopack` 字段，或显式 `next build --webpack`。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2 条。

- **现象**：把 `turbopack` 写进 `experimental` 后配置静默失效。
  **原因**：16 读的是顶层 `turbopack`；`experimental.turbo` 只是兼容别名，新的 `experimental.turbopack` 从来没被读过。
  **解法**：移到顶层，或用 codemod：`npx @next/codemod@latest next-experimental-turbo-to-turbopack .`。

- **现象**：图片明明在 `public/` 里，`next/image` 报 400。
  **原因**：16 默认阻止本地 IP 请求，且本地 src 带查询串（如 `/img.png?v=2`）需要 `localPatterns` 白名单。
  **解法**：给 `images.localPatterns` 加 `{ pathname: '/img.png', search: '?v=2' }`。内网图床场景才考虑 `dangerouslyAllowLocalIP`。

- **现象**：升级后图片质量参数不生效，所有图都是同一个质量。
  **原因**：`qualities` 默认值从全允许收窄到 `[75]`。
  **解法**：在 `next.config.ts` 里显式列出需要的档位，如 `qualities: [50, 75, 100]`。

- **现象**：`next.config.ts` 里读 `process.argv.includes('dev')` 判断环境，行为不对。
  **原因**：16 下配置文件在 dev 中只加载一次，且 `process.argv` 里不再包含 `'dev'`。
  **解法**：改用 `NODE_ENV === 'development'`，或用函数式配置的 `phase` 参数。详见第 30 章。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| Turbopack 配置 | `experimental.turbo` | **顶层 `turbopack`** |
| 缓存开关 | `experimental.ppr` + `dynamicIO` + `useCache` | **`cacheComponents: true`** |
| 路由级 PPR | `export const experimental_ppr = true` | **移除**，PPR 是默认行为 |
| 配置文件 | 只能 `.js` / `.mjs` | **`next.config.ts` 原生支持** |
| 图片域名白名单 | `images.domains` | **`images.remotePatterns`** |
| 图片质量 | 任意 `?q=` 值 | **必须列在 `qualities` 里** |
| 有 webpack 配置时 build | 正常工作 | **直接失败**，需 `--webpack` 或迁移 |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2、3、8、9、12 条。

## API / 配置速查

| 配置项 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `turbopack` | object | `{}` | 顶层，取代 `experimental.turbo` |
| `cacheComponents` | boolean | `false` | 启用 `use cache` + PPR |
| `partialPrefetching` | boolean | `false` | 16.3 新增，**依赖 `cacheComponents`** |
| `reactCompiler` | boolean \| object | `false` | 需先装 `babel-plugin-react-compiler` |
| `output` | `'standalone'` \| `'export'` | 未设 | 部署产物形态 |
| `distDir` | string | `'.next'` | 构建输出目录 |
| `assetPrefix` | string | — | 静态资源 CDN 前缀 |
| `basePath` | string | — | 子路径部署 |
| `serverExternalPackages` | string[] | `[]` | 不打包、走原生 `require` 的依赖 |
| `transpilePackages` | string[] | `[]` | 需要转译的 monorepo 依赖 |
| `pageExtensions` | string[] | `['tsx','ts','jsx','js']` | 会影响 `instrumentation` 文件名 |
| `typedRoutes` | boolean | `false` | 静态类型化 `<Link href>` |
| `adapterPath` | string | — | 平台适配器入口，Alpha |
| `deploymentId` | string | — | 滚动部署的版本偏移保护 |

| 已移除 / 迁移的配置 | 替代 |
|---|---|
| `experimental.ppr` | `cacheComponents` |
| `experimental.dynamicIO` | `cacheComponents` |
| `experimental.useCache` | `cacheComponents` |
| `experimental.turbo` | 顶层 `turbopack` |
| `eslint`（顶层） | 直接删掉，`next lint` 已移除 |
| `images.domains` | `images.remotePatterns` |
| `serverRuntimeConfig` | 环境变量（v15 起移除，非 16 引入） |
| `publicRuntimeConfig` | 环境变量（v15 起移除，非 16 引入） |

## 延伸阅读

- [官方文档：next.config.js 配置总览](https://nextjs.org/docs/app/api-reference/config/next-config-js)
- [官方文档：turbopack](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack)
- [官方文档：cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [官方文档：partialPrefetching](https://nextjs.org/docs/app/api-reference/config/next-config-js/partialPrefetching)
- [官方文档：output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [官方文档：adapterPath](https://nextjs.org/docs/app/api-reference/config/next-config-js/adapterPath)
- [官方文档：next/image 配置](https://nextjs.org/docs/app/api-reference/components/image)
- [官方文档：reactCompiler](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
