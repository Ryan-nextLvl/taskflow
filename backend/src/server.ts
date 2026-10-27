import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createLogger } from './config/logger.js';
import { buildContainer } from './container.js';

try {
  process.loadEnvFile();
} catch {
  // Sem arquivo .env: as variáveis podem vir do próprio ambiente.
}

const config = loadConfig();
const logger = createLogger({ level: config.logLevel, pretty: config.nodeEnv === 'development' });
const { redis, ...deps } = buildContainer(config, logger);

const app = createApp({ ...deps, logger, corsOrigins: config.corsOrigins });

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      supabase: new URL(config.supabaseUrl).host,
      cacheTtlSeconds: config.cacheTtlSeconds,
      diagnostics: config.diagnosticsToken ? 'habilitado' : 'desabilitado',
    },
    `TaskFlow API em http://localhost:${config.port}/api`,
  );
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Encerrando a API');
  server.close(() => {
    redis.quit().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
