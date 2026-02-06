import 'package:flutter/material.dart';
import './muyu/muyu_page.dart';

void main() {
  runApp(const MainPage());
}

// // StatelessWidget Example
// // class MainPage extends StatelessWidget {
// //   const MainPage({super.key});

// //   @override
// //   Widget build(BuildContext context) {
// //     return MaterialApp(
// //       title: 'StatelessWidget Example',
// //       home: Scaffold(
// //       appBar: AppBar(
// //         title: const Text('StatelessWidget Example'),
// //       ),
// //       body: const Center(child: Text('Welcome to the StatelessWidget Example App!')),
// //       bottomNavigationBar: const BottomAppBar(
// //         child: Center(child: Text('© 2026 My Flutter App')),
// //       ),
// //       )
// //     );
// //   }
// // }

// // StatefulWidget Example
// // class MainPage extends StatefulWidget {
// //   const MainPage({super.key});

// //   @override
// //   State<MainPage> createState() => _MainPageState();
// // }

// // class _MainPageState extends State<MainPage> {
// //   @override
// //   Widget build(BuildContext context) {
// //     // TODO: implement build
// //    return MaterialApp(
// //       title: 'StatefulWidget Example',
// //       home: Scaffold(
// //       appBar: AppBar(
// //         title: const Text('StatefulWidget Example'),
// //       ),
// //       body: const Center(child: Text('Welcome to the StatefulWidget Example App!')),
// //       bottomNavigationBar: const BottomAppBar(
// //         child: Center(child: Text('© 2026 My Flutter App')),
// //       ),
// //       )
// //    );
// //   }
// // }

// class MainPage extends StatefulWidget {
//   const MainPage({super.key});

//   @override
//   State<MainPage> createState() => _MainPageState();
// }

// class _MainPageState extends State<MainPage> {
//   int _counter = 0;

//   void _onAdd() {
//     setState(() {
//       // _counter + 1;
//       _counter = _counter + 1;
//     });
//     print('add button clicked');
//   }

//   void _onSubtract() {
//     setState(() {
//       // _counter - 1;
//       _counter = _counter - 1;
//     });
//     print('subtract button clicked');
//   }

//   @override
//   Widget build(BuildContext context) {
//     return MaterialApp(
//       home: Scaffold(
//         appBar: AppBar(title: const Text('counter app')),
//         body: Container(
//           child: Center(
//             child: Row(
//               children: [
//                 TextButton(
//                   onPressed: _onSubtract,
//                   child: const Text('subtract'),
//                 ),
//                 Text(_counter.toString()),
//                 TextButton(onPressed: _onAdd, child: const Text('add')),
//                 const Box(),
//                 // const FlexBox()
//               ],
//             ),
//           ),
//         ),
//       ),
//     );
//   }
// }

// class Box extends StatelessWidget {
//   const Box({super.key});

//   @override
//   Widget build(BuildContext context) {
//     return Container(
//       alignment: Alignment.center,
//       width: 200,
//       height: 200,
//       margin: EdgeInsets.all(16),
//       // color: Colors.blue,
//       decoration: BoxDecoration(
//         color: Colors.blue,
//         border: Border.all(color: Colors.yellow, width: 2),
//         borderRadius: BorderRadius.circular(8),
//       ),

//       child: Text(
//         "Hello Box",
//         style: TextStyle(color: Colors.white, fontSize: 20),
//       ),
//     );
//   }
// }

// class FlexBox extends StatelessWidget {
//   const FlexBox({super.key});

//   @override
//   Widget build(BuildContext context) {
//     return SizedBox(
//       width: double.infinity,
//       height: 100,
//       child: Flex(
//         direction: Axis.horizontal,
//         children: [
//           Expanded(
//             flex: 2,
//             child: Container(
//               width: 100,
//               height: 100,
//               decoration: BoxDecoration(
//                 color: Colors.purpleAccent,
//                 border: Border.all(color: Colors.lightGreen, width: 2),
//               ),
//             ),
//           ),
//           Expanded(
//             flex: 1,
//             child: Container(
//               width: 100,
//               height: 100,
//               decoration: BoxDecoration(
//                 color: Colors.teal,
//                 border: Border.all(color: Colors.cyanAccent, width: 2),
//               ),
//             ),
//           ),
//         ],
//       ),
//     );
//   }
// }

class MainPage extends StatelessWidget {
  const MainPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('My App')),
        body: Container(child: MuyuPage()),
        bottomNavigationBar: Text(
          'Bottom Navigation Bar Data',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

// class StackPage extends StatelessWidget {
//   const StackPage({super.key});

//   @override
//   Widget build(BuildContext context) {
//     return Container(
//       width: double.infinity,
//       height: double.infinity,
//       color: Colors.amberAccent,
//       child: Stack(
//         alignment: Alignment.center,
//         children: [
//           Container(width: 300, height: 300, color: Colors.red),
//           // Container(width: 100, height: 100, color: Colors.green),
//           // Container(width: 100, height: 100, color: Colors.blue),
//           Positioned(
//             top: 10,
//             left: 10,
//             child: Container(width: 100, height: 100, color: Colors.green),
//           ),
//           Positioned(
//             bottom: 10,
//             right: 10,
//             child: Container(width: 100, height: 100, color: Colors.blue),
//           ),
//         ],
//       ),
//     );
//   }
// }

// class ImageAssets extends StatelessWidget {
//   const ImageAssets({super.key});

//   @override
//   Widget build(BuildContext context) {
//     // return Image.network('https://wallhaven.cc/w/lyzyql.jpg',
//     return Image.asset(
//       '/lib/images/meinv.jpg',
//       width: 300,
//       // height: ,
//       fit: BoxFit.cover,
//     );
//   }
// }

// class LoginPage extends StatefulWidget {
//   const LoginPage({super.key});

//   @override
//   State<LoginPage> createState() => _LoginPageState();
// }

// class _LoginPageState extends State<LoginPage> {
//   @override
//   Widget build(BuildContext context) {
//     return Column(
//       children: [],
//     );
//   }
// }

// class ScrollPage extends StatelessWidget {
//   const ScrollPage({super.key});

//   @override
//   Widget build(BuildContext context) {
//     return SingleChildScrollView(
//       scrollDirection: Axis.vertical,
//       padding: EdgeInsets.all(15),
//       child: Column(
//         children: List.generate(100, (idx) {
//           return Container(
//             width: double.infinity,
//             height: 50,
//             margin: EdgeInsets.only(top: 10),
//             alignment: Alignment.center,
//             // color: Colors.blueAccent,
//             decoration: BoxDecoration(
//               borderRadius: BorderRadius.all(Radius.circular(7)),
//               color: Colors.blue,
//             ),
//             child: Text(
//               'item ${idx + 1}',
//               style: TextStyle(
//                 fontSize: 20,
//                 color: Colors.white,
//                 fontWeight: FontWeight.w800,
//               ),
//             ),
//           );
//         }),
//       ),
//     );
//   }
// }

class ScrollPage extends StatelessWidget {
  const ScrollPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      child: ListView.builder(
        itemCount: 100,
        padding: EdgeInsets.all(10),
        itemBuilder: (BuildContext context, int index) {
          return Container(
            margin: EdgeInsets.only(top: 10),
            height: 50,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.all(Radius.circular(7)),
              color: Colors.blueAccent,
            ),

            child: Text(
              "item ${index + 1}",
              style: TextStyle(color: Colors.white, fontSize: 20),
            ),
          );
        },
      ),
    );
  }
}
