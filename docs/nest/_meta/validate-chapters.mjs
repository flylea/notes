#!/usr/bin/env node
/**
 * 章节质量门禁：默认校验所有「已写」章节（去教材腔 / 信息量下限 / 配图按需）。
 *
 * 用法：
 *   node _meta/validate-chapters.mjs            # 校验全部已写章节
 *   node _meta/validate-chapters.mjs 206 211    # 校验指定区间
 *   node _meta/validate-chapters.mjs --all      # 要求全部 268 章已写（Phase 2 后使用）
 *   node _meta/validate-chapters.mjs --json
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsvPath = path.join(root, '_meta', 'chapters.tsv');

// 信息量下限（不是字数配额）：低于此值大概率没讲清问题。
const MIN_HAN = 800;

// 图按需：这些领域涉及结构/流程/关系，必须有图；其他章节有图更好，不强制。
const FIGURE_REQUIRED_DOMAINS = ['架构', '原理', '流程', '协议', '时序', '关系', '部署', '生命周期', '数据流', '可靠性', '可观测'];

// 教材腔：一旦命中即不达标（正文要像同事当面讲，不是课程讲义）。
const FORBIDDEN = [
  { label: '本章目标', pattern: /^##\s*本章目标/m },
  { label: '前置知识', pattern: /^##\s*前置知识/m },
  { label: '练习小节', pattern: /^##\s*练习/m },
  { label: '延伸阅读', pattern: /^##\s*延伸阅读/m },
  { label: '小结小节', pattern: /^##\s*小结/m },
  { label: '本章小结', pattern: /^##\s*本章小结/m },
  { label: '教材句式', pattern: /学完你将|你将会学到|在本章中|本章将(带|会)|读者将|本教程(会|将)带/ },
  { label: '配图解读段', pattern: /这张图在(?:说什么|讲什么|说明什么)/ },
];

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const allMode = args.includes('--all');
const rangeArgs = args.filter((arg) => /^\d+$/.test(arg)).map(Number);

const stripCode = (md) => md.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
const countHan = (md) => (stripCode(md).match(/[\u4e00-\u9fff]/g) ?? []).length;
const hasFigure = (md) =>
  /```mermaid/i.test(md) ||
  /!\[[^\]]*\]\(<[^>]*assets\/[^>]*>\)/.test(md) ||
  /<!--\s*配图建议/.test(md);
const figureRequired = (domains) => FIGURE_REQUIRED_DOMAINS.some((d) => domains.includes(d));

const rows = (await readFile(tsvPath, 'utf8'))
  .split('\n')
  .filter((line) => line.trim().length > 0)
  .slice(1)
  .map((line) => {
    const [chapter, part, partTitle, file, slug, domains, project, status] = line.split('\t');
    return { num: Number(chapter), part, partTitle, file, slug, domains, project, status };
  });

const selected = rangeArgs.length
  ? rows.filter((row) => row.num >= Math.min(...rangeArgs) && row.num <= Math.max(...rangeArgs))
  : rows;

const report = {
  total: selected.length,
  written: 0,
  pending: [],
  missing: [],
  textbook: [],
  short: [],
  noFigure: [],
  ok: 0,
  chapters: [],
};

for (const row of selected) {
  const filePath = path.join(root, row.part, row.file);
  const exists = existsSync(filePath);
  if (row.status !== '已写' || !exists) {
    if (row.status === '已写' && !exists) report.missing.push({ num: row.num, file: `${row.part}/${row.file}` });
    else report.pending.push({ num: row.num });
    if (allMode) report.missing.push({ num: row.num, file: `${row.part}/${row.file}` });
    continue;
  }
  report.written += 1;
  const md = await readFile(filePath, 'utf8');
  const textbookHits = FORBIDDEN.filter((item) => item.pattern.test(md)).map((item) => item.label);
  const han = countHan(md);
  const codeBlocks = (md.match(/```/g) ?? []).length / 2;
  const needFigure = figureRequired(row.domains);
  const figure = hasFigure(md);
  const ok = textbookHits.length === 0 && han >= MIN_HAN && (!needFigure || figure);
  const entry = { num: row.num, han, codeBlocks, textbookHits, hasFigure: figure, needFigure, ok };
  report.chapters.push(entry);
  if (!ok) {
    if (textbookHits.length > 0) report.textbook.push({ num: row.num, hits: textbookHits });
    if (han < MIN_HAN) report.short.push({ num: row.num, han });
    if (needFigure && !figure) report.noFigure.push({ num: row.num });
  } else {
    report.ok += 1;
  }
}

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`校验章节: ${report.total}（已写 ${report.written}，待写 ${report.pending.length}）`);
  console.log(`达标: ${report.ok}`);
  if (report.missing.length) console.log(`状态为已写但文件缺失: ${report.missing.length}（${report.missing.map((m) => m.num).join(', ')}）`);
  console.log(`教材腔命中: ${report.textbook.length}`);
  if (report.textbook.length) {
    console.log(report.textbook.map((m) => `  #${m.num}: ${m.hits.join('/')}`).join('\n'));
  }
  console.log(`信息量不足 ${MIN_HAN} 汉字: ${report.short.length}`);
  if (report.short.length) console.log(`  ${report.short.map((s) => `#${s.num}(${s.han}字)`).join(', ')}`);
  console.log(`按需缺图: ${report.noFigure.length}`);
  if (report.noFigure.length) console.log(`  ${report.noFigure.map((n) => `#${n.num}`).join(', ')}`);
  const done = report.chapters.filter((c) => c.ok);
  if (done.length) {
    const avg = Math.round(done.reduce((sum, c) => sum + c.han, 0) / done.length);
    const avgCode = (done.reduce((sum, c) => sum + c.codeBlocks, 0) / done.length).toFixed(1);
    const avgFig = (done.reduce((sum, c) => sum + (c.hasFigure ? 1 : 0), 0) / done.length).toFixed(2);
    console.log(`达标章节平均汉字: ${avg}，平均代码块: ${avgCode}，有图比例: ${avgFig}`);
  }
}

process.exitCode =
  report.missing.length > 0 || report.textbook.length > 0 || report.short.length > 0 || report.noFigure.length > 0
    ? 1
    : 0;
