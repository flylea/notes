import 'dart:math';
import 'package:flame_audio/flame_audio.dart';
import 'package:flutter/material.dart';

class MuyuController {

  final ValueNotifier<int> counter = ValueNotifier(0);
  final ValueNotifier<int> addValue = ValueNotifier(0);

  AudioPool? pool;
  final Random random = Random();
  int minValue = 1;
  int maxValue = 3;

  Future<void> init() async {
    pool = await FlameAudio.createPool('muyu_1.mp3', maxPlayers: 4);
  }

  void click() {
    final p = pool;
    if (p != null) {
      p.start();
    }

    final range = (maxValue - minValue + 1);
    final v = range <= 0 ? minValue : (minValue + random.nextInt(range));

    addValue.value = v;
    counter.value += v;
  }

  void setRange({required int min, required int max}) {
    minValue = min;
    maxValue = max;
  }

  void dispose() {
    pool?.dispose();
    counter.dispose();
    addValue.dispose();
  }
}
