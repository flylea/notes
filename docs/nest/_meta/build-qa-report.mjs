#!/usr/bin/env node
// 汇总生成样例章节 QA 报告：validate-chapters + qa-report + check-originality
// 用法：node _meta/build-qa-report.mjs [start] [end] [--out path]
// 默认 1 20 -> _meta/QA-REPORT-1-20.md
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const rangeArgs = argv.filter((a) => /^\d+$/.test(a));
const start = Number(rangeArgs[0] ?? 1);
const end = Number(rangeArgs[1] ?? 20);
const outPath = resolve(root, outIdx >= 0 ? argv[outIdx + 1] : `_meta/QA-REPORT-${start}-${end}.md`);

const run = (script, args) => {
  try {
    return execFileSync(process.execPath, [join(here, script), ...args], {
      cwd: root,
      encoding: 'utf8',
    }).trimEnd();
  } catch (error) {
    return [error.stdout, error.stderr].filter(Boolean).join('\n').trimEnd();
  }
};

const validateOut = run('validate-chapters.mjs', [String(start), String(end)]);
const qaOut = run('qa-report.mjs', [String(start), String(end)]);
const originalityOut = run('check-originality.mjs', [String(start), String(end)]);

const today = new Intl.DateTimeFormat('zh-CN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Shanghai',
}).format(new Date());

const lines = [
  `# 第 ${start}–${end} 章样例 QA 报告`,
  '',
  `生成时间：${today}（Asia/Shanghai）  ·  生成命令：\`node _meta/build-qa-report.mjs ${start} ${end}\``,
  '',
  '## 1. 门禁结果',
  '',
  '`validate-chapters.mjs`（结构 / 字数 / 配图 / 教材腔黑名单）：',
  '',
  '```text',
  validateOut,
  '```',
  '',
  '## 2. 逐章指标',
  '',
  qaOut,
  '',
  '说明：',
  '',
  '- **汉字**：去掉代码块后的正文汉字数，篇幅由内容决定，不凑字。',
  '- **配图**：Mermaid + assets PNG + 配图建议注释的数量；架构 / 流程类章节必须有图，其余按需。',
  '- **测试词**：Vitest / Jest / supertest / e2e 等命中数，本期要求 0。',
  '- **教材腔**：`本章目标 / 前置知识 / 练习 / 延伸阅读 / 小结` 等小节或「学完你将」句式命中数，要求 0。',
  '',
  '## 3. 原创度（对比掘金小册）',
  '',
  '```text',
  originalityOut,
  '```',
  '',
  '判定标准：20 字 shingle 重合率 ≥15% 高风险（exit 1），≥8% 警告；交付样例要求均为 0。',
  '',
  '## 4. 本轮风格说明',
  '',
  '- 已按反馈去掉教材式小节（本章目标 / 前置知识 / 练习 / 延伸阅读 / 小结），改为真实场景或故障开场，直接讲清原理与做法。',
  '- 语气为第二人称「你」的同事当面讲解；每章：场景 → 为什么 → 代码与解释 → 命令验证（含预期输出）→ 坑与边界 → 收尾过渡 → 文末官方文档链接。',
  `- 黄金样章：\`part-01/017-Nest的Middleware.md\`，可先读它判断语气是否符合预期。`,
  '',
  '## 5. 下一步',
  '',
  `1. 你抽查第 ${start}–${end} 章的文风与深度，指出需要调整的点（更长/更短、更多代码、更口语/更严谨等）。`,
  '2. 确认后按大纲顺序继续放量（先补齐 34、42–44、49–53 等缺口，再按 Part 顺序推进），每批交付前都会跑同一套门禁。',
  '3. example 项目（PostgreSQL 17 + Prisma 8）会随项目章节同步维护，保证教程代码可运行。',
  '',
];

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`written: ${outPath}`);
