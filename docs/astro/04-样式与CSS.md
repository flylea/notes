# 第 4 章 样式与 CSS

## 4.1 作用域样式

`.astro` 文件里的 `<style>` 默认只作用于当前组件，不会泄漏到别处。

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
  header {
    background: #333;
    color: white;
    padding: 1rem;
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

实现方式不是 Shadow DOM，是属性选择器。编译后每个元素多一个 `data-astro-cid-*` 属性，选择器被改写成这样：

```html
<header data-astro-cid-jpvhi6sc>
  <h1 data-astro-cid-jpvhi6sc>网站标题</h1>
</header>
<style>
  header[data-astro-cid-jpvhi6sc] { background: #333; }
</style>
```

由此带出三条限制：

- 子组件内部的元素拿不到父组件的 scoped 样式，需要 `:global()` 或把样式写进子组件。
- 通过 `set:html` 注入的 HTML 不带 `data-astro-cid`，作用域样式对它无效。
- 选择器特异性增加了一个属性，比纯 class 选择器高一级。覆盖这类样式时权重需要算清楚。

### 4.1.1 作用域策略

```js
export default defineConfig({
  scopedStyleStrategy: 'attribute', // 默认，用 data-astro-cid 属性
  // scopedStyleStrategy: 'class',   // 用生成的 class
  // scopedStyleStrategy: 'where',   // 包在 :where() 里，特异性为 0
});
```

三者的差别在特异性：

| 策略 | 产物 | 特异性 | 适用 |
|---|---|---|---|
| `attribute` | `h1[data-astro-cid-x]` | 0-1-1 | 默认，够用 |
| `class` | `h1.astro-x` | 0-1-1 | 需要给元素加 class 时 |
| `where` | `:where(h1[data-astro-cid-x])` | 0-0-0 | 组件库，方便外部覆盖 |

做组件库时选 `where`，使用者能用一条普通 class 覆盖你的样式。应用内部用默认值，避免样式互相踩。

## 4.2 全局样式

三种方式，用途不同。

局部样式里要影响子内容，用 `:global()`：

```astro
---
// BlogPost.astro
---

<article class="article">
  <slot />
</article>

<style>
  .article {
    max-width: 800px;
    margin: 0 auto;
  }

  .article :global(h1) {
    color: #2563eb;
    border-bottom: 2px solid #e5e7eb;
  }

  .article :global(p) {
    line-height: 1.8;
  }
</style>
```

`:global(h1)` 只对 `.article` 内部生效，`.article` 本身仍然带作用域。写 `:global(.article h1)` 就彻底放开，影响全站所有 `.article h1`，这两种写法效果差很多。

全站基础样式用 `<style is:global>` 或直接导入 CSS 文件：

```astro
---
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

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  color: var(--color-text);
  background: var(--color-bg);
}
```

导入的 CSS 是全局的。放在布局组件里导入一次，全站生效。放在某个普通组件里导入，只有这个组件被渲染时才加载，但样式作用范围仍是全局。

## 4.3 从脚本传值给 CSS

`define:vars` 把脚本段的值变成 CSS 变量：

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
  }
</style>
```

`define:vars` 的实现是把变量名加上 `--` 写成内联 `style` 属性，所以：

- 值必须是字符串或能序列化的数字，传对象会变成 `[object Object]`。
- 变量名区分大小写，`var(--foregroundcolor)` 取不到值，颜色会回退到继承值，页面不报错。
- 每个组件实例都会输出一份内联样式，列表里循环 100 次就有 100 份，这类场景改用 `style` 属性或 class。

## 4.4 class:list

`class:list` 用来按条件拼接 class，接受数组、对象或混合：

```astro
---
const isActive = true;
const type = 'primary';
const hasError = false;
---

<div class:list={['base-class', isActive && 'active', `type-${type}`]}>
  数组写法
</div>

<div class:list={{ 'base-class': true, 'is-active': isActive, 'has-error': hasError }}>
  对象写法
</div>
```

值为 `false`、`null`、`undefined`、空字符串的项会被丢掉，不用自己写三元。`class` 和 `class:list` 同时出现时，`class` 优先，`class:list` 被忽略。

## 4.5 CSS Modules 与外部样式表

CSS Modules 把类名编译成局部名字：

```astro
---
import styles from '../styles/Button.module.css';
---

<button class={styles.button}>
  <span class={styles.label}>提交</span>
</button>
```

外部样式表用 `<link>`：

```astro
<link rel="stylesheet" href="/styles/normalize.css" />
```

`/styles/...` 指向 `public/` 里的文件。要被打包、压缩、加哈希的样式放 `src/` 里用 `import`，需要固定 URL 的放 `public/`。

## 4.6 预处理器

Sass 和 Less 需要装对应包，Astro 检测到 `lang` 属性后用 Vite 的预处理器处理：

```bash
npm install -D sass
```

```astro
<style lang="scss">
  $primary: #2563eb;

  .container {
    max-width: 1200px;

    h1 {
      color: $primary;
    }
  }
</style>
```

Less 装 `less`，Stylus 装 `stylus`，`lang` 分别写 `less`、`styl`。装错包时构建报：

```
Preprocessor dependency "sass" not found. Did you install it?
```

Sass 的每个 `<style lang="scss">` 都是独立编译单元。要共享变量，用一个 `_variables.scss` 并 `@use` 进去，不能依赖上层的变量。

## 4.7 Tailwind CSS

Astro 5.2 之后，`astro add tailwind` 装的是 Tailwind 4 加 Vite 插件，不再是 Astro 集成：

```bash
npx astro add tailwind
```

命令做三件事：装 `tailwindcss` 与 `@tailwindcss/vite`，在 `astro.config.mjs` 里注册 `tailwindcss()` 插件，生成 `src/styles/global.css` 并写入 `@import "tailwindcss";`。Tailwind 4 没有 `tailwind.config.mjs`，配置写在 CSS 里：

```css
/* src/styles/global.css */
@import "tailwindcss";

