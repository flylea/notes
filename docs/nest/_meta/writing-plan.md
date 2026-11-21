# 写作施工顺序（2026-11-21 定稿）

> 用户决定（m00735）：「按照你的建议来，但是总的内容不要少」。
> 含义：**写作顺序改成「先做完整闭环」，章节总数与每章深度不缩减**（287 章不变，待批的 290 章方案另议）。
> 闭环定义：读者从零到「能上线的会议室预订系统」——Part 04（Redis/认证鉴权 17 章）+ Part 06（项目一 20 章）= 37 章，写完到 **91/287 ≈ 32%**。

## 一、为什么这个顺序

按章号顺序写，读者要等到第 85 章才见到第一个完整项目；而 `example/` 里代码其实已经跑通（19 路由、25 接口、Prisma 8 契约产物、JWT 双 token）。**先写项目章，等于把已经验证过的实现翻译成讲解，边际成本最低、读者获得感最强**；认证鉴权（Part 04）是项目一的前置依赖，所以先补它。

## 二、批次与验收

| 批次 | 章节 | 内容 | 依赖 |
| --- | --- | --- | --- |
| **1** | 054–059（6 章） | 认证地基：登录状态选型 ✅054、Session+JWT 双实现、Prisma8 登录注册、ACL、RBAC、无感刷新 | `example/src/modules/auth`、`common/guards` |
| **2** | 060–070（11 章） | 配置分环境、Compose、容器网络、重启策略 vs PM2、私有镜像仓库、Nginx 两用法、灰度、全配置、分布式 session、Redis 两个实战 | Part 02 已写的 Docker/Nginx 基础 |
| **3** | 085–091（7 章） | 项目一：需求与原型、技术方案与库表、用户模块（注册/配置抽离+登录鉴权/拦截器+改信息/列表分页/Swagger） | `example/src/modules/users`、`docs/` 原型说明 |
| **4** | 092–103（12 章） | 项目一前端与管理端页面、会议室模块、预订模块（含冲突检测）、统计模块 | 批次 3 + 前端代码 |
| **5** | 104 + 回填 | 部署验收、第 50 章生产化改造与 example 对齐、README/进度更新 | 全部 |

每批结束必须：①`node _meta/build-structure.mjs` 重生成 README；②`validate-chapters` exit 0；③`check-structure` exit 0；④本文件「进度」表更新。

## 三、单章质量标准（比门禁更严，写作时按这个来）

- **汉字 2,800–3,500**（门禁只要求 ≥800，但低质量会拉低整本书密度；当前 53 章均值 3,031）。
- **代码块 8–16 个**，全部可复制；shell 命令必须给预期输出或失败现象。
- 版本一律写真实值：Nest 12.6.x、Node 22/24/26 LTS、TS 6.0.x、Prisma 8 `rc.34` + `@prisma/orm-postgres` `rc.24`、`@nestjs/jwt` 12.0.x、`express-session` 1.19、`connect-redis` 11（peer 是 node-redis，不用 ioredis 时要说明）。
- ESM 口径：相对导入带 `.js`、`main.ts` 顶层 `await`、`package.json` `"type": "module"`。
- Prisma 8 口径：`contract.prisma` 首行 `// use prisma-8`、`prisma contract emit`、`postgres({ contract, url })`、`db.orm.public.X`、`db.transaction`。
- 每章至少 1 个 **checkpoint**（可粘贴命令 + 期望输出），让读者能停下来验证。
- 禁止教材腔（`本章目标`/`前置知识`/`小结`/`延伸阅读`/`学完你将`…），已写在 `_meta/validate-chapters.mjs` 的 FORBIDDEN。
- 图：`架构/原理/流程/协议/时序/关系/部署/生命周期/数据流/可靠性/可观测` 这些 domain 必须有 Mermaid；其他章有更好。
- **未实测内容显式标注**：「以下为预期输出，未在本机实测」——全书目前 41 处，新增章节平均每章不超过 3 处，且 Docker/云相关必须标。
- 不写测试章、正文不展示 Vitest/Jest/k6（用户决定，见 `WRITER-BRIEF.md`「测试口径」）。

## 四、与已写章节的衔接

- Part 01 已覆盖：IoC、装饰器、Pipe/Guard/Interceptor/Filter、上传、日志、AOP、循环依赖、动态模块、适配器（含 NodeAdapter）。
- Part 02 已覆盖：Dockerfile、多阶段构建、Compose 基础、PM2。
- Part 03 已覆盖：PG 17、SQL、事务/隔离级别、Prisma 8 全流程（044–050）。
- 因此 Part 04 的 054 不再重复「HTTP 无状态」的基础，只讲状态放哪；061–064 直接进 Compose 实战，不复述 Dockerfile 分层。
- 交叉引用一律用最终章号（071 Swagger、072 文档 UI、084 监控、091 项目内 Swagger、104 部署验收），改章号后需全库 grep 复查。

## 五、进度

| 批次 | 状态 | 完成 |
| --- | --- | --- |
| 1 | 进行中 | 054 已写（3,046 汉字 / 8 代码块 / 2 图） |
| 2–5 | 待写 | — |

当前全书：**54 / 287 章 = 18.8%**。
