import type { Redis } from 'ioredis';
import type { CacheReadResult, CacheStore } from './cache-store.js';

/**
 * Grava a chave apenas se a geração não mudou. Executado atomicamente no Redis.
 * KEYS[1] = chave do valor, KEYS[2] = chave da geração
 * ARGV[1] = valor, ARGV[2] = TTL (s), ARGV[3] = geração esperada ('' se nula)
 */
const WRITE_IF_GENERATION_SCRIPT = `
local current = redis.call('GET', KEYS[2])
if not current then current = '' end
if current == ARGV[3] then
  redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]))
  return 1
end
return 0
`;

export class RedisCacheStore implements CacheStore {
  constructor(private readonly client: Redis) {}

  status(): string {
    return this.client.status;
  }

  isReady(): boolean {
    return this.client.status === 'ready';
  }

  async read(key: string, generationKey: string): Promise<CacheReadResult> {
    const results = await this.client.multi().get(key).ttl(key).get(generationKey).exec();
    if (!results) throw new Error('Transação do Redis abortada');
    for (const [error] of results) if (error) throw error;
    const [value, ttl, generation] = results.map(([, result]) => result);
    return {
      value: (value as string | null) ?? null,
      ttl: Number(ttl),
      generation: (generation as string | null) ?? null,
    };
  }

  async writeIfGeneration(
    key: string,
    value: string,
    ttlSeconds: number,
    generationKey: string,
    expectedGeneration: string | null,
  ): Promise<boolean> {
    const written = await this.client.eval(
      WRITE_IF_GENERATION_SCRIPT,
      2,
      key,
      generationKey,
      value,
      String(ttlSeconds),
      expectedGeneration ?? '',
    );
    return Number(written) === 1;
  }

  async invalidate(keys: readonly string[], generationKey: string): Promise<number> {
    const results = await this.client
      .multi()
      .incr(generationKey)
      .del(...keys)
      .exec();
    if (!results) throw new Error('Transação do Redis abortada');
    for (const [error] of results) if (error) throw error;
    return Number(results[1]?.[1] ?? 0);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async ping(): Promise<number> {
    const started = performance.now();
    await this.client.ping();
    return Math.round((performance.now() - started) * 100) / 100;
  }

  onReady(listener: () => void): void {
    this.client.on('ready', listener);
  }
}
