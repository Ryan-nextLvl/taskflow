import type { CreateProjectInput, UpdateProjectInput } from '../schemas/project.schemas.js';
import type { Project, ProjectSummary, ProjectWithStats } from '../types/domain.js';

/** Acesso a dados de projetos. Implementação real: SupabaseProjectsRepository. */
export interface ProjectsRepository {
  list(): Promise<ProjectWithStats[]>;
  findById(id: string): Promise<ProjectWithStats | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(id: string, input: UpdateProjectInput): Promise<Project | null>;
  /** Exclui o projeto; as tarefas ficam sem projeto (ON DELETE SET NULL). */
  delete(id: string): Promise<{ deleted: boolean; detachedTasks: number }>;
  listSummaries(): Promise<ProjectSummary[]>;
}

export interface DatabaseHealth {
  /** Executa uma consulta leve e retorna a latência em ms. */
  ping(): Promise<number>;
}
