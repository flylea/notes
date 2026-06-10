> **Part**: Part II — 界面基石：Widget 与布局
> **上一章**: [Chapter 08 — 滚动与列表](./Chapter-08-滚动与列表.md)
> **下一章**: [Part III — 导航与路由（Chapter 10）](../Part-03-导航与路由/)
> **官方文档**: [flutter.cn/ui/interactivity](https://docs.flutter.cn/ui/interactivity) | [flutter.cn/cookbook/forms](https://docs.flutter.cn/cookbook/forms)

---

# 第 9 章：表单与用户输入

## 0. 本章目标与前置依赖

**前置依赖**：掌握 Text/Container/Row/Column/Expanded 等基础 Widget（Chapter 6-7），理解 StatefulWidget 和 setState（Chapter 5）。

**本章目标**：
- 掌握 TextField 的完整配置（decoration/controller/focusNode/keyboardType/textInputAction/ onChanged/onSubmitted/TextInputFormatter）
- 掌握 Form + FormField 表单体系（GlobalKey\<FormState\>/TextFormField/validator/ autovalidateMode）
- 掌握 TextEditingController 的生命周期与正确释放
- 理解 FocusNode 和焦点管理
- 熟练使用六种选择器 Widget（Checkbox/Switch/Slider/Radio/DropdownButton/DatePicker）
- 掌握手势检测系统（GestureDetector + InkWell）
- 构建完整的表单验证架构（单一字段 + 跨字段 + 异步验证）

> 🎯 **本章会在图书馆 App 中做什么**：实现搜索栏实时过滤图书列表、图书添加/编辑表单（书名/作者/ISBN/分类/封面 URL/简介）、借阅日期选择（DatePicker）、筛选面板（分类 Dropdown + 评分 Slider）。

---

## 1. GestureDetector 与 InkWell — 让 Widget 可交互

### 1.1 GestureDetector

```dart
GestureDetector(
  // 点击
  onTap: () => debugPrint('单击'),
  onDoubleTap: () => debugPrint('双击'),
  onLongPress: () => debugPrint('长按'),
  onTapDown: (details) => debugPrint('手指按下'),
  onTapUp: (details) => debugPrint('手指抬起'),
  onTapCancel: () => debugPrint('点击取消（手指滑出区域）'),

  // 水平拖拽
  onHorizontalDragStart: (details) {},
  onHorizontalDragUpdate: (details) {},
  onHorizontalDragEnd: (details) {},

  // 垂直拖拽
  onVerticalDragStart: (details) {},
  onVerticalDragUpdate: (details) {},
  onVerticalDragEnd: (details) {},

  // 缩放（双指）
  onScaleStart: (details) {},
  onScaleUpdate: (details) {},
  onScaleEnd: (details) {},

  // 行为配置
  behavior: HitTestBehavior.opaque,
  // HitTestBehavior.deferToChild — 只有子 Widget 被点击时才触发
  // HitTestBehavior.opaque       — 整个区域都可点击
  // HitTestBehavior.translucent  — 整个区域都可点击，且点击穿透到下层

  child: Container(
    width: 100, height: 100, color: Colors.blue,
    child: const Center(child: Text('点击我', style: TextStyle(color: Colors.white))),
  ),
);
```

### 1.2 InkWell — Material 水波纹点击效果

```dart
InkWell(
  onTap: () {},
  onLongPress: () {},
  // 波纹颜色
  splashColor: Colors.blue.withOpacity(0.3),
  // 高亮颜色
  highlightColor: Colors.blue.withOpacity(0.1),
  // 波纹形状
  borderRadius: BorderRadius.circular(12),
  // 自定义波纹工厂
  // splashFactory: InkRipple.splashFactory,    // 默认波纹
  // splashFactory: InkSplash.splashFactory,    // 圆形扩散

  child: Container(
    padding: const EdgeInsets.all(16),
    child: const Text('Material 水波纹按钮'),
  ),
);

// ⚠️ InkWell 的波纹效果需要在 Material Widget 的边界内才能显示
// 如果看不到水波纹，试试在外层加 Material(color: Colors.transparent, child: InkWell(...))
```

> **TS 经验**：GestureDetector ≈ 原生 JS 的 `addEventListener('click'/'touchstart'/...)` 全集。InkWell ≈ Material Design 规范的涟漪动画（CSS `::after` ripple 效果的等价物）。

---

## 2. TextField — 文本输入

### 2.1 基础配置

```dart
TextField(
  // 控制器（获取/设置文本、监听变化）
  controller: _textController,

  // 焦点
  focusNode: _focusNode,

  // 外观装饰
  decoration: InputDecoration(
    labelText: '书名',
    hintText: '请输入书名',
    helperText: '例如：Clean Code',
    // 错误文字
    // errorText: '书名为必填项',

    // 前缀/后缀图标
    prefixIcon: const Icon(Icons.book),
    suffixIcon: IconButton(
      icon: const Icon(Icons.clear),
      onPressed: () => _textController.clear(),
    ),

    // 边框样式
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: Colors.grey),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: Colors.blue, width: 2),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(8),
      borderSide: const BorderSide(color: Colors.red),
    ),

    // 填充
    filled: true,
    fillColor: Colors.grey[50],

    // 内边距
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
  ),

  // 键盘类型
  keyboardType: TextInputType.text,
  // TextInputType.number           — 数字键盘
  // TextInputType.emailAddress     — 邮箱键盘（带 @）
  // TextInputType.url              — URL 键盘（带 / .com）
  // TextInputType.phone            — 电话键盘
  // TextInputType.multiline        — 多行文本
  // TextInputType.none             — 隐藏键盘

  // 键盘动作按钮
  textInputAction: TextInputAction.done,
  // TextInputAction.next           — "下一项"（跳转到下一个输入框）
  // TextInputAction.search         — "搜索"
  // TextInputAction.send           — "发送"
  // TextInputAction.newline        — 换行

  // 输入格式化
  inputFormatters: [
    LengthLimitingTextInputFormatter(100),     // 最多 100 字
    FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z一-龥\s]')), // 只允许字母和中文
  ],

  // 密码掩码
  // obscureText: true,
  // obscuringCharacter: '•',

  // 最大行数
  maxLines: 1,             // 单行
  // maxLines: null,        // 无限行（多行模式）

  // 最小行数
  minLines: 1,

  // 文本首行大写
  textCapitalization: TextCapitalization.sentences,

  // 光标
  cursorColor: Colors.blue,
  cursorWidth: 2.0,
  cursorRadius: const Radius.circular(2),

  // 样式
  style: const TextStyle(fontSize: 16),

  // 回调
  onChanged: (value) => debugPrint('输入: $value'),
  onSubmitted: (value) => debugPrint('提交: $value'),
  onTap: () => debugPrint('输入框被点击'),
);
```

### 2.2 TextEditingController — 输入控制器

```dart
class _MyFormState extends State<MyForm> {
  // 创建 controller
  final _titleController = TextEditingController();
  final _authorController = TextEditingController();

  @override
  void initState() {
    super.initState();
    // ① 设置初始文本
    _titleController.text = '初始书名';

    // ② 监听文本变化
    _titleController.addListener(() {
      final text = _titleController.text;
      debugPrint('当前输入: $text (${text.length} 字)');
    });
  }

  // ③ 获取/设置/清空文本
  void _handleSubmit() {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      debugPrint('书名不能为空');
      return;
    }
    // 处理提交...
    _titleController.clear();  // 清空
  }

  @override
  void dispose() {
    _titleController.dispose();    // ⚠️ 必须 dispose！
    _authorController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(controller: _titleController),
        TextField(controller: _authorController),
      ],
    );
  }
}
```

### 2.3 FocusNode — 焦点管理

```dart
class _MyFormState extends State<MyForm> {
  final _titleFocus = FocusNode();
  final _authorFocus = FocusNode();
  final _isbnFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    // 监听焦点变化
    _titleFocus.addListener(() {
      debugPrint('书名字段焦点: ${_titleFocus.hasFocus}');
    });
  }

  // 切换焦点到下一个字段
  void _fieldSubmitted(String value) {
    // 方式 1：手动请求焦点
    FocusScope.of(context).requestFocus(_authorFocus);
    // 方式 2：nextFocus()（自动找下一个）
    // FocusScope.of(context).nextFocus();
  }

  // 移除所有焦点（收起键盘）
  void _dismissKeyboard() {
    FocusScope.of(context).unfocus();
  }

  @override
  void dispose() {
    _titleFocus.dispose();
    _authorFocus.dispose();
    _isbnFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      // 点击空白区域收起键盘
      onTap: _dismissKeyboard,
      child: Column(
        children: [
          TextField(
            focusNode: _titleFocus,
            textInputAction: TextInputAction.next,
            onSubmitted: _fieldSubmitted,
          ),
          TextField(
            focusNode: _authorFocus,
            textInputAction: TextInputAction.next,
            onSubmitted: (_) => _isbnFocus.requestFocus(),
          ),
          TextField(
            focusNode: _isbnFocus,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _dismissKeyboard(),
          ),
        ],
      ),
    );
  }
}
```

---

## 3. Form + FormField — 表单体系

### 3.1 Form 基础

```dart
class _BookFormState extends State<BookForm> {
  // GlobalKey — 用于在 Widget 树外部访问 FormState
  final _formKey = GlobalKey<FormState>();

  void _submit() {
    // ① validate() — 验证所有 FormField，返回 true/false
    if (_formKey.currentState!.validate()) {
      // ② save() — 调用所有 FormField 的 onSaved 回调
      _formKey.currentState!.save();
      // ③ reset() — 重置所有 FormField 到初始值
      // _formKey.currentState!.reset();
      debugPrint('✅ 验证通过，提交表单');
    } else {
      debugPrint('❌ 验证失败');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      // 自动验证模式
      autovalidateMode: AutovalidateMode.onUserInteraction, // ⭐️ 推荐
      // AutovalidateMode.disabled              — 只在手动调用 validate() 时验证
      // AutovalidateMode.always                — 每次 rebuild 都验证
      // AutovalidateMode.onUserInteraction     — 用户操作后开始实时验证

      child: Column(
        children: [
          TextFormField(...),
          TextFormField(...),
          ElevatedButton(onPressed: _submit, child: const Text('提交')),
        ],
      ),
    );
  }
}
```

### 3.2 TextFormField — 带验证的文本输入

```dart
TextFormField(
  decoration: const InputDecoration(labelText: '书名 *'),
  // ① 单一字段验证
  validator: (value) {
    if (value == null || value.trim().isEmpty) {
      return '书名不能为空';
    }
    if (value.trim().length < 2) {
      return '书名至少 2 个字符';
    }
    if (value.trim().length > 200) {
      return '书名不能超过 200 个字符';
    }
    return null;  // null = 验证通过
  },
  // ② 保存
  onSaved: (value) {
    _title = value?.trim() ?? '';
  },
  // ③ 初始值
  initialValue: 'Clean Code',
);
```

### 3.3 跨字段验证

```dart
// 跨字段验证：确认密码
String? _validateConfirmPassword(String? value) {
  // 通过 _formKey 访问其他字段的值
  final password = (_formKey.currentState?.fields['password'] as TextFormField?)?.value;
  if (value != password) {
    return '两次密码不一致';
  }
  return null;
}

// 在 Form 中通过字段名标识
TextFormField(
  key: const ValueKey('password'),
  // 不能用初始值，因为需要跨字段访问
  ...
);
```

---

## 4. 选择器 Widget 全系列

### 4.1 Checkbox / Switch

```dart
// Checkbox
CheckboxListTile(
  title: const Text('同意借阅条款'),
  subtitle: const Text('借阅期限 14 天，逾期将产生费用'),
  value: _agreed,
  onChanged: (value) => setState(() => _agreed = value ?? false),
  controlAffinity: ListTileControlAffinity.leading,  // 复选框在文字前面
);

// Switch
SwitchListTile(
  title: const Text('开启到期提醒'),
  value: _enableReminder,
  onChanged: (value) => setState(() => _enableReminder = value),
  secondary: const Icon(Icons.notifications),
);
```

### 4.2 Radio

```dart
Column(
  children: BookCategory.values.map((category) =>
    RadioListTile<BookCategory>(
      title: Text(category.label),
      value: category,
      groupValue: _selectedCategory,
      onChanged: (value) => setState(() => _selectedCategory = value),
    ),
  ).toList(),
);
```

### 4.3 DropdownButton / DropdownButtonFormField

```dart
// 独立使用
DropdownButton<BookCategory>(
  value: _selectedCategory,
  items: BookCategory.values.map((c) =>
    DropdownMenuItem(value: c, child: Text(c.label)),
  ).toList(),
  onChanged: (value) => setState(() => _selectedCategory = value),
  isExpanded: true,    // 下拉菜单宽度与按钮一致
);

// 在 Form 中使用（支持验证）
DropdownButtonFormField<BookCategory>(
  value: _selectedCategory,
  decoration: const InputDecoration(labelText: '分类'),
  items: BookCategory.values.map((c) =>
    DropdownMenuItem(value: c, child: Text(c.label)),
  ).toList(),
  onChanged: (value) => setState(() => _selectedCategory = value),
  validator: (value) => value == null ? '请选择分类' : null,
);
```

### 4.4 Slider

```dart
Slider(
  value: _rating,
  min: 0,
  max: 5,
  divisions: 10,          // 10 个分档 → 每档 0.5
  label: _rating.toStringAsFixed(1),
  onChanged: (value) => setState(() => _rating = value),
  activeColor: Colors.amber,
);
```

### 4.5 DatePicker

```dart
Future<void> _selectDate() async {
  final picked = await showDatePicker(
    context: context,
    initialDate: _selectedDate ?? DateTime.now(),
    firstDate: DateTime(1900),
    lastDate: DateTime.now().add(const Duration(days: 365)),
    helpText: '选择出版日期',
    cancelText: '取消',
    confirmText: '确定',
  );
  if (picked != null) {
    setState(() => _selectedDate = picked);
  }
}

// 日期选择触发按钮
ListTile(
  title: const Text('出版日期'),
  subtitle: Text(_selectedDate != null
      ? '${_selectedDate!.year}-${_selectedDate!.month}-${_selectedDate!.day}'
      : '未选择'),
  trailing: const Icon(Icons.calendar_today),
  onTap: _selectDate,
);
```

---

## 5. 图书馆 App 实战

### 5.1 搜索栏实时过滤

```dart
// lib/widgets/search_bar_widget.dart
class SearchBarWidget extends StatefulWidget {
  final void Function(String query) onSearch;
  const SearchBarWidget({super.key, required this.onSearch});

  @override
  State<SearchBarWidget> createState() => _SearchBarWidgetState();
}

class _SearchBarWidgetState extends State<SearchBarWidget> {
  final _controller = TextEditingController();

  @override
  void initState() {
    super.initState();
    // 防抖：300ms 后才触发搜索
    Timer? _debounce;
    _controller.addListener(() {
      if (_debounce?.isActive ?? false) _debounce!.cancel();
      _debounce = Timer(const Duration(milliseconds: 300), () {
        widget.onSearch(_controller.text);
      });
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      decoration: InputDecoration(
        hintText: '搜索图书、作者或 ISBN...',
        prefixIcon: const Icon(Icons.search),
        suffixIcon: _controller.text.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.clear),
                onPressed: () {
                  _controller.clear();
                  widget.onSearch('');
                },
              )
            : null,
      ),
    );
  }
}
```

### 5.2 图书添加/编辑表单（完整版）

```dart
// lib/screens/book_form_screen.dart
import 'package:flutter/material.dart';
import '../models/book.dart';

class BookFormScreen extends StatefulWidget {
  final Book? existingBook;   // null = 添加模式，非 null = 编辑模式
  const BookFormScreen({super.key, this.existingBook});

  @override
  State<BookFormScreen> createState() => _BookFormScreenState();
}

class _BookFormScreenState extends State<BookFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _authorCtrl = TextEditingController();
  final _isbnCtrl = TextEditingController();
  final _coverUrlCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _publishYearCtrl = TextEditingController();

  BookCategory? _selectedCategory;
  int _totalCopies = 1;
  DateTime? _publishDate;

  bool get _isEditing => widget.existingBook != null;

  @override
  void initState() {
    super.initState();
    if (_isEditing) {
      final book = widget.existingBook!;
      _titleCtrl.text = book.title;
      _authorCtrl.text = book.author;
      _isbnCtrl.text = book.isbn;
      _coverUrlCtrl.text = book.coverUrl ?? '';
      _descCtrl.text = book.description ?? '';
      _selectedCategory = book.category;
      _totalCopies = book.totalCopies;
      _publishYearCtrl.text = book.publishYear.toString();
    }
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    final book = Book(
      id: _isEditing ? widget.existingBook!.id : DateTime.now().millisecondsSinceEpoch.toString(),
      title: _titleCtrl.text.trim(),
      author: _authorCtrl.text.trim(),
      isbn: _isbnCtrl.text.trim(),
      category: _selectedCategory ?? BookCategory.other,
      publishYear: int.tryParse(_publishYearCtrl.text) ?? DateTime.now().year,
      coverUrl: _coverUrlCtrl.text.isEmpty ? null : _coverUrlCtrl.text.trim(),
      description: _descCtrl.text.isEmpty ? null : _descCtrl.text.trim(),
      totalCopies: _totalCopies,
      availableCopies: _totalCopies,
    );

    debugPrint('${_isEditing ? "编辑" : "添加"}图书: $book');
    Navigator.of(context).pop(book);  // 返回结果
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? '编辑图书' : '添加图书')),
      body: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: '书名 *', prefixIcon: Icon(Icons.book)),
              validator: (v) => v == null || v.trim().isEmpty ? '书名为必填' : null,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _authorCtrl,
              decoration: const InputDecoration(labelText: '作者 *', prefixIcon: Icon(Icons.person)),
              validator: (v) => v == null || v.trim().isEmpty ? '作者为必填' : null,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _isbnCtrl,
              decoration: const InputDecoration(labelText: 'ISBN *', prefixIcon: Icon(Icons.tag)),
              validator: (v) => v == null || v.trim().isEmpty ? 'ISBN 为必填' : null,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<BookCategory>(
              value: _selectedCategory,
              decoration: const InputDecoration(labelText: '分类', prefixIcon: Icon(Icons.category)),
              items: BookCategory.values.map((c) => DropdownMenuItem(value: c, child: Text(c.label))).toList(),
              onChanged: (v) => setState(() => _selectedCategory = v),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _publishYearCtrl,
                    decoration: const InputDecoration(labelText: '出版年份', prefixIcon: Icon(Icons.calendar_today)),
                    keyboardType: TextInputType.number,
                    validator: (v) {
                      if (v != null && v.isNotEmpty) {
                        final year = int.tryParse(v);
                        if (year == null || year < 1000 || year > DateTime.now().year + 1) {
                          return '无效年份';
                        }
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildCopiesSelector(),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _coverUrlCtrl,
              decoration: const InputDecoration(labelText: '封面 URL', prefixIcon: Icon(Icons.image)),
              keyboardType: TextInputType.url,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _descCtrl,
              decoration: const InputDecoration(labelText: '简介', prefixIcon: Icon(Icons.description)),
              maxLines: 4,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _submit,
              icon: Icon(_isEditing ? Icons.save : Icons.add),
              label: Text(_isEditing ? '保存修改' : '添加图书'),
              style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCopiesSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('副本数量: $_totalCopies', style: Theme.of(context).textTheme.bodyLarge),
        Slider(
          value: _totalCopies.toDouble(),
          min: 1, max: 20, divisions: 19,
          label: '$_totalCopies',
          onChanged: (v) => setState(() => _totalCopies = v.round()),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _authorCtrl.dispose();
    _isbnCtrl.dispose();
    _coverUrlCtrl.dispose();
    _descCtrl.dispose();
    _publishYearCtrl.dispose();
    super.dispose();
  }
}
```

### 5.3 筛选面板

```dart
// lib/widgets/filter_panel.dart
class FilterPanel extends StatefulWidget {
  final void Function({BookCategory? category, double? minRating}) onApply;
  const FilterPanel({super.key, required this.onApply});

  @override
  State<FilterPanel> createState() => _FilterPanelState();
}

class _FilterPanelState extends State<FilterPanel> {
  BookCategory? _category;
  double _minRating = 0;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('筛选条件', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          DropdownButtonFormField<BookCategory>(
            value: _category,
            decoration: const InputDecoration(labelText: '分类'),
            items: BookCategory.values.map((c) => DropdownMenuItem(value: c, child: Text(c.label))).toList(),
            onChanged: (v) => setState(() => _category = v),
          ),
          const SizedBox(height: 16),
          Text('最低评分: ${_minRating.toStringAsFixed(1)}'),
          Slider(
            value: _minRating,
            min: 0, max: 5, divisions: 10,
            label: _minRating.toStringAsFixed(1),
            onChanged: (v) => setState(() => _minRating = v),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => setState(() { _category = null; _minRating = 0; }),
                  child: const Text('重置'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    widget.onApply(category: _category, minRating: _minRating);
                    Navigator.of(context).pop();
                  },
                  child: const Text('应用'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
```

---

## 6. 常见错误与最佳实践

```dart
// ❌ 错误 1：忘记 dispose TextEditingController
// ✅ 在 State 的 dispose() 中释放

// ❌ 错误 2：在 initState 中使用 context（此时 Widget 还没插入树）
// ✅ 用 addPostFrameCallback 延迟到首帧之后

// ❌ 错误 3：TextField 的 onChanged 中做昂贵操作
// ✅ 使用防抖（Timer debounce）

// ❌ 错误 4：Form 的 autovalidateMode: always 导致键盘弹出时就验证
// ✅ 使用 AutovalidateMode.onUserInteraction

// ❌ 错误 5：用 TextField 代替 TextFormField 做表单
// TextField 没有 validator/onSaved，无法被 Form.validate() 管理
```

---

## 7. 本章小结

| 你学到了什么 | 对标 Web | 在图书馆 App 中的体现 |
|-------------|---------|---------------------|
| GestureDetector/InkWell | addEventListener + CSS hover | 可点击的图书卡片 |
| TextField 完整配置 | `<input type="text">` 全套属性 | 搜索框、表单输入 |
| TextEditingController | useRef + .value 操作 | 表单数据的获取与清空 |
| Form + TextFormField | `<form>` + 表单库 | 图书添加/编辑表单 |
| validator/onSaved/validate | 表单验证 schema | 完整的字段验证 |
| 六种选择器 Widget | checkbox/switch/radio/select/slider/datepicker | 分类/评分/日期选择 |
| 防抖搜索 | setTimeout debounce | 搜索栏防抖过滤 |

---

> **下一步**: [Part III — 导航与路由（Chapter 10）](../Part-03-导航与路由/)
> **原始文档**: [flutter.cn/ui/interactivity](https://docs.flutter.cn/ui/interactivity) | [flutter.cn/cookbook/forms](https://docs.flutter.cn/cookbook/forms)
