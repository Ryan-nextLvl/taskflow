export interface CacheReadResult {
  value: string | null;
  /** TTL restante em segundos (-2 = chave inexistente, -1 = sem expiração). */
  ttl: number;
  generation: string | null;
}

/**
 * Contrato mínimo de cache usado pela aplicação. A implementação real é o
 * RedisCacheStore; os testes usam um dublê em memória com o mesmo comportamento.
 */
export interface CacheStore {
  /** Estado da conexão ("ready", "connecting", "reconnecting", "end"...). */
  status(): string;
  isReady(): boolean;
  /** Lê valor, TTL e geração numa única ida ao servidor. */
  read(key: string, generationKey: string): Promise<CacheReadResult>;
  /**
   * Grava com expiração somente se a geração ainda for a lida antes do cálculo.
   * Retorna false quando houve invalidação no meio (valor descartado).
   */
  writeIfGeneration(
    key: string,
    value: string,
    ttlSeconds: number,
    generationKey: string,
    expectedGeneration: string | null,
  ): Promise<boolean>;
  /** Incrementa a geração e remove as chaves. Retorna quantas chaves existiam. */
  invalidate(keys: readonly string[], generationKey: string): Promise<number>;
  ttl(key: string): Promise<number>;
  /** Latência do PING em milissegundos. */
  ping(): Promise<number>;
  onReady(listener: () => void): void;
}
