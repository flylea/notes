# 第 53 章 Git 工作流与代码评审

这一章讲团队协作工具的开发流程：分支怎么切、PR 怎么写、提交前跑什么、评审看哪几处、迁移为什么单独审、合并与回滚怎么做。

流程要解决三个具体问题：改动没人看、看了看不出问题、看出来了但已经合了。分支保护与 PR 模板解决第一个，评审清单与 CODEOWNERS 解决第二个，CI 与回滚解决第三个。流程的目标是让“改坏了”在合并前被发现：没有流程的团队靠人盯，人一忙就漏；流程把这些检查固定在工具里，不依赖记性。

涉及四样东西：仓库分支保护规则、PR 模板与 CODEOWNERS、提交前钩子、CI 检查工作流。四样都配好，一个改动从分支到主干要过四道闸。

这一章不讨论 Git 命令的细节，也不讨论代码风格。它讨论的是“什么必须被检查”，以及这些检查放在哪一步最省力。

## 53.1 分支模型

分支模型解决的是“多人同时改”的冲突。两种常见的坏模型：所有人推同一个分支，历史混乱无法回滚；功能分支活一个月，合并时冲突几十处。

最适合小团队的是主干加短分支。每个人从 `main` 切出，改动在一两天内合回；`main` 永远可发布，发布就是打标签。

主干叫 `main`，始终保持可发布。所有改动从 `main` 切短分支，合并后删除。

```bash
# 从最新主干切分支
git switch -c feat/team-avatar-upload
git switch -c fix/invite-token-expiry
git switch -c migrate/0014-teams-add-plan
```

命名还要能搜索。`feat/` 开头能一次列出所有功能分支，清理时不用逐个点开看。

分支与环境的对应关系也要定。短分支只部署预览，`main` 部署生产；不要给每个分支配一套数据库，成本高且容易串数据。

分支名按类型加前缀，一眼能看出改动性质。`feat/` 新功能，`fix/` 修缺陷，`chore/` 杂务，`docs/` 文档，`refactor/` 重构。

| 前缀 | 用途 | 示例 |
| --- | --- | --- |
| feat | 新功能 | feat/team-avatar-upload |
| fix | 缺陷修复 | fix/invite-expiry |
| refactor | 重构 | refactor/audit-log |
| chore | 依赖与配置 | chore/next-16-4-6 |

主干保护要逐条勾选，不要一键全开。全开包括“需要线性历史”“禁止强推”“需要签名”，小团队用不上，反而增加摩擦。

主干保护的第一条是禁止直推。第二条是要求分支最新，避免“合并后才发现冲突”。第三条是要求检查通过，红色 CI 不允许合并。

分支数量要控制。同时开着十个分支，说明迭代节奏有问题；合并速度比并行数量更能决定交付速度。超过三天的分支，合并冲突会吃掉大部分收益；大改动拆成几个小 PR，每个都能独立发布。

`main` 设保护规则。要求 PR、至少一个批准、检查通过、分支基于最新主干。

```bash
# 用 gh 配置分支保护
# 要求 PR + 至少 1 个批准 + 检查通过 + 分支最新
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -f required_status_checks.strict=true \
  -f required_status_checks.contexts[]='static' \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f enforce_admins=false \
  -f restrictions=null
```

紧急通道要留。线上着火时等评审不现实，可以允许管理员绕过，但事后必须补一个 PR 记录改动、原因与验证方式。

保护规则不要给自己开后门。`enforce_admins=false` 允许管理员强推，紧急时有用，平时是风险；开了就要有记录，事后补 PR。

## 53.2 一次改动的完整流程

流程的价值在“每个人做法一致”。一个人用 rebase、一个人用 merge，历史会变成毛线；约定一种，写进贡献指南。

六步，顺序固定。跳步的代价在后面显现。

```bash
# 一次改动的六步
# 1. 从最新主干拉分支
git switch main && git pull --ff-only
git switch -c feat/team-avatar-upload

# 2. 写代码，小步提交（提交信息后面讲）
git add -A && git commit -m "feat(teams): 支持上传团队头像"

# 3. 推送前本地自查（钩子会自动跑，也可以手动）
pnpm lint && pnpm tsc --noEmit && pnpm test --run

# 4. 推送，开 PR（模板会自动带上）
git push -u origin HEAD

# 5. 等 CI 绿，按评审意见改（改完 push，CI 重跑）
git commit -m "fix(teams): 上传前校验 MIME 类型" && git push

# 6. 合并（squash），删分支，本地同步
gh pr merge --squash --delete-branch
git switch main && git pull --ff-only
```

