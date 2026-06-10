# Day 10：Interceptor 与 RxJS 深入

## 今日概览

Day 7 我们学了 Interceptor 的基本结构，今天深入 RxJS 操作符在 Nest 中的应用，并实现企业级的统一响应格式、请求日志和序列化。

## 学习目标

- 理解 Interceptor 的 Observable 管道模型
- 掌握 tap/map/catchError/timeout 四大 RxJS 操作符
- 实现统一响应格式包装
- 实现自动请求日志
- 学会 ClassSerializerInterceptor 过滤敏感字段

## 子文件导航

| 文件 | 内容 |
|------|------|
| [01-Interceptor完整结构.md](01-Interceptor完整结构.md) | Interceptor 完整结构 |
| [02-RxJS四大核心Operator.md](02-RxJS四大核心Operator.md) | RxJS 四大核心 Operator |
| [03-统一响应格式封装.md](03-统一响应格式封装.md) | 统一响应格式封装 |
| [04-自动请求日志.md](04-自动请求日志.md) | 自动请求日志 |
| [05-序列化与敏感字段过滤.md](05-序列化与敏感字段过滤.md) | ClassSerializerInterceptor 过滤敏感字段 |
| [06-全局与局部应用级别.md](06-全局与局部应用级别.md) | 各种应用级别与 DI 支持差异 |
