#!/usr/bin/env node
// 生成章节 QA 报告（markdown 表格）到 stdout；用法：node _meta/qa-report.mjs [start] [end]
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const [startArg, endArg] = process.argv.slice(2);
const start = Number(startArg ?? 1);
const end = Number(endArg ?? 268);

const rows = readFileSync(join(root, '_meta/chapters.tsv'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .slice(1)
  .map((line) => line.split('\t'));

const FORBIDDEN = [
  /^##\s*本章目标/m,
  /^##\s*前置知识/m,
  /^##\s*练习/m,
  /^##\s*延伸阅读/m,
  /^##\s*小结/m,
  /学完你将|你将会学到|在本章中|本章将(带|会)|读者将/,
];

const stripCode = (md) => md.replace(/```[\s\S]*?```/g, '');
const han = (text) => (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
const countFigures = (md) =>
  (md.match(/```mermaid/gi) ?? []).length +
  (md.match(/assets\/[^\s)]+\.png/g) ?? []).length +
  (md.match(/<!--\s*配图建议/g) ?? []).length;
const textbookHits = (md) => FORBIDDEN.filter((p) => p.test(md)).length;

const out = [];
const fail = [];
let total = 0;
let writtenCount = 0;
const agg = { han: 0, code: 0, figs: 0 };

out.push('| 章 | 文件 | 状态 | 汉字 | 代码块 | 配图 | 教材腔 | 判定 |');
out.push('| ---: | --- | :---: | ---: | ---: | ---: | :---: | :---: |');

for (const [num, part, , file, , , , status] of rows) {
  const n = Number(num);
  if (n < start || n > end) continue;
  total += 1;
  const path = join(root, part, file);
  if (status !== '已写' || !existsSync(path)) {
    out.push(`| ${num} | ${file} | ⬜ 待写 | - | - | - | - | - |`);
    continue;
  }
  writtenCount += 1;
  const md = readFileSync(path, 'utf8');
  const h = han(stripCode(md));
  const code = (md.match(/```/g) ?? []).length / 2;
  const figs = countFigures(md);
  const tb = textbookHits(md);
  const problems = [];
  if (h < 800) problems.push('信息量');
  if (tb > 0) problems.push('教材腔');
  if (problems.length) fail.push(`${num}: ${problems.join(' ')}`);
  agg.han += h;
  agg.code += code;
  agg.figs += figs;
  out.push(
    `| ${num} | ${file} | ✅ 已写 | ${h} | ${code} | ${figs} | ${tb} | ${problems.length ? `⚠️ ${problems.join(' ')}` : '✅'} |`,
  );
}

out.push('');
if (writtenCount > 0) {
  out.push(
    `合计：${total} 章（${start}–${end}），其中已写 ${writtenCount} 章；平均汉字 ${Math.round(agg.han / writtenCount)}、平均代码块 ${(agg.code / writtenCount).toFixed(1)}、配图 ${agg.figs}；未达标 ${fail.length} 章。`,
  );
} else {
  out.push(`合计：${total} 章（${start}–${end}），本区间暂无已写章节。`);
}
if (fail.length) out.push(`未达标清单：${fail.join('；')}`);
console.log(out.join('\n'));
