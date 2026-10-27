import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PRIORITY_META, STATUS_META } from '@/lib/constants';
import { formatShortDate } from '@/lib/format';
import type { DashboardSummary } from '@/types/api';

const AXIS_TICK = { fill: 'oklch(0.7 0.016 268)', fontSize: 11 };

interface TooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  payload?: { date?: string };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.date;
  return (
    <div className="rounded-lg border border-white/10 bg-popover px-3 py-2 text-xs shadow-xl">
      {date && <div className="mb-1.5 font-medium">{formatShortDate(date)}</div>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}
          <span className="ml-auto pl-3 font-mono text-foreground tabular">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const SERIES = [
  { key: 'completed', name: 'Concluídas', color: '#3fcf8e' },
  { key: 'created', name: 'Criadas', color: '#8b6cff' },
] as const;

export function ProductivityChart({ data }: { data: DashboardSummary['productivity'] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        {SERIES.map((serie) => (
          <span key={serie.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: serie.color }} />
            {serie.name}
          </span>
        ))}
      </div>
      <div
        className="h-56 w-full"
        role="img"
        aria-label="Gráfico de tarefas criadas e concluídas nos últimos 14 dias"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              {SERIES.map((serie) => (
                <linearGradient
                  key={serie.key}
                  id={`fill-${serie.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={serie.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={serie.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
            {SERIES.map((serie) => (
              <Area
                key={serie.key}
                type="monotone"
                dataKey={serie.key}
                name={serie.name}
                stroke={serie.color}
                strokeWidth={2}
                fill={`url(#fill-${serie.key})`}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StatusDonut({ summary }: { summary: DashboardSummary }) {
  const data = summary.byStatus.map((item) => ({
    name: STATUS_META[item.status].label,
    value: item.count,
    color: STATUS_META[item.status].color,
  }));
  const total = summary.totals.total;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col 2xl:flex-row">
      <div
        className="relative size-40 shrink-0"
        role="img"
        aria-label="Distribuição das tarefas por status"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={
                total > 0 ? data : [{ name: 'Vazio', value: 1, color: 'rgba(255,255,255,0.08)' }]
              }
              dataKey="value"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={total > 0 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {(total > 0 ? data : [{ color: 'rgba(255,255,255,0.08)' }]).map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-2xl font-semibold tabular">{total}</div>
            <div className="text-[11px] text-muted-foreground">tarefas</div>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {data.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-sm whitespace-nowrap">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-medium tabular">{item.value}</span>
            <span className="w-10 text-right text-xs text-muted-foreground tabular">
              {total > 0 ? `${Math.round((item.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PriorityBars({ data }: { data: DashboardSummary['byPriority'] }) {
  const max = Math.max(1, ...data.map((item) => item.open));
  return (
    <ul className="space-y-3">
      {[...data].reverse().map((item) => {
        const meta = PRIORITY_META[item.priority];
        const Icon = meta.icon;
        return (
          <li key={item.priority}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden />
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground tabular">
                <span className="font-medium text-foreground">{item.open}</span> abertas ·{' '}
                {item.total} no total
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(item.open / max) * 100}%`, backgroundColor: meta.color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
