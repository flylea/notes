# 第 61 章：CI/CD 持续集成与部署

> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 60 — 多平台部署](./Chapter-60-多平台部署.md)
> **下一章**: [Chapter 62 — AI 开发](./Chapter-62-AI开发.md)

---

## 0. 本章目标

- 配置 GitHub Actions PR 质量门禁（analyze → format → test → coverage）
- 掌握 Fastlane 自动化构建与发布
- 理解 Codemagic 与 GitHub Actions 的混合方案
- 实现自动版本号管理

> 🎯 **本章产出**：Library App 的完整 CI/CD 流水线。

---

## 1. PR 质量门禁

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks

on:
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.44.0'
          channel: 'stable'

      - name: Install dependencies
        run: flutter pub get

      - name: Static analysis
        run: flutter analyze

      - name: Check formatting
        run: dart format --set-exit-if-changed lib/ test/

      - name: Run tests
        run: flutter test --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: coverage/lcov.info
          fail_ci_if_error: false
```

---

## 2. Android CD（Fastlane）

```ruby
# android/fastlane/Fastfile
platform :android do
  desc 'Deploy to Google Play Internal Testing'
  lane :deploy_internal do
    gradle(
      task: 'bundleRelease',
      properties: {
        'android.injected.signing.store.file' => ENV['KEYSTORE_PATH'],
        'android.injected.signing.store.password' => ENV['KEYSTORE_PASSWORD'],
        'android.injected.signing.key.alias' => ENV['KEY_ALIAS'],
        'android.injected.signing.key.password' => ENV['KEY_PASSWORD'],
      }
    )
    upload_to_play_store(
      package_name: 'com.library.app',
      track: 'internal',
      release_status: 'completed',
    )
  end
end
```

```yaml
# .github/workflows/deploy-android.yml
name: Deploy Android

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version: '3.44.0' }

      - name: Decode Keystore
        run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > android/app/upload-keystore.jks

      - name: Decode Google Play credentials
        run: echo "${{ secrets.PLAY_STORE_JSON_BASE64 }}" | base64 -d > android/fastlane/play-store.json

      - name: Build & Deploy
        run: |
          flutter pub get
          cd android && bundle exec fastlane deploy_internal
```

---

## 3. iOS CD

```ruby
# ios/fastlane/Fastfile
platform :ios do
  desc 'Build and upload to TestFlight'
  lane :beta do
    match(
      type: 'appstore',
      readonly: true,
    )
    build_app(
      workspace: 'Runner.xcworkspace',
      scheme: 'Runner',
      export_method: 'app-store',
    )
    upload_to_testflight(
      skip_waiting_for_build_processing: true,
    )
  end
end
```

### Fastlane Match —— iOS 证书管理最佳实践

```bash
# 初始化（只需一次）
fastlane match init
fastlane match appstore --readonly false

# CI 中使用已加密的证书
fastlane match appstore --readonly true
```

Match 将证书和 Provisioning Profile 加密存储在私有 Git 仓库中，CI 自动拉取。这是 iOS 证书管理的最佳实践——告别手动导出 `.p12` 文件的痛苦。

---

## 4. 多环境构建

```yaml
# .github/workflows/deploy-staging.yml
jobs:
  staging:
    steps:
      - run: |
          flutter build appbundle --release \
            --dart-define=ENV=staging \
            --dart-define=SUPABASE_URL=${{ secrets.STAGING_SUPABASE_URL }} \
            --dart-define=SUPABASE_ANON_KEY=${{ secrets.STAGING_ANON_KEY }}
```

---

## 5. GitHub Secrets 管理

在仓库 Settings → Secrets and variables → Actions 中配置：

| Secret | 用途 |
|--------|------|
| `KEYSTORE_BASE64` | Android 签名密钥（Base64 编码） |
| `KEYSTORE_PASSWORD` / `KEY_PASSWORD` / `KEY_ALIAS` | 密钥密码 |
| `PLAY_STORE_JSON_BASE64` | Google Play 服务账号 JSON |
| `MATCH_PASSWORD` | Fastlane Match 加密密码 |
| `SENTRY_DSN` | Sentry 项目 DSN |
| `CODECOV_TOKEN` | Codecov 上传 Token |

---

## 6. 自动版本号

```yaml
- name: Bump version
  if: github.ref == 'refs/heads/main'
  run: |
    VERSION=$(grep 'version:' pubspec.yaml | head -1 | awk '{print $2}' | cut -d'+' -f1)
    echo "APP_VERSION=$VERSION" >> $GITHUB_ENV

- name: Create Git Tag
  run: |
    git tag v$APP_VERSION
    git push origin v$APP_VERSION
```

---

## 7. Codemagic 混合方案

| 场景 | 推荐方案 |
|------|---------|
| PR 质量检查 | GitHub Actions（免费 Linux runner） |
| Android 构建 | GitHub Actions 或 Codemagic |
| iOS 构建 | Codemagic（Apple Silicon——构建速度 2x） |
| 定时 E2E 测试 | Codemagic 或 GitHub Actions scheduled trigger |

```yaml
# 在 GitHub Actions 中触发 Codemagic CD
- uses: codemagic-ci-cd/trigger-codemagic-workflow-action@v2
  with:
    app-id: ${{ secrets.CODEMAGIC_APP_ID }}
    workflow-id: ios-deploy
    token: ${{ secrets.CODEMAGIC_API_TOKEN }}
```

---

## 8. 本章练习

1. 为 Library App 配置 `.github/workflows/pr-checks.yml`
2. 本地运行 `flutter analyze && flutter test` 确认门禁可通过
3. 提交一个 PR，观察 GitHub Actions 自动运行质量检查
4. **选做**：配置 Fastlane + GitHub Actions Android CD 流水线

验证：PR 页面看到 ✅ All checks passed。

---

> 📖 **延伸阅读**: [GitHub Actions 文档](https://docs.github.com/en/actions) | [Fastlane 文档](https://docs.fastlane.tools) | [Codemagic Flutter CI/CD](https://docs.codemagic.io/flutter/overview/)
