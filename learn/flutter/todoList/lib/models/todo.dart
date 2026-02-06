class Todo {
  final String id;
  final String title;
  bool completed;

  Todo({
    required this.id,
    required this.title,
    this.completed = false,
  });
}
