import {
  ArrowLeft,
  CalendarClock,
  CircleCheck,
  CirclePlus,
  FolderInput,
  History,
  Pencil,
  RotateCcw,
  Signal,
  SquarePen,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorState } from '@/components/states';
import { StatusMenu, TaskActionsMenu } from '@/components/task-actions';
import { useTaskDialog } from '@/components/task-dialog-context';
import { DueLabel, PriorityBadge, ProjectTag } from '@/components/task-meta';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTask, useTaskEvents } from '@/hooks/use-taskflow';
import { ApiError } from '@/lib/api';
import { formatDateTime, formatFullDate, formatRelative } from '@/lib/format';
import type { TaskEventType } from '@/types/api';

const EVENT_ICONS: Record<TaskEventType, { icon: LucideIcon; color: string }> = {
  created: { icon: CirclePlus, color: '#8b6cff' },
  updated: { icon: SquarePen, color: '#a1a9b8' },
  status_changed: { icon: Workflow, color: '#5ab8f0' },
  priority_changed: { icon: Signal, color: '#f2b443' },
  due_date_changed: { icon: CalendarClock, color: '#a1a9b8' },
  project_changed: { icon: FolderInput, color: '#a1a9b8' },
  completed: { icon: CircleCheck, color: '#3fcf8e' },
  reopened: { icon: RotateCcw, color: '#f2b443' },
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function TaskHistory({ taskId }: { taskId: string }) {
  const { data, isLoading, isError, error, refetch } = useTaskEvents(taskId);
  if (isLoading)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} className="py-8" />;
  if (!data?.length)
    return <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>;

  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-white/[0.08]">
      {data.map((event) => {
        const { icon: Icon, color } = EVENT_ICONS[event.event_type];
        return (
          <li key={event.id} className="relative flex gap-3">
            <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-card">
              <Icon className="size-3.5" style={{ color }} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm">{event.description}</p>
              <time
                dateTime={event.created_at}
                className="text-xs text-muted-foreground"
                title={formatDateTime(event.created_at)}
              >
                {formatRelative(event.created_at)} · {formatDateTime(event.created_at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TaskDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const openTaskDialog = useTaskDialog();
  const { data: task, isLoading, isError, error, refetch } = useTask(id);

  const back = (
    <Button variant="ghost" size="sm" className="-ml-2 mb-4" asChild>
      <Link to="/tasks">
        <ArrowLeft /> Tarefas
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <>
        {back}
        <Skeleton className="mb-3 h-8 w-2/3" />
        <Skeleton className="h-64 rounded-xl" />
      </>
    );
  }

  if (isError || !task) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <>
        {back}
        {notFound ? (
          <div className="rounded-xl border border-white/[0.07] bg-card px-6 py-14 text-center">
            <h1 className="text-base font-semibold">Tarefa não encontrada</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ela pode ter sido excluída.</p>
            <Button className="mt-5" variant="outline" asChild>
              <Link to="/tasks">Voltar para tarefas</Link>
            </Button>
          </div>
        ) : (
          <ErrorState error={error} onRetry={() => refetch()} />
        )}
      </>
    );
  }

  const done = task.status === 'done';

  return (
    <>
      {back}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <StatusMenu task={task} />
            <PriorityBadge priority={task.priority} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
            {task.title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={() => openTaskDialog({ task })}>
            <Pencil /> Editar
          </Button>
          <TaskActionsMenu
            task={task}
            showOpen={false}
            onDeleted={() => navigate('/tasks', { replace: true })}
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-white/[0.07] bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold">Descrição</h2>
            {task.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {task.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sem descrição.{' '}
                <button
                  className="text-primary hover:underline"
                  onClick={() => openTaskDialog({ task })}
                >
                  Adicionar
                </button>
              </p>
            )}
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <History className="size-4 text-muted-foreground" aria-hidden /> Histórico
            </h2>
            <TaskHistory taskId={task.id} />
          </section>
        </div>

        <aside className="h-fit rounded-xl border border-white/[0.07] bg-card px-5 py-2">
          <dl className="divide-y divide-white/[0.05]">
            <Field label="Projeto">
              <ProjectTag project={task.project} className="text-sm text-foreground" />
            </Field>
            <Field label="Prazo">
              {task.due_date ? (
                <span className="flex flex-col items-end gap-0.5">
                  <span className="tabular">{formatFullDate(task.due_date)}</span>
                  <DueLabel dueDate={task.due_date} isDone={done} />
                </span>
              ) : (
                <span className="text-muted-foreground">Sem prazo</span>
              )}
            </Field>
            <Field label="Criada">{formatDateTime(task.created_at)}</Field>
            <Field label="Atualizada">{formatRelative(task.updated_at)}</Field>
            <Field label="Concluída">
              {task.completed_at ? (
                formatDateTime(task.completed_at)
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </dl>
        </aside>
      </div>
    </>
  );
}
