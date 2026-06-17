# 附录 C：Dart 核心库速查

> 原文: [dart.cn/guides/libraries](https://dart.cn/guides/libraries)

## dart:core — 内置基础

### String

```dart
'hello'.toUpperCase()
'hello'.toLowerCase()
' hello '.trim()
'hello'.contains('ell')
'hello'.startsWith('he')
'hello'.endsWith('lo')
'hello'.split(',')
'hello'.replaceAll('h', 'H')
'hello'.padLeft(10, '-')
'hello'.substring(1, 4)
'hello'.indexOf('l')
'hello'.isEmpty
'hello'.isNotEmpty
'${2 + 2}'  // 字符串插值
```

### int / double / num

```dart
42.abs()
3.14.ceil()
3.14.floor()
3.14159.round()
3.14159.toStringAsFixed(2)  // "3.14"
price.clamp(0, 100)
int.parse('42')
double.parse('3.14')
42.isEven / 42.isOdd
42.isFinite / 42.isInfinite
```

### DateTime / Duration

```dart
DateTime.now()
DateTime(2024, 1, 1)
DateTime.parse('2024-01-01')
now.add(Duration(days: 7))
now.subtract(Duration(hours: 3))
a.difference(b)            // Duration
a.isAfter(b) / a.isBefore(b)
now.millisecondsSinceEpoch
Duration(seconds: 30).inMilliseconds
```

### List / Set / Map

```dart
list.add(item) / list.remove(item)
list.contains(item) / list.indexOf(item)
list.map((e) => e * 2)
list.where((e) => e > 5)
list.reduce((a, b) => a + b)
list.fold(0, (prev, e) => prev + e)
list.expand((e) => [e, e])
list.sort((a, b) => a.compareTo(b))
list.sublist(1, 3)
list.first / list.last / list.length
list.isEmpty / list.isNotEmpty

// Set 常用——不重复
set.add(item) / set.remove(item)
set.contains(item)
set.intersection(other)
set.union(other)

// Map 常用
map[key] = value
map.containsKey(key) / map.remove(key)
map.keys / map.values
map.entries
map.map((k, v) => MapEntry(k, v.toUpperCase()))
```

### RegExp

```dart
RegExp(r'\d+').hasMatch(str)
RegExp(r'\d+').allMatches(str)
RegExp(r'\d+').stringMatch(str)
RegExp(r'\d+').firstMatch(str)
```

### 其他核心类型

```dart
// Comparable — 实现 compareTo() 即可排序
// Iterable<T> — List/Set 的父类型，提供惰性求值方法链
// Object — hashCode, toString(), runtimeType, ==
// Symbol — #mySymbol 用于反射/mirrors
// Stopwatch — start() / stop() / elapsed
// Uri — parse() / host / path / queryParameters
```

## dart:collection — 专用集合

```dart
// HashMap — 无序、基于 hash，高性能
var map = HashMap<String, int>();

// LinkedHashMap — 保留插入顺序（Dart 2.0+ Map 默认实现）
var ordered = LinkedHashMap<String, int>();

// Queue — 高效首尾插入/删除（比 List 末尾操作更快）
var queue = Queue<int>();
queue.addFirst(1);
queue.addLast(3);
queue.removeFirst();
queue.removeLast();

// LinkedList — 双向链表，需要元素实现 LinkedListEntry
class Node extends LinkedListEntry<Node> { final int value; Node(this.value); }
var list = LinkedList<Node>();
list.add(Node(1));

// SplayTreeMap — 有序 Map，按键排序的平衡树
var sorted = SplayTreeMap<String, int>();
sorted['a'] = 1;
sorted['b'] = 2;

// UnmodifiableListView — 不可修改的 List 视图
var fixed = UnmodifiableListView([1, 2, 3]);
```

## dart:async — 异步编程

```dart
// Future — then() / catchError() / whenComplete()
fetchData()
  .then((data) => process(data))
  .catchError((e) => handleError(e))

// Stream — listen() / asyncMap() / where() / map() / transform() / handleError()
stream
  .where((e) => e.isValid)
  .map((e) => e.value)
  .listen((value) => print(value))

// Completer<T> — 手动完成一个 Future
var completer = Completer<String>();
completer.future.then(print);
completer.complete('done');

// Timer — 延迟/周期任务
Timer(Duration(seconds: 1), () => print('done'));
var timer = Timer.periodic(Duration(seconds: 1), (t) => print(t.tick));
timer.cancel();

// StreamController — 手动创建 Stream
var controller = StreamController<int>();
controller.add(1);
controller.stream.listen(print);
controller.close();

// await for — 消费 Stream
await for (var event in stream) { print(event); }
```

## dart:convert — 编解码

```dart
jsonEncode({'name': 'Alice'})        // "{"name":"Alice"}"
jsonDecode('{"name":"Alice"}')       // Map<String, dynamic>

utf8.encode('你好')                   // Uint8List
utf8.decode(bytes)                   // String

base64.encode(bytes)                 // String
base64.decode(str)                   // Uint8List

LineSplitter().convert(text)         // List<String> — 按行分割
```

## dart:math — 数学

```dart
var rng = Random();
rng.nextInt(100)
rng.nextDouble()
rng.nextBool()

min(a, b) / max(a, b)
sqrt(25)         // 5.0
pow(2, 10)       // 1024
sin(pi / 2)      // 1.0
cos(0)           // 1.0
log(100)

pi    // 3.14159...
e     // 2.71828...
```

## dart:io — 文件与网络

```dart
// File
file.readAsString()
file.readAsBytes()
file.readAsLines()
file.writeAsString('content')
file.writeAsBytes(bytes)
file.exists()
file.delete()
file.length()
file.lastModified()

// Directory
dir.list().listen((entity) => print(entity))
dir.create()
dir.delete()

// HttpClient — HTTP 底层 API
var client = HttpClient();
var request = await client.getUrl(Uri.parse('https://example.com'));
var response = await request.close();

// Socket / ServerSocket — TCP 网络

// Platform
Platform.isAndroid / Platform.isIOS
Platform.isWindows / Platform.isMacOS / Platform.isLinux
Platform.environment  // Map<String, String>
Platform.operatingSystem
```

## dart:developer — 调试工具

```dart
import 'dart:developer';

// debugger() — 程序执行到此行时暂停（类似断点）
debugger(when: condition);

// log() — 输出到开发者控制台（不依赖 print）
log('User tapped: $event', name: 'ui-events');
log('API response: $data', name: 'network', time: DateTime.now());

// Timeline — 性能分析
Timeline.startSync('image-decode');
decodeImage(bytes);
Timeline.finishSync();

Timeline.timeSync('network-request', () {
  // 被计时的代码块
});
```

> Flutter 项目中优先使用 `path_provider` 获取目录、`Dio` 做 HTTP 请求——它们是 `dart:io` 的上层封装。