合并策略选 squash。一个 PR 压成一个提交，主干上每个提交都对应一次可发布的改动；想看细节回到 PR 里看。

提交粒度按“能独立回滚”划分。一个提交同时改数据库与前端，出问题时无法只回滚一半。

第一步拉分支前先 `git fetch`，避免基于过期的 `main` 开发。第二步小步提交，每一步能编译通过；提交信息写“做了什么”，不写“改了文件”。

分支要基于最新 `main`。落后太多时先 rebase 再开 PR，别等合并时再解冲突；冲突解决在合并那一刻，最容易出错。

第三步本地自查靠钩子自动化，手动跑一遍更稳。第四步开 PR 时模板自动带上，填完再请求评审。

第五步等 CI。红了先看日志第一处失败，不要从头翻；改完 push，CI 自动重跑。

第六步合并用 squash，一个 PR 一个提交，主干历史干净。删分支、切回 `main` 拉最新，进入下一个循环。

## 53.3 PR 模板

PR 描述要能独立读懂。评审的人不一定有上下文，把背景写清；三个月后回看的人更需要它。

模板同时是评审的索引。评审的人按六段看：先看“影响面”判断风险，再看“怎么验证”决定要不要本地跑。

模板的作用是让作者先想清楚，再让人看。六段：做了什么、为什么、怎么验证、影响面、截图、评审重点。

```markdown
<!-- .github/pull_request_template.md -->
## 这个 PR 做了什么

<!-- 一两句话。不要写「优化代码」这种。 -->

## 为什么

<!-- 关联 issue：Closes #123。没有 issue 就写背景。 -->

## 怎么验证

<!-- 评审的人照着做就能验。写命令、写路径、写预期。 -->

- [ ] `pnpm lint && pnpm tsc --noEmit` 通过
- [ ] 本地跑 `pnpm dev`，访问 `/app/teams`，点击「上传头像」，选一张 2 MB 的 PNG
- [ ] 预期：头像出现，Storage 里多一个文件，`activity_logs` 多一行

## 影响面

- [ ] 数据库迁移（如果是，单独 PR，见 53.9）
- [ ] 环境变量（新增/修改了哪些，是否已加到 Vercel / VPS）
- [ ] 缓存（是否改了 revalidate / tag / Cache-Control）
- [ ] 权限（是否新增/修改了 RLS 策略或 Server Action 鉴权）
- [ ] 依赖（新增了什么，为什么不用现成的）

## 截图 / 录屏

<!-- UI 改动必须有；纯后端可以写「无」 -->

## 评审重点

<!-- 作者主动指出：哪块最没把握，希望重点看哪。 -->
```

PR 的大小要控制。超过四百行的改动，评审会变成扫读；拆成“先加字段、再改逻辑、最后删旧代码”三个 PR，每个都能独立回滚。

“怎么验证”要写命令与预期结果。写“本地测试通过”等于没写；写“`pnpm test --run src/lib/teams.test.ts` 全绿”才能复现。

“评审重点”指作者自己知道哪块最可疑。写清“迁移的索引创建时间没测过”，评审的人会重点看那一处。

模板要能跳过不影响的部分。纯文案改动可以只填两段，但“影响面”必须写，它是评审判断风险的入口。

模板不要长。六段填完两三分钟，长模板会被清空提交；字段越少，填的人越认真。

## 53.4 CODEOWNERS

CODEOWNERS 的粒度要合适。按目录划分够用；按单个文件划分维护成本高，改一次目录结构就要重写一遍。

CODEOWNERS 指定某类文件必须由谁批准。它只负责路由评审，不负责权限。

```text
# .github/CODEOWNERS
# 迁移必须由数据库负责人批准
/supabase/migrations/    @teamstack/db-owners

# 部署与 CI 配置
/.github/workflows/      @teamstack/ops
/Dockerfile              @teamstack/ops
/compose.yaml            @teamstack/ops

# 安全相关
/src/lib/auth.ts         @teamstack/security
/src/lib/supabase/       @teamstack/security
/src/proxy.ts            @teamstack/security
```

迁移目录归数据库负责人，部署与 CI 配置归运维，认证与 Supabase 客户端归安全负责人。三类改动出错的代价最高，值得多一道人。

