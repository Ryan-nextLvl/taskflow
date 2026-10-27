import { randomUUID } from 'node:crypto';
import { AppError } from '../../src/errors/app-error.js';
import type {
  DatabaseHealth,
  ProjectsRepository,
} from '../../src/repositories/projects.repository.js';
import type { TaskListFilters, TasksRepository } from '../../src/repositories/tasks.repository.js';
import type { CreateProjectInput, UpdateProjectInput } from '../../src/schemas/project.schemas.js';
import type { CreateTaskInput, UpdateTaskInput } from '../../src/schemas/task.schemas.js';
import type {
  Paginated,
  Project,
  ProjectSummary,
  ProjectWithStats,
  Task,
  TaskEvent,
  TaskMetricRow,
} from '../../src/types/domain.js';

/** Estado compartilhado entre os repositórios falsos (simula o banco). */
export class FakeDatabase {
  projects: Project[] = [];
  tasks: Task[] = [];
  events: TaskEvent[] = [];
  /** Quantas vezes os indicadores foram lidos do "banco". */
  metricQueries = 0;
  /** Quando definido, toda operação falha com este erro (simula Supabase fora). */
  failWith: AppError | null = null;

  check(): void {
    if (this.failWith) throw this.failWith;
  }
}

export class InMemoryTasksRepository implements TasksRepository {
  constructor(private readonly db: FakeDatabase) {}

  async list(filters: TaskListFilters): Promise<Paginated<Task>> {
    this.db.check();
    const items = this.db.tasks.filter(
      (task) =>
        (!filters.status || task.status === filters.status) &&
        (!filters.search || task.title.toLowerCase().includes(filters.search.toLowerCase())),
    );
    const start = (filters.page - 1) * filters.pageSize;
    return { items: items.slice(start, start + filters.pageSize), total: items.length };
  }

  async findById(id: string): Promise<Task | null> {
    this.db.check();
    return this.db.tasks.find((task) => task.id === id) ?? null;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    this.db.check();
    const now = new Date().toISOString();
    const project = this.db.projects.find((p) => p.id === input.project_id) ?? null;
    if (input.project_id && !project) {
      throw new AppError(422, 'UNPROCESSABLE', 'O projeto informado não existe');
    }
    const task: Task = {
      id: randomUUID(),
      project_id: input.project_id ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      due_date: input.due_date ?? null,
      created_at: now,
      updated_at: now,
      completed_at: input.status === 'done' ? now : null,
      project: project && { id: project.id, name: project.name, color: project.color },
    };
    this.db.tasks.push(task);
    this.db.events.push({
      id: this.db.events.length + 1,
      task_id: task.id,
      event_type: 'created',
      description: 'Tarefa criada',
      metadata: {},
      created_at: now,
    });
    return task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    this.db.check();
    const task = this.db.tasks.find((t) => t.id === id);
    if (!task) return null;
    Object.assign(task, input, { updated_at: new Date().toISOString() });
    if (input.status) task.completed_at = input.status === 'done' ? task.updated_at : null;
    return task;
  }

  async delete(id: string): Promise<boolean> {
    this.db.check();
    const before = this.db.tasks.length;
    this.db.tasks = this.db.tasks.filter((t) => t.id !== id);
    return this.db.tasks.length < before;
  }

  async listEvents(taskId: string): Promise<TaskEvent[]> {
    this.db.check();
    return this.db.events.filter((e) => e.task_id === taskId).reverse();
  }

  async listMetricRows(): Promise<TaskMetricRow[]> {
    this.db.check();
    this.db.metricQueries += 1;
    return this.db.tasks.map(
      ({ status, priority, due_date, created_at, completed_at, project_id }) => ({
        status,
        priority,
        due_date,
        created_at,
        completed_at,
        project_id,
      }),
    );
  }
}

export class InMemoryProjectsRepository implements ProjectsRepository, DatabaseHealth {
  constructor(private readonly db: FakeDatabase) {}

  async list(): Promise<ProjectWithStats[]> {
    this.db.check();
    return this.db.projects.map((project) => this.withStats(project));
  }

  async findById(id: string): Promise<ProjectWithStats | null> {
    this.db.check();
    const project = this.db.projects.find((p) => p.id === id);
    return project ? this.withStats(project) : null;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    this.db.check();
    if (this.db.projects.some((p) => p.name.toLowerCase() === input.name.toLowerCase())) {
      throw new AppError(409, 'CONFLICT', 'Já existe um projeto com esse nome');
    }
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? null,
      color: input.color,
      created_at: now,
      updated_at: now,
    };
    this.db.projects.push(project);
    return project;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    this.db.check();
    const project = this.db.projects.find((p) => p.id === id);
    if (!project) return null;
    Object.assign(project, input);
    return project;
  }

  async delete(id: string): Promise<{ deleted: boolean; detachedTasks: number }> {
    this.db.check();
    const before = this.db.projects.length;
    this.db.projects = this.db.projects.filter((p) => p.id !== id);
    let detachedTasks = 0;
    for (const task of this.db.tasks) {
      if (task.project_id === id) {
        task.project_id = null;
        task.project = null;
        detachedTasks += 1;
      }
    }
    return { deleted: this.db.projects.length < before, detachedTasks };
  }

  async listSummaries(): Promise<ProjectSummary[]> {
    this.db.check();
    return this.db.projects.map(({ id, name, color }) => ({ id, name, color }));
  }

  async ping(): Promise<number> {
    this.db.check();
    return 1;
  }

  private withStats(project: Project): ProjectWithStats {
    const tasks = this.db.tasks.filter((t) => t.project_id === project.id);
    return {
      ...project,
      task_count: tasks.length,
      done_count: tasks.filter((t) => t.status === 'done').length,
    };
  }
}
