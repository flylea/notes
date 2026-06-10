# Day 13：自定义装饰器与元数据

## 今日概览

整个教程中我们大量使用了 Nest 的装饰器——`@Controller`、`@Get`、`@Body`、`@UseGuards` 等。今天学习如何创造自己的装饰器，以及 Reflect Metadata 的底层原理。

## 学习目标

- 理解 Nest 装饰器的分类体系
- 掌握 Reflect Metadata 底层原理
- 学会使用 `createParamDecorator` 写自定义参数装饰器
- 学会使用 `applyDecorators` 组合多个装饰器
- 实战：写 `@UserInfo`、`@RequireLogin`、`@RequirePermission`

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-Nest装饰器分类速查.md](01-Nest装饰器分类速查.md) | Nest 装饰器分类速查 |
| [02-Reflect-Metadata原理.md](02-Reflect-Metadata原理.md) | Reflect Metadata 底层原理 |
| [03-Reflector工具类.md](03-Reflector工具类.md) | Reflector 四个方法详解 |
| [04-自定义参数装饰器.md](04-自定义参数装饰器.md) | createParamDecorator 实现 |
| [05-applyDecorators组合装饰器.md](05-applyDecorators组合装饰器.md) | applyDecorators 组合装饰器 |
| [06-实战自定义装饰器.md](06-实战自定义装饰器.md) | 实战：@UserInfo、@RequireLogin 等 |
