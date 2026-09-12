# 29 · TypeScript 与 ESLint

> **一句话结论**：`next lint` 已移除，`next build` 也不再顺带跑 lint——lint 回归成独立的一步。ESLint 配置默认是 Flat Config（`eslint.config.mjs`）。`next typegen` 会生成 `PageProps` / `LayoutProps` / `RouteContext` 三个全局类型，**用它们替代手写泛型**，路由参数改名时会自动报错。TypeScript 最低 5.1.3。

## 最小可运行示例

```bash
# 安装
pnpm add -D eslint eslint-config-next
pnpm add -D typescript @types/react @types/node
```

```js
// eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
```

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "lint:fix": "eslint --fix",
    "typecheck": "next typegen && tsc --noEmit"
  }
}
```

```tsx
// app/blog/[slug]/page.tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <h1>{slug}</h1>
}
```

`PageProps` 是全局类型，不需要 import。它在 `next dev`、`next build`、`next typegen` 任一命令运行时生成。

## 为什么 `next lint` 被删掉

`next lint` 做的是「把 ESLint 包一层」。它存在的年代，前端项目里 ESLint 配置五花八门（`.eslintrc.json`、`.eslintrc.js`、`package.json` 里的 `eslintConfig` 字段），让框架提供一个统一入口是有价值的。

现在 ESLint 自己收敛到了 Flat Config，CLI 也稳定了。再包一层只会带来三个问题：

1. **版本错位**：`next lint` 支持的 ESLint 版本范围比 ESLint 自己窄，用户想用新版本会被卡住。
2. **选项不透明**：`next lint --fix` 到底传了什么给 ESLint，用户看不出来。
3. **`next build` 顺带跑 lint 是隐式行为**：构建时间和失败原因都变得不可预期——一个未使用的变量能让生产构建挂掉。

所以 16 里三件事一起改了：`next lint` 命令移除、`next build` 不再跑 lint、`next.config.js` 的 `eslint` 字段也不再需要，可以直接删。

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 13 条。

迁移用官方 codemod：

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

它做的事是：把 `package.json` 里的 `next lint` 脚本改成 `eslint`，并把旧的 ESLint 配置转成 Flat Config。

## Flat Config 与插件

`@next/eslint-plugin-next` 现在**默认输出 Flat Config 格式**，这是为了对齐即将移除旧配置支持的 ESLint v10。

`eslint-config-next` 包提供三个配置：

| 配置 | 内容 |
|---|---|
| `eslint-config-next` | 基础：Next.js + React + React Hooks 规则 |
| `eslint-config-next/core-web-vitals` | 基础之上，把影响 Core Web Vitals 的规则从 warning 提到 error。**多数项目用这个** |
| `eslint-config-next/typescript` | 额外加上 `typescript-eslint` 的推荐规则，与上面两个叠加使用 |

`core-web-vitals` 里提升的是哪几条规则，值得单独说：`@next/next/no-img-element`（阻止用 `<img>`，它会拖慢 LCP）、`@next/next/no-sync-scripts`（阻止同步脚本）、`@next/next/google-font-display` 等。这些规则在基础配置里只是 warning，很容易被忽略——所以创建新项目时 `create-next-app` 默认就用 `core-web-vitals`。

如果项目里已经有自己的 ESLint 体系（用了 `airbnb`、`react-app` 之类会重复引入 `react` / `react-hooks` 插件的配置），直接展开 `eslint-config-next` 会撞车。这时单独用插件：

```js
// eslint.config.mjs
import { defineConfig } from 'eslint/config'
import nextPlugin from '@next/eslint-plugin-next'

const eslintConfig = defineConfig([
  // 你原有的配置...
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
    },
  },
])

export default eslintConfig
```

monorepo 里 Next.js 不在根目录时，告诉插件去哪找应用：

```js
// eslint.config.mjs
import { defineConfig } from 'eslint/config'
import eslintNextPlugin from '@next/eslint-plugin-next'

const eslintConfig = defineConfig([
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { '@next/next': eslintNextPlugin },
    settings: {
      next: { rootDir: 'packages/my-app/' },
    },
  },
])

