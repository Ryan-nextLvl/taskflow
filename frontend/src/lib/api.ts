const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`;

export interface ApiErrorDetail {
  field: string | null;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Cliente HTTP da API do TaskFlow. Erros viram ApiError com mensagem amigável. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Não foi possível conectar à API. Verifique se o back-end está em execução.',
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    // Proxy/gateway sem resposta da API (ex.: back-end reiniciando ou parado).
    if (!error && [502, 503, 504].includes(response.status)) {
      throw new ApiError(
        response.status,
        'NETWORK_ERROR',
        'A API não está respondendo. Verifique se o back-end está em execução.',
      );
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Erro inesperado (HTTP ${response.status})`,
      error?.details,
    );
  }
  return payload as T;
}

/** Mensagem legível para exibir ao usuário. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const first = error.details?.[0];
    return first && error.code === 'VALIDATION_ERROR'
      ? `${error.message}: ${first.message}`
      : error.message;
  }
  return 'Algo deu errado. Tente novamente.';
}
