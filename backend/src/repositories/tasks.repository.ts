import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from '../schemas/task.schemas.js';
import type { Paginated, Task, TaskEvent, TaskMetricRow } from '../types/domain.js';

export interface TaskListFilters extends ListTasksQuery {
  /** Data local de hoje (YYYY-MM-DD), usada no filtro de atrasadas. */
  today: string;
}

/** Acesso a dados de tarefas. Implementação real: SupabaseTasksRepository. */
export interface TasksRepository {
  list(filters: TaskListFilters): Promise<Paginated<Task>>;
  findById(id: string): Promise<Task | null>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, input: UpdateTaskInput): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
  listEvents(taskId: string, limit: number): Promise<TaskEvent[]>;
  /** Todas as tarefas, apenas com as colunas necessárias aos indicadores. */
  listMetricRows(): Promise<TaskMetricRow[]>;
}
