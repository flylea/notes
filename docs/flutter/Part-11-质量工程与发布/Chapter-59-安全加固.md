# 第 59 章：应用安全加固

> **Part**: Part XI — 质量工程与发布
> **上一章**: [Chapter 58 — 错误处理与监控](./Chapter-58-错误处理与监控.md)
> **下一章**: [Chapter 60 — 多平台部署](./Chapter-60-多平台部署.md)

---

## 0. 本章目标

- 掌握 Dart 代码混淆 + ProGuard/R8 原生混淆配置
- 理解 Supabase RLS 是安全唯一防线（anonKey 可公开提取）
- 学会证书固定（Certificate Pinning）防中间人攻击
- 掌握敏感数据分类加密策略
- 了解 OWASP Mobile Top 10 安全审计

---

## 1. 多层混淆策略

### Dart 代码混淆

```bash
# Android
flutter build appbundle --release --obfuscate --split-debug-info=./debug-info

# iOS
flutter build ipa --obfuscate --split-debug-info=./debug-info --export-method app-store
```

**⚠️ 关键**：`--split-debug-info` 生成的符号文件必须安全保存，否则 Sentry 无法还原混淆后的堆栈跟踪。

### Android ProGuard/R8 配置

```proguard
# android/app/proguard-rules.pro

# 保留 Flutter 框架
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }

# 保留你的数据模型（freezed 生成的类）
-keep class com.library.app.models.** { *; }

# 移除日志（生产环境）
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
```

### iOS 原生安全

```xml
<!-- ios/Runner/Info.plist -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>  <!-- 禁止 HTTP，强制 HTTPS -->
</dict>
```

---

## 2. Supabase RLS —— 唯一安全防线

> ⚠️ **核心认知**: `anonKey` 内嵌在 App 二进制中，任何人都可以提取。**安全不依赖隐藏 key，而是依赖 RLS（Row Level Security）。**

```sql
-- ✅ 每个表都启用 RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能读自己的 Profile
CREATE POLICY "profiles_read_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 管理员可读所有
CREATE POLICY "profiles_read_admin" ON public.profiles
  FOR SELECT USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ✅ 始终使用 USING + WITH CHECK 双重检查
CREATE POLICY "books_insert_own" ON public.borrow_records
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT available_copies FROM books WHERE id = book_id) > 0
  );
```

---

## 3. 证书固定（Certificate Pinning）

```dart
// pubspec.yaml
// dependencies:
//   http_certificate_pinning: ^2.0.0

import 'package:http_certificate_pinning/http_certificate_pinning.dart';

Future<bool> checkCertificate() async {
  final secure = await HttpCertificatePinning.check(
    serverURL: 'https://api.library.app',
    allowedSHAFingerprints: ['SHA256:AB:CD:EF:...'],
    timeout: 60,
  );
  if (!secure) throw SecurityException('证书验证失败——可能遭受中间人攻击');
  return secure;
}
```

> 证书固定的维护成本：证书过期前必须更新 App 中的指纹。对大多数应用来说，**标准的 HTTPS + RLS 已足够安全**。

---

## 4. 敏感数据加密策略

| 数据类型 | 存储位置 | 加密方案 |
|---------|---------|---------|
| Auth Token | flutter_secure_storage | 系统 Keychain/KeyStore（已加密） |
| 用户 PII（姓名/邮箱） | Drift 本地数据库 | 加密 SQLCipher（drift 支持） |
| API 响应缓存 | SharedPreferences | 不缓存敏感字段 |
| 磁盘上的临时文件 | dart:io File | 用完即删；不存储敏感信息 |

```dart
// 加密 Drift 数据库
import 'package:drift/native.dart';

final db = AppDatabase(
  NativeDatabase(
    File('db.sqlite'),
    setup: (db) async {
      await db.execute("PRAGMA key = '$encryptionKey'");
    },
  ),
);
```

---

## 5. Root/越狱检测

```dart
import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';

Future<void> checkDeviceSecurity() async {
  final compromised = await FlutterJailbreakDetection.jailbroken;
  if (compromised == true) {
    // 提示用户而非强制阻止（可能误判）
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('安全提示'),
        content: const Text('检测到设备可能已被破解。敏感操作（如借阅）将受到限制。'),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('了解'))],
      ),
    );
  }
}
```

---

## 6. OWASP Mobile Top 10 审计清单

| # | 风险 | Library App 对策 |
|---|------|-----------------|
| M1 | 不安全的凭证存储 | Token → flutter_secure_storage（系统 Keychain/KeyStore） |
| M2 | 不安全的网络通信 | HTTPS + 证书固定（可选） |
| M3 | 不安全的认证 | Supabase Auth PKCE 流程 |
| M4 | 不安全的授权 | RLS 双重检查（USING + WITH CHECK） |
| M5 | 不安全的加密 | 不自己实现加密算法——使用 vetted 库 |
| M6 | 不安全的数据存储 | Drift + SQLCipher 加密；敏感 PII 不缓存 |
| M7 | 代码完整性 | 混淆 + Play Integrity API / App Attest |
| M8 | 敏感数据泄露 | 生产环境关闭详细日志；不打印 Token/密码 |
| M9 | 键盘记录风险 | 自定义键盘场景下验证输入源 |
| M10 | 过时的依赖 | `flutter pub outdated` 定期检查 CVE |

---

## 7. 本章练习

1. 为 Library App 配置 Android ProGuard 规则
2. 审查所有 Supabase 表的 RLS 策略（确认没有遗漏启用 RLS 的表）
3. 确认所有 Token 和敏感信息存储在 flutter_secure_storage 而非 SharedPreferences
4. 运行 `flutter pub outdated` 检查已弃用的依赖

---

> 📖 **延伸阅读**: [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/) | [Flutter 安全最佳实践](https://docs.flutter.dev/security)
