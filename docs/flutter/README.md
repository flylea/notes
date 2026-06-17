# 30 天 Flutter 入门实战教程

> 从零到一构建生产级 Flutter 应用 —— 贯穿项目 **Library App**（图书馆借阅管理系统）
>
> 适用于 TypeScript / React / Vue 背景的 Web 开发者，也适合零基础新手。

---

## 快速开始

**👉 [30 天学习路线](30天学习路线.md) — 每天 1-2 小时，30 天系统掌握 Flutter。**

| 你的背景 | 建议 |
|---------|------|
| 有 TS/React 经验 | 直接开始，关注每章 "React 经验" 框快速建立映射 |
| 有 TS/Vue 经验 | 直接开始，先浏览 [附录 E — Vue→Flutter 概念映射](Appendix-E-Vue开发者Flutter概念映射.md) |
| 有其他编程经验 | 第 1 周 Dart 语法放慢节奏 |
| 零基础 | 每天可能需要 1.5-2 倍时间 |

---

## 课程全景

```
第一周 起航         → Flutter 概述、Dart 语法、Widget 哲学、布局系统
第二周 UI 深化       → 列表/表单/导航/GoRouter/深度链接
第三周 网络与状态    → Dio/Supabase/Provider/Riverpod
第四周 架构与进阶    → MVVM/Repository/权限/持久化/离线/动画
最后两天 收官        → 平台集成/测试/性能优化/多平台发布
```

---

## 完整章节导航

### [Part 00 — Flutter 概述](Part-00-Flutter概述/)
| 章节 | 标题 | 阅读时间 |
|------|------|---------|
| [Ch00](Part-00-Flutter概述/Chapter-00-Flutter概述.md) | Flutter 是什么？为什么要学？ | 15 min |

### [Part 01 — 起航：环境与 Dart 语言](Part-01-起航/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch01](Part-01-起航/Chapter-01-环境搭建与Flutter架构初探.md) | 环境搭建与 Flutter 架构 | Flutter SDK / VS Code / 四层架构 / 三棵树 / Impeller |
| [Ch02](Part-01-起航/Chapter-02-Dart核心语法速通-上.md) | Dart 语法速通（上） | 变量 / 类型 / 函数 / 异步 / 控制流 |
| [Ch03](Part-01-起航/Chapter-03-Dart-Stream流式编程.md) | Stream 流式编程 | Future / Stream / async* / StreamBuilder |
| [Ch04](Part-01-起航/Chapter-04-Dart核心语法速通-下.md) | Dart 语法速通（下） | 类 / 继承 / Mixin / 枚举 / 泛型 / 扩展方法 |
| [Ch05](Part-01-起航/Chapter-05-Dart3新特性与工程化基础.md) | Dart 3 新特性 | sealed class / 模式匹配 / 空安全 / analysis_options |

### [Part 02 — 界面基石：Widget、布局、表单、主题](Part-02-界面基石/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch06](Part-02-界面基石/Chapter-06-Widget哲学.md) | Widget 哲学 | 不可变配置 / 三棵树 / StatelessWidget / StatefulWidget / Key / BuildContext |
| [Ch07](Part-02-界面基石/Chapter-07-基础Widget全解析.md) | 基础 Widget 全解析 | Text / Image / Icon / Container / Button / HTML 对照 |
| [Ch08](Part-02-界面基石/Chapter-08-Cupertino组件.md) | Cupertino 组件 | iOS 风格组件 / 平台自适应 |
| [Ch09](Part-02-界面基石/Chapter-09-布局系统精讲.md) | 布局系统精讲 | 约束规则 / Row/Column / Expanded / Stack / CSS Flexbox 对照 |
| [Ch10](Part-02-界面基石/Chapter-10-滚动与列表.md) | 滚动与列表 | ListView / GridView / Slivers / ScrollController |
| [Ch11](Part-02-界面基石/Chapter-11-表单与用户输入.md) | 表单与用户输入 | TextField / Form / 验证 / 键盘处理 / 手势 |
| [Ch12](Part-02-界面基石/Chapter-12-Material3主题系统.md) | Material 3 主题系统 | ColorScheme / ThemeData / 深色模式 / ThemeExtension |

