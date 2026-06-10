# 附录 B：Flutter CLI 命令速查

> 原文: [docs.flutter.cn/reference/flutter-cli](https://docs.flutter.cn/reference/flutter-cli)

## 创建与运行

| 命令 | 说明 |
|------|------|
| `flutter create my_app` | 创建新项目 |
| `flutter create --empty` | 创建最小项目（无默认代码） |
| `flutter create --template module` | 创建 Flutter 模块（Add-to-App） |
| `flutter run` | 在连接设备上运行 |
| `flutter run -d chrome` | 指定在 Chrome 运行 |
| `flutter run --release` | Release 模式运行 |

## 构建

| 命令 | 说明 |
|------|------|
| `flutter build apk` | 构建 Android APK |
| `flutter build apk --split-per-abi` | 按 ABI 拆分（减小体积） |
| `flutter build appbundle` | 构建 Android AAB |
| `flutter build ipa` | 构建 iOS IPA |
| `flutter build web` | 构建 Web |
| `flutter build web --wasm` | WebAssembly 编译 |
| `flutter build windows/macos/linux` | 构建桌面 |

## 分析检查

| 命令 | 说明 |
|------|------|
| `flutter analyze` | 静态分析（= dart analyze） |
| `flutter format lib/` | 格式化（= dart format） |
| `flutter test` | 运行测试（= dart test） |
| `flutter test --coverage` | 测试+覆盖率 |
| `flutter doctor -v` | 环境体检（详细输出） |
| `flutter devices` | 列出可用设备 |
| `flutter emulators` | 列出可用模拟器 |
| `flutter emulators --launch Pixel_7` | 启动指定模拟器 |
| `flutter clean` | 清除构建缓存 |
| `flutter pub get` | 获取依赖 |
| `flutter pub upgrade` | 升级依赖 |
| `flutter pub outdated` | 检查过时依赖 |
| `flutter config --enable-web` | 启用 Web 支持 |
| `flutter gen-l10n` | 生成本地化代码 |
