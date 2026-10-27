import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { Logger } from '../config/logger.js';
import { AppError } from '../errors/app-error.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Rota não encontrada: ${req.method} ${req.path}` },
  });
};

/** Respostas de erro padronizadas: { error: { code, message, details? } }. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.') || null,
            message: issue.message,
          })),
        },
      });
      return;
    }

    if (error instanceof AppError) {
      if (error.status >= 500) logger.error({ err: error, path: req.path }, error.message);
      res.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    // JSON malformado ou corpo grande demais (express.json).
    const status = (error as { status?: number; type?: string }).status;
    if (status === 400 || status === 413) {
      res.status(status).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: status === 413 ? 'Corpo da requisição muito grande' : 'JSON inválido',
        },
      });
      return;
    }

    logger.error({ err: error, path: req.path }, 'Erro não tratado');
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } });
  };
}