CODEOWNERS 的匹配规则按最后一条生效，路径写得越具体越优先。`*` 兜底给所有人，再给关键目录指定负责人。

CODEOWNERS 要配合分支保护的“Require review from Code Owners”。只写文件不勾选项，规则不生效。

## 53.5 依赖升级

升级 PR 的 CI 要看全。单测绿了不代表能跑，构建与端到端测试至少跑一个；跳过原因的写法要在 PR 里写明。

依赖升级的风险与收益要权衡。安全补丁尽快升，功能版本按需升，大版本等预览环境验证；全部自动合并的团队，通常在某个周一集中爆炸。

依赖升级也走 PR，不直接改 `main`。Dependabot 每周提一次，补丁与小版本合并成一个 PR，大版本单独提。

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: '09:00'
      timezone: Asia/Shanghai
    open-pull-requests-limit: 3
    groups:
      # 小版本和补丁合成一个 PR，减少评审次数
      minor-and-patch:
        patterns: ['*']
        update-types: ['minor', 'patch']
      # 大版本单独一个，必看 changelog
      major:
        patterns: ['*']
        update-types: ['major']
    ignore:
      # 这几个和框架版本强绑定，手动升
      - dependency-name: next
      - dependency-name: react
      - dependency-name: react-dom

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
```

三条规则。第一，`next`、`react`、`react-dom` 锁住大版本，升级手动做。第二，Actions 每月检查一次，避免频繁噪音。第三，同时开着的 PR 不超过三个，多了没人看。

升级 PR 的验证比功能 PR 更严。构建、类型、测试全过之外，还要在预览环境点一遍主要页面；依赖升级引起的问题通常在运行时。

大版本升级前读迁移指南。Next.js 16 的 `middleware.ts` 改成 `proxy.ts`、请求 API 变成异步，这类改动 Dependabot 不会替你改。

## 53.6 提交前钩子

钩子要跑在暂存区，工作区的改动不参与。lint-staged 只处理 `git add` 过的文件，未暂存的改动不参与，避免“修了但没提交”的误判。

钩子的顺序要快。pre-commit 超过十秒，开发者就会开始加 `--no-verify`；把慢检查放到 pre-push 或 CI。

钩子分两层。pre-commit 只跑改动的文件，快；pre-push 跑类型检查与测试，慢但值得。

```bash
# 安装 husky 与 lint-staged
pnpm add -D husky lint-staged
pnpm exec husky init
```

```sh
# .husky/pre-commit
pnpm exec lint-staged
```

```sh
# .husky/pre-push
pnpm exec tsc --noEmit && pnpm test --run
```

```js
// lint-staged.config.mjs
export default {
  // 只对暂存的 TS/TSX 跑 eslint 和 prettier
  '*.{ts,tsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,md,css}': ['prettier --write'],
  // 迁移文件不动格式：SQL 有语义，格式化可能改掉注释位置
  'supabase/migrations/*.sql': () => 'echo "skip formatting for migrations"',
}
```

```json
// package.json 片段
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test",
    "format": "prettier --write ."
  }
}
```

类型检查放在 pre-push。全量 `tsc` 要十几秒，每次提交都跑会拖慢节奏；推到远端前跑一次，够用。

Lint 用 `eslint . --max-warnings=0`。Next.js 16 移除了 `next lint`，直接用 ESLint；警告也算失败，避免“先合了再说”。

钩子要进仓库。`.husky/` 与 lint-staged 配置提交后，新成员克隆即生效；只写在本地的钩子等于没有。

钩子能被 `--no-verify` 绕过。绕过要写理由，CI 仍会拦；钩子的价值是省一次往返，安全边界要放在 CI。

## 53.7 PR 检查流水线

检查要快。四件事控制在十分钟内，超过就会有人绕过；把慢的测试拆到夜间任务，PR 只跑与改动相关的部分。

CI 在 PR 上跑四件事：lint、类型检查、测试、构建。四件都过才允许合并。

```yaml
# .github/workflows/checks.yml
name: checks

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: checks-${{ github.ref }}
  cancel-in-progress: true

