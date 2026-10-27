import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CacheMetrics } from '../src/cache/cache-metrics.js';
import { DashboardCache } from '../src/cache/dashboard-cache.js';
import { cacheKeys } from '../src/cache/keys.js';
import { InMemoryCacheStore } from './fakes/in-memory-cache-store.js';
import { silentLogger } from './helpers.js';

describe('DashboardCache (cache-aside)', () => {
  let store: InMemoryCacheStore;
  let cache: DashboardCache;
  let compute: ReturnType<typeof vi.fn<() => Promise<{ total: number }>>>;
  let total: number;

  beforeEach(() => {
    store = new InMemoryCacheStore();
    cache = new DashboardCache(store, new CacheMetrics(), silentLogger, 60);
    total = 1;
    compute = vi.fn(async () => ({ total }));
  });

  it('primeira consulta é MISS: calcula no banco e grava no Redis com TTL', async () => {
    const result = await cache.getOrCompute(compute);

    expect(result.cache.strategy).toBe('MISS');
    expect(result.data).toEqual({ total: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(result.cache.ttlRemaining).toBe(60);
    expect(await store.ttl(cacheKeys.dashboardSummary)).toBe(60);
    expect(JSON.parse(store.rawGet(cacheKeys.dashboardSummary)!).data).toEqual({ total: 1 });
  });

  it('segunda consulta é HIT: não consulta o banco', async () => {
    await cache.getOrCompute(compute);
    total = 999; // se consultasse o banco, viria outro valor
    const result = await cache.getOrCompute(compute);

    expect(result.cache.strategy).toBe('HIT');
    expect(result.data).toEqual({ total: 1 });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(cache.metrics.hits).toBe(1);
    expect(cache.metrics.misses).toBe(1);
  });

  it('invalidação remove a chave e a próxima consulta recalcula (MISS)', async () => {
    await cache.getOrCompute(compute);
    total = 2;

    const record = await cache.invalidate('tarefa criada');
    expect(record).toMatchObject({ ok: true, keysDeleted: 1, reason: 'tarefa criada' });
    expect(store.rawGet(cacheKeys.dashboardSummary)).toBeNull();

    const afterInvalidation = await cache.getOrCompute(compute);
    expect(afterInvalidation.cache.strategy).toBe('MISS');
    expect(afterInvalidation.data).toEqual({ total: 2 });

    const next = await cache.getOrCompute(compute);
    expect(next.cache.strategy).toBe('HIT');
    expect(next.data).toEqual({ total: 2 });
  });

  it('expira após o TTL e volta a consultar o banco', async () => {
    let now = Date.parse('2026-10-26T12:00:00Z');
    store.now = () => now;
    await cache.getOrCompute(compute);

    now += 59_000;
    expect((await cache.getOrCompute(compute)).cache.strategy).toBe('HIT');

    now += 2_000;
    expect((await cache.getOrCompute(compute)).cache.strategy).toBe('MISS');
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('Redis indisponível: BYPASS, responde direto do banco sem lançar erro', async () => {
    store.goDown();
    const result = await cache.getOrCompute(compute);

    expect(result.cache.strategy).toBe('BYPASS');
    expect(result.data).toEqual({ total: 1 });
    expect(result.cache.notice).toBeDefined();
    expect(cache.metrics.bypasses).toBe(1);
  });

  it('falha na invalidação fica pendente e é refeita quando o Redis reconecta', async () => {
    await cache.getOrCompute(compute);
    store.goDown();

    const failed = await cache.invalidate('tarefa atualizada');
    expect(failed.ok).toBe(false);
    expect(cache.hasPendingInvalidation()).toBe(true);

    store.comeBack();
    await vi.waitFor(() => expect(cache.hasPendingInvalidation()).toBe(false));
    expect(store.rawGet(cacheKeys.dashboardSummary)).toBeNull();
    expect((await cache.getOrCompute(compute)).cache.strategy).toBe('MISS');
  });

  it('não grava resultado obsoleto quando há invalidação durante o cálculo', async () => {
    const slowCompute = vi.fn(async () => {
      // Outra requisição altera uma tarefa enquanto este cálculo acontece.
      await cache.invalidate('alteração concorrente');
      return { total: 1 };
    });

    const result = await cache.getOrCompute(slowCompute);
    expect(result.cache.strategy).toBe('MISS');
    expect(result.cache.ttlRemaining).toBeNull();
    expect(store.rawGet(cacheKeys.dashboardSummary)).toBeNull();
    expect(cache.metrics.staleWritesSkipped).toBe(1);
  });

  it('valor corrompido no Redis é tratado como MISS e sobrescrito', async () => {
    store.rawSet(cacheKeys.dashboardSummary, '{json inválido', 60);
    const result = await cache.getOrCompute(compute);

    expect(result.cache.strategy).toBe('MISS');
    expect(JSON.parse(store.rawGet(cacheKeys.dashboardSummary)!).data).toEqual({ total: 1 });
  });

  it('erro do banco num MISS é propagado (sem gravar nada no cache)', async () => {
    const failing = vi.fn(async () => {
      throw new Error('banco fora');
    });
    await expect(cache.getOrCompute(failing)).rejects.toThrow('banco fora');
    expect(store.rawGet(cacheKeys.dashboardSummary)).toBeNull();
  });
});
