import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Database,
  Eraser,
  KeyRound,
  LoaderCircle,
  LogOut,
  Play,
  Server,
  ShieldAlert,
  Terminal,
  Timer,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/hooks/use-taskflow';
import { ApiError, errorMessage } from '@/lib/api';
import { formatMs, formatRelative, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { dashboardApi, systemApi } from '@/services/taskflow-api';
import type { CacheDiagnostics, CacheEvent, CacheStrategy } from '@/types/api';

const TOKEN_KEY = 'taskflow:diagnostics-token';

// O token fica só nesta aba (sessionStorage) e pode não estar disponível.
const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};
const writeToken = (token: string) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // armazenamento indisponível: o token vale só enquanto a página estiver aberta
  }
};

const EVENT_STYLES: Record<CacheEvent['type'], { label: string; className: string }> = {
  HIT: { label: 'HIT', className: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' },
  MISS: { label: 'MISS', className: 'bg-sky-400/10 text-sky-300 border-sky-400/20' },
  BYPASS: { label: 'BYPASS', className: 'bg-amber-400/10 text-amber-300 border-amber-400/20' },
  INVALIDATE: {
    label: 'INVALIDAÇÃO',
    className: 'bg-violet-400/10 text-violet-300 border-violet-400/20',
  },
  INVALIDATE_FAILED: { label: 'FALHA', className: 'bg-red-400/10 text-red-300 border-red-400/20' },
  STALE_WRITE_SKIPPED: {
    label: 'DESCARTE',
    className: 'bg-white/5 text-muted-foreground border-white/10',
  },
};

const STRATEGY_COLOR: Record<CacheStrategy, string> = {
  HIT: '#3fcf8e',
  MISS: '#5ab8f0',
  BYPASS: '#f2b443',
};

function TokenGate({ onSubmit, error }: { onSubmit: (token: string) => void; error?: string }) {
  const id = useId();
  const [value, setValue] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };
  return (
    <div className="mx-auto max-w-md rounded-xl border border-white/[0.07] bg-card p-6">
      <div className="mb-4 grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[0.03]">
        <KeyRound className="size-5 text-primary" aria-hidden />
      </div>
      <h2 className="text-base font-semibold">Acesso restrito</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Informe o token definido em{' '}
        <code className="font-mono text-xs text-foreground">DIAGNOSTICS_TOKEN</code> no arquivo{' '}
        <code className="font-mono text-xs text-foreground">backend/.env</code>. Ele fica salvo
        apenas nesta aba.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={id}>Token de diagnóstico</Label>
          <Input
            id={id}
            type="password"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={Boolean(error)}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-xs text-red-400">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" disabled={!value.trim()}>
          Acessar painel
        </Button>
      </form>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground sm:text-sm">
        {label}
        <Icon className="size-4" style={{ color: tone }} aria-hidden />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular sm:text-3xl">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-white/[0.07] bg-card p-5', className)}>
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** TTL em contagem regressiva entre uma atualização do painel e a próxima. */
function useCountdown(seconds: number | null, updatedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (seconds === null) return null;
  return Math.max(0, seconds - Math.floor((now - updatedAt) / 1000));
}

function KeyPanel({ data, updatedAt }: { data: CacheDiagnostics; updatedAt: number }) {
  const remaining = useCountdown(data.cache.ttlRemaining, updatedAt);
  const cached = data.cache.exists && remaining !== null && remaining > 0;
  const pct = remaining !== null ? (remaining / data.cache.ttlSeconds) * 100 : 0;
  return (
    <Panel title="Chave dos indicadores no Redis">
      <code className="block truncate rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 font-mono text-xs text-foreground/90">
        {data.cache.key}
      </code>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Estado</span>
        <span
          className={cn(
            'flex items-center gap-2 font-medium',
            cached ? 'text-emerald-300' : 'text-muted-foreground',
          )}
        >
          <span
            className={cn('size-1.5 rounded-full', cached ? 'bg-emerald-400' : 'bg-white/30')}
            aria-hidden
          />
          {cached ? 'Em cache' : 'Sem valor (próxima consulta será MISS)'}
        </span>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-muted-foreground">Expira em</span>
          <span className="font-mono tabular">{cached ? `${remaining}s` : '—'}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${cached ? pct : 0}%` }}
          />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">TTL configurado</dt>
          <dd className="font-mono tabular">{data.cache.ttlSeconds}s</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Invalidações</dt>
          <dd className="font-mono tabular">
            {data.stats.invalidations}
            {data.stats.failedInvalidations > 0 && (
              <span className="text-red-300"> · {data.stats.failedInvalidations} falha(s)</span>
            )}
          </dd>
        </div>
      </dl>
      {data.cache.pendingInvalidation && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-400/20 bg-amber-400/[0.06] p-2.5 text-xs text-amber-200">
          <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          Há uma invalidação pendente: ela será refeita assim que o Redis reconectar.
        </p>
      )}
    </Panel>
  );
}

function LatencyPanel({ events }: { events: CacheEvent[] }) {
  const requests = useMemo(
    () =>
      events
        .filter(
          (event): event is CacheEvent & { type: CacheStrategy; durationMs: number } =>
            (event.type === 'HIT' || event.type === 'MISS' || event.type === 'BYPASS') &&
            event.durationMs !== undefined,
        )
        .slice(0, 16)
        .reverse(),
    [events],
  );
  const average = (type: CacheStrategy) => {
    const values = requests.filter((r) => r.type === type).map((r) => r.durationMs);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const hit = average('HIT');
  const miss = average('MISS');
  const max = Math.max(1, ...requests.map((r) => r.durationMs));

  return (
    <Panel title="Tempo de resposta dos indicadores">
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma consulta registrada desde que a API iniciou. Use “Consultar indicadores”.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/[0.06] p-3">
              <div className="text-xs text-muted-foreground">Média HIT (Redis)</div>
              <div className="mt-1 font-mono text-lg text-emerald-300 tabular">
                {hit !== null ? formatMs(hit) : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.06] p-3">
              <div className="text-xs text-muted-foreground">Média MISS (Supabase)</div>
              <div className="mt-1 font-mono text-lg text-sky-300 tabular">
                {miss !== null ? formatMs(miss) : '—'}
              </div>
            </div>
          </div>
          {hit !== null && miss !== null && hit > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Nas consultas observadas, o HIT respondeu cerca de{' '}
              <strong className="text-foreground">{Math.max(1, Math.round(miss / hit))}×</strong>{' '}
              mais rápido que o MISS.
            </p>
          )}
          <div
            className="mt-4 flex h-28 items-end gap-1"
            role="img"
            aria-label="Duração das últimas consultas"
          >
            {requests.map((request, index) => (
              <div
                key={`${request.at}-${index}`}
                className="min-w-1 flex-1 rounded-t-sm"
                style={{
                  height: `${Math.max(4, (request.durationMs / max) * 100)}%`,
                  backgroundColor: STRATEGY_COLOR[request.type],
                  opacity: 0.85,
                }}
                title={`${request.type} · ${formatMs(request.durationMs)} · ${formatTime(request.at)}`}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
            {(['HIT', 'MISS', 'BYPASS'] as const).map((type) => (
              <span key={type} className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: STRATEGY_COLOR[type] }}
                />
                {type}
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

function EventTimeline({ events }: { events: CacheEvent[] }) {
  return (
    <Panel title="Eventos recentes do cache" className="lg:col-span-2">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
      ) : (
        <ol className="divide-y divide-white/[0.05]" aria-live="polite">
          {events.map((event, index) => {
            const style = EVENT_STYLES[event.type];
            return (
              <li key={`${event.at}-${index}`} className="flex items-center gap-3 py-2.5 text-sm">
                <span
                  className={cn(
                    'w-24 shrink-0 rounded border px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold tracking-wide',
                    style.className,
                  )}
                >
                  {style.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground/90" title={event.message}>
                  {event.message}
                </span>
                {event.durationMs !== undefined && (
                  <span className="hidden font-mono text-xs text-muted-foreground tabular sm:inline">
                    {formatMs(event.durationMs)}
                  </span>
                )}
                <time
                  className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground tabular"
                  dateTime={event.at}
                >
                  {formatTime(event.at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

export function DiagnosticsPage() {
  const client = useQueryClient();
  const [token, setToken] = useState(readToken);

  const diagnostics = useQuery({
    queryKey: queryKeys.diagnostics(token),
    queryFn: ({ signal }) => systemApi.cacheDiagnostics(token, signal),
    enabled: Boolean(token),
    refetchInterval: 2_000,
    retry: (count, error) =>
      !(error instanceof ApiError && [401, 503].includes(error.status)) && count < 2,
  });

  const unauthorized = diagnostics.error instanceof ApiError && diagnostics.error.status === 401;
  const disabled =
    diagnostics.error instanceof ApiError && diagnostics.error.code === 'DIAGNOSTICS_DISABLED';

  const signIn = (value: string) => {
    writeToken(value);
    setToken(value);
  };
  const signOut = () => {
    writeToken('');
    setToken('');
  };

  const refreshAll = () => {
    void client.invalidateQueries({ queryKey: ['diagnostics'] });
    void client.invalidateQueries({ queryKey: queryKeys.dashboard });
  };

  const query = useMutation({
    mutationFn: () => dashboardApi.summary(),
    onSuccess: ({ meta }) => {
      const label = { HIT: 'Cache HIT', MISS: 'Cache MISS', BYPASS: 'Sem cache (BYPASS)' }[
        meta.cache.strategy
      ];
      toast.success(`${label} · ${formatMs(meta.cache.durationMs)}`, {
        description:
          meta.cache.strategy === 'HIT'
            ? 'Indicadores servidos pelo Redis.'
            : meta.cache.strategy === 'MISS'
              ? `Calculado no Supabase e gravado no Redis por ${meta.cache.ttlSeconds}s.`
              : meta.cache.notice,
      });
      refreshAll();
    },
    onError: (error) =>
      toast.error('Falha ao consultar indicadores', { description: errorMessage(error) }),
  });

  const invalidate = useMutation({
    mutationFn: () => systemApi.invalidateCache(token),
    onSuccess: (record) => {
      toast.success('Cache invalidado', {
        description: `${record.keysDeleted} chave(s) removida(s) do Redis.`,
      });
      refreshAll();
    },
    onError: (error) => toast.error('Falha ao invalidar', { description: errorMessage(error) }),
  });

  const data = diagnostics.data;
  const redisOk = data?.redis.connected;

  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Diagnóstico do cache"
        description="Acompanhe o Redis em ação: cada consulta aos indicadores do dashboard passa por aqui."
        actions={
          token &&
          !unauthorized && (
            <>
              <Button onClick={() => query.mutate()} disabled={query.isPending}>
                {query.isPending ? <LoaderCircle className="animate-spin" /> : <Play />} Consultar
                indicadores
              </Button>
              <Button
                variant="outline"
                onClick={() => invalidate.mutate()}
                disabled={invalidate.isPending || !data}
              >
                {invalidate.isPending ? <LoaderCircle className="animate-spin" /> : <Eraser />}{' '}
                Invalidar cache
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                aria-label="Sair do painel de diagnóstico"
              >
                <LogOut />
              </Button>
            </>
          )
        }
      />

      {disabled && <ErrorState error={diagnostics.error} className="mx-auto max-w-lg" />}
      {!disabled && (!token || unauthorized) && (
        <TokenGate
          onSubmit={signIn}
          error={unauthorized ? 'Token inválido. Confira o valor em backend/.env.' : undefined}
        />
      )}

      {token && !unauthorized && !disabled && diagnostics.isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}
      {token && !unauthorized && !disabled && diagnostics.isError && !data && (
        <ErrorState error={diagnostics.error} onRetry={() => diagnostics.refetch()} />
      )}

      {data && !unauthorized && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <Stat
              icon={Server}
              label="Redis"
              tone={redisOk ? '#3fcf8e' : '#f87171'}
              value={
                <span className={redisOk ? 'text-emerald-300' : 'text-red-300'}>
                  {redisOk ? 'Online' : 'Offline'}
                </span>
              }
              hint={
                redisOk && data.redis.latencyMs !== null
                  ? `PING ${formatMs(data.redis.latencyMs)} · ${data.redis.status}`
                  : `estado: ${data.redis.status}`
              }
            />
            <Stat
              icon={Zap}
              label="Cache HIT"
              tone="#3fcf8e"
              value={data.stats.hits}
              hint="servidos pelo Redis"
            />
            <Stat
              icon={Database}
              label="Cache MISS"
              tone="#5ab8f0"
              value={data.stats.misses}
              hint={`calculados no Supabase${data.stats.bypasses ? ` · ${data.stats.bypasses} sem cache` : ''}`}
            />
            <Stat
              icon={Activity}
              label="Taxa de acerto"
              tone="#8b6cff"
              value={
                data.stats.hitRate !== null ? `${data.stats.hitRate.toLocaleString('pt-BR')}%` : '—'
              }
              hint={
                data.lastRequest
                  ? `última: ${data.lastRequest.strategy} ${formatRelative(data.lastRequest.at)}`
                  : 'sem consultas ainda'
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <KeyPanel data={data} updatedAt={diagnostics.dataUpdatedAt} />
            <LatencyPanel events={data.events} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <EventTimeline events={data.events} />
            <Panel title="Última invalidação">
              {data.lastInvalidation ? (
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Motivo</dt>
                    <dd>{data.lastInvalidation.reason}</dd>
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <dt className="text-xs text-muted-foreground">Resultado</dt>
                      <dd
                        className={data.lastInvalidation.ok ? 'text-emerald-300' : 'text-red-300'}
                      >
                        {data.lastInvalidation.ok ? 'Sucesso' : 'Falhou'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Chaves removidas</dt>
                      <dd className="font-mono tabular">{data.lastInvalidation.keysDeleted}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Quando</dt>
                    <dd className="font-mono text-xs tabular">
                      {formatTime(data.lastInvalidation.at)} (
                      {formatRelative(data.lastInvalidation.at)})
                    </dd>
                  </div>
                  {data.lastInvalidation.error && (
                    <p className="text-xs text-red-300">{data.lastInvalidation.error}</p>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma invalidação desde que a API iniciou. Crie ou altere uma tarefa para ver
                  uma.
                </p>
              )}
            </Panel>
          </div>

          <section className="rounded-xl border border-white/[0.07] bg-surface p-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Terminal className="size-4 text-muted-foreground" aria-hidden /> Conferir direto no
              Redis
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Em outro terminal (use <code className="font-mono text-xs">redis-cli</code> ou{' '}
              <code className="font-mono text-xs">memurai-cli</code>):
            </p>
            <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 font-mono text-xs leading-relaxed text-foreground/85">
              {`redis-cli TTL ${data.cache.key}
redis-cli GET ${data.cache.key}
redis-cli MONITOR   # mostra GET/SET/DEL em tempo real`}
            </pre>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Timer className="size-3.5" aria-hidden />
              {data.stats.scope}, desde {formatTime(data.stats.since)}.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
