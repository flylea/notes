# 01 · 环境搭建与项目结构

> **一句话结论**：`create-next-app` 默认给你的就是当前最优配置（TypeScript + Tailwind + ESLint + App Router + Turbopack），别急着改。真正需要理解的是 `app/`、`public/`、`src/` 三个目录的职责边界——以及一个前提：**Node.js 必须 20.9 以上**。

## 最小可运行示例

```bash
# 一条命令起项目，--yes 跳过所有交互，使用推荐默认值
pnpm create next-app@latest my-app --yes
cd my-app
pnpm dev
```

访问 `http://localhost:3000` 就能看到页面。

`--yes` 会跳过提问，直接采用默认配置：**TypeScript、Tailwind CSS、ESLint、App Router、Turbopack**，导入别名 `@/*`。

## 环境要求

| 项 | 最低版本 | 说明 |
|---|---|---|
| Node.js | **20.9** | 16 起不再支持 Node 18 |
| TypeScript | **5.1.0** | 仅在使用 TS 时 |
| 操作系统 | macOS / Windows（含 WSL）/ Linux | — |

浏览器支持（零配置）：

- Chrome 111+
- Edge 111+
- Firefox 111+
- Safari 16.4+

## 交互式安装：每一项在问什么

直接跑 `pnpm create next-app` 会先问一个总问题：

```
What is your project named? my-app
Would you like to use the recommended Next.js defaults?
    Yes, use recommended defaults - TypeScript, ESLint, Tailwind CSS, App Router, AGENTS.md
    No, reuse previous settings
    No, customize settings - Choose your own preferences
```

选 `customize settings` 才会逐项展开：

```
Would you like to use TypeScript? No / Yes
Which linter would you like to use? ESLint / Biome / None
Would you like to use React Compiler? No / Yes
Would you like to use Tailwind CSS? No / Yes
Would you like your code inside a `src/` directory? No / Yes
Would you like to use App Router? (recommended) No / Yes
Would you like to customize the import alias (`@/*` by default)? No / Yes
What import alias would you like configured? @/*
Would you like to include AGENTS.md to guide coding agents to write up-to-date Next.js code? No / Yes
```

几个选项值得单独说：

**linter 三选一**。ESLint 规则全但慢；Biome 是 linter + formatter 二合一，快得多；`None` 就是不装。这个选择直接影响 `package.json` 里的脚本：

```json
{
  "scripts": {
    "lint": "eslint",
    "lint:fix": "eslint --fix"
  }
}
```

```json
{
  "scripts": {
    "lint": "biome check",
    "format": "biome format --write"
  }
}
```

**React Compiler**。Next.js 16 里它已经稳定，但**默认不开启**，需要你在这里选 Yes（或事后装 `babel-plugin-react-compiler` 并配置）。开了之后自动做 memoization，手动写 `useMemo` / `useCallback` 的场景大幅减少。

**AGENTS.md**。这个是给 AI 编码助手看的说明文件，会连同引用它的 `CLAUDE.md` 一起生成，作用是让助手按当前版本的 API 写代码，而不是按它训练数据里的老版本写。建议保留。

**`src/` 目录**。选 Yes 会把应用代码放进 `src/`，把配置文件留在根目录。要不要用见下文。

## 手动安装

不想用脚手架的话：

```bash
pnpm i next@latest react@latest react-dom@latest
```

然后往 `package.json` 加脚本：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "lint:fix": "eslint --fix"
  }
}
```

四个命令的分工：

| 命令 | 作用 |
|---|---|
| `next dev` | 启动开发服务器，**默认用 Turbopack** |
| `next build` | 构建生产版本 |
| `next start` | 启动生产服务器 |
| `eslint` | 跑 lint（**不再是 `next lint`**） |

手动建目录：`app/layout.tsx`（根布局，**必须存在**，且必须包含 `<html>` 和 `<body>`）和 `app/page.tsx`（首页）。

```tsx
// app/layout.tsx
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
  return <h1>Hello, Next.js!</h1>
}
```

> 忘了建根布局也不会报错——跑 `next dev` 时 Next.js 会自动帮你创建。

## 为什么这样设计：三个目录的职责边界

```
my-app/
├─ app/                 # 路由 + 页面（文件系统路由）
│  ├─ layout.tsx        # 根布局，必需
│  └─ page.tsx          # 首页，对应 /
├─ public/              # 静态资源，按根路径 / 引用
├─ next.config.ts       # 框架配置（16 起原生支持 TS）
├─ tsconfig.json        # TS 配置 + 路径别名
├─ eslint.config.mjs    # ESLint Flat Config
└─ package.json
```

**`app/` 是路由表本身**。Next.js 用文件系统路由——目录结构即 URL 结构。放一个 `page.tsx` 就是一条路由，`app/blog/page.tsx` 对应 `/blog`。这不是"约定优于配置"那种风格偏好，而是框架的编译期输入：构建时 Next.js 扫描 `app/` 生成路由清单。

**`public/` 是唯一的静态出口**。里面的文件不经过打包、不做哈希、不带缓存指纹，直接映射到根路径。`public/profile.png` 用 `/profile.png` 引用：

```tsx
// app/page.tsx
import Image from 'next/image'

export default function Page() {
  return <Image src="/profile.png" alt="Profile" width={100} height={100} />
}
```

> **注意**：`public/` 里的文件不走构建流程，意味着它们**不会**被压缩、不会被 tree-shake、也不会自动加内容哈希。适合放 `favicon.ico`、`robots.txt`、需要固定 URL 的验证文件。**不要**把组件要 import 的图片放这里——那类资源应该走 `import` 让打包器处理。

**`src/` 是可选的隔离层**。它的唯一作用是让应用代码和配置文件分家：

```
src/
├─ app/          # 路由
└─ components/   # 组件
next.config.ts
tsconfig.json
eslint.config.mjs
```

项目小的时候没必要。文件多起来（根目录堆了十几个配置文件）之后会舒服一些。`public/` 和配置文件**不会**进 `src/`。

## 常见坑

- **现象**：`next build` 报错，提示不支持你的自定义 webpack 配置。
  **原因**：16 起 Turbopack 是**构建的默认打包器**，有自定义 webpack 配置时构建会直接失败，这是有意的保护。
  **解法**：要么迁移配置到 `turbopack` 字段，要么显式退回：`next build --webpack`。

- **现象**：升级到 16 后 `npm run lint` 报 `next lint` 找不到。
  **原因**：`next lint` 命令在 16 里**已移除**，`next build` 也不再顺带跑 lint。
  **解法**：用官方 codemod 迁移脚本：`npx @next/codemod@canary next-lint-to-eslint-cli .`，之后直接用 ESLint CLI。

- **现象**：Node 18 环境下启动失败。
  **原因**：最低要求提到 20.9。
  **解法**：升 Node。用 nvm 的话 `nvm install 20.9 && nvm use 20.9`。

- **现象**：编辑器里一堆同名的 `page.tsx` / `layout.tsx` 标签页，分不清哪个是哪个。
  **原因**：App Router 用约定命名，文件名天然重复。
  **解法**：VS Code 1.88+ / Cursor 里配自定义标签（JetBrains 系自带这个能力，不用配）：

  ```json
  // .vscode/settings.json
  {
    "workbench.editor.customLabels.patterns": {
      "**/app/**/page.tsx": "${dirname(1)}/${dirname} - page.tsx",
      "**/app/**/layout.tsx": "${dirname(1)}/${dirname} - layout.tsx",
      "**/app/**/route.ts": "${dirname(1)}/${dirname} - route.ts"
    }
  }
  ```

- **现象**：装了 TypeScript，但编辑器里类型提示不完整。
  **原因**：编辑器没用工作区版本的 TypeScript，也就没加载 Next.js 自带的类型插件。
  **解法**：命令面板（`Ctrl/⌘ + Shift + P`）→ `TypeScript: Select TypeScript Version` → 选 `Use Workspace Version`。

## 旧写法 vs 新写法

| 场景 | 旧（13/14） | 新（16.3） |
|---|---|---|
| 打包器 | webpack 默认，`--turbopack` 手动开 | **Turbopack 默认**，`--webpack` 退回 |
| Node 版本 | 18 可用 | **20.9+** |
| lint 命令 | `next lint` | **已移除**，用 ESLint/Biome CLI |
| 配置文件 | 只能 `next.config.js` | **`next.config.ts` 原生支持** |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2、13、15 条。

## 绝对导入与路径别名

用 `@/` 代替一堆 `../`：

```ts
// Before
import { Button } from '../../../components/button'

