import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from './config/logger.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createApiRouter, type ApiDependencies } from './routes/index.js';

export interface AppOptions extends ApiDependencies {
  logger: Logger;
  corsOrigins: string[];
  /** Requisições por minuto por IP em /api (0 desativa — usado nos testes). */
  rateLimitPerMinute?: number;
}

/** Monta a aplicação Express com dependências injetadas (facilita os testes). */
export function createApp({
  logger,
  corsOrigins,
  rateLimitPerMinute = 300,
  ...deps
}: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      exposedHeaders: ['X-Cache', 'X-Cache-Duration-Ms'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, error) =>
        error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  if (rateLimitPerMinute > 0) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60_000,
        limit: rateLimitPerMinute,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req, res) => {
          res.status(429).json({
            error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Aguarde um instante.' },
          });
        },
      }),
    );
  }

  app.use('/api', createApiRouter(deps));
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
