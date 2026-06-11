> **Part**: Part III — 导航与路由
> **上一章**: [Chapter 15 — GoRouter 声明式路由](./Chapter-15-GoRouter声明式路由.md)
> **下一章**: [Part IV — 网络与数据](../Part-04-网络与数据/)
> **官方文档**: [flutter.cn/ui/navigation/deep-linking](https://docs.flutter.cn/ui/navigation/deep-linking) | [flutter.cn/ui/navigation/url-strategies](https://docs.flutter.cn/ui/navigation/url-strategies)

---

# 第 16 章：深度链接与 URL 策略

## 0. 本章目标与前置依赖

**前置依赖**：已完成 GoRouter 配置（Chapter 11），理解 Android/iOS 项目中的平台配置文件（Chapter 1）。

**本章目标**：
- 理解深度链接的三种形式（自定义 Scheme / Universal Link / App Link）
- 掌握 Android App Links 的完整配置（AndroidManifest intent-filter + assetlinks.json）
- 掌握 iOS Universal Links 的完整配置（Associated Domains + apple-app-site-association）
- 掌握 Web URL 策略配置（PathUrlStrategy vs HashUrlStrategy）
- 掌握 GoRouter 与深度链接的原生集成
- 理解 Supabase OAuth PKCE 回调与深度链接的协作
- 掌握深度链接的测试方法

> 🎯 **本章会在图书馆 App 中做什么**：配置深度链接，让用户可以从外部链接（如 `https://library.app/book/123`）直接打开 App 并跳转到对应图书详情页；配置 Supabase 登录回调深度链接；实现分享图书链接功能。

---

## 1. 深度链接三种形式

| 形式 | URL 格式 | 行为 | 安全性 | 适用平台 |
|------|---------|------|--------|---------|
| **自定义 Scheme** | `libraryapp://book/123` | App 已安装→打开 App；未安装→无反应 | 低（任何 App 都能注册相同 scheme） | 开发测试 / 内部应用 |
| **Android App Links** | `https://library.app/book/123` | App 已安装→打开 App；未安装→浏览器打开 | 高（需网站验证所有权） | Android |
| **iOS Universal Links** | `https://library.app/book/123` | App 已安装→打开 App；未安装→浏览器打开 | 高（需网站验证所有权） | iOS |

**关键区别**：自定义 Scheme（`libraryapp://`）不需要网站验证，但两个 App 可以注册相同的 scheme——系统无法区分。Universal Links / App Links（`https://`）需要网站验证所有权，更安全，且 App 未安装时自动回退到浏览器——**生产环境必须使用 Universal Links / App Links**。

---

## 2. Web URL 策略

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:url_strategy/url_strategy.dart';
import 'app.dart';

void main() {
  // 设置 URL 策略——去掉 URL 中的 # 号
  // 默认（HashUrlStrategy）: https://library.app/#/book/123
  // PathUrlStrategy:          https://library.app/book/123
  setPathUrlStrategy();

  WidgetsFlutterBinding.ensureInitialized();
  runApp(const LibraryApp());
}
```

```yaml
# pubspec.yaml
dependencies:
  url_strategy: ^0.3.0
```

> **TS 经验**：`setPathUrlStrategy()` ≈ 从 Hash Router 切换到 Browser Router——URL 更干净，SEO 更友好。

---

## 3. Android App Links 配置

### 3.1 AndroidManifest.xml

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application>
    <activity
      android:name=".MainActivity"
      android:launchMode="singleTop">

      <!-- ① 标准 intent-filter（Flutter 默认生成） -->
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>

      <!-- ② 深度链接 intent-filter -->
      <intent-filter android:autoVerify="true">
        <!-- android:autoVerify="true" → Android 验证网站所有权 -->
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />

        <!-- 匹配的 URL 模式 -->
        <data
          android:scheme="https"
          android:host="library.app"
          android:pathPrefix="/book" />
        <data
          android:scheme="https"
          android:host="library.app"
          android:pathPrefix="/profile" />
      </intent-filter>

      <!-- ③ OAuth 回调 scheme（用于 Supabase 登录回调） -->
      <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="io.library.app" android:host="login-callback" />
      </intent-filter>
    </activity>
  </application>
</manifest>
```

### 3.2 网站验证 — assetlinks.json

在网站 `https://library.app/.well-known/assetlinks.json` 部署：

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.library.app",
      "sha256_cert_fingerprints": [
        "YOUR_APP_SIGNING_CERTIFICATE_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

获取 SHA256 指纹：

```bash
# 从 keystore 获取（release）
keytool -list -v -keystore your-keystore.jks -alias your-alias

# 从 APK 获取（debug）
keytool -printcert -jarfile app-debug.apk
```

---

## 4. iOS Universal Links 配置

### 4.1 Xcode 中启用 Associated Domains

1. 打开 `ios/Runner.xcworkspace`
2. Runner → Signing & Capabilities → + → Associated Domains
3. 添加：`applinks:library.app`

### 4.2 Info.plist

```xml
<!-- ios/Runner/Info.plist -->
<key>CFBundleURLTypes</key>
<array>
  <!-- OAuth 回调 scheme -->
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>io.library.app</string>
    </array>
  </dict>
</array>

<key>FlutterDeepLinkingEnabled</key>
<true/>
```

### 4.3 网站验证 — apple-app-site-association

在网站 `https://library.app/.well-known/apple-app-site-association` 部署：

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.library.app",
        "paths": [
          "/book/*",
          "/profile",
          "/search"
        ]
      }
    ]
  }
}
```

> 文件必须：① 可通过 HTTPS 访问；② 无文件扩展名（不是 `.json`）；③ Content-Type 为 `application/json`

---

## 5. GoRouter 处理深度链接

GoRouter 原生支持深度链接——当 App 被外部 URL 打开时，GoRouter 自动解析 URL 并导航到对应的路由：

```dart
// 当用户点击 https://library.app/book/123 时：
// ① 系统判断 App 已安装 → 打开 App
// ② GoRouter 接收 URL "/book/123"
// ③ 匹配到 GoRoute(path: '/book/:bookId')
// ④ 提取 bookId = '123'
// ⑤ 渲染 BookDetailScreen

