# Astro 从入门到进阶教程

## 第一章：Astro 简介与安装

### 1.1 什么是 Astro？

Astro 是专为构建**内容驱动型网站**（博客、营销网站、电商网站、文档站等）而设计的现代化 Web 框架。它的核心理念是：**默认零 JavaScript，仅在必要时发送代码到浏览器**。

Astro 由五大设计原则驱动：

| 原则 | 说明 |
|---|---|
| **内容驱动** | 专为展示丰富内容的网站设计，而非 Web 应用 |
| **服务端优先** | 采用 MPA（多页应用）架构，渲染在服务端完成 |
| **默认极速** | 比 React 同类框架快 40%，JavaScript 减少 90% |
| **易于使用** | `.astro` 语法是 HTML 超集，无需学习框架特有概念 |
| **开发者友好** | 出色的 CLI、VS Code 扩展、14 种语言文档、活跃 Discord |

### 1.2 为什么选择 Astro？

**七大核心功能亮点**：

1. **群岛架构**：独创的组件渲染策略，静态 HTML 海洋中嵌入交互岛屿
2. **UI 框架无关**：支持 React、Preact、Svelte、Vue、SolidJS、Alpine.js、HTMX、Web Components
3. **服务端优先渲染**：将重型计算从用户设备移走
4. **默认零 JavaScript**：输出纯 HTML/CSS，仅交互组件加载 JS
5. **内容集合系统**：类型安全的 Markdown 内容管理，Zod Schema 验证
6. **视图过渡动画**：无需前端框架即可实现 SPA 级页面过渡
7. **Astro DB**：专为 Astro 设计的全托管 SQL 数据库

**与主流框架的对比**：

| 对比维度 | Astro | Next.js / Nuxt / SvelteKit |
|---|---|---|
| 定位 | 内容驱动网站 | Web 应用程序 |
| 架构 | MPA（多页应用） | SPA（单页应用） |
| 渲染策略 | 服务端优先，默认零 JS | 客户端渲染为主 |
| JavaScript 负载 | 极低（减少 ~90%） | 较高 |
| 学习曲线 | 低（HTML 超集） | 中高 |
| 适用场景 | 博客、文档、营销站、电商 | 仪表盘、SaaS、复杂交互 |

> 数据支撑：每快 100ms，转化率增加 1%。Astro 网站平均加载速度比 React 框架快 40%。

### 1.3 环境要求

安装 Astro 前，你的电脑需要：

- **Node.js**：`v18.20.8` 或更高版本（推荐 v22.12.0+）
- **包管理器**：推荐 `pnpm`，也支持 `npm` 和 `yarn`
- **文本编辑器**：推荐 VS Code + 官方 Astro 扩展

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version
```

### 1.4 创建第一个 Astro 项目

#### 方式一：使用 CLI 创建（推荐）

```bash
# npm
npm create astro@latest

# pnpm（推荐）
pnpm create astro@latest

# yarn
yarn create astro
```

CLI 向导会依次询问：

1. **项目名称**：输入目录名称（如 `my-astro-site`）
2. **模板选择**：
   - `a` — 基础空白模板
   - `b` — 博客模板（含内容集合和 RSS）
   - `c` — 文档模板
   - `d` — 端口（Portfolio）模板
3. **TypeScript**：推荐选择 `Yes`（严格模式）
4. **初始化 Git**：推荐 `Yes`
5. **安装依赖**：选择 `Yes`
6. **添加集成**：可跳过，后续用 `npx astro add` 添加

#### CLI 标志速查

```bash
# 跳过动画快速安装
npm create astro@latest -- --skip-houston

# 指定模板安装
npm create astro@latest -- --template blog

# 回答所有问题为 yes
npm create astro@latest -- --yes

# 创建时直接添加集成
npm create astro@latest -- --add tailwind --add react

# 空目录强制安装
npm create astro@latest -- --force
```

#### 方式二：手动安装

如果想在现有项目中添加 Astro：

```bash
# 1. 创建目录
mkdir my-project && cd my-project

# 2. 初始化 package.json
npm init -y

# 3. 本地安装 Astro
npm install astro

