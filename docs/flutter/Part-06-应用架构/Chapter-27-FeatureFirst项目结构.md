> **Part**: Part VI — 应用架构
> **上一章**: [Chapter 26 — 依赖注入](./Chapter-26-依赖注入.md)
> **下一章**: [Part VII — 用户与权限系统（Chapter 28）](../Part-07-用户与权限系统/)
> **官方文档**: [flutter.cn/app-architecture/guide](https://docs.flutter.cn/app-architecture/guide) (project structure) | [dart.cn/effective-dart](https://dart.cn/effective-dart)

---

# 第 27 章：Feature-First 项目结构与代码规范

## 0. 本章目标

掌握 Feature-first vs Layer-first 目录结构选择、标准 Feature 模块内结构、公共层 core/ 设计、Effective Dart 核心规则、barrel files 导出管理。

> 🎯 **Library App 产出**：按 Feature 重组目录（books/auth/borrowing/search/profile/admin）、统一 core/ 公共层、完善 Lint 配置。

---

## 1. Feature-First vs Layer-First

```
❌ Layer-First（按技术层分）：             ✅ Feature-First（按业务功能分）：
lib/                                      lib/
├── screens/    (所有页面混在一起)          ├── core/        (跨功能公共基础设施)
├── models/     (所有模型混在一起)          └── features/
├── providers/  (所有 Provider 混在一起)        ├── books/
├── services/   (所有服务混在一起)              │   ├── screens/
└── widgets/    (所有组件混在一起)              │   ├── view_models/
         ↑                                     │   ├── models/
    改一个功能需要跳 5 个目录                    │   └── widgets/
                                               │   ├── auth/
                                               │   │   ├── screens/
                                               │   │   ├── view_models/
                                               │   │   └── services/
                                               │   └── borrow/
```

**Feature-First 优势**：改一个功能所有文件在同一个目录下，删除一个功能只需删除一个目录。

---

## 2. 标准 Feature 模块内部结构

```dart
// features/books/ 目录结构
books/
├── screens/              // 页面 Widget
│   ├── book_list_page.dart
│   └── book_detail_page.dart
├── view_models/          // AsyncNotifier
│   ├── book_list_view_model.dart
│   └── book_detail_view_model.dart
├── models/               // 功能专属的 UI State（freezed）
│   └── book_ui_state.dart
├── widgets/              // 功能专属的 UI 组件
│   ├── book_card.dart
│   └── book_search_bar.dart
└── repositories/         // （可选）功能专属的 Repository 实现
```

## 3. core/ 公共层设计

```dart
lib/core/
├── config/               // 环境配置 + 常量
│   └── app_config.dart
├── di/                   // 依赖注入声明
│   ├── providers.dart    // 全局 Provider
│   └── app_services.dart // get_it 注册
├── network/              // 网络层
│   ├── dio_client.dart
│   └── api/              // Retrofit 接口
├── router/               // GoRouter 配置
│   └── app_router.dart
├── supabase/             // Supabase 客户端
│   ├── client.dart
│   ├── auth_service.dart
│   └── storage_service.dart
├── state/                // 通用状态工具
│   ├── async_state.dart
│   └── async_state_widget.dart
├── theme/                // 主题配置
│   └── app_theme.dart
├── responsive/           // 响应式断点
│   └── breakpoints.dart
├── accessibility/        // 无障碍工具
│   └── semantics_labels.dart
├── error/                // 错误处理
│   └── error_handler.dart
└── extensions/           // Dart 扩展方法
    ├── context_extensions.dart
    └── string_extensions.dart
```

## 4. Barrel Files 导出管理

```dart
// features/books/models/models.dart
export 'book.dart';
export 'book_ui_state.dart';

// features/books/books.dart（Feature 总导出）
export 'models/models.dart';
export 'screens/book_list_page.dart';
export 'screens/book_detail_page.dart';
export 'view_models/book_list_view_model.dart';

// 其他 Feature 引用时：
import 'package:library_app/features/books/books.dart';
```

## 5. Lint 配置补充

```yaml
# analysis_options.yaml 补充规则
linter:
  rules:
    - avoid_dynamic_calls
    - avoid_unnecessary_containers
    - prefer_expression_function_bodies
    - use_super_parameters
    - conditional_uri_does_not_exist
    - no_leading_underscores_for_library_prefixes
```

---

## 6. 重构后的完整目录

```
lib/
├── main.dart
├── app.dart
├── core/                  (公共基础设施，11 个子目录)
└── features/
    ├── books/             (图书浏览——列表/详情/搜索)
    ├── auth/              (认证——登录/注册/忘记密码)
    ├── borrow/            (借阅——借书/还书/历史)
    ├── admin/             (管理——图书管理/用户管理)
    └── profile/           (个人——设置/偏好)
```

---

> **下一步**: [Part VII — 用户与权限系统](../Part-07-用户与权限系统/)
> **原始文档**: [flutter.cn/app-architecture/guide](https://docs.flutter.cn/app-architecture/guide)
