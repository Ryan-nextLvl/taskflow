import { fromDatabaseError } from '../../errors/app-error.js';
import type { TaskflowDatabase } from '../../lib/supabase.js';
import type { CreateProjectInput, UpdateProjectInput } from '../../schemas/project.schemas.js';
import type { Project, ProjectSummary, ProjectWithStats } from '../../types/domain.js';
import type { DatabaseHealth, ProjectsRepository } from '../projects.repository.js';

const PROJECT_COLUMNS = 'id, name, description, color, created_at, updated_at';
// Duas contagens agregadas do mesmo relacionamento: todas as tarefas e as concluídas.
const PROJECT_WITH_STATS = `${PROJECT_COLUMNS}, all_tasks:tasks(count), done_tasks:tasks(count)`;

interface ProjectStatsRow extends Project {
  all_tasks: Array<{ count: number }>;
  done_tasks: Array<{ count: number }>;
}

const toProjectWithStats = ({
  all_tasks,
  done_tasks,
  ...project
}: ProjectStatsRow): ProjectWithStats => ({
  ...project,
  task_count: all_tasks[0]?.count ?? 0,
  done_count: done_tasks[0]?.count ?? 0,
});

export class SupabaseProjectsRepository implements ProjectsRepository, DatabaseHealth {
  constructor(private readonly db: TaskflowDatabase) {}

  async list(): Promise<ProjectWithStats[]> {
    const { data, error } = await this.db
      .from('projects')
      .select(PROJECT_WITH_STATS)
      .eq('done_tasks.status', 'done')
      .order('name', { ascending: true });
    if (error) throw fromDatabaseError(error, 'listar projetos');
    return (data as unknown as ProjectStatsRow[]).map(toProjectWithStats);
  }

  async findById(id: string): Promise<ProjectWithStats | null> {
    const { data, error } = await this.db
      .from('projects')
      .select(PROJECT_WITH_STATS)
      .eq('done_tasks.status', 'done')
      .eq('id', id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error, 'buscar o projeto');
    return data ? toProjectWithStats(data as unknown as ProjectStatsRow) : null;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const { data, error } = await this.db
      .from('projects')
      .insert(input)
      .select(PROJECT_COLUMNS)
      .single();
    if (error) throw fromDatabaseError(error, 'criar o projeto');
    return data;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
    const { data, error } = await this.db
      .from('projects')
      .update(input)
      .eq('id', id)
      .select(PROJECT_COLUMNS)
      .maybeSingle();
    if (error) throw fromDatabaseError(error, 'atualizar o projeto');
    return data;
  }

  async delete(id: string): Promise<{ deleted: boolean; detachedTasks: number }> {
    const { count, error: countError } = await this.db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id);
    if (countError) throw fromDatabaseError(countError, 'excluir o projeto');

    const { data, error } = await this.db.from('projects').delete().eq('id', id).select('id');
    if (error) throw fromDatabaseError(error, 'excluir o projeto');
    const deleted = data.length > 0;
    return { deleted, detachedTasks: deleted ? (count ?? 0) : 0 };
  }

  async listSummaries(): Promise<ProjectSummary[]> {
    const { data, error } = await this.db
      .from('projects')
      .select('id, name, color')
      .order('name', { ascending: true });
    if (error) throw fromDatabaseError(error, 'listar projetos');
    return data;
  }

  async ping(): Promise<number> {
    const started = performance.now();
    const { error } = await this.db.from('projects').select('id', { head: true }).limit(1);
    if (error) throw fromDatabaseError(error, 'verificar o banco');
    return Math.round(performance.now() - started);
  }
}
