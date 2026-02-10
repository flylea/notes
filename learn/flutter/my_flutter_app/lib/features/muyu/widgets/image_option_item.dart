import 'package:flutter/material.dart';
import 'image_options.dart';

class ImageOptionItem extends StatelessWidget {
  final ImageOption option;
  final bool active;
  const ImageOptionItem({super.key, required this.option, required this.active});

  @override
  Widget build(BuildContext context) {
    const Border activeBorder = Border.fromBorderSide(
      BorderSide(color: Colors.blue),
    );

    return Container(
      padding:  const EdgeInsets.all(8.0),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.all(const Radius.circular(8.0)),
        border: !active ? null : activeBorder
      ),
      
      child: Column(
        children: [
          Text(option.name,style: const TextStyle(fontWeight: FontWeight.bold)),
          Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal: 8.0),
          child: Image.asset(option.src, fit: BoxFit.contain),
          )),
          Text('每次功德+${option.min}~${option.max}', style: const TextStyle(fontSize: 12.0, color: Colors.grey))
        ],
      ),
    );
  }
}
