# Day 8：DTO 与参数校验

## 今日概览

Day 7 我们俯瞰了 Nest 的五大切面全景。从今天开始，逐一深入。首先是 Pipe——参数校验层，这是保证数据质量的第一道防线。

## 学习目标

- 深入理解 DTO 模式的意义和价值
- 掌握 class-validator 全部常用装饰器
- 学会编写自定义校验规则
- 掌握 ValidationPipe 的全部配置项
- 学会用 Mapped Types 复用 DTO
- 掌握 Nest 内置的 7 个 Pipe

## 子文件导航

| 文件 | 内容 | 预计行数 |
|------|------|---------|
| [01-DTO概念与设计模式.md](01-DTO概念与设计模式.md) | DTO 概念、与 Entity 的区别、为什么需要 DTO 层 | ~200 |
| [02-class-validator装饰器速查.md](02-class-validator装饰器速查.md) | 全部常用装饰器速查表与实战示例 | ~250 |
| [03-自定义校验装饰器.md](03-自定义校验装饰器.md) | 自定义校验装饰器实现 | ~180 |
| [04-ValidationPipe配置详解.md](04-ValidationPipe配置详解.md) | ValidationPipe 全部配置项详解 | ~180 |
| [05-Mapped-Types复用DTO.md](05-Mapped-Types复用DTO.md) | PartialType/PickType/OmitType/IntersectionType | ~180 |
| [06-内置Pipe详解.md](06-内置Pipe详解.md) | 内置 Pipe 详解：ParseIntPipe 等 | ~180 |
| [07-前端表单校验类比.md](07-前端表单校验类比.md) | 前端表单校验库类比 | ~150 |
