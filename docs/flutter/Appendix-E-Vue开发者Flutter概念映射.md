# Appendix E — Vue 开发者 Flutter 概念映射

> 如果你熟悉 Vue 3（Composition API + TypeScript + Pinia + Vue Router），本附录帮助你快速建立 Vue → Flutter 的概念对照。

---

## 1. 组件与模板 — SFC → Widget

Vue 的单文件组件（`<template>` + `<script setup>` + `<style>`）在 Flutter 中没有直接对应物——**一切皆是 Dart 代码**。

| Vue | Flutter | 说明 |
|-----|---------|------|
| `<template>` | `Widget build()` 方法 | Flutter 用纯 Dart 代码描述 UI，没有模板语法 |
| `{{ message }}` | `'${message}'` 或 `Text(message)` | 字符串插值用 `$` 或 `${}` |
| `v-if="show"` | `if (show) Widget()` | Dart 原生 `if` 表达式 |
| `v-for="item in list"` | `ListView.builder()` 或 `for (final item in list) ...` | 列表渲染 |
| `v-model="name"` | `TextEditingController` + `onChanged` | 双向绑定需手动实现 |
| `v-show="visible"` | `Visibility(visible: visible)` | 控制显示/隐藏 |
| `v-bind:class` | `Container(decoration: ...)` | 样式绑定用 Widget 属性 |
| `@click="handle"` | `GestureDetector(onTap: handle)` 或 `ElevatedButton(onPressed: handle)` | 事件绑定 |
| `<slot>` | `child` 参数 | 内容分发 |
| `<component :is="...">` | 动态 Widget 构造 | 根据条件返回不同 Widget |

**核心认知转变**：Vue 的模板是指令式的声明，Flutter 的 Widget 是嵌套式的代码构造。没有模板编译器，只有 Dart 控制流。

---

## 2. 响应式系统 — `ref()` / `reactive()` → Flutter 状态管理

| Vue Composition API | Flutter | 说明 |
|---------------------|---------|------|
| `ref(0)` / `reactive({})` | `setState()` / `ValueNotifier` / Riverpod | Flutter 没有自动响应式追踪 |
| `const count = ref(0)` | `var _count = 0;` + `setState(() => _count++)` | 局部状态需显式调用 `setState` |
| `computed(() => a + b)` | `int get sum => _a + _b;` (Dart getter) 或 Riverpod `ref.watch` | 计算属性 |
| `watch(source, callback)` | `addListener()` / `Stream.listen()` / `ref.listen()` | 副作用监听 |
| `watchEffect(() => {...})` | 无直接对应，Riverpod 的 `ref.watch` 提供类似行为 | 自动追踪依赖 |
| `onMounted(() => {...})` | `initState()` | 初始化 |
| `onUnmounted(() => {...})` | `dispose()` | 清理 |
| `onUpdated(() => {...})` | `didUpdateWidget()` | 更新后回调 |
| `provide('key', value)` / `inject('key')` | `InheritedWidget` / `Provider.of<T>()` / `ref.watch` | 依赖注入 |
| `nextTick(() => {...})` | `WidgetsBinding.instance.addPostFrameCallback()` | 下一帧回调 |
| `shallowRef()` | `const` Widget 构造 | 浅层引用/不变引用 |

**核心差异**：Vue 的响应式系统是**自动追踪依赖**的——你改变 `ref` 的值，所有用到它的地方自动更新。Flutter 中你需要**显式调用** `setState`、`ref.watch` 或 `notifyListeners` 来触发重建。这是一个根本性的心智模型差异。

---

## 3. 状态管理方案对照

| Vue 生态 | Flutter 生态 | 适用场景 |
|---------|-------------|---------|
| 组件内 `ref()` | `setState()` + StatefulWidget | 单组件局部状态 |
| `provide()` / `inject()` | `InheritedWidget` / Provider | 跨组件浅层传递 |
| Pinia store | Provider + ChangeNotifier | 全局共享状态 |
| Pinia store + `storeToRefs()` | Riverpod (编译时安全) | 复杂响应式状态 |
| Vuex (mutation/action) | Bloc (Event→State 严格单向) | 事件驱动架构 |
| TanStack Vue Query | 自定义 AsyncState / Riverpod AsyncNotifier | 服务端状态缓存 |
| `useAsyncState()` (VueUse) | Riverpod `AsyncNotifier` | 异步状态管理 |

---

## 4. 路由对照

