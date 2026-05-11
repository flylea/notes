# Day 3：IoC 与 DI — 从手动 new 到自动注入

## 今日目标

理解面向对象编程中"依赖"产生的痛点，掌握 IoC（控制反转）思想和 DI（依赖注入）实现，学会 Nest 中 Provider 的 4 种写法，了解循环依赖的解决方案。

## 子文件导航

| 文件 | 主题 | 核心问题 |
|------|------|---------|
| [01-后端对象的依赖痛点.md](./01-后端对象的依赖痛点.md) | 依赖关系痛点 | 为什么手动 new 对象会导致代码腐化？ |
| [02-IoC思想详解.md](./02-IoC思想详解.md) | IoC 思想详解 | 控制反转到底"反转"了什么？ |
| [03-前端DI类比.md](./03-前端DI类比.md) | 前端类比 | Vue provide/inject 和 Nest DI 有什么异同？ |
| [04-Nest-DI容器实现.md](./04-Nest-DI容器实现.md) | Nest DI 实现 | Nest 的 IoC 容器是如何工作的？ |
| [05-Provider四种写法.md](./05-Provider四种写法.md) | Provider 4 种写法 | useClass/useValue/useFactory/useExisting 分别什么时候用？ |
| [06-循环依赖解决方案.md](./06-循环依赖解决方案.md) | 循环依赖 | UserService 依赖 BookService，BookService 又依赖 UserService 怎么办？ |

## 学习建议

- 今天是整个 Nest 知识体系的**基石**——理解 DI 之后，Controller/Service/Module 的关系会豁然开朗
- 如果不理解，多读一遍 01 和 02，不要跳过直接看代码
- 阅读时思考：如果让我自己不用 Nest 写一个 DI 容器，需要哪几行代码？
