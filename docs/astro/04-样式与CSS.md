## 第四章：样式与 CSS

### 4.1 组件作用域样式（Scoped Styles）

Astro 中所有 `<style>` 标签**默认自动作用域隔离**，样式只对当前组件生效，不会泄漏到其他组件。

```astro
---
// Header.astro
---

<header>
  <h1>网站标题</h1>
  <nav>
    <a href="/">首页</a>
    <a href="/blog">博客</a>
  </nav>
</header>

<style>
  /* 这些样式仅对当前 Header 组件生效 */
  header {
    background: #333;
    color: white;
    padding: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  nav a {
    color: #ccc;
    text-decoration: none;
    margin-left: 1rem;
  }

  nav a:hover {
    color: white;
  }
</style>
```

**编译后效果**：Astro 会给每个元素添加唯一的 `data-astro-cid-*` 属性，实现 CSS 隔离：

```html
<header data-astro-cid-jpvhi6sc>
  <h1 data-astro-cid-jpvhi6sc>网站标题</h1>
  ...
</header>
<style>
  h1[data-astro-cid-jpvhi6sc] { margin: 0; font-size: 1.5rem; }
</style>
```

#### 作用域样式策略

```js
// astro.config.mjs
export default defineConfig({
  scopedStyleStrategy: 'attribute',  // 默认：使用 data-astro-cid 属性
  // scopedStyleStrategy: 'class',   // 使用 CSS class 代替属性
  // scopedStyleStrategy: 'where',   // 使用 :where() 降低特异性
});
```

### 4.2 全局样式

#### 方式一：`<style is:global>`

```astro
<style is:global>
  /* 完全取消作用域，样式全局生效 */
  body {
    font-family: 'Segoe UI', sans-serif;
    margin: 0;
    padding: 0;
  }

  * {
    box-sizing: border-box;
  }
</style>
```

#### 方式二：`:global()` 选择器

在一个作用域样式中混合使用局部和全局样式：

```astro
<!-- BlogPost.astro -->
<style>
  /* 局部样式（仅当前组件） */
  .article {
    max-width: 800px;
    margin: 0 auto;
  }

  /* 全局选择器：影响 .article 内部所有 h1（包括子组件内容） */
  .article :global(h1) {
    color: #2563eb;
    border-bottom: 2px solid #e5e7eb;
  }

  .article :global(p) {
    line-height: 1.8;
  }

  .article :global(pre) {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
  }
</style>
```

#### 方式三：导入全局 CSS 文件

```astro
---
// 在组件脚本中导入
import '../styles/global.css';
---
```

```css
/* src/styles/global.css */
:root {
  --color-primary: #2563eb;
  --color-text: #1f2937;
  --color-bg: #ffffff;
}

body {
  color: var(--color-text);
  background: var(--color-bg);
}
```

### 4.3 CSS 变量与 `define:vars`

将组件脚本中的 JavaScript 变量传入 CSS：

```astro
---
const foregroundColor = "rgb(221 243 228)";
const backgroundColor = "rgb(24 121 78)";
const paddingSize = "1rem";
---

<h1>使用 CSS 变量</h1>

<style define:vars={{ foregroundColor, backgroundColor, paddingSize }}>
  h1 {
    color: var(--foregroundColor);
    background-color: var(--backgroundColor);
    padding: var(--paddingSize);
    border-radius: 8px;
  }
</style>
```

### 4.4 `class:list` 动态类名

`class:list` 是 Astro 模板指令，用于动态组合 class 属性：

```astro
---
const isActive = true;
const type = 'primary';
const hasError = false;
---

<!-- 数组语法 -->
<div class:list={['base-class', isActive && 'active', `type-${type}`]}>
  动态 class
</div>

<!-- 对象语法 -->
<div class:list={{
  'base-class': true,
  'is-active': isActive,
  'has-error': hasError,
  [type]: true,
}}>
  条件 class
</div>

<!-- 混合语法 -->
<button class:list={[
  'btn',
  {
    'btn-primary': type === 'primary',
    'btn-secondary': type === 'secondary',
    'btn-disabled': isDisabled,
  },
]}>
  按钮
</button>
```

### 4.5 外部样式方案

#### CSS Modules

```astro
---
import styles from '../styles/Button.module.css';
---

<button class={styles.button}>
  <span class={styles.label}>提交</span>
</button>
```

#### 导入样式文件

```astro
---
// 在脚本中导入 CSS 文件
import '../styles/reset.css';
---
```

#### 外部样式表（link标签）

```astro
<link rel="stylesheet" href="/styles/normalize.css" />
<link rel="stylesheet" href="https://cdn.example.com/framework.css" />
```

### 4.6 CSS 预处理器

#### Sass / SCSS

```bash
npm install sass
```

