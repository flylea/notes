> **Part**: Part XI | **上一章**: [Ch 49](./Chapter-49-Widget测试.md) | **下一章**: [Ch 51](./Chapter-51-性能优化.md)
> **官方文档**: [flutter.cn/testing](https://docs.flutter.cn/testing) (integration_test) | [pub.dev/packages/patrol](https://pub.dev/packages/patrol)

---

# 第 50 章：集成测试与 E2E

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

> **下一步**: [Ch 51](./Chapter-51-性能优化.md)
