# 第 103 章《会议室预订系统：项目部署与整体验收》章节纲要

> 状态：**纲要（未成文）**。定位：Part 06 项目一的收尾章，把 `example/` 从本机跑到一台真实服务器上，并用可核对的方式验收。
> 写法约束：方法论文本进正文；本机具体数值（IP、端口、磁盘）不进正文，只在「实测回填」处引用。
> 依赖前置：084–102 已完成（Auth / 房间 / 预订 / 统计 / 前端联调）。

## 一、本章要解决的问题（开场，不写「本章目标」小节）

1. 本机 `pnpm start:dev` 能跑，为什么上线是另一件事：进程管理、反向代理、TLS、环境变量、迁移、健康检查、回滚，缺一个就不算「上线」。
2. 读者最常踩的顺序错误：先买服务器 → 先装 Docker → 先拉镜像，但**没先确认机器被什么占着**（面板、旧站点、非 22 的 SSH 端口、已有数据库）。
3. 本章产出：一次可复现的部署（命令 + 预期输出），一张「上线检查单」，一次「故意打挂再恢复」的演练。

## 二、结构（按顺序，每节一个动作）

### 1. 先勘察，再动手（只读，10 分钟）
- 要查的六件事与理由：谁在跑（`docker ps -a`）、端口被谁占（`ss -lntp`）、防火墙由谁管（`nft list ruleset` / 云安全组）、已有服务（`systemctl list-units` 过滤 nginx/postgres/redis）、磁盘与 inode（`df -h` / `df -i`）、必备命令是否存在（`curl/git/jq`，minimal 镜像常被裁）。
- **核心教学点**：`ufw allow OpenSSH` 在 SSH 非 22 端口时无效；装 ufw 可能与面板/nftables 规则打架，把自己锁在门外。
- checkpoint：贴出六条命令的输出，并回答「80/443 是否空闲、防火墙归谁管」。

### 2. 主机最小加固
- 非 root 部署用户 + sudo 白名单（只给 `docker`/`systemctl restart` 需要的命令）。
- SSH：先验证密钥登录成功，再关密码、关 root 直登（顺序反了会锁死）。
- 时间：宿主机 UTC、容器 `TZ=Asia/Shanghai`，并解释为什么（日志对齐 vs 业务展示）。
- 不做：fail2ban、内核参数调优（放到 Part 23 可靠性章），避免一章塞太多。

### 3. 构建镜像：把 Dockerfile 章的知识用在自己的项目上
- 多阶段：`deps`（只装 lockfile 依赖）→ `build`（`db:emit` 必须在 `build` 之前）→ `runtime`（非 root、只带 dist 与生产依赖）。
- 关键坑：**Prisma 8 的 `contract.json`/`contract.d.ts` 是构建期产物**，漏拷就在运行时才炸；`corepack` 固定 pnpm 版本；`.dockerignore` 要排除 `node_modules`、`.env`、`prisma/migrations`（迁移在容器外跑）。
- checkpoint：`docker images` 输出镜像体积 + `docker run --rm <img> node -e "console.log(process.version)"` 证明运行时正确。

### 4. 编排：compose.prod 的分工
- 只跑「有状态依赖 + 应用」：`postgres:17`（`shared_buffers`/`effective_cache_size`/`work_mem` 三个与 6G 内存匹配的值）、`redis:8`（`appendonly` + `maxmemory` + 淘汰策略）、`api`（`read_only` + `tmpfs` + `no-new-privileges`）。
- 迁移用一次性容器：`db:init → db:plan → db:migrate → db:seed`，跑完退出；**不要**在应用启动时跑迁移。
- 端口：应用只绑 `127.0.0.1:8080`，对外由 Nginx 接。
- checkpoint：`docker compose -f compose.prod.yml ps` 三个服务 healthy；`curl -i localhost:8080/api/health` 200。

### 5. 反向代理与 HTTPS
- 两种路径：已备案 → certbot 80/443 自动签发；未备案 → Cloudflare 橙云 + Origin Certificate + 源站 8443。
- 必须配的响应头与超时（`client_max_body_size` 与上传章对应、`proxy_read_timeout` 与 SSE 对应）。
- checkpoint：`curl -sI https://<域名>/api/health` 看到 200 + HSTS；证书链校验通过。

### 6. 验收：不是「能打开」，而是「逐项核对」
- 功能：登录 → 建房间 → 订会议 → 冲突被拒 → 统计接口；每步的 curl 与预期 JSON。
- 观测：日志里有 `requestId`、错误有堆栈、`/api/health` 反映依赖状态（DB 断开会变 503）。
- 安全：401/403/400 各触发一次；限流触发一次；确认 `.env` 没进镜像（`docker history` / `docker run --rm <img> ls -a`）。
- 性能：一条慢查询的 `EXPLAIN ANALYZE`（100 万行造数据脚本），加索引后 P95 对比。

### 7. 演练：故意打挂，再恢复
- 停掉 postgres → 看健康检查与错误页 → 恢复；杀掉 api 容器 → 看 compose 重启策略。
- 备份恢复：`pg_dump -Fc` → 恢复到新库 → 逐表 `n_live_tup` 对比 → 记录 RTO/RPO。
- 回滚：镜像打两个 tag，`docker compose up -d` 回上一个。
- checkpoint：写出本次演练的 RTO/RPO 与「下次改进」一条。

### 8. 上线检查单（章末，可当 checklist 复用）
- 12 项：密钥与端口、防火墙、镜像可复现、迁移可回滚、健康检查、日志落盘与轮转、备份定时任务、证书到期提醒、限流与 CORS、错误页、资源限制、回滚脚本。

## 三、写作时要遵守的硬约束

- 每条命令后必须给「预期输出」；不能实测的段落标 `示意输出` 并说明原因（与全书 41 处「未实测」口径一致）。
- 不写「本章目标 / 小结 / 练习」；结尾只做「能力确认 + 指向下一章」。
- 至少 2 张 Mermaid：部署拓扑图、请求链路（浏览器 → Nginx → api → PG/Redis）。
- 引用前面章节时用「第 N 章」并核对标题（ch031 Dockerfile、ch041 事务、ch050 Prisma 集成、ch052 Redis）。

## 四、待真机回填清单（写作当天补）

| 项 | 占位 | 回填来源 |
| --- | --- | --- |
| 机器规格 | `<n> vCPU / <m>G / <d>G` | `nproc` / `free -h` / `df -h /` |
| 系统与内核 | `Ubuntu <ver>` / `<kernel>` | `cat /etc/os-release` / `uname -r` |
| Docker 版本 | `<docker version>` | `docker version` |
| SSH 端口 | `<port>` | `ss -lntp` 过滤 sshd |
| 防火墙归属 | `云安全组 / 面板 / nftables` | `nft list ruleset` |
| 镜像体积 | `<xx> MB` | `docker images` |
| 压测结果 | `p95 <xx> ms @ <n> 并发` | k6 输出 |

## 五、验收标准（写完自查）

- [ ] 从「一台装了面板的陌生机器」开始，读者能照着走到 HTTPS 200
- [ ] 每个 checkpoint 有命令 + 预期输出 + 不符时的排查方向
- [ ] 迁移、备份、回滚三条路径都实际跑过并记录数字
- [ ] 没有把本机专属事实（IP、端口号、盘大小）写进正文
- [ ] 与 ch031/ch103 之外章节无重复段落（尤其不重抄 Dockerfile 教程）