// After
import { Button } from '@/components/button'
```

配置在 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "baseUrl": "src/",
    "paths": {
      "@/styles/*": ["styles/*"],
      "@/components/*": ["components/*"]
    }
  }
}
```

`paths` 里的路径都相对于 `baseUrl`。

## 升级

```bash
pnpm next upgrade
```

升级会顺带更新 `node_modules/next/dist/docs/` 里的文档——**这是官方给 AI 编码助手准备的一手材料**，让助手按你装的版本写代码，而不是按训练数据里的老版本。升完可以让助手自己同步一下：

> Let's get our Next.js knowledge up to speed, and give me a summary of what's new for you

想看未发布的新特性，去 [preview.nextjs.org](https://preview.nextjs.org)。

## API / 配置速查

| 命令 | 作用 |
|---|---|
| `next dev` | 开发服务器（Turbopack） |
| `next dev --webpack` | 开发服务器（webpack） |
| `next build` | 生产构建（Turbopack） |
| `next build --webpack` | 生产构建（webpack） |
| `next start` | 启动生产服务器 |
| `next upgrade` | 升级 Next.js 并更新内置文档 |

| 目录 / 文件 | 必需 | 作用 |
|---|---|---|
| `app/` | 是 | 路由与页面 |
| `app/layout.tsx` | 是（根布局） | 必须含 `<html>` 和 `<body>` |
| `app/page.tsx` | 否 | 一条路由的入口 |
| `public/` | 否 | 静态资源，按 `/` 引用，不走构建 |
| `src/` | 否 | 应用代码与配置分离 |
| `next.config.ts` | 否 | 框架配置 |
| `eslint.config.mjs` | 否 | ESLint Flat Config |

## 延伸阅读

- [官方文档：Installation](https://nextjs.org/docs/app/getting-started/installation)
- [官方文档：Project Structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [官方文档：create-next-app CLI](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- [官方文档：Upgrading](https://nextjs.org/docs/app/getting-started/upgrading)
