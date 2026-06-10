# Day 7：AOP 架构 — 五大切面全景图

## 今日概览

在 Day 3-5 我们学了 Nest 的核心三板斧：Module/Controller/Service。但一个真正的企业级应用，还有大量"横切关注点"（cross-cutting concerns）：日志记录、权限校验、参数验证、异常处理……如果把这些逻辑散落在每个 Controller 方法里，代码会迅速腐化。

Nest 的解决方案是 **AOP（面向切面编程）**——将这些通用逻辑从业务代码中剥离，放到"切面"中统一处理。

## 学习目标

- 理解 AOP 思想及前端类比（Vue Router 守卫、Axios 拦截器）
- 掌握 Nest 五大切面：Middleware → Guard → Interceptor → Pipe → ExceptionFilter
- 理解每个切面的执行时机、职责边界和典型用例
- 掌握各切面的实现方式和注册方式

## 子文件导航

| 文件 | 内容 | 预计行数 |
|------|------|---------|
| [01-AOP思想详解.md](01-AOP思想详解.md) | AOP 思想详解 + 前端类比 | ~200 |
| [02-五大切面全景图.md](02-五大切面全景图.md) | 五大切面全景图 | ~250 |
| [03-Middleware详解.md](03-Middleware详解.md) | Middleware 详解 | ~200 |
| [04-Guard详解.md](04-Guard详解.md) | Guard 详解 | ~180 |
| [05-Interceptor详解.md](05-Interceptor详解.md) | Interceptor 详解 | ~220 |
| [06-Pipe与ExceptionFilter.md](06-Pipe与ExceptionFilter.md) | Pipe 和 ExceptionFilter 详解 | ~200 |
| [07-完整请求生命周期.md](07-完整请求生命周期.md) | 完整请求生命周期图解 | ~250 |

## 为什么 Day 7 放在这里？

在 Day 6 我们完成了用户模块的实战开发——ValidationPipe 和 BadRequestException 已经在项目中用上了。但你可能只是一知半解地"照抄"。今天我们把 Nest 的整个请求处理管道彻底讲透，让你理解从请求到响应的每一环。

> 学习 AOP 后，你将不再是一个"只会写 Controller"的 Nest 开发者——你能设计出干净、可维护的架构。