export default eslintConfig
```

`rootDir` 接受相对路径、绝对路径、glob（如 `"packages/*/"`），或者它们的数组。

## `next typegen` 与全局类型

```bash
# 只生成类型，不做完整构建
pnpm next typegen
```

输出到 `<distDir>/types`——开发时是 `.next/dev/types`，生产是 `.next/types`。它同时会重新生成 `next-env.d.ts`。

生成三个全局类型，无需 import：

| 类型 | 用途 |
|---|---|
| `PageProps<'/路由'>` | 页面组件的 props |
| `LayoutProps<'/路由'>` | 布局组件的 props |
| `RouteContext<'/路由'>` | Route Handler 的上下文 |

```tsx
// app/shop/[category]/page.tsx
export default async function Page(props: PageProps<'/shop/[category]'>) {
  const { category } = await props.params
  const { sort } = await props.searchParams
  return <h1>{category} · {sort}</h1>
}
```

```tsx
// app/shop/[category]/layout.tsx
export default function Layout(props: LayoutProps<'/shop/[category]'>) {
  return <section>{props.children}</section>
}
```

```ts
// app/api/items/[id]/route.ts
export async function GET(_request: Request, ctx: RouteContext<'/api/items/[id]'>) {
  const { id } = await ctx.params
  return Response.json({ id })
}
```

**为什么不用手写泛型**：手写是 `{ params: Promise<{ slug: string }> }`，路由改名（`[slug]` → `[id]`）时 TypeScript 不会报错，因为你手写的类型和文件系统没有任何关联。用 `PageProps<'/blog/[slug]'>` 之后，路由路径是字面量类型，路径不存在或改名了都会在类型检查时暴露。

`params` 和 `searchParams` 都是 `Promise`，必须 `await`——这是 16 的强制要求，同步兼容层在 16 里已完全移除。详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7 条。

`next typegen` 的典型用途是 CI 里先跑一次，再跑 `tsc --noEmit`：

```bash
pnpm next typegen && tsc --noEmit
```

`next-env.d.ts` 应该加进 `.gitignore`——它是生成物。

## TypeScript 版本要求

| 项 | 要求 |
|---|---|
| TypeScript | **5.1.3+** |
| `@types/react` | 18.2.8+ |
| `@types/node` | 与 Node 20.9+ 匹配 |

版本不够时报的错很有辨识度：

```
'Promise<Element>' is not a valid JSX element.
  Type 'Promise<Element>' is missing the following properties from type 'ReactElement<...>'
```

这是异步服务端组件返回 `Promise<JSX.Element>`，而旧版 TypeScript 的 JSX 类型定义不接受 Promise。升 TypeScript 和 `@types/react` 即可。

TypeScript 7 有个特殊限制：它不提供 JavaScript 编译器 API。想用 TS 7 做类型检查，需要装项目本地的 `typescript@^7`，走 CLI。16 默认就是用**项目本地的 `tsc` CLI** 做构建期类型检查，把 `experimental.useTypeScriptCli` 设为 `false` 才会切回内置检查器。

CLI 检查器和内置检查器的输出不一样：

| | 内置检查器 | CLI 检查器 |
|---|---|---|
| 错误展示 | 带 Next.js 代码框，路由/页面/布局错误会重写 | 原生 `tsc` 输出 |
| 检查范围 | 只查相关文件 | **整个 `tsconfig` 选中的项目**（含测试文件和 `.next/dev/types`） |

范围差异会导致 CLI 检查器报出一些内置检查器不报的错误（比如测试文件里的类型问题）。这是预期行为，不是 bug。

## TypeScript 插件

Next.js 自带一个 TypeScript 语言服务插件，在 VS Code 里能提供框架感知的检查：

- 非法的路由段配置值会报警告
- 悬停显示可用选项与文档
- 检查 `'use client'` 指令是否用对
- 检查客户端 hook（如 `useState`）是否只在客户端组件里用

编辑器默认可能用的是内置的 TypeScript 而不是项目版本，插件就没加载。切换方式：

```
Ctrl/⌘ + Shift + P → TypeScript: Select TypeScript Version → Use Workspace Version
```

## `typescript` 配置项

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // 默认：生产构建遇到类型错误会失败
    ignoreBuildErrors: false,
    // 用另一个 tsconfig 做构建期检查
    tsconfigPath: 'tsconfig.build.json',
  },
}
export default nextConfig
```

| 字段 | 默认 | 说明 |
|---|---|---|
| `ignoreBuildErrors` | 构建遇类型错误即失败 | 设为 `true` 会跳过类型检查，**危险** |
| `tsconfigPath` | `tsconfig.json` | 指定构建用配置；dev 只监听 `tsconfig.json` 的变更，换文件名要重启 |

`ignoreBuildErrors: true` 唯一合理的用法是把类型检查挪到 CI 单独跑。如果只是为了让构建通过，那是把问题推到运行时。

按环境切配置：

```ts
// next.config.ts
import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: isProd ? 'tsconfig.build.json' : 'tsconfig.json',
  },
}
export default nextConfig
```

注意 IDE 读的是 `tsconfig.json`，所以换了构建配置后编辑器诊断和构建结果可能不一致。

