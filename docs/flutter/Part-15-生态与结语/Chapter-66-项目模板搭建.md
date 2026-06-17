# 第 66 章：项目开发模板搭建

## 0. 本章目标

- 从零搭建一个可直接复用的 Flutter Starter Template
- 掌握模板应包含的通用能力和预设页面
- 学会使用 GitHub 模板仓库加速新项目启动
- 配置 VSCode/Android Studio 开发环境
- 使用 Docker 搭建一致性的开发环境

> 🎯 **本章产出**：一个生产级 Flutter Starter Template 项目目录、完整初始化脚本、Docker 开发环境配置。

---

## 1. Starter Template 应包含什么

一个好的模板让你在 `git clone` 后 5 分钟内开始写业务代码，而不是花 2 小时搭架子。

### 必备能力清单

| 能力 | 依赖 | 说明 |
|------|------|------|
| M3 主题（light/dark/system） | 内置 | ThemeData + ThemeMode 切换 |
| 声明式路由 | go_router | ShellRoute + 路径参数 + 路由守卫 |
| 状态管理 | flutter_riverpod | ProviderObserver 全局日志 |
| HTTP 客户端 | dio | 拦截器链（日志/Auth/错误） |
| 国际化 | flutter_localizations + intl | 中英双语（ARB） |
| 网络状态监听 | connectivity_plus | 离线提示 Banner |
| 错误边界 | 内置 ErrorWidget.builder | 全局错误捕获 |
| 环境变量管理 | --dart-define | 多环境配置 |
| 日志系统 | logger | 分级日志输出 |

### 预设页面

| 页面 | 路由 | 用途 |
|------|------|------|
| SplashScreen | `/` | 启动页（初始化 + 自动跳转） |
| HomeScreen | `/:tab` | 首页骨架（Scaffold + BottomNav） |
| SettingsScreen | `/settings` | 设置页（ThemeMode + 语言切换） |
| NotFoundScreen | `/*` | 404 错误页 |
| ErrorScreen | 内嵌 | 通用异常页（重试按钮） |

---

## 2. 模板目录结构

```
flutter_starter_template/
├── lib/
│   ├── main.dart                          # 入口：ProviderScope + App
│   ├── app.dart                           # MaterialApp.router 配置
│   │
│   ├── core/
│   │   ├── theme/
│   │   │   ├── app_theme.dart             # ThemeData light/dark
│   │   │   ├── app_colors.dart            # ColorScheme 种子色
│   │   │   └── theme_provider.dart        # ThemeMode Riverpod Provider
│   │   ├── router/
│   │   │   └── app_router.dart            # GoRouter 配置
│   │   ├── network/
│   │   │   ├── dio_client.dart            # Dio 实例 + 拦截器
│   │   │   └── api_result.dart            # sealed class ApiResult<T>
│   │   ├── config/
│   │   │   └── env_config.dart            # 环境变量
│   │   └── utils/
│   │       ├── extensions.dart            # 常用扩展方法
│   │       └── logger.dart                # 日志工具
│   │
│   ├── l10n/                              # ARB 文件
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
│   └── widgets/                           # 共享组件
│       ├── app_scaffold.dart              # 通用 Scaffold 壳
│       ├── error_view.dart                # 错误页组件
│       ├── loading_view.dart              # 加载态组件
│       └── offline_banner.dart            # 离线提示横幅
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
├── scripts/
│   ├── setup.sh                           # 一键初始化脚本
│   └── quality_check.sh                   # 质量检查脚本
│
├── docker/
│   └── Dockerfile                         # Docker 开发环境
│
├── .vscode/
│   ├── settings.json                      # VSCode 项目配置
│   ├── launch.json                        # 调试配置
│   └── extensions.json                    # 推荐扩展
│
├── .github/
│   └── workflows/
│       └── ci.yml                         # GitHub Actions CI
│
├── analysis_options.yaml                  # Strict 配置
├── pubspec.yaml                           # 推荐依赖
├── .gitignore
├── .env.example                           # 环境变量模板
└── README.md                              # 模板使用说明
```

---

## 3. 核心代码实现

### 3.1 环境变量管理