jobs:
  static:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test --run

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}

  migrations:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # 只在迁移文件变化时跑，省时间
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect migration changes
        id: changed
        run: |
          if git diff --name-only "origin/main...HEAD" | grep -q '^supabase/migrations/'; then
            echo "changed=true" >> "$GITHUB_OUTPUT"
          else
            echo "changed=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Migration checklist
        if: steps.changed.outputs.changed == 'true'
        run: |
          echo "本次 PR 改了迁移，请确认："
          echo "1. 是否向后兼容（旧代码能在新 schema 上跑）"
          echo "2. 是否有 drop column / rename column"
          echo "3. 是否有不带 CONCURRENTLY 的 create index"
          echo "4. 是否有长事务锁表"
          git diff "origin/main...HEAD" -- supabase/migrations/
```

数据库服务的版本要与生产一致。本地用 Postgres 17，CI 用 16，迁移在 CI 通过、上线失败；版本号写进工作流。

迁移相关改动额外跑一个 job，用 Postgres 服务重放迁移。

```yaml
# .github/workflows/checks.yml 片段
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s --health-timeout 5s --health-retries 5
```

```bash
# 手动跑 lint
pnpm exec eslint . --max-warnings=0
```

工作流要锁权限。`permissions` 只给必要项，默认的读写全开在第三方 action 被投毒时会被利用。

检查失败要能定位。四个 job 分开跑，哪个红了一眼看得出；塞进一个 job，日志几百行，找不到失败点。

CI 要缓存依赖。`actions/setup-node` 的 `cache: pnpm` 加上 `--frozen-lockfile`，安装时间从两分钟降到二十秒。

并发要限制。同一个 PR 连推三次，只保留最后一次运行；`concurrency` 配 `cancel-in-progress: true`。

超时要设。默认六小时，卡住的 job 会占满额度；设 15 分钟，异常时快速失败。

## 53.8 本地复现 CI

本地与 CI 的差异要消除。Node 版本写进 `.nvmrc`，包管理器版本写进 `packageManager`，环境变量写成 `.env.example`。

CI 红了，先本地复现。三步：同版本 Node、干净安装、按顺序跑。

```bash
# 本地复现 CI 的三步
# 1. 用和 CI 一样的 Node 版本（.nvmrc 里写 22）
cat .nvmrc
fnm use   # 或 nvm use

# 2. 干净安装，严格按 lockfile
rm -rf node_modules
pnpm install --frozen-lockfile

# 3. 按 CI 的顺序跑一遍
pnpm lint
pnpm typecheck
pnpm test --run
pnpm build
```

```json
// package.json 片段
{
  "scripts": {
    "ci": "pnpm lint && pnpm typecheck && pnpm test --run && pnpm build"
  }
}
```

“在我机器上是好的”多数是三个原因：Node 版本不同、`node_modules` 有残留、环境变量缺失。三步能排除前两个，第三个看 CI 日志里的 `env` 段。

## 53.9 评审清单

评审的目标是找问题，不评价人。用“这里会在并发下丢数据”代替“你这里写错了”，前者可讨论，后者只剩防御。

评审前先看 PR 大小与影响面。改十行核心逻辑，比改五百行样式更需要细看；改迁移与鉴权，默认提高一档标准。

评审的产出是结论。每轮结束时明确：可以合并、需要改哪几处、或者需要再讨论；只留一堆评论不算完成。

评审看四类问题，按风险排序：安全、缓存、性能、可访问性。

评审要落到具体行。写“这里注意权限”没人知道改哪；写“第 12 行查询前没校验 teamId”可直接改。

安全看鉴权是否在函数第一行。数据查询前有没有校验当前用户属于这个团队，是最常见的越权点。

```diff
-const member = await assertOwner(teamId, userId)
+const member = await getMember(teamId, userId)
```

```ts
// src/lib/teams.test.ts
it('非 owner 不能删团队', async () => {
  const member = await signInAs('member@example.com')
  await expect(deleteTeam(teamId, member.id)).rejects.toThrow(/forbidden/i)
})
```

缓存看失效点。写操作之后有没有 `revalidateTag`，标签名与读取侧是否一致；需要“自己立刻看到”的场景用 `updateTag`。

性能问题的证据在数字里。写“这里可能慢”没有说服力，写“这个查询在 10 万行时 800 毫秒”才有。

性能看循环里的 I/O。`for` 循环里 `await` 查询是 N+1 的典型写法。

```ts
const { data: members } = await supabase.from('members').select('*').eq('team_id', teamId)
```

```ts
for (const email of emails) {
  await sendInvite(email)
}
```

可访问性看表单与交互。输入框有没有 `label`，按钮有没有可读名称，错误提示是否关联到字段。

评审一次只看一个维度也行。先过安全，再过性能，最后过风格；混在一起看，容易漏掉高风险项。：`blocking:` 必须改，`question:` 需要解释，`nit:` 可改可不改，`praise:` 值得保留。

| 前缀 | 含义 | 处理 |
| --- | --- | --- |
| blocking | 必须改 | 改完再合 |
| question | 需要解释 | 回复后由作者决定 |
| nit | 细节建议 | 可忽略 |
| praise | 做得好 | 不用回复 |

## 53.10 迁移的单独评审

迁移评审要看执行顺序。两个 PR 同时加迁移，合并后编号可能冲突；约定时间戳取当前时间，合并前 rebase 一次。

改 `supabase/migrations/` 的 PR 要多填一段，并且由 CODEOWNERS 里的人批准。

```markdown
<!-- .github/pull_request_template.md 片段 -->
## 迁移检查（改动了 supabase/migrations/ 时必填）

