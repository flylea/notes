import 'dart:math';
import 'package:flame_audio/flame_audio.dart';
import 'package:flutter/material.dart';

import 'widgets/count_panel.dart';
import 'widgets/muyu_image.dart';
import 'widgets/animated_add_text.dart';

class MuyuBoard extends StatefulWidget {
  const MuyuBoard({super.key});

  @override
  State<MuyuBoard> createState() => _MuyuBoardState();
}

class _MuyuBoardState extends State<MuyuBoard> {
  AudioPool? pool;

  int counter = 0;
  int cruValue = 0;

  final Random random = Random();

  @override
  void initState() {
    super.initState();
    _initAudio();
  }

  Future<void> _initAudio() async {
    pool = await FlameAudio.createPool('muyu_1.mp3', maxPlayers: 4);
  }

  @override
  void dispose() {
    pool?.dispose();
    super.dispose();
  }

  void _onClick() {
    pool?.start();

    setState(() {
      cruValue = 1 + random.nextInt(3);
      counter += cruValue;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(child: CountPanel(count: counter)),
        Expanded(
          child: Stack(
            alignment: Alignment.topCenter,
            children: [
              MuyuImage(
                onTap: _onClick,
              ),
              AnimatedAddText(value: cruValue),
            ],
          ),
        ),
      ],
    );
  }
}
