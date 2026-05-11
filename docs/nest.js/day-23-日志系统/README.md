# Day 23：Winston 日志系统

## 今日概览

项目的 console.log 调试信息散落各处，生产环境无法追溯问题。今天集成 Winston 专业日志库，实现按日期轮转、按级别过滤的结构化日志。

## 学习目标

- 对比 Node.js 主流日志方案
- 掌握 Winston 核心概念（Logger/Transport/Format）
- 实现按日期轮转日志文件
- 集成 nest-winston 替换 Nest 默认 Logger
- 实现请求日志自动记录

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-日志方案对比.md](01-日志方案对比.md) | 日志方案对比：console/debug/Winston/Pino |
| [02-Winston核心概念.md](02-Winston核心概念.md) | Winston 核心概念：Logger/Transport/Format |
| [03-日志文件按日轮转.md](03-日志文件按日轮转.md) | 按日期轮转日志文件 |
| [04-Nest集成Winston.md](04-Nest集成Winston.md) | WinstonModule 集成 Nest |
| [05-请求日志拦截器.md](05-请求日志拦截器.md) | Interceptor + Winston 自动请求日志 |
