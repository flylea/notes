#!/usr/bin/env node
// 结构一致性门禁：chapters.tsv / parts.tsv / README / _part.md / 章节页脚。
// 用法：node _meta/check-structure.mjs
import { existsSync, readFileSync } from 'node:fs';
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
  if (lines.length === 0) {
    err(`_meta/${name} 为空`);
    return [];
  }
  const rows = lines.map((line) => line.split('\t'));
  const header = rows[0];
  if (header.length !== expectedCols) err(`_meta/${name} 表头应为 ${expectedCols} 列，实际 ${header.length} 列`);
  for (const [i, row] of rows.slice(1).entries()) {
    if (row.length !== expectedCols) err(`_meta/${name} 第 ${i + 2} 行应为 ${expectedCols} 列，实际 ${row.length} 列`);
  }
  return rows.slice(1);
};

const chapterRows = readTsv('chapters.tsv', 8);
const partRows = readTsv('parts.tsv', 12);

const chapters = chapterRows.map((r) => ({
  num: Number(r[0]), part: r[1], partTitle: r[2], file: r[3], slug: r[4],
  domains: r[5], project: r[6], status: r[7],
}));
const parts = partRows.map((r) => ({
  part: r[0], no: Number(r[1]), section: r[2], sectionNo: Number(r[3]),
  title: r[4], range: r[5], count: Number(r[6]),
}));

// ---------- chapters ----------
if (chapters.length !== 286) err(`chapters.tsv 应为 268 行，实际 ${chapters.length}`);
const nums = chapters.map((c) => c.num);
const expectNums = Array.from({ length: chapters.length }, (_, i) => i + 1);
if (nums.some((n, i) => n !== expectNums[i])) err('章号不是从 1 开始的连续序号');
if (new Set(nums).size !== nums.length) err('章号有重复');
if (new Set(chapters.map((c) => c.slug)).size !== chapters.length) err('slug 有重复');

const partMap = new Map(parts.map((p) => [p.part, p]));
const byPart = new Map(parts.map((p) => [p.part, []]));

for (const c of chapters) {
  const p = partMap.get(c.part);
  if (!p) {
    err(`第 ${c.num} 章的 part 不存在：${c.part}`);
    continue;
  }
  byPart.get(c.part).push(c);
  if (c.partTitle !== p.title) err(`第 ${c.num} 章 part_title 与 parts.tsv 不一致`);
  if (!/^\d{3}-.+\.md$/.test(c.file)) err(`第 ${c.num} 章文件名不符合 NNN-*.md：${c.file}`);
  if (Number(c.file.slice(0, 3)) !== c.num) err(`第 ${c.num} 章文件名前缀与章号不一致：${c.file}`);
  if (c.slug !== `ch-${String(c.num).padStart(3, '0')}`) err(`第 ${c.num} 章 slug 格式错误：${c.slug}`);
  if (!['已写', '待写'].includes(c.status)) err(`第 ${c.num} 章 status 非法：${c.status}`);
  const exists = existsSync(join(root, c.part, c.file));
  if ((c.status === '已写') !== exists) err(`第 ${c.num} 章 status=${c.status} 但文件${exists ? '存在' : '不存在'}`);
}

// ---------- parts ----------
if (parts.length !== 31) err(`parts.tsv 应为 30 行，实际 ${parts.length}`);
parts.forEach((p, i) => {
  if (p.no !== i) err(`Part 序号不连续：${p.part} no=${p.no}，期望 ${i}`);
  if (!/^part-\d{2}$/.test(p.part)) err(`Part 目录名非法：${p.part}`);
  if (p.part !== `part-${String(p.no).padStart(2, '0')}`) err(`Part 目录名与 no 不一致：${p.part}`);
  if (!/^\d+-\d+$/.test(p.range)) err(`Part 区间格式错误：${p.part} ${p.range}`);
  const [start, end] = p.range.split('-').map(Number);
  if (end - start + 1 !== p.count) err(`Part ${p.part} count=${p.count} 与区间 ${p.range} 不符`);
  const list = byPart.get(p.part) ?? [];
  if (list.length !== p.count) err(`Part ${p.part} 实际章节数 ${list.length} ≠ count ${p.count}`);
  const first = list[0]?.num;
  const last = list[list.length - 1]?.num;
  if (first !== start || last !== end) err(`Part ${p.part} 章节范围 ${first}-${last} 与 tsv 区间 ${p.range} 不符`);
});

