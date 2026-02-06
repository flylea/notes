import 'package:flutter/material.dart';

class MuyuImage extends StatelessWidget {

  final VoidCallback onTap;

  const MuyuImage({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        onTap: onTap,
        child: Image.asset('assets/images/muyu.jpg', height: 200),
      ),
    );
  }
}
