# 生态工具覆盖扫描（ECOSYSTEM SWEEP）

> 触发：用户 m00664「这还是我自己主动发现的遗漏，你之前不是说已经全面排查完毕了吗？」
> 结论：上一轮覆盖度只对位「官方 docs 183 页」这个**封闭基线**，第三方工具生态不在其中，所以 Scalar / Jenkins / Apifox 一类缺口在方法上就不可能被扫出来。本文件是补做的**第二条基线**。
> 方法：19 类工具族 × ≈150 关键词，对 `_meta/chapters.tsv`（标题级）+ 已写 53 章正文做双向命中。
> 口径说明：**标题级命中是下界**——标题没点名不代表正文没有（如 074「Node如何发邮件」正文讲 Nodemailer）；「完全没规划」= 标题级 0 命中，需人工确认正文是否顺带讲过。

## 一、总体

| 分类 | 标题级有规划 | 标题级完全未规划 |
| --- | --- | --- |
| API 文档/契约 | Swagger（071、091）、Scalar/Redoc（072） | RapiDoc、Stoplight、Apifox、YApi、Postman、openapi-typescript、orval |
| CI/CD 与 GitOps | GitHub Actions（227） | Jenkins、GitLab CI、Argo CD、GitOps、Tekton、Terraform、Ansible |
| 观测/APM | Prometheus（084）、OpenTelemetry（221）、Winston（027/028） | Grafana、OTel Collector、Jaeger、Zipkin、Sentry、SkyWalking、Loki、Tempo、Terminus |
| 测试与压测 | **无（按用户决定不补）** | Vitest、Jest、Supertest、Playwright、Cypress、k6、Artillery、覆盖率 |
| 代码质量 | **无** | oxlint、ESLint、Prettier、Biome、SonarQube、Husky、lint-staged |
| 消息/任务 | RabbitMQ（4）、Kafka（3）、RocketMQ、NATS、BullMQ、MQTT、outbox（2） | Pulsar、Temporal、cron/schedule、saga |
| 数据库/ORM | PG（11）、MySQL、MongoDB（3）、Prisma（17）、TypeORM、Drizzle、MikroORM、Sequelize、pgvector | SQLite、ClickHouse、TimescaleDB、Knex、pgbouncer、EXPLAIN 专章 |
| 缓存 | Redis（19）、缓存雪崩（205） | Memcached、Redis Sentinel、Cluster |
| 搜索 | Elasticsearch（5）、全文检索（178）、pgvector | OpenSearch、Meilisearch、Typesense、Algolia |
| 对象存储 | MinIO/OSS（270） | S3 协议、对象存储通用概念、七牛 |
| 认证授权 | Passport、OAuth2（200）、RBAC（058）、JWT（4） | OIDC、Keycloak、Casdoor、Auth0、CASL、ABAC、2FA/TOTP |
| 支付 | 支付宝/微信支付（202） | Stripe、银联 |
| 邮件短信 | 邮件（074/076）、阿里云短信 | Nodemailer（标题未点名，074 正文讲）、Resend、Twilio |
| 网关/代理 | Nginx（4） | Traefik、Caddy、HAProxy、OpenResty、Kong、APISIX、Envoy |
| 容器/云原生 | Docker（14）、Compose、Helm（238） | **Kubernetes/K8s（标题级 0）**、K3s、Nomad、Cloudflare |
| 前端集成 | Next.js（245）、TanStack Query（247） | React、OpenAPI codegen |
| 架构/模式 | 多租户（242）、CQRS（258）、微服务（10）、gRPC（2） | DDD/领域驱动、事件驱动、六边形架构 |
| 安全 | helmet/CSRF/CORS（238）、限流（2）、OWASP（243）、密钥、加密 | Throttler 包名未点名、SQL 注入专章 |

## 二、新发现缺口（按教学价值排序，均非 P0）

