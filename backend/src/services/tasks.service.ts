import type { DashboardCache } from '../cache/dashboard-cache.js';
import { NotFoundError } from '../errors/app-error.js';
import { toLocalDate } from '../lib/dates.js';
import type { TasksRepository } from '../repositories/tasks.repository.js';
import { TASK_STATUS_LABELS } from '../types/domain.js';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from '../schemas/task.schemas.js';

const HISTORY_LIMIT = 100;

/**
 * Regras de negócio de tarefas. Toda escrita bem-sucedida no banco invalida
 * os indicadores do dashboard no Redis.
 */
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly cache: DashboardCache,
    private readonly timezone: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  list(query: ListTasksQuery) {
    return this.repository.list({ ...query, today: toLocalDate(this.clock(), this.timezone) });
  }

  async get(id: string) {
    const task = await this.repository.findById(id);
    if (!task) throw new NotFoundError('Tarefa não encontrada');
    return task;
  }

  async getHistory(id: string) {
    await this.get(id);
    return this.repository.listEvents(id, HISTORY_LIMIT);
  }

  async create(input: CreateTaskInput) {
    const task = await this.repository.create(input);
    const invalidation = await this.cache.invalidate('tarefa criada');
    return { task, invalidation };
  }

  async update(id: string, input: UpdateTaskInput) {
    const task = await this.repository.update(id, input);
    if (!task) throw new NotFoundError('Tarefa não encontrada');
    const reason = input.status
      ? `status alterado para "${TASK_STATUS_LABELS[input.status]}"`
      : 'tarefa atualizada';
    const invalidation = await this.cache.invalidate(reason);
    return { task, invalidation };
  }

  async delete(id: string) {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundError('Tarefa não encontrada');
    const invalidation = await this.cache.invalidate('tarefa excluída');
    return { invalidation };
  }
}
