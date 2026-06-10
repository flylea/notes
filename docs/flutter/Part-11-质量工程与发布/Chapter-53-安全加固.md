> **Part**: Part XI | **上一章**: [Ch 52](./Chapter-52-错误处理与监控.md) | **下一章**: [Ch 54](./Chapter-54-多平台部署.md)

---

# 第 53 章：应用安全加固

## 0. 本章目标

代码混淆（`--obfuscate --split-debug-info`——Dart 混淆 vs 原生混淆）、Supabase RLS 安全原则（anonKey 可公开提取、RLS 是唯一安全防线）、证书固定（http_certificate_pinning——防止中间人攻击）、Root/越狱检测（flutter_jailbreak_detection）、敏感数据分类加密（Token→SecureStorage / PII→加密数据库）、OWASP Mobile Top 10 安全审计清单。

---

## 1. 代码混淆

```bash
# Android
flutter build apk --obfuscate --split-debug-info=./debug-info
flutter build appbundle --obfuscate --split-debug-info=./debug-info

# iOS（自动启用——Release 模式下 Dart 代码默认混淆）
flutter build ipa --obfuscate --split-debug-info=./debug-info --export-method app-store
```

**注意**：混淆仅针对 Dart 层代码。原生 Android（ProGuard/R8）和 iOS（strip）需单独配置。

## 2. Supabase RLS——唯一安全防线

```
⚠️ 核心认知：anonKey 内嵌在 App 二进制中，任何人都能提取
            → 安全不依赖隐藏 key，而是依赖 Row Level Security
```

```sql
-- ✅ 正确的安全策略：每个表都启用 RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
-- 只允许管理员增删改
CREATE POLICY books_manage ON books FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

## 3. 证书固定 + Root 检测

```dart
final isSecure = await HttpCertificatePinning.check(serverURL: 'https://api.library.app', allowedSHAFingerprints: ['SHA256:...'], timeout: 60);
if (!isSecure) throw SecurityException('证书验证失败');

final isCompromised = await FlutterJailbreakDetection.jailbroken;
if (isCompromised == true) showSecurityWarning();  // 提示但不强制阻止——可能误判
```

## 4. OWASP Mobile Top 10 快速审计

| # | 风险 | Library App 对策 |
|---|------|-----------------|
| M1 | 不安全的凭证存储 | Token → flutter_secure_storage |
| M2 | 不安全的网络通信 | HTTPS + 证书固定 |
| M3 | 不安全的认证 | Supabase Auth PKCE |
| M4 | 不安全的授权 | RLS (USING + WITH CHECK) |
| M5 | 代码完整性 | 混淆 + Google Play App Integrity API |
| M6 | 敏感数据泄露 | 日志关闭在生产环境；不打印 Token |

---

> **下一步**: [Ch 54](./Chapter-54-多平台部署.md)
