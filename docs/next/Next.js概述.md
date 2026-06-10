1.1 什么是 Next.js

Next.js 是一个用于构建全栈 Web 应用的 React 框架。使用 React 组件来构建用户界面，而 Next.js 则提供额外的特性和优化。

Next.js 会自动配置底层工具（如打包工具和编译器），让你可以专注于构建产品和快速交付。

无论你是个人开发者还是大型团队的一员，Next.js 都能帮助你构建交互性强、动态且快速的 React 应用。

核心特性包括：

- 服务端渲染（SSR）：在服务器端渲染页面，提升首屏加载性能和 SEO
- 静态生成（SSG）：在构建时预渲染页面，适合内容不变的页面
- 文件系统路由：基于文件结构自动生成路由，无需额外配置
- 自动代码分割：根据路由自动分割 JavaScript bundle，减少初始加载体积
- 内置 CSS 和图片优化：开箱即用的样式和图像处理能力
- API Routes：轻松创建 API 端点，构建全栈应用
- 热模块替换（HMR）：开发时修改即见，提升开发体验
  
1.2 App Router 与 Pages Router

Next.js 有两种不同的路由系统：

特性
App Router
Pages Router
发布时间
Next.js 13 引入
最早的支持方式
React Server Components
支持
不支持
文件系统约定
app/ 目录
pages/ 目录
布局系统
支持嵌套布局
需手动处理
推荐程度
推荐使用
仍被支持，持续改进

App Router 是新一代路由，基于 React Server Components 构建，支持 layouts（布局）、嵌套路由、loading states（加载状态）、error handling（错误处理）等特性。

Pages Router 是原有的路由方式，至今仍被支持并在持续改进，适合已有项目或习惯旧方式的开发者。

1.3 版本与 React 版本处理

App Router 和 Pages Router 处理 React 版本的方式不同：

- App Router：内置使用 React Canary 版本，这些版本包含了所有稳定的 React 19 变更，以及在框架中验证过的新特性，在新版本 React 发布之前就已可用。
- Pages Router：使用项目中 package.json 内安装的 React 版本。
  
这种方式确保了 App Router 中新 React 特性的可靠运行，同时为现有 Pages Router 应用保持了向后兼容性。

1.4 前置知识要求

文档假设你对 Web 开发有一定了解。在开始之前，建议你熟悉以下内容：

- HTML：超文本标记语言，网页结构的基础
- CSS：层叠样式表，用于控制网页的视觉效果和布局
- JavaScript：网页的编程语言，实现交互功能
- React：用于构建用户界面的 JavaScript 库
  
如果你是 React 新手或需要复习，推荐从 Next.js 官方的 React Foundations 课程 开始，然后学习 Next.js Foundations 课程，该课程通过构建实际应用来学习 Next.js。

1.5 术语表

以下是本章及后续章节中会遇到的核心术语解释：

A

App Router：Next.js 13 引入的路由系统，构建于 React Server Components 之上，使用文件系统路由，支持布局、嵌套路由、加载状态、错误处理等特性。

B

Build time（构建时间）：应用程序被编译的阶段。在构建时间，Next.js 将代码转换为优化的生产文件，生成静态页面，并准备部署资源。

C

Cache Components：一种使用 "use cache" 指令启用组件和函数级缓存的功能。允许在单个路由中混合静态、缓存和动态内容。配置缓存时长使用 cacheLife()，使用 cacheTag() 标记数据，通过 updateTag() 按需失效。

Client Component（客户端组件）：在浏览器中运行的 React 组件。在 Next.js 中，客户端组件也可以在初始页面生成时在服务器端渲染。客户端组件可以使用状态、副作用、事件处理程序和浏览器 API，通过在文件顶部添加 "use client" 指令来标记。

Client-side navigation（客户端导航）：页面内容动态更新而无需完全重新加载的导航技术。Next.js 使用 <Link> 组件实现客户端导航，保持共享布局的交互性并保留浏览器状态。

