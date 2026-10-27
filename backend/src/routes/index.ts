import { Router } from 'express';
import type { CacheStore } from '../cache/cache-store.js';
import type { DashboardCache } from '../cache/dashboard-cache.js';
import { createProjectsController } from '../controllers/projects.controller.js';
import { createSystemController } from '../controllers/system.controller.js';
import { createTasksController } from '../controllers/tasks.controller.js';
import { requireDiagnosticsToken } from '../middleware/diagnostics-auth.js';
import type { DatabaseHealth } from '../repositories/projects.repository.js';
import type { DashboardService } from '../services/dashboard.service.js';
import type { ProjectsService } from '../services/projects.service.js';
import type { TasksService } from '../services/tasks.service.js';

export interface ApiDependencies {
  tasks: TasksService;
  projects: ProjectsService;
  dashboard: DashboardService;
  dashboardCache: DashboardCache;
  cacheStore: CacheStore;
  database: DatabaseHealth;
  diagnosticsToken: string | undefined;
}

export function createApiRouter(deps: ApiDependencies): Router {
  const router = Router();
  const tasks = createTasksController(deps.tasks);
  const projects = createProjectsController(deps.projects);
  const system = createSystemController(deps);

  router.get('/health', system.health);
  router.get('/dashboard/summary', system.dashboardSummary);

  router.get('/tasks', tasks.list);
  router.post('/tasks', tasks.create);
  router.get('/tasks/:id', tasks.get);
  router.patch('/tasks/:id', tasks.update);
  router.delete('/tasks/:id', tasks.remove);
  router.get('/tasks/:id/events', tasks.history);

  router.get('/projects', projects.list);
  router.post('/projects', projects.create);
  router.get('/projects/:id', projects.get);
  router.patch('/projects/:id', projects.update);
  router.delete('/projects/:id', projects.remove);

  const diagnostics = Router();
  diagnostics.use(requireDiagnosticsToken(deps.diagnosticsToken));
  diagnostics.get('/cache', system.cacheDiagnostics);
  diagnostics.post('/cache/invalidate', system.invalidateCache);
  router.use('/diagnostics', diagnostics);

  return router;
}