```astro
<style lang="scss">
  $primary: #2563eb;
  $spacing: 1rem;

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: $spacing;

    h1 {
      color: $primary;

      &:hover {
        opacity: 0.8;
      }
    }
  }
</style>
```

#### Less

```bash
npm install less
```

```astro
<style lang="less">
  @primary: #2563eb;

  .btn {
    background: @primary;
    &.large {
      padding: 1rem 2rem;
    }
  }
</style>
```

#### Stylus

```bash
npm install stylus
```

### 4.7 CSS 框架集成

#### Tailwind CSS

```bash
npx astro add tailwind
```

该命令会自动：
1. 安装 `@astrojs/tailwind` 和 `tailwindcss`
2. 更新 `astro.config.mjs`
3. 创建 `tailwind.config.mjs`

```astro
---
// 安装后直接使用 Tailwind 类
---

<div class="min-h-screen bg-gray-100 dark:bg-gray-900">
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-4xl font-bold text-gray-900 dark:text-white
               hover:text-blue-600 transition-colors">
      欢迎使用 Tailwind + Astro
    </h1>

    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold">卡片 1</h2>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold">卡片 2</h2>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold">卡片 3</h2>
      </div>
    </div>
  </div>
</div>
```

#### UnoCSS

```bash
npm install unocss
```

```astro
---
import 'uno.css';
---

<div class="p-4 bg-blue-500 text-white rounded-lg">
  UnoCSS 样式
</div>
```

### 4.8 主题与暗色模式

Astro 天然支持多种暗色模式方案。

#### CSS 自定义属性方案

```css
/* src/styles/theme.css */
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-primary: #2563eb;
  --color-card: #f3f4f6;
  --color-border: #e5e7eb;
}

html.dark {
  --color-bg: #111827;
  --color-text: #f3f4f6;
  --color-primary: #3b82f6;
  --color-card: #1f2937;
  --color-border: #374151;
}

/* 跟随系统偏好 */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --color-bg: #111827;
    --color-text: #f3f4f6;
    --color-primary: #3b82f6;
    --color-card: #1f2937;
    --color-border: #374151;
  }
}
```

#### 使用主题变量

```astro
---
import '../styles/theme.css';
---

<style>
  body {
    background: var(--color-bg);
    color: var(--color-text);
  }

  .card {
    background: var(--color-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 1rem;
  }
</style>
```

#### 主题切换组件

```astro
---
// ThemeToggle.astro
---

<button id="theme-toggle" aria-label="切换主题">
  <span class="light-icon">☀️</span>
  <span class="dark-icon">🌙</span>
</button>

<script>
  const toggle = document.getElementById('theme-toggle');
  const root = document.documentElement;

  // 初始化
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  }

  // 切换
  toggle.addEventListener('click', () => {
    root.classList.toggle('dark');
    localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
  });
</script>

<style>
  html:not(.dark) .dark-icon { display: none; }
  html.dark .light-icon { display: none; }
</style>
```

### 4.9 PostCSS 集成

Astro 内建 PostCSS 支持。创建 `postcss.config.cjs` 即可：

```js
// postcss.config.cjs
module.exports = {
  plugins: [
    require('autoprefixer'),
    require('cssnano')({
      preset: 'default',
    }),
  ],
};
```

### 4.10 样式最佳实践

1. **优先使用作用域样式**：避免全局污染，样式内聚性好
2. **全局样式集中管理**：在 `src/styles/global.css` 中管理全局样式
3. **使用 CSS 变量做主题**：便于暗色模式和多主题切换
4. **图片使用 `astro:assets`**：自动优化，比 CSS `background-image` 更好
5. **生产环境压缩**：通过 PostCSS cssnano 或框架自带

```astro
---
// 🌟 完整组件示例：样式整合
import '../styles/theme.css';

const variant = 'primary';
---

<div class="component-wrapper">
  <h2 class="title">样式示例</h2>
  <button class:list={['btn', `btn-${variant}`]}>操作按钮</button>
</div>

<style>
  .component-wrapper {
    padding: 2rem;
    border-radius: 12px;
  }

  .title {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-secondary {
    background: var(--color-card);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
</style>
```

### 本章小结

- **作用域样式**是 Astro 的默认行为，实现组件级样式隔离
- **全局样式**通过 `is:global`、`:global()` 选择器或全局 CSS 文件实现
- **`class:list`** 提供强大的动态类名组合能力
- **Sass / Less** 开箱可用，只需安装依赖
- **Tailwind CSS** 通过 `npx astro add tailwind` 一键集成
- **CSS 变量 + `define:vars`** 实现 JS 到 CSS 的数据传递
- **暗色模式**可用 CSS 变量轻松实现，无需额外依赖

下一章学习 Astro 的内容集合系统——类型安全的内容管理。