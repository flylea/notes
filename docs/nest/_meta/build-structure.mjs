#!/usr/bin/env node
// 生成教程结构：根 README（4 部 / 21 章）、每章 _chapter.md 导读、每节页脚导航。
// 用法：node _meta/build-structure.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const readTsv = (name) =>
  readFileSync(join(root, '_meta', name), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));

const outlineRows = readTsv('BOOK-OUTLINE.tsv').slice(1);
const sectionRows = readTsv('chapters.tsv').slice(1);

const chapters = outlineRows.map((r) => ({
  part: Number(r[0]),
  partTitle: r[1],
  ch: r[2],
  title: r[3],
  count: Number(r[4]),
  written: Number(r[5]),
  source: r[6],
  goal: r[7],
  outcome: r[8],
  hours: Number(r[9]),
}));

const sections = sectionRows.map((r) => ({
  section: r[0],
  ch: r[1],
  chapterTitle: r[2],
  part: r[3],
  file: r[4],
  title: r[5],
  slug: r[6],
  domains: r[7],
  project: r[8],
  status: r[9],
}));

const chDirOf = (ch) => sections.find((s) => s.ch === ch).file.split('/').slice(0, 2).join('/');
const chDirName = (ch) => chDirOf(ch).split('/')[1];
const isWritten = (s) => s.status === '已写' && existsSync(join(root, s.file));
const sectionsOf = (ch) => sections.filter((s) => s.ch === ch);

const parts = [...new Set(chapters.map((c) => c.part))].map((no) => ({
  no,
  title: chapters.find((c) => c.part === no).partTitle,
  chapters: chapters.filter((c) => c.part === no),
  sections: sections.filter((s) => chapters.find((c) => c.ch === s.ch).part === no),
}));

const totalWritten = sections.filter(isWritten).length;

// ---------- README ----------
const domains = new Map();
for (const s of sections) {
  for (const d of s.domains.split('/').map((x) => x.trim()).filter((x) => x && x !== '-')) {
    const item = domains.get(d) ?? { total: 0, written: 0 };
    item.total += 1;
    if (isWritten(s)) item.written += 1;
    domains.set(d, item);
  }
}
const domainRows = [...domains.entries()].sort((a, b) => b[1].total - a[1].total);

const chapterLine = (c) => {
  const w = sectionsOf(c.ch).filter(isWritten).length;
  const mark = w === c.count ? '✅' : w > 0 ? '🟡' : '⬜';
  return `- ${mark} **[第 ${Number(c.ch)} 章 ${c.title}](${chDirOf(c.ch)}/_chapter.md)**（${w}/${c.count} 节 · 约 ${c.hours} 学时）`;
};

const sectionLine = (s) =>
  isWritten(s)
    ? `  - ✅ [${s.section} ${s.title}](${s.file})`
    : `  - ⬜ ${s.section} ${s.title}（待写）`;

const toc = parts
  .map((p) => {
    const w = p.sections.filter(isWritten).length;
    return [
      `## 第 ${p.no} 部 · ${p.title}（${p.chapters.length} 章 / ${p.sections.length} 节，已写 ${w}）`,
      '',
      p.chapters
        .map((c) => [chapterLine(c), ...sectionsOf(c.ch).map(sectionLine), ''].join('\n'))
        .join('\n'),
    ].join('\n');
  })
  .join('\n');

const progressRows = parts
  .map(
    (p) =>
      `| 第 ${p.no} 部 | ${p.title} | ${p.chapters.length} 章 / ${p.sections.length} 节 | ${p.sections.filter(isWritten).length} / ${p.sections.length} |`,
  )
  .join('\n');

const chapterProgressRows = chapters
  .map(
    (c) =>
      `| ${Number(c.ch)} | ${c.title} | 第 ${c.part} 部 | ${sectionsOf(c.ch).filter(isWritten).length} / ${c.count} | ${c.source.replace(/\|/g, '、')} |`,
  )
  .join('\n');

