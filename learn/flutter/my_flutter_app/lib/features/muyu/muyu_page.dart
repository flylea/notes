import 'package:flutter/material.dart';
import 'muyu_controller.dart';
import 'widgets/count_panel.dart';
import 'widgets/muyu_image.dart';
import 'widgets/animated_add_text.dart';

class MuyuPage extends StatefulWidget {
  const MuyuPage({super.key});

  @override
  State<MuyuPage> createState() => _MuyuPageState();
}

class _MuyuPageState extends State<MuyuPage> {

  final controller = MuyuController();

  @override
  void initState() {
    super.initState();
    controller.init();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {

    return Scaffold(
      appBar: AppBar(title: const Text('电子木鱼')),
      body: Column(
        children: [

          /// ⭐ 只刷新这个组件
          ValueListenableBuilder(
            valueListenable: controller.counter,
            builder: (_, value, __) {
              return CountPanel(count: value);
            },
          ),

          Expanded(
            child: Stack(
              alignment: Alignment.topCenter,
              children: [

                MuyuImage(onTap: controller.click),

                /// ⭐ 动画独立刷新
                ValueListenableBuilder(
                  valueListenable: controller.addValue,
                  builder: (_, value, __) {
                    return AnimatedAddText(value: value);
                  },
                ),

              ],
            ),
          )
        ],
      ),
    );
  }
}
