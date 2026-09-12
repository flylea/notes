# 59 · Turbopack 与编译打包原理

> **一句话结论**：Turbopack 快不是因为"写得优化好"，而是因为它换了一套架构——用 Rust 写的增量计算引擎 + 函数级缓存 + 精确依赖图，把 webpack 那种"每次改动重跑一大段流水线"的模型换成"只重算被影响的那一小块"。代价是它**不再兼容**那些基于 webpack 内部 API 写的自定义配置——这是 16 起构建默认切 Turbopack 后最常见的迁移痛。

## webpack 为什么慢

webpack 的核心抽象是"图 + chunk"。它的编译流程大致是：

1. 从 entry 出发递归解析所有 `import`，构建模块依赖图。
2. 每个 module 经过 loader 链（babel/ts-loader/css-loader...）转成 JS。
3. 把图切成若干 chunk，每个 chunk 做代码转换、压缩、哈希。

慢在哪：

- **loader 是 JS 写的、串行的**。babel 单文件转换就是几十毫秒，项目里几万个 module 串起来是分钟级。
- **增量粒度粗**。改一个文件，webpack 默认会让该 module 所在的 chunk 子树重新过一遍 loader。
- **插件模型耦合**。很多插件直接读 webpack 的内部状态对象，导致重构困难、缓存失效频繁。

webpack 4 之后引入了持久化缓存（`cache.filesystem`），它把 module 级别结果写盘，重启时复用——但这只是减少重启开销，**改动后的增量编译**本身还是慢。

## Turbopack 换了什么

Turbopack 把"图 + chunk"模型换成"**纯函数 + 缓存**"模型：

| 维度 | webpack | Turbopack |
|---|---|---|
| 实现 | JS + loader 链 | Rust + 内置 transform |
| 增量单位 | chunk / module 子树 | **函数级（任意细粒度）** |
| 缓存键 | 文件路径 + 时间戳 | **函数输入的哈希** |
| 依赖追踪 | 解析时记录 | 编译时静态分析 + 微任务调度 |
| 插件 | loader / plugin 钩子 | 内置 transform，自定义点少 |

关键点：**增量单位是函数级**。一个 module 的 AST 变了，Turbopack 只重算"AST → 代码"这一步，依赖它的下游（chunk 拼接、source map）按缓存失效的精确范围重算。webpack 没法做到这么细，因为它的中间表示（module 对象）和缓存键不面向这种粒度。

这就是 Turbopack 的"函数级缓存"——一个 transform 函数 `(input) -> output`，输入哈希变了才重算。Turbopack 团队把这个模型叫 "Turbo Engine"。

## 一个具体对比

改一个共享组件 `button.tsx`：

- **webpack**：`button` 所在 chunk + 依赖它的所有 entry 的 transform + 这些 entry 的 chunk 拼接都重跑。项目大时是秒级。
- **Turbopack**：`button` 的 AST 重算 → 直接下游（import 它的几个文件）按失效范围重算 → chunk 拼接里的相关片段重算。**没碰的模块根本不进流水线**。项目越大差距越明显。

Fast Refresh 的差距更极端：webpack 要重新编译受影响的 module 子树再塞进运行时；Turbopack 直接定位到受影响组件，毫秒级生效。官方数据是 Fast Refresh 快最多 10 倍。

## 什么时候被迫退回 webpack

不是所有项目都能用 Turbopack。16 起 `next build` 默认走 Turbopack，但**有自定义 webpack 配置时，构建会直接失败**（这是有意的保护）。

具体场景：

1. **依赖某个 webpack loader 没有 Turbopack 等价物**。比如某些自研 loader 读 webpack 内部 Compiler 对象做副作用。
2. **自定义 `webpack` 配置函数**。`next.config.ts` 里写 `webpack(config, { isServer }) { ... return config }` 是 webpack-only API。
3. **某些 Plugin 依赖 webpack 内部事件流**。

退回：

```bash
next build --webpack
next dev --webpack
```

迁移建议：

- 自定义 loader 能换成 Turbopack 内置 transform 的就换。CSS / Sass / MDX 这些都有 Turbopack 原生支持。
- 必须保留 webpack 配置的，加 `--webpack`，并接受增量编译速度回落。
- Turbopack 配置位置：**顶层 `turbopack`**，不再嵌在 `experimental` 下（见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 12 条）。

## Turbopack 配置示例

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      // 自定义文件扩展名到 loader 的映射
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
}

export default nextConfig
```

注意 Turbopack 的 `rules` 是文件模式匹配，不是 webpack 的 `test` 正则。两套 API 不通用。

## Turbopack 文件系统缓存（Beta）

16 引入了 Turbopack 的**文件系统缓存**——把增量计算的中间结果持久化到磁盘，冷启动时复用。开发服务器第二次启动明显更快。这是对 webpack 持久化缓存的对应物，但粒度更细。

## 一个心智模型：把构建当成纯函数

理解 Turbopack 最省事的方式，是把它当成一个巨大的纯函数集合：

```
build(input_files, config) -> output_bundle
```

每个内部步骤都是纯函数，输入相同输出相同、可缓存。一次"改动"等价于改了某个输入，缓存按依赖图精确失效，只重算受影响的子树。webpack 的模型不是纯函数的——loader 有副作用、插件读全局状态——所以它做不到精确缓存。

这也解释了 Turbopack 为什么对"不规范的副作用"不友好：**它要求每一步都可缓存**，副作用一多就退化成全量重算。

## 常见坑

- **现象**：`next build` 报"webpack config is not supported when using Turbopack"。
  **原因**：有自定义 webpack 配置，16 默认用 Turbopack。
  **解法**：迁移到 `turbopack` 配置，或 `next build --webpack` 退回。

- **现象**：某个第三方插件不生效。
  **原因**：它是 webpack 插件，Turbopack 不认。
  **解法**：找 Turbopack 等价方案，或退回 webpack。

- **现象**：Sass `@import` 的 `~` 前缀报错。
  **原因**：Turbopack 不支持 webpack 的 `~` 波浪号语法。
  **解法**：用相对路径或别名。

- **现象**：冷启动依然慢。
  **原因**：第一次启动没有缓存可复用。
  **解法**：第二次起就快了；启用文件系统缓存（Beta）。

## 旧写法 vs 新写法

| 场景 | 旧 | 新 |
|---|---|---|
| 默认打包器 | webpack | Turbopack |
| 退回方式 | 默认就是 webpack | `--webpack` 显式退回 |
| Turbopack 配置位置 | `experimental.turbopack` | **顶层 `turbopack`** |
| 持久化缓存 | webpack `cache.filesystem` | Turbopack 文件系统缓存（Beta） |

详见 [`MIGRATION-16.md`](../../MIGRATION-16.md) 第 2、12 条。

## API / 配置速查

| 项 | 作用 |
|---|---|
| `turbopack.rules` | 自定义文件模式到 loader 的映射 |
| `next dev --webpack` | 用 webpack 启 dev |
| `next build --webpack` | 用 webpack 构建 |
| `cacheComponents: true` | 与 Turbopack 配套的缓存模型 |

## 延伸阅读

- [官方文档：Turbopack](https://nextjs.org/docs/app/api-reference/turbopack)
- [官方文档：Building](https://nextjs.org/docs/app/guides/building)
- [官方文档：Package Bundling](https://nextjs.org/docs/app/guides/package-bundling)
