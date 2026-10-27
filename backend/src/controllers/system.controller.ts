import type { RequestHandler } from 'express';
import type { CacheStore } from '../cache/cache-store.js';
import type { DashboardCache } from '../cache/dashboard-cache.js';
import { cacheKeys } from '../cache/keys.js';
import type { DatabaseHealth } from '../repositories/projects.repository.js';
import type { DashboardService } from '../services/dashboard.service.js';

interface SystemDeps {
  dashboard: DashboardService;
  dashboardCache: DashboardCache;
  cacheStore: CacheStore;
  database: DatabaseHealth;
}

export function createSystemController({
  dashboard,
  dashboardCache,
  cacheStore,
  database,
}: SystemDeps) {
  /** Indicadores do dashboard. X-Cache informa HIT, MISS ou BYPASS. */
  const dashboardSummary: RequestHandler = async (_req, res) => {
    const { data, cache } = await dashboard.getSummary();
    res
      .set('Cache-Control', 'no-store')
      .set('X-Cache', cache.strategy)
      .set('X-Cache-Duration-Ms', String(cache.durationMs))
      .json({ data, meta: { cache } });
  };

  /** Saúde dos serviços externos, sem detalhes sensíveis. */
  const health: RequestHandler = async (_req, res) => {
    const [db, redis] = await Promise.allSettled([database.ping(), cacheStore.ping()]);
    const supabaseOk = db.status === 'fulfilled';
    const redisOk = redis.status === 'fulfilled';
    const status = !supabaseOk ? 'down' : redisOk ? 'ok' : 'degraded';
    res
      .status(supabaseOk ? 200 : 503)
      .set('Cache-Control', 'no-store')
      .json({
        status,
        services: {
          supabase: { ok: supabaseOk, latencyMs: supabaseOk ? db.value : null },
          redis: {
            ok: redisOk,
            status: cacheStore.status(),
            latencyMs: redisOk ? redis.value : null,
          },
        },
        uptimeSeconds: Math.round(process.uptime()),
      });
  };

  /** Painel técnico do cache (rota protegida por token). */
  const cacheDiagnostics: RequestHandler = async (_req, res) => {
    const { metrics } = dashboardCache;
    let latencyMs: number | null = null;
    let keyTtl: number | null = null;
    try {
      latencyMs = await cacheStore.ping();
      keyTtl = await cacheStore.ttl(dashboardCache.key);
    } catch {
      // Redis indisponível: o painel mostra o estado da conexão.
    }

    res.set('Cache-Control', 'no-store').json({
      data: {
        redis: {
          status: cacheStore.status(),
          connected: latencyMs !== null,
          latencyMs,
        },
        cache: {
          key: dashboardCache.key,
          generationKey: cacheKeys.dashboardGeneration,
          ttlSeconds: dashboardCache.ttlSeconds,
          exists: keyTtl !== null && keyTtl !== -2,
          ttlRemaining: keyTtl !== null && keyTtl >= 0 ? keyTtl : null,
          pendingInvalidation: dashboardCache.hasPendingInvalidation(),
        },
        stats: {
          hits: metrics.hits,
          misses: metrics.misses,
          bypasses: metrics.bypasses,
          hitRate: metrics.hitRate(),
          invalidations: metrics.invalidations,
          failedInvalidations: metrics.failedInvalidations,
          staleWritesSkipped: metrics.staleWritesSkipped,
          since: metrics.startedAt,
          scope: 'Contadores em memória deste processo da API (zeram ao reiniciar)',
        },
        lastRequest: metrics.lastRequest,
        lastInvalidation: metrics.lastInvalidation,
        events: metrics.recentEvents(),
      },
    });
  };

  const invalidateCache: RequestHandler = async (_req, res) => {
    const record = await dashboardCache.invalidate('manual (painel de diagnóstico)');
    res.status(record.ok ? 200 : 503).json({ data: record });
  };

  return { dashboardSummary, health, cacheDiagnostics, invalidateCache };
}
