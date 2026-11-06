#!/usr/bin/env node
// 生成教程结构：根 README（大纲/路线/技能矩阵/项目地图/进度）、每个 Part 的 _part.md、已写章节的上一篇/下一篇页脚。
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

const chapterRows = readTsv('chapters.tsv').slice(1);
const partRows = readTsv('parts.tsv').slice(1);

const chapters = chapterRows.map((r) => ({
  num: Number(r[0]),
  part: r[1],
  partTitle: r[2],
  file: r[3],
  slug: r[4],
  domains: r[5],
  project: r[6],
  status: r[7],
}));

// 标题从文件名推导（001-开篇词.md → 开篇词）
const chapterTitle = (c) => c.file.replace(/^\d{3}-/, '').replace(/\.md$/, '');
const chapterPath = (c) => `${c.part}/${c.file}`;
const isWritten = (c) => c.status === '已写' && existsSync(join(root, c.part, c.file));

const parts = partRows.map((r) => ({
  part: r[0],
  no: Number(r[1]),
  section: r[2],
  sectionNo: Number(r[3]),
  title: r[4],
  range: r[5],
  count: Number(r[6]),
  domains: r[7],
  project: r[8],
  goal: r[9],
  outcome: r[10],
  required: r[11],
}));

const sectionOrder = [...new Set(parts.map((p) => `${p.sectionNo}\t${p.section}`))]
  .map((s) => s.split('\t'))
  .map(([no, title]) => ({ no: Number(no), title }));

const byPart = new Map(parts.map((p) => [p.part, []]));
for (const c of chapters) byPart.get(c.part)?.push(c);

// ---------- 统计 ----------
const written = chapters.filter(isWritten);
const domains = new Map();
for (const c of chapters) {
  for (const d of c.domains.split('/').map((s) => s.trim()).filter(Boolean)) {
    const item = domains.get(d) ?? { total: 0, written: 0 };
    item.total += 1;
    if (isWritten(c)) item.written += 1;
    domains.set(d, item);
  }
}
const domainRows = [...domains.entries()].sort((a, b) => b[1].total - a[1].total);

const projectInfo = {
  'meeting-booking': ['会议室预订系统（主线）', '84–103', 'example/（Nest 12 + Prisma 8 后端）'],
  'meeting-booking-web': ['会议室预订系统前端', '244–250', 'example/meeting-booking-web/（Next.js 16 + shadcn，规划中）'],
  ecommerce: ['电商系统', '137–144', '本项目章节内实现'],
  dianping: ['大众点评系统', '148–152', '本项目章节内实现'],
  chatroom: ['聊天室', '160–166', '本项目章节内实现'],
  education: ['教育平台（GraphQL）', '167–176', '本项目章节内实现'],
  blog: ['博客系统', '183–190', '本项目章节内实现'],
};

// ---------- README ----------
const chapterLine = (c) =>
  isWritten(c)
    ? `- ✅ [${String(c.num).padStart(3, '0')} ${chapterTitle(c)}](${chapterPath(c)})`
    : `- ⬜ ${String(c.num).padStart(3, '0')} ${chapterTitle(c)}（待写）`;

const toc = sectionOrder
  .map((s) => {
    const secParts = parts.filter((p) => p.sectionNo === s.no);
    const secTotal = secParts.reduce((n, p) => n + p.count, 0);
    const secWritten = secParts.reduce(
      (n, p) => n + byPart.get(p.part).filter(isWritten).length,
      0,
    );
    const partBlocks = secParts
      .map((p) => {
        const list = byPart.get(p.part);
        const w = list.filter(isWritten).length;
        return [
          `### Part ${String(p.no).padStart(2, '0')} · ${p.title}（第 ${p.range.replace('-', '–')} 章）`,
          '',
          `> 本 Part 共 ${p.count} 章，已写 ${w} 章。${p.goal}`,
          '',
          ...list.map(chapterLine),
          '',
        ].join('\n');
      })
      .join('\n');
    return [
      `## 第 ${s.no} 篇 · ${s.title}（${secTotal} 章，已写 ${secWritten}）`,
      '',
      partBlocks,
    ].join('\n');
  })
  .join('\n');

