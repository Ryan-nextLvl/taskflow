import { Redis } from 'ioredis';
import type { Logger } from '../config/logger.js';

/**
 * Cliente ioredis configurado para falhar rápido: sem fila offline e com tempo
 * limite curto por comando. Se o Redis cair, as requisições seguem para o
 * Supabase em vez de ficarem presas esperando o cache.
 */
export function createRedisClient(url: string, logger: Logger): Redis {
  const client = new Redis(url, {
    connectTimeout: 2_000,
    commandTimeout: 1_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    // Reconexão contínua com espera crescente (máx. 5 s).
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
  });

  let lastErrorLog = 0;
  client.on('ready', () => logger.info({ redis: 'ready' }, 'Redis conectado'));
  client.on('error', (error: Error) => {
    // Evita inundar o log durante tentativas de reconexão.
    const now = Date.now();
    if (now - lastErrorLog > 10_000) {
      lastErrorLog = now;
      logger.warn({ redis: client.status, err: error.message }, 'Redis indisponível');
    }
  });
  client.on('end', () => logger.warn({ redis: 'end' }, 'Conexão com o Redis encerrada'));

  return client;
}
