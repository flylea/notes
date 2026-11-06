# 术语速查（供章节作者统一口径）

> 每章第一次出现下列术语时，按本表口径用 2–4 句话讲透（是什么、为什么需要、和相近概念的区别、在 example 项目里对应哪一层），不要只丢中文译名。后续章节可一句话复述并指向首次解释的章节。

## 分层与架构

- **Controller（控制器）**：HTTP 入口。负责从请求里取参数、调用 Service、把结果交给响应；不写业务规则。对应 `example/src/modules/*/*.controller.ts`。
- **Service（服务）**：业务逻辑的载体。校验业务规则、编排数据访问、抛语义化异常；不关心 HTTP。对应 `example/src/modules/*/*.service.ts`。
- **Provider（提供者）**：Nest 的通用概念——任何交给 IoC 容器管理、可被注入的类（Service、Repository、Factory、Guard…）都叫 Provider。`@Injectable()` 标记它可被注入。
- **Repository（仓储）**：面向领域对象的持久化抽象。通常一个聚合根一个 Repository，方法名是业务语义（`findActiveBookings`），调用方不感知 SQL。Nest + Prisma 场景里常直接用 Prisma Client 或在其上包一层薄仓储。
- **DAO（Data Access Object）**：更贴近表/查询的数据访问对象，方法粒度常是「按表 + 条件查询」，比 Repository 更底层、更机械。两者都能隔离 SQL；区别是 Repository 面向聚合/领域，DAO 面向数据源。小项目里二者常合并，重要的是**别让 SQL 散在 Service 里**。
- **Entity（实体）**：有唯一标识、生命周期可追踪的领域对象（`User`、`Room`、`Booking`）。在 ORM 里常与数据库表映射（Prisma 的 model 生成类型）；「数据库表结构」和「业务实体」可能不完全一致。
- **PO（Persistent Object，持久化对象）**：专指与数据库表一一对应的对象。ORM 生成 / 映射到表的通常就是 PO。Entity 可以是 PO，也可以带领域行为。
- **DTO（Data Transfer Object，数据传输对象）**：跨层/跨进程传数据的载体，只装数据、不带业务逻辑。在本教程里主要指**请求/响应的形状定义**（如 `CreateBookingDto`），配合 `class-validator` 在入口校验。DTO 与 Entity 的区别：DTO 面向接口契约，字段可以裁剪、组合；Entity 面向业务与持久化。
- **VO（Value Object / View Object，视上下文）**：常见两种含义。领域驱动里的 Value Object 指**没有唯一标识、以值相等**的对象（金额、地址）；前后端分层里的 View Object 指**给页面展示用的裁剪结果**。本教程遇到时先说明是哪一种，避免混用。
- **Mapper（映射器）**：在 Entity/PO/DTO/VO 之间转换的代码。手写 `toDto(entity)` 或引入映射库都行；有转换就集中写，别在 controller 里散着拼对象。
- **ORM（Object-Relational Mapping）**：把对象模型和关系表映射起来的工具层。Prisma 8 通过 `contract.prisma` 定义模型、`db.orm.public.User` 访问。

## Nest 请求链路

- **Middleware（中间件）**：最外层，只有 `req/res/next`，拿不到 Nest 上下文；适合日志、requestId、CORS 等与业务无关的事。
- **Guard（守卫）**：在路由匹配后、拦截器前执行，决定「能不能进」；认证/授权放这里。
- **Interceptor（拦截器）**：在 handler 前后各执行一段，能拿到 `ExecutionContext`；适合响应包装、耗时统计、缓存。
- **Pipe（管道）**：在 handler 前对参数做转换与校验；`ValidationPipe` 是典型。
- **ExceptionFilter（异常过滤器）**：统一接住抛出的异常并生成响应；不要再让 controller 各写 `try/catch`。
- **Contract（契约）**：Prisma 8 里描述数据模型与关系的源文件（`contract.prisma`），`contract emit` 生成 `contract.json` / `contract.d.ts` 给运行时用。
- **Migration（迁移）**：一次可追溯、可回放的数据库结构变更（Prisma 8 里是 `prisma/migrations/app/<timestamp>_<name>/` 下的迁移包）。