Code Splitting（代码分割）：将应用程序按路由划分为更小的 JavaScript 块的过程。无需一次性加载所有代码，只加载当前路由所需的代码，减少初始加载时间。Next.js 会根据路由自动执行代码分割。

D

Dynamic rendering（动态渲染）：在请求时间而非构建时间渲染组件。当组件使用请求时 API（如 cookies()、headers()、searchParams）时会变为动态渲染。

Dynamic route segments（动态路由段）：从请求时的数据生成的路由段。通过将文件夹名称包裹在方括号中创建（如 [slug]），允许从博客文章或产品页面等动态数据创建路由。

E

Environment Variables（环境变量）：在构建时间或请求时间可访问的配置值。在 Next.js 中，以 NEXT_PUBLIC_ 为前缀的变量会暴露给浏览器，其他变量仅在服务器端可用。

Error Boundary（错误边界）：一种 React 组件，用于捕获其子组件树中的 JavaScript 错误并显示备用 UI。在 Next.js 中，创建 error.js 文件会自动将路由段包裹在错误边界中。

F

Font Optimization（字体优化）：使用 next/font 实现自动字体优化。Next.js 会自托管字体、消除布局偏移并应用性能最佳实践。支持 Google Fonts 和本地字体文件。

H

Hydration（水合）：React 将事件处理程序附加到 DOM 以使服务端渲染的静态 HTML 具有交互性的过程。在水合期间，React 协调服务端标记和客户端 JavaScript。

I

Incremental Static Regeneration (ISR)（增量静态再生成）：一种允许在不重建整个站点的情况下更新静态内容的技术。ISR 允许在每个页面的基础上使用静态生成，同时在流量涌入时在后台重新验证页面。

Intercepting Routes（拦截路由）：一种路由模式，允许从应用程序的另一部分在当前布局内加载路由。用于显示内容（如模态框）而无需用户切换上下文，同时保持 URL 可分享。

Image Optimization（图片优化）：使用 <Image> 组件实现自动图片优化。Next.js 按需优化图片，以 WebP 等现代格式提供服务，并自动处理懒加载和响应式尺寸调整。

L

Layout（布局）：多个页面之间共享的 UI。布局保持状态、在导航时不重新渲染。通过从 layout.js 文件导出一个 React 组件来定义。

Loading UI（加载 UI）：在路由段加载时显示的备用 UI。通过将 loading.js 文件添加到文件夹来创建，它会自动将页面包裹在 Suspense 边界中。

M

Metadata（元数据）：浏览器和搜索引擎使用的关于页面的信息，如标题、描述和 Open Graph 图片。在 Next.js 中，可以使用 metadata 导出或 generateMetadata 函数来定义元数据。

Memoization（记忆化）：缓存函数返回值的过程，这样在一次渲染过程（请求）中多次调用相同函数只执行一次。在 Next.js 中，具有相同 URL 和选项的 fetch GET 请求会在 Server Components、layouts、pages 和 generateMetadata/generateStaticParams 中自动记忆化。

Middleware（中间件）：参见 Proxy。

N

Not Found（404）：当路由不存在或调用 notFound() 函数时显示的特殊组件。通过在 app 目录中添加 not-found.js 文件来创建。

P

Page（页面）：路由独有的 UI。通过在 app 目录中的 page.js 文件导出 React 组件来定义。

Parallel Routes（并行路由）：允许在相同布局中同时或有条件地渲染多个页面的模式。使用 @folder 约定创建命名插槽，适用于仪表板、模态框和复杂布局。

Partial Prerendering (PPR)（部分预渲染）：将预渲染和动态渲染组合在单个路由中的渲染优化。静态 shell 会立即提供服务，而动态内容在就绪时流式传输。

Prefetching（预取）：在用户导航到路由之前在后台加载路由。Next.js 会自动在链接进入视口时使用 <Link> 组件预取路由，使导航感觉即时。

Prerendering（预渲染）：在构建时间或重新验证期间在后台渲染组件。结果是 HTML 和 RSC Payload，可以缓存并从 CDN 提供服务。对于不使用请求时 API 的组件，预渲染是默认设置。

