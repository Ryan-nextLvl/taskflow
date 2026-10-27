import type { DashboardCache } from '../cache/dashboard-cache.js';
import type { ProjectsRepository } from '../repositories/projects.repository.js';
import type { TasksRepository } from '../repositories/tasks.repository.js';
import { computeDashboardSummary } from './dashboard-metrics.js';

export class DashboardService {
  constructor(
    private readonly tasks: TasksRepository,
    private readonly projects: ProjectsRepository,
    private readonly cache: DashboardCache,
    private readonly timezone: string,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Indicadores via cache-aside: Redis primeiro, Supabase em caso de MISS. */
  getSummary() {
    return this.cache.getOrCompute(async () => {
      const [rows, projects] = await Promise.all([
        this.tasks.listMetricRows(),
        this.projects.listSummaries(),
      ]);
      return computeDashboardSummary(rows, projects, {
        now: this.clock(),
        timezone: this.timezone,
      });
    });
  }
}