### [Part 03 — 导航与路由](Part-03-导航与路由/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch14](Part-03-导航与路由/Chapter-14-命令式导航基础.md) | 命令式导航 | Navigator / push/pop / BottomNavigationBar / Drawer / PopScope |
| [Ch15](Part-03-导航与路由/Chapter-15-GoRouter声明式路由.md) | GoRouter 声明式路由 | 集中配置 / ShellRoute / StatefulShellRoute / Redirect |
| [Ch16](Part-03-导航与路由/Chapter-16-深度链接与URL策略.md) | 深度链接 | URL Strategy / Android App Links / iOS Universal Links / Supabase OAuth |

### [Part 04 — 网络与数据](Part-04-网络与数据/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch17](Part-04-网络与数据/Chapter-17-Dio-HTTP客户端.md) | Dio HTTP 客户端 | 拦截器链 / Token 刷新排队 / 请求取消 / 多环境 / Axios 对照 |
| [Ch18](Part-04-网络与数据/Chapter-18-Retrofit类型安全API.md) | Retrofit 类型安全 API | @GET/@POST / build_runner / tRPC 对照 |
| [Ch19](Part-04-网络与数据/Chapter-19-freezed-JSON序列化.md) | freezed JSON 序列化 | @freezed / fromJson/toJson / copyWith / 联合类型 |
| [Ch20](Part-04-网络与数据/Chapter-20-Supabase集成.md) | Supabase 集成 | 建表 / RLS / CRUD / Storage / Firebase 对照 |
| [Ch21](Part-04-网络与数据/Chapter-21-Supabase高级.md) | Supabase 高级 | Realtime / Edge Functions |
| [Ch22](Part-04-网络与数据/Chapter-22-文件上传与实时通信.md) | 文件上传与实时通信 | 分片上传 / 进度 / WebSocket / 心跳 |

### [Part 05 — 状态管理](Part-05-状态管理/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch23](Part-05-状态管理/Chapter-23-setState局部状态管理.md) | setState 局部状态管理 | Ephemeral vs App State / 四种常见模式 / mounted |
| [Ch24](Part-05-状态管理/Chapter-24-Provider与ChangeNotifier.md) | Provider + ChangeNotifier | InheritedWidget / Consumer / Selector / ProxyProvider |
| [Ch25](Part-05-状态管理/Chapter-25-状态管理工程化.md) | 状态管理工程化 | AsyncState 四态 / 分页 / Shimmer / 乐观更新 |
| [Ch26](Part-05-状态管理/Chapter-26-Riverpod2-响应式状态管理.md) | Riverpod 2.x | 八种 Provider / 依赖链 / Observer / GoRouter 集成 |
| [Ch27](Part-05-状态管理/Chapter-27-Bloc对比学习.md) | Bloc 对比学习 | Event→Bloc→State / Riverpod vs Bloc 选型 |

### [Part 06 — 应用架构](Part-06-应用架构/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch28](Part-06-应用架构/Chapter-28-应用架构设计理念.md) | 架构设计理念 | 三层架构 / 单向数据流 / Clean Architecture 务实判断 |
| [Ch29](Part-06-应用架构/Chapter-29-MVVM模式.md) | MVVM 模式 | ViewModel (AsyncNotifier) / 页面 vs 全局 / 迁移清单 |
| [Ch30](Part-06-应用架构/Chapter-30-Repository模式.md) | Repository 模式 | 接口抽象 / Remote First / Fake 实现 / 三种策略 |
| [Ch31](Part-06-应用架构/Chapter-31-依赖注入.md) | 依赖注入 | Riverpod DI / get_it / 三环境 / Override 测试注入 |
| [Ch32](Part-06-应用架构/Chapter-32-FeatureFirst项目结构.md) | Feature-First 项目结构 | Layer-First vs Feature-First / Barrel Files / lint 扩展 |
| [Ch33](Part-06-应用架构/Chapter-33-App生命周期管理.md) | App 生命周期 | AppLifecycleState / WidgetsBindingObserver / Riverpod 集成 |

