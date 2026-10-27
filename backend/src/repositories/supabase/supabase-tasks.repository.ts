import { fromDatabaseError } from '../../errors/app-error.js';
import type { TaskflowDatabase } from '../../lib/supabase.js';
import type { CreateTaskInput, UpdateTaskInput } from '../../schemas/task.schemas.js';
import type { Paginated, Task, TaskEvent, TaskMetricRow } from '../../types/domain.js';
import type { TaskListFilters, TasksRepository } from '../tasks.repository.js';

interface FilterableQuery<Q> {
  ilike(column: string, pattern: string): Q;
  eq(column: string, value: string): Q;
  neq(column: string, value: string): Q;
  is(column: string, value: null): Q;
  lt(column: string, value: string): Q;
}

const TASK_COLUMNS =
  'id, project_id, title, description, status, priority, due_date, created_at, updated_at, completed_at, project:projects(id, name, color)';

/** Limite de linhas por requisição do PostgREST (padrão do Supabase: 1000). */
const PAGE_LIMIT = 1000;

/** Escapa curingas do LIKE para buscar o texto literal digitado. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Filtros compartilhados pela listagem e pela contagem. */
function applyFilters<Q extends FilterableQuery<Q>>(query: Q, filters: TaskListFilters): Q {
  let q = query;
  if (filters.search) q = q.ilike('title', `%${escapeLike(filters.search)}%`);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.priority) q = q.eq('priority', filters.priority);
  if (filters.projectId === 'none') q = q.is('project_id', null);
  else if (filters.projectId) q = q.eq('project_id', filters.projectId);
  if (filters.overdue === true) q = q.lt('due_date', filters.today).neq('status', 'done');
  return q;
}

export class SupabaseTasksRepository implements TasksRepository {
  constructor(private readonly db: TaskflowDatabase) {}

  async list(filters: TaskListFilters): Promise<Paginated<Task>> {
    const from = (filters.page - 1) * filters.pageSize;
    let query = applyFilters(
      this.db.from('tasks').select(TASK_COLUMNS, { count: 'exact' }),
      filters,
    );

    query = query.order(filters.sort, { ascending: filters.order === 'asc', nullsFirst: false });
    if (filters.sort !== 'created_at') query = query.order('created_at', { ascending: false });
    query = query.order('id', { ascending: true }).range(from, from + filters.pageSize - 1);

    const { data, error, count } = await query;
    if (!error) return { items: data as Task[], total: count ?? 0 };

    // Página além do total: devolve lista vazia com o total correto.
    if (error.code === 'PGRST103') {
      const counted = await applyFilters(
        this.db.from('tasks').select('id', { count: 'exact', head: true }),
        filters,
      );
      if (counted.error) throw fromDatabaseError(counted.error, 'listar tarefas');
      return { items: [], total: counted.count ?? 0 };
    }
    throw fromDatabaseError(error, 'listar tarefas');
  }

  async findById(id: string): Promise<Task | null> {
    const { data, error } = await this.db
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error, 'buscar a tarefa');
    return data as Task | null;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const { data, error } = await this.db.from('tasks').insert(input).select(TASK_COLUMNS).single();
    if (error) throw fromDatabaseError(error, 'criar a tarefa');
    return data as Task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const { data, error } = await this.db
      .from('tasks')
      .update(input)
      .eq('id', id)
      .select(TASK_COLUMNS)
      .maybeSingle();
    if (error) throw fromDatabaseError(error, 'atualizar a tarefa');
    return data as Task | null;
  }

  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.db.from('tasks').delete().eq('id', id).select('id');
    if (error) throw fromDatabaseError(error, 'excluir a tarefa');
    return data.length > 0;
  }

  async listEvents(taskId: string, limit: number): Promise<TaskEvent[]> {
    const { data, error } = await this.db
      .from('task_events')
      .select('id, task_id, event_type, description, metadata, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit);
    if (error) throw fromDatabaseError(error, 'listar o histórico');
    return data as TaskEvent[];
  }

  async listMetricRows(): Promise<TaskMetricRow[]> {
    const rows: TaskMetricRow[] = [];
    for (let from = 0; ; from += PAGE_LIMIT) {
      const { data, error } = await this.db
        .from('tasks')
        .select('status, priority, due_date, created_at, completed_at, project_id')
        .order('id', { ascending: true })
        .range(from, from + PAGE_LIMIT - 1);
      if (error) throw fromDatabaseError(error, 'calcular os indicadores');
      rows.push(...data);
      if (data.length < PAGE_LIMIT) return rows;
    }
  }
}