```dart
// lib/core/config/env_config.dart
class EnvConfig {
  static const String appName = String.fromEnvironment('APP_NAME', defaultValue: 'My App');
  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL');
  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static bool get isProduction =>
      const bool.fromEnvironment('IS_PRODUCTION', defaultValue: false);

  static T Function<T>({required String env, required T production, required T staging})
      get byEnv => (isProduction) ? production : staging;
}

// 使用处
final apiUrl = EnvConfig.byEnv(
  production: 'https://api.example.com',
  staging: 'https://staging-api.example.com',
);
```

### 3.2 全局日志 ProviderObserver

```dart
// lib/core/utils/logger.dart
import 'package:logger/logger.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final loggerProvider = Provider<Logger>((ref) {
  return Logger(
    printer: PrettyPrinter(
      methodCount: 2,
      errorMethodCount: 8,
      lineLength: 120,
      colors: true,
      printEmojis: true,
    ),
  );
});

class AppProviderObserver extends ProviderObserver {
  final Logger _logger = Logger();

  @override
  void didUpdateProvider(ProviderBase provider, Object? previousValue, Object? newValue, ProviderContainer container) {
    if (newValue is AsyncError) {
      _logger.e('Provider ${provider.name ?? provider.runtimeType} error', error: newValue.error);
    }
  }

  @override
  void didDisposeProvider(ProviderBase provider) {
    _logger.d('Provider ${provider.name ?? provider.runtimeType} disposed');
  }
}
```

### 3.3 ApiResult 密封类

```dart
// lib/core/network/api_result.dart
import 'package:freezed_annotation/freezed_annotation.dart';
part 'api_result.freezed.dart';

@freezed
sealed class ApiResult<T> with _$ApiResult<T> {
  const factory ApiResult.success(T data) = _Success<T>;
  const factory ApiResult.failure(String message, {int? statusCode}) = _Failure<T>;
  const factory ApiResult.loading() = _Loading<T>;

  bool get isSuccess => this is _Success<T>;
  bool get isFailure => this is _Failure<T>;
  bool get isLoading => this is _Loading<T>;

  T? get dataOrNull => this is _Success<T> ? (this as _Success<T>).data : null;
  String? get errorOrNull => this is _Failure<T> ? (this as _Failure<T>).message : null;

  R when<R>({
    required R Function(T data) success,
    required R Function(String message, int? statusCode) failure,
    required R Function() loading,
  }) {
    return switch (this) {
      _Success(:final data) => success(data),
      _Failure(:final message, :final statusCode) => failure(message, statusCode),
      _Loading() => loading(),
    };
  }
}
```

### 3.4 Dio 客户端

```dart
// lib/core/network/dio_client.dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/env_config.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: EnvConfig.apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
    headers: {'Content-Type': 'application/json'},
  ));

  dio.interceptors.addAll([
    _AuthInterceptor(),
    _ErrorInterceptor(),
    LogInterceptor(
      requestBody: true,
      responseBody: true,
      logPrint: (obj) => ref.read(loggerProvider).d(obj),
    ),
  ]);

  return dio;
});

class _AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // 从安全存储读取 token
    // final token = await secureStorage.read('token');
    // if (token != null) {
    //   options.headers['Authorization'] = 'Bearer $token';
    // }
    handler.next(options);
  }
}

class _ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    switch (err.response?.statusCode) {
      case 401:
        // Token 过期 → 跳转登录页
        break;
      case 403:
        // 无权限
        break;
      case 500:
        // 服务器错误
        break;
    }
    handler.next(err);
  }
}
```

### 3.5 GoRouter 配置

```dart
// lib/core/router/app_router.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/splash/splash_screen.dart';
import '../../features/home/home_screen.dart';
import '../../features/settings/settings_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    debugLogDiagnostics: true,
    routes: [
      GoRoute(
        path: '/',
        builder: (_, __) => const SplashScreen(),
      ),
      ShellRoute(
        builder: (_, __, child) => AppScaffold(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (_, __) => const HomeScreen(),
          ),
          GoRoute(
            path: '/settings',
            builder: (_, __) => const SettingsScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (_, state) => NotFoundScreen(error: state.error),
  );
});
```

### 3.6 入口 main.dart

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(
    ProviderScope(
      observers: [AppProviderObserver()],
      child: const FlutterStarterApp(),
    ),
  );
}
```

### 3.7 app.dart

```dart
// lib/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'l10n/app_localizations.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class FlutterStarterApp extends ConsumerWidget {
  const FlutterStarterApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'Flutter Starter',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('zh'),
        Locale('en'),
      ],
    );
  }
}
```

---

## 4. 完整的初始化脚本

### 4.1 setup.sh

```bash
#!/usr/bin/env bash
# scripts/setup.sh — 一键初始化 Flutter Starter 项目
set -euo pipefail

