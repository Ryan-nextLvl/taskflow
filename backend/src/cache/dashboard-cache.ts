import type { Logger } from '../config/logger.js';
import type { CacheStore } from './cache-store.js';
import type { CacheMetrics, CacheStrategy, InvalidationRecord } from './cache-metrics.js';
import { cacheKeys, dashboardKeys } from './keys.js';

export interface CacheMeta {
  strategy: CacheStrategy;
  key: string;
  ttlSeconds: number;
  /** Segundos até expirar (null quando o Redis não foi usado). */
  ttlRemaining: number | null;
  cachedAt: string | null;
  durationMs: number;
  /** Explica o BYPASS (Redis indisponível) sem expor detalhes internos. */
  notice?: string;
}

interface CachedEntry<T> {
  cachedAt: string;
  data: T;
}

const elapsed = (started: number) => Math.round((performance.now() - started) * 100) / 100;

/**
 * Cache-aside dos indicadores do dashboard.
 *
 * 1. Lê a chave no Redis. Encontrou → HIT.
 * 2. Não encontrou → MISS: calcula a partir do Supabase e grava com TTL.
 * 3. Redis fora do ar → BYPASS: responde direto do Supabase.
 *
 * A gravação só acontece se nenhuma invalidação ocorreu durante o cálculo
 * (contador de geração), evitando que um resultado antigo volte ao cache.
 */
export class DashboardCache {
  private pendingInvalidation = false;

  constructor(
    private readonly store: CacheStore,
    readonly metrics: CacheMetrics,
    private readonly logger: Logger,
    readonly ttlSeconds: number,
  ) {
    // Se uma invalidação falhou com o Redis fora, ela é refeita na reconexão,
    // para que o Redis não volte servindo dados anteriores à alteração.
    store.onReady(() => {
      if (this.pendingInvalidation) void this.invalidate('reconexão: invalidação pendente');
    });
  }

  readonly key = cacheKeys.dashboardSummary;

  async getOrCompute<T>(compute: () => Promise<T>): Promise<{ data: T; cache: CacheMeta }> {
    const started = performance.now();
    let generation: string | null = null;
    let redisAvailable = true;

    try {
      const cached = await this.store.read(this.key, cacheKeys.dashboardGeneration);
      generation = cached.generation;
      if (cached.value !== null) {
        const entry = this.parse<T>(cached.value);
        if (entry) {
          const durationMs = elapsed(started);
          this.metrics.recordRequest('HIT', durationMs, `HIT em ${this.key}`);
          this.logger.info(
            { cache: 'HIT', key: this.key, ttl: cached.ttl, durationMs },
            'cache HIT',
          );
          return {
            data: entry.data,
            cache: {
              strategy: 'HIT',
              key: this.key,
              ttlSeconds: this.ttlSeconds,
              ttlRemaining: cached.ttl >= 0 ? cached.ttl : null,
              cachedAt: entry.cachedAt,
              durationMs,
            },
          };
        }
      }
    } catch (error) {
      redisAvailable = false;
      this.logger.warn(
        { cache: 'BYPASS', err: (error as Error).message },
        'Falha ao ler o Redis; consultando o Supabase diretamente',
      );
    }

    // MISS ou BYPASS: a fonte da verdade é o Supabase.
    const data = await compute();
    const cachedAt = new Date().toISOString();

    if (!redisAvailable) {
      const durationMs = elapsed(started);
      this.metrics.recordRequest(
        'BYPASS',
        durationMs,
        'Redis indisponível: dados lidos do Supabase',
      );
      return {
        data,
        cache: {
          strategy: 'BYPASS',
          key: this.key,
          ttlSeconds: this.ttlSeconds,
          ttlRemaining: null,
          cachedAt: null,
          durationMs,
          notice: 'Cache indisponível no momento; dados consultados diretamente no banco.',
        },
      };
    }

    let ttlRemaining: number | null = null;
    try {
      const stored = await this.store.writeIfGeneration(
        this.key,
        JSON.stringify({ cachedAt, data } satisfies CachedEntry<T>),
        this.ttlSeconds,
        cacheKeys.dashboardGeneration,
        generation,
      );
      if (stored) ttlRemaining = this.ttlSeconds;
      else this.metrics.recordStaleWriteSkipped();
    } catch (error) {
      this.logger.warn({ err: (error as Error).message }, 'Falha ao gravar no Redis');
    }

    const durationMs = elapsed(started);
    this.metrics.recordRequest('MISS', durationMs, `MISS em ${this.key}: calculado no Supabase`);
    this.logger.info(
      {
        cache: 'MISS',
        key: this.key,
        stored: ttlRemaining !== null,
        ttl: this.ttlSeconds,
        durationMs,
      },
      'cache MISS',
    );
    return {
      data,
      cache: {
        strategy: 'MISS',
        key: this.key,
        ttlSeconds: this.ttlSeconds,
        ttlRemaining,
        cachedAt: ttlRemaining !== null ? cachedAt : null,
        durationMs,
      },
    };
  }

  /** Remove os indicadores do cache. Nunca lança: a escrita no banco já ocorreu. */
  async invalidate(reason: string): Promise<InvalidationRecord> {
    const at = new Date().toISOString();
    try {
      const keysDeleted = await this.store.invalidate(dashboardKeys, cacheKeys.dashboardGeneration);
      this.pendingInvalidation = false;
      const record: InvalidationRecord = { at, reason, ok: true, keysDeleted };
      this.metrics.recordInvalidation(record);
      this.logger.info({ cache: 'INVALIDATE', reason, keysDeleted }, 'cache invalidado');
      return record;
    } catch (error) {
      this.pendingInvalidation = true;
      const record: InvalidationRecord = {
        at,
        reason,
        ok: false,
        keysDeleted: 0,
        error: 'Redis indisponível; invalidação será refeita na reconexão',
      };
      this.metrics.recordInvalidation(record);
      this.logger.warn(
        { cache: 'INVALIDATE_FAILED', reason, err: (error as Error).message },
        'falha ao invalidar cache',
      );
      return record;
    }
  }

  hasPendingInvalidation(): boolean {
    return this.pendingInvalidation;
  }

  private parse<T>(raw: string): CachedEntry<T> | null {
    try {
      const entry = JSON.parse(raw) as CachedEntry<T>;
      return entry && typeof entry === 'object' && 'data' in entry ? entry : null;
    } catch {
      this.logger.warn({ key: this.key }, 'Valor inválido no cache; será recalculado');
      return null;
    }
  }
}
