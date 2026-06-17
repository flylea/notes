> **Part**: Part X — 平台集成与设备能力
> **上一章**: [Chapter 49 — 平台通道](./Chapter-49-平台通道.md)
> **下一章**: [Chapter 51 — 桌面端](./Chapter-51-桌面端.md)
> **官方文档**: [flutter.cn/platform-integration](https://docs.flutter.cn/platform-integration)

---

# 第 50 章：设备功能集成

## 0. 本章目标

image_picker（相机/相册+权限）、file_picker（文件选择+CSV导入导出）、share_plus（系统分享菜单）、url_launcher（外部浏览器/拨号/邮件/地图）、Clipboard、permission_handler（运行时权限+被拒引导设置）。

> 🎯 **Library App 产出**：相机扫描 ISBN 条码→自动填入图书表单、CSV 批量导入图书数据、导出借阅记录为 CSV 并分享、图书封面拍照上传、URL Launcher 打开图书购买链接。

---

## 1. image_picker——相机/相册

```dart
// lib/core/device/camera_service.dart
class CameraService {
  final ImagePicker _picker = ImagePicker();

  Future<File?> takePhoto() async {
    // ① 检查权限
    final status = await Permission.camera.status;
    if (!status.isGranted) {
      final result = await Permission.camera.request();
      if (!result.isGranted) return null;
    }
    // ② 拍照
    final photo = await _picker.pickImage(source: ImageSource.camera, maxWidth: 1024, maxHeight: 1024, imageQuality: 85);
    return photo != null ? File(photo.path) : null;
  }

  Future<File?> pickFromGallery() async {
    final photo = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 2048);
    return photo != null ? File(photo.path) : null;
  }
}
```

## 2. file_picker——文件导入导出

```dart
class FileService {
  /// CSV 批量导入图书
  Future<List<Book>> importBooksFromCsv() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['csv']);
    if (result == null) return [];

    final file = File(result.files.single.path!);
    final content = await file.readAsString();
    return _parseCsvToBooks(content);
  }

  List<Book> _parseCsvToBooks(String csv) {
    final lines = csv.split('\n').skip(1); // 跳过表头
    return lines.where((l) => l.trim().isNotEmpty).map((line) {
      final cols = line.split(',');
      return Book(title: cols[0].trim(), author: cols[1].trim(), isbn: cols[2].trim(), /* ... */);
    }).toList();
  }

  /// 导出借阅记录为 CSV 文件
  Future<String?> exportBorrowRecordsToCsv(List<BorrowRecord> records) async {
    final csv = '标题,作者,借阅日期,到期日期,状态\n${records.map((r) => '${r.bookTitle},${r.bookAuthor},${r.borrowDate},${r.dueDate},${r.status.label}').join('\n')}';
    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/borrow_records_${DateTime.now().millisecondsSinceEpoch}.csv');
    await file.writeAsString(csv);
    return file.path;
  }
}
```

## 3. share_plus——系统分享

```dart
Future<void> shareBook(Book book) async {
  await Share.share(
    '📚 推荐：《${book.title}》by ${book.author}\nhttps://library.app/book/${book.id}',
    subject: '图书推荐: ${book.title}',
  );
}

// 分享文件
Future<void> shareFile(String filePath) async {
  await Share.shareXFiles([XFile(filePath)], text: '借阅记录导出');
}
```

## 4. url_launcher

```dart
Future<void> openBookStore(Book book) async {
  final url = Uri.parse('https://bookstore.example.com/search?isbn=${book.isbn}');
  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }
}
// 拨号/邮件/地图：tel:+123456789 / mailto:user@example.com / https://maps.google.com/?q=...
```

## 5. permission_handler

```dart
Future<bool> requestCameraPermission() async {
  final status = await Permission.camera.request();
  if (status.isGranted) return true;
  if (status.isPermanentlyDenied) {
    // 引导用户去系统设置开启
    await openAppSettings();
  }
  return false;
}
```

## 6. 常见错误

```dart
// ❌ Android 忘记在 AndroidManifest.xml 声明权限→拍照崩溃
// <uses-permission android:name="android.permission.CAMERA"/>

// ❌ iOS 忘记在 Info.plist 添加隐私描述→权限弹框不显示
// <key>NSCameraUsageDescription</key><string>用于扫描ISBN条码录入图书</string>

// ❌ 分享时忘记文件权限→其他 App 无法读取
// ✅ 使用 path_provider 的公开目录或临时目录
```

---

## 7. 常见错误与最佳实践

| 常见错误 | 后果 | 正确做法 |
|---------|------|---------|
| Android 忘记在 `AndroidManifest.xml` 声明权限 | 调用 `ImagePicker` / `Permission.camera.request()` 时崩溃 | 每次添加设备功能时检查并添加对应 `<uses-permission>` 标签 |
| iOS 忘记在 `Info.plist` 添加隐私描述 | 权限弹窗不显示，`Permission` 返回 `permanentlyDenied` | 为每个权限添加 `NSCameraUsageDescription` 等带中文说明的 key |
| `image_picker` 拍照后不检查 `photo` 是否为 null | 用户取消拍照时返回 null，后续代码空指针 | 始终 `if (photo != null) ... else 提示用户取消` |
| CSV 导入不跳过表头行 | 表头行被当作数据解析，格式错误 | 使用 `csv.split('\n').skip(1)` 跳过第一行 |
| 分享文件时不使用公共目录 | 其他 App 无权限读取，分享失败 | 使用 `getApplicationDocumentsDirectory` 或临时目录存放分享文件 |

**最佳实践**：

- 权限请求三步骤：检查 `status` → 请求 `request()` → 永久拒绝则引导 `openAppSettings()`
- `image_picker` 的 `maxWidth`/`maxHeight` 限制图片尺寸，减少内存和上传时间
- 文件选择用 `file_picker` 的 `type: FileType.custom` + `allowedExtensions` 精确过滤
- `share_plus` 分享文本用 `Share.share()`，分享文件用 `Share.shareXFiles()`
- `url_launcher` 跳转前务必用 `canLaunchUrl()` 检查，避免异常
- `permission_handler` 的 `isPermanentlyDenied` 判断后引导用户去设置页面
- 所有平台配置（AndroidManifest / Info.plist）在集成阶段就完成，不要留到发布前

## 8. 本章练习

1. 为 Library App 实现拍照录入图书封面：在新增图书表单页添加"拍照上传封面"按钮，点击后通过 `image_picker` 的 `ImagePicker().takePhoto()` 打开相机，拍照前使用 `permission_handler` 的 `Permission.camera.request()` 请求权限（iOS 在 Info.plist 添加 `NSCameraUsageDescription`），拍照后将文件上传到 Supabase Storage 并更新封面 URL 预览
2. 实现 Library App 的 CSV 批量导入图书：使用 `file_picker` 的 `FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['csv'])` 选择 CSV 文件，读取文件后解析 isbn/title/author/category 列，调用 Supabase `from('books').upsert(records)` 批量写入，用 `showSnackBar` 反馈"成功导入 N 条，跳过 M 条"
3. 为 Library App 的图书详情页添加分享和外部链接功能：使用 `share_plus` 的 `Share.share('《$title》- $author\nISBN: $isbn')` 分享图书信息到系统分享菜单；使用 `url_launcher` 的 `launchUrl(Uri.parse('https://search.jd.com/Search?keyword=$isbn'))` 在浏览器中打开京东搜索结果，`canLaunchUrl` 检查后再跳转

验证：拍照后封面预览在表单中正确显示；CSV 导入进度用 SnackBar 反馈条数准确；分享菜单能唤起系统原生分享面板

---

> **下一步**: [Chapter 51 — 桌面端](./Chapter-51-桌面端.md)
> 📖 **延伸阅读**: [image_picker](https://pub.dev/packages/image_picker) | [file_picker](https://pub.dev/packages/file_picker) | [share_plus](https://pub.dev/packages/share_plus)
