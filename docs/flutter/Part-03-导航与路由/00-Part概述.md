# Part III — 导航与路由

> **Part 总览**：本阶段将 App 从单页面进化为多页面应用——从 Navigator 1.0 的命令式导航基础，到 GoRouter 的声明式路由体系，再到 Android/iOS/Web 三平台的深度链接集成。

---

## Part III 章节导航

| 章节 | 标题 | 核心内容 | Library App 产出 |
|------|------|---------|-----------------|
| [Chapter 10](./Chapter-10-命令式导航基础.md) | Navigator 1.0 命令式导航基础 | 栈模型 / push/pop/pushReplacement/popUntil / PageRouteBuilder / 命名路由 / BottomNavigationBar+IndexedStack / Drawer / PopScope | Tab 切换 + 详情页跳转 + Drawer + AppDrawer 组件 |
| [Chapter 11](./Chapter-11-GoRouter声明式路由.md) | GoRouter 声明式路由 | GoRouter 配置 / ShellRoute / StatefulShellRoute / 三种参数 / 嵌套路由 / redirect 守卫 / 错误页面 | 完整 GoRouter 配置 + 路由类型安全 + 深层嵌套路由 |
| [Chapter 12](./Chapter-12-深度链接与URL策略.md) | 深度链接与 URL 策略 | 三种深度链接形式 / Android App Links / iOS Universal Links / URL 策略 / GoRouter 深度链接处理 / Supabase OAuth 回调 | DeepLinkService + 分享图书链接 + BookDetailLoader |

---

## Part III 学习目标检查清单

- [ ] Navigator 栈的 push/pop/pushReplacement/popUntil 分别是什么行为？
- [ ] BottomNavigationBar + IndexedStack 如何保持各 Tab 的 State？
- [ ] Drawer 的两种模式（drawer / endDrawer）？
- [ ] PopScope 如何拦截返回操作？什么场景下需要用？
- [ ] GoRouter 的 StatefulShellRoute 为什么比 ShellRoute 更适合 Tab 导航？
- [ ] extra / pathParameters / queryParameters 三种参数分别适用于什么场景？
- [ ] redirect 函数如何实现路由守卫？
- [ ] Android App Links 的 autoVerify 和 assetlinks.json 是什么关系？
- [ ] iOS Universal Links 需要配置哪些文件？
- [ ] 深度链接打开 GoRouter 页面时，为什么 extra 可能为 null？如何处理？

---

## Part III 完成后的 Library App 状态

```
library_app/
├── lib/
│   ├── main.dart                              # setPathUrlStrategy + runApp
│   ├── app.dart                               # MaterialApp.router(routerConfig: goRouter)
│   ├── core/
│   │   ├── router/
│   │   │   └── app_router.dart                # GoRouter + StatefulShellRoute 完整配置
│   │   └── deep_link/
│   │       └── deep_link_service.dart          # 深度链接服务（分享/生成链接）
│   ├── screens/
│   │   ├── home_screen.dart                   # 首页（使用 GoRouter 导航）
│   │   ├── book_detail_screen.dart            # 图书详情
│   │   ├── book_form_screen.dart              # 图书添加/编辑
│   │   ├── splash_screen.dart                 # 启动页
│   │   ├── borrowing_screen.dart              # 借阅记录 Tab
│   │   ├── profile_screen.dart                # 个人中心 Tab
│   │   ├── search_screen.dart                 # 搜索页
│   │   └── book_detail_loader.dart            # 深度链接图书加载
│   └── widgets/
│       ├── scaffold_with_nav.dart             # ShellRoute Scaffold + NavigationBar
│       └── app_drawer.dart                    # 侧边 Drawer
├── android/.../AndroidManifest.xml            # 深度链接 intent-filter
└── ios/Runner/Info.plist                       # CFBundleURLSchemes + FlutterDeepLinkingEnabled
```

> 📌 **此时 App 拥有完整的多页面导航体系**：GoRouter 声明式路由 + 底部三 Tab StatefulShellRoute + 深层嵌套路由 + 深度链接支持。但它仍使用硬编码的测试数据——Part IV 将引入状态管理，让数据变得"活跃"。

---

> **下一步**: [Part IV — 状态管理](../Part-04-状态管理/)
