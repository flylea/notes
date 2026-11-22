# 第 1 章 Astro 简介与安装

## 1.1 Astro 解决什么问题

内容型站点（博客、文档、营销页、商品页）的主要工作是展示文字和图片。用单页应用做这类站点，浏览器先下载一份 JS，再在客户端拼出页面。内容没变，成本却每次都付。

Astro 的做法相反：先在服务端把页面渲染成 HTML，直接发给浏览器。只有需要交互的组件才附带 JS，这些组件在静态页面里各自水合（hydrate），像海面上的岛屿。这就是群岛架构。

它带来的取舍很具体：

- 首屏 HTML 里就有内容，不需要等 JS 执行完才能看到文字。
- 导航默认是整页刷新，浏览器会重建文档。需要无刷新跳转时，加 `<ClientRouter />`，见第 7 章。
- 交互组件仍然要下载对应框架的运行时。一个页面放三个 React 岛屿，React 只加载一次，但水合成本随岛屿数量增加。

判断一个项目适不适合用 Astro，看两条：

| 判断项 | 偏向 Astro | 偏向 SPA 框架 |
|---|---|---|
| 页面主要内容 | 已发布的文字、图片、商品信息 | 登录后的实时数据、复杂表单流程 |
| 单页交互密度 | 少量控件（搜索、点赞、购物车角标） | 大部分区域都在响应状态变化 |
| 数据来源 | 构建时可取（CMS、Markdown、接口快照） | 几乎全部要登录态和请求时取 |

两条都偏左，用 Astro 省事。都偏右，用 Remix、Next.js 这类框架更直接。

三种情况要把 Astro 排除掉：

- 团队只有 React 经验，项目又是一个重交互的后台系统。硬上 Astro 等于同时学两套心智模型，收益为负。
- 需要大量登录后的实时协作界面、复杂表单流程、客户端状态机。这些是 SPA 的强项，Astro 的岛屿模型反而碍事。
- 依赖某个只在 React 生态里存在的组件库，且它必须整页接管。嵌进 Astro 只能当孤岛用，还得处理样式和路由的断裂。

反过来说，Astro 的生态比 React 小得多，遇到问题能搜到的答案也少。选它之前先想清楚：要解决的问题是"内容展示得快"，还是"应用交互复杂"。前者是 Astro 的主场，后者不是。

## 1.2 版本基线

本书代码按下面这套环境核对：

| 项目 | 版本 | 说明 |
|---|---|---|
| Astro | 7.4.x | 2026 年 11 月核对 |
| Node.js | ≥ 22.23.4 | `astro@7` 的 `engines` 要求，低于此版本装不上 |
| 包管理器 | pnpm 10 或 npm 11 | 命令示例以 pnpm 为主，npm 等价 |

Astro 的主版本变化很快。v5 换了内容集合的入口文件，v6 把 Font API 转正，v7 移除了 `output: 'hybrid'`。网上大量教程还停留在 v4，看到 `entry.slug`、`entry.render()`、`<ViewTransitions />` 这类写法，先确认它对应的版本。

查当前版本：

```bash
pnpm view astro version
npx astro --version
```

## 1.3 环境准备

安装前确认 Node 版本：

```bash
node --version
# v22.23.4 或更高
```

版本不够时，`npm create astro@latest` 会在安装依赖阶段失败，报错大意是 `Astro requires Node.js v22.23.4 or higher`。用 nvm 或 fnm 切换版本：

```bash
fnm install 22
fnm use 22
```

编辑器推荐 VS Code 加官方 Astro 扩展，扩展 ID 是 `astro-build.astro-vscode`：

```bash
code --install-extension astro-build.astro-vscode
```

扩展提供 `.astro` 语法高亮、TypeScript 提示、诊断和格式化。没有扩展也能开发，只是模板里的表达式报错要等 `astro check` 才看得到。

## 1.4 创建项目

### 1.4.1 用 CLI 创建

```bash
pnpm create astro@latest
```

向导依次问六件事：

1. 项目目录名，例如 `my-astro-site`。
2. 模板：空白、博客、文档、作品集。博客模板自带内容集合和 RSS。
3. 是否使用 TypeScript，建议选是。
4. 是否初始化 Git。
5. 是否安装依赖。
6. 是否现在添加集成，可以先跳过。

常用标志：

```bash
# 跳过 Houston 动画
pnpm create astro@latest -- --skip-houston

# 指定模板
pnpm create astro@latest -- --template blog

# 全部使用默认答案
pnpm create astro@latest -- --yes

# 创建时加集成
pnpm create astro@latest -- --add tailwind --add react

# 目录非空时强制创建
pnpm create astro@latest -- --force
```

