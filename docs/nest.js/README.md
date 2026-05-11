# NestJS + Prisma 实战教程 — 30 天从零到全栈

## 教程定位

面向 **2 年以上 Vue/React 经验的前端工程师**，用前端类比讲解后端概念。以「图书管理系统」为贯穿全篇的实战项目，从零搭建一个企业级 NestJS 后端。

## 目录

### 前置篇：前端视角的后端世界

| Day | 主题 | 核心内容 |
|-----|------|---------|
| [Day 1](day-01-后端框架选择/README.md) | 后端框架选择 | Node.js 三层演进、五框架对比、Nest vs Spring、前端类比 |
| [Day 2](day-02-Nest工程搭建/README.md) | Nest 工程搭建 | 开发环境、CLI 命令、项目结构、调试指南 |

### 入门篇：核心概念解析

| Day | 主题 | 核心内容 |
|-----|------|---------|
| [Day 3](day-03-IoC控制反转与依赖注入/README.md) | IoC 与 DI | 依赖痛点、IoC 思想、Nest DI 实现、Provider 四种写法、循环依赖 |
| [Day 4](day-04-Module模块化架构/README.md) | Module 模块化 | MVC 职责、@Module 装饰器、imports/exports、全局模块、动态模块、生命周期 |
| [Day 5](day-05-Controller控制器与路由/README.md) | Controller 控制器 | HTTP 数据传输、路由声明、参数装饰器、务实 API 设计 |
| [Day 6](day-06-实战-用户模块/README.md) | 实战：用户模块 | 需求分析、项目创建、Entity/DTO、ValidationPipe、DbModule 动态模块、Postman 测试 |
| [Day 7](day-07-AOP面向切面编程/README.md) | AOP 面向切面 | 五大切面全景图、Middleware/Guard/Interceptor/Pipe/Filter、请求生命周期 |

### 基础篇：请求处理与校验

| Day | 主题 | 核心内容 |
|-----|------|---------|
| [Day 8](day-08-DTO参数校验/README.md) | DTO 参数校验 | class-validator 装饰器、自定义校验、ValidationPipe 配置、Mapped Types |
| [Day 9](day-09-中间件与守卫/README.md) | 中间件与守卫 | Nest Middleware、Express 生态复用、Guard 实现、Metadata/Reflector、Middleware vs Guard |
| [Day 10](day-10-拦截器与RxJS/README.md) | 拦截器与 RxJS | Interceptor 结构、RxJS Operators、统一响应格式、请求日志、序列化 |
| [Day 11](day-11-异常过滤器/README.md) | 异常过滤器 | 内置异常类、ExceptionFilter 实现、自定义业务异常、全局注册 |
| [Day 12](day-12-实战-图书CRUD与文件上传/README.md) | 实战：图书 CRUD | Book Entity/DTO、CRUD Service、multer 文件上传、静态文件托管 |
| [Day 13](day-13-自定义装饰器与元数据/README.md) | 装饰器与元数据 | 全部装饰器分类、Reflect Metadata、Reflector、自定义参数装饰器、组合装饰器 |

### 数据库篇：Prisma ORM 深度整合

| Day | 主题 | 核心内容 |
|-----|------|---------|
| [Day 14](day-14-数据库与Prisma入门/README.md) | 数据库入门 | MySQL/PostgreSQL 速览、SQL CRUD、表关系设计、事务隔离、ORM 概念、Prisma vs TypeORM |
| [Day 15](day-15-Prisma-Schema设计/README.md) | Schema 设计 | 字段类型、关系设计（1:1/1:N/M:N）、自引用、图书管理系统完整 Schema、类型映射 |
| [Day 16](day-16-Prisma-CRUD详解/README.md) | CRUD API | 单表 CRUD、select/include、where 过滤、分页排序、嵌套写入、聚合、SQL 日志 |
| [Day 17](day-17-Nest与Prisma集成/README.md) | Nest + Prisma | PrismaService 封装、@Global Module、类型体系、Prisma 异常处理 |
| [Day 18](day-18-Prisma事务与迁移/README.md) | 事务与迁移 | 交互式事务、批量事务、Migration 工作流、Seed、Prisma Studio |
| [Day 19](day-19-实战-数据库迁移重构/README.md) | 实战：数据库迁移 | JSON→Prisma 迁移、User/Book Service 重构、BorrowService 事务、种子数据 |

