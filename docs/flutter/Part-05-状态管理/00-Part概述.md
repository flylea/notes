# Part V — 状态管理

> **前置**: [Part IV — 网络与数据](../Part-04-网络与数据/)（你有真实数据了，现在需要高效管理它们）
>
> **本 Part 总览**：从 setState 起步，到 Provider 跨组件共享，再到 Riverpod 编译时安全方案，最后 Bloc 对比——完整理解状态管理演进路线和选型决策。

---

## Part V 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Ch23](./Chapter-23-setState局部状态管理.md) | setState 局部状态 | Ephemeral vs App State/mounted检查 | 搜索/排序/布局切换(setState版) |
| [Ch24](./Chapter-24-Provider与ChangeNotifier.md) | Provider + ChangeNotifier | InheritedWidget/Consumer/Selector/read vs watch | BookList/Borrowing/Search Provider |
| [Ch25](./Chapter-25-状态管理工程化.md) | 状态管理工程化 | AsyncState四态/分页/Shimmer/乐观更新 | 四态封装 + 骨架屏 + 乐观更新 |
| [Ch26](./Chapter-26-Riverpod2-响应式状态管理.md) | Riverpod 2.x | 八种Provider/ref.watch/codegen/ProviderObserver | 全面迁移到 Riverpod |
| [Ch27](./Chapter-27-Bloc对比学习.md) | Bloc 对比学习 | Cubit/Event→Bloc→State/BlocBuilder | Bloc分支实现 + 选型决策 |

---

## Part V 学习目标检查清单

- [ ] 你能区分局部状态（setState）和共享状态（Provider/Riverpod）的适用场景吗？
- [ ] 你能用 Riverpod 的 `ref.watch` 实现响应式数据流吗？
- [ ] 你能为异步数据实现 loading/error/data 四态管理吗？
- [ ] 你能根据应用复杂度选择合适的状态管理方案吗？

### Part V 独立练习

**用 Riverpod 重构 Part IV 的 GitHub 项目**：将 API 调用、数据缓存、搜索过滤全部迁移到 Riverpod。对比重构前后的代码复杂度差异。

---

> **下一步**: [Part VI — 应用架构](../Part-06-应用架构/)