// 章号覆盖：所有 Part 区间并集 = 1..268 且不重叠
{
  const seen = new Map();
  for (const p of parts) {
    const [start, end] = p.range.split('-').map(Number);
    for (let n = start; n <= end; n += 1) {
      if (seen.has(n)) err(`章号 ${n} 同时属于 ${seen.get(n)} 与 ${p.part}`);
      seen.set(n, p.part);
    }
  }
  if (seen.size !== 286) err(`Part 区间覆盖 ${seen.size} 章，应为 268`);
}

// ---------- Part hub ----------
for (const p of parts) {
  const hub = join(root, p.part, '_part.md');
  if (!existsSync(hub)) {
    err(`缺 Part hub：${p.part}/_part.md`);
    continue;
  }
  const md = readFileSync(hub, 'utf8');
  const expected = `# Part ${String(p.no).padStart(2, '0')} · ${p.title}`;
  if (!md.includes(expected)) err(`${p.part}/_part.md 标题不符：期望「${expected}」`);
}

// ---------- README ----------
const readmePath = join(root, 'README.md');
if (!existsSync(readmePath)) {
  err('缺 README.md');
} else {
  const readme = readFileSync(readmePath, 'utf8');
  if (!readme.includes('完整目录（286 章）')) err('README 缺「完整目录（286 章）」');
  const missingSections = parts
    .reduce((acc, p) => (acc.includes(p.sectionNo) ? acc : [...acc, p.sectionNo]), [])
    .filter((no) => !readme.includes(`## 第 ${no} 篇`));
  if (missingSections.length) err(`README 缺篇标题：${missingSections.join(', ')}`);
  for (const p of parts) {
    const heading = `### Part ${String(p.no).padStart(2, '0')} · ${p.title}`;
    if (!readme.includes(heading)) err(`README 缺 Part 标题：${heading}`);
  }
  for (const c of chapters) {
    const base = c.file.replace(/^\d{3}-/, '').replace(/\.md$/, '');
    const num = String(c.num).padStart(3, '0');
    if (c.status === '已写') {
      if (!readme.includes(`](${c.part}/${c.file})`)) err(`README 缺第 ${c.num} 章链接：${c.part}/${c.file}`);
    } else if (!readme.includes(`${num} ${base}（待写）`)) {
      err(`README 缺待写章节条目：${num} ${base}`);
    }
  }
}

// ---------- 章节页脚 ----------
const sorted = [...chapters].sort((a, b) => a.num - b.num);
const writtenMap = new Map(chapters.map((c) => [c.num, c]));
const isWritten = (c) => c && c.status === '已写';
const titleOf = (c) => c.file.replace(/^\d{3}-/, '').replace(/\.md$/, '');

for (const c of chapters) {
  if (c.status !== '已写') continue;
  const path = join(root, c.part, c.file);
  const md = readFileSync(path, 'utf8');
  const m = md.match(/<!-- chapter-nav:start -->([\s\S]*?)<!-- chapter-nav:end -->/);
  if (!m) {
    err(`第 ${c.num} 章缺页脚导航`);
    continue;
  }
  const block = m[1];
  if (!block.includes('[本 Part 目录](_part.md)')) err(`第 ${c.num} 章页脚缺 Part 目录链接`);

  const i = sorted.findIndex((x) => x.num === c.num);
  const prev = sorted[i - 1];
  const next = sorted[i + 1];
  const expectLink = (target) => {
    const rel = c.part === target.part ? target.file : `../${target.part}/${target.file}`;
    return `${String(target.num).padStart(3, '0')} ${titleOf(target)}](${rel})`;
  };
  if (isWritten(prev) && !block.includes(expectLink(prev))) err(`第 ${c.num} 章页脚上一篇链接错误`);
  if (isWritten(next) && !block.includes(expectLink(next))) err(`第 ${c.num} 章页脚下一篇链接错误`);
}

// ---------- 结果 ----------
if (errors.length) {
  console.error(`❌ check-structure: ${errors.length} 个问题`);
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
const written = chapters.filter((c) => c.status === '已写').length;
console.log(`✅ check-structure: 0 错误 —— ${chapters.length} 章 / ${parts.length} Part / 已写 ${written} / 待写 ${chapters.length - written}`);
