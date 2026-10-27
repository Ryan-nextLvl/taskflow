export type CacheStrategy = 'HIT' | 'MISS' | 'BYPASS';

export type CacheEventType =
  CacheStrategy | 'INVALIDATE' | 'INVALIDATE_FAILED' | 'STALE_WRITE_SKIPPED';

export interface CacheEvent {
  at: string;
  type: CacheEventType;
  message: string;
  durationMs?: number;
}

export interface InvalidationRecord {
  at: string;
  reason: string;
  ok: boolean;
  keysDeleted: number;
  error?: string;
}

const MAX_EVENTS = 25;

/**
 * Contadores de observação do cache, mantidos em memória NESTE processo da API.
 * Eles zeram quando o servidor reinicia. Os dados do dashboard em si ficam no
 * Redis; aqui fica apenas o que a aplicação observou ao usá-lo.
 */
export class CacheMetrics {
  readonly startedAt = new Date().toISOString();
  hits = 0;
  misses = 0;
  bypasses = 0;
  invalidations = 0;
  failedInvalidations = 0;
  staleWritesSkipped = 0;
  lastRequest: { strategy: CacheStrategy; durationMs: number; at: string } | null = null;
  lastInvalidation: InvalidationRecord | null = null;
  private events: CacheEvent[] = [];

  recordRequest(strategy: CacheStrategy, durationMs: number, message: string): void {
    if (strategy === 'HIT') this.hits += 1;
    else if (strategy === 'MISS') this.misses += 1;
    else this.bypasses += 1;
    const at = new Date().toISOString();
    this.lastRequest = { strategy, durationMs, at };
    this.push({ at, type: strategy, message, durationMs });
  }

  recordInvalidation(record: InvalidationRecord): void {
    if (record.ok) this.invalidations += 1;
    else this.failedInvalidations += 1;
    this.lastInvalidation = record;
    this.push({
      at: record.at,
      type: record.ok ? 'INVALIDATE' : 'INVALIDATE_FAILED',
      message: record.ok
        ? `Invalidação (${record.reason}): ${record.keysDeleted} chave(s) removida(s)`
        : `Invalidação falhou (${record.reason}): ${record.error ?? 'erro desconhecido'}`,
    });
  }

  recordStaleWriteSkipped(): void {
    this.staleWritesSkipped += 1;
    this.push({
      at: new Date().toISOString(),
      type: 'STALE_WRITE_SKIPPED',
      message: 'Resultado descartado: houve invalidação durante o cálculo',
    });
  }

  hitRate(): number | null {
    const total = this.hits + this.misses;
    return total === 0 ? null : Math.round((this.hits / total) * 1000) / 10;
  }

  recentEvents(): CacheEvent[] {
    return [...this.events].reverse();
  }

  private push(event: CacheEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }
}
