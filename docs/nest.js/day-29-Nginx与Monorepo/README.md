# Day 29：Nginx 反向代理与 Monorepo

## 今日概览

多实例部署后需要一个网关来分发请求。今天学习用 Nginx 做反向代理、负载均衡和灰度发布。同时引入 Monorepo 架构，用共享库消除重复代码。

## 学习目标

- 掌握 Nginx 反向代理和静态资源托管
- 实现 upstream 负载均衡
- 了解灰度发布原理
- 理解 Monorepo 设计理念
- 用 nest generate library 创建共享库

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-Nginx反向代理与静态资源.md](01-Nginx反向代理与静态资源.md) | Nginx 反向代理与静态资源 |
| [02-负载均衡策略.md](02-负载均衡策略.md) | 负载均衡 |
| [03-Nginx灰度发布.md](03-Nginx灰度发布.md) | Nginx 灰度发布 |
| [04-Monorepo设计理念.md](04-Monorepo设计理念.md) | Monorepo 设计理念 |
| [05-共享DTO与PrismaService库.md](05-共享DTO与PrismaService库.md) | 共享 DTO/Utils 库 |