// 当用户点击 https://library.app/search?q=flutter 时：
// ① GoRouter 接收 URL "/search?q=flutter"
// ② 匹配到 GoRoute(path: '/search')
// ③ state.uri.queryParameters['q'] == 'flutter'
// ④ 渲染 SearchScreen(initialQuery: 'flutter')
```

不需要额外代码——配置好路由表和平台深度链接后，GoRouter 自动处理。

---

## 6. Supabase OAuth PKCE 回调

在 Chapter 22 我们将接入 Supabase 认证，这里先铺好深度链接回调的基础设施。

### 6.1 Supabase 中配置重定向 URL

Supabase Dashboard → Authentication → URL Configuration：

```
Site URL: https://library.app
Redirect URLs:
  io.library.app://login-callback
  https://library.app/auth/callback
```

### 6.2 Flutter 端配置

```dart
// 在 GoRouter 中添加回调路由
GoRoute(
  path: '/auth/callback',
  builder: (context, state) {
    // Supabase OAuth 完成后重定向到这里
    // 处理认证完成后的导航
    return const AuthCallbackScreen();
  },
),

// 在 Supabase 初始化时指定回调 scheme
await Supabase.initialize(
  url: 'https://your-project.supabase.co',
  anonKey: 'your-anon-key',
  authCallbackUrlHostname: 'login-callback',  // 配合 io.library.app scheme
);
```

---

## 7. 图书馆 App 实战

### 7.1 分享图书链接功能

```dart
// lib/core/deep_link/deep_link_service.dart
import 'package:share_plus/share_plus.dart';
import '../models/book.dart';

