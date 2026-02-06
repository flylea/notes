import 'package:flutter/material.dart';
import 'package:shadcn_ui/shadcn_ui.dart';
import '../models/todo.dart';

class TodoItem extends StatelessWidget {
  final Todo todo;
  final VoidCallback onToggle;
  final VoidCallback onDelete;

  const TodoItem({
    super.key,
    required this.todo,
    required this.onToggle,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return ShadCard(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            ShadCheckbox(
              value: todo.completed,
              onChanged: (_) => onToggle(),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                todo.title,
                style: TextStyle(
                  decoration:
                      todo.completed ? TextDecoration.lineThrough : null,
                  fontSize: 16,
                ),
              ),
            ),
            ShadButton(
              child: const Icon(Icons.delete, size: 20),
              onPressed: onDelete,
            ),
          ],
        ),
      ),
    );
  }
}
