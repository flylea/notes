# 章节写作执行简报（重写批专用）

## 你的任务

把指定范围的**已写章节**按新的可读性标准重写（原地覆盖同一个 `.md` 文件），不新增章节、不改章号、不改文件名。

新标准一句话：**写成掘金小册那种「讲人话、一步一步、真跑一遍」的教程**，而不是参考文档或课程讲义。用户已明确否决之前「开头堆术语 + 密集深度」的写法。

## 开工前必读

1. `STYLE-GUIDE.md`（**最高优先级，尤其 §2 叙事结构、§2.1 原创表达**）。
2. `part-01/004-5种HTTP数据传输方式.md`（**黄金样章**：从头到尾按它学——开头怎么切入、每一步怎么「是什么→怎么写→真跑一遍」、术语怎么顺手解释、坑怎么讲、结尾怎么收）。
3. `_meta/GLOSSARY.md`（术语口径速查，只用来自查口径，**不要**把术语表搬成章节开头的清单）。
4. `_meta/chapters.tsv`（8 列：chapter / part / part_title / file / slug / domains / project / status）与 `_meta/parts.tsv`。
5. 三个已安装 skill（写前读，按方法执行，但不要把它们的章节结构照搬成小标题）：
   - `~/.agents/skills/developer-tutorial/SKILL.md`：概念阶梯、checkpoint、引导渐隐。
   - `~/.agents/skills/doc-coauthoring/SKILL.md`：交稿前用"没上下文的读者"视角自查歧义。
   - `~/.agents/skills/nestjs-best-practices/SKILL.md`：Nest 规则清单；`test-*` 分类本期跳过。

## 写作步骤

1. 读 `chapters.tsv`，按章号找到 `part-XX/NNN-*.md` 目标文件。
2. **先读现有章节**，保住里面的技术事实、代码片段、版本号、坑；重写的是叙述方式和顺序，不是把内容删光。
3. 读掘金小册对应章节（**只参考节奏、问题顺序和举例方式，禁止逐字复制**）：
   ```bash
   ls "/Users/dailei/Documents/nest-nuggets-booklet/合并版/205版-较新目录/" | grep 'HTTP\|上传\|日志'
   ```
   路径模板：`"/Users/dailei/Documents/nest-nuggets-booklet/Nest 通关秘籍  最新200章/NN. 标题.md"`（"秘籍" 和 "最新" 之间是**两个空格**）。
4. 查官方 v12 文档确认 API（技术准确性的唯一依据）：
   ```bash
   grep -ril "关键词" .cache/nest-refs/docs-site/content/ | head
   ```
5. 按 STYLE-GUIDE §2 重写整章，原地写入。

## 写作红线

- **概念先于场景（红线）**：如果本章要引入读者还没学过的概念（TS 装饰器/元数据/反射、Nest 核心概念、IoC/DI、ORM、Docker 等），先用 2–5 段白话讲清「它是什么、为什么需要、没有它行不行」，并给出官方文档链接（TypeScript 概念给 TypeScript 官网，Nest 概念给 docs.nestjs.com），然后才进入具体问题；读者已在前文章节学过的概念可直接用，但一句话复述并指向首次解释处。不要开头罗列名词清单或写背景综述，也不要一上来甩报错/日志。
- **链接不是解释**：官方文档等外链只能作为延伸阅读，不许用「详见官方文档」+裸链接代替正文解释。必须先把概念在正文用中文讲透，再给链接；每条链接前用一句话说明它补充什么、对应哪一节或哪个 API。
- **开头直接进入具体问题**（在完成上面的概念解释之后）：不要"背景与术语 2–4 段"的综述；不要开头甩大段报错/日志。
- 新概念**第一次出现时就地解释**（一两句话：是什么、为什么、和相近概念的区别），随后立刻给最小例子或请求；不要集中罗列术语。
- 每一步是「是什么 → 怎么用 → 真跑一遍看结果」；命令、请求、返回结果贴真实内容，没跑过的标注"未实测"。
- 禁止教材式小节与句式：`本章目标`、`前置知识`、`练习`、`延伸阅读`、`小结`、`学完你将`、`本章将` 等；禁止小册学案式抬头。
- 不要写「这张图在说什么」这类图解段；图后直接正文。
- 不逐字复制小册；小册过时写法（Nest 9/10/11、CommonJS、MySQL/TypeORM 主线）要指出并给 Nest 12 写法。
- 代码必须语法正确、可运行、imports 完整（ESM 相对导入带 `.js`）；不写伪代码。

## 技术栈（硬约束）

- NestJS **12.3.x** + Node 22 + TypeScript strict + **ESM**（相对导入带 `.js`）+ pnpm。
- 数据库：**PostgreSQL 17**（不使用 MySQL）；ORM：**Prisma 8（RC）**，`prisma@8.0.0-rc.29` + `@prisma/orm-postgres@8.0.0-rc.21`（必须配对）。
  - 契约 `prisma/contract.prisma` 首行 `// use prisma-8`；`pnpm prisma contract emit` 生成 `contract.json`/`contract.d.ts`。
  - 运行时 `postgres({ contract, url })`，`db.orm.public.User`，链式 `.where/.select/.orderBy/.limit/.all/.create/.createAll/.updateAll/.deleteAll`；事务 `db.transaction`。
  - 配置根 `prisma.config.ts`（`definePrismaConfig` + `@prisma/orm-postgres/config`）。
- Redis 8 + ioredis；RabbitMQ 4 / Kafka 4 / RocketMQ。
- **本期不写测试内容**：不展开 Vitest/Jest/单测/e2e/压测；验证用命令、curl、构建结果、SQL。
- `main.ts` 用 top-level await bootstrap；命令与依赖版本写明确。
- 参考实现：`example/`（会议室预订系统，PG17 + Prisma 8），代码命名与之保持一致。

## 内容约束

- 只改分配给你的章节文件；**不要**修改 `STYLE-GUIDE.md`、`WRITER-BRIEF.md`、`GLOSSARY.md`、`chapters.tsv`、`parts.tsv`、`README.md`、`_part.md`、`example/` 或其他章节；不 commit、不 git 操作；不在仓库根跑安装/构建。
- 黄金样章 `004-5种HTTP数据传输方式.md` 已完成，不要再改它。
- 篇幅由内容决定，不凑字数；概念章约 1500–2500 汉字，实操章约 2000–3500 汉字。
- 需要配图的主题（架构/流程/原理/协议/时序/关系/部署/生命周期/数据流/可靠性/可观测）用 Mermaid，一句题注即可。
- 环境里没有运行 PostgreSQL/Redis/Prisma CLI/Docker 时，命令输出可引用文档/标准行为，但必须在正文标注"示例输出/未实测"，不能把没跑的结果写成"实测"。

## 自检门禁（交稿前必须跑，全部 exit 0）

```bash
node _meta/validate-chapters.mjs <start> <end>   # 教材腔 0；信息量不足/按需缺图为 0
node _meta/qa-report.mjs <start> <end>            # 教材腔列全 0
node _meta/check-originality.mjs <start> <end>    # 高风险 0、警告 0
node _meta/check-structure.mjs                    # 只读，确认没有破坏结构
```

## 交付

最终消息报告：写入文件清单、每章汉字/代码块/配图、参考的小册章与官方文档页、未实测或存疑的内容。