class DeepLinkService {
  static const _baseUrl = 'https://library.app';

  /// 生成图书的深度链接 URL
  static String bookDeepLink(String bookId) {
    return '$_baseUrl/book/$bookId';
  }

  /// 分享图书链接
  static Future<void> shareBook(Book book) {
    final link = bookDeepLink(book.id);
    return Share.share(
      '📚 推荐一本书：《${book.title}》by ${book.author}\n$link',
      subject: '图书推荐: ${book.title}',
    );
  }
}
```

### 7.2 在图书详情页添加分享按钮

```dart
// book_detail_screen.dart 中 AppBar actions 添加
IconButton(
  icon: const Icon(Icons.share),
  onPressed: () => DeepLinkService.shareBook(book),
  tooltip: '分享',
),
```

### 7.3 从深度链接加载图书

```dart
// 如果 App 被深度链接打开（例如 /book/123），此时 extra 为 null
// 因为 extra 只在 App 内部 pushNamed 时可用
// 需要在 builder 中处理这种情况：

GoRoute(
  path: '/book/:bookId',
  builder: (context, state) {
    final bookId = state.pathParameters['bookId']!;
    final book = state.extra as Book?;   // extra 可能为 null

    if (book != null) {
      // 内部导航——直接使用传递的 Book 对象
      return BookDetailScreen(book: book);
    } else {
      // 深度链接——需要通过 bookId 加载 Book 数据
      return BookDetailLoader(bookId: bookId);
    }
  },
);

// BookDetailLoader — 异步加载图书数据
class BookDetailLoader extends StatefulWidget {
  final String bookId;
  const BookDetailLoader({super.key, required this.bookId});

  @override
  State<BookDetailLoader> createState() => _BookDetailLoaderState();
}

class _BookDetailLoaderState extends State<BookDetailLoader> {
  late final Future<Book> _bookFuture;

  @override
  void initState() {
    super.initState();
    // 通过 Repository 加载（Chapter 25 实现）
    _bookFuture = _loadBook(widget.bookId);
  }

  Future<Book> _loadBook(String id) async {
    // TODO: 接入 Repository 后改为真实数据加载
    return sampleBooks.firstWhere((b) => b.id == id);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Book>(
      future: _bookFuture,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          return BookDetailScreen(book: snapshot.data!);
        }
        if (snapshot.hasError) {
          return Scaffold(
            appBar: AppBar(),
            body: Center(child: Text('加载失败: ${snapshot.error}')),
          );
        }
        return const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        );
      },
    );
  }
}
```

---

## 8. 深度链接测试

```bash
# Android (模拟器)
adb shell am start -a android.intent.action.VIEW \
  -c android.intent.category.BROWSABLE \
  -d "https://library.app/book/123"

# Android (自定义 scheme)
adb shell am start -a android.intent.action.VIEW \
  -d "io.library.app://login-callback"

# iOS (模拟器)
xcrun simctl openurl booted "https://library.app/book/123"

# iOS (自定义 scheme)
xcrun simctl openurl booted "io.library.app://login-callback"

# Web (浏览器中)
# 直接在浏览器地址栏输入 https://library.app/book/123
```

---

## 9. 常见错误与最佳实践

```dart
// ❌ 错误 1：只配置了自定义 scheme（libraryapp://），生产环境不可用
// ✅ 正确：生产环境用 https:// 配合网站验证

// ❌ 错误 2：assetlinks.json / apple-app-site-association 部署位置错误
// ✅ 正确位置：https://library.app/.well-known/ 下，无文件扩展名

// ❌ 错误 3：忘记处理 extra 为 null 的情况（深度链接打开时）
// ✅ 在 GoRoute builder 中检测 extra 是否为 null，必要时通过 bookId 加载数据

