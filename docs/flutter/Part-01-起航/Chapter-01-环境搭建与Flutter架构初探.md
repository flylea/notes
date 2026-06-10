> **Part**: Part I — 起航：环境与 Dart 语言
> **下一章**: [Chapter 02 — Dart 核心语法速通（上）：变量、类型、函数、控制流](./Chapter-02-Dart核心语法速通-上.md)
> **官方文档**: [Flutter 安装指南](https://docs.flutter.cn/get-started/install) | [Flutter 架构概览](https://docs.flutter.cn/resources/architectural-overview) | [Flutter 工作原理](https://docs.flutter.cn/resources/inside-flutter)

---

# 第 1 章：环境搭建与 Flutter 架构初探

## 0. 本章目标与前置依赖

**前置依赖**：无。这是本教程的第一章，从零开始。

**本章目标**：
- 在 Windows / macOS 上安装 Flutter SDK 并完成 `flutter doctor` 全绿
- 配置 VS Code 作为主力编辑器，安装 Flutter / Dart 扩展
- 创建并运行你的第一个 Flutter 项目，理解项目目录结构
- 理解 Flutter 的四层架构（Embedder → Engine → Framework → App）和 Widget/Element/RenderObject 三棵树的渲染管线
- 掌握 Hot Reload 与 Hot Restart 的区别与原理
- 了解 Impeller 渲染引擎的设计动机
- 在图书馆管理 App 中完成项目骨架搭建

> 🎯 **本章会在图书馆 App 中做什么**：用 `flutter create` 初始化项目，配置 `analysis_options.yaml`，理解每个目录和文件的职责，为后续所有章节建立工程基础。

---

## 1. Flutter 是什么

Flutter 是 Google 开源的跨平台 UI 工具集（UI Toolkit），允许你用**同一套 Dart 代码**构建在 iOS、Android、Web、Windows、macOS、Linux 六个平台上运行的精美原生应用。当前最新稳定版本为 **Flutter 3.44**（2026 年 5 月发布），配套 Dart 3.12。

### 1.1 Flutter 的核心价值

| 特性 | 说明 | 与你（TS/React 开发者）的关系 |
|------|------|-------------------------------|
| **一套代码，多端运行** | 一次编写，编译为原生 ARM/x64 机器码（移动/桌面）或 JavaScript/WebAssembly（Web） | 相当于一个 React 代码库同时产出 iOS、Android、Web、桌面——不需要 React Native + Electron 分开维护 |
| **热重载（Hot Reload）** | 保存代码后 < 1 秒内看到 UI 变化，保留应用状态 | 比 Vite HMR 更快一步——连组件 state 都保留，不需要重新操作到目标页面 |
| **渲染自主可控** | 自带 Skia/Impeller 渲染引擎，不依赖平台原生 UI 组件 | 就像 Canvas/WebGL 直接画 UI，跨平台 UI 一致性天然保证——不像 RN 需要在 iOS/Android 上做不同的适配 |
| **高性能** | Release 模式直接编译为机器码，无 JS Bridge | 相当于编译型语言的性能，React Native 的 Bridge 通信瓶颈在 Flutter 中不存在 |
| **AI 赋能** | 内置 GenUI、AI Toolkit、MCP Server 等 AI 开发工具链 | Flutter 3.44 开始原生支持 AI Agent 操控 App——这是 2026 年跨平台框架中最激进的 AI 集成 |

### 1.2 Flutter 不是"又一个 React Native"

React Native 的技术路线是：**用 JS 线程控制原生 UI 组件**。这带来两个根本性问题：

1. **Bridge 瓶颈**：JS ↔ Native 通信需要序列化/反序列化，高频交互（如动画、滚动）时成为性能瓶颈
2. **UI 不一致**：同一套代码在 iOS 上渲染的是 `UIButton`，在 Android 上渲染的是 `android.widget.Button`——它们的默认样式、行为、甚至可用的属性都不同

Flutter 走了完全不同的路线：**自带渲染引擎，直接画像素**。它不使用平台原生 UI 组件，而是像游戏引擎一样，自己计算布局、自己绘制每一个像素。这意味着：

```
React Native:  JS 代码 → Bridge → 原生 UI 组件 → 系统渲染
Flutter:       Dart 代码 → Flutter Engine (Skia/Impeller) → GPU 渲染
```

结果就是：Flutter App 在 iOS 和 Android 上看起来、动起来**完全一致**，因为它们是同一套引擎画的。

---

## 2. 环境安装

### 2.1 Windows 安装

#### Step 1：下载 Flutter SDK

```bash
# PowerShell 中使用 winget（推荐，Windows 11 内置）
winget install Google.Flutter

# 或者手动下载：访问 https://docs.flutter.cn/get-started/install/windows
# 解压到 C:\dev\flutter（避免 C:\Program Files，路径含空格会导致问题）
```

#### Step 2：配置环境变量

将 Flutter 的 `bin` 目录添加到系统 PATH：

```powershell
# 以管理员身份运行 PowerShell
[Environment]::SetEnvironmentVariable(
  "Path",
  [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\dev\flutter\bin",
  "User"
)
```

关闭并重新打开 PowerShell，验证：

```bash
flutter --version
# Flutter 3.44.0 • channel stable
# Dart 3.12.0
```

#### Step 3：安装 Android 工具链（用于 Android 开发）

1. 下载安装 [Android Studio](https://developer.android.com/studio)（即使你用 VS Code 写代码，也需要 Android Studio 提供的 SDK）
2. 打开 Android Studio → More Actions → SDK Manager → SDK Tools 标签 → 勾选 **Android SDK Command-line Tools (latest)**
3. 在 SDK Manager → SDK Platforms 中安装最新的 Android API Level

#### Step 4：配置 Android 模拟器

1. Android Studio → More Actions → Virtual Device Manager → Create device
2. 选择设备型号（推荐 Pixel 7 或以上）→ 选择系统镜像（推荐 API 35 的 "UpsideDownCake"）→ 完成创建
3. 启动模拟器，确认它出现在 `flutter devices` 列表中

### 2.2 macOS 安装

#### Step 1：下载 Flutter SDK

```bash
# 使用 Homebrew（推荐）
brew install --cask flutter

# 或者手动下载
# 访问 https://docs.flutter.cn/get-started/install/macos
# 解压到 ~/dev/flutter
```

#### Step 2：配置环境变量

```bash
# 在 ~/.zshrc 中添加（macOS 默认 shell 已是 zsh）
echo 'export PATH="$PATH:$HOME/dev/flutter/bin"' >> ~/.zshrc
source ~/.zshrc
```

#### Step 3：安装 Xcode（用于 iOS/macOS 开发）

```bash
# App Store 安装 Xcode（约 12GB，需要耐心等待）
# 安装完成后执行
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch

# 安装 CocoaPods（Flutter iOS 插件依赖管理）
sudo gem install cocoapods
```

#### Step 4：安装 Android 工具链（与 Windows Step 3-4 相同）

### 2.3 flutter doctor — 体检命令

安装完成后，运行体检：

```bash
flutter doctor -v
```

一个全部通过的输出应该是这样的：

```text
[✓] Flutter (Channel stable, 3.44.0, on macOS 15.2)
    • Flutter version 3.44.0
    • Framework revision a1b2c3d4e5 (5 days ago)
    • Engine revision f6g7h8i9j0
    • Dart version 3.12.0

[✓] Android toolchain - develop for Android devices
    • Android SDK at /Users/you/Library/Android/sdk
    • All Android licenses accepted.

[✓] Xcode - develop for iOS and macOS
    • Xcode at /Applications/Xcode.app/Contents/Developer
    • CocoaPods version 1.15.2

[✓] Chrome - develop for the web

[✓] Android Studio (version 2025.1)
    • Flutter plugin version 82.0.1
    • Dart plugin version 251.0

[✓] VS Code (version 1.96.0)
    • Flutter extension version 3.106.0

[✓] Connected device (3 available)
    • Pixel 7 (mobile) • android-arm64 • Android 15
    • iPhone 16 Pro (mobile) • ios • iOS 18.2
    • Chrome (web) • chrome • web-javascript

! Doctor found issues in 0 categories.
```

> **TS 经验**：`flutter doctor` 的作用类似于运行 `npx create-react-app --check` + `node --version` + `npm doctor` 的组合——一次性检查整个工具链是否就绪。

### 2.4 常见安装问题速查

| 问题 | 原因 | 解决 |
|------|------|------|
| `flutter: command not found` | PATH 未配置或未重启终端 | 检查环境变量，**重启终端** |
| `Android SDK not found` | Android Studio 安装后未配置 SDK | Android Studio → SDK Manager → 安装 SDK Platform |
| `Android license status unknown` | 未接受 Android 许可协议 | `flutter doctor --android-licenses` 一路按 `y` |
| `CocoaPods not installed` | macOS 上缺少 CocoaPods | `sudo gem install cocoapods` |
| `No connected devices` | 模拟器未启动 | 启动 Android 模拟器 或 iOS Simulator |
| `cmdline-tools component is missing` | Android SDK 命令行工具缺失 | SDK Manager → SDK Tools → 勾选 "Android SDK Command-line Tools" |

---

## 3. VS Code 编辑器配置

本教程推荐 VS Code 作为主力编辑器（Flutter 官方调研显示 VS Code 已在 Flutter 开发者中超过 Android Studio 成为最常用 IDE）。

### 3.1 安装扩展

在 VS Code 扩展市场搜索安装：

1. **Flutter**（`dart-code.flutter`）—— 自动安装 Dart 扩展作为依赖
2. **Awesome Flutter Snippets**（`Nash.awesome-flutter-snippets`）—— 常用代码片段（可选但推荐）

### 3.2 推荐设置

打开 VS Code 的 `settings.json`（`Ctrl+Shift+P` → "Open User Settings (JSON)"），添加：

```json
{
  // 保存时自动格式化 Dart 代码
  "[dart]": {
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll": "explicit"
    }
  },
  // 显示 Flutter 的 debug 面板
  "dart.openDevTools": "flutter",
  // 关闭不必要的内联提示（减少视觉干扰）
  "dart.closingLabels": false
}
```

### 3.3 Flutter 专属快捷操作

| 快捷键 | 功能 | 与 VS Code 通用操作的对应 |
|--------|------|--------------------------|
| `Ctrl+.` | Quick Fix（自动修复/自动导入/Wrap with Widget） | 与 TS 项目的 Quick Fix 完全一致 |
| `Ctrl+Shift+P` → "Flutter: New Project" | 创建新 Flutter 项目 | 类似 "Create React App" |
| `Ctrl+Shift+P` → "Flutter: Launch Emulator" | 启动模拟器 | - |
| `F5` | 启动调试 + Hot Reload | 等同于 `npm start` + 保存自动刷新 |

---

## 4. 创建第一个 Flutter 项目

```bash
# 在终端中进入你的工作目录
cd ~/projects

# 创建项目（--empty 表示最小模板，适合学习和理解每一行代码）
flutter create library_app --empty

# 进入项目
cd library_app

# 用 VS Code 打开
code .
```

### 4.1 项目目录结构详解

```
library_app/
├── .dart_tool/                  # Dart 工具缓存（自动生成，不要手动编辑）
├── .idea/                       # IntelliJ/Android Studio 项目配置
├── android/                     # Android 原生工程
│   ├── app/
│   │   └── src/main/
│   │       ├── AndroidManifest.xml   # Android 权限、配置声明
│   │       └── kotlin/.../MainActivity.kt  # Android 入口 Activity
│   └── build.gradle.kts         # Android 构建配置
├── ios/                         # iOS 原生工程
│   ├── Runner/
│   │   ├── AppDelegate.swift    # iOS 入口
│   │   └── Info.plist           # iOS 权限、配置声明
│   └── Runner.xcodeproj
├── lib/                         # 🔥 你的 Dart 代码主目录（所有 Flutter 代码都在这里）
│   └── main.dart                # 应用入口
├── test/                        # 测试目录
│   └── widget_test.dart
├── web/                         # Web 平台配置
├── windows/                     # Windows 桌面平台配置
├── linux/                       # Linux 桌面平台配置
├── macos/                       # macOS 桌面平台配置
├── pubspec.yaml                 # 🔥 项目配置文件（依赖/资源/版本）——相当于 package.json
├── analysis_options.yaml        # Dart 静态分析规则配置
└── README.md
```

> **TS 经验**：`pubspec.yaml` ≈ `package.json`，`lib/` ≈ `src/`，`analysis_options.yaml` ≈ `eslint.config.js` + `tsconfig.json` 的 strict 规则。

### 4.2 第一个 Hello World

打开 `lib/main.dart`，用以下代码替换全部内容：

```dart
// ① Dart 标准库导入 — 类似 TS 的 import ... from 'react'
import 'package:flutter/material.dart';

// ② 应用入口函数 — 类似 React 的 ReactDOM.createRoot().render()
//   runApp() 接收一个 Widget，把它挂载到屏幕
void main() {
  runApp(const LibraryApp());
}

// ③ 应用根 Widget — 类似 React 的 <App />
//   StatelessWidget 是不含可变状态的 Widget
//   const 构造表示此 Widget 在编译时就完全确定，运行时不会变化
class LibraryApp extends StatelessWidget {
  const LibraryApp({super.key});

  // ④ build() 方法 — 类似 React 的 render() 或函数组件的 return
  //   它接收 BuildContext（类似 React 的组件上下文），返回 Widget 树
  @override
  Widget build(BuildContext context) {
    // ⑤ MaterialApp — 类似 React 的 <BrowserRouter> + <ThemeProvider>
    //   它提供 Material Design 主题、路由、本地化等基础设施
    return MaterialApp(
      title: 'Library Management System',
      // ⑥ Theme — 类似 Tailwind 的 theme config
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF1565C0), // 种子色，自动生成调色板
        useMaterial3: true,                        // 启用 Material 3 设计
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF42A5F5),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      // ⑦ home — 首页 Widget，应用启动后显示的第一个页面
      home: const HomeScreen(),
    );
  }
}

// ⑧ 首页 Widget
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // ⑨ Scaffold — 页面骨架，提供 AppBar、Body、FAB 等标准布局槽位
    //   类似 HTML 的 <html><head><body> 结构
    return Scaffold(
      // ⑩ AppBar — 顶部导航栏，类似 React Navigation 的 header
      appBar: AppBar(
        title: const Text('📚 图书馆管理系统'),
        centerTitle: true, // 标题居中（iOS 风格）
      ),
      // ⑪ Body — 页面主体内容
      body: const Center(
        child: Text(
          '欢迎来到图书馆！\n点击右下角 + 开始添加第一本图书。',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 18),
        ),
      ),
      // ⑫ FAB — 浮动操作按钮（Floating Action Button）
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // 打印调试信息 — 类似 console.log()
          debugPrint('添加图书按钮被点击');
        },
        tooltip: '添加图书',
        child: const Icon(Icons.add),
      ),
    );
  }
}
```

**逐行解读**：

| 编号 | 代码 | 解读 |
|------|------|------|
| ① | `import 'package:flutter/material.dart'` | 导入 Flutter 的 Material Design 组件库。Flutter 提供了两套设计语言：Material（Google 风格）和 Cupertino（iOS 风格）。Material 是 Flutter 最通用、文档最全的设计体系 |
| ② | `runApp(const LibraryApp())` | `runApp()` 是 Flutter 应用的唯一入口——把一个 Widget 挂载到 Flutter 的渲染树的根位置。这相当于 React 的 `createRoot(document.getElementById('root')).render(<App />)` |
| ③ | `class LibraryApp extends StatelessWidget` | `StatelessWidget` 是"无状态 Widget"，它的 UI 完全由传入的参数决定，自身不维护可变状态。类似 React 的 `function Component(props)` |
| ④ | `Widget build(BuildContext context)` | 每个 Widget 都必须实现 `build()` 方法，返回一个 Widget 树描述。`BuildContext` 包含 Widget 在树中的位置信息——它不只是 context，还隐含了父 Widget 传给它的约束和数据 |
| ⑤ | `MaterialApp(...)` | Flutter 应用的事实标准外壳。它初始化了 Material Design 主题系统、路由系统、本地化代理。没有它，后面的 Scaffold/AppBar 等 Material Widget 将无法正常工作 |
| ⑥ | `ThemeData(colorSchemeSeed: ...)` | 这是 Material 3 的新配置方式——给一个"种子色"，ThemeData 自动生成完整的 `ColorScheme`（25+ 颜色角色：primary、onPrimary、secondary、tertiary、error、surface、background 等） |
| ⑦ | `home: const HomeScreen()` | MaterialApp 的 `home` 属性指定根页面。等价于 React Router 的 `<Route path="/" element={<HomeScreen />} />` |
| ⑧ | `class HomeScreen extends StatelessWidget` | 自定义 Widget。在 Flutter 中，一切都是 Widget——页面是 Widget，按钮是 Widget，甚至内边距也是 Widget（`Padding`） |
| ⑨ | `Scaffold(...)` | Material Design 的页面骨架。它为页面提供了标准的结构槽位：`appBar`（顶部栏）、`body`（主体）、`floatingActionButton`（浮动按钮）、`bottomNavigationBar`（底部导航栏）、`drawer`（侧边抽屉） |
| ⑩ | `AppBar(title: ...)` | 就是 Material 标准的顶部应用栏，有返回箭头（当有上一页时）、标题、可选的操作按钮 |
| ⑪ | `Center(child: Text(...))` | `Center` 是一个布局 Widget，把子 Widget 置于可用空间的中心。后面的 `Text` 是文本 Widget。注意 `textAlign: TextAlign.center` 是文本内部居中对齐，`Center` 是 Widget 在父容器中居中——两者是不同的概念 |
| ⑫ | `FloatingActionButton(onPressed: ..., child: Icon(Icons.add))` | Material Design 的 FAB——页面右下角的圆形按钮。`onPressed` 接收一个回调函数，`child` 是按钮内容（这里是一个 + 图标） |

### 4.3 运行你的第一个 Flutter App

```bash
# 确认可用设备
flutter devices

# 选择一个设备运行
flutter run                    # 自动选择第一个可用设备
flutter run -d chrome          # 指定在 Chrome 中运行（Web 模式）
flutter run -d emulator-5554   # 指定 Android 模拟器

# 更常用的方式：在 VS Code 中按 F5
```

当你看到带有 "📚 图书馆管理系统" 标题的页面，你已成功运行了第一个 Flutter 应用。这是后面 57 章要持续迭代的**图书馆管理系统 (Library Management System)** 的起点。

---

## 5. Flutter 架构深度解析

理解 Flutter 的架构，是理解"为什么 Flutter 代码是这样写的"的关键。这相当于 React 开发者理解 Virtual DOM → Fiber → Commit 的过程——不懂也能写，但懂了才能写出高性能代码。

### 5.1 四层架构

Flutter 是一个分层系统，自底向上分为四层：

```
┌─────────────────────────────────────────────┐
│  Dart 应用层 (Widgets + 业务逻辑)            │  ← 你编写的代码
├─────────────────────────────────────────────┤
│  Framework (Dart)                            │  ← Material / Cupertino / Widgets
│  ├─ Material / Cupertino  (设计语言组件库)    │     Rendering / Painting / Gestures
│  ├─ Widgets               (Widget 抽象层)     │     Animation / Foundation
│  ├─ Rendering             (渲染管线)          │
│  └─ Foundation            (基础工具)          │
├─────────────────────────────────────────────┤
│  Engine (C++)                                │  ← Skia/Impeller 渲染 / 文本布局
│  ├─ Impeller (渲染) / Skia (旧渲染器)        │     Dart VM / Isolate 管理
│  ├─ Dart VM (运行时)                          │
│  └─ Text Layout (文字排版)                    │
├─────────────────────────────────────────────┤
│  Embedder (平台原生语言)                      │  ← 与操作系统交互
│  ├─ Android: Java/Kotlin + SurfaceView       │     Surface / 输入事件 / 事件循环
│  ├─ iOS: Swift/ObjC + FlutterViewController  │
│  ├─ Web: JS + CanvasKit/HTML                 │
│  └─ Desktop: C++ + GLFW (Win/Linux)          │
│              Swift + Cocoa (macOS)            │
└─────────────────────────────────────────────┘
```

各层的职责：

| 层 | 语言 | 职责 | 你不应该做的事 |
|----|------|------|---------------|
| **Embedder（嵌入层）** | Java/Kotlin/Swift/C++ | 创建 Surface 提供给 Engine 绘制、处理输入事件（触摸/键盘）、管理事件循环和生命周期 | 在普通 App 中不需要碰这一层 |
| **Engine（引擎层）** | C++ | 图形渲染（Impeller/Skia）、文本布局（LibTxt/HarfBuzz）、Dart VM 管理、通过 `dart:ui` 暴露底层能力给 Framework | 不直接使用 `dart:ui`，让 Framework 替你管理 |
| **Framework（框架层）** | Dart | Widget 抽象、布局算法（Box/Sliver）、绘制指令生成、手势识别、动画系统、Material/Cupertino 设计组件 | 不需要理解每一个内部实现，但需要理解**约束传递规则**（详见 Chapter 7 布局系统） |
| **Dart 应用层** | Dart | 你的业务逻辑、UI 组合、状态管理 | — |

> **TS 经验**：Embedder ≈ 浏览器的 Rendering Engine（Chromium），Engine ≈ V8 JS 引擎，Framework ≈ React 库，Dart 应用层 ≈ 你写的 React 组件代码。

### 5.2 Widget 三棵树

这是 Flutter 架构中最核心的概念。Flutter 在运行时维护**三棵协同工作的树**：

```
┌──────────────────┐      ┌───────────────────┐      ┌──────────────────────┐
│   Widget 树       │ ───→ │   Element 树       │ ───→ │   RenderObject 树     │
│  (不可变配置)     │      │  (生命周期管理)     │      │  (布局+绘制+命中检测)  │
│                   │      │                   │      │                      │
│ • 开发者编写      │      │ • Flutter 自动创建  │      │ • Flutter 自动创建    │
│ • 轻量，频繁重建  │      │ • 连接 Widget↔Render │      │ • 重量级，尽量减少重建 │
│ • 纯配置，无状态  │      │ • 管理 State       │      │ • 实际占据屏幕像素    │
│ • 类似 React VDOM │      │ • 类似 React Fiber │      │ • 类似真实 DOM       │
└──────────────────┘      └───────────────────┘      └──────────────────────┘
```

三棵树的具体关系：

| 树 | 创建时机 | 重建频率 | 职责 | 类比 |
|----|---------|---------|------|------|
| **Widget 树** | 你在 `build()` 方法中返回时创建 | 极高（每帧都可能重建） | 描述 UI 的**配置**——"我想要一个蓝色容器，里面放这段文字" | React Virtual DOM |
| **Element 树** | Flutter 根据 Widget 配置创建 | 中等（Widget 变化时才更新） | 管理 Widget 的生命周期、持有 State 对象、连接 Widget 和 RenderObject | React Fiber Node |
| **RenderObject 树** | Element 树创建时同步创建 | 低（仅在布局/绘制属性变化时更新） | 执行**布局**（计算坐标和尺寸）、**绘制**（生成 GPU 绘制指令）、**命中检测**（判断用户点到了哪里） | 真实 DOM |

**为什么是三棵树而不是一棵**：这个设计有三个关键优势：

1. **性能**：Widget 重建极快（就是一个普通的 Dart 对象创建），不需要每次状态变化都进行昂贵的布局计算。Element 树作为中间层，可以判断 RenderObject 是否真的需要更新
2. **类型安全**：Widget 树可以包含任何 Widget（组合的、布局的、绘制的），而 RenderObject 树只包含有实际渲染需要的节点。Element 树保证了二者之间的类型转换是安全的
3. **复用**：同一个 Widget 配置可以在不同的布局上下文中复用——例如，同一个 `Text` Widget 可以在 Box 布局中使用，也可以在 Sliver 布局中使用，Element 树负责桥接到不同的 RenderObject

### 5.3 声明式 UI 与 build() 方法

Flutter 的 UI 模型是一个函数：

```
UI = f(state)
```

当状态（state）发生变化时，`build()` 方法被重新调用，返回一个新的 Widget 配置树。Flutter 比较新旧 Widget 树，通过 Element 树只更新真正需要变化的 RenderObject。

> **TS 经验**：`UI = f(state)` 就是 React 的核心理念（`UI = render(state)`）。在 React 中 `f` 是函数组件（`function MyComponent`），在 Flutter 中 `f` 是 `build()` 方法。

```dart
// React（TS）:
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;       // UI = f(props)
}

// Flutter（Dart）:
class Greeting extends StatelessWidget {  // UI = f(state)
  const Greeting({super.key, required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {   // build() = f
    return Text('Hello, $name!');        // Widget 树 = 返回值
  }
}
```

两者的核心流程完全一致：

```
State 变化 → 调用 build()/render() → 生成新的 Widget/VDOM 树 → Diff → 最小化更新真实渲染对象/真实 DOM
```

### 5.4 Hot Reload vs Hot Restart

这是 Flutter 开发体验的核心优势，也是日常开发中使用最频繁的能力。

| 特性 | Hot Reload | Hot Restart |
|------|-----------|-------------|
| **触发方式** | 保存文件（VS Code 自动）/ 在终端按 `r` | 在终端按 `R` / 点击 VS Code 的 Restart 按钮 |
| **做了什么** | 将修改过的 Dart 源码注入 Dart VM，触发受影响的 Widget 重建 | 完全销毁 Dart VM 并重新启动应用 |
| **保留状态** | ✅ 保留（State 对象存活，变量值不变） | ❌ 全部丢失（从 `main()` 重新开始） |
| **速度** | 极快（通常 < 1 秒，多数情况下 < 500ms） | 较慢（几秒，取决于应用复杂度） |
| **适用场景** | UI 调整、样式修改、布局微调 | 修改了 `initState()` 逻辑、修改了全局变量初始化 |

**Hot Reload 的原理**：

```
1. 你修改了 lib/main.dart 中的 Text 文案
2. Flutter 将修改过的源码文件增量编译为 kernel 文件
3. kernel 文件被注入到运行中的 Dart VM
4. Flutter 触发 Reassemble —— 所有 StatefulWidget 的 reassemble() 方法被调用
5. build() 方法被重新执行，生成新的 Widget 配置
6. Element 树 Diff 新旧 Widget → 只重建变化的 Text Widget
7. 新文案显示在屏幕上
```

> **TS 经验**：Hot Reload ≈ Vite HMR 但更强大 —— Vite HMR 会保留组件状态（`useState` 的值），Flutter Hot Reload 同样保留。Hot Restart ≈ 手动刷新浏览器页面。

---

## 6. Impeller 渲染引擎

从 Flutter 3.44 开始，**Impeller 已成为默认渲染引擎**（在支持 Vulkan 的 Android 10+ 设备上完全替代 Skia）。

### 6.1 为什么需要 Impeller

Skia（Flutter 原来的渲染引擎）有一个根本性的问题：**Shader 编译卡顿（Shader Jank）**。

简单来说，GPU 绘制 UI 需要小程序（叫 Shader），这些小程序需要在第一次使用时编译。在 Skia 中，Shader 编译发生在**帧渲染期间**——这会导致某些帧的渲染时间突然飙升，用户感知为"掉帧"或"卡顿"。

Impeller 的解决方案是 **AOT（Ahead-of-Time）Shader 编译**——所有 Shader 在构建时就预编译好，打包在 App 中。运行时不需要编译，帧率稳定。

### 6.2 Impeller 的架构优势

| 方面 | Skia | Impeller |
|------|------|----------|
| Shader 编译 | JIT（运行时编译，首次卡顿） | AOT（构建时预编译） |
| 渲染后端 | OpenGL / Metal / Vulkan | 仅 Metal（iOS）/ Vulkan（Android），无 OpenGL 负担 |
| 内存占用 | 较大（通用渲染库） | 较小（Flutter 专用，按需加载） |
| 性能可预测性 | 低（Shader 编译时机不可控） | 高（所有渲染工作已知） |

对于 Library App 来说，Impeller 意味着图书列表的流畅滚动、Hero 动画的稳定帧率——这些都是用户能直接感知到的体验提升。

---

## 7. 图书馆 App 实战

### 7.1 初始化项目

```bash
flutter create library_app --org com.library --project-name library_app
cd library_app
code .
```

`--org com.library` 设置了 Android 包名（`com.library.app`）和 iOS Bundle Identifier。

### 7.2 配置 analysis_options.yaml

打开 `analysis_options.yaml`，确保至少包含以下严格规则：

```yaml
include: package:flutter_lints/flutter.yaml

linter:
  rules:
    # 代码风格
    - always_declare_return_types
    - prefer_const_constructors          # 优先使用 const，提升性能
    - prefer_const_declarations
    - prefer_const_literals_to_create_immutables
    - require_trailing_commas            # 尾随逗号 → 自动格式化更好看
    - sort_constructors_first
    - unawaited_futures
    - use_key_in_widget_constructors

    # 避免常见错误
    - avoid_print                       # 使用 debugPrint 或 Logger
    - avoid_empty_else
    - avoid_relative_lib_imports
    - avoid_types_on_closure_parameters

analyzer:
  errors:
    missing_return: error
    missing_enum_constant_in_switch: error
  exclude:
    - "**/*.g.dart"                      # 排除代码生成文件
    - "**/*.freezed.dart"
```

### 7.3 运行与验证

```bash
# 代码分析（相当于 ESLint + tsc --noEmit）
flutter analyze

# 运行
flutter run

# 热重载测试：修改 HomeScreen 的 Text 内容，保存，观察屏幕是否即时更新
```

---

## 8. 常见错误与最佳实践

### 8.1 常见错误

```dart
// ❌ 错误 1: 在 build() 中执行耗时操作
@override
Widget build(BuildContext context) {
  final data = fetchDataFromServer(); // 这会被频繁调用！应该放在 initState 或 ViewModel
  return Text(data);
}

// ✅ 正确: 耗时操作不应放在 build 中
@override
void initState() {
  super.initState();
  _loadData(); // 在 initState 中触发一次性异步加载
}

// ❌ 错误 2: 忘记 const，导致不必要的重建
return Padding(
  padding: EdgeInsets.all(16),       // 每次 build 都创建新的 EdgeInsets 对象
  child: Text('Hello'),
);

// ✅ 正确: 使用 const 避免重复创建
return const Padding(
  padding: EdgeInsets.all(16),       // 编译时常量，只创建一次
  child: Text('Hello'),
);

// ❌ 错误 3: 无限循环——在 build 中 setState
@override
Widget build(BuildContext context) {
  setState(() { _count++; });        // build → setState → build → 死循环！
  return Text('$_count');
}
// ✅ 正确: 在事件回调中 setState，不在 build 中
```

### 8.2 最佳实践

1. **尽可能使用 `const` 构造**：`const` Widget 在编译时就完全确定，Flutter 可以跳过它们的 rebuild，显著提升性能
2. **键盘快捷键`Ctrl+.`是你的朋友**：选中任何 Widget → `Ctrl+.` → "Wrap with Padding" / "Wrap with Center" / "Remove this widget"——这就是 Flutter 开发最频繁的操作
3. **保存文件即运行**：调整 UI 后 `Ctrl+S`，0.5 秒后屏幕就更新——养成这个习惯，开发效率比 React Native 高出数倍
4. **在 `pubspec.yaml` 修改后需要完全重启**：添加依赖包后必须 Hot Restart（不能 Hot Reload），因为需要重新链接原生库

---

## 9. 本章小结

| 你学到了什么 | 在图书馆 App 中的体现 |
|-------------|---------------------|
| Flutter SDK 安装与 `flutter doctor` 体检 | 项目已初始化，工具链就绪 |
| Flutter 四层架构 | 理解代码在 Framework 层运行 |
| Widget/Element/RenderObject 三棵树 | 明白为什么频繁 rebuild 是廉价的 |
| `build()` 方法 = `UI = f(state)` | 后续写 UI 的基础思维模型 |
| Hot Reload 原理 | 日常开发的核心工具 |
| Impeller AOT Shader 编译 | Release 模式性能保证 |
| VS Code 配置与 Flutter 快捷操作 | 开发环境就绪 |

---

> **下一步**: [Chapter 02 — Dart 核心语法速通（上）：变量、类型、函数、控制流](./Chapter-02-Dart核心语法速通-上.md)
> **原始文档**: [Flutter 安装指南](https://docs.flutter.cn/get-started/install) | [Flutter 架构概览](https://docs.flutter.cn/resources/architectural-overview) | [Flutter 工作原理](https://docs.flutter.cn/resources/inside-flutter) | [Impeller 渲染引擎](https://docs.flutter.cn/perf/impeller)
