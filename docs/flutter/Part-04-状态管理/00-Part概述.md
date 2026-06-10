# Part IV — 状态管理

> **Part 总览**：本阶段从 `setState` 局部状态起步，经过 Provider 跨组件共享，到 Riverpod 2.x 现代化编译时安全方案，最后以 Bloc 对比收尾——让你完整理解 Flutter 状态管理的演进路线和选型决策。

---

## Part IV 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Chapter 13](./Chapter-13-setState局部状态管理.md) | setState 局部状态管理 | Ephemeral vs App State / setState 原理 / mounted 检查 / 搜索/排序/布局/Tab 四种模式 | HomeScreen 搜索过滤 + 排序 + 布局切换 |
| [Chapter 14](./Chapter-14-Provider与ChangeNotifier.md) | Provider + ChangeNotifier | InheritedWidget / ChangeNotifier / Consumer / Selector / read vs watch / ProxyProvider | BookList/Borrowing/Search Provider + 首页集成 |
| [Chapter 15](./Chapter-15-状态管理工程化.md) | 状态管理工程化 | AsyncState\<T\> 四态 / 无限分页 / Shimmer 骨架屏 / 乐观更新 / RefreshIndicator | 四态封装 + 分页加载 + 骨架屏 + 乐观删除 |
| [Chapter 16](./Chapter-16-Riverpod2-响应式状态管理.md) | Riverpod 2.x | 八种 Provider / ref.watch/listen/read / codegen / ProviderObserver / GoRouter 集成 | 全面迁移到 Riverpod + ProviderObserver |
| [Chapter 17](./Chapter-17-Bloc对比学习.md) | Bloc 对比学习 | Cubit / Event→Bloc→State / BlocBuilder / EventTransformer / 选型决策 | 实验性 Bloc 分支实现借阅功能 |

---

## Part IV 学习目标检查清单

- [ ] `setState` 的内部原理是什么？为什么不能立即更新 UI？
- [ ] 异步操作后为什么必须检查 `mounted`？
- [ ] `context.read<T>()` 和 `context.watch<T>()` 的区别？分别在什么地方使用？
- [ ] `Selector` 如何避免不必要的重建？它的 `selector` 参数做什么？
- [ ] `AsyncState<T>` 的四态封装如何设计？`fold` 方法的作用？
- [ ] 乐观更新的流程是什么？失败时如何回滚？
- [ ] Riverpod 的 `ref.watch` / `ref.listen` / `ref.read` 三者的区别？
- [ ] `@riverpod` 注解如何通过 codegen 减少样板代码？
- [ ] Bloc 的 `EventTransformer` 四种模式分别是什么行为？
- [ ] 什么时候选 Riverpod？什么时候选 Bloc？

---

> **下一步**: [Part V — 网络与数据](../Part-05-网络与数据/)
