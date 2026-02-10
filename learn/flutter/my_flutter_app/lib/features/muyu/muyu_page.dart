import 'package:flutter/material.dart';
import 'muyu_controller.dart';
import 'widgets/count_panel.dart';
import 'widgets/muyu_image.dart';
import 'widgets/animated_add_text.dart';
import 'widgets/image_option_item.dart';
import 'widgets/image_options.dart';

class MuyuPage extends StatefulWidget {
  const MuyuPage({super.key});

  @override
  State<MuyuPage> createState() => _MuyuPageState();
}

class _MuyuPageState extends State<MuyuPage> {
  final controller = MuyuController();
  int activeIndex = 0;
  final List<ImageOption> imageOptions = kImageOptions;

  @override
  void initState() {
    super.initState();
    controller.init();
    controller.setRange(
      min: imageOptions[activeIndex].min,
      max: imageOptions[activeIndex].max,
    );
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  final _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      // drawer: const MyDrawer(),
      appBar: AppBar(
        title: const Text(
          '电子木鱼',
          style: TextStyle(fontSize: 18, color: Colors.black),
        ),
        centerTitle: false,
        elevation: 0,
        backgroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.history, color: Colors.black54),
          ),
          const SizedBox(width: 8),
        ],
      ),
      backgroundColor: Colors.white,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Column(
                  children: [
                    Builder(
                      builder: (context) =>
                          _buildGreenButton(Icons.music_note, openBottomSheet),
                    ),
                    Builder(
                      builder: (context) => _buildGreenButton(
                        Icons.photo_library,
                        openBottomSheet,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 30),
          ValueListenableBuilder<int>(
            valueListenable: controller.counter,
            builder: (_, value, _) {
              return CountPanel(count: value);
            },
          ),
          const SizedBox(height: 40),

          Expanded(
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                Align(
                  alignment: Alignment.bottomCenter,
                  child: MuyuImage(
                    onTap: controller.click,
                    src: imageOptions[activeIndex].src,
                  ),
                ),

                Positioned(
                  bottom: 220,
                  child: ValueListenableBuilder<int>(
                    valueListenable: controller.addValue,
                    builder: (_, value, _) {
                      return AnimatedAddText(value: value);
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void openBottomSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Container(
          height: 300,
          padding: const EdgeInsets.only(top: 16),
          child: Column(
            children: [
              Container(
                alignment: Alignment.center,
                height: 46,
                child: const Text('底部弹窗', style: TextStyle(fontSize: 18)),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8.0,
                    vertical: 16.0,
                  ),
                  child: Row(
                    children: [
                      Expanded(child: _buildByIndex(0)),
                      const SizedBox(width: 10),
                      Expanded(child: _buildByIndex(1)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildByIndex(int index) {
    bool active = index == activeIndex;
    return GestureDetector(
      onTap: () => onSelect(index),
      child: ImageOptionItem(option: imageOptions[index], active: active),
    );
  }

  void onSelect(int index) {
    final option = imageOptions[index];
    controller.setRange(min: option.min, max: option.max);
    setState(() {
      activeIndex = index;
    });
    Navigator.of(context).pop();
  }

  Widget _buildGreenButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.green,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }
}

class MyDrawer extends StatelessWidget {
  const MyDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: const <Widget>[
          DrawerHeader(
            decoration: BoxDecoration(color: Colors.blue),
            child: Text('Drawer Header'),
          ),
          ListTile(title: Text('Item 1')),
          ListTile(title: Text('Item 2')),
        ],
      ),
    );
  }
}