### 1.4.2 手动安装

在已有项目里加 Astro：

```bash
mkdir my-project && cd my-project
npm init -y
npm install astro
```

在 `package.json` 里加脚本：

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  }
}
```

建一个首页：

```bash
mkdir -p src/pages
cat > src/pages/index.astro <<'EOF'
<html>
  <body>
    <h1>Hello, Astro!</h1>
  </body>
</html>
EOF
npm run dev
```

这里容易出两个问题。第一，`src/pages` 目录不存在时 `astro dev` 直接报 `No pages found`，不会自动建目录。第二，`package.json` 里没有 `"type": "module"` 也能跑，但一旦自己写 `.mjs` 配置，缺少它会报 `Cannot use import statement outside a module`。

## 1.5 项目结构

```
my-astro-site/
├── src/
│   ├── pages/                  ← 文件即路由
│   │   ├── index.astro         → /
│   │   ├── about.astro         → /about
│   │   └── blog/
│   │       └── [id].astro      → /blog/任意 id
│   ├── components/             ← 可复用组件
│   ├── layouts/                ← 页面外壳
│   ├── content/                ← Markdown、JSON 内容
│   ├── content.config.ts       ← 内容集合定义
│   ├── assets/                 ← 需要优化的图片
│   ├── styles/                 ← 全局样式
│   └── middleware.ts           ← 中间件，可选
├── public/                     ← 原样复制到产物
├── astro.config.mjs            ← 框架配置
├── tsconfig.json
└── package.json
```

| 路径 | 作用 | 构建时怎么处理 |
|---|---|---|
| `src/pages/` | 页面，自动成为路由 | 编译成 HTML |
| `src/components/` | 可复用组件 | 不进路由，被引用时编译 |
| `src/layouts/` | 页面外壳 | 同组件 |
| `src/content/` | Markdown、JSON 等数据 | 由 `content.config.ts` 里的 loader 读取 |
| `src/assets/` | 需要处理的图片 | 构建时优化、加内容哈希 |
| `public/` | 文件名固定的文件 | 原样复制，不加哈希 |

`src/content/config.ts` 是 v4 的位置，v5 起改到 `src/content.config.ts`。两个位置放错了不会报错，只是集合定义不生效，`getCollection()` 返回空数组。

## 1.6 常用命令

```bash
pnpm dev                    # 开发服务器，默认 http://localhost:4321
pnpm dev --port 3000 --host # 自定义端口，并监听局域网
pnpm build                  # 构建到 dist/
pnpm preview                # 预览构建结果
npx astro sync              # 生成内容集合类型
npx astro check             # 类型检查
npx astro add react         # 添加集成
```

`astro sync` 生成两类产物：`.astro/types.d.ts` 和 `.astro/collections/<集合名>.schema.json`。编辑器提示消失、`getCollection()` 返回值变成 `any`，多半是没跑过它。

`astro check` 需要单独安装 `@astrojs/check` 和 `typescript`，否则提示 `astro check is not available in this project`。

## 1.7 第一个页面

建 `src/pages/index.astro`：

```astro
---
const pageTitle = "我的 Astro 网站";
const items = ["Astro", "React", "Vue", "Svelte"];
---

<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{pageTitle}</title>
  </head>
  <body>
    <main>
      <h1>Hello, World!</h1>
      <ul>
        {items.map((item) => <li>{item}</li>)}
      </ul>
    </main>
  </body>
</html>
```

`---` 之间的代码在构建时（或开启 SSR 后请求时）执行一次，不会进入浏览器。模板里的 `{}` 表达式也在同一侧求值。这段代码执行的时机决定了它能做什么：能读文件、查数据库、调用内部接口，不能碰 `window` 和 `document`。

打开 http://localhost:4321，看到的 HTML 里已经有 `<li>` 列表。查看源代码可以确认这一点，这是 Astro 与客户端渲染框架最直观的区别。

## 1.8 本章小结

- Astro 面向内容和展示，默认输出 HTML，交互组件按需水合。
- 适用判断看两条：内容是否已发布、单页交互密度是否低。
- 版本基线是 Astro 7.4.x 与 Node ≥ 22.23.4，版本不符时装不上。
- 内容集合定义放在 `src/content.config.ts`，不是 `src/content/config.ts`。
- `.astro` 文件的脚本段在服务端执行，模板表达式同侧求值。

下一章讲组件语法：模板表达式、Props、插槽，以及脚本在什么时候执行。