const progressRows = parts
  .map((p) => {
    const list = byPart.get(p.part);
    return `| Part ${String(p.no).padStart(2, '0')} | ${p.title} | 第 ${p.range.replace('-', '–')} 章 | ${list.filter(isWritten).length} / ${list.length} |`;
  })
  .join('\n');

const readme = `# NestJS 12 全栈实战通关教程

> 基于 **NestJS 12.3.x** 最新官方文档重写，覆盖 **${chapters.length} 章 / ${parts.length} 个 Part / ${sectionOrder.length} 篇**，从一个完整业务项目出发，把 NestJS 全栈开发从语法讲到企业级交付。

## 版本基线（2026-11）

| 组件 | 版本 | 说明 |
| --- | --- | --- |
| NestJS | 12.3.x | 官方文档 v12；ESM 为 CLI 默认 |
| Node.js | 22 LTS / 24 LTS | 运行 v20.19+；CLI 生成器需 v22.22.3+/v24.15+/v26+ |
| TypeScript | 5.9+ / 6.x | 脚手架默认 strict |
| 数据库 | **PostgreSQL 17** | 主库统一用 PostgreSQL |
| ORM | **Prisma 8**（RC） | \`prisma@8.0.0-rc.29\` + \`@prisma/orm-postgres@8.0.0-rc.21\`，版本必须配对；另含 TypeORM / Drizzle / MikroORM / MongoDB 对照章节 |
| 缓存/队列 | Redis 8、RabbitMQ 4、Kafka 4、RocketMQ | 含选型对比 |
| 实时 | WebSocket（ws / socket.io 4）、SSE | |
| API | GraphQL（Apollo Server 5）、REST + Swagger/OpenAPI | 含 federation |
| 部署 | Docker / Compose、Nginx、K8s、Vercel | |
| 测试 | 本期暂不引入 | 单测/e2e/压测章节暂缓；验证以命令、curl、接口契约与构建结果为准 |

> Prisma 8 目前是 release candidate。本教程按 Prisma 8 的 contract 模型与 \`@prisma/orm-postgres\` 运行时编写；升级到 GA 时只需同步升级两个包版本。

## 如何使用本教程

1. ${chapters.length} 章按 **${sectionOrder.length} 篇 → ${parts.length} 个 Part** 组织；每章是独立可读的讲解，包含可运行代码与验证步骤。
2. 所有代码以 ESM + strict TS 编写，示例项目在 \`example/\`，随项目章节逐步完善。
3. 每章文末给出官方文档链接；版本冲突时以最新 v12 文档为准。
4. **篇幅由内容决定，不凑字数**：讲清一个问题即收尾，不做注水扩写；每章至少一张图（Mermaid 优先），架构/流程类必须有图。

## 学习路线

| 路线 | 适合谁 | 顺序 |
| --- | --- | --- |
| A. 全栈求职（推荐） | 想尽快拿全栈 offer | Part 00–02 → Part 03–05 → Part 06（项目一）→ Part 10/12/14/15/17（选两个项目）→ Part 18/20 → Part 21–26 → Part 29 |
| B. 完整通关 | 时间充足，想系统掌握 | Part 00 → Part ${String(parts.length - 1).padStart(2, '0')} 按序学完全部 ${chapters.length} 章 |
| C. 专题补强 | 已有基础，按需补短板 | 按下方「技能矩阵」选 Part：可靠性/可观测/AI/全栈交付/数据架构等 |

## 项目地图

| 项目 | 章节 | 位置 |
| --- | --- | --- |
${Object.entries(projectInfo)
  .map(([, [name, range, where]]) => `| ${name} | ${range} | ${where} |`)
  .join('\n')}

## 技能矩阵（按章节领域统计）

| 技术域 | 章节数 | 已写 |
| --- | ---: | ---: |
${domainRows.map(([d, v]) => `| ${d} | ${v.total} | ${v.written} |`).join('\n')}

## 完整目录（${chapters.length} 章）

${toc}
## 进度

| Part | 标题 | 章节 | 已写 / 总数 |
| --- | --- | --- | ---: |
${progressRows}

- 当前已写 **${written.length} / ${chapters.length}** 章。
- 写作规范见 [STYLE-GUIDE.md](STYLE-GUIDE.md)，结构由 \`_meta/build-structure.mjs\` 生成，门禁见 \`_meta/check-structure.mjs\`、\`_meta/validate-chapters.mjs\`。

## 资料与致谢

- 官方文档：<https://docs.nestjs.com/>（v12）
- 生态资源：[nestjs/awesome-nestjs](https://github.com/nestjs/awesome-nestjs)
- 学习路径参考：掘金小册《Nest 通关秘籍》（仅参考章节顺序与问题清单，正文为原创重写，不逐字复制）
- 写作方法：已安装 skill \`developer-tutorial\`、\`doc-coauthoring\`、\`nestjs-best-practices\`
`;

