# 第 66 章：项目开发模板搭建

## 0. 本章目标

- 从零搭建一个可直接复用的 Flutter Starter Template
- 掌握模板应包含的通用能力和预设页面
- 学会使用 GitHub 模板仓库加速新项目启动

> 🎯 **本章产出**：一个生产级 Flutter Starter Template 项目目录和初始化脚本。

---

## 1. Starter Template 应包含什么

一个好的模板让你在 `git clone` 后 5 分钟内开始写业务代码，而不是花 2 小时搭架子。

### 必备能力清单

| 能力 | 依赖 | 说明 |
|------|------|------|
| M3 主题（light/dark/system） | 内置 | ThemeData + ThemeMode 切换 |
| 声明式路由 | go_router | ShellRoute + 路径参数 |
| 状态管理 | flutter_riverpod | ProviderObserver + 日志 |
| HTTP 客户端 | dio | 拦截器链（日志/Auth/错误） |
| 国际化 | flutter_localizations + intl | 中英双语（ARB） |
| 网络状态监听 | connectivity_plus | 离线提示 Banner |
| 错误边界 | 内置 ErrorWidget.builder | 全局错误捕获 |

### 预设页面

| 页面 | 用途 |
|------|------|
| SplashScreen | 启动页（初始化 + 自动跳转） |
| HomeScreen | 首页骨架（Scaffold + BottomNav） |
| SettingsScreen | 设置页（ThemeMode 切换 + 语言切换） |
| NotFoundScreen | 404 错误页 |
| ErrorScreen | 通用异常页（重试按钮） |

---

## 2. 模板目录结构

```
flutter_starter_template/
├── lib/
│   ├── main.dart
│   ├── app.dart                        # MaterialApp.router 配置
│   │
│   ├── core/
│   │   ├── theme/
│   │   │   ├── app_theme.dart          # ThemeData light/dark
│   │   │   ├── app_colors.dart         # ColorScheme 种子色
│   │   │   └── theme_provider.dart     # ThemeMode Riverpod Provider
│   │   ├── router/
│   │   │   └── app_router.dart         # GoRouter 配置
│   │   ├── network/
│   │   │   ├── dio_client.dart         # Dio 实例 + 拦截器
│   │   │   └── api_result.dart         # sealed class ApiResult<T>
│   │   ├── config/
│   │   │   └── env_config.dart         # 环境变量
│   │   └── utils/
│   │       └── extensions.dart         # 常用扩展方法
│   │
│   ├── l10n/                           # ARB 文件
│   │   ├── app_zh.arb
│   │   └── app_en.arb
│   │
│   ├── features/
│   │   ├── splash/
│   │   │   └── splash_screen.dart
│   │   ├── home/
│   │   │   └── home_screen.dart
│   │   └── settings/
│   │       └── settings_screen.dart
│   │
│   └── widgets/                        # 共享组件
│       ├── app_scaffold.dart           # 通用 Scaffold 壳
│       ├── error_view.dart             # 错误页组件
│       └── loading_view.dart           # 加载态组件
│
├── test/
│   ├── widgets/
│   │   └── app_scaffold_test.dart
│   └── core/
│       └── api_result_test.dart
│
├── assets/
│   ├── images/
│   └── fonts/
│
├── analysis_options.yaml               # Strict 配置
├── pubspec.yaml                        # 推荐依赖
├── .gitignore
└── README.md                           # 模板使用说明
```

---

## 3. 快速初始化脚本

```bash
#!/bin/bash
# create_flutter_project.sh — 一键创建基于模板的新项目

PROJECT_NAME=$1
if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: ./create_flutter_project.sh <project_name>"
  exit 1
fi

# 1. 从模板创建
flutter create --template=app $PROJECT_NAME

# 2. 复制模板文件
cp -r flutter_starter_template/lib $PROJECT_NAME/
cp flutter_starter_template/analysis_options.yaml $PROJECT_NAME/
cp flutter_starter_template/pubspec.yaml $PROJECT_NAME/
cp flutter_starter_template/.gitignore $PROJECT_NAME/

# 3. 安装依赖
cd $PROJECT_NAME
flutter pub get

# 4. 生成国际化文件
flutter gen-l10n

# 5. 初始化 Git
git init && git add . && git commit -m "chore: init from flutter_starter_template"

# 6. 验证
flutter analyze && flutter test

echo "✅ $PROJECT_NAME is ready! Open in VS Code: code ."
```

---

## 4. GitHub 模板仓库使用

1. 将模板仓库设为 GitHub Template Repository（Settings → Template repository）
2. 新项目通过 "Use this template" 创建
3. 团队维护模板仓库，及时更新依赖版本和最佳实践

---

## 本章练习

**练习 1：使用模板搭建一个新的 Flutter 项目**
- 执行本章提供的 `create_flutter_project.sh` 脚本（或手动按步骤操作）
- 成功搭建一个新项目后，验证以下内容：
  - `flutter analyze` 零错误
  - `flutter test` 全部通过
  - 目录结构与本章描述一致
- 验证标准：新项目可正常构建运行，目录结构完整，CI 配置就绪

**练习 2：自定义模板配置以适应团队需求**
- 在搭建好的项目模板基础上，根据你的偏好调整以下至少 3 项：
  - 修改 `analysis_options.yaml` 添加团队特有的 lint 规则
  - 更换状态管理方案（如从 Riverpod 改为 Bloc）
  - 添加团队常用的共享组件目录
  - 配置团队统一的 VS Code 推荐扩展（`.vscode/extensions.json`）
- 将这些变更提交到 Git，并打上 tag 作为团队定制版模板
- 验证标准：定制后的模板仍能通过 `flutter analyze && flutter test`

**练习 3：将模板发布为 GitHub Template Repository**
- 在 GitHub 上将你的定制模板仓库设为 Template Repository
- 通过 "Use this template" 创建一个新仓库，验证模板克隆流程
- 在新仓库中运行 `flutter analyze && flutter test` 确认一切正常
- 验证标准：通过模板创建的新项目可立即开始开发，无需额外配置

---

> **下一步**: [Chapter 67 — 热门开源项目推荐](./Chapter-67-开源项目推荐.md)
