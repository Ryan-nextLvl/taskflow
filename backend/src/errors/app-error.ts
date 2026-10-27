export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'UNAUTHORIZED'
  | 'DIAGNOSTICS_DISABLED'
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Converte erros do Supabase/PostgREST em erros de API com mensagens seguras.
 * Detalhes internos do banco ficam apenas no log do servidor.
 */
export function fromDatabaseError(error: PostgrestLikeError, context: string): AppError {
  const message = error.message ?? '';
  const constraint = `${message} ${error.details ?? ''}`;

  switch (error.code) {
    case '23505':
      if (constraint.includes('projects_name_unique')) {
        return new AppError(409, 'CONFLICT', 'Já existe um projeto com esse nome');
      }
      return new AppError(409, 'CONFLICT', 'Registro duplicado');
    case '23503':
      return new AppError(422, 'UNPROCESSABLE', 'O projeto informado não existe');
    case '23514':
    case '22001':
      return new AppError(422, 'UNPROCESSABLE', 'Os dados violam uma restrição do banco');
    case '22P02':
    case '22007':
    case '22008':
      return new AppError(400, 'VALIDATION_ERROR', 'Formato de dado inválido');
    default:
      break;
  }

  // Sem código SQL: falha de rede/DNS/tempo esgotado ao falar com o Supabase.
  if (!error.code || /fetch failed|ECONNREFUSED|ENOTFOUND|timeout|network/i.test(message)) {
    return new AppError(
      503,
      'DATABASE_UNAVAILABLE',
      'Não foi possível conectar ao banco de dados. Tente novamente em instantes.',
    );
  }

  return new AppError(500, 'DATABASE_ERROR', `Erro ao ${context}`);
}
