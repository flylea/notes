import '../models/todo.dart';
import 'dart:math';

class TodoService {
  final List<Todo> _todos = [];

  List<Todo> get todos => _todos;

  void addTodo(String title) {
    _todos.add(Todo(id: Random().nextDouble().toString(), title: title));
  }

  void toggle(String id) {
    final todo = _todos.firstWhere((t) => t.id == id);
    todo.completed = !todo.completed;
  }

  void remove(String id) {
    _todos.removeWhere((t) => t.id == id);
  }
}
