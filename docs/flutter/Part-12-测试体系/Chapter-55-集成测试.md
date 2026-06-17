> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 54 — Widget 测试](./Chapter-54-Widget测试.md)
> **下一章**: [Chapter 56 — 性能优化](./Chapter-56-性能优化.md)
> **官方文档**: [flutter.cn/testing](https://docs.flutter.cn/testing) (integration_test) | [pub.dev/packages/patrol](https://pub.dev/packages/patrol)

---

# 第 55 章：集成测试与 E2E

## 0. 本章目标

IntegrationTestWidgetsFlutterBinding 配置、E2E 端到端流程测试（完整用户旅程：登录→搜索→借书→还书）、patrol 高级特性（原生 UI 交互：权限弹窗/通知/WebView）、测试分片、多设备自动化截图、与 Playwright/Cypress 对照。

> 🎯 **Library App 产出**：5 条完整 E2E 流程（借阅/管理 CRUD/搜索→详情→借阅/注册→登录→更新资料/离线→在线同步）。

---

## 1. 基础 E2E 测试

```dart
// integration_test/borrow_flow_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:library_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Complete borrow flow', (tester) async {
    app.main();  // 启动真实 App
    await tester.pumpAndSettle();

    // ① 等待启动完成
    expect(find.text('📚 图书馆'), findsOneWidget);

    // ② 登录
    await tester.tap(find.byIcon(Icons.person));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'test@example.com');
    await tester.enterText(find.byType(TextField).last, 'password123');
    await tester.tap(find.text('登录'));
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // ③ 搜索图书
    await tester.enterText(find.byType(TextField).first, 'Clean Code');
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Clean Code'), findsOneWidget);

    // ④ 点击图书卡片进入详情
    await tester.tap(find.text('Clean Code'));
    await tester.pumpAndSettle();

    // ⑤ 点击借阅按钮
    await tester.tap(find.text('借阅此书'));
    await tester.pumpAndSettle();

    // ⑥ 验证借阅成功——跳转到借阅记录 Tab
    await tester.tap(find.text('借阅'));
    await tester.pumpAndSettle();
    expect(find.text('Clean Code'), findsOneWidget); // 出现在借阅记录中
  });
}
```

## 2. patrol——原生 UI 交互

```dart
// patrol_test/borrow_test.dart
void main() {
  patrolTest('borrow book with notification permission', ($) async {
    await $.pumpWidgetAndSettle(const LibraryApp());

    // 处理系统权限弹窗（patrol 可交互原生 UI）
    if (await $.native.isPermissionDialogVisible()) {
      await $.native.tapAlertDialog('允许');  // 点击系统弹窗的"允许"按钮
      await $.pumpAndSettle();
    }
    // ... 后续测试流程
  });
}
```

## 3. 测试金字塔

```
        ╱  E2E (5 tests)  ╲       少而精——关键用户旅程
       ╱  Widget (40+ tests) ╲     中层——组件交互
      ╱  Unit (60+ tests)     ╲    底座——业务逻辑全覆盖
```

---

## 4. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| 忘记 `IntegrationTestWidgetsFlutterBinding.ensureInitialized()` | 集成测试无法启动，报错"binding not initialized" | 在 `main()` 函数第一行调用 |
| 测试中硬编码 `Duration` 等待而不检查 UI 状态 | CI 环境性能波动导致超时或假通过 | 用 `pumpAndSettle()` 或 `waitFor` 轮询特定 Widget 出现 |
| E2E 覆盖过多细粒度场景 | 测试慢、维护成本高、CI 频繁卡死 | 集成测试只覆盖 5-10 条核心用户旅程（借阅/搜索/登录等） |
| 集成测试依赖外部网络（真实 API） | 网络波动导致测试不稳定 | 注入 Mock 服务器或使用测试环境的 API |
| 不清理测试产生的数据 | 数据累积影响后续测试或污染测试环境 | 每条测试在 `tearDown` 中清理创建的数据 |

**最佳实践**：

- 遵循测试金字塔：Unit 70% / Widget 20% / Integration 10%
- 集成测试只验证关键用户旅程：登录→搜索→详情→操作→结果
- 使用 `patrol` 处理原生 UI 交互（权限弹窗、通知、WebView）
- `pumpAndSettle()` 超时设置合理的 `duration` 参数（默认为 10 秒）
- 在 CI 中定时运行集成测试，而不是每次 PR 都触发
- 测试分片（sharding）将集成测试拆分到多个 runner 并行执行
- 每条 E2E 测试独立运行，不依赖前一条测试的状态
- 使用 `flutter test integration_test/` 运行，而非 `flutter drive`

## 5. 本章练习

**练习 1：为 Library App 编写图书借阅 E2E 流程**
- 使用 `integration_test` 包编写端到端测试
- 覆盖完整流程：启动 App → 查看图书列表 → 点击一本图书 → 点击借阅按钮 → 验证借阅状态更新
- 验证标准：`flutter test integration_test/borrow_flow_test.dart` 全部通过

**练习 2：使用 Patrol 编写带原生交互的 E2E 测试**
- 集成 Patrol 框架，编写一个包含系统权限弹窗处理的测试
- 模拟首次启动时网络权限弹窗，使用 `$.native` API 处理系统对话框
- 验证标准：测试在真机或模拟器上通过，权限弹窗被正确处理后进入主界面

**练习 3：构建 Library App 的测试金字塔**
- 统计项目中 Unit / Widget / Integration 测试的数量
- 按照测试金字塔原则（Unit > Widget > E2E），评估当前测试分布是否合理
- 找出测试覆盖最薄弱的层级，为该层级补充至少 2 个测试
- 验证标准：`flutter test` 全部通过，三层测试数量呈现金字塔分布

---

> **下一步**: [Chapter 56 — 性能优化](../Part-13-性能与质量/Chapter-56-性能优化.md)
