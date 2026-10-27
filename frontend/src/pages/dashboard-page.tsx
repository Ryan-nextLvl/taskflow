import {
  ArrowUpRight,
  CircleCheck,
  CircleDashed,
  FolderPlus,
  ListTodo,
  Plus,
  RotateCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CacheBadge } from '@/components/dashboard/cache-badge';
import { PriorityBars, ProductivityChart, StatusDonut } from '@/components/dashboard/charts';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState } from '@/components/states';
import { CompleteToggle, StatusMenu } from '@/components/task-actions';
import { useTaskDialog } from '@/components/task-dialog-context';
import { DueLabel, PriorityBadge, ProjectTag } from '@/components/task-meta';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardSummary, useTasks } from '@/hooks/use-taskflow';
import { formatLongToday, formatRelative, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardSummary } from '@/types/api';

function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-white/[0.07] bg-card p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  to,
  progress,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  to: string;
  progress?: number;
}) {
  return (
    <Link
      to={to}
      className="group relative rounded-xl border border-white/[0.07] bg-card p-4 transition-colors outline-none hover:border-white/[0.14] focus-visible:ring-2 focus-visible:ring-ring/60 sm:p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</span>
        <Icon className="size-4" style={{ color: tone }} aria-hidden />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight tabular sm:text-3xl">{value}</div>
      {progress !== undefined ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, backgroundColor: tone }}
          />
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      <ArrowUpRight
        className="absolute top-4 right-10 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:top-5"
        aria-hidden
      />
    </Link>
  );
}

function Kpis({ totals }: { totals: DashboardSummary['totals'] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <KpiCard
        label="Pendentes"
        value={totals.pending}
        hint={`${plural(totals.dueToday, 'vence', 'vencem')} hoje · ${totals.total} no total`}
        icon={ListTodo}
        tone="#a1a9b8"
        to="/tasks"
      />
      <KpiCard
        label="Em andamento"
        value={totals.inProgress}
        hint={`${totals.review} em revisão`}
        icon={CircleDashed}
        tone="#5ab8f0"
        to="/tasks?status=in_progress"
      />
      <KpiCard
        label="Concluídas"
        value={totals.done}
        hint={`${totals.completionRate.toLocaleString('pt-BR')}% de conclusão`}
        icon={CircleCheck}
        tone="#3fcf8e"
        to="/tasks?status=done"
        progress={totals.completionRate}
      />
      <KpiCard
        label="Atrasadas"
        value={totals.overdue}
        hint={totals.overdue > 0 ? 'Prazo vencido e não concluídas' : 'Nenhum prazo vencido'}
        icon={TriangleAlert}
        tone={totals.overdue > 0 ? '#f87171' : '#a1a9b8'}
        to="/tasks?overdue=true&sort=due_date&order=asc"
      />
    </div>
  );
}

function RecentTasks() {
  const { data, isLoading, isError, refetch } = useTasks({
    sort: 'created_at',
    order: 'desc',
    pageSize: 6,
  });
  if (isLoading)
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  if (isError) return <ErrorState error={null} onRetry={() => refetch()} className="py-8" />;
  if (!data?.data.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma tarefa ainda.</p>;
  return (
    <ul className="-mx-2 divide-y divide-white/[0.05]">
      {data.data.map((task) => (
        <li
          key={task.id}
          className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.02]"
        >
          <CompleteToggle task={task} />
          <div className="min-w-0 flex-1">
            <Link
              to={`/tasks/${task.id}`}
              className={cn(
                'block truncate text-sm font-medium outline-none hover:underline focus-visible:underline',
                task.status === 'done' && 'text-muted-foreground line-through decoration-white/25',
              )}
            >
              {task.title}
            </Link>
            <div className="mt-0.5 flex items-center gap-3">
              <ProjectTag project={task.project} className="max-w-40" />
              <span className="text-xs text-muted-foreground/70">
                {formatRelative(task.created_at)}
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <PriorityBadge priority={task.priority} compact />
            <DueLabel dueDate={task.due_date} isDone={task.status === 'done'} />
          </div>
          <StatusMenu task={task} className="hidden md:block" />
        </li>
      ))}
    </ul>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando indicadores">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export function DashboardPage() {
  const openTaskDialog = useTaskDialog();
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardSummary();
  const summary = data?.data;

  return (
    <>
      <PageHeader
        eyebrow={formatLongToday()}
        title="Visão geral"
        description="Indicadores calculados a partir das tarefas salvas no Supabase."
        actions={
          <>
            {data && <CacheBadge cache={data.meta.cache} fetching={isFetching} />}
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              aria-label="Atualizar indicadores"
              disabled={isFetching}
            >
              <RotateCw className={cn(isFetching && 'animate-spin')} />
            </Button>
            <Button onClick={() => openTaskDialog()} className="hidden sm:inline-flex">
              <Plus /> Nova tarefa
            </Button>
          </>
        }
      />

      {isLoading && <DashboardSkeleton />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {summary && summary.totals.total === 0 && (
        <EmptyState
          icon={ListTodo}
          title="Nenhuma tarefa cadastrada"
          description="Crie a primeira tarefa ou organize o trabalho em projetos. Os indicadores aparecem aqui assim que houver dados."
          action={
            <>
              <Button onClick={() => openTaskDialog()}>
                <Plus /> Criar tarefa
              </Button>
              <Button variant="outline" asChild>
                <Link to="/projects">
                  <FolderPlus /> Criar projeto
                </Link>
              </Button>
            </>
          }
        />
      )}

      {summary && summary.totals.total > 0 && (
        <div className="space-y-4">
          <Kpis totals={summary.totals} />

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Produtividade"
              description={`Últimos 14 dias · ${summary.totals.completedLast7Days} concluídas e ${summary.totals.createdLast7Days} criadas nos últimos 7 dias`}
            >
              <ProductivityChart data={summary.productivity} />
            </Panel>
            <Panel title="Por status" description="Distribuição atual das tarefas">
              <StatusDonut summary={summary} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Tarefas recentes"
              description="Últimas criadas (consulta em tempo real, sem cache)"
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/tasks">Ver todas</Link>
                </Button>
              }
            >
              <RecentTasks />
            </Panel>
            <div className="space-y-4">
              <Panel title="Por prioridade" description="Tarefas abertas em cada nível">
                <PriorityBars data={summary.byPriority} />
              </Panel>
              <Panel title="Por projeto" description="Concluídas / total">
                <ul className="space-y-3">
                  {summary.byProject.slice(0, 6).map((project) => {
                    const pct = project.total
                      ? Math.round((project.done / project.total) * 100)
                      : 0;
                    return (
                      <li key={project.projectId ?? 'none'}>
                        <Link
                          to={`/tasks?projectId=${project.projectId ?? 'none'}`}
                          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: project.color }}
                                aria-hidden
                              />
                              <span className="truncate">{project.name}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular">
                              {project.done}/{project.total}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: project.color }}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