PROJECT_NAME="${1:-}"
if [ -z "$PROJECT_NAME" ]; then
    echo "用法: ./scripts/setup.sh <project_name>"
    echo "示例: ./scripts/setup.sh my_awesome_app"
    exit 1
fi

echo "🚀 正在创建 Flutter 项目: $PROJECT_NAME"

# ──── 第 1 步：使用 Flutter 创建项目 ────
flutter create \
    --org com.example \
    --project-name "$PROJECT_NAME" \
    --platforms android,ios,web,macos,linux,windows \
    "$PROJECT_NAME"

# ──── 第 2 步：复制模板文件 ────
TEMPLATE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="$(pwd)/$PROJECT_NAME"

echo "📁 复制模板文件..."

# 复制 lib 目录
cp -r "$TEMPLATE_DIR/lib/" "$TARGET_DIR/lib/"
# 复制 test 目录
cp -r "$TEMPLATE_DIR/test/" "$TARGET_DIR/test/"
# 复制 assets
mkdir -p "$TARGET_DIR/assets/images" "$TARGET_DIR/assets/fonts" "$TARGET_DIR/assets/animations"

# 复制配置文件
cp "$TEMPLATE_DIR/analysis_options.yaml" "$TARGET_DIR/"
cp "$TEMPLATE_DIR/pubspec.yaml" "$TARGET_DIR/"
cp "$TEMPLATE_DIR/.gitignore" "$TARGET_DIR/"
cp "$TEMPLATE_DIR/.env.example" "$TARGET_DIR/.env"

# 复制 VSCode 配置
mkdir -p "$TARGET_DIR/.vscode"
cp "$TEMPLATE_DIR/.vscode/"* "$TARGET_DIR/.vscode/"

# 复制 CI 配置
mkdir -p "$TARGET_DIR/.github/workflows"
cp "$TEMPLATE_DIR/.github/workflows/ci.yml" "$TARGET_DIR/.github/workflows/"

# 复制脚本
mkdir -p "$TARGET_DIR/scripts"
cp "$TEMPLATE_DIR/scripts/quality_check.sh" "$TARGET_DIR/scripts/"

# 复制 Docker 配置
mkdir -p "$TARGET_DIR/docker"
cp "$TEMPLATE_DIR/docker/Dockerfile" "$TARGET_DIR/docker/"

# ──── 第 3 步：替换项目名 ────
echo "🔧 替换项目名占位符..."
cd "$TARGET_DIR"
sed -i "s/my_flutter_app/$PROJECT_NAME/g" pubspec.yaml
sed -i "s/Flutter Starter/$PROJECT_NAME/g" README.md

# ──── 第 4 步：初始化 Git ────
echo "📦 初始化 Git 仓库..."
git init
git checkout -b main 2>/dev/null || git checkout -b master

# ──── 第 5 步：安装依赖 ────
echo "📥 安装 Flutter 依赖..."
flutter pub get

# ──── 第 6 步：生成国际化文件 ────
echo "🌐 生成国际化文件..."
flutter gen-l10n

# ──── 第 7 步：初始化 Git 并首次提交 ────
git add .
git commit -m "chore: init from flutter_starter_template" --no-verify

# ──── 第 8 步：验证 ────
echo "✅ 运行代码检查..."
flutter analyze --no-fatal-infos --no-fatal-warnings 2>/dev/null && echo "✅ analyze 通过" || echo "⚠️  analyze 有警告，请检查"

echo "🧪 运行测试..."
flutter test 2>/dev/null && echo "✅ 测试通过" || echo "⚠️  测试未完全通过，请检查"

# ──── 完成 ────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ $PROJECT_NAME 初始化完成！"
echo ""
echo "  下一步："
echo "    1. cd $TARGET_DIR"
echo "    2. 编辑 .env 填入你的 Supabase 凭据"
echo "    3. flutter run"
echo "    4. 开始写业务代码！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

### 4.2 quality_check.sh

