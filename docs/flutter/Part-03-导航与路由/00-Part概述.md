# Part III — 导航与路由

> **前置**: [Part II — Widget、布局、表单、主题](../Part-02-界面基石/)
>
> **本 Part 总览**：给 Library App 加上多页面导航体系。

---

## Part III 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Ch14](./Chapter-14-命令式导航基础.md) | Navigator 命令式导航 | 栈模型/push/pop/BottomNav+IndexedStack/Drawer | Tab切换+详情页跳转+Drawer+SettingsScreen |
| [Ch15](./Chapter-15-GoRouter声明式路由.md) | GoRouter 声明式路由 | ShellRoute/StatefulShellRoute/路径参数/redirect守卫 | 完整 GoRouter 配置 |
| [Ch16](./Chapter-16-深度链接与URL策略.md) | 深度链接 | Android App Links/iOS Universal Links/Supabase OAuth回调 | DeepLinkService + 分享链接 |

---

## Part III 学习目标检查清单

- [ ] 你能用 Navigator.push/pop 实现页面跳转和数据回传吗？
- [ ] 你能用 GoRouter + StatefulShellRoute 构建带 BottomNav 的多页面结构吗？
- [ ] 你能实现未登录用户自动跳转到登录页的 redirect 守卫吗？

### Part III 独立练习

**给名片页 App 添加完整 GoRouter 路由**：3 个 Tab + 详情页路由 + 深度链接。

---

> **下一步**: [Part IV — 网络与数据](../Part-04-网络与数据/)
