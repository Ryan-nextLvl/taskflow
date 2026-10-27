/**
 * Chaves do Redis: prefixo da aplicação + versão do formato + domínio.
 * Mudar o formato do valor? Incremente CACHE_SCHEMA_VERSION e as chaves antigas
 * deixam de ser lidas (e expiram sozinhas pelo TTL).
 *
 * Sem autenticação, há um único espaço de dados. Com usuários, a chave passaria
 * a incluir o id do usuário: taskflow:v1:user:<id>:dashboard:summary
 */
export const CACHE_PREFIX = 'taskflow';
export const CACHE_SCHEMA_VERSION = 'v1';

const base = `${CACHE_PREFIX}:${CACHE_SCHEMA_VERSION}`;

export const cacheKeys = {
  dashboardSummary: `${base}:dashboard:summary`,
  /** Contador incrementado a cada invalidação (proteção contra gravação obsoleta). */
  dashboardGeneration: `${base}:dashboard:generation`,
} as const;

/** Chaves removidas quando tarefas ou projetos mudam. */
export const dashboardKeys = [cacheKeys.dashboardSummary] as const;