Proxy（代理）：在请求完成之前在服务器上运行代码的文件（proxy.js）。用于实现日志、重定向和重写等服务器端逻辑 formerly known as Middleware。

R

Redirect（重定向）：将用户从一个 URL 发送到另一个 URL。在 Next.js 中，可以在 next.config.js 中配置重定向，从 Proxy 返回，或使用 redirect() 函数以编程方式触发。

Request-time APIs（请求时 API）：访问请求特定数据的函数，会导致组件选择动态渲染。这些包括 cookies()、headers()、searchParams 和 draftMode()。

Revalidation（重新验证）：更新缓存数据的过程。可以是基于时间的（使用 cacheLife() 设置缓存时长）或按需的（使用 cacheTag() 标记数据，然后使用 updateTag() 使其失效）。

Route Groups（路由组）：组织路由而不影响 URL 结构的方式。通过将文件夹名称包裹在括号中创建（如 (marketing)），路由组有助于组织相关路由并启用按组的布局。

Route Handler（路由处理器）：处理特定路由的 HTTP 请求的函数，在 route.js 文件中定义。路由处理器使用 Web Request 和 Response API，可以处理 GET、POST、PUT、PATCH、DELETE、HEAD 和 OPTIONS 方法。

Route Segment（路由段）：由 app 目录中的文件夹定义的 URL 路径的一部分（两个斜杠之间）。每个文件夹代表 URL 结构中的一个段。

RSC Payload：React Server Component Payload 的缩写——渲染的 React Server Components 树的紧凑二进制表示。包含 Server Components 的渲染结果、Client Components 的占位符，以及它们之间传递的 props。

S

Server Component（服务器组件）：App Router 中的默认组件类型。服务器组件在服务器上渲染，可以直接获取数据，不会添加到客户端 JavaScript bundle 中。不能使用状态或浏览器 API。

Server Action（服务器操作）：作为 prop 传递给客户端组件或绑定到表单操作的 Server Function。服务器操作常用于表单提交和数据变更。

Server Function（服务器函数）：在服务器上运行的异步函数，使用 "use server" 指令标记。可以从客户端组件调用。当作为 prop 传递给客户端组件或绑定到表单操作时，它们被称为 Server Actions。

Static rendering（静态渲染）：参见 Prerendering。

Static Assets（静态资源）：如图片、字体、视频和其他媒体文件，直接提供服务而无需处理。静态资源通常存储在 public 目录中，并通过相对路径引用。

Suspense boundary（悬念边界）：包裹异步内容并在加载时显示备用 UI 的 React <Suspense> 组件。在 Next.js 中，Suspense 边界定义了静态 shell 结束和流式传输开始的位置，支持部分预渲染。

T

Turbopack：为 Next.js 构建的快速、基于 Rust 的打包工具。Turbopack 是 next dev 的默认打包工具，也可用于 next build。与 Webpack 相比，它提供了显著更快的编译时间。

Tree Shaking（摇树优化）：在构建过程中从 JavaScript bundle 中移除未使用代码的过程。Next.js 会自动摇树你的代码以减小 bundle 大小。

U

"use cache" Directive：`标记组件或函数为可缓存的指令。可以放在文件顶部表示该文件中所有导出都可缓存，或内联在函数或组件顶部标记该特定范围为可缓存。

"use client" Directive：标记服务器和客户端代码边界的特殊 React 指令。必须放在文件顶部，在任何导入或其他代码之前。它表示 React Components、辅助函数、变量声明和所有导入的依赖都应包含在客户端 bundle 中。

"use server" Directive：标记函数为可从客户端代码调用的 Server Function 的指令。可以放在文件顶部表示该文件中所有导出都是 Server Functions，或内联在函数顶部标记该特定函数。

V

Version skew（版本偏移）：部署新版本应用程序后，仍处于活动状态的客户端可能引用来自旧构建的 JavaScript、CSS 或数据。客户端和服务器版本之间的这种不匹配称为版本偏移，可能导致资源缺失、Server Action 错误和导航失败。Next.js 使用 deploymentId 来检测和处理版本偏移。