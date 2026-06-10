# Part II — 界面基石：Widget 与布局

> **Part 总览**：本阶段是 Flutter UI 开发的核心基础——从 Widget 哲学到基础组件，从布局系统到滚动列表，从表单输入到交互手势。完成本阶段后，你将能搭建任何静态页面布局。

---

## Part II 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Chapter 05](./Chapter-05-Widget哲学.md) | Widget 哲学 | 不可变配置 / Stateless vs Stateful / Element 生命周期 / const 优化 / Key 体系 / BuildContext | MyApp + MaterialApp + HomeScreen 骨架 + SplashScreen |
| [Chapter 06](./Chapter-06-基础Widget全解析.md) | 基础 Widget 全解析 | Text/Image/Icon/Container + BoxDecoration/Button 族/RichText | BookCard 组件 + BookGridItem + 测试数据 |
| [Chapter 07](./Chapter-07-布局系统精讲.md) | 布局系统精讲 | 约束传递规则 / Row/Column / Expanded/Flexible / Stack / Wrap / MediaQuery/LayoutBuilder | 首页完整布局 + 详情页 Stack 布局 |
| [Chapter 08](./Chapter-08-滚动与列表.md) | 滚动与列表 | ListView/GridView/ Slivers 体系 / ScrollController / NestedScrollView | GridView.builder + SliverAppBar 详情页 |
| [Chapter 09](./Chapter-09-表单与用户输入.md) | 表单与用户输入 | TextField/Form/TextFormField/ 六种选择器/GestureDetector/FocusNode | 搜索防抖 + 图书添加/编辑表单 + 筛选面板 |

---

## Part II 学习目标检查清单

- [ ] Widget 是不可变的"配置"而非"活对象"——为什么？三棵树如何协同工作？
- [ ] `StatelessWidget` 和 `StatefulWidget` 分别适用于什么场景？State 的生命周期有哪些阶段？
- [ ] `const` Widget 为什么能提升性能？原理是什么？
- [ ] `BuildContext` 的本质是什么？异步操作后为什么要检查 `mounted`？
- [ ] Row/Column 的 `mainAxisAlignment` 和 `crossAxisAlignment` 分别控制什么？
- [ ] `Expanded` 和 `Flexible` 的区别？`Spacer` 是什么的语法糖？
- [ ] `Stack` + `Positioned` 的四种定位方式？
- [ ] `ListView.builder` 为什么性能优于 `ListView()`？
- [ ] `SliverAppBar` 的 pinned/floating/snap 四种模式分别是什么行为？
- [ ] `Form` + `TextFormField` 的验证流程（validate → save → reset）？
- [ ] `TextEditingController` 和 `FocusNode` 为什么必须在 `dispose()` 中释放？

---

## Part II 完成后的 Library App 状态

```
library_app/
├── lib/
│   ├── main.dart                         # App 入口
│   ├── app.dart                          # MaterialApp 配置
│   ├── models/
│   │   ├── book.dart                     # Book 数据模型
│   │   └── api_result.dart               # ApiResult sealed class
│   ├── data/
│   │   └── sample_books.dart             # 测试图书数据
│   ├── screens/
│   │   ├── home_screen.dart              # 首页（搜索+分类+图书网格+底部导航）
│   │   ├── book_detail_screen.dart       # 图书详情（SliverAppBar + 信息卡片）
│   │   ├── book_form_screen.dart         # 图书添加/编辑表单
│   │   └── splash_screen.dart            # 启动页
│   └── widgets/
│       ├── book_card.dart                # 图书卡片组件
│       ├── search_bar_widget.dart        # 搜索栏组件
│       └── filter_panel.dart             # 筛选面板组件
└── analysis_options.yaml                 # 严格静态分析配置
```

> 📌 **此时 App 已有完整的静态界面**：图书列表、详情页、添加/编辑表单、搜索过滤、分类筛选。但它还没有页面间的导航跳转、没有动态数据加载、没有状态共享——这些将在 Part III-V 中逐步加入。

---

> **下一步**: [Part III — 导航与路由](../Part-03-导航与路由/)
