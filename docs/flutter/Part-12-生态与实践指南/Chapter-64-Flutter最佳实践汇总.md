# 第 64 章：Flutter 开发最佳实践汇总

## 0. 本章目标

- 掌握 Widget 编写规范和常见反模式
- 学会状态管理方案的选型决策
- 拥有完整的性能优化 Checklist
- 建立 Code Review 的标准流程

> 🎯 **本章产出**：`CODE_REVIEW_CHECKLIST.md` — 可复用到任何 Flutter 项目的代码审查清单。

---

## 1. Widget 编写规范

### 1.1 核心原则

```dart
// ❌ 反模式：build 方法太长，职责混杂
Widget build(BuildContext context) {
  final data = fetchData();       // 副作用！build 应该纯净
  return Column(
    children: [
      _buildHeader(),
      Container(/* 50 行布局代码 */),
      _buildFooter(),
    ],
  );
}

// ✅ 正确：build 纯净 + 合理拆分
Widget build(BuildContext context) {
  return Column(
    children: [
      const AppHeader(),
      const BookContent(),
      const AppFooter(),
    ],
  );
}
```

### 1.2 Widget 拆分信号

| 信号 | 操作 |
|------|------|
| Widget 超过 150 行 | 考虑提取为独立 Widget |
| 同一层级嵌套超过 5 层 | 提取中间 Widget |
| 同一个表达式出现 3 次以上 | 提取为方法或独立 Widget |
| 某个区域有独立的状态 | 提取为 StatefulWidget |
| 同样的 UI 模式出现在多个页面 | 提取为可复用组件 |

### 1.3 const 优先原则

```dart
// ❌ 漏掉 const — 每次 rebuild 都创建新实例
Padding(padding: EdgeInsets.all(16), child: Text('Hello'));

// ✅ 能 const 就 const — Flutter 性能优化的第一原则
const Padding(padding: EdgeInsets.all(16), child: Text('Hello'));
```

**规则**：如果构造函数的参数在编译时都是已知的常量，就用 `const`。IDE 会提示你（`prefer_const_constructors` lint）。

---

## 2. 状态管理选型决策树

```
你的应用复杂度？
  │
  ├─ 极简单（2-3 个页面、少量局部状态）
  │   └─ → setState  就够了
  │
  ├─ 中小型（多页面、跨组件共享状态）
  │   └─ → Provider + ChangeNotifier  或  Riverpod
  │
  ├─ 中型+（服务端数据为主、需要缓存/分页/乐观更新）
  │   └─ → Riverpod 2.x（推荐）
  │       优势：编译时安全、无需 BuildContext、代码生成
  │
  └─ 大型企业级（多团队协作、严格的分层架构要求）
      └─ → Bloc
          优势：严格的事件驱动、高可测性、与 Clean Architecture 契合
```

| 方案 | 学习曲线 | 模板代码量 | 适合规模 | 推荐场景 |
|------|---------|-----------|---------|---------|
| setState | 极低 | 极少 | S | 学习/原型/极简 App |
| Provider | 低 | 少 | M | 旧项目/简单需求 |
| Riverpod | 中 | 中 | M-L | **本教程推荐首选** |
| Bloc | 高 | 多 | L-XL | 大型企业级项目 |

---

## 3. 性能优化 Checklist

### 3.1 Build 优化（影响最大）

- [ ] Widget 构造函数尽可能使用 `const`
- [ ] 避免在 `build()` 中创建对象（`DateTime.now()` 等）
- [ ] 使用 `const` 构造而非 `new`（Dart 2+ 不需要 `new` 关键字）
- [ ] 大列表使用 `ListView.builder`（而非 `ListView(children: [...])`）
- [ ] 提取 `build()` 中的不变量为 `final` 局部变量
- [ ] 使用 `RepaintBoundary` 包裹不需要重绘的子树

### 3.2 状态管理优化

- [ ] 使用 `Selector` / `select` 精确订阅需要的状态片段
- [ ] 避免全局刷新：只通知真正依赖的 Widget
- [ ] `AnimatedBuilder` 的 `child` 参数用于缓存不依赖于动画的子组件

### 3.3 资源优化

- [ ] 图片使用 `cached_network_image`（网络图片）或 `AssetImage`（本地）
- [ ] 列表中的图片设置合理的 `cacheWidth/cacheHeight`
- [ ] 大图片使用渐进式加载（placeholder + fadeIn）
- [ ] 使用 `const SizedBox.shrink()` 代替 `Container()`（更轻量）