### [Part 07 — 用户与权限系统](Part-07-用户与权限系统/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch34](Part-07-用户与权限系统/Chapter-34-Supabase-Auth认证体系.md) | Supabase Auth 认证 | 注册/登录 / AuthGuard / Session / OAuth / Magic Link |
| [Ch35](Part-07-用户与权限系统/Chapter-35-安全存储与生物识别.md) | 安全存储与生物识别 | flutter_secure_storage / local_auth / 隐私锁屏 |
| [Ch36](Part-07-用户与权限系统/Chapter-36-RBAC权限管理.md) | RBAC 权限管理 | 三级角色 / Claims / RLS 策略 / RoleGate 组件 |

### [Part 08 — 本地持久化与离线](Part-08-本地持久化与离线/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch39](Part-08-本地持久化与离线/Chapter-39-SharedPreferences用户偏好.md) | SharedPreferences | KV 存储 / PreferencesService / 选型决策树 / localStorage 对照 |
| [Ch40](Part-08-本地持久化与离线/Chapter-40-Drift本地数据库.md) | Drift 本地数据库 | Table / DAO / 响应式 Stream / 迁移 / Prisma 对照 |
| [Ch41](Part-08-本地持久化与离线/Chapter-41-离线优先策略.md) | 离线优先策略 | 网络监听 / 同步队列 / Fallback / 冲突解决 |

### [Part 09 — 高级 UI 与体验](Part-09-高级UI与体验/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch42](Part-09-高级UI与体验/Chapter-42-动画系统.md) | 动画系统 | Ticker / Tween / Curve / 隐式动画 / 显式动画 / Hero / CSS 对照 |
| [Ch43](Part-09-高级UI与体验/Chapter-43-CustomPainter.md) | CustomPainter | Canvas API / 评分五角星 / 环形进度 / HTML Canvas 对照 |
| [Ch44](Part-09-高级UI与体验/Chapter-44-响应式设计.md) | 响应式设计 | 断点系统 / Master-Detail / 导航自适应 / 响应式网格 |
| [Ch45](Part-09-高级UI与体验/Chapter-45-国际化.md) | 国际化 | ARB + gen_l10n / 复数 / ICU MessageFormat / RTL |
| [Ch46](Part-09-高级UI与体验/Chapter-46-无障碍.md) | 无障碍 | Semantics / TalkBack / VoiceOver / 对比度 / 键盘导航 |
| [Ch47](Part-09-高级UI与体验/Chapter-47-高级UI效果.md) | 高级 UI 效果 | BackdropFilter / ShaderMask / Transform 3D / CSS 对照 |

### [Part 10 — 业务功能实战](Part-10-业务功能实战/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch37](Part-10-业务功能实战/Chapter-37-借阅系统状态机.md) | 借阅系统状态机 | Available→Borrowed→Overdue→Returned / 并发锁 / 排队 |
| [Ch38](Part-10-业务功能实战/Chapter-38-搜索与发现.md) | 搜索与发现 | PostgreSQL FTS / 复合筛选 / 防抖 / 搜索历史 |

### [Part 11 — 平台集成与设备能力](Part-11-平台集成与设备能力/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch48](Part-11-平台集成与设备能力/Chapter-48-推送通知.md) | 推送通知 | FCM / flutter_local_notifications / Edge Function / Web Push 对照 |
| [Ch49](Part-11-平台集成与设备能力/Chapter-49-平台通道.md) | 平台通道 | MethodChannel / Pigeon / 三端代码 (Dart/Kotlin/Swift) |
| [Ch50](Part-11-平台集成与设备能力/Chapter-50-设备功能.md) | 设备功能 | Camera / FilePicker / Share / URL Launcher / 权限 |
| [Ch51](Part-11-平台集成与设备能力/Chapter-51-桌面端.md) | 桌面端适配 | window_manager / 托盘 / MenuBar / 拖放 / 快捷键 |
| [Ch52](Part-11-平台集成与设备能力/Chapter-52-Add-to-App.md) | Add-to-App | Flutter module / AAR / CocoaPods / Engine 预热 |