| # | 缺口 | 现状 | 建议 | 优先级 |
| --- | --- | --- | --- | --- |
| 1 | **测试与压测** | 287 章规划 **0 章**；Nest 12 脚手架默认带 Vitest 4 + `*.spec.ts` + e2e | **按用户决定不补（2026-11-21）**：不做测试/压测章节；只在 001 开篇词写清取舍（脚手架默认带、去掉 `--skip-tests` 即有骨架、指向官方 testing 页） | 已定 |
| 2 | **CI/CD 其余工具链** | 只有 227 一章 GitHub Actions；Jenkins/GitLab CI/Argo CD/Terraform/Ansible 全无（Jenkins 按用户决定不单独成章） | 227 拆两半：CI 选型对比表（Jenkins/GitLab CI/GitHub Actions/Drone）+ 实战；Argo CD/Terraform 归部署章「声明式交付」一节 | P1 |
| 3 | **代码质量与提交规范** | oxlint/ESLint/Prettier/Biome/Husky/lint-staged 标题级 0；但脚手架已预装 oxlint+Prettier | 注入「工程化设施」首章：lint/format/commit hook/CI 门禁一套打通（1 章） | P1 |
| 4 | **观测纵深** | Prometheus 1 章、OTel 1 章；Grafana/Jaeger/Sentry/Loki/Terminus 全无 | 可观测 Part 重排：日志→指标（含 Grafana 面板）→链路（OTel Collector + Jaeger）→错误追踪（Sentry）→健康检查（Terminus） | P1 |
| 5 | **API 文档 UI 与 codegen** | 已补 072；RapiDoc/Stoplight/Apifox/YApi/Postman/codegen 仍缺 | 全部并入 072 的对比表与 codegen 小节（不另开章） | 已覆盖 |
| 6 | **身份协议** | OAuth2 1 章、RBAC 1 章；OIDC/Keycloak/CASL/2FA 全无 | 认证 Part 补 1 章「企业身份：OIDC/Keycloak 对接 + CASL 细粒度授权」 | P1 |
| 7 | **Kubernetes** | 标题级 0（只在版本基线表出现 K8s 1.33） | 云原生 Part 至少 1 章 K8s 最小可用（Deployment/Service/ConfigMap/Secret/Probe/HPA），否则「云原生」名不副实 | P1 |
| 8 | **任务调度** | cron/schedule/Temporal 标题级 0；BullMQ 1 章 | 「定时任务」注入 BullMQ 章或单开 1 章（@nestjs/schedule + 分布式调度坑） | P2 |
| 9 | **存储协议** | MinIO/OSS 各 1 章标题；S3 协议未点名 | 注入现有章：S3 兼容协议、预签名 URL、分片直传 | P2 |
| 10 | **搜索选型** | ES 5 章，OpenSearch/Meilisearch/Typesense 0 | 注入检索首章选型表（ES 重、Meilisearch 轻、pgvector 混合检索） | P2 |
| 11 | **架构模式** | 多租户/CQRS 各 1 章，DDD/事件驱动 0 | 架构 Part 补 1 章「事件驱动与 DDD 落地边界」 | P2 |
| 12 | **网关对比** | Nginx 4 章，Traefik/Caddy 0 | 部署章加选型表（Nginx/Traefik/Caddy），不单开章 | P2 |
| 13 | **支付** | 支付宝/微信各 1 章，Stripe 0 | 支付章加一节 Stripe（海外/订阅场景） | P2 |

## 三、修复建议（合计 +5 章，其余注入）

- **新增 3 章**：代码质量与提交门禁 1 章、Kubernetes 最小可用 1 章、企业身份（OIDC/Keycloak + CASL）1 章。（测试 2 章按用户决定撤销，不做。）
- **重排 3 处**：CI/CD（227 拆两半）、可观测（日志/指标/链路/错误追踪/健康检查五段式）、检索（首章加选型表）。
- **注入 6 处**：分布式任务、S3 协议、网关对比、Stripe、EXPLAIN 专节、Throttler 包名与配置。
- 加上本次已拆的 072，**总数 287 → 290 章**；Part 区间需再重算一次（脚本已就绪）。

## 四、流程教训（写进 `_meta/WRITER-BRIEF.md` 待办）

1. **覆盖度双基线**：官方文档页 + 生态工具清单，缺一不可；只做前者会把「框架 API 讲全」误判成「生产工具链讲全」。
2. **工具清单一季度更新一次**：`_meta/audit/ECOSYSTEM-SWEEP.md` 里的关键词表就是清单本体，新增工具直接加行。
3. **「全面」措辞纪律**：未跑第二条基线前，只能说「官方文档覆盖已核对」，不能说「全面排查完毕」。