- [ ] 本次迁移向后兼容：旧代码在新 schema 上能跑（expand 阶段）
- [ ] 没有 `drop column` / `rename column`（如果有，说明分几次发布）
- [ ] `create index` 用了 `CONCURRENTLY`，且文件头写了 `-- migrate:no-transaction`
- [ ] 大表加列没有 `default` 以外的写入（`add column ... default` 在 PG 11+ 是元数据操作）
- [ ] 回滚方案：怎么撤销？如果不可撤销，说明为什么可以接受
- [ ] 已在预发/本地用真实数据量跑过，耗时：____ 秒
```

迁移评审要问“线上跑多久”。加索引、改类型在大表上可能锁几分钟；评审时确认执行计划与预估耗时，比事后回滚便宜。

迁移 PR 的合并要慢。合并即执行，执行可能锁表；挑低峰期合并，并提前通知可能受影响的调用方。

评审迁移看五点：向后兼容、有没有 `drop` 或 `rename`、加索引是否用 `CONCURRENTLY`、大表加列是否有默认值、回滚方案是什么。

本地要先重放一遍。

```bash
# 在本地重放迁移
# 1. 重置本地库，从第一个迁移开始重放
pnpm exec supabase db reset

# 2. 确认最终 schema 与预期一致
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "\d+ teams"

