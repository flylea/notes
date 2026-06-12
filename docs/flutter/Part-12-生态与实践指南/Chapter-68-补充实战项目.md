# 第 68 章：补充实战项目

## 0. 本章目标

Library App 覆盖了 CRUD、认证、离线、推送等核心场景。本章提供 3 个补充项目，覆盖 Library App 未涉及的重要概念，每个项目预计 1-2 天完成。

---

## 项目 1：聊天 App（Chatter）

**核心能力**：WebSocket 实时通信、文件上传、推送通知

### 功能需求

- [ ] 用户登录（Supabase Auth，复用 Library App 的认证模块）
- [ ] 联系人列表（Supabase 数据库）
- [ ] 一对一实时聊天（Supabase Realtime Channel）
- [ ] 发送图片消息（文件上传到 Supabase Storage）
- [ ] 消息推送通知（FCM + Edge Function 触发）
- [ ] 聊天记录本地缓存（Drift 离线消息）

### 推荐技术栈

```
状态管理: Riverpod
路由: go_router
实时通信: Supabase Realtime (WebSocket)
文件存储: Supabase Storage
推送: FCM + flutter_local_notifications
本地缓存: Drift
```

### 架构建议

```
lib/features/chat/
├── data/
│   └── chat_repository.dart       # 消息 CRUD
├── domain/
│   └── message.dart               # 消息模型
├── presentation/
│   ├── chat_list_screen.dart      # 会话列表
│   ├── chat_screen.dart           # 聊天界面
│   └── widgets/
│       ├── message_bubble.dart    # 消息气泡
│       └── image_picker_button.dart
└── providers/
    └── chat_provider.dart         # Riverpod Provider
```

---

## 项目 2：记账 App（Pennywise）

**核心能力**：本地数据库、图表可视化、数据导出

### 功能需求

- [ ] 收入/支出记录（类别、金额、日期、备注）
- [ ] 月度统计图表（fl_chart 饼图 + 柱状图）
- [ ] 分类预算管理与超支提醒
- [ ] 数据导出为 CSV（file_saver + share_plus）
- [ ] 深色/浅色主题（Material 3）
- [ ] 本地备份与恢复

### 推荐技术栈

```
本地数据库: Drift (SQLite)
图表: fl_chart
文件导出: csv + share_plus
```

### 核心学习点

- Drift 的复杂查询（GROUP BY、SUM、WHERE 组合）
- 响应式图表（Stream 驱动 fl_chart 数据源）
- CSV 序列化/反序列化

---

## 项目 3：天气 App（SkyCast）

**核心能力**：公开 API 接入、位置服务、响应式设计

### 功能需求

- [ ] 获取当前位置天气（geolocator + OpenWeatherMap API）
- [ ] 城市搜索与切换
- [ ] 5 天预报（天气预报列表）
- [ ] 天气动画（Lottie 或 Rive 动画）
- [ ] 响应式布局（手机竖屏紧凑 / 平板横屏两栏）
- [ ] 天气数据本地缓存（SharedPreferences 缓存最近查询）

### 推荐技术栈

```
网络: Dio + Retrofit
位置: geolocator
动画: lottie
响应式: LayoutBuilder + Breakpoint
```

### 核心学习点

- 公开 REST API 的接入与错误处理
- 位置权限管理（Android + iOS）
- 响应式断点系统（手机 vs 平板）

---

## 三个项目的学习覆盖对比

| 概念 | Library App | 聊天 App | 记账 App | 天气 App |
|------|:--:|:--:|:--:|:--:|
| CRUD | ✅ | ✅ | ✅ | ✅ |
| 认证 | ✅ | ✅ | — | — |
| WebSocket/实时 | — | ✅ | — | — |
| 文件上传 | — | ✅ | — | — |
| 图表可视化 | — | — | ✅ | — |
| 数据导出 | — | — | ✅ | — |
| 位置服务 | — | — | — | ✅ |
| 动画 | ✅ | — | — | ✅ |
| 响应式布局 | ✅ | — | — | ✅ |
| 离线缓存 | ✅ | ✅ | ✅ | ✅ |

**建议顺序**：从你感兴趣的项目开始。全部 3 个都完成后，你将在所有核心 Flutter 场景中拥有实战经验。

---

## 本章练习

**练习 1：从补充项目中选择一个并启动开发**
- 从聊天 App、记账 App、天气 App 三个项目中选择一个你最感兴趣的
- 阅读对应项目目录（`apps/` 下）的 `README.md`，了解项目目标和功能列表
- 搭建项目骨架：初始化 Flutter 项目、配置 `pubspec.yaml`、创建基础目录结构
- 验证标准：项目可通过 `flutter run` 启动，至少显示一个空白主页

**练习 2：实现第一个核心功能**
- 根据所选项目的功能列表，挑选一个相对独立的基础功能进行实现
  - 聊天 App：实现消息列表 UI 和文本消息发送
  - 记账 App：实现一笔收支记录的添加和列表展示
  - 天气 App：实现城市搜索和当前天气展示
- 遵循 Library App 中已建立的架构模式（Riverpod + Repository + freezed 模型）
- 验证标准：功能运行正常，`flutter analyze` 零错误，编写至少 2 个 Widget 测试

**练习 3：规划全栈学习路线并制定完成计划**
- 对照本章的"三个项目的学习覆盖对比"表格，评估你当前已掌握和尚未掌握的技能
- 为所选项目制定完成计划：分解为 10-15 个开发任务，预估每个任务的学习重点
- 将计划写入项目根目录的 `ROADMAP.md` 文件中
- 验证标准：`ROADMAP.md` 包含完整的任务分解、技能映射和预估时间

---

> **下一步**: [Chapter 69 — 结语](../Part-11-质量工程与发布/Chapter-69-结语.md)