```bash
#!/usr/bin/env bash
# scripts/quality_check.sh — 项目质量检查脚本
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 开始 Flutter 代码质量检查..."
echo ""

# ─── 1. 代码分析 ───
echo "📋 1/4 flutter analyze..."
if flutter analyze; then
    echo -e "${GREEN}✅ 代码分析通过${NC}"
else
    echo -e "${RED}❌ 代码分析发现问题${NC}"
    exit 1
fi
echo ""

# ─── 2. 单元测试 ───
echo "🧪 2/4 flutter test --coverage..."
if flutter test --coverage; then
    echo -e "${GREEN}✅ 测试全部通过${NC}"
else
    echo -e "${RED}❌ 测试失败${NC}"
    exit 1
fi
echo ""

# ─── 3. 代码格式化检查 ───
echo "🎨 3/4 dart format --set-exit-if-changed..."
if dart format --set-exit-if-changed lib/ test/; then
    echo -e "${GREEN}✅ 代码格式规范${NC}"
else
    echo -e "${YELLOW}⚠️  代码格式需要修正，请运行: dart format lib/ test/${NC}"
    exit 1
fi
echo ""

# ─── 4. 依赖审计 ───
echo "📦 4/4 dart pub outdated..."
dart pub outdated
echo ""

# ─── 覆盖率检查 ───
COVERAGE_FILE="coverage/lcov.info"
if [ -f "$COVERAGE_FILE" ]; then
    # 计算行覆盖率
    COVERAGE=$(grep -oP 'LF:\K\d+' "$COVERAGE_FILE" | head -1)
    COVERED=$(grep -oP 'LH:\K\d+' "$COVERAGE_FILE" | head -1)
    if [ -n "$COVERAGE" ] && [ -n "$COVERED" ] && [ "$COVERAGE" -gt 0 ]; then
        PERCENT=$((COVERED * 100 / COVERAGE))
        THRESHOLD=75
        if [ "$PERCENT" -ge "$THRESHOLD" ]; then
            echo -e "${GREEN}✅ 覆盖率: ${PERCENT}% (阈值: ${THRESHOLD}%)${NC}"
        else
            echo -e "${RED}❌ 覆盖率: ${PERCENT}% 低于阈值 ${THRESHOLD}%${NC}"
            exit 1
        fi
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 代码质量检查全部通过！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

## 5. VSCode 开发环境配置

### 5.1 settings.json

```json
{
  "dart.flutterSdkPath": ".fvm/flutter_sdk",
  "dart.lineLength": 120,
  "dart.showTodos": true,
  "dart.closingLabels": true,
  "dart.previewFlutterUiGuides": true,
  "dart.previewFlutterUiGuidesCustomTracking": true,

  "editor.codeActionsOnSave": {
    "source.fixAll": "explicit",
    "source.organizeImports": "explicit"
  },

  "[dart]": {
    "editor.formatOnSave": true,
    "editor.formatOnType": true,
    "editor.rulers": [120],
    "editor.selectionHighlight": false,
    "editor.suggest.snippetsPreventQuickSuggestions": false,
    "editor.suggestSelection": "first",
    "editor.tabCompletion": "onlySnippets",
    "editor.wordBasedSuggestions": "off"
  },

  "[yaml]": {
    "editor.formatOnSave": true,
    "editor.tabSize": 2
  },

  "[json]": {
    "editor.formatOnSave": true
  },

  "files.exclude": {
    "**/.dart_tool": true,
    "**/.packages": true,
    "**/build": true,
    "**/.flutter-plugins*": true,
    "**/.pub": true,
    "**/.fvm": false
  },

  "search.exclude": {
    "**/.dart_tool": true,
    "**/build": true,
    "**/coverage": true,
    "**/*.g.dart": true,
    "**/*.freezed.dart": true
  }
}
```

### 5.2 launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Flutter (Debug)",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart",
      "args": [
        "--dart-define=API_BASE_URL=https://api.example.com",
        "--dart-define=IS_PRODUCTION=false"
      ]
    },
    {
      "name": "Flutter (Profile)",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart",
      "flutterMode": "profile"
    },
    {
      "name": "Flutter (Release)",
      "type": "dart",
      "request": "launch",
      "program": "lib/main.dart",
      "flutterMode": "release"
    },
    {
      "name": "All Tests",
      "type": "dart",
      "request": "launch",
      "program": "./test/"
    },
    {
      "name": "Current Test File",
      "type": "dart",
      "request": "launch",
      "program": "${file}"
    }
  ]
}
```

