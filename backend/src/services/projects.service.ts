import type { DashboardCache } from '../cache/dashboard-cache.js';
import { NotFoundError } from '../errors/app-error.js';
import type { ProjectsRepository } from '../repositories/projects.repository.js';
import type { CreateProjectInput, UpdateProjectInput } from '../schemas/project.schemas.js';

/**
 * Regras de negócio de projetos. O dashboard mostra a distribuição por projeto
 * (nome e cor), então criar, editar ou excluir projeto também invalida o cache.
 */
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly cache: DashboardCache,
  ) {}

  list() {
    return this.repository.list();
  }

  async get(id: string) {
    const project = await this.repository.findById(id);
    if (!project) throw new NotFoundError('Projeto não encontrado');
    return project;
  }

  async create(input: CreateProjectInput) {
    const project = await this.repository.create(input);
    const invalidation = await this.cache.invalidate('projeto criado');
    return { project, invalidation };
  }

  async update(id: string, input: UpdateProjectInput) {
    const project = await this.repository.update(id, input);
    if (!project) throw new NotFoundError('Projeto não encontrado');
    const invalidation = await this.cache.invalidate('projeto atualizado');
    return { project, invalidation };
  }

  async delete(id: string) {
    const result = await this.repository.delete(id);
    if (!result.deleted) throw new NotFoundError('Projeto não encontrado');
    const invalidation = await this.cache.invalidate('projeto excluído');
    return { detachedTasks: result.detachedTasks, invalidation };
  }
}
