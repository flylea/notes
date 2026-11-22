#!/usr/bin/env node
/**
 * 把 287 节 / 31 个 part 目录重排为 4 部 / 21 章 / 章.节 结构（book/ch-NN-…/NN.MM-….md）。
 * 用法：
 *   node _meta/restructure.mjs --dry-run   只打印计划与校验
 *   node _meta/restructure.mjs             真正执行（mv + 改写 H1 + 写元数据）
 */
import { readFile, writeFile, mkdir, rename, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const META = path.join(ROOT, '_meta');
const DRY = process.argv.includes('--dry-run');

const PART_TITLES = {
  1: '基础：语言、框架与运行环境',
  2: '数据与工程：数据库、缓存、认证与工程化',
  3: '项目实战：从需求到上线',
  4: '进阶：分布式、可观测与工程深度',
};

/** 每一章：part、标题、目标、产出、分组（groups 按顺序即节顺序；old 为旧节号数组） */
const SPEC = [
  {
    part: 1, title: '导学、CLI 与调试',
    goal: '把环境跑起来，知道 Nest 12 的脚手架、调试与工程约定长什么样。',
    outcome: '能用 pnpm + Nest CLI 建一个 ESM 项目并在断点里走通一次请求。',
    groups: [[1], [2], [3], [4], [5], [6]],
  },
  {
    part: 1, title: 'Nest 核心：模块、依赖注入与生命周期',
    goal: '建立 IoC 容器的心智模型，能解释一个请求从 main.ts 到 controller 之间发生了什么。',
    outcome: '能自己写 Provider、动态模块，并能排查循环依赖与生命周期顺序问题。',
    groups: [[7], [8], [9], [10], [11], [12], [13], [14], [15], [22]],
  },
  {
    part: 1, title: '请求链路：AOP、管道与过滤器',
    goal: '掌握 Nest 的横切能力：Middleware / Guard / Interceptor / Pipe / Filter 各自该放在哪。',
    outcome: '能写出带校验、统一响应、异常兜底的一条完整请求链路。',
    groups: [[16], [17], [18], [19], [20], [21]],
  },
  {
    part: 1, title: '文件、日志与运行时诊断',
    goal: '把文件上传与日志这两件“线上必用”的事做对，并知道出问题时去哪儿看。',
    outcome: '能实现分片上传，能把日志结构化输出并接入 Winston。',
    groups: [[23], [24], [25], [26], [27], [28]],
  },
  {
    part: 1, title: '容器化与进程管理',
    goal: '从 docker run 走到 compose，理解容器网络与重启策略。',
    outcome: '能为一套 Nest + PG + Redis 写出可复用的 compose，并说清为什么不再需要 PM2。',
    groups: [[29], [30], [31], [32], [33], [34]],
  },
  {
    part: 2, title: 'PostgreSQL 与 SQL',
    goal: '从 SQL 语法走到事务、隔离级别与执行计划。',
    outcome: '能独立设计表、写 JOIN / 子查询 / 窗口函数，并读懂 EXPLAIN。',
    groups: [[35], [36], [37], [38], [39], [40], [41], [42], [43], [198], [199]],
  },
  {
    part: 2, title: 'Prisma 8 与 ORM 选型',
    goal: '用 Prisma 8 的 contract 模型完成映射、迁移与集成，并能与 TypeORM/Drizzle 对比选型。',
    outcome: '能在 Nest 里用 Prisma 8 完成 CRUD、事务与迁移流程，且说得清为什么不用 Prisma 7 写法。',
    groups: [[44], [45], [46], [47], [48], [49], [50], [115], [116], [117], [118], [119], [120], [252], [253], [254], [255], [279]],
  },
  {
    part: 2, title: 'Redis、缓存与消息',
    goal: '把 Redis 用到生产级：数据结构、缓存模式、分布式锁与消息队列。',
    outcome: '能在 Nest 里封装 Redis 客户端、做缓存与限流，并能用 BullMQ 处理异步任务。',
    groups: [[51], [52], [53], [121], [122], [123], [124], [125], [126], [127], [128], [129], [130], [146], [147], [148]],
  },
  {
    part: 2, title: '认证、授权与安全',
    goal: '从 Session/JWT 走到 ACL/RBAC，再补齐 OAuth2、CSRF、加密与常见漏洞。',
    outcome: '能为一个多角色系统设计认证与权限模型，并写出可复现的越权测试。',
    groups: [[54], [55], [56], [57], [58], [59], [131], [132], [200], [201], [202], [238], [239], [240], [241], [242], [243], [244]],
  },
  {
    part: 2, title: '配置、Compose 与 Nginx',
    goal: '把“本地能跑”变成“换台机器也能跑”：配置分层、Compose 编排、反代与网关。',
    outcome: '能用 compose 起整套服务，用 Nginx 做反代与静态资源，并完成一次可回滚的发布。',
    groups: [[60], [61], [62], [63], [64], [65], [66], [67], [68], [69], [70]],
  },
  {
    part: 2, title: '工程化设施',
    goal: '把仓库、CI、API 文档、代码质量与容器镜像这些“团队基础设施”搭起来。',
    outcome: '能配置私有镜像仓库、CI 流水线、Scalar/Swagger 文档与提交门禁。',
    groups: [[71], [72], [73], [74], [75], [76], [77], [78], [79], [80], [81], [82], [83], [84]],
  },
  {
    part: 3, title: '项目一：会议室预订系统',
    goal: '把前两部的知识串成一个能上线的小系统：需求 → 设计 → 模块 → 部署。',
    outcome: '交付一个带鉴权、权限、预订冲突检测与部署脚本的完整项目。',
    groups: [
      { old: [85], title: '需求分析与原型' },
      { old: [86], title: '技术方案与数据库设计' },
      { old: [87], title: '项目骨架与工程约定' },
      { old: [88, 89, 90, 91, 92, 93, 94, 95], title: '用户管理模块' },
      { old: [96, 97, 98], title: '会议室管理模块' },
      { old: [99, 100, 101], title: '预订管理模块' },
      { old: [102, 103], title: '统计管理模块' },
      { old: [104], title: '部署、验收与复盘' },
    ],
  },
  {
    part: 3, title: '项目二/三：电商与大众点评',
    goal: '用两个不同形态的项目练“拆服务”和“快速交付”。',
    outcome: '能独立完成电商订单域与本地生活点评域的核心链路。',
    groups: [
      { old: [138], title: '电商：需求分析与核心域' },
      { old: [139], title: '电商：数据库设计' },
      { old: [140, 141], title: '电商：微服务拆分与技术集成' },
      { old: [142, 143], title: '电商：功能开发' },
      { old: [144], title: '电商：前端与管理后台' },
      { old: [145], title: '电商：部署与验收' },
      { old: [149], title: '点评：需求分析与原型' },
      { old: [150], title: '点评：技术方案与数据设计' },
      { old: [151], title: '点评：后端开发' },
      { old: [152, 153], title: '点评：前端与验收' },
    ],
  },
  {
    part: 3, title: '项目四/五：聊天室、教育平台与博客',
    goal: '练实时通信、GraphQL 与内容型系统的完整交付。',
    outcome: '能交付 WebSocket 聊天室、GraphQL 教育平台与带检索的博客。',
    groups: [
      { old: [161], title: '聊天室：需求分析与原型' },
      { old: [162], title: '聊天室：数据库设计' },
      { old: [163], title: '聊天室：微服务拆分' },
      { old: [164, 165], title: '聊天室：功能开发' },
      { old: [166, 167], title: '聊天室：前端与验收' },
      { old: [172, 173], title: '教育：需求分析与数据设计' },
      { old: [174, 175], title: '教育：微服务拆分与 GraphQL 层' },
      { old: [176, 177], title: '教育：功能开发与上线' },
      { old: [184, 185], title: '博客：需求分析与数据设计' },
      { old: [186, 187], title: '博客：内容与检索集成' },
      { old: [188], title: '博客：功能开发' },
      { old: [189, 190], title: '博客：前端与验收' },
      { old: [191], title: '博客：重构与复盘' },
    ],
  },
  {
    part: 4, title: '微服务与分布式架构',
    goal: '从单体现在能讲到微服务：传输层、注册发现、网关、分布式事务。',
    outcome: '能解释并实现 gRPC/消息驱动的服务拆分，以及一次跨服务事务的补偿。',
    groups: [[105], [106], [107], [108], [109], [110], [111], [112], [113], [114], [133], [134], [135], [136], [137], [259], [260], [261], [262], [263], [264]],
  },
  {
    part: 4, title: '实时通信、GraphQL 与全文检索',
    goal: '补齐三种“非 REST”的接口形态：WebSocket、GraphQL、全文检索。',
    outcome: '能按场景选型并写出最小可用实现。',
    groups: [[154], [155], [156], [157], [158], [159], [160], [168], [169], [170], [171], [178], [179], [180], [181], [182], [183]],
  },
  {
    part: 4, title: '可靠性工程',
    goal: '把“偶发故障”当成设计对象：幂等、锁、outbox、重试、健康检查、工作流。',
    outcome: '能为关键写路径设计幂等与补偿，并接上健康检查与告警。',
    groups: [[213], [214], [215], [216], [217], [218], [219], [220]],
  },
  {
    part: 4, title: '可观测性',
    goal: '会用日志、指标、追踪三件套定位线上问题。',
    outcome: '能接入 OpenTelemetry/Prometheus 并在一次故障演练里用 traceId 定位根因。',
    groups: [[221], [222], [223], [224], [225], [226], [227]],
  },
  {
    part: 4, title: 'HTTP、任务、事件与全栈交付',
    goal: '补齐 HTTP 协议细节、定时任务与事件驱动，并走通前后端交付。',
    outcome: '能设计缓存/压缩/SSE，能用 cron 与事件解耦，并能交付 Next.js 前端。',
    groups: [[228], [229], [230], [231], [232], [233], [234], [235], [236], [237], [245], [246], [247], [248], [249], [250], [251]],
  },
  {
    part: 4, title: '框架原理与 AI 工程',
    goal: '读 Nest 源码理解容器与路由，并把 AI/MCP 能力接进服务。',
    outcome: '能讲清一次请求的框架内部路径，能写一个 MCP server 与 AI 功能。',
    groups: [[192], [193], [194], [195], [196], [197], [203], [204], [205], [206], [207], [208], [209], [210], [211], [212]],
  },
  {
    part: 4, title: '求职冲刺与实战补遗',
    goal: '把前面所有内容压缩成面试表达与若干“补齐型”实战。',
    outcome: '能用自己的项目讲清架构取舍，并补齐大规模数据、性能与常见坑。',
    groups: [[256], [257], [258], [265], [266], [267], [268], [269], [270], [271], [272], [273], [274], [275], [276], [277], [278], [280], [281], [282], [283], [284], [285], [286], [287]],
  },
];

const DIRS = ["导学与CLI", "核心概念", "请求链路", "文件与日志", "容器化", "PostgreSQL与SQL", "Prisma8与选型", "Redis与缓存", "认证与安全", "配置与部署", "工程化", "项目一会议室", "项目二三", "项目四五", "微服务", "实时通信与GraphQL", "可靠性工程", "可观测性", "HTTP与全栈交付", "原理与AI", "求职与补遗"];

const clean = (s) => String(s)
  .replace(/[\\/:*?"<>|]/g, '·')
  .replace(/\s+/g, '')
  .trim();

const pad = (n) => String(n).padStart(2, '0');

async function main() {
  const tsv = await readFile(path.join(META, 'chapters.tsv'), 'utf8');
  const lines = tsv.trim().split('\n');
  const head = lines[0].split('\t');
  const rows = lines.slice(1).map((l) => {
    const c = l.split('\t');
    const o = {};
    head.forEach((h, i) => { o[h] = c[i]; });
    return o;
  });
  const oldByNum = new Map(rows.map((r) => [Number(r.chapter), r]));

  // 1) 展开章节 → 节
  const chapters = [];
  const assigned = new Map(); // old num -> { ch, sec }
  SPEC.forEach((chSpec, ci) => {
    const ch = ci + 1;
    const sections = [];
    chSpec.groups.forEach((g) => {
      const olds = Array.isArray(g) ? g : g.old;
      const titleOverride = Array.isArray(g) ? null : g.title;
      olds.forEach((n) => {
        if (assigned.has(n)) throw new Error(`旧节 ${n} 被重复分配：${assigned.get(n).ch} 与 ${ch}`);
        assigned.set(n, { ch, sec: sections.length + 1 });
      });
      const first = oldByNum.get(olds[0]);
      if (!first) throw new Error(`旧节 ${olds[0]} 不在 chapters.tsv`);
      const title = titleOverride ?? stripNum(first.file.replace(/\.md$/, ''));
      sections.push({ ch, sec: sections.length + 1, olds, title });
    });
    chapters.push({ ch, ...chSpec, sections });
  });

  // 2) 覆盖率断言
  const missing = [];
  for (let n = 1; n <= 287; n++) if (!assigned.has(n)) missing.push(n);
  if (missing.length) throw new Error(`未分配旧节：${missing.join(',')}`);
  if (assigned.size !== 287) throw new Error(`分配数 ${assigned.size} != 287`);

  // 3) 生成路径与状态
  const newRows = [];
  const moves = [];
  const mapping = [['old_num', 'old_title', 'new_section', 'new_title', 'action', 'old_file', 'new_file']];
  for (const ch of chapters) {
    const chDir = `ch-${pad(ch.ch)}-${DIRS[ch.ch - 1]}`;
    for (const s of ch.sections) {
      const sec = `${pad(ch.ch)}.${pad(s.sec)}`;
      const srcs = s.olds.map((n) => oldByNum.get(n));
      const written = srcs.filter((r) => existsSync(path.join(ROOT, r.part, r.file)));
      const status = written.length ? '已写' : '待写';
      const fileName = `${sec}-${clean(s.title)}.md`;
      const rel = `book/${chDir}/${fileName}`;
      newRows.push({
        section: sec,
        chapter: pad(ch.ch),
        chapter_title: ch.title,
        part: `part-${pad(ch.part)}`,
        file: rel,
        title: s.title,
        slug: `ch-${pad(ch.ch)}-${pad(s.sec)}`,
        domains: srcs.map((r) => r.domains).filter((d) => d && d !== '-').join(',') || '-',
        project: srcs.map((r) => r.project).filter((p) => p && p !== '-').join(',') || '-',
        status,
      });
      srcs.forEach((r, i) => {
        mapping.push([
          String(r.chapter), stripNum(r.file.replace(/\.md$/, '')), sec,
          i === 0 && srcs.length > 1 ? s.title : (i === 0 ? s.title : `${s.title}（合并）`),
          srcs.length > 1 ? 'merge' : 'move',
          `${r.part}/${r.file}`, rel,
        ]);
      });
      if (written.length === 1 && srcs.length === 1) {
        moves.push({ from: path.join(ROOT, srcs[0].part, srcs[0].file), to: path.join(ROOT, rel), h1: `# ${sec} ${s.title}`, title: s.title, sec });
      }
    }
  }

  // 4) 输出
  const outline = [['part_no', 'part_title', 'chapter', 'chapter_title', 'sections', 'written', 'source', 'goal', 'outcome', 'hours']];
  for (const ch of chapters) {
    const ns = newRows.filter((r) => Number(r.chapter) === ch.ch);
    outline.push([
      String(ch.part), PART_TITLES[ch.part], pad(ch.ch), ch.title,
      String(ns.length), String(ns.filter((r) => r.status === '已写').length),
      ch.sections.map((s) => s.olds.length > 1 ? `${s.olds[0]}-${s.olds.at(-1)}` : `${s.olds[0]}`).join('|'),
      ch.goal, ch.outcome, String(Math.round(ns.length * 1.2 * 2) / 2),
    ]);
  }

  const newTsv = [
    ['section', 'chapter', 'chapter_title', 'part', 'file', 'title', 'slug', 'domains', 'project', 'status'],
    ...newRows.map((r) => [r.section, r.chapter, r.chapter_title, r.part, r.file, r.title, r.slug, r.domains, r.project, r.status]),
  ].map((r) => r.join('\t')).join('\n') + '\n';

  const total = newRows.length;
  console.log(`章节：${chapters.length} 章 / ${total} 节（旧 287 节）`);
  console.log(`已写：${newRows.filter((r) => r.status === '已写').length} 节；待写：${newRows.filter((r) => r.status === '待写').length} 节`);
  console.log(`需要移动的文件：${moves.length} 个；合并节：${newRows.filter((r) => r.olds && r.olds.length > 1).length} 个`);
  for (const ch of chapters) {
    const ns = newRows.filter((r) => Number(r.chapter) === ch.ch);
    console.log(`  ch${pad(ch.ch)} ${ch.title} — ${ns.length} 节（已写 ${ns.filter((r) => r.status === '已写').length}）→ book/ch-${pad(ch.ch)}-${clean(ch.title)}/`);
  }

  if (DRY) { console.log('\n[dry-run] 未写任何文件'); return; }

  // 5) 建目录并移动文件
  for (const m of moves) {
    await mkdir(path.dirname(m.to), { recursive: true });
    if (!existsSync(m.from)) throw new Error(`源文件不存在：${m.from}`);
    if (existsSync(m.to)) throw new Error(`目标已存在：${m.to}`);
    await rename(m.from, m.to);
    // 改写 H1
    let text = await readFile(m.to, 'utf8');
    text = text.replace(/^# .*$/m, m.h1);
    await writeFile(m.to, text);
  }

  // 6) 写元数据
  await writeFile(path.join(META, 'BOOK-OUTLINE.tsv'), outline.map((r) => r.join('\t')).join('\n') + '\n');
  await writeFile(path.join(META, 'MAPPING.tsv'), mapping.map((r) => r.join('\t')).join('\n') + '\n');
  await writeFile(path.join(META, 'chapters.tsv'), newTsv);
  console.log('\n已写：_meta/BOOK-OUTLINE.tsv、_meta/MAPPING.tsv、_meta/chapters.tsv；文件已移动并改写 H1。');
}

function stripNum(fileName) {
  return fileName.replace(/^\d{3}-/, '');
}

main().catch((e) => { console.error(e); process.exit(1); });
