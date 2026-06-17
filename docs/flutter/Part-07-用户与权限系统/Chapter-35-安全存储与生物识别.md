> **Part**: Part VII — 用户与权限系统
> **上一章**: [Chapter 34 — Supabase Auth 认证体系](./Chapter-34-Supabase-Auth认证体系.md)
> **下一章**: [Chapter 36 — RBAC 权限管理](./Chapter-36-RBAC权限管理.md)
> **官方文档**: [pub.dev/packages/flutter_secure_storage](https://pub.dev/packages/flutter_secure_storage) | [pub.dev/packages/local_auth](https://pub.dev/packages/local_auth)

---

# 第 35 章：安全存储与生物识别

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

## 5. 常见错误与最佳实践

### 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|----------|
| Token 存入 `SharedPreferences` | 明文存储，root 设备可直接读取，安全性为 0 | Token 类敏感数据只用 `flutter_secure_storage` |
| `biometricOnly: false` | 用户可用设备 PIN/图案绕过生物识别认证 | 高安全场景设置 `biometricOnly: true` |
| 隐私锁屏超时硬编码 30 秒 | 用户无法调整，频繁解锁或安全性不足 | 超时时长通过 `SharedPreferences` 持久化，提供多档选项 |
| 未检查 `canCheckBiometrics` | 不支持生物识别的设备直接崩溃 | 使用前调用 `isAvailable` getter 兜底 |
| `SecureStorage` 读写无异常处理 | 部分 Android 设备 KeyStore 不可用导致崩溃 | `write`/`read` 包裹 `try-catch`，失败时降级到 `SharedPreferences`（加密） |

### 最佳实践

- 敏感数据分级：Token → `SecureStorage`，偏好 → `SharedPreferences`，缓存 → 数据库，文件 → 私有目录
- `SecureStorage` 初始化时设置 `aOptions: AndroidOptions(encryptedSharedPreferences: true)` 和 `iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock)`
- 生物识别测试必须在真机上验证（模拟器不支持），开启 TalkBack/VoiceOver 验证无障碍
- 隐私锁屏通过 `WidgetsBindingObserver` 监听 `AppLifecycleState`，记录 `_backgroundTime`
- 生物识别失败时提供"使用密码登录"的 fallback 选项，而非直接退出
- `SecureStorage.clearAll()` 在 `signOut()` 时调用，确保敏感数据完全清除
- 生物识别开关状态存放在 `SharedPreferences`（非 `SecureStorage`——属于偏好类数据）
- `stickyAuth: true` 允许切后台回来后保持认证状态，避免重复解锁

---

## 6. 本章小结

Token → SecureStorage（加密），偏好 → SharedPreferences（明文），生物识别 → local_auth。隐私锁屏通过 `WidgetsBindingObserver` 监听生命周期 + 生物识别重新验证实现。

---

## 7. 本章练习

1. **扩展 SecureStorageService**：在 `SecureStorageService` 中添加 `saveApiKey(String key, String value)` 和 `getApiKey(String key)` 方法，用于存储第三方 API Key（如 Google Books API Key）。在设置页面增加一个"API 配置"入口，允许用户输入并保存 API Key。验证标准：保存后重启 App，通过 `getApiKey` 能正确读取，且 Key 存储在 Keychain/EncryptedSharedPreferences 中而非明文。

2. **在设置页面添加生物识别开关**：在设置页面添加 `SwitchListTile` 控制生物识别登录开关，通过 `SharedPreferences`（非 SecureStorage—偏好类数据）持久化开关状态。点击开关时先调用 `BiometricService.isAvailable` 检查设备支持情况，不支持则弹出提示并保持关闭状态。验证标准：开关状态重启 App 后保持；不支持生物识别的设备（模拟器）显示"设备不支持"提示，开关不可用。

3. **可配置隐私锁屏超时**：在设置页面将硬编码的 30 秒超时替换为用户可选的超时时间（15秒/30秒/1分钟/5分钟），通过 `SharedPreferences` 持久化选择，在 `PrivacyLockWidget` 中使用 `preferencesService.lockTimeout` 替代硬编码的 `Duration(seconds: 30)`。验证标准：选择 15 秒超时后切后台 20 秒再回来，要求重新生物识别认证；选择 5 分钟超时后切后台 1 分钟再回来，无需重新认证。

验证标准：以上 3 个练习均编译通过，在真机上验证生物识别功能正常。

---

> **下一步**: [Chapter 36 — RBAC 权限管理](./Chapter-36-RBAC权限管理.md)
