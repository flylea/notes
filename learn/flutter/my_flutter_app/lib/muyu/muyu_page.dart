import 'package:flutter/material.dart';

class MuyuPage extends StatefulWidget {
  const MuyuPage({super.key});

  @override
  State<MuyuPage> createState() => _MuyuPageState();
}

class _MuyuPageState extends State<MuyuPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(
      elevation: 0,
      backgroundColor: Colors.white,
      title: const Text("电子木鱼"),
      titleTextStyle: const TextStyle(color: Colors.black,fontSize: 16,fontWeight: FontWeight.bold),
      iconTheme: const IconThemeData(color: Colors.black),
      actions:[
        IconButton(onPressed: _toHistory, icon: const Icon(Icons.history)),
      ]
      
    ),
    body: Column(
      children: [
        Expanded(child: _buildTopContent()),
        Expanded(child: _buildImage()),
      ],
    )
    );
  }
  
  void _toHistory(){
    // Navigator.push(context, MaterialPageRoute(builder: (context)=>HistoryPage()));
  }
}

Widget _buildTopContent() {
  final ButtonStyle style = ElevatedButton.styleFrom(
    minimumSize: const Size(36, 36),
    padding: const EdgeInsets.all(0),
    backgroundColor: Colors.green,
    elevation: 0,
  );

  return Stack(
    children: [
      Center(
        child: Text(
          '功德数: 0',
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
        ),
      ),

      Positioned(
        right: 10,
        top: 10,
        child: Wrap(
          spacing: 8,
          direction: Axis.vertical,
          children: [
            ElevatedButton(
              onPressed: () {},
              style: style,
              child: Icon(Icons.music_note_outlined),
            ),
            ElevatedButton(
              onPressed: () {},
              style: style,
              child: Icon(Icons.image),
            ),
          ],
        ),
      ),
    ],
  );
}

Widget _buildImage() {
  return Center(
      child: Image.asset(
    'assets/images/muyu.jpg',
    height: 200, //图片高度
  ));
}
