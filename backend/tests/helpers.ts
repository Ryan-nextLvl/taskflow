import { pino } from 'pino';
import { CacheMetrics } from '../src/cache/cache-metrics.js';
import { DashboardCache } from '../src/cache/dashboard-cache.js';
import { createApp } from '../src/app.js';
import { DashboardService } from '../src/services/dashboard.service.js';
import { ProjectsService } from '../src/services/projects.service.js';
import { TasksService } from '../src/services/tasks.service.js';
import { InMemoryCacheStore } from './fakes/in-memory-cache-store.js';
import {
  FakeDatabase,
  InMemoryProjectsRepository,
  InMemoryTasksRepository,
} from './fakes/in-memory-repositories.js';

export const silentLogger = pino({ level: 'silent' });
export const TEST_TIMEZONE = 'America/Sao_Paulo';
export const DIAGNOSTICS_TOKEN = 'token-de-teste-com-16+';

/** Monta a API completa com dublês controlados (sem Supabase/Redis reais). */
export function buildTestApp() {
  const db = new FakeDatabase();
  const store = new InMemoryCacheStore();
  const tasksRepository = new InMemoryTasksRepository(db);
  const projectsRepository = new InMemoryProjectsRepository(db);
  const dashboardCache = new DashboardCache(store, new CacheMetrics(), silentLogger, 60);

  const app = createApp({
    logger: silentLogger,
    corsOrigins: ['http://localhost:5173'],
    rateLimitPerMinute: 0,
    tasks: new TasksService(tasksRepository, dashboardCache, TEST_TIMEZONE),
    projects: new ProjectsService(projectsRepository, dashboardCache),
    dashboard: new DashboardService(
      tasksRepository,
      projectsRepository,
      dashboardCache,
      TEST_TIMEZONE,
    ),
    dashboardCache,
    cacheStore: store,
    database: projectsRepository,
    diagnosticsToken: DIAGNOSTICS_TOKEN,
  });

  return { app, db, store, dashboardCache };
}
