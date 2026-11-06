#!/usr/bin/env node
/**
 * 原创度门禁：对比教程章节与掘金小册原文的 20 字 shingle 重合率，防止整段照抄。
 *
 * 用法：
 *   node _meta/check-originality.mjs            # 全量（只检查已存在章节）
 *   node _meta/check-originality.mjs 1 28       # 只检查第 1-28 章
 *   node _meta/check-originality.mjs --json     # JSON 输出
 *
 * 判定：重合率 >= 15% 视为高风险（照抄/改写不足），>= 8% 视为警告。
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(root, '..', '..');
const bookletCandidates = [
  process.env.NUGGETS_BOOKLET_DIR,
  path.join(process.env.HOME ?? '', 'Documents/nest-nuggets-booklet/合并版'),
  path.join(process.env.HOME ?? '', 'Documents/nest-nuggets-booklet/Nest 通关秘籍  最新200章'),
  path.join(process.env.HOME ?? '', 'Documents/nest-nuggets-booklet/掘金小册 Nest 通关秘籍  最新205章'),
  path.join(repoRoot, '.cache/nest-refs/NuggetsBooklet/掘金小册 Nest 通关秘籍  最新205章'),
].filter(Boolean);
const bookletDir = bookletCandidates.find((dir) => existsSync(dir));
if (!bookletDir) {
  console.error('[originality] 找不到小册参考目录，可用 NUGGETS_BOOKLET_DIR 环境变量指定');
  process.exit(2);
}

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const rangeArgs = args.filter((a) => /^\d+$/.test(a)).map(Number);

const N = 20;
const HIGH = 0.15;
const WARN = 0.08;

const clean = (md) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/[#>*_|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const shingles = (text) => {
  const set = new Set();
  for (let i = 0; i + N <= text.length; i += 1) set.add(text.slice(i, i + N));
  return set;
};

const rows = (await readFile(path.join(root, '_meta', 'chapters.tsv'), 'utf8'))
  .split('\n')
  .filter((line) => line.trim().length > 0)
  .map((line) => {
    const [num, part, title, file] = line.split('\t');
    return { num: Number(num), part, title, file };
  });

const selected = rangeArgs.length
  ? rows.filter((r) => r.num >= Math.min(...rangeArgs) && r.num <= Math.max(...rangeArgs))
  : rows;

const bookletFiles = existsSync(bookletDir) ? await readdir(bookletDir, { recursive: true }) : [];
const bookletParts = [];
for (const name of bookletFiles) {
  if (!name.endsWith('.md')) continue;
  const base = path.basename(name);
  const m = base.match(/^第0*(\d+)章/) ?? base.match(/^(\d+)\.\s/);
  if (!m) continue;
  const raw = await readFile(path.join(bookletDir, name), 'utf8');
  const text = clean(raw);
  if (text.length < N) continue;
  bookletParts.push({ num: Number(m[1]), name, shingles: shingles(text) });
}
if (bookletParts.length === 0) {
  console.error('[originality] 小册目录里没找到可用章节:', bookletDir);
  process.exit(2);
}

const report = { checked: 0, skipped: [], high: [], warn: [], chapters: [] };

for (const row of selected) {
  const chapterPath = path.join(root, row.part, row.file);
  if (!existsSync(chapterPath)) {
    report.skipped.push({ num: row.num, reason: 'missing' });
    continue;
  }
  const chapter = clean(await readFile(chapterPath, 'utf8'));
  if (chapter.length < N) {
    report.skipped.push({ num: row.num, reason: 'too-short' });
    continue;
  }
  const cSet = shingles(chapter);
  let best = { ratio: 0, shared: 0, num: null, name: null, samples: [] };
  for (const part of bookletParts) {
    let shared = 0;
    const samples = [];
    for (const sh of cSet) {
      if (part.shingles.has(sh)) {
        shared += 1;
        if (samples.length < 3) samples.push(sh);
      }
    }
    const ratio = cSet.size ? shared / cSet.size : 0;
    if (ratio > best.ratio) best = { ratio, shared, num: part.num, name: part.name, samples };
  }
  const entry = {
    num: row.num,
    ratio: Number(best.ratio.toFixed(4)),
    shared: best.shared,
    chapterShingles: cSet.size,
    bookletNum: best.num,
    bookletFile: best.name,
    samples: best.samples,
  };
  report.chapters.push(entry);
  report.checked += 1;
  if (entry.ratio >= HIGH) report.high.push(entry);
  else if (entry.ratio >= WARN) report.warn.push(entry);
}

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`对比小册章节数: ${report.checked}（跳过 ${report.skipped.length}；小册候选 ${bookletParts.length} 篇）`);
  console.log(`高风险（重合率>=${HIGH * 100}%）: ${report.high.length}`);
  for (const e of report.high) {
    console.log(`  #${e.num} 重合率 ${(e.ratio * 100).toFixed(1)}%  最相近: ${e.bookletFile}  示例: ${e.samples[0] ?? ''}`);
  }
  console.log(`警告（重合率>=${WARN * 100}%）: ${report.warn.length}`);
  for (const e of report.warn) {
    console.log(`  #${e.num} 重合率 ${(e.ratio * 100).toFixed(1)}%  最相近: ${e.bookletFile}`);
  }
}

process.exitCode = report.high.length > 0 ? 1 : 0;
