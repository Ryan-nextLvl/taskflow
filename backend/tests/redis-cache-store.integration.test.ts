import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RedisCacheStore } from '../src/cache/redis-cache-store.js';

/**
 * Teste de integração com um Redis REAL. Só roda se REDIS_TEST_URL estiver
 * definido — use um banco separado, ex.: redis://localhost:6379/15
 * (o teste apaga as chaves de teste que cria).
 */
const url = process.env.REDIS_TEST_URL;

describe.skipIf(!url)('RedisCacheStore (Redis real)', () => {
  const key = 'taskflow:test:dashboard:summary';
  const generationKey = 'taskflow:test:dashboard:generation';
  let client: Redis;
  let store: RedisCacheStore;

  beforeAll(async () => {
    client = new Redis(url!, { maxRetriesPerRequest: 1 });
    store = new RedisCacheStore(client);
  });

  beforeEach(async () => {
    await client.del(key, generationKey);
  });

  afterAll(async () => {
    await client.del(key, generationKey);
    await client.quit();
  });

  it('grava com TTL e lê valor, TTL e geração numa única transação', async () => {
    expect(await store.writeIfGeneration(key, '{"ok":true}', 60, generationKey, null)).toBe(true);
    const read = await store.read(key, generationKey);
    expect(read.value).toBe('{"ok":true}');
    expect(read.ttl).toBeGreaterThan(55);
    expect(read.generation).toBeNull();
  });

  it('script Lua recusa gravação quando a geração mudou', async () => {
    const { generation } = await store.read(key, generationKey);
    await store.invalidate([key], generationKey);
    expect(await store.writeIfGeneration(key, 'velho', 60, generationKey, generation)).toBe(false);
    expect(await client.get(key)).toBeNull();
  });

  it('invalidate incrementa a geração e remove a chave', async () => {
    await client.set(key, 'x', 'EX', 60);
    expect(await store.invalidate([key], generationKey)).toBe(1);
    expect(await client.get(key)).toBeNull();
    expect(await client.get(generationKey)).toBe('1');
  });

  it('ping mede a latência', async () => {
    expect(await store.ping()).toBeGreaterThanOrEqual(0);
  });
});
