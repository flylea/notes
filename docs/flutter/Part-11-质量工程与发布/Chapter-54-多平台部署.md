> **Part**: Part XI | **上一章**: [Ch 53](./Chapter-53-安全加固.md) | **下一章**: [Ch 55](./Chapter-55-CICD.md)

---

# 第 54 章：多平台应用部署

## 0. 本章目标

Android 部署（Keystore 签名创建→APK split per ABI→AAB App Bundle→Google Play Console 内部/封闭/正式发布三级流程）、iOS 部署（Xcode Archive→证书与 Provisioning Profile→TestFlight 内部测试→App Store Connect 提交→审核指南要点）、Web 部署（PWA 配置 manifest.json+Service Worker→Firebase Hosting→自定义域名）、桌面部署（Windows MSIX/macOS DMG 签名公证/Linux AppImage Snap Flatpak）、应用图标（flutter_launcher_icons 全平台）+ 闪屏（flutter_native_splash）。

---

## 1. Android

```bash
keytool -genkey -v -keystore library-keystore.jks -alias library -keyalg RSA -keysize 2048 -validity 10000
# 在 android/key.properties 存储密钥信息（不提交 Git）

flutter build appbundle --release --obfuscate --split-debug-info=./debug-info
# Google Play Console: 创建应用→上传 AAB→内部测试→封闭测试→生产发布
```

## 2. iOS

```bash
flutter build ipa --export-method app-store --export-team-id YOUR_TEAM_ID
# Xcode: Product→Archive→Distribute App→TestFlight→提交审核
# 审核要点：隐私标签、崩溃率 < 1%、不使用废弃 API
```

## 3. Web

```bash
flutter build web --wasm --base-href /
firebase init hosting
firebase deploy --only hosting
```

## 4. 桌面

```bash
flutter build windows --release    # → build/windows/runner/Release/
flutter build macos --release      # → build/macos/Build/Products/Release/
flutter build linux --release      # → build/linux/release/bundle/
```

## 5. 应用图标 + 闪屏

```yaml
# pubspec.yaml dev_dependencies:
flutter_launcher_icons: ^0.14.0
flutter_native_splash: ^2.4.0
```

```bash
flutter pub run flutter_launcher_icons   # 生成全平台图标
flutter pub run flutter_native_splash:create  # 生成闪屏
```

## 6. 环境配置

```bash
flutter build appbundle --dart-define=ENV=prod --dart-define=SUPABASE_URL=https://xxx.supabase.co
```

---

> **下一步**: [Ch 55](./Chapter-55-CICD.md)
