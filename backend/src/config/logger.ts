import { pino, type Logger } from 'pino';

export type { Logger };

/** Logs estruturados (JSON). Cabeçalhos sensíveis são mascarados. */
export function createLogger(options: { level: string; pretty: boolean }): Logger {
  return pino({
    level: options.level,
    base: { service: 'taskflow-api' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-diagnostics-token"]',
        'req.headers.apikey',
      ],
      censor: '[oculto]',
    },
    ...(options.pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss' },
          },
        }
      : {}),
  });
}