const readme = `# NestJS 12 全栈实战通关教程

> 基于 **NestJS 12.6.x** 最新官方文档重写，覆盖 **4 部 / ${chapters.length} 章 / ${sections.length} 节**，从一个完整业务项目出发，把 NestJS 全栈开发从语法讲到企业级交付。
>
> 阅读单元是「章」：每章有独立导读页（定位、知识地图、验收清单），下面是按顺序排列的节；节号（如 \`05.03\`）发布后不再变化。

## 版本基线（2026-11）

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| NestJS | 12.6.x | 官方文档 v12（2026-11-20 快照）；ESM 为 CLI 默认 |
| Node.js | 22 / 24 / 26 LTS | 当前 LTS 为 26（Lithium）；运行需 v20.19+，CLI 生成器需 v22.22.3+/v24.15+/v26+ |
| TypeScript | 6.0.x | 脚手架默认 strict；**暂不升 7.0**（\`@nestjs/graphql\` peer 仅 ^5.5 || ^6） |
| 数据库 | **PostgreSQL 17** | 主库统一用 PostgreSQL |
| ORM | **Prisma 8**（RC） | \`prisma@8.0.0-rc.34\` + \`@prisma/orm-postgres@8.0.0-rc.24\`，版本必须配对；8.0 仍未 GA；另含 TypeORM / Drizzle / MikroORM / MongoDB 对照章节 |
| 缓存/队列 | Redis 8、RabbitMQ 4、Kafka 4、RocketMQ | 含选型对比 |
| 实时 | WebSocket（ws 8 / socket.io 4）、SSE | Nest 12 网关支持请求作用域与断连原因 |
| API | GraphQL（@nestjs/graphql 14.2.x + Apollo Server 5）、REST + Swagger/OpenAPI（@nestjs/swagger 12.1.x，OpenAPI 3.1） | 含 federation |
| 部署 | Docker 29 / Compose v2、Nginx、K8s、Vercel | 镜像 tag 在章节内注明 |
| 测试 | 本期暂不引入 | Nest 12 脚手架默认带 Vitest 4 + oxlint，本书用 \`--skip-tests\` 显式跳过并说明取舍；验证以命令、curl、接口契约与构建结果为准 |

> Prisma 8 目前是 release candidate。本教程按 Prisma 8 的 contract 模型与 \`@prisma/orm-postgres\` 运行时编写；升级到 GA 时只需同步升级两个包版本。

## 如何使用本教程

1. 全书 **4 部 / ${chapters.length} 章 / ${sections.length} 节**。每章先读 \`_chapter.md\` 导读（这一章解决什么问题、验收清单），再按顺序读节。
2. 所有代码以 ESM + strict TS 编写，示例项目在 \`example/\`，随项目章节逐步完善。
3. 每节文末给出上一节/下一节与本章目录；版本冲突时以最新 v12 文档为准。
4. **篇幅由内容决定，不凑字数**：讲清一个问题即收尾，不做注水扩写；概念章至少一张图（Mermaid 优先），流程/架构类必须有图。

## 学习路线

| 路线 | 适合谁 | 顺序 |
| --- | --- | --- |
| A. 全栈求职（推荐） | 想尽快拿全栈 offer | 第 1 部 → 第 2 部 ch06–ch10 → 第 3 部 ch12（项目一）→ 第 4 部选两章项目 → ch17–ch20 → ch21 |
| B. 完整通关 | 时间充足，想系统掌握 | 第 1 部到第 4 部按序学完全部 ${chapters.length} 章 |
| C. 专题补强 | 已有基础，按需补短板 | 按下方「技能矩阵」直接进对应章 |

## 项目地图

| 项目 | 章节 | 位置 |
| --- | --- | --- |
| 会议室预订系统（主线） | ch12 | \`example/\`（Nest 12 + Prisma 8 后端） |
| 会议室预订系统前端 | ch19 | \`example/meeting-booking-web/\`（Next.js 16 + shadcn，规划中） |
| 电商系统 | ch13 | 章节内实现 |
| 大众点评系统 | ch13 | 章节内实现 |
| 聊天室 | ch14 | 章节内实现 |
| 教育平台（GraphQL） | ch14 | 章节内实现 |
| 博客系统 | ch14 | 章节内实现 |

## 技能矩阵（按节领域统计）

| 技术域 | 节数 | 已写 |
| --- | ---: | ---: |
${domainRows.map(([d, v]) => `| ${d} | ${v.total} | ${v.written} |`).join('\n')}

## 完整目录

${toc}## 进度

| 部 | 标题 | 规模 | 已写 / 总 |
| --- | --- | --- | ---: |
${progressRows}

| 章 | 标题 | 部 | 已写 / 总 | 来源（旧节号） |
| --- | --- | --- | ---: | --- |
${chapterProgressRows}

- 当前已写 **${totalWritten} / ${sections.length}** 节（${chapters.length} 章）。
- 写作规范见 [STYLE-GUIDE.md](STYLE-GUIDE.md)；结构由 \`_meta/build-structure.mjs\` 生成，门禁见 \`_meta/check-structure.mjs\`、\`_meta/validate-chapters.mjs\`。

## 资料与致谢

- 官方文档：<https://docs.nestjs.com/>（v12）
- 生态资源：[nestjs/awesome-nestjs](https://github.com/nestjs/awesome-nestjs)
- 学习路径参考：掘金小册《Nest 通关秘籍》（仅参考问题清单，正文为原创重写，不逐字复制）
`;

