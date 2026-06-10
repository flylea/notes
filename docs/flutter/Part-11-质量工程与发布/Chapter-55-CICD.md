> **Part**: Part XI | **上一章**: [Ch 54](./Chapter-54-多平台部署.md) | **下一章**: [Ch 56](./Chapter-56-AI开发.md)

---

# 第 55 章：CI/CD 持续集成与部署

## 0. 本章目标

GitHub Actions 全流程（PR 质量门禁：analyze→format--check→test→coverage report）、Fastlane 自动化（Android：Decode Keystore→Build AAB→Play Console Upload；iOS：Decode Cert→Archive→TestFlight）、Code Coverage 上报（Codecov）、Codemagic 混合方案（Actions 做 CI+Codemagic 做 CD）、版本号自动化（从 pubspec.yaml 读取 + git tag 触发）。

---

## 1. PR 质量门禁

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { flutter-version: '3.44.0' }
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter format --set-exit-if-changed lib/ test/
      - run: flutter test --coverage
      - uses: codecov/codecov-action@v4
        with: { token: ${{ secrets.CODECOV_TOKEN }}, files: coverage/lcov.info }
```

## 2. Android CD（Fastlane）

```ruby
# android/fastlane/Fastfile
platform :android do
  lane :deploy do
    gradle(task: "bundleRelease")
    upload_to_play_store(package_name: "com.library.app", track: "internal", release_status: "draft")
  end
end
```

```yaml
# .github/workflows/cd-android.yml
steps:
  - run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 -d > android/app/upload-keystore.jks
  - run: echo "${{ secrets.PLAY_STORE_JSON }}" > android/fastlane/play-store.json
  - run: cd android && bundle exec fastlane deploy
```

## 3. Codemagic 混合方案

GitHub Actions（免费 Linux runner→PR 检查） + Codemagic（Apple Silicon→iOS 构建快 2 倍）。通过 `codemagic-ci-cd/trigger-codemagic-workflow-action@v2` 在 Actions 完成后触发 Codemagic CD 流程。

## 4. 自动版本号

```yaml
- run: |
    VERSION=$(grep 'version:' pubspec.yaml | head -1 | awk '{print $2}' | cut -d'+' -f1)
    echo "APP_VERSION=$VERSION" >> $GITHUB_ENV
- run: git tag v$APP_VERSION && git push origin v$APP_VERSION
  if: github.ref == 'refs/heads/main'
```

---

> **下一步**: [Ch 56](./Chapter-56-AI开发.md)
