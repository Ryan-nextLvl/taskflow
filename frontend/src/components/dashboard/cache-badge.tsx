import { Database, Zap, ZapOff } from 'lucide-react';
import { Link } from 'react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMs } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CacheMeta } from '@/types/api';

const STYLES = {
  HIT: {
    icon: Zap,
    className: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    label: 'Cache HIT',
  },
  MISS: {
    icon: Database,
    className: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    label: 'Cache MISS',
  },
  BYPASS: {
    icon: ZapOff,
    className: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    label: 'Sem cache',
  },
} as const;

const EXPLANATION = {
  HIT: 'Indicadores lidos do Redis, sem consultar o banco.',
  MISS: 'Indicadores calculados no Supabase e gravados no Redis.',
  BYPASS: 'Redis indisponível: indicadores calculados direto no Supabase.',
} as const;

/** Mostra de onde vieram os indicadores exibidos (dados reais da resposta da API). */
export function CacheBadge({ cache, fetching }: { cache: CacheMeta; fetching?: boolean }) {
  const style = STYLES[cache.strategy];
  const Icon = style.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/diagnostics"
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
            style.className,
            fetching && 'opacity-60',
          )}
          aria-label={`${style.label} em ${formatMs(cache.durationMs)}. Abrir diagnóstico`}
        >
          <Icon className="size-3.5" aria-hidden />
          {style.label}
          <span className="font-mono opacity-80 tabular">{formatMs(cache.durationMs)}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        <p>{EXPLANATION[cache.strategy]}</p>
        <p className="mt-1 font-mono text-[11px] opacity-80">{cache.key}</p>
        {cache.ttlRemaining !== null && (
          <p className="mt-0.5 text-[11px] opacity-80">
            Expira em {cache.ttlRemaining}s (TTL {cache.ttlSeconds}s)
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