writeFileSync(join(root, 'README.md'), readme);

// ---------- 每个 Part 的 _part.md ----------
for (const p of parts) {
  const dir = join(root, p.part);
  mkdirSync(dir, { recursive: true });
  const list = byPart.get(p.part);
  const prev = parts.find((x) => x.no === p.no - 1);
  const next = parts.find((x) => x.no === p.no + 1);
  const chapterLines = list
    .map((c) =>
      isWritten(c)
        ? `- ✅ [${String(c.num).padStart(3, '0')} ${chapterTitle(c)}](${c.file})`
        : `- ⬜ ${String(c.num).padStart(3, '0')} ${chapterTitle(c)}（待写）`,
    )
    .join('\n');
  const nav = [
    prev ? `[← Part ${String(prev.no).padStart(2, '0')} · ${prev.title}](../${prev.part}/_part.md)` : '',
    '[返回教程目录](../README.md)',
    next ? `[Part ${String(next.no).padStart(2, '0')} · ${next.title} →](../${next.part}/_part.md)` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const hub = `# Part ${String(p.no).padStart(2, '0')} · ${p.title}

> 第 ${p.sectionNo} 篇 · 第 ${p.range.replace('-', '–')} 章 · 共 ${p.count} 章 · 已写 ${list.filter(isWritten).length} 章 · ${p.required === 'required' ? '必修' : '选修'}

## 本 Part 定位

${p.goal}

## 技术域

${p.domains}

## 章节

${chapterLines}

## 完成标志

${p.outcome}

---

${nav}
`;
  writeFileSync(join(dir, '_part.md'), hub);
}

// ---------- 已写章节的页脚导航 ----------
const sortByNum = [...chapters].sort((a, b) => a.num - b.num);
const idxOf = new Map(sortByNum.map((c, i) => [c.num, i]));

const footerFor = (c) => {
  const i = idxOf.get(c.num);
  const prev = sortByNum[i - 1];
  const next = sortByNum[i + 1];
  const linkTo = (from, to) => {
    if (!isWritten(to)) return null;
    const rel = from.part === to.part ? to.file : `../${to.part}/${to.file}`;
    return `[${String(to.num).padStart(3, '0')} ${chapterTitle(to)}](${rel})`;
  };
  const prevLink = prev && isWritten(prev) ? `← 上一篇：${linkTo(c, prev)}` : null;
  const nextLink = next && isWritten(next) ? `下一篇：${linkTo(c, next)} →` : null;
  const parts_ = [
    prevLink,
    `[本 Part 目录](_part.md)`,
    nextLink,
  ].filter(Boolean);
  return [
    '<!-- chapter-nav:start -->',
    '---',
    '',
    parts_.join(' · '),
    '<!-- chapter-nav:end -->',
  ].join('\n');
};

let footerCount = 0;
for (const c of written) {
  const path = join(root, c.part, c.file);
  const md = readFileSync(path, 'utf8');
  const block = footerFor(c);
  const next = /<!-- chapter-nav:start -->[\s\S]*?<!-- chapter-nav:end -->\n?/.test(md)
    ? md.replace(/<!-- chapter-nav:start -->[\s\S]*?<!-- chapter-nav:end -->\n?/, `${block}\n`)
    : `${md.replace(/\n*$/, '\n')}\n${block}\n`;
  if (next !== md) {
    writeFileSync(path, next);
    footerCount += 1;
  }
}

console.log(
  `README.md 已生成（${chapters.length} 章 / ${parts.length} Part / 已写 ${written.length}）`,
);
console.log(`_part.md 已生成 ${parts.length} 个；章节页脚更新 ${footerCount} 个`);
