# TypeScript 笔记

这套笔记写给写过 TypeScript 的人。目标是四件事：搞清类型系统的机制，知道每个特性什么时候不能用，遇到报错能自己定位，明白编译器内部在做什么。

## 版本基线

| 项目 | 版本 |
|---|---|
| TypeScript | 7.0.2（7.1.0-beta 已发布） |
| Node.js | 26.13.1 |
| ESLint | 10.15.0 |
| typescript-eslint | 8.73.0 |
| React / @types/react | 19.3.1 / 19.3.0 |
| zod | 4.6.7 |
| Vite | 8.3.8 |

正文示例在 TypeScript 7.0.2 下编译过，运行示例在 Node 26.13.1 上跑过。低于 6.0 的版本会有差异，涉及处已在章内标注。

## 目录

### 第一部分 基础

- [第 1 章 为什么要学 TypeScript](./01-为什么要学习TypeScript.md)
- [第 2 章 开发环境搭建](./02-开发环境搭建.md)
- [第 3 章 基础类型](./03-基础类型.md)
- [第 4 章 字面量类型与枚举](./04-字面量类型与枚举.md)
- [第 5 章 函数类型](./05-函数类型.md)
- [第 6 章 对象与接口类型](./06-对象与接口类型.md)
- [第 7 章 数组与元组](./07-数组与元组.md)
- [第 8 章 Class 类型](./08-Class类型.md)

### 第二部分 类型进阶

- [第 9 章 类型断言与类型守卫](./09-类型断言与类型守卫.md)
- [第 10 章 any、unknown、never、void](./10-any-unknown-never-void.md)
- [第 11 章 类型别名与工具类型入门](./11-类型别名与工具类型入门.md)
- [第 12 章 联合类型与交叉类型](./12-联合类型与交叉类型.md)
- [第 13 章 泛型](./13-泛型全面指南.md)

### 第三部分 类型编程

- [第 14 章 keyof、typeof 与索引访问类型](./14-keyof-typeof-索引访问类型.md)
- [第 15 章 映射类型](./15-映射类型.md)
- [第 16 章 条件类型与 infer](./16-条件类型与infer.md)
- [第 17 章 模板字符串类型](./17-模板字符串类型.md)
- [第 18 章 类型系统深入：结构化类型与层级](./18-类型系统深入：结构化类型与层级.md)
- [第 19 章 协变与逆变](./19-协变与逆变.md)
- [第 20 章 内置工具类型](./20-内置工具类型完全指南.md)

### 第四部分 工程实践

- [第 21 章 类型声明文件与命名空间](./21-类型声明文件与命名空间.md)
- [第 22 章 模块系统](./22-模块系统.md)
- [第 23 章 TSConfig 配置详解](./23-TSConfig配置详解.md)
- [第 24 章 装饰器](./24-装饰器.md)
- [第 25 章 React 中的 TypeScript](./25-React中的TypeScript.md)
- [第 26 章 类型编程实战](./26-类型编程实战.md)
- [第 27 章 Node.js 中的 TypeScript](./27-Node.js中的TypeScript.md)
- [第 28 章 ESLint 与 TypeScript](./28-ESLint与TypeScript.md)
- [第 29 章 常用工具库与生态](./29-常用工具库与生态.md)
- [第 30 章 面试常见 TypeScript 问题](./30-面试常见TypeScript问题.md)

### 第五部分 机制与诊断

- [第 31 章 报错诊断](./31-报错诊断.md)
- [第 32 章 模块解析与打包边界](./32-模块解析与打包边界.md)
- [第 33 章 Node 原生运行 TypeScript](./33-Node原生运行TypeScript.md)
- [第 34 章 类型性能与调试](./34-类型性能与调试.md)

### 第六部分 交付与演进

- [第 35 章 发布类型与库工程](./35-发布类型与库工程.md)
- [第 36 章 从 JavaScript 迁移](./36-从JavaScript迁移.md)
- [第 37 章 迭代器、生成器与资源管理](./37-迭代器生成器与资源管理.md)
- [第 38 章 现代工具链与生态](./38-现代工具链与生态.md)
- [第 39 章 版本演进与升级](./39-版本演进与升级.md)
- [第 40 章 类型 API 设计](./40-类型API设计.md)

