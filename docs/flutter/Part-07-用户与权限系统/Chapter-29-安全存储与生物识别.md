> **Part**: Part VII — 用户与权限系统
> **上一章**: [Chapter 28 — Supabase Auth 认证体系](./Chapter-28-Supabase-Auth认证体系.md)
> **下一章**: [Chapter 30 — RBAC 权限管理与角色系统](./Chapter-30-RBAC权限管理.md)
> **官方文档**: [pub.dev/packages/flutter_secure_storage](https://pub.dev/packages/flutter_secure_storage) | [pub.dev/packages/local_auth](https://pub.dev/packages/local_auth)

---

# 第 29 章：安全存储与生物识别

## 0. 本章目标

掌握 flutter_secure_storage（iOS Keychain / Android EncryptedSharedPreferences）、敏感数据分类策略（Token→SecureStorage / 偏好→SharedPreferences）、local_auth 生物识别（指纹/Face ID）、生物识别+Token 解锁流程、隐私锁屏。

> 🎯 **Library App 产出**：Secure Storage 存储 Supabase Token、生物识别登录开关（设置页）、隐私锁屏（App 后台回来要求指纹验证）。

---

## 1. flutter_secure_storage — 敏感数据加密存储

```dart
// lib/core/security/secure_storage_service.dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // Token 管理
  Future<void> saveToken(String key, String value) =>
      _storage.write(key: key, value: value);
  Future<String?> readToken(String key) => _storage.read(key: key);
  Future<void> deleteToken(String key) => _storage.delete(key: key);

  // 敏感设置
  Future<void> setBiometricEnabled(bool enabled) =>
      _storage.write(key: 'biometric_enabled', value: enabled.toString());
  Future<bool> isBiometricEnabled() async {
    final value = await _storage.read(key: 'biometric_enabled');
    return value == 'true';
  }

  Future<void> clearAll() => _storage.deleteAll();
}
```

## 2. 数据分类策略

| 数据类型 | 存储方案 | 示例 |
|---------|---------|------|
| 认证 Token | flutter_secure_storage | access_token / refresh_token |
| 用户偏好 | SharedPreferences | 主题/语言/排序方式 |
| 缓存数据 | Drift 数据库 | 图书列表/搜索历史 |
| 文件 | 应用私有目录 | 下载的图书封面 |

## 3. local_auth — 生物识别

```dart
// lib/core/security/biometric_service.dart
import 'package:local_auth/local_auth.dart';

class BiometricService {
  final _auth = LocalAuthentication();

  // ① 检查设备是否支持生物识别
  Future<bool> get isAvailable async => await _auth.canCheckBiometrics && await _auth.isDeviceSupported();

  // ② 获取可用的生物识别类型
  Future<List<BiometricType>> get availableBiometrics => _auth.getAvailableBiometrics();

  // ③ 执行生物识别认证
  Future<bool> authenticate({required String reason}) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,      // 切后台回来保持认证状态
          biometricOnly: true,   // 仅生物识别，不允许 PIN/图案
        ),
      );
    } catch (_) {
      return false;
    }
  }
}
```

## 4. 隐私锁屏流程

```dart
// App 生命周期监听 + 生物识别重新验证
class PrivacyLockWidget extends ConsumerStatefulWidget { ... }
class _State extends ConsumerState<PrivacyLockWidget> with WidgetsBindingObserver {
  DateTime? _backgroundTime;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _backgroundTime = DateTime.now();  // 记录进入后台时间
    }
    if (state == AppLifecycleState.resumed && _backgroundTime != null) {
      final elapsed = DateTime.now().difference(_backgroundTime!);
      if (elapsed > const Duration(seconds: 30)) {
        _requireBiometricReauth();  // 超过 30 秒要求重新认证
      }
    }
  }

  Future<void> _requireBiometricReauth() async {
    final biometricEnabled = await ref.read(secureStorageProvider).isBiometricEnabled();
    if (!biometricEnabled) return;
    final success = await ref.read(biometricServiceProvider).authenticate(reason: '请验证身份以继续使用');
    if (!success && mounted) context.go('/login');
  }

  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }
}
```

---

## 5. 本章小结

Token → SecureStorage（加密），偏好 → SharedPreferences（明文），生物识别 → local_auth。隐私锁屏通过 `WidgetsBindingObserver` 监听生命周期 + 生物识别重新验证实现。

---

> **下一步**: [Chapter 30 — RBAC 权限管理与角色系统](./Chapter-30-RBAC权限管理.md)