### 3.4 分析工具

```bash
# 性能分析
flutter run --profile
# 打开 DevTools → Performance 标签 → 录制 → 分析帧时间

# Widget 重建可视化
# 在 DevTools 中开启 Highlight Repaints
```

---

## 4. 常见反模式 Top 10

| # | 反模式 | 正确做法 |
|---|--------|---------|
| 1 | `build()` 中调用 `setState` | 在事件回调/生命周期方法中调用 |
| 2 | 忘记 `dispose` Controller | `AnimationController`/`TextEditingController`/`ScrollController`/`StreamSubscription` 必须 dispose |
| 3 | 在 `initState` 中使用 `BuildContext` | 用 `WidgetsBinding.instance.addPostFrameCallback` 或移到 `didChangeDependencies` |
| 4 | GlobalKey 滥用 | 90% 场景不需要 Key；GlobalKey 只在需要跨 Widget 树访问 State 时用 |
| 5 | 大 Widget 不拆分 | <150 行原则；每个 Widget 职责单一 |
| 6 | 不必要的 StatefulWidget | 能用 StatelessWidget 就不用 StatefulWidget |
| 7 | `build` 中的回调创建新匿名函数 | 提取为类方法或使用 `const` 回调 |
| 8 | 同步阻塞 `build` | 耗时操作放 `initState` 或 `compute`（Isolate） |
| 9 | 字符串拼接构造 API URL | 用 `Uri.https` / `Uri.parse` |
| 10 | 忽略错误处理 | 每个 `await` 应有配套的 `try-catch`；UI 中用 `ErrorWidget` / `SnackBar` |

---

## 5. Code Review Checklist

以下是可以直接复用的代码审查清单：

```markdown
# Code Review Checklist — Flutter

## Widget 构建
- [ ] Widget 是否合理拆分（<150 行、职责单一）
- [ ] 是否尽可能使用了 const 构造
- [ ] build 方法是否有副作用
- [ ] 是否有不必要的 StatefulWidget

## 状态管理
- [ ] 是否选用了合适的状态管理方案
- [ ] 是否避免了全局重建
- [ ] Controller/Subscription 是否在 dispose 中释放

## 异步处理
- [ ] 每个 await 是否有错误处理
- [ ] 异步操作后是否检查了 mounted
- [ ] 是否有未 await 的 Future

## 性能
- [ ] 列表是否使用了 .builder 构造
- [ ] 图片是否有合理的缓存策略
- [ ] 是否有不必要的 rebuild

## 代码规范
- [ ] 命名是否符合 Dart 规范
- [ ] 导入是否分组排序
- [ ] flutter analyze 是否零问题

## 安全
- [ ] 是否有硬编码的密钥/URL
- [ ] 环境变量是否通过 --dart-define 管理
- [ ] 用户输入是否有校验
```

---

## 本章练习

**练习 1：对照最佳实践清单检查 Library App**
- 逐项对照本章的性能清单，检查 Library App 是否满足每一条要求
- 建立一份"问题清单"，标记所有不符合项（如：某处未使用 `const`、某张图片缺少缓存策略）
- 按优先级排序（性能 > 代码规范 > 安全），为前 3 项制定修复计划
- 验证标准：问题清单完整覆盖三个维度，每项有明确的状态和优先级

**练习 2：补充 Library App 的安全检查**
- 使用 `grep` 或 IDE 搜索功能，扫描项目中是否包含硬编码的密钥、API Key 或内网 URL
- 确认所有环境变量均通过 `--dart-define` 或 `.env` 文件管理，且 `.env` 已加入 `.gitignore`
- 检查所有用户输入的 TextField 是否有合理的长度限制和格式校验
- 验证标准：搜索无硬编码敏感信息，所有环境变量管理规范，输入校验覆盖所有表单

**练习 3：建立项目级 CI 检查脚本**
- 编写一个 shell 脚本 `scripts/quality_check.sh`，依次运行：`flutter analyze`、`flutter test --coverage`、`dart format --set-exit-if-changed .`
- 将该脚本配置到 GitHub Actions 或其他 CI 工具中，确保每次 PR 自动触发
- 为脚本添加覆盖率阈值检查（低于 75% 则 CI 失败）
- 验证标准：本地运行脚本全部通过，CI 流水线正常执行

---

> 📖 **延伸阅读**: [Effective Dart](https://dart.cn/effective-dart) | [Flutter 性能最佳实践](https://docs.flutter.dev/perf/best-practices)
