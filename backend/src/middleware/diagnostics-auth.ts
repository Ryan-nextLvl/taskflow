import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Protege as rotas de diagnóstico com um token enviado no cabeçalho
 * "x-diagnostics-token". Sem DIAGNOSTICS_TOKEN configurado, as rotas ficam
 * desabilitadas. A comparação é feita em tempo constante.
 */
export function requireDiagnosticsToken(expected: string | undefined): RequestHandler {
  const expectedDigest = expected ? digest(expected) : null;

  return (req, _res, next) => {
    if (!expectedDigest) {
      next(
        new AppError(
          503,
          'DIAGNOSTICS_DISABLED',
          'Diagnóstico desabilitado: defina DIAGNOSTICS_TOKEN no back-end',
        ),
      );
      return;
    }
    const provided = req.header('x-diagnostics-token');
    if (!provided || !timingSafeEqual(digest(provided), expectedDigest)) {
      next(new AppError(401, 'UNAUTHORIZED', 'Token de diagnóstico ausente ou inválido'));
      return;
    }
    next();
  };
}
