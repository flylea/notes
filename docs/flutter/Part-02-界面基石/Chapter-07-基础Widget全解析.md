> **Part**: Part II — 界面基石：Widget 与布局
> **上一章**: [Chapter 06 — Widget 哲学](./Chapter-06-Widget哲学.md)
> **下一章**: [Chapter 08 — Cupertino 组件](./Chapter-08-Cupertino组件.md)
> **官方文档**: [flutter.cn/ui/widgets](https://docs.flutter.cn/ui/widgets) | [flutter.cn/ui/design/material](https://docs.flutter.cn/ui/design/material)

---

# 第 7 章：基础 Widget 全解析

## 0. 本章目标与前置依赖

**前置依赖**：理解 Widget 的概念、StatelessWidget/StatefulWidget 的区别、BuildContext（Chapter 5），能编写简单的 Dart 类和函数（Chapter 2-3）。

**本章目标**：
- 掌握 Text Widget 的全部样式能力（style/rich text/overflow/alignment）
- 掌握 Image Widget 的四种图片源和占位图/错误处理模式
- 掌握 Icon 系统和自定义图标
- 深入理解 Container 的 BoxDecoration（边框/圆角/阴影/渐变/形状）
- 掌握 Button 族（ElevatedButton/OutlinedButton/TextButton/FAB/IconButton/PopupMenuButton）的样式定制
- 掌握 Scaffold 的完整配置（AppBar/Drawer/BottomSheet/SnackBar）
- 建立 HTML/CSS 标签与 Flutter Widget 的对照关系

> 🎯 **本章会在图书馆 App 中做什么**：创建 `BookCard` 组件（封面图 + 书名 + 作者 + 评分星 + 分类标签），`BookGridItem` 网格变体，创建5本硬编码的测试数据展示在首页——让图书馆 App 从空态走向有内容的界面。

---

## 1. HTML/CSS 标签 → Flutter Widget 速查

| HTML/CSS | Flutter Widget | 说明 |
|----------|---------------|------|
| `<p>` | `Text` | 文本段落 |
| `<h1>` ~ `<h6>` | `Text('', style: TextStyle(fontSize: ...))` | 标题 |
| `<img>` | `Image` | 图片 |
| `<i class="icon">` | `Icon` | 图标 |
| `<div style="...">` | `Container` | 样式容器 |
| `<button>` | `ElevatedButton` / `TextButton` / etc. | 按钮 |
| `<a href="...">` | `GestureDetector` + `Text` + `UrlLauncher` | 链接 |
| `<span>` | `Text` (inline) / `RichText` (mixed styles) | 内联文本 |
| `background-color` | `Container(color: ...)` / `DecoratedBox` | 背景色 |
| `border-radius` | `Container(decoration: BoxDecoration(borderRadius: ...))` | 圆角 |
| `box-shadow` | `Container(decoration: BoxDecoration(boxShadow: ...))` | 阴影 |
| `background: linear-gradient(...)` | `Container(decoration: BoxDecoration(gradient: ...))` | 渐变 |

---

## 2. Text — 文本的完整掌控

### 2.1 基础文本

```dart
// 最简文本
Text('Hello Flutter');

// 带样式的文本
Text(
  'Library Management System',
  style: TextStyle(
    fontSize: 24,                     // 字号（逻辑像素）
    fontWeight: FontWeight.bold,      // 字重
    color: Colors.blueGrey[800],      // 颜色
    letterSpacing: 1.2,               // 字间距
    wordSpacing: 4.0,                  // 词间距
    height: 1.5,                       // 行高（相对于 fontSize 的倍数）
    decoration: TextDecoration.none,   // 下划线/删除线
    fontStyle: FontStyle.normal,       // 斜体
    fontFamily: 'Roboto',              // 字体族（需要在 pubspec.yaml 中声明）
  ),
);
```

### 2.2 文本溢出与截断

```dart
// 单行 → 省略号
Text(
  'This is a very long book title that might not fit in the available space',
  maxLines: 1,
  overflow: TextOverflow.ellipsis,    // 省略号 ...
  // TextOverflow.clip                // 硬截断
  // TextOverflow.fade                // 渐隐
  // TextOverflow.visible             // 溢出可见
);

// 多行截断
Text(
  bookDescription,
  maxLines: 3,
  overflow: TextOverflow.ellipsis,
);
```

### 2.3 文本对齐

```dart
Text(
  'Centered text',
  textAlign: TextAlign.center,         // 文本在可用空间内的对齐
  // TextAlign.left / right / start / end / justify / center
);
// ⚠️ textAlign 是文本内对齐 ≠ Text Widget 在父容器中的对齐
// 后者需要用 Center / Align Widget
```

### 2.4 RichText — 富文本（多种样式混合）

```dart
RichText(
  text: TextSpan(
    style: const TextStyle(fontSize: 16, color: Colors.black87),
    children: [
      const TextSpan(text: '作者：'),
      TextSpan(
        text: 'Robert C. Martin',
        style: const TextStyle(
          fontWeight: FontWeight.bold,
          color: Colors.blue,
        ),
      ),
      const TextSpan(text: '（'),
      TextSpan(
        text: 'Uncle Bob',
        style: TextStyle(
          fontStyle: FontStyle.italic,
          color: Colors.grey[600],
        ),
      ),
      const TextSpan(text: '）'),
    ],
  ),
);

// RichText ≈ HTML 中的 <span> 嵌套 + inline style
// Text.rich() — RichText 的便捷构造
Text.rich(
  TextSpan(
    text: '评分：',
    children: [
      const WidgetSpan(child: Icon(Icons.star, size: 16, color: Colors.amber)),
      const TextSpan(text: ' 4.7'),
    ],
  ),
);
```

### 2.5 TextStyle 属性速查

| 属性 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `fontSize` | `double?` | 字号（逻辑像素） | `18` |
| `fontWeight` | `FontWeight?` | 字重 | `FontWeight.bold` |
| `fontStyle` | `FontStyle?` | 斜体 | `FontStyle.italic` |
| `color` | `Color?` | 文字颜色 | `Colors.blue` |
| `letterSpacing` | `double?` | 字间距 | `1.5` |
| `wordSpacing` | `double?` | 词间距 | `3.0` |
| `height` | `double?` | 行高（倍数） | `1.5` |
| `decoration` | `TextDecoration?` | 装饰线 | `TextDecoration.underline` |
| `decorationColor` | `Color?` | 装饰线颜色 | `Colors.red` |
| `decorationStyle` | `TextDecorationStyle?` | 装饰线样式 | `TextDecorationStyle.dashed` |
| `backgroundColor` | `Color?` | 文字背景色 | `Colors.yellow[100]` |
| `fontFamily` | `String?` | 字体族 | `'RobotoMono'` |
| `shadows` | `List<Shadow>?` | 文字阴影 | `[Shadow(color: ..., offset: Offset(1,1), blurRadius: 2)]` |

---

## 3. Image — 图片加载与处理

### 3.1 四种图片源

```dart
// ① 网络图片 — 最常用
Image.network(
  'https://example.com/book-cover.jpg',
  width: 120,
  height: 180,
  fit: BoxFit.cover,          // 裁剪填充
);

// ② 资源图片 — 打包在 App 内的图片
Image.asset(
  'assets/images/logo.png',
  width: 48,
  height: 48,
);

// ③ 文件图片 — 从设备文件系统加载
Image.file(
  File('/path/to/photo.jpg'),
  width: 200,
);

// ④ 内存图片 — 从 Uint8List 字节加载
Image.memory(
  uint8ListBytes,
  width: 100,
);
```

### 3.2 BoxFit — 图片适配模式

```dart
// BoxFit 决定图片如何在给定的宽高框内显示
Image.network(
  url,
  width: 120,
  height: 180,
  fit: BoxFit.cover,           // 保持比例，裁剪超出部分（类似 CSS object-fit: cover）
  // BoxFit.contain            // 保持比例，完全显示（类似 object-fit: contain）
  // BoxFit.fill               // 拉伸填充（类似 object-fit: fill）
  // BoxFit.fitWidth           // 宽度填满，高度自适应
  // BoxFit.fitHeight          // 高度填满，宽度自适应
  // BoxFit.none               // 原始尺寸，可能溢出
  // BoxFit.scaleDown          // 缩小到能完全容纳（不放大）
);
```

### 3.3 占位图与错误处理

```dart
// 图片加载过程中的占位和错误处理
Image.network(
  bookCoverUrl,
  width: 120,
  height: 180,
  fit: BoxFit.cover,
  // 加载中的占位
  loadingBuilder: (context, child, loadingProgress) {
    if (loadingProgress == null) return child;  // 加载完成
    return Container(
      width: 120,
      height: 180,
      color: Colors.grey[200],
      child: Center(
        child: CircularProgressIndicator(
          value: loadingProgress.expectedTotalBytes != null
              ? loadingProgress.cumulativeBytesLoaded /
                  loadingProgress.expectedTotalBytes!
              : null,               // 不确定进度时显示旋转动画
        ),
      ),
    );
  },
  // 加载失败的占位
  errorBuilder: (context, error, stackTrace) {
    return Container(
      width: 120,
      height: 180,
      color: Colors.grey[200],
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.broken_image, color: Colors.grey),
          SizedBox(height: 4),
          Text('封面缺失', style: TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  },
);
```

### 3.4 图片缓存与性能

```dart
// cacheWidth/cacheHeight — 指定缓存解码尺寸（减少内存占用）
Image.network(
  coverUrl,
  cacheWidth: 300,             // 缓存时缩放到 300px 宽
  cacheHeight: 450,            // 缓存时缩放到 450px 高
  fit: BoxFit.cover,
);

// gaplessPlayback — 切换图片时无缝过渡
Image.network(
  newCoverUrl,
  gaplessPlayback: true,       // 新图加载完成前继续显示旧图
);
```

> **TS 经验**：`loadingBuilder` ≈ React Suspense + fallback。`errorBuilder` ≈ `<img onerror="...">`。`gaplessPlayback` ≈ 先显示旧 src 直到新 src 加载完成。

---

## 4. Icon — 图标系统

### 4.1 Material Icons

Flutter 内置了 Material Design 的 2000+ 图标，全部在 `Icons` 类中：

```dart
// 基础图标
Icon(Icons.star);
Icon(Icons.star, color: Colors.amber, size: 24);

// 图标按钮
IconButton(
  icon: const Icon(Icons.search),
  onPressed: () => debugPrint('搜索'),
  tooltip: '搜索',             // 长按提示（无障碍友好）

  // Material 3 风格：带背景的图标按钮
  style: IconButton.styleFrom(
    backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
  ),
);
```

### 4.2 常用图标速查（图书馆 App 场景）

```dart
// 导航与操作
Icons.search           // 搜索
Icons.add              // 添加
Icons.edit             // 编辑
Icons.delete           // 删除
Icons.close            // 关闭
Icons.arrow_back       // 返回
Icons.more_vert        // 更多（竖三点）
Icons.sort             // 排序
Icons.filter_list      // 筛选

// 图书相关
Icons.menu_book        // 图书
Icons.library_books    // 书架
Icons.bookmark         // 书签
Icons.bookmark_border  // 空书签
Icons.auto_stories     // 电子书

// 状态
Icons.check            // 完成
Icons.warning          // 警告
Icons.error            // 错误
Icons.info             // 信息
```

---

## 5. Container — 样式容器

`Container` 是 Flutter 中最通用的样式 Widget——它整合了内边距、背景、边框、圆角、阴影、渐变等功能。

### 5.1 BoxDecoration 完整配置

```dart
Container(
  // 尺寸
  width: 200,
  height: 100,
  // 内边距
  padding: const EdgeInsets.all(16),
  // 外边距
  margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
  // 对齐子 Widget
  alignment: Alignment.center,
  // BoxDecoration — 背景、边框、阴影、圆角、渐变
  decoration: BoxDecoration(
    // 背景色（与 gradient 互斥——只能用一个）
    color: Colors.blue[50],
    // 边框
    border: Border.all(
      color: Colors.blue,
      width: 2,
      // strokeAlign: BorderSide.strokeAlignInside,  // 边框向内
    ),
    // 圆角
    borderRadius: BorderRadius.circular(12),
    // 阴影
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.1),
        offset: const Offset(0, 4),
        blurRadius: 8,
        spreadRadius: 1,
      ),
    ],
    // 渐变
    // gradient: LinearGradient(
    //   begin: Alignment.topLeft,
    //   end: Alignment.bottomRight,
    //   colors: [Colors.blue, Colors.purple],
    // ),
    // 形状
    // shape: BoxShape.circle,  // 圆形
  ),
  // 变换（旋转、缩放等）
  // transform: Matrix4.rotationZ(0.1),
  child: const Text('Styled Container'),
);
```

### 5.2 Container 的组合使用模式

```dart
// ① 纯样式容器（无 child）— 用作色块/分隔线
Container(
  height: 4,
  color: Colors.blue,
);

// ② 带样式的点击容器
Container(
  decoration: BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(12),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withOpacity(0.08),
        blurRadius: 16,
        offset: const Offset(0, 4),
      ),
    ],
  ),
  child: Material(
    color: Colors.transparent,
    child: InkWell(               // 点击水波纹效果
      borderRadius: BorderRadius.circular(12),
      onTap: () => debugPrint('卡片被点击'),
      child: const Padding(
        padding: EdgeInsets.all(16),
        child: Text('Clickable Card'),
      ),
    ),
  ),
);
```

> **TS 经验**：`Container` ≈ `<div style="width:200;height:100;padding:16;margin:8;background:...;border:...;border-radius:12;box-shadow:...">` 的 CSS 属性聚合。

### 5.3 渐变效果

```dart
// 线性渐变
Container(
  width: double.infinity,
  height: 120,
  decoration: const BoxDecoration(
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [Color(0xFF667eea), Color(0xFF764ba2)],
      stops: [0.0, 1.0],           // 各颜色的位置（0.0-1.0）
    ),
  ),
);

// 径向渐变
BoxDecoration(
  gradient: RadialGradient(
    center: Alignment.center,
    radius: 0.8,
    colors: [Colors.white, Colors.blue[100]!],
  ),
);

// 扫描渐变（锥形渐变）
BoxDecoration(
  gradient: SweepGradient(
    center: Alignment.center,
    colors: [Colors.red, Colors.orange, Colors.yellow, Colors.green, Colors.blue, Colors.purple, Colors.red],
  ),
);
```

---

## 6. Button — 按钮族

### 6.1 按钮类型速查

| Widget | 视觉权重 | 使用场景 |
|--------|---------|---------|
| `ElevatedButton` | 高（有背景色和阴影） | 主要操作——提交、保存、确认 |
| `FilledButton` | 高（有背景色，无阴影） | Material 3 的主操作按钮 |
| `OutlinedButton` | 中（边框+透明背景） | 次要操作——取消、返回 |
| `TextButton` | 低（仅文字） | 最次操作——了解更多、查看详情 |
| `FloatingActionButton` | 最高（浮动+阴影） | 页面级别的核心操作 |
| `IconButton` | 低 | 工具栏中的图标操作 |
| `PopupMenuButton` | 低 | 更多选项的下拉菜单 |

### 6.2 各按钮的样式定制

```dart
// ElevatedButton — Material 3 style
ElevatedButton(
  onPressed: () {},
  style: ElevatedButton.styleFrom(
    // 前景色（文字/图标颜色）
    foregroundColor: Colors.white,
    // 背景色
    backgroundColor: Colors.blue,
    // 禁用状态颜色
    disabledForegroundColor: Colors.grey,
    disabledBackgroundColor: Colors.grey[300],
    // 尺寸
    minimumSize: const Size(120, 48),
    // 形状
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(8),
    ),
    // 阴影（ElevatedButton 特有）
    elevation: 2,
    // 内边距
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
  ),
  child: const Text('确认借阅'),
);

// FilledButton — Material 3 新宠
FilledButton.icon(
  onPressed: () {},
  icon: const Icon(Icons.add),
  label: const Text('添加图书'),
  style: FilledButton.styleFrom(
    backgroundColor: Theme.of(context).colorScheme.primary,
  ),
);

// OutlinedButton
OutlinedButton(
  onPressed: () {},
  style: OutlinedButton.styleFrom(
    side: const BorderSide(color: Colors.blue, width: 1.5),
    foregroundColor: Colors.blue,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
  ),
  child: const Text('取消'),
);

// TextButton
TextButton(
  onPressed: () {},
  child: const Text('查看详情'),
);

// IconButton
IconButton(
  onPressed: () {},
  icon: const Icon(Icons.favorite_border),
  color: Colors.red,
  iconSize: 28,
);

// FloatingActionButton
FloatingActionButton.extended(
  onPressed: () {},
  icon: const Icon(Icons.add),
  label: const Text('添加图书'),
  backgroundColor: Theme.of(context).colorScheme.primaryContainer,
);

// PopupMenuButton — 更多操作菜单
PopupMenuButton<String>(
  onSelected: (value) {
    switch (value) {
      case 'edit': debugPrint('编辑'); break;
      case 'delete': debugPrint('删除'); break;
      case 'share': debugPrint('分享'); break;
    }
  },
  itemBuilder: (context) => [
    const PopupMenuItem(value: 'edit', child: ListTile(leading: Icon(Icons.edit), title: Text('编辑'), dense: true)),
    const PopupMenuItem(value: 'delete', child: ListTile(leading: Icon(Icons.delete, color: Colors.red), title: Text('删除', style: TextStyle(color: Colors.red)), dense: true)),
    const PopupMenuDivider(),
    const PopupMenuItem(value: 'share', child: ListTile(leading: Icon(Icons.share), title: Text('分享'), dense: true)),
  ],
);
```

---

## 7. 图书馆 App 实战

### 7.1 BookCard 组件

```dart
// lib/widgets/book_card.dart
import 'package:flutter/material.dart';
import '../models/book.dart';

class BookCard extends StatelessWidget {
  final Book book;
  final VoidCallback? onTap;

  const BookCard({super.key, required this.book, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: 2,
      shadowColor: Colors.black.withOpacity(0.1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          width: 160,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ① 图书封面
              _buildCover(),
              // ② 图书信息
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 书名 — 单行省略
                    Text(
                      book.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    // 作者
                    Text(
                      book.author,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 8),
                    // 评分 + 分类标签
                    Row(
                      children: [
                        _buildRating(book.rating),
                        const Spacer(),
                        _buildCategoryChip(book.category.label),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCover() {
    return SizedBox(
      height: 180,
      child: book.coverUrl != null
          ? Hero(
              tag: 'book-cover-${book.id}',
              child: Image.network(
                book.coverUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _buildPlaceholderCover(),
                loadingBuilder: (_, child, progress) {
                  if (progress == null) return child;
                  return _buildPlaceholderCover();
                },
              ),
            )
          : _buildPlaceholderCover(),
    );
  }

  Widget _buildPlaceholderCover() {
    return Container(
      color: Colors.grey[200],
      child: const Center(
        child: Icon(Icons.menu_book, size: 48, color: Colors.grey),
      ),
    );
  }

  Widget _buildRating(double rating) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.star, size: 14, color: Colors.amber),
        const SizedBox(width: 2),
        Text(
          rating.toStringAsFixed(1),
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildCategoryChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.blue.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 10, color: Colors.blue),
      ),
    );
  }
}
```

### 7.2 测试数据

```dart
// lib/data/sample_books.dart
import '../models/book.dart';

const sampleBooks = [
  Book(
    id: '1',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '978-0132350884',
    category: BookCategory.technology,
    publishYear: 2008,
    rating: 4.7,
    totalCopies: 3,
    availableCopies: 2,
    description: 'Even bad code can function...',
    tags: ['software', 'best-practices'],
  ),
  Book(
    id: '2',
    title: 'Design Patterns',
    author: 'Gang of Four',
    isbn: '978-0201633610',
    category: BookCategory.technology,
    publishYear: 1994,
    rating: 4.5,
    totalCopies: 2,
    availableCopies: 1,
    description: 'Elements of Reusable Object-Oriented Software',
    tags: ['design-patterns', 'oop'],
  ),
  Book(
    id: '3',
    title: 'Refactoring',
    author: 'Martin Fowler',
    isbn: '978-0201485677',
    category: BookCategory.technology,
    publishYear: 1999,
    rating: 4.6,
    totalCopies: 2,
    availableCopies: 2,
    tags: ['refactoring', 'code-quality'],
  ),
  Book(
    id: '4',
    title: '三体',
    author: '刘慈欣',
    isbn: '978-7536692930',
    category: BookCategory.science,
    publishYear: 2008,
    rating: 4.9,
    totalCopies: 5,
    availableCopies: 3,
    description: '中国科幻文学的里程碑之作',
    tags: ['sci-fi', 'chinese-literature', 'award-winning'],
  ),
  Book(
    id: '5',
    title: 'Sapiens: A Brief History of Humankind',
    author: 'Yuval Noah Harari',
    isbn: '978-0062316110',
    category: BookCategory.history,
    publishYear: 2011,
    rating: 4.6,
    totalCopies: 4,
    availableCopies: 4,
    description: 'A brief history of humankind',
    tags: ['history', 'anthropology', 'bestseller'],
  ),
];
```

### 7.3 更新 HomeScreen 展示 BookCard

```dart
// lib/screens/home_screen.dart 的更新部分
// 替换原来的 _buildBookListTab() 方法

Widget _buildBookListTab() {
  return GridView.builder(
    padding: const EdgeInsets.all(16),
    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
      crossAxisCount: 2,           // 2 列
      childAspectRatio: 0.65,      // 宽高比
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
    ),
    itemCount: sampleBooks.length,
    itemBuilder: (context, index) {
      return BookCard(
        book: sampleBooks[index],
        onTap: () {
          debugPrint('点击了: ${sampleBooks[index].title}');
        },
      );
    },
  );
}
```

---

## 8. 常见错误与最佳实践

### 8.1 常见错误

```dart
// ❌ 错误 1：Container 同时设置 color 和 decoration 的 color
// Container(
//   color: Colors.blue,                // ❌
//   decoration: BoxDecoration(         // ❌ 冲突！
//     color: Colors.red,
//   ),
// )
// ✅ 正确：只用 decoration
Container(
  decoration: BoxDecoration(color: Colors.blue),
);

// ❌ 错误 2：Text 的 textAlign 期望填充整行但 Text 没拿到足够宽度
// Center(child: Text('text', textAlign: TextAlign.center))
// Text 占据了最小宽度，textAlign.center 无可见效果
// ✅ 正确：让 Text 扩展到足够宽度
SizedBox(
  width: double.infinity,
  child: Text('text', textAlign: TextAlign.center),
);

// ❌ 错误 3：忘记 IconButton 需要 onPressed
// IconButton(icon: Icon(Icons.star), onPressed: null) // disabled
// ✅ 正确：提供 onPressed 回调
IconButton(icon: const Icon(Icons.star), onPressed: () {});

// ❌ 错误 4：Image.network 未处理加载失败
// Image.network(url)  // 网络失败时什么也不显示
// ✅ 正确：总是提供 errorBuilder
Image.network(url, errorBuilder: (_, __, ___) => Icon(Icons.broken_image));
```

### 8.2 最佳实践

1. **优先使用 `Card` Widget 做卡片**：`Card` 内置了 Material Design 的卡片样式，比手动用 `Container` + `BoxDecoration` 更规范
2. **始终给 `Image.network` 提供 `errorBuilder` 和 `loadingBuilder`**——网络不可靠，友好的降级 UI 是必须的
3. **Text 的 `maxLines` + `overflow: TextOverflow.ellipsis` 是防止 UI 溢出的基本防线**——书名、描述等动态内容务必使用
4. **按钮使用 Material 3 风格**：`FilledButton` → `OutlinedButton` → `TextButton` 按操作重要性递减
5. **`Container` 只在你需要 decoration 时使用**——如果你只需要 padding，直接用 `Padding` Widget；只需要背景色，用 `ColoredBox`。Container 是多功能 Widget，过重

---

## 9. 本章小结

| 你学到了什么 | 对标 HTML/CSS | 在图书馆 App 中的体现 |
|-------------|-------------|---------------------|
| Text 全样式 + RichText | `<p>` + `font-*` CSS 属性 | 书名/作者/描述文本 |
| TextOverflow 截断 | `text-overflow: ellipsis` | 长书名单行省略 |
| Image 四种源 + loadingBuilder/errorBuilder | `<img>` + onload/onerror | 图书封面加载 |
| Icon + Icons 全集 | `<i class="material-icons">` | 评分星、搜索按钮 |
| Container + BoxDecoration | `<div style="...">` 几乎所有属性 | 卡片样式容器 |
| Button 族（7种） | `<button>` 变体 | 借阅、添加、取消按钮 |
| Scaffold 完整配置 | `<html>` 页面结构 | 首页骨架 |

---

## 10. 本章练习

**1. Container decoration 组合**

为图书馆 App 设计一个 `BookStatusBadge` 组件，用于在图书卡片上显示借阅状态（"可借"/"已借出"/"逾期"），要求：

- 使用 `Container` + `BoxDecoration` 实现三种不同视觉样式：
  - "可借"：绿色背景、圆角、阴影
  - "已借出"：橙色边框、透明背景、圆角
  - "逾期"：红色背景、白色文字、圆角、右下角小红点（用 `Stack` + `Positioned` 叠加）
- 文字使用 `Text` Widget，字号 12，居中对齐
- 验证：新建 `lib/widgets/book_status_badge.dart`，在 `BookCard` 右上角用 `Stack` + `Positioned` 叠放此状态标签，切换不同状态的测试数据确认三种样式均正确显示。

**2. Stack 叠放布局**

为图书馆 App 设计一个 `BookCoverWithOverlay` 组件，实现以下效果：

- 底层：图书封面图片（`Image.network`），宽 160、高 200，`BoxFit.cover`
- 顶层左上角：半透明黑色圆角标签，显示分类名称（如"技术"），用 `Positioned(top: 8, left: 8)` 定位
- 顶层右下角：评分徽章（圆形蓝色背景，白色评分数字），用 `Positioned(bottom: 8, right: 8)` 定位
- 如果封面图片加载失败，整个区域用灰色占位 + 文字"暂无封面"替代
- 验证：在 `BookCard` 中用此组件替换现有的 `_buildCover()` 方法，运行 App 确认封面、分类标签、评分徽章三层叠加正确。尝试断开网络验证错误占位也正常显示。

**3. 多种 Button 类型选择**

图书馆 App 的图书详情页底部需要一个"借阅"按钮，图书列表页右下角需要一个"添加图书"按钮，分类筛选栏旁边需要一个"重置筛选"文字按钮。请为以下三个场景选择最合适的按钮类型，并写出完整代码：

- 场景 A（主要操作）：借阅按钮 — 全宽、带图标、高视觉权重
- 场景 B（页面级核心操作）：添加图书 — 浮动、带图标和文字
- 场景 C（次要操作）：重置筛选 — 仅文字、低视觉权重
- 写出每种场景选择了哪个 Button Widget 以及选择的理由（一句话即可）
- 验证：在 `HomeScreen` 和 `BookDetailScreen` 中替换对应的按钮实现，运行 App 确认三种按钮的视觉效果和点击行为均正确。

---

> **下一步**: [Chapter 08 — Cupertino 组件](./Chapter-08-Cupertino组件.md)
> **原始文档**: [flutter.cn/ui/widgets](https://docs.flutter.cn/ui/widgets) | [flutter.cn/ui/design/material](https://docs.flutter.cn/ui/design/material)