@theme {
  --color-brand: #2563eb;
  --font-sans: "Inter", sans-serif;
}
```

然后在布局里导入这个文件，类名即可使用：

```astro
---
import '../styles/global.css';
---

<div class="min-h-screen bg-gray-100 dark:bg-gray-900">
  <h1 class="text-4xl font-bold hover:text-brand">标题</h1>
</div>
```

在组件的 `<style>` 里用 `@apply` 会失败，Tailwind 4 的编译单元是隔离的：

```
Error: Cannot apply unknown utility class `flex`.
```

修法是在 `<style>` 顶部加一行 `@reference "../styles/global.css";`。更好的做法是少用 `@apply`，直接在模板里写类名。

老项目里可能见到 `@astrojs/tailwind` 集成和 `tailwind.config.mjs`，那是 Tailwind 3 的装法，官方目前仍支持但属于遗留方案。判断方法看依赖：有 `@astrojs/tailwind` 就是 Tailwind 3。

## 4.8 暗色模式

用 CSS 变量做两套取值，切换时只改根元素的 class：

```css
/* src/styles/theme.css */
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-card: #f3f4f6;
  --color-border: #e5e7eb;
}

html.dark {
  --color-bg: #111827;
  --color-text: #f3f4f6;
  --color-card: #1f2937;
  --color-border: #374151;
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --color-bg: #111827;
    --color-text: #f3f4f6;
    --color-card: #1f2937;
    --color-border: #374151;
  }
}
```

切换组件需要在首帧前读到用户的主题偏好，否则会闪白：

```astro
---
// ThemeToggle.astro
---

<button id="theme-toggle" aria-label="切换主题">
  <span class="light-label">浅色</span>
  <span class="dark-label">深色</span>
</button>

<script is:inline>
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  }

  document.getElementById('theme-toggle').addEventListener('click', () => {
    root.classList.toggle('dark');
    localStorage.setItem('theme', root.classList.contains('dark') ? 'dark' : 'light');
  });
</script>

<style>
  html:not(.dark) .dark-label { display: none; }
  html.dark .light-label { display: none; }
</style>
```

这段脚本必须用 `is:inline`，理由有两个。它要抢在首帧渲染前执行，走打包会把脚本推到模块加载之后；另外主题 class 要在 CSS 生效前就加上，否则页面先以浅色渲染再切深色。

## 4.9 PostCSS

需要浏览器前缀或压缩时，加 `postcss.config.cjs`：

```js
module.exports = {
  plugins: {
    autoprefixer: {},
    cssnano: { preset: 'default' },
  },
};
```

对象写法比数组写法更常用，插件顺序由对象键顺序决定。`cssnano` 在开发模式下也会跑，改样式后的热更新会变慢，建议只给构建开启：

```js
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  plugins: {
    autoprefixer: {},
    ...(isProd ? { cssnano: { preset: 'default' } } : {}),
  },
};
```

## 4.10 有约束的几条实践

- 组件内部样式写在组件的 `<style>` 里。样式和模板离得近，删组件时不会留下孤儿 CSS。
- 全局只放三样东西：reset、CSS 变量、排版基线。其余都收进组件。
- 主题用 CSS 变量，不要在组件里判断 `prefers-color-scheme`，判断集中在一处。
- 覆盖第三方组件样式时，先确认对方用的是 `attribute` 还是 `where` 策略。后者一条 class 就够，前者要提特异性。
- 图片用 `<Image />` 而不是 `background-image`，构建期能做尺寸和格式优化，见第 6 章。

## 4.11 什么时候别这么写

上面这些是默认路径，不是唯一路径。下面几种情况绕开它们更省事：

- **设计系统级别的视觉规范**：把颜色、间距、字号全部写成 CSS 变量，再用一个全局样式表统一入口。散在几十个组件里各自定义变量，比集中管理难维护得多。
- **覆盖第三方组件的内部结构**：不要靠提高特异性去赢，`.wrapper .inner .btn` 这种写法的维护成本远超收益。要么让第三方组件接受类名参数，要么包一层自己的组件。
- **大量 `:global()`**：`:global()` 用多了说明组件边界没划清。出现超过三处，就该考虑把这段样式提成一个独立组件，而不是继续在全局放规则。
- **`define:vars` 传大对象**：它把值序列化后内联进 `<style>`，对象越大 HTML 越大，而且每次渲染都要序列化一次。需要多个动态值时，改成写 CSS 变量。
- **严格 CSP 的项目**：`security.csp` 打开后，内联样式要带 hash 才能执行，`define:vars` 生成的内联样式会被拦。这类项目里用 CSS 变量，别用内联样式。
- **极小的静态页**：一个页面只用到五十行 CSS，还在为它引 Tailwind，构建产物反而更大。这种情况直接写 CSS 更快。

## 4.12 本章小结

- `<style>` 默认作用域，实现是 `data-astro-cid` 属性选择器。
- 作用域样式管不到子组件和 `set:html` 的内容。
- `:global()` 只放开选择器的一部分，写位置不同影响范围不同。
- `define:vars` 是内联样式，别在循环里用。
- Tailwind 4 走 Vite 插件，配置写在 CSS 的 `@theme` 里，`@apply` 需要 `@reference`。
- 暗色模式切换脚本要 `is:inline`，否则首帧会闪。

下一章讲内容集合：Markdown 怎么声明 schema、怎么查询、怎么渲染。
