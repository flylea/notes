# Part VI — 应用架构

> **前置**: [Part V — 状态管理](../Part-05-状态管理/)（你已掌握数据获取和状态管理，现在需要架构层面组织代码）
>
> **本 Part 总览**：将 Library App 从"能跑的代码"升级为"可维护的工程"。

---

## Part VI 章节导航

| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch28](./Chapter-28-应用架构设计理念.md) | 架构设计理念 | 三层架构/单向数据流/MVVM映射/Clean Architecture适用性 |
| [Ch29](./Chapter-29-MVVM模式.md) | MVVM 模式 | ViewModel职责/AsyncNotifier/View纯渲染 |
| [Ch30](./Chapter-30-Repository模式.md) | Repository 模式 | Repository接口/DataSource抽象/Fake Repository |
| [Ch31](./Chapter-31-依赖注入.md) | 依赖注入 | Riverpod DI/三环境完整配置/envied类型安全 |
| [Ch32](./Chapter-32-FeatureFirst项目结构.md) | Feature-First 项目结构 | Feature vs Layer/Barrel Files/core公共层 |
| [Ch33](./Chapter-33-App生命周期管理.md) | App 生命周期管理 | WidgetsBindingObserver/前后台切换/资源管理 |

---

## Part VI 学习目标检查清单

- [ ] 你能绘制 Library App 的三层架构图吗？
- [ ] 你能用 MVVM 模式重构一个 Feature 吗？
- [ ] 你能为 Repository 编写 Fake 实现用于测试吗？
- [ ] 你能处理 App 前后台切换时的资源管理吗？

### Part VI 独立练习

**用 MVVM + Repository 模式重构名片页**：抽取 ViewModel、引入 Repository 抽象层、注入 Fake 实现用于测试。

---

> **下一步**: [Part VII — 用户与权限系统](../Part-07-用户与权限系统/)
