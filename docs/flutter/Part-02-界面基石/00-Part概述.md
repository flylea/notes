# Part II — 界面基石：Widget、布局、表单、主题、测试

> **前置**: [Part I — Dart 语言基础](../Part-01-起航/)（你需要能熟练声明变量、定义类、使用 async/await）
>
> **本 Part 总览**：从零到一构建 Library App 的完整静态界面。学完本 Part 后，你将能独立设计和实现任何静态 UI 页面。

---

## Part II 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Ch06](./Chapter-06-Widget哲学.md) | Widget 哲学 | Stateless/StatefulWidget/三棵树/const优化/Key/BuildContext | `lib/app.dart` + `lib/screens/home_screen.dart` 骨架 |
| [Ch07](./Chapter-07-基础Widget全解析.md) | 基础 Widget 全解析 | Text/Image/Icon/Container/Button族/RichText | `lib/widgets/book_card.dart` + `lib/data/sample_books.dart` |
| [Ch08](./Chapter-08-Cupertino组件.md) | Cupertino 组件 | iOS风格组件/主题适配 | Cupertino版本变体（可选） |
| [Ch09](./Chapter-09-布局系统精讲.md) | 布局系统精讲 | 约束规则/Row/Column/Expanded/Stack/MediaQuery | 首页完整布局 + 详情页 Stack |
| [Ch10](./Chapter-10-滚动与列表.md) | 滚动与列表 | ListView/GridView/Slivers/ScrollController | GridView.builder + SliverAppBar |
| [Ch11](./Chapter-11-表单与用户输入.md) | 表单与用户输入 | TextField/Form/选择器/手势/键盘处理/FocusNode | 搜索防抖 + 图书表单 + 筛选面板 |
| [Ch12](./Chapter-12-Material3主题系统.md) | Material 3 主题系统 | ColorScheme/ThemeData/深色模式/ThemeExtension | `lib/core/theme/app_theme.dart` + 主题切换 |
| [Ch13](./Chapter-13-Widget测试入门.md) | Widget 测试入门 | WidgetTester/pumpWidget/find/expect | 核心 Widget 的测试文件 |

---

## Part II 学习目标检查清单

- [ ] 你能在 `build()` 方法中正确使用 `const` 构造，并通过 DevTools 验证 Widget 未被重建吗？
- [ ] 你能独立实现一个个人名片页（头像+姓名+简介+技能列表），不需要参照教程吗？
- [ ] 你能处理键盘遮挡表单的问题（viewInsets + resizeToAvoidBottomInset）吗？
- [ ] 你能配置 Material 3 主题（ColorScheme.fromSeed + light/dark 切换）吗？
- [ ] 你能为一个 Widget 编写 3 个测试用例（渲染/点击/空态）吗？

### Part II 独立练习

**独立实现一个个人名片页**，不接受任何教程代码参考：

1. 展示头像（圆形裁剪）、姓名、职位、一句话简介
2. 技能列表（每项含名称 + 熟练度指示条）
3. 深色/浅色主题切换按钮
4. 响应式布局：手机竖屏纵向排列，平板横屏左右分栏
5. 为该页面编写 3 个 Widget 测试用例

---

> **下一步**: [Part III — 导航与路由](../Part-03-导航与路由/)
