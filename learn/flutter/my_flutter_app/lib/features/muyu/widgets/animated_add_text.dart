import 'package:flutter/material.dart';

class AnimatedAddText extends StatefulWidget {

  final int value;

  const AnimatedAddText({super.key, required this.value});

  @override
  State<AnimatedAddText> createState() => _AnimatedAddTextState();
}

class _AnimatedAddTextState extends State<AnimatedAddText>
    with SingleTickerProviderStateMixin {

  late AnimationController controller;
  late Animation<double> opacity;

  @override
  void initState() {
    super.initState();

    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    opacity = Tween(begin: 1.0, end: 0.0).animate(controller);
  }

  @override
  void didUpdateWidget(covariant AnimatedAddText oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.value != 0) {
      controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {

    if (widget.value == 0) return const SizedBox();

    return FadeTransition(
      opacity: opacity,
      child: Text('功德+${widget.value}'),
    );
  }
}
