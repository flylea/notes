import 'dart:math';
import 'package:flame_audio/flame_audio.dart';
import 'package:flutter/material.dart';

class MuyuController {

  final ValueNotifier<int> counter = ValueNotifier(0);
  final ValueNotifier<int> addValue = ValueNotifier(0);

  AudioPool? pool;
  final Random random = Random();

  Future<void> init() async {
    pool = await FlameAudio.createPool('muyu_1.mp3', maxPlayers: 4);
  }

  void click() {
    pool?.start();

    final v = 1 + random.nextInt(3);

    addValue.value = v;
    counter.value += v;
  }

  void dispose() {
    pool?.dispose();
    counter.dispose();
    addValue.dispose();
  }
}
