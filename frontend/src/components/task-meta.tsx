import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIORITY_META, STATUS_META } from '@/lib/constants';
import { describeDue } from '@/lib/format';
import type { ProjectSummary, TaskPriority, TaskStatus } from '@/types/api';

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.04] px-2 text-xs font-medium whitespace-nowrap',
        className,
      )}
      style={{ color: meta.color }}
    >
      <Icon className="size-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({
  priority,
  compact = false,
  className,
}: {
  priority: TaskPriority;
  compact?: boolean;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap',
        className,
      )}
      style={{ color: meta.color }}
      title={`Prioridade ${meta.label.toLowerCase()}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {compact ? <span className="sr-only">{meta.label}</span> : meta.label}
    </span>
  );
}

export function ProjectTag({
  project,
  className,
}: {
  project: ProjectSummary | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground',
        className,
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: project?.color ?? '#64748b' }}
        aria-hidden
      />
      <span className="truncate">{project?.name ?? 'Sem projeto'}</span>
    </span>
  );
}

const DUE_STYLES = {
  overdue: 'text-red-400',
  today: 'text-amber-300',
  soon: 'text-foreground/80',
  later: 'text-muted-foreground',
  none: 'text-muted-foreground/60',
  done: 'text-muted-foreground/70 line-through decoration-white/20',
} as const;

export function DueLabel({
  dueDate,
  isDone,
  className,
}: {
  dueDate: string | null;
  isDone: boolean;
  className?: string;
}) {
  const due = describeDue(dueDate, isDone);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs whitespace-nowrap tabular',
        DUE_STYLES[due.state],
        className,
      )}
    >
      <CalendarDays className="size-3.5" aria-hidden />
      {due.label}
    </span>
  );
}