# 3. 用真实数据量试一次锁表时间（可选，但大表必做）
psql "$DIRECT_URL" -c "\timing on" -f supabase/migrations/20261201090000_teams_add_slug.sql
```

迁移文件一旦合并就不要再改。发现写错，加一个新迁移修；改历史文件会让已部署环境的版本对不上。

```ts
// 常见的写法问题
if (!email.includes('@')) throw new Error('bad email')
```

## 53.11 评审的节奏

评审要限时。一次看超过一小时，注意力下降，后半段基本在扫；看不动就分批，别硬撑。

评审意见要当天回。作者在等，上下文在冷却；隔两天再回，多半要重新读一遍代码。

小 PR 是效率的关键。超过 400 行的改动，评审质量会明显下降；拆成几个 PR，每个只做一件事。

评审要有人真读代码。三个“看起来没问题”的批准，替代不了一次逐行阅读。，比如一个工作日内。超时要主动说，别让作者等着。

意见要说清后果。写“这里可能有问题”，作者不知道改什么；写“没校验 teamId，任何人可以读别人的团队”，作者立刻明白。

```ts
// 邀请链接的常见错误
// 邀请链接用 window.location.origin 拼
```

## 53.12 合并、发布与回滚

回滚也要评审。回滚 PR 说明回退哪个提交、为什么、验证了什么；没有记录的回滚，下次没人知道当时发生了什么。

回滚演练每季度一次。按手册从当前版本回退一个版本，确认服务恢复；演练不写代码，只验证步骤与权限。

合并后要删分支。留着不删的分支会越积越多，半年后没人敢清理；`gh pr merge --delete-branch` 一步完成。

合并前确认三件事：检查全绿、批准数够、分支最新。三件缺一件，GitHub 的按钮就是灰的。

合并用 squash，提交信息沿用 PR 标题。合并后自动触发部署流水线，镜像按提交 sha 打标签。

```bash
# 回滚到上一个镜像
IMAGE_TAG=<上一个 sha> docker compose up -d --no-deps app
```

发布记录要落到 PR。合并后自动评论部署结果与环境地址，半年后回看，这条评论就是审计线索。

回滚只回代码，不回数据库。迁移必须向后兼容，删除列、改类型分两次发布；这条规则在评审迁移时就要检查一遍。

紧急修复也走 PR。直推 `main` 省五分钟，事后补记录与复盘的成本更高；真到了必须直推的程度，说明保护规则的设计有问题。

## 53.13 边界与失败模式

流程失效往往出在配置缺口上：配了一半，或者配了没人验证。

1. 保护规则只挡直接推送，不挡强推。有人 `push --force` 覆盖主干，历史丢失。保护规则里同时禁止强推与删除分支。
2. 钩子能被 `--no-verify` 绕过。钩子只是提前反馈，真正的闸门在 CI；两边都要有。
3. CODEOWNERS 路径写错，规则不生效。路径区分大小写，也不支持任意通配，改完用一个小 PR 验证。
4. 迁移 PR 与功能 PR 混在一起。评审时看不出迁移的风险，出问题也无法单独回滚。
5. 压缩合并丢掉提交粒度。排查问题时找不到对应改动，提交信息要写清范围与动机。
6. 回滚代码但没回滚迁移。旧代码跑在新 schema 上，字段类型不匹配，启动即报错。

## 53.14 检查点

1. `main` 分支保护生效，直推被拒。判据：`git push origin main` 返回 `protected branch`。
2. 新建 PR 时模板自动出现，六段齐全。判据：标题与段落都在。
3. 提交一个带 lint 错误的文件，`git commit` 被拦。判据：钩子输出 ESLint 报错。
4. PR 上四项检查全部运行，缺一项说明 workflow 没配全。判据：Checks 列表四条。
5. 改一个迁移文件，PR 里出现迁移检查段且 CODEOWNERS 被请求评审。判据：Reviewers 里有数据库负责人。
6. 合并后部署流水线自动触发，镜像 tag 是提交 sha。判据：GHCR 里有对应 tag。
7. 按回滚命令切回上一个 tag，服务正常。判据：`docker compose ps` 全部 Up。

六条都是流程没配全时最容易出现的，配齐之后多数不会发生；真出现时，按现象去查对应配置。

## 53.15 常见错误

**1. `remote: error: GH006: Protected branch update failed`**

现象是推 `main` 被拒。原因是分支保护生效。改法是切分支开 PR，不要试图绕过。

**2. `husky - pre-commit hook exited with code 1`**

现象是提交失败，输出里有 ESLint 报错。原因是改动文件有 lint 问题。改法是按提示修，或 `pnpm exec eslint --fix` 后重试。

**3. `ERR_PNPM_OUTDATED_LOCKFILE`**

现象是 CI 安装失败，本地正常。原因是改了 `package.json` 没更新锁文件。改法是本地 `pnpm install` 后提交 `pnpm-lock.yaml`。

**4. `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`**

现象是迁移执行失败。原因是 `CONCURRENTLY` 不能包在事务里。改法是在迁移文件头写 `-- migrate:no-transaction`，并让 runner 支持。

**5. PR 显示 `Some checks were not successful`，点开是空的**

现象是检查失败但没有日志。原因是 workflow 语法错误或权限不足。改法是看 Actions 页面的运行记录，修 YAML。

**6. 合并后部署用了旧镜像**

现象是代码合了，线上没变。原因是部署流水线读的是缓存或 tag 没更新。改法是确认镜像 tag 与提交 sha 一致，必要时手动触发一次。

流程配好之后，剩下的就是执行：每周看一次被跳过的检查、每月清理一次陈旧分支、每季度做一次回滚演练。

## 53.16 这一章在做什么

这一章把改动从分支到主干的路径固定成六步，并在四道位置放检查：钩子、CI、CODEOWNERS、评审清单。

它建立三条判断。第一，能自动化的检查不要靠自觉，钩子与 CI 比人可靠。第二，迁移是最危险的一类改动，必须单独评审并且向后兼容。第三，小 PR 与明确意见前缀，能让评审从“看一遍”变成“查几处”。

这一章不规定代码风格与提交信息格式，也不规定发布频率，那些按团队情况定。

下一章是附录，给出不写的内容与换实现对照。列出本书不写的内容与换实现对照，方便读者判断哪些主题需要另找资料。
