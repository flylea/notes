import 'package:flutter/material.dart';

class CountPanel extends StatelessWidget {

  final int count;

  const CountPanel({super.key, required this.count});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        '功德数: $count',
        style: const TextStyle(fontSize: 24),
      ),
    );
  }
}