### 进阶篇：工程化实践

| Day | 主题 | 核心内容 |
|-----|------|---------|
| [Day 20](day-20-JWT认证鉴权/README.md) | JWT 认证 | 四种认证方案对比、JWT 结构、签发与验证、AuthGuard、Token 续期、@IsPublic |
| [Day 21](day-21-RBAC权限控制/README.md) | RBAC 权限 | ACL vs RBAC、Schema 设计、PermissionGuard、Redis 缓存权限、组合装饰器 |
| [Day 22](day-22-配置管理/README.md) | 配置管理 | @nestjs/config、ConfigService、多环境切换、Joi 校验、YAML、namespace |
| [Day 23](day-23-日志系统/README.md) | 日志系统 | Winston 核心、DailyRotateFile、nest-winston 集成、请求日志拦截器 |
| [Day 24](day-24-Swagger接口文档/README.md) | Swagger 文档 | OpenAPI 概念、DocumentBuilder、全部装饰器、图书系统文档 |
| [Day 25](day-25-文件上传与OSS/README.md) | 文件上传与 OSS | 分片上传、OSS 对比、MinIO/RustFS、Presigned URL 直传、Excel 导入导出 |

### 架构篇：规模化与微服务

| Day | 主题 | 核心内容 |
|-----|------|---------|
| [Day 26](day-26-定时任务与事件/README.md) | 定时任务与事件 | @Cron/@Interval、SchedulerRegistry、EventEmitter2 解耦 |
| [Day 27](day-27-Redis深度实战/README.md) | Redis 深度实战 | ioredis 封装、分布式 Session、关注/排行榜、Geo 位置搜索 |
| [Day 28](day-28-Docker容器化部署/README.md) | Docker 部署 | 多阶段构建、Compose 编排、MySQL/PostgreSQL 双方案、PM2 vs Restart |
| [Day 29](day-29-Nginx与Monorepo/README.md) | Nginx 与 Monorepo | 反向代理、负载均衡（6 种策略）、灰度发布、共享库抽离 |
| [Day 30](day-30-微服务与30天回顾/README.md) | 微服务与回顾 | 微服务取舍、TCP/Redis/RabbitMQ/gRPC、WebSocket/SSE、30 天知识图谱 |

## 使用方式

```bash
# 按顺序阅读，每天一个文件夹
# 每个文件夹内 README.md 是当天的概览和导航
# 按 01-xx.md → 02-xx.md → ... 顺序阅读子文件

# 实战日（标注"实战"的 Day）建议跟着写代码
# 项目代码在 projects/book-management-system/ 下按阶段存放
```

## 技能路线图

```
Day  1-2 ：理解 Nest 的定位 → 完成环境搭建
Day  3-5 ：掌握核心三板斧（Module/Controller/DI）
Day  6   ：★ 第一个实战：用户模块（JSON 存储）
Day  7   ：理解请求处理全链路
Day  8-13：深入各切面 + 第二个实战（图书 CRUD）
Day 14-18：数据库 + Prisma 全家桶
Day 19  ：★ 第三个实战：JSON → 数据库迁移
Day 20-25：企业级功能（JWT/RBAC/日志/文档/OSS）
Day 26-30：架构升级（Redis/Docker/Nginx/微服务）
```

## 参考来源

- [NestJS 官方文档](https://docs.nestjs.com)
- [Prisma 官方文档](https://www.prisma.io/docs)
- [Nest 通关秘籍](https://github.com/thinkasany/nest)
