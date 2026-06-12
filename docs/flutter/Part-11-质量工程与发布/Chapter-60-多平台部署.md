# 第 60 章：多平台应用部署

> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 59 — 安全加固](./Chapter-59-安全加固.md)
> **下一章**: [Chapter 61 — CI/CD](./Chapter-61-CICD.md)
> **官方文档**: [flutter.dev/deployment](https://docs.flutter.dev/deployment)

---

## 0. 本章目标

- 掌握 Android App Bundle 签名打包 + Google Play 发布流程
- **攻克 iOS 证书体系**——Flutter 开发者最常见的痛点
- 理解 TestFlight 完整流程
- 了解 Web PWA 和桌面端部署

---

## 1. Android 部署

### 1.1 创建签名密钥

```bash
# 生成 Keystore（只做一次，密钥文件需妥善保管）
# keytool 是 JDK（Java 开发工具包）自带的密钥管理工具（安装 Android Studio 时已自带）。
# Keystore（.jks 文件）是一个加密的"保险箱"，里面存着你的应用签名密钥。
# -alias 是密钥别名（便于记忆），-keyalg RSA 是加密算法（Android 标准要求），-validity 10000 是有效期天数（约 27 年）。
keytool -genkey -v -keystore library-keystore.jks \
  -alias library -keyalg RSA -keysize 2048 -validity 10000

# ⚠️ 这个 .jks 文件极其重要：
#   - 加入 .gitignore（不能提交到仓库）
#   - 备份到安全位置（密码管理器或加密存储）
#   - 丢失后无法更新 App，只能重新发布
```

### 1.2 配置签名

创建 `android/key.properties`（不提交 Git）：

```properties
storePassword=你的密钥库密码
keyPassword=你的密钥密码
keyAlias=library
storeFile=../library-keystore.jks
```

在 `android/app/build.gradle` 中引用：

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### 1.3 构建与发布

```bash
# 构建 AAB（推荐——Google Play 自动按设备生成优化 APK）
flutter build appbundle --release

# 构建分架构 APK（用于直接分发）
flutter build apk --split-per-abi --release

# Google Play Console 流程：
# 1. 创建应用 → 填写商店信息（名称/描述/截图/分类）
# 2. 上传 AAB → 内部测试（Internal Testing）→ 封闭测试（Closed Testing）
# 3. 封闭测试需至少 12 人参与 14 天（2024 年后新政策）
# 4. 生产发布（Production）
```

> 2024 年起，新个人开发者账号需通过 20+ 人封闭测试后才能申请正式发布。建议提前规划测试周期。

### 1.4 Android 15 Edge-to-Edge 适配

Android 15 开始，系统默认强制 **edge-to-edge**（边到边）显示——App 内容延伸到系统状态栏和导航栏区域，不再有默认的黑色/半透明遮挡：

```kotlin
// android/app/src/main/kotlin/.../MainActivity.kt
// Android 15+ 自动启用，无需额外代码
// 但需验证 UI 不被系统栏遮挡

import android.os.Bundle
import androidx.core.view.WindowCompat

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 告诉系统：App 会自行处理系统栏区域的绘制
        WindowCompat.setDecorFitsSystemWindows(window, false)
    }
}
```

Flutter 端配合 `SafeArea` 和 `SystemUiOverlayStyle` 确保交互元素不被遮挡：

```dart
// lib/app.dart
Scaffold(
  body: SafeArea(  // ← SafeArea 自动避开系统栏
    child: BookListView(),
  ),
);

// 透明系统栏（沉浸式体验）
SystemChrome.setSystemUIOverlayStyle(
  const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    systemNavigationBarColor: Colors.transparent,
  ),
);
```

> 在 Android 15 模拟器/真机上测试：确保底部导航栏、FAB 按钮不被手势导航条遮挡。

### 1.5 2026 Google Play 新政策速览

- **Target API Level**: 新提交的 App 必须 target Android 15 (API 35)
- **隐私政策**: Play Console → 应用内容 → 隐私政策，必须填写有效 URL
- **数据安全**: 需填写"数据安全"表格，声明 App 收集/分享的数据类型

---

## 2. iOS 部署

iOS 证书体系是 Flutter 开发者最常见的痛点。下面逐步拆解。

### 2.1 iOS 证书体系详解

> **通俗类比——iOS 证书体系就像办护照：**
> - CSR 是你提交的"护照申请表"
> - Development Certificate 是"临时身份证"（只能装在注册过的测试设备上）
> - Distribution Certificate 是"护照"（可用于 App Store 全球分发）
> - Provisioning Profile 是"签证"——把证书 + App ID + 设备信息打包在一起
> - UDID 是每台 iPhone 的唯一硬件标识符

```
你的 Mac（开发机）
  ↓ 生成
CSR（证书签名请求）
  ↓ 上传到 Apple Developer
两种证书：
  ├─ Development Certificate（开发用）
  └─ Distribution Certificate（发布用）

App ID（应用的唯一标识，如 com.example.libraryApp）
  ↓ 关联
Provisioning Profile（授权文件）
  ├─ 包含：证书 + App ID + 测试设备 UDID + 权限声明
  ├─ Development Profile → 用于开发（只能装在注册的设备上）
  └─ Distribution Profile → 用于发布（App Store / TestFlight / Ad Hoc）
```

**关键理解**：证书 = "谁可以签名"，Provisioning Profile = "签名后谁能运行"。

### 2.2 Xcode 自动管理（推荐新手）

1. Xcode 打开 `ios/Runner.xcworkspace`
2. Signing & Capabilities → 勾选 "Automatically manage signing"
3. 选择你的 Team（需要 Apple Developer 账号，免费账号也可用于开发但有限制）
4. Xcode 自动处理证书和 Profile

### 2.3 手动管理（CI/CD 需用）

```bash
# 构建 Archive
flutter build ipa --export-method app-store

# 或者在 Xcode 中：
# Product → Archive → Distribute App → App Store Connect → Upload
```

### 2.4 TestFlight 完整流程

```
1. App Store Connect → "我的 App" → 创建新 App
2. Xcode → Product → Archive → Distribute → App Store Connect → Upload
3. 等待 Apple 审核（首次约 24-48 小时，后续通常 2-6 小时）
4. TestFlight → 添加测试员（内部：App Store Connect 用户，外部：邮箱邀请）
5. 测试员通过 TestFlight App 安装测试版本
6. 收集反馈 → 修复 → 重新上传新 Build → 继续测试
```

### 2.5 App Store 审核避坑指南

| 踩坑点 | 预防措施 |
|--------|---------|
| 崩溃 | TestFlight 充分测试，确保崩溃率 < 1% |
| 隐私政策缺失 | 在 App Store Connect 填写隐私政策 URL（可托管在 GitHub Pages） |
| 权限描述不完整 | 所有权限请求（相机/位置/通知等）在 Info.plist 中有清晰的中文说明 |
| 废弃 API | 定期更新 Flutter SDK，`flutter analyze` 检查 `deprecated_member_use` |
| 缺少 iPad 适配 | Flutter App 默认支持 iPad，但需验证横屏模式 |
| 缺少应用内恢复购买/删除账号 | 如有内购或账号系统，需提供恢复购买和账号删除功能 |
| 审核被拒 4.3 (Spam) | 确保 App 功能完整，不要上传类似"Hello World"的内容 |

### 2.6 常见证书错误排查

| 错误 | 原因 | 解决 |
|------|------|------|
| "No profiles for 'com.example.app' were found" | Profile 不包含此 Bundle ID | Xcode → 自动管理签名，或在 Apple Developer 创建对应的 App ID |
| "The certificate used to sign has expired" | 证书过期 | Xcode → 重新生成证书（自动管理会处理） |
| "Provisioning profile doesn't include the signing certificate" | Profile 和证书不匹配 | 删除 `~/Library/MobileDevice/Provisioning Profiles/` 中的过期 Profile，重新下载 |

### 2.7 iOS Privacy Manifest（2024 起必须）

从 2024 年春季起，Apple 要求所有新上传的 App 包含 **Privacy Manifest**（`PrivacyInfo.xcprivacy`），声明 App 使用了哪些隐私相关的 API 及其用途。Flutter 项目需在 Xcode 中配置：

```
ios/Runner/PrivacyInfo.xcprivacy
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>DDA9.1</string>  <!-- 应用内部文件管理 -->
      </array>
    </dict>
  </array>
</dict>
</plist>
```

> 在 Xcode 中：Runner → New File → App Privacy → PrivacyInfo.xcprivacy 可自动生成模板。提交审核前务必确认所有隐私 API 用途都已声明，否则会被 4.8 条款拒绝。

---

## 3. Web 部署

```bash
# 构建（WASM 提供接近原生性能）
# WASM（WebAssembly）是一种在浏览器中运行高性能二进制代码的技术——让 Flutter Web 获得接近原生 App 的性能。
# --base-href / 表示 App 部署在网站根路径下（如果部署在 /app/ 子目录则改为 --base-href /app/）。
flutter build web --wasm --base-href /

# 部署到 Firebase Hosting
firebase init hosting
firebase deploy --only hosting

# PWA 支持（默认启用）
# web/manifest.json — 应用名称/图标/主题色
# Service Worker — 自动缓存策略（flutter build web 默认生成）
```

---

## 4. 应用图标与闪屏

```yaml
# pubspec.yaml
dev_dependencies:
  flutter_launcher_icons: ^0.14.0
  flutter_native_splash: ^2.4.0

flutter_launcher_icons:
  image_path: "assets/images/app_icon.png"
  android: true
  ios: true

flutter_native_splash:
  color: "#FFFFFF"
  image: assets/images/splash_logo.png
  android: true
  ios: true
```

```bash
flutter pub run flutter_launcher_icons    # 一键生成全平台图标
flutter pub run flutter_native_splash:create  # 生成原生闪屏
```

> 建议在 UI 成形后（Part-02 完成后）就配置图标和闪屏，不要等到最后。

---

## 5. 环境配置

```bash
# 三环境构建
# --dart-define=KEY=value 在编译时把值注入到 Dart 代码中，代码里通过 String.fromEnvironment('KEY') 读取。
# 这样就避免了把生产环境密钥写在源码里。
flutter build appbundle --release \
  --dart-define=ENV=prod \
  --dart-define=SUPABASE_URL=https://xxx.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=eyJ...

# 通过 --obfuscate 开启 Dart 代码混淆
# --obfuscate 将 Dart 代码的类名/函数名替换成无意义字符（如 Abc1、Xyz2），增加反编译难度。
# 必须配合 --split-debug-info 将还原映射表单独保存，否则线上崩溃日志无法还原。
flutter build appbundle --release --obfuscate --split-debug-info=./debug-info
```

---

## 6. 发布前检查清单

- [ ] Android：Keystore 已创建且备份到安全位置
- [ ] Android：AAB 构建成功，上传到 Play Console 并通过预审
- [ ] Android：验证 Edge-to-Edge 显示（Android 15+），SafeArea 正确避让系统栏
- [ ] iOS：证书和 Provisioning Profile 有效（未过期）
- [ ] iOS：TestFlight Build 审核通过，测试员已安装
- [ ] iOS：PrivacyInfo.xcprivacy 已配置（2024+ 必须）
- [ ] 隐私政策 URL 已配置（App Store Connect + Google Play Console）
- [ ] 所有权限有对应的 Info.plist / AndroidManifest 描述
- [ ] 应用图标和闪屏已配置全平台
- [ ] `flutter analyze` 零问题
- [ ] 生产环境已通过 `--dart-define` 配置
- [ ] 版本号已更新（`pubspec.yaml` 中 `version: x.y.z+N`）

---

## 7. 本章练习

1. 为 Library App 生成 Android Keystore 并配置签名
2. 构建 Release AAB，验证可上传到 Google Play Console
3. 在 Xcode 中完成自动签名配置，构建 iOS Archive
4. 配置 Library App 的应用图标和闪屏
5. **选做**：添加 PrivacyInfo.xcprivacy 并在 Android 15 模拟器上验证 edge-to-edge 效果

---

> 📖 **延伸阅读**: [Flutter Android 发布](https://docs.flutter.dev/deployment/android) | [Flutter iOS 发布](https://docs.flutter.dev/deployment/ios) | [App Store 审核指南](https://developer.apple.com/app-store/review/guidelines/)