### 第七部分 类型体操与元数据

- [第 41 章 类型体操的递归与深度](./41-类型体操递归与深度.md)
- [第 42 章 类型级解析器](./42-类型级解析器.md)
- [第 43 章 类型测试与可维护性](./43-类型测试与可维护性.md)
- [第 44 章 装饰器元数据与依赖注入](./44-装饰器元数据与依赖注入.md)
- [第 45 章 运行时与类型的闭环](./45-运行时与类型的闭环.md)
- [第 46 章 类型层的设计模式](./46-类型层的设计模式.md)

### 第八部分 原理与心智模型

- [第 47 章 类型检查器内部原理](./47-类型检查器内部原理.md)
- [第 48 章 把类型讲成集合](./48-把类型讲成集合.md)
- [第 49 章 TypeScript 7 与 Go 重写](./49-TypeScript7与Go重写.md)

## 怎么读

只想到此为止，把类型标注写对：读 03 到 10，再看 12。

写业务时被类型卡住：31 查错误码，32 查模块解析，18 到 20 补机制。

想写类型工具或类型体操：14 到 17 打底，然后 41、42。写不动了回来看 34 的性能排查和 47 的检查器原理。

要做库或者接手老项目：35、36、23、38，配合 39 的版本演进。

关心 7.0 换实现带来什么：49 讲重写过程、并行参数与 API 空窗，47 讲旧实现的检查器结构。

## 写作约定

- 代码示例以 TypeScript 7.0.2 为基线，标注错误码的示例必须真的报那个码。
- 涉及运行时的内容给出命令和实际输出。
- 不写练习题，不编虚构场景。
- 同一结论只在最有用的那一章展开，其他章链接过去。
- 每章末尾有「用不上的时候」，写这一章的机制在什么情况下不适用。
- 每章有机制段、报错段、大白话段：先讲检查器为什么这样，再给真实错误码原文，最后用一句话和一个小例子收住。
- 外部事实链到一手来源：版本号、官方引语、性能数字、运行时行为，第一次出现的地方给可点的官方页面；同一来源一章只链一次，章末「参考」列 3 到 8 条。
- 来源优先级：官方文档与公告、官方仓库源码与更新日志、官方讨论区，其次才是作者个人发言。二手文章不进正文。

## 事实来源

链接核对于 2026-11-21。

| 来源 | 覆盖什么 |
|---|---|
| [TypeScript 官方博客](https://devblogs.microsoft.com/typescript/) | 5.0 到 7.1 各版公告、原生移植说明，也提供 [RSS](https://devblogs.microsoft.com/typescript/feed/) |
| [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) | 语言与类型系统的主文档 |
| [TypeScript Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html) | 5.x 特性逐版说明 |
| [tsconfig 参考](https://www.typescriptlang.org/tsconfig) | 配置项语义与默认值 |
| [checker.ts](https://github.com/microsoft/TypeScript/blob/v5.9.3/src/compiler/checker.ts) | 类型检查算法与行号，以 5.9.3 标签为准 |
| [TypeScript Design Goals](https://github.com/microsoft/TypeScript/wiki/TypeScript-Design-Goals) | 非目标（non-goal）的依据 |
| [Node.js 类型剥离文档](https://nodejs.org/api/typescript.html) | 原生运行 .ts 的版本节点与边界 |
| [typescript-go 讨论区](https://github.com/microsoft/typescript-go/discussions/411) | 7.0 为什么选 Go |
| [ESLint 10 迁移指南](https://eslint.org/docs/latest/use/migrate-to-10.0.0) | flat config 与旧配置体系的断裂 |
| [typescript-eslint 文档](https://typescript-eslint.io/) | 配置写法与 TS 版本兼容 |
| [React 19 发布说明](https://react.dev/blog/2024/12/05/react-19) | ref 作为普通 prop 等变更 |
| [zod 4 变更日志](https://zod.dev/v4/changelog) | 顶层 API 与 v3 的差异 |