### [Part 12 — 测试体系](Part-12-测试体系/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch13](Part-12-测试体系/Chapter-13-Widget测试入门.md) | Widget 测试入门 | 三层体系 / pumpWidget / Finder / 交互测试 |
| [Ch19b](Part-12-测试体系/Chapter-19b-模型单元测试入门.md) | 模型单元测试 | Given-When-Then / Fake Repository / 覆盖率 |
| [Ch53](Part-12-测试体系/Chapter-53-单元测试.md) | 单元测试进阶 | ProviderContainer / Mock / Jest/Vitest 对照 |
| [Ch54](Part-12-测试体系/Chapter-54-Widget测试.md) | Widget 测试进阶 | 四泵方法 / Finder 大全 / Golden Test / RTL 对照 |
| [Ch55](Part-12-测试体系/Chapter-55-集成测试.md) | 集成测试 | E2E / patrol / 测试金字塔 |

### [Part 13 — 性能与质量](Part-13-性能与质量/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch56](Part-13-性能与质量/Chapter-56-性能优化.md) | 性能优化 | const / itemExtent / RepaintBoundary / Isolate / Shader 预热 / 性能基线 |
| [Ch57](Part-13-性能与质量/Chapter-57-DevTools详解.md) | DevTools 详解 | Inspector / Memory / CPU Profiler / Network / Chrome DevTools 对照 |
| [Ch58](Part-13-性能与质量/Chapter-58-错误处理与监控.md) | 错误处理与监控 | 三层捕获 / Sentry / Source Map / Logger 分级 |

### [Part 14 — 发布与运维](Part-14-发布与运维/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch59](Part-14-发布与运维/Chapter-59-安全加固.md) | 安全加固 | 混淆 / RLS / 证书固定 / 加密 / Root 检测 / OWASP |
| [Ch60](Part-14-发布与运维/Chapter-60-多平台部署.md) | 多平台部署 | Android 签名 + AAB / iOS 证书 + TestFlight / Web / 隐私清单 |
| [Ch61](Part-14-发布与运维/Chapter-61-CICD.md) | CI/CD | GitHub Actions / Fastlane / 质量门禁 / Codemagic |
| [Ch62](Part-14-发布与运维/Chapter-62-AI开发.md) | AI 开发 | GenUI / MCP / A2UI / Gemini SDK / API Key 安全 |
| [Ch63](Part-14-发布与运维/Chapter-63-包与插件开发.md) | 包与插件开发 | Package vs Plugin / pub.dev / Semantic Versioning / npm 对照 |

### [Part 15 — 生态与结语](Part-15-生态与结语/)
| 章节 | 标题 | 核心内容 |
|------|------|---------|
| [Ch64](Part-15-生态与结语/Chapter-64-Flutter最佳实践汇总.md) | 最佳实践汇总 | Widget 规范 / 状态管理选型 / 反模式 Top 10 |
| [Ch65](Part-15-生态与结语/Chapter-65-技术栈推荐.md) | 技术栈推荐 | 核心依赖 / pubspec.yaml 模板 / 渐进式引入 |
| [Ch66](Part-15-生态与结语/Chapter-66-项目模板搭建.md) | 项目模板搭建 | Starter Template / 初始化脚本 / GitHub 模板仓库 |
| [Ch67](Part-15-生态与结语/Chapter-67-开源项目推荐.md) | 开源项目推荐 | 官方示例 / 生产级 App / 组件库 / 学习路径 |
| [Ch68](Part-15-生态与结语/Chapter-68-补充实战项目.md) | 补充实战项目 | 聊天 App / 记账 App / 天气 App |
| [Ch69](Part-15-生态与结语/Chapter-69-结语.md) | 结语 | 知识全景 / 下一步方向 / 社区参与 |

---

## 附录

| 附录 | 说明 | 适用人群 |
|------|------|---------|
| [附录 A — Effective Dart 核心摘要](Appendix-A-Effective-Dart核心摘要.md) | Dart 编码规范速查 | 所有读者 |
| [附录 B — Flutter CLI 命令速查](Appendix-B-Flutter-CLI命令速查.md) | flutter 命令行参考 | 所有读者 |
| [附录 C — Dart 核心库速查](Appendix-C-Dart核心库速查.md) | dart:core/async/convert/math/io API | 所有读者 |
| [附录 D — TypeScript 开发者 Dart 速查](Appendix-D-TypeScript开发者Dart速查.md) | TS → Dart 语法对照 | TS/JS 背景 |
| [附录 E — Vue 开发者 Flutter 概念映射](Appendix-E-Vue开发者Flutter概念映射.md) | Vue SFC/响应式/路由 → Flutter 对照 | Vue 背景 |