## 常见坑

- **现象**：升级到 16 后 `pnpm lint` 报 `next lint` 找不到。
  **原因**：`next lint` 命令在 16 里已移除，`next build` 也不再跑 lint。
  **解法**：跑 codemod `npx @next/codemod@canary next-lint-to-eslint-cli .`，之后直接用 `eslint` CLI。

- **现象**：CI 里 lint 和类型检查都没跑，但构建一直是绿的，线上出问题。
  **原因**：16 之前 `next build` 会顺带跑 lint，很多人把 lint 当成构建的一部分，没在 CI 里单独配。
  **解法**：CI 里显式加两步：`eslint` 和 `next typegen && tsc --noEmit`。

- **现象**：`next.config.js` 里的 `eslint` 字段被报未知配置。
  **原因**：`next lint` 移除后这个字段也一并移除了。
  **解法**：删掉整个 `eslint` 字段，配置全部放进 `eslint.config.mjs`。

- **现象**：编辑器里 `PageProps` 报「找不到名称」。
  **原因**：全局类型由 `next dev` / `next build` / `next typegen` 生成，还没跑过任何一个。
  **解法**：跑一次 `pnpm dev` 或 `pnpm next typegen`。CI 里必须显式跑 typegen。

- **现象**：`tsc --noEmit` 报 `.next/dev/types` 里的错误，但那是生成文件。
  **原因**：`tsconfig.json` 的 `include` 里有 `.next/types/**/*.ts`（或 `.next/dev/types`），CLI 检查器会查整个项目。
  **解法**：把 `.next` 加进 `tsconfig.json` 的 `exclude`，或在 `tsconfig.build.json` 里单独排除。

- **现象**：`.eslintrc.json` 还在，ESLint 不读它。
  **原因**：Flat Config 是默认格式，旧配置格式不再被识别。
  **解法**：迁移到 `eslint.config.mjs`。`@next/eslint-plugin-next` 已默认输出 Flat Config 格式，直接展开即可。

## 旧写法 vs 新写法

| 场景 | 13/14 写法 | 16 写法 |
|---|---|---|
| lint 命令 | `next lint` | **已移除** → `eslint` CLI |
| 构建期 lint | `next build` 顺带跑 | **不再跑**，需单独配置 |
| ESLint 配置 | `.eslintrc.json` | **`eslint.config.mjs`**（Flat Config） |
| 配置字段 | `next.config.js` 的 `eslint` | **已移除** |
| 路由参数类型 | `{ params: Promise<{ slug: string }> }` | `PageProps<'/blog/[slug]'>` |
| 同步 `params` | `props.params.slug` | `(await props.params).slug` |
| 类型生成 | 无独立命令 | `next typegen` |
| 类型检查器 | 内置 | 默认项目本地 `tsc` CLI |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 7、13 条。

## API / 配置速查

| 命令 / 配置 | 作用 |
|---|---|
| `eslint` / `eslint --fix` | 跑 lint（取代 `next lint`） |
| `next typegen` | 生成 `PageProps` / `LayoutProps` / `RouteContext` |
| `next typegen && tsc --noEmit` | CI 标准类型检查组合 |
| `typescript.ignoreBuildErrors` | 跳过构建期类型检查（危险） |
| `typescript.tsconfigPath` | 指定构建用 tsconfig |
| `experimental.useTypeScriptCli` | `false` 时用内置检查器而非 `tsc` CLI |
| `@next/eslint-plugin-next` 的 `settings.next.rootDir` | monorepo 里定位 Next.js 应用 |

| 全局类型 | 用于 |
|---|---|
| `PageProps<'/path'>` | `page.tsx` |
| `LayoutProps<'/path'>` | `layout.tsx` |
| `RouteContext<'/path'>` | `route.ts` |

| 版本要求 | 最低 |
|---|---|
| TypeScript | 5.1.3 |
| `@types/react` | 18.2.8 |
| Node.js | 20.9 |

## 延伸阅读

- [官方文档：ESLint 配置](https://nextjs.org/docs/app/api-reference/config/eslint)
- [官方文档：TypeScript 配置](https://nextjs.org/docs/app/api-reference/config/typescript)
- [官方文档：next CLI（typegen）](https://nextjs.org/docs/app/api-reference/cli/next)
- [官方文档：next-env.d.ts](https://nextjs.org/docs/app/api-reference/config/typescript#next-env-d-ts)
- [官方文档：Codemods（next-lint-to-eslint-cli）](https://nextjs.org/docs/app/guides/upgrading/codemods)
- [typescript-eslint 配置参考](https://typescript-eslint.io/linting/configs)
