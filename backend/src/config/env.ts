import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.url({ error: 'SUPABASE_URL deve ser uma URL válida' }),
  SUPABASE_SECRET_KEY: z
    .string({ error: 'Defina SUPABASE_SECRET_KEY (chave secreta ou service_role)' })
    .min(20, 'SUPABASE_SECRET_KEY parece incompleta'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(5).max(3600).default(60),
  DIAGNOSTICS_TOKEN: z
    .string()
    .min(16, 'DIAGNOSTICS_TOKEN deve ter pelo menos 16 caracteres')
    .optional(),
  APP_TIMEZONE: z.string().default('America/Sao_Paulo'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  corsOrigins: string[];
  supabaseUrl: string;
  supabaseSecretKey: string;
  redisUrl: string;
  cacheTtlSeconds: number;
  diagnosticsToken: string | undefined;
  timezone: string;
  logLevel: string;
}

/** Valida as variáveis de ambiente e falha cedo com mensagens legíveis. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse({
    ...source,
    // Aceita o nome legado da chave para facilitar a configuração.
    SUPABASE_SECRET_KEY: source.SUPABASE_SECRET_KEY || source.SUPABASE_SERVICE_ROLE_KEY,
    DIAGNOSTICS_TOKEN: source.DIAGNOSTICS_TOKEN || undefined,
  });

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuração inválida. Revise o arquivo backend/.env:\n${problems}`);
  }

  const env = parsed.data;
  assertValidTimezone(env.APP_TIMEZONE);

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    corsOrigins: env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    supabaseUrl: env.SUPABASE_URL,
    supabaseSecretKey: env.SUPABASE_SECRET_KEY,
    redisUrl: env.REDIS_URL,
    cacheTtlSeconds: env.CACHE_TTL_SECONDS,
    diagnosticsToken: env.DIAGNOSTICS_TOKEN,
    timezone: env.APP_TIMEZONE,
    logLevel: env.LOG_LEVEL,
  };
}

function assertValidTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  } catch {
    throw new Error(`APP_TIMEZONE inválido: "${timezone}"`);
  }
}