| Vue Router | GoRouter (Flutter) | 说明 |
|-----------|-------------------|------|
| `createRouter({ routes: [...] })` | `GoRouter(routes: [...])` | 集中路由配置 |
| `<router-view>` | `GoRouter` 自动根据 path 渲染 | 路由出口 |
| `<router-link to="/book/1">` | `context.go('/book/1')` | 导航链接 |
| `router.push('/book/1')` | `context.push('/book/1')` | 推入路由 |
| `router.replace('/login')` | `context.go('/login')` | 替换路由 |
| `router.back()` | `context.pop()` | 返回 |
| `:id` 动态参数 | `path: '/book/:id'` | 路径参数 |
| `query: { page: 1 }` | `extra: {'page': 1}` | 额外参数 |
| 导航守卫 `beforeEach` | `GoRouter(redirect: ...)` | 路由守卫 |
| `<keep-alive>` | `StatefulShellRoute` | 保持页面状态 |
| `createWebHistory()` | `setPathUrlStrategy()` | HTML5 History 模式 |
| `createWebHashHistory()` | 默认 path 策略（带 `#`） | Hash 模式 |
| 嵌套路由 `children: [...]` | `ShellRoute` 嵌套 | 嵌套布局 |

---

## 5. 常用 Vue 库 → Flutter 对照

| 功能 | Vue 常用库 | Flutter 等价 |
|------|----------|-------------|
| HTTP 请求 | `axios` / `ofetch` | `dio` |
| 表单验证 | `vee-validate` / `zod` | Flutter 内置 Form + `validator` |
| 图标 | `@iconify/vue` | `Icons` 类 (Material Icons) |
| 国际化 | `vue-i18n` | `flutter_localizations` + ARB |
| 日期处理 | `dayjs` / `date-fns` | `intl` 包 + `DateFormat` |
| 状态持久化 | `pinia-plugin-persistedstate` | `SharedPreferences` / `Drift` |
| 缓存请求 | `@tanstack/vue-query` | 自定义 AsyncState 封装 |
| Markdown | `@vuepress/markdown` | `flutter_markdown` |
| 图表 | `echarts` / `chart.js` | `fl_chart` |
| Toast | `vue-toastification` | `ScaffoldMessenger.showSnackBar()` |
| 动画 | `<Transition>` / `<TransitionGroup>` | `AnimatedFoo` Widget / `TweenAnimationBuilder` |
| Skeleton | `vue-content-loader` | `Shimmer` 包 / 自定义 |
| PWA | `vite-pwa` / `@vite-pwa/vue` | Flutter 原生 Web 构建 |
| 测试 | `vitest` + `@vue/test-utils` | `flutter_test` + `WidgetTester` |

---

## 6. 生命周期对照

| Vue (Composition API) | Flutter (StatefulWidget) |
|----------------------|--------------------------|
| `setup()` 执行时 | `initState()` |
| `onMounted()` | `initState()` 末尾 / `addPostFrameCallback` |
| `onBeforeUpdate()` | `didUpdateWidget()` 开头 |
| `onUpdated()` | `build()` 方法 |
| `onBeforeUnmount()` | `dispose()` 方法 |
| `onUnmounted()` | `dispose()` 方法末尾 |
| `onActivated()` (keep-alive) | 页面被 StatefulShellRoute 重新激活 |
| `onDeactivated()` (keep-alive) | 页面被 StatefulShellRoute 隐藏 |
| `onErrorCaptured()` | `FlutterError.onError` / `PlatformDispatcher.onError` |

---

## 7. Vue 开发者的常见 Flutter 陷阱

| 陷阱 | Vue 习惯 | Flutter 正确做法 |
|------|---------|-----------------|
| **响应式误解** | 以为改变变量就会自动更新 UI | 必须调用 `setState()` 或 `ref.watch` |
| **模板思维** | 试图用 `v-if` / `v-for` 思维写代码 | 使用 Dart 原生 `if` / `for` / `ListView.builder` |
| **双向绑定** | 期望 `v-model` 式的双向绑定 | 手动用 `TextEditingController` + `onChanged` |
| **`computed` 自动缓存** | 以为 Dart getter 自动缓存计算结果 | Dart getter 每次访问都重新计算，用 `late final` 或 Riverpod 做缓存 |
| **`ref` 的自动解包** | `.value` 只在 `<script>` 中需要 | Flutter 中所有状态访问都是显式的 |
| **`<style scoped>`** | 期望 Scoped CSS | Flutter 没有 CSS，样式通过 Widget 属性实现 |
| **直觉式 `Object.keys()`** | 遍历对象键值 | Dart 中 `Map` 和对象是分离的（类≠Map） |
| **truthy/falsy** | `if (value)` 判断非空 | Dart 只有 `true`/`false`，必须写成 `if (value != null)` |
