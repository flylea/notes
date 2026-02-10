class ImageOption {
  final String name;
  final String src;
  final int min;
  final int max;
  const ImageOption(this.name, this.src, this.min, this.max);
}

const List<ImageOption> kImageOptions = [
  ImageOption('基础版', 'assets/images/Pro.jpg', 1, 3),
  ImageOption('尊享版', 'assets/images/ProMax.png', 5, 8),
];