// ❌ 错误 4：Android intent-filter 中 host 不含 www 但网站使用 www
// ✅ 确保 host 值与网站域名完全匹配
```

---

## 10. 本章小结

| 你学到了什么 | 对标 Web | 在图书馆 App 中的体现 |
|-------------|---------|---------------------|
| 三种深度链接形式 | URL scheme / Universal Link | https://library.app/book/123 |
| Android App Links | Android intent-filter + assetlinks.json | Android 配置完成 |
| iOS Universal Links | Associated Domains + AASA | iOS 配置完成 |
| setPathUrlStrategy | Browser Router | 干净的 URL |
| GoRouter 深度链接处理 | 自动路由匹配 | bookId 提取 + 展示 |
| Supabase OAuth 回调 | OAuth redirect_uri | io.library.app://login-callback |
| extra = null 处理 | 深度链接数据加载 | BookDetailLoader |

---

## 11. 本章练习

### 练习 1：book/:id 深度链接路由处理

为图书馆 App 的图书详情路由 `/book/:bookId` 添加深度链接处理逻辑。深度链接打开时 `state.extra` 为 null，需要通过 `bookId` 加载 `Book` 数据。创建一个 `BookDetailLoader` Widget，接收 `bookId` 参数，内部用 `FutureBuilder` 异步加载图书数据并渲染 `BookDetailScreen`。当从 App 内部导航（`extra` 不为 null）时直接使用传入的 `Book` 对象。

验证：
- App 内部通过 `context.pushNamed('book-detail', extra: book, pathParameters: {'bookId': '1'})` 跳转时，不使用 `FutureBuilder`，直接显示图书信息。
- 通过 `adb shell am start` 命令模拟外部深度链接打开 `/book/1`，页面临时显示加载指示器，数据加载完成后显示正确的图书信息。
- 深度链接使用不存在的 `bookId`（如 `/book/999`）时，显示"图书未找到"错误提示，不崩溃。

### 练习 2：Android 平台深度链接配置

为 Android 平台配置深度链接。在 `AndroidManifest.xml` 中为 `MainActivity` 添加 intent-filter（`android:autoVerify="true"`），匹配 `https://library.app/book/*` 路径。同时配置自定义 scheme `libraryapp://` 用于开发调试。在 `main.dart` 入口处设置 `setPathUrlStrategy()` 去掉 URL 中的 `#` 号。

验证：
- 运行 `adb shell am start -a android.intent.action.VIEW -d "libraryapp://book/1"` 能打开 App 并跳转到对应图书详情页。
- App 在浏览器中打开时，URL 格式为 `https://library.app/book/1` 而非 `https://library.app/#/book/1`（干净路径）。
- `AndroidManifest.xml` 中包含正确的 `<intent-filter android:autoVerify="true">` 配置，`host` 和 `pathPrefix` 匹配预期域名。

### 练习 3：goBranch 导航与 Tab 间切换

使用 `StatefulShellRoute.indexedStack` + `navigationShell.goBranch()` 实现底部三 Tab 导航。在"我的" Tab 中实现"借阅历史"入口，点击后在当前 Tab 内 push 到 `/profile/history`（属于"我的"分支的子路由）。从借阅历史页切换到底部"借阅" Tab 再切回，验证借阅历史页仍保持。

验证：
- 底部三 Tab（图书、借阅、我的）均能正常切换，切换时不出现页面闪烁或重建。
- 在"我的" Tab 中进入借阅历史页，切换到"借阅" Tab 后切回"我的" Tab，借阅历史页仍在栈顶（独立导航栈生效）。
- 再次点击已在当前选中的 Tab（例如已在"图书" Tab 再次点击"图书"），跳转到该分支的初始路由 `/`，不重复 push。

---

> **下一步**: [Part IV — 状态管理（Chapter 13）](../Part-04-状态管理/)
> **原始文档**: [flutter.cn/ui/navigation/deep-linking](https://docs.flutter.cn/ui/navigation/deep-linking) | [supabase.com/docs/guides/auth/native-mobile-deep-linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
