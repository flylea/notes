# 第 65 章：2026 年 Flutter 技术栈推荐

## 0. 本章目标

- 了解 2026 年 Flutter 生态主流技术选型
- 获得可直接使用的生产级 pubspec.yaml 模板
- 理解渐进式依赖引入策略

> 🎯 **本章产出**：一份完整的推荐 pubspec.yaml，可复用到你的任何新项目中。

---

## 1. 核心依赖推荐清单（2026 Q2）

### 状态管理

| 推荐 | 版本 | 适用场景 |
|------|------|---------|
| **flutter_riverpod** | ^2.6.x | **本教程推荐首选** — 编译时安全、无需 BuildContext |
| riverpod_annotation | ^2.4.x | 代码生成（减少模板代码） |
| flutter_bloc | ^8.1.x | 大型企业项目、严格事件驱动架构 |

### 网络与数据

| 推荐 | 版本 | 用途 |
|------|------|------|
| **dio** | ^5.7.x | HTTP 客户端 — 拦截器链、取消、重试 |
| retrofit | ^4.4.x | 类型安全 API 定义（配合 dio） |
| json_annotation | ^4.9.x | JSON 序列化注解 |
| freezed | ^2.5.x | Union 类型 + 不可变模型代码生成 |

### 路由

| 推荐 | 版本 | 用途 |
|------|------|------|
| **go_router** | ^14.x | 官方推荐声明式路由 |

### 数据库

| 推荐 | 版本 | 用途 |
|------|------|------|
| **drift** | ^2.21.x | SQL 数据库 ORM — Stream 响应式查询 |
| shared_preferences | ^2.3.x | KV 存储 |

### 后端服务

| 推荐 | 版本 | 用途 |
|------|------|------|
| **supabase_flutter** | ^2.12.x | 开源 BaaS — PostgreSQL + Auth + Realtime |

### UI 增强

| 推荐 | 版本 | 用途 |
|------|------|------|
| cached_network_image | ^3.4.x | 网络图片缓存 |
| flutter_svg | ^2.x | SVG 渲染 |
| shimmer | ^3.x | 骨架屏加载效果 |

### 国际化

| 推荐 | 版本 | 用途 |
|------|------|------|
| flutter_localizations | SDK 内置 | 官方国际化方案 |
| intl | ^0.19.x | 消息格式、日期/数字格式化 |

### 测试

| 推荐 | 版本 | 用途 |
|------|------|------|
| mocktail | ^1.x | Mock 库（无需代码生成） |
| flutter_test | SDK 内置 | Widget 测试框架 |

---

## 2. 生产级 pubspec.yaml 模板

```yaml
name: my_flutter_app
description: A production-ready Flutter application.
version: 1.0.0+1

environment:
  sdk: ^3.5.0
  flutter: '>=3.24.0'

dependencies:
  flutter:
    sdk: flutter

  # ──── 状态管理 ────
  flutter_riverpod: ^2.6.0
  riverpod_annotation: ^2.4.0

  # ──── 路由 ────
  go_router: ^14.0.0

  # ──── 网络 ────
  dio: ^5.7.0
  retrofit: ^4.4.0
  json_annotation: ^4.9.0

  # ──── 后端服务 ────
  supabase_flutter: ^2.12.0

  # ──── 本地存储 ────
  drift: ^2.21.0
  shared_preferences: ^2.3.0

  # ──── UI ────
  cached_network_image: ^3.4.0
  shimmer: ^3.0.0

  # ──── 国际化 ────
  flutter_localizations:
    sdk: flutter
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

  # ──── 代码生成 ────
  build_runner: ^2.4.0
  riverpod_generator: ^2.4.0
  retrofit_generator: ^8.1.0
  json_serializable: ^6.8.0
  drift_dev: ^2.21.0
  freezed: ^2.5.0

  # ──── 测试 ────
  mocktail: ^1.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/fonts/
```

---

## 3. 渐进式引入策略

不要一口气加完所有依赖。按本教程的学习节奏逐步引入：

| 阶段 | 引入依赖 | 对应 Part |
|------|---------|----------|
| 起步 | `flutter` + `flutter_lints` | Part-01 |
| 界面 | 无需新增依赖（用内置 Material 组件） | Part-02 |
| 路由 | `go_router` | Part-03 |
| 网络 | `dio` + `retrofit` + `json_annotation` + `freezed` + `build_runner` | Part-04 |
| 状态管理 | `flutter_riverpod` + `riverpod_annotation` | Part-05 |
| 后端 | `supabase_flutter` | Part-04 |
| 本地存储 | `drift` + `shared_preferences` | Part-08 |
| UI 增强 | `cached_network_image` + `shimmer` | Part-09 |
| 测试 | `mocktail` | Part-11 |

---

## 4. Flutter SDK 版本策略

- **稳定版 (Stable)**: 你的主力开发版本。`flutter channel stable && flutter upgrade`
- **每 3 个月升级一次 Flutter SDK**：太频繁容易踩坑，太久会积累大量 breaking changes
- **升级前**：阅读 [Flutter 发布说明](https://docs.flutter.dev/release/release-notes) 的 breaking changes 部分
- **升级后**：`flutter clean && flutter pub get && flutter analyze && flutter test`

---

## 本章练习

**练习 1：为你的 Flutter 项目选择并记录技术栈**
- 参考本章推荐的技术栈表格，为 Library App（或你的个人项目）选型并记录到 `TECH_STACK.md`
- 覆盖以下维度：路由、网络、状态管理、后端/数据存储、本地存储、UI 增强、测试
- 对每个选择写明理由（为什么选这个而不是其他替代方案）
- 验证标准：`TECH_STACK.md` 文件存在，覆盖 7 个维度，每个选择有理由说明

**练习 2：技术栈版本对齐检查**
- 检查 Library App 的 `pubspec.yaml` 中所有依赖版本是否与本章推荐一致
- 使用 `dart pub outdated` 查看是否有可升级的包
- 选择其中一个包进行升级，运行 `flutter analyze && flutter test` 验证兼容性
- 验证标准：依赖版本与推荐基本一致，升级后项目编译和测试均通过

**练习 3：技术栈定制化——替换一个依赖**
- 在 Library App 中选择一个现有依赖（如图片缓存库或本地存储库），用本章推荐的替代方案替换
- 完成迁移（修改 `pubspec.yaml`、更新导入路径、调整 API 调用）
- 运行全部测试确保功能不受影响
- 验证标准：替换后所有测试通过，完成一份简短的迁移报告（新的 API 差异和注意事项）

---

> 📖 **延伸阅读**: [pub.dev — Dart/Flutter 包仓库](https://pub.dev) | [Flutter 官方推荐包 — flutter.dev/packages-and-plugins](https://flutter.dev/packages-and-plugins)
