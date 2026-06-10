# Day 4：Module — 模块化组织的铁三角

## 今日目标

理解 Module/Controller/Service 的 MVC 职责划分，掌握 `@Module()` 装饰器的 4 个属性，学会 imports/exports 跨模块共享 Provider，了解全局模块、动态模块和 Nest 生命周期。

## 子文件导航

| 文件 | 主题 | 核心问题 |
|------|------|---------|
| [01-MVC职责划分.md](./01-MVC职责划分.md) | MVC 职责划分 | Module/Controller/Service 各自负责什么？ |
| [02-Module装饰器详解.md](./02-Module装饰器详解.md) | @Module() 详解 | imports/controllers/providers/exports 是什么意思？ |
| [03-模块间共享Provider.md](./03-模块间共享Provider.md) | 模块间共享 | Provider 如何在模块间传递？ |
| [04-全局模块Global.md](./04-全局模块Global.md) | 全局模块 @Global() | 什么时候用全局模块？有什么坑？ |
| [05-动态模块详解.md](./05-动态模块详解.md) | 动态模块 | register/forRoot/forFeature 是什么？ |
| [06-生命周期钩子.md](./06-生命周期钩子.md) | 生命周期钩子 | Nest 从启动到关闭经历了哪些阶段？ |

## 学习建议

- 今天的内容是理解 Nest 项目**如何组织代码**的关键
- 和前端组件化最相似——带着"Vue 组件怎么拆分"的思路来学