writeFileSync(join(root, 'README.md'), readme);

// ---------- 每章 _chapter.md ----------
let hubCount = 0;
for (const c of chapters) {
  const dir = chDirOf(c.ch);
  const list = sectionsOf(c.ch);
  const prev = chapters.find((x) => Number(x.ch) === Number(c.ch) - 1);
  const next = chapters.find((x) => Number(x.ch) === Number(c.ch) + 1);
  const w = list.filter(isWritten).length;
  const shortTitle = (t) => (t.length > 18 ? `${t.slice(0, 17)}…` : t);
  const nodes = list
    .map(
      (s) =>
        `  s${Number(s.section.split('.')[1])}["${s.section} ${shortTitle(s.title).replace(/"/g, '')}"]`,
    )
    .join('\n');
  const edges = list
    .slice(1)
    .map((_, i) => `  s${i + 1} --> s${i + 2}`)
    .join('\n');

  const nav = [
    prev ? `[← 第 ${Number(prev.ch)} 章 ${prev.title}](../${chDirName(prev.ch)}/_chapter.md)` : '',
    '[返回教程目录](../../README.md)',
    next ? `[第 ${Number(next.ch)} 章 ${next.title} →](../${chDirName(next.ch)}/_chapter.md)` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const secLines = list
    .map((s) =>
      isWritten(s)
        ? `- ✅ [${s.section} ${s.title}](${s.file.split('/')[2]})`
        : `- ⬜ ${s.section} ${s.title}（待写）`,
    )
    .join('\n');

  const hub = `# 第 ${Number(c.ch)} 章 ${c.title}

> 第 ${c.part} 部 · ${c.count} 节 · 约 ${c.hours} 学时 · 已写 ${w} 节

## 这一章解决什么问题

${c.goal}

## 知识地图

\`\`\`mermaid
flowchart TD
${nodes}
${edges}
\`\`\`

## 验收清单

- [ ] ${c.outcome}
- [ ] 能不看笔记复述本章核心机制与取舍
- [ ] 本章的命令/示例能独立跑通，并留下自己的验证记录

## 节清单

${secLines}

---

${nav}
`;
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, '_chapter.md'), hub);
  hubCount += 1;
}

// ---------- 已写节页脚导航 ----------
const order = [...sections].sort((a, b) => a.section.localeCompare(b.section));
const idx = new Map(order.map((s, i) => [s.section, i]));

const footerFor = (s) => {
  const i = idx.get(s.section);
  const prev = order[i - 1];
  const next = order[i + 1];
  const link = (from, to) => {
    if (!isWritten(to)) return null;
    const fromDir = from.file.split('/')[1];
    const toDir = to.file.split('/')[1];
    const href = fromDir === toDir ? to.file.split('/')[2] : `../${toDir}/${to.file.split('/')[2]}`;
    return `[${to.section} ${to.title}](${href})`;
  };
  const prevLink = prev && isWritten(prev) ? `← ${link(s, prev)}` : null;
  const nextLink = next && isWritten(next) ? `${link(s, next)} →` : null;
  const parts_ = [prevLink, '[本章目录](_chapter.md)', nextLink].filter(Boolean);
  return ['<!-- chapter-nav:start -->', '---', '', parts_.join(' · '), '<!-- chapter-nav:end -->'].join('\n');
};

let footerCount = 0;
for (const s of sections.filter(isWritten)) {
  const path = join(root, s.file);
  const md = readFileSync(path, 'utf8');
  const block = footerFor(s);
  const nextMd = /<!-- chapter-nav:start -->[\s\S]*?<!-- chapter-nav:end -->\n?/.test(md)
    ? md.replace(/<!-- chapter-nav:start -->[\s\S]*?<!-- chapter-nav:end -->\n?/, `${block}\n`)
    : `${md.replace(/\n*$/, '\n')}\n${block}\n`;
  if (nextMd !== md) {
    writeFileSync(path, nextMd);
    footerCount += 1;
  }
}

console.log(
  `README.md 已生成（${parts.length} 部 / ${chapters.length} 章 / ${sections.length} 节 / 已写 ${totalWritten}）`,
);
console.log(`_chapter.md 已生成 ${hubCount} 个；节页脚更新 ${footerCount} 个`);