# 4. 添加 npm scripts
# 在 package.json 的 scripts 中添加：
# "dev": "astro dev",
# "start": "astro dev",
# "build": "astro build",
# "preview": "astro preview"

# 5. 创建首页
mkdir -p src/pages
echo "<html><body><h1>Hello, Astro!</h1></body></html>" > src/pages/index.astro

# 6. 启动开发服务器
npm run dev
```

### 1.5 项目结构详解

```
my-astro-site/
├── src/
│   ├── pages/              ← 页面路由（文件即路由）
│   │   ├── index.astro     → /
│   │   ├── about.astro     → /about
│   │   └── blog/
│   │       └── [slug].astro → /blog/任意文章
│   ├── components/         ← 可复用组件
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   └── Card.astro
│   ├── layouts/            ← 页面布局
│   │   └── BaseLayout.astro
│   ├── content/            ← 内容集合
│   │   ├── blog/
│   │   │   └── post-1.md
│   │   └── config.ts
│   ├── assets/             ← 需要优化的资源（图片等）
│   │   └── hero.jpg
│   ├── styles/             ← 全局样式
│   │   └── global.css
│   └── middleware.ts       ← 请求中间件（可选）
├── public/                 ← 原样复制的静态文件
│   ├── favicon.ico
│   └── robots.txt
├── db/                     ← Astro DB 数据库定义（可选）
│   ├── config.ts
│   └── seed.ts
├── astro.config.mjs        ← Astro 核心配置
├── tsconfig.json           ← TypeScript 配置
└── package.json
```

**各目录职责**：

| 路径 | 作用 | 特点 |
|---|---|---|
| `src/pages/` | 网站页面 | 自动成为路由，支持 `.astro`/`.md`/`.mdx` |
| `src/components/` | 可复用组件 | 不自动成为页面 |
| `src/layouts/` | 页面布局 | 定义页面外壳和公共结构 |
| `src/content/` | 内容集合 | 类型安全的 Markdown/JSON/YAML 管理 |
| `src/assets/` | 需优化的静态资源 | 图片会自动优化，可导入使用 |
| `public/` | 原始静态文件 | 直接复制到构建产物，不做处理 |

### 1.6 开发与构建命令

```bash
# 启动开发服务器
npm run dev            # 默认 http://localhost:4321

# 自定义端口和主机
npm run dev -- --port 3000 --host

# 构建生产版本
npm run build          # 默认输出到 dist/

# 预览构建结果（本地服务器）
npm run preview

# 同步内容集合类型（手动触发）
npx astro sync

# 添加集成
npx astro add tailwind
npx astro add react
npx astro add vue

# 检查 Astro 版本
npx astro --version
```

### 1.7 编辑器配置

安装 **Astro VS Code 扩展**（ID: `astro-build.astro-vscode`），获得：

- `.astro` 文件语法高亮
- TypeScript 智能提示和自动补全
- 内建 Prettier 格式化
- 错误诊断和悬停提示

```bash
code --install-extension astro-build.astro-vscode
```

### 1.8 快速上手：你的第一个页面

创建 `src/pages/index.astro`：

```astro
---
// --- 代码围栏中的代码在服务端执行 ---
const pageTitle = "我的 Astro 网站"
const greeting = "Hello, World!"
const items = ["Astro", "React", "Vue", "Svelte"]
---

<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{pageTitle}</title>
  </head>
  <body>
    <main>
      <h1>{greeting}</h1>
      <p>欢迎来到我的第一个 Astro 网站。</p>
      <ul>
        {items.map(item => <li>{item}</li>)}
      </ul>
    </main>
  </body>
</html>
```

```bash
# 启动并查看效果
npm run dev
# 打开浏览器访问 http://localhost:4321
```

### 本章小结

- Astro 是**服务端优先、默认零 JS**的内容驱动框架
- 安装只需 `npm create astro@latest`，不到 1 分钟
- 项目结构清晰，`src/pages/` 即路由，`src/components/` 即组件
- VS Code 扩展提供一流的开发体验
- 适合博客、文档站、营销网站、电商等场景

下一章我们将深入学习 Astro 组件的完整语法。