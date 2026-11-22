#!/usr/bin/env node
// 结构一致性门禁：chapters.tsv / BOOK-OUTLINE.tsv / README / 章导读 / 节页脚。
// 用法：node _meta/check-structure.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const errors = [];
const err = (msg) => errors.push(msg);

const readTsv = (name, expectedCols) => {
  const path = join(root, '_meta', name);
  if (!existsSync(path)) {
    err(`缺文件：_meta/${name}`);
    return [];
  }
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
  if (!lines.length) {
    err(`_meta/${name} 为空`);
    return [];
  }
  const rows = lines.map((line) => line.split('\t'));
  if (rows[0].length !== expectedCols) {
    err(`_meta/${name} 表头应为 ${expectedCols} 列，实际 ${rows[0].length} 列`);
  }
  rows.slice(1).forEach((row, i) => {
    if (row.length !== expectedCols) err(`_meta/${name} 第 ${i + 2} 行应为 ${expectedCols} 列，实际 ${row.length} 列`);
  });
  return rows.slice(1);
};

const rows = readTsv('chapters.tsv', 10);
const outlineRows = readTsv('BOOK-OUTLINE.tsv', 10);

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

const sections = rows.map((r) => ({
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

// ---------- 规模 ----------
const EXPECT_CHAPTERS = 21;
const EXPECT_SECTIONS = 264;
const EXPECT_PARTS = 4;
if (chapters.length !== EXPECT_CHAPTERS) err(`BOOK-OUTLINE.tsv 应为 ${EXPECT_CHAPTERS} 行，实际 ${chapters.length}`);
if (sections.length !== EXPECT_SECTIONS) err(`chapters.tsv 应为 ${EXPECT_SECTIONS} 行，实际 ${sections.length}`);

// ---------- 章 ----------
chapters.forEach((c, i) => {
  const n = i + 1;
  if (c.ch !== String(n).padStart(2, '0')) err(`第 ${n} 章编号应为 ${String(n).padStart(2, '0')}，实际 ${c.ch}`);
  if (c.part < 1 || c.part > EXPECT_PARTS) err(`第 ${c.ch} 章 part=${c.part} 超出 1..${EXPECT_PARTS}`);
  const list = sections.filter((s) => s.ch === c.ch);
  if (list.length !== c.count) err(`第 ${c.ch} 章实际节数 ${list.length} ≠ outline ${c.count}`);
});
const partNums = [...new Set(chapters.map((c) => c.part))].sort();
if (partNums.join(',') !== Array.from({ length: EXPECT_PARTS }, (_, i) => i + 1).join(',')) {
  err(`部编号不是 1..${EXPECT_PARTS}：${partNums.join(',')}`);
}

// ---------- 节 ----------
const chDirs = new Map();
for (const s of sections) {
  const m = /^book\/(ch-\d{2}-[^/]+)\/(\d{2})\.(\d{2})-(.+)\.md$/.exec(s.file);
  if (!m) {
    err(`节 ${s.section} 文件路径不符合 book/ch-NN-*/NN.MM-*.md：${s.file}`);
    continue;
  }
  const [, dir, chNum, secNum, fileTitle] = m;
  chDirs.set(s.ch, dir);
  if (chNum !== s.ch) err(`节 ${s.section} 路径章号 ${chNum} ≠ 字段 ${s.ch}`);
  if (dir !== chDirs.get(s.ch)) err(`第 ${s.ch} 章节目录不一致：${dir} vs ${chDirs.get(s.ch)}`);
  if (`${chNum}.${secNum}` !== s.section) err(`节号与路径不一致：${s.section} vs ${s.file}`);
  if (!fileTitle) err(`节 ${s.section} 文件名标题为空`);
  if (s.slug !== `ch-${chNum}-${secNum}`) err(`节 ${s.section} slug 格式错误：${s.slug}`);
  if (!['已写', '待写'].includes(s.status)) err(`节 ${s.section} status 非法：${s.status}`);
  const exists = existsSync(join(root, s.file));
  if ((s.status === '已写') !== exists) err(`节 ${s.section} status=${s.status} 但文件${exists ? '存在' : '不存在'}`);
  const ch = chapters.find((c) => c.ch === s.ch);
  if (!ch) err(`节 ${s.section} 的章 ${s.ch} 不在 outline`);
  else {
    if (ch.title !== s.chapterTitle) err(`节 ${s.section} chapter_title 与 outline 不一致`);
    if (`part-${String(ch.part).padStart(2, '0')}` !== s.part) err(`节 ${s.section} part 与 outline 不一致`);
  }
}

// 每章节号连续 01..N
for (const c of chapters) {
  const list = sections.filter((s) => s.ch === c.ch);
  list.forEach((s, i) => {
    const expect = `${c.ch}.${String(i + 1).padStart(2, '0')}`;
    if (s.section !== expect) err(`第 ${c.ch} 章节号不连续：期望 ${expect}，实际 ${s.section}`);
  });
}

// 已写数与 outline written 一致
for (const c of chapters) {
  const w = sections.filter((s) => s.ch === c.ch && s.status === '已写').length;
  if (w !== c.written) err(`第 ${c.ch} 章已写数 ${w} ≠ outline ${c.written}（需重跑 restructure 或手改 outline）`);
}

// ---------- 章导读 ----------
for (const c of chapters) {
  const dir = chDirs.get(c.ch);
  if (!dir) continue;
  const hub = join(root, 'book', dir, '_chapter.md');
  if (!existsSync(hub)) {
    err(`缺章导读：${dir}/_chapter.md`);
    continue;
  }
  const md = readFileSync(hub, 'utf8');
  if (!md.includes(`# 第 ${Number(c.ch)} 章 ${c.title}`)) err(`第 ${c.ch} 章导读标题不符`);
  for (const key of ['## 这一章解决什么问题', '## 知识地图', '## 验收清单', '## 节清单']) {
    if (!md.includes(key)) err(`第 ${c.ch} 章导读缺小节：${key}`);
  }
  if (!md.includes('```mermaid')) err(`第 ${c.ch} 章导读缺 Mermaid 知识地图`);
}

// ---------- README ----------
const readmePath = join(root, 'README.md');
if (!existsSync(readmePath)) err('缺 README.md');
else {
  const readme = readFileSync(readmePath, 'utf8');
  const banner = `4 部 / ${chapters.length} 章 / ${sections.length} 节`;
  if (!readme.includes(banner)) err(`README 缺规模声明「${banner}」`);
  for (const c of chapters) {
    if (!readme.includes(`_chapter.md`)) break;
    if (!readme.includes(`（${sections.filter((s) => s.ch === c.ch && s.status === '已写').length}/${c.count} 节`)) {
      err(`README 缺第 ${c.ch} 章进度`);
    }
  }
  for (const s of sections) {
    const label = s.status === '已写' ? `](${s.file})` : `${s.section} ${s.title}（待写）`;
    if (!readme.includes(label)) err(`README 缺节条目：${s.section} ${s.title}`);
  }
}

// ---------- 节页脚 ----------
const order = [...sections].sort((a, b) => a.section.localeCompare(b.section));
const idx = new Map(order.map((s, i) => [s.section, i]));
const linkOf = (from, to) => {
  const fromDir = from.file.split('/')[1];
  const toDir = to.file.split('/')[1];
  const href = fromDir === toDir ? to.file.split('/')[2] : `../${toDir}/${to.file.split('/')[2]}`;
  return `${to.section} ${to.title}](${href})`;
};
let footerChecked = 0;
for (const s of sections.filter((x) => x.status === '已写')) {
  const md = readFileSync(join(root, s.file), 'utf8');
  const m = md.match(/<!-- chapter-nav:start -->([\s\S]*?)<!-- chapter-nav:end -->/);
  if (!m) {
    err(`节 ${s.section} 缺页脚导航`);
    continue;
  }
  footerChecked += 1;
  if (!m[1].includes('[本章目录](_chapter.md)')) err(`节 ${s.section} 页脚缺本章目录链接`);
  const noCode = md.replace(/```[\s\S]*?```/g, '');
  if (noCode.match(/^# /gm)?.length !== 1) err(`节 ${s.section} H1 数量不为 1`);
  else if (!noCode.startsWith(`# ${s.section} `)) err(`节 ${s.section} H1 不以「# ${s.section} 」开头`);
  const i = idx.get(s.section);
  const prev = order[i - 1];
  const next = order[i + 1];
  if (prev && prev.status === '已写' && !m[1].includes(linkOf(s, prev))) err(`节 ${s.section} 页脚上一节链接错误`);
  if (next && next.status === '已写' && !m[1].includes(linkOf(s, next))) err(`节 ${s.section} 页脚下一节链接错误`);
}

// ---------- 旧结构残留 ----------
const leftovers = readdirSync(root).filter((n) => /^part-\d{2}$/.test(n));
if (leftovers.length) err(`仍存在旧 part-* 目录：${leftovers.join(', ')}`);

// ---------- 结果 ----------
if (errors.length) {
  console.error(`❌ check-structure: ${errors.length} 个问题`);
  for (const e of errors.slice(0, 40)) console.error(` - ${e}`);
  process.exit(1);
}
const written = sections.filter((s) => s.status === '已写').length;
console.log(
  `✅ check-structure: 0 错误 —— ${EXPECT_PARTS} 部 / ${chapters.length} 章 / ${sections.length} 节 / 已写 ${written} / 待写 ${sections.length - written}（页脚校验 ${footerChecked}）`,
);
