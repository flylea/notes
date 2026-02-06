import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';
import '../services/todo_service.dart';
import '../widgets/todo_item.dart';

class TodoPage extends StatefulWidget {
  const TodoPage({super.key});

  @override
  State<TodoPage> createState() => _TodoPageState();
}

class _TodoPageState extends State<TodoPage> {
  final TodoService service = TodoService();
  final TextEditingController controller = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Todo List')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: ShadInput(
                    controller: controller,
                    placeholder: const Text("输入 Todo"),
                  ),
                ),
                const SizedBox(width: 8),
                ShadButton(
                  child: const Text("添加"),
                  onPressed: () {
                    if (controller.text.isEmpty) return;
                    setState(() {
                      service.addTodo(controller.text);
                      controller.clear();
                    });
                  },
                )
              ],
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ListView(
                children: service.todos.map((todo) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: TodoItem(
                      todo: todo,
                      onToggle: () {
                        setState(() {
                          service.toggle(todo.id);
                        });
                      },
                      onDelete: () {
                        setState(() {
                          service.remove(todo.id);
                        });
                      },
                    ),
                  );
                }).toList(),
              ),
            )
          ],
        ),
      ),
    );
  }
}
