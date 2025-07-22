import { z } from 'zod';

export interface Todo {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

export interface TodoWriteParams {
  todos: Todo[];
}

export const TodoSchema = z.object({
  id: z.string(),
  content: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['high', 'medium', 'low'])
});

export const TodoWriteParamsSchema = z.object({
  todos: z.array(TodoSchema)
});

export const TodoWriteTool = {
  name: 'todo_write',
  description: 'Internal task planning and tracking for browser automation. Creates and manages a structured task list to track progress through complex multi-step operations.',
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The complete list of tasks (full state replacement)',
        items: {
          type: 'object',
          properties: {
            id: { 
              type: 'string',
              description: 'Unique identifier for the task'
            },
            content: { 
              type: 'string', 
              minLength: 1,
              description: 'Task description including verification criteria'
            },
            status: { 
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'Current status of the task'
            },
            priority: { 
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'Task priority level'
            }
          },
          required: ['id', 'content', 'status', 'priority'],
          additionalProperties: false
        }
      }
    },
    required: ['todos'],
    additionalProperties: false
  }
};

export class TodoManager {
  private todos: Map<string, Todo> = new Map();
  private nextId: number = 1;

  generateId(): string {
    return String(this.nextId++);
  }

  setTodos(todos: Todo[]): void {
    this.todos.clear();
    todos.forEach(todo => {
      this.todos.set(todo.id, todo);
    });
  }

  getTodos(): Todo[] {
    return Array.from(this.todos.values());
  }

  getTodoById(id: string): Todo | undefined {
    return this.todos.get(id);
  }

  getNextPendingTask(): Todo | undefined {
    const todos = this.getTodos();
    
    // First, check if any task is in progress
    const inProgress = todos.find(t => t.status === 'in_progress');
    if (inProgress) {
      return undefined; // Don't start new task if one is in progress
    }

    // Return highest priority pending task
    return todos
      .filter(t => t.status === 'pending')
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })[0];
  }

  updateTaskStatus(id: string, status: Todo['status']): void {
    const todo = this.todos.get(id);
    if (todo) {
      todo.status = status;
    }
  }

  areAllTasksCompleted(): boolean {
    return Array.from(this.todos.values()).every(
      todo => todo.status === 'completed'
    );
  }

  hasFailedTasks(): boolean {
    // In our current model, we don't have a 'failed' status
    // Tasks remain 'in_progress' if they fail
    // This could be extended in the future
    return false;
  }

  createTasksFromCommand(command: string): Todo[] {
    // This is a placeholder for AI-driven task decomposition
    // In practice, this would be done by the AI model
    // based on the command complexity
    return [];
  }
}