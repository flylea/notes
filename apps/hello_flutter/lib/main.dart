import 'package:flutter/material.dart';

// ② 应用入口函数 — 类似 React 的 ReactDOM.createRoot().render()
//   runApp() 接收一个 Widget，把它挂载到屏幕
void main() {
  runApp(const LibraryApp());
}
 
// ③ 应用根 Widget — 类似 React 的 <App />
//   StatelessWidget 是不含可变状态的 Widget
//   const 构造表示此 Widget 在编译时就完全确定，运行时不会变化
class LibraryApp extends StatelessWidget {
  const LibraryApp({super.key});

  // ④ build() 方法 — 类似 React 的 render() 或函数组件的 return
  //   它接收 BuildContext（类似 React 的组件上下文），返回 Widget 树
  @override
  Widget build(BuildContext context) {
    // ⑤ MaterialApp — 类似 React 的 <BrowserRouter> + <ThemeProvider>
    //   它提供 Material Design 主题、路由、本地化等基础设施
    return MaterialApp(
      title: 'Library Management System',
      // ⑥ Theme — 类似 Tailwind 的 theme config
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF1565C0), // 种子色，自动生成调色板
        useMaterial3: true, // 启用 Material 3 设计
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        colorSchemeSeed: const Color(0xFF42A5F5),
        useMaterial3: true,
        brightness: Brightness.dark,
      ),
      // ⑦ home — 首页 Widget，应用启动后显示的第一个页面
      home: const HomeScreen(),
    );
  }
}

// ⑧ 首页 Widget
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // ⑨ Scaffold — 页面骨架，提供 AppBar、Body、FAB 等标准布局槽位
    //   类似 HTML 的 <html><head><body> 结构
    return Scaffold(
      // ⑩ AppBar — 顶部导航栏，类似 React Navigation 的 header
      appBar: AppBar(
        title: const Text('📚 图书馆管理系统'),
        centerTitle: true, // 标题居中（iOS 风格）
      ),
      // ⑪ Body — 页面主体内容
      body: const Center(
        child: Text(
          '欢迎来到图书馆！\n点击右下角 + 开始添加第一本图书。',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 18),
        ),
      ),
      // ⑫ FAB — 浮动操作按钮（Floating Action Button）
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // 打印调试信息 — 类似 console.log()
          debugPrint('添加图书按钮被点击');
        },
        tooltip: '添加图书',
        child: const Icon(Icons.add),
      ),
    );
  }
}