### 5.3 extensions.json

```json
{
  "recommendations": [
    "dart-code.dart-code",
    "dart-code.flutter",
    "localizely.flutter-intl",
    "felixangelov.bloc",
    "robert-brunhage.flutter-riverpod-snippets",
    "ryanluker.vscode-coverage-gutters",
    "usernamehw.errorlens",
    "gruntfuggly.todo-tree"
  ],
  "unwantedRecommendations": [
    "dart-code.old-dart-code"
  ]
}
```

---

## 6. Docker 开发环境

### 6.1 Dockerfile

```dockerfile
# docker/Dockerfile
FROM ubuntu:24.04

ENV FLUTTER_HOME=/opt/flutter
ENV PATH="$FLUTTER_HOME/bin:$PATH"
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    curl git unzip xz-utils zip libglu1-mesa \
    clang cmake ninja-build pkg-config \
    libgtk-3-dev liblzma-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Flutter SDK
ARG FLUTTER_VERSION=3.24.3
RUN git clone --depth 1 --branch ${FLUTTER_VERSION} \
    https://github.com/flutter/flutter.git ${FLUTTER_HOME} \
    && flutter config --no-analytics \
    && flutter precache \
    && flutter doctor

# 安装 Android SDK (仅构建用)
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
    && curl -fsSL -o /tmp/cmdline-tools.zip \
       https://dl.google.com/android/repository/commandlinetools-linux-latest.zip \
    && unzip /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools \
    && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
    && yes | sdkmanager --licenses \
    && sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"

WORKDIR /app

# 默认保持容器运行
CMD ["/bin/bash"]
```

### 6.2 docker-compose.yml

```yaml
version: '3.8'

services:
  flutter_dev:
    build:
      context: .
      dockerfile: docker/Dockerfile
    container_name: flutter_dev
    volumes:
      - .:/app
      - flutter_cache:/opt/flutter/.pub-cache
    ports:
      - "8080:8080"    # flutter run -d web-server
    stdin_open: true
    tty: true
    command: /bin/bash

volumes:
  flutter_cache:
```

### 6.3 Docker 使用命令

```bash
# 构建镜像
docker compose build

# 启动容器（交互式）
docker compose run --rm flutter_dev

# 进入容器后运行 Flutter
flutter doctor
flutter pub get
flutter analyze
flutter test

# Web 调试
flutter run -d web-server --web-port 8080
# 然后访问 http://localhost:8080
```

---

## 7. GitHub Actions CI 配置

```yaml
# .github/workflows/ci.yml
name: Flutter CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.3'
          channel: 'stable'
          cache: true

      - name: Install dependencies
        run: flutter pub get

      - name: Analyze
        run: flutter analyze

      - name: Check formatting
        run: dart format --set-exit-if-changed lib/ test/

      - name: Run tests
        run: flutter test --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: coverage/lcov.info
          fail_ci_if_error: false
```

---

## 8. GitHub 模板仓库

1. 在 GitHub 创建仓库 `flutter_starter_template`
2. 推送所有模板文件（包括 `.vscode/`、`.github/`、`docker/` 等）
3. 在 Settings → General 中勾选 "Template repository"
4. 以后创建新项目只需："Use this template" → 立即开始写代码

---

## 本章练习

**练习 1：搭建 Starter Template 并验证**
- 执行 `setup.sh` 脚本搭建一个新项目
- 验证：`flutter analyze` 零错误、`flutter test` 全部通过、目录结构完整
- 在真机/模拟器上 `flutter run` 确保可正常启动

**练习 2：自定义模板配置**
- 修改 `analysis_options.yaml` 添加团队 lint 规则
- 调整主题（修改 `app_theme.dart` 中的 ColorScheme）
- 添加一个你需要的通用组件到 `lib/widgets/`
- 将变更提交并打 tag `v1.0.0`

**练习 3：搭建 Docker 开发环境**
- 构建 Docker 镜像并启动容器
- 在容器中运行 `flutter analyze && flutter test`
- 记录 Docker 开发流程与本地开发的差异

**练习 4：模板的团队推广**
- 将模板发布为 GitHub Template Repository
- 让一个队友通过 "Use this template" 创建新项目并反馈体验
- 收集改进意见并迭代模板

---

> **下一步**: [Chapter 67 — 热门开源项目推荐与学习路径](./Chapter-67-开源项目推荐.md)
