# 第 67 章：热门开源项目推荐与学习路径

## 0. 本章目标

- 了解 Flutter 生态中最值得学习的开源项目
- 获得不同背景的个性化学习路径
- 掌握阅读 Flutter 源码的方法

---

## 1. 官方精品示例

| 项目 | 学习重点 | 仓库 |
|------|---------|------|
| **Wonderous** | 动画标杆 — 隐式/显式/交错动画、自定义转场、Hero 动画 | [gskinner/wonderous](https://github.com/gskinnerTeam/flutter-wonderous-app) |
| **Flutter Gallery** | 组件目录 — 所有 Material 组件的交互式展示 | [flutter/gallery](https://github.com/flutter/gallery) |
| **Flokk** | 设计参考 — 精美的联系人管理应用、暗黑模式设计 | [gskinner/flokk](https://github.com/gskinnerTeam/flokk) |
| **Compass App** | 架构参考 — Google 官方多模块 Flutter 架构示例 | [flutter/samples](https://github.com/flutter/samples) |

---

## 2. 生产级开源 Flutter App

| 项目 | 描述 | 推荐理由 |
|------|------|---------|
| **AppFlowy** | Notion 替代（Rust+Flutter） | 大型 Flutter 项目的架构级参考、插件系统设计、富文本编辑 |
| **spot** | Spotify 客户端 | 清晰的 MVVM 架构、音频播放、网络状态管理 |
| **Immich** | Google Photos 替代 | 图片管理、后台同步、多端交互 |
| **LocalSend** | AirDrop 替代 | 局域网设备发现、文件传输、极简 UI |
| **Invoice Ninja** | 发票管理 | 完整的业务应用参考、Supabase 集成、权限控制 |
| **FlutterFire** | Firebase 官方插件集合 | 每个 Flutter 开发者必备 |

---

## 3. UI 组件库

| 库 | 风格 | 用途 |
|----|------|------|
| **fluent_ui** | Windows Fluent Design | Windows 桌面应用 |
| **macos_ui** | macOS Aqua Design | macOS 桌面应用 |
| **shadcn_flutter** | shadcn 风格 | 现代化 Web/移动 UI |
| **forui** | 极简设计系统 | 快速原型 |
| **mix** | 设计令牌系统 | 可编程的设计令牌 |

---

## 4. 学习资源

| 资源 | 说明 |
|------|------|
| [Flutter 官方博客](https://medium.com/flutter) | 技术文章、版本发布说明 |
| [Flutter YouTube](https://www.youtube.com/@flutterdev) | Widget of the Week、官方教程 |
| [Flutter 周报](https://flutterweekly.net) | 每周精选文章和包更新 |
| [pub.dev](https://pub.dev) | 包仓库——按 likes/pub points 排序找高质量包 |
| [dart.cn](https://dart.cn) | Dart 官方中文文档 |
| [flutter.cn](https://flutter.cn) | Flutter 中文社区文档 |

---

## 5. 源码阅读路径

从浅入深阅读 Flutter Framework 源码：

```
1. packages/flutter/lib/src/widgets/basic.dart
   → Text, Image, Icon, Container 等基础 Widget 的实现
   
2. packages/flutter/lib/src/widgets/framework.dart
   → Widget/Element/RenderObject 核心体系
   
3. packages/flutter/lib/src/rendering/object.dart
   → 渲染管线：layout → paint → hit test
   
4. packages/flutter/lib/src/material/
   → Material Design 组件实现（Scaffold, AppBar, Button...）
```

---

## 6. 不同背景的学习路径

| 背景 | 推荐路径 |
|------|---------|
| **React/TS 开发者** | Dart 速查（附录D） → Widget = Component 对照 → Provider = Context 对照 → Riverpod |
| **Android 原生** | Widget = View 对照 → Layout = ViewGroup 对照 → 生命周期差异 → Flutter 平台通道 |
| **iOS 原生** | Widget = UIView 对照 → 约束 vs 自动布局 → SwiftUI 声明式对照 → Flutter 平台通道 |
| **Vue 开发者** | Widget = 组件对照 → 状态管理对照（Vuex/Pinia → Riverpod）→ 路由对照 |
| **全栈开发者** | 从 Part-04 网络+Part-05 状态管理入手 → 再回头补 Part-02 界面基础 |
| **零移动端经验** | 严格跟教程顺序，不要跳 Part。每个独立练习都认真完成 |

---

## 本章练习

**练习 1：浏览 Flutter 官方仓库的源码结构**
- 克隆 `flutter/flutter` 仓库，浏览 `packages/flutter/lib/src/material/` 目录
- 选择一个你常用的 Widget（如 `Scaffold`、`AppBar` 或 `TextField`），阅读其源码实现
- 记录至少 3 个源码中学到的设计模式或实现技巧
- 验证标准：能用自己的话解释所选 Widget 的核心实现逻辑，并写一段 100 字以内的源码阅读笔记

**练习 2：研究一个社区开源 Flutter 项目的架构**
- 从本章推荐的开源项目中任选一个（如 `gallery`、`FlutterUnit` 或 `flutter_deer`）
- 克隆项目并分析其架构：目录结构、状态管理方案、路由设计、网络层封装
- 将分析与 Library App 的架构进行对比，列出 3 个值得借鉴的设计决策
- 验证标准：完成一份简洁的架构对比笔记，包含至少 3 个可迁移到 Library App 的改进点

**练习 3：为开源项目贡献一个小修复**
- 在 GitHub 上搜索 `label:good-first-issue` 的 Flutter 相关开源项目
- 选择一个适合初学者的问题，Fork 仓库并尝试修复
- 按项目贡献指南提交 Pull Request
- 验证标准：PR 符合项目规范（或即使未被合并，也完成了一次完整的开源贡献流程）

---

> **下一步**: [Chapter 68 — 补充实战项目](./Chapter-68-补充实战项目.md)
