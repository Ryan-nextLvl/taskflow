import type { Redis } from 'ioredis';
import { CacheMetrics } from './cache/cache-metrics.js';
import { DashboardCache } from './cache/dashboard-cache.js';
import { RedisCacheStore } from './cache/redis-cache-store.js';
import { createRedisClient } from './cache/redis-client.js';
import type { AppConfig } from './config/env.js';
import type { Logger } from './config/logger.js';
import { createSupabaseClient } from './lib/supabase.js';
import { SupabaseProjectsRepository } from './repositories/supabase/supabase-projects.repository.js';
import { SupabaseTasksRepository } from './repositories/supabase/supabase-tasks.repository.js';
import type { ApiDependencies } from './routes/index.js';
import { DashboardService } from './services/dashboard.service.js';
import { ProjectsService } from './services/projects.service.js';
import { TasksService } from './services/tasks.service.js';

/** Liga as implementações reais (Supabase + Redis) às camadas da aplicação. */
export function buildContainer(
  config: AppConfig,
  logger: Logger,
): ApiDependencies & { redis: Redis } {
  const db = createSupabaseClient(config.supabaseUrl, config.supabaseSecretKey);
  const redis = createRedisClient(config.redisUrl, logger.child({ component: 'redis' }));

  const tasksRepository = new SupabaseTasksRepository(db);
  const projectsRepository = new SupabaseProjectsRepository(db);
  const cacheStore = new RedisCacheStore(redis);
  const dashboardCache = new DashboardCache(
    cacheStore,
    new CacheMetrics(),
    logger.child({ component: 'cache' }),
    config.cacheTtlSeconds,
  );

  return {
    redis,
    cacheStore,
    dashboardCache,
    database: projectsRepository,
    tasks: new TasksService(tasksRepository, dashboardCache, config.timezone),
    projects: new ProjectsService(projectsRepository, dashboardCache),
    dashboard: new DashboardService(
      tasksRepository,
      projectsRepository,
      dashboardCache,
      config.timezone,
    ),
    diagnosticsToken: config.diagnosticsToken,
  };
}
