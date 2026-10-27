import type { CacheReadResult, CacheStore } from '../../src/cache/cache-store.js';

/**
 * Dublê do Redis para testes: mesma semântica de TTL, geração e invalidação,
 * com relógio controlável e a possibilidade de simular queda do servidor.
 */
export class InMemoryCacheStore implements CacheStore {
  private entries = new Map<string, { value: string; expiresAt: number | null }>();
  private readyListeners: Array<() => void> = [];
  private down = false;
  now = () => Date.now();

  status(): string {
    return this.down ? 'reconnecting' : 'ready';
  }

  isReady(): boolean {
    return !this.down;
  }

  /** Simula o Redis fora do ar: todo comando falha. */
  goDown(): void {
    this.down = true;
  }

  /** Simula a reconexão, disparando o evento "ready". */
  comeBack(): void {
    this.down = false;
    for (const listener of this.readyListeners) listener();
  }

  /** Escreve direto no "Redis" (ex.: valor corrompido). */
  rawSet(key: string, value: string, ttlSeconds?: number): void {
    this.entries.set(key, {
      value,
      expiresAt: ttlSeconds ? this.now() + ttlSeconds * 1000 : null,
    });
  }

  rawGet(key: string): string | null {
    return this.live(key);
  }

  async read(key: string, generationKey: string): Promise<CacheReadResult> {
    this.assertUp();
    return { value: this.live(key), ttl: this.ttlOf(key), generation: this.live(generationKey) };
  }

  async writeIfGeneration(
    key: string,
    value: string,
    ttlSeconds: number,
    generationKey: string,
    expectedGeneration: string | null,
  ): Promise<boolean> {
    this.assertUp();
    if ((this.live(generationKey) ?? '') !== (expectedGeneration ?? '')) return false;
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    return true;
  }

  async invalidate(keys: readonly string[], generationKey: string): Promise<number> {
    this.assertUp();
    const next = Number(this.live(generationKey) ?? 0) + 1;
    this.entries.set(generationKey, { value: String(next), expiresAt: null });
    let deleted = 0;
    for (const key of keys) if (this.live(key) !== null && this.entries.delete(key)) deleted += 1;
    return deleted;
  }

  async ttl(key: string): Promise<number> {
    this.assertUp();
    return this.ttlOf(key);
  }

  async ping(): Promise<number> {
    this.assertUp();
    return 0.1;
  }

  onReady(listener: () => void): void {
    this.readyListeners.push(listener);
  }

  private assertUp(): void {
    if (this.down)
      throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
  }

  private live(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  private ttlOf(key: string): number {
    if (this.live(key) === null) return -2;
    const { expiresAt } = this.entries.get(key)!;
    return expiresAt === null ? -1 : Math.ceil((expiresAt - this.now()) / 1000);
  }
}
