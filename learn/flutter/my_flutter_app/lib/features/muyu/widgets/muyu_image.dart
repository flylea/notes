import 'package:flutter/material.dart';

class MuyuImage extends StatelessWidget {

  final VoidCallback onTap;
  final String src;

  const MuyuImage({super.key, required this.onTap, this.src = 'assets/images/Pro.jpg'});

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.bottomCenter,
      child: GestureDetector(
        onTap: onTap,
        child: Image.asset(src, height: 200),
      ),
    );
  }
}
