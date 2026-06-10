> **Part**: Part X | **上一章**: [Ch 44](./Chapter-44-平台通道.md) | **下一章**: [Ch 46](./Chapter-46-桌面端.md)
> **官方文档**: [flutter.cn/platform-integration](https://docs.flutter.cn/platform-integration)

---

# 第 45 章：设备功能集成

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

> **下一步**: [Ch 46](./Chapter-46-桌面端.md)
