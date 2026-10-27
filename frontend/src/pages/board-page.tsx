import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Plus, SquareKanban } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState } from '@/components/states';
import { StatusMenu, TaskActionsMenu } from '@/components/task-actions';
import { useTaskDialog } from '@/components/task-dialog-context';
import { DueLabel, PriorityBadge, ProjectTag } from '@/components/task-meta';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjects, useTasks, useUpdateTask } from '@/hooks/use-taskflow';
import { STATUS_META } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { TASK_STATUSES, type Task, type TaskStatus } from '@/types/api';

const BOARD_LIMIT = 200;
const ALL = 'all';

function TaskCard({ task, overlay = false }: { task: Task; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: overlay,
  });
  const done = task.status === 'done';

  return (
    <article
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      aria-roledescription="Cartão arrastável"
      aria-label={task.title}
      className={cn(
        'rounded-lg border border-white/[0.07] bg-popover p-3 text-left shadow-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60',
        'cursor-grab touch-manipulation active:cursor-grabbing',
        isDragging && 'opacity-30',
        overlay && 'rotate-[1.5deg] cursor-grabbing shadow-2xl ring-1 ring-primary/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/tasks/${task.id}`}
          className={cn(
            'line-clamp-3 text-sm leading-snug font-medium outline-none hover:underline focus-visible:underline',
            done && 'text-muted-foreground line-through decoration-white/25',
          )}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {task.title}
        </Link>
        <div className="-mt-1 -mr-1.5" onPointerDown={(event) => event.stopPropagation()}>
          <TaskActionsMenu task={task} />
        </div>
      </div>
      <ProjectTag project={task.project} className="mt-2 max-w-full" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <PriorityBadge priority={task.priority} />
          <DueLabel dueDate={task.due_date} isDone={done} />
        </div>
        <div onPointerDown={(event) => event.stopPropagation()} className="lg:hidden">
          <StatusMenu task={task} />
        </div>
      </div>
    </article>
  );
}

function Column({
  status,
  tasks,
  className,
}: {
  status: TaskStatus;
  tasks: Task[];
  className?: string;
}) {
  const openTaskDialog = useTaskDialog();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <section
      ref={setNodeRef}
      aria-label={`${meta.label}: ${tasks.length} tarefa(s)`}
      className={cn(
        'flex min-h-64 flex-col rounded-xl border border-white/[0.06] bg-surface p-2 transition-colors',
        isOver && 'border-primary/40 bg-primary/[0.05]',
        className,
      )}
    >
      <header className="flex items-center justify-between px-1.5 pt-1 pb-2.5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4" style={{ color: meta.color }} aria-hidden />
          {meta.label}
          <span className="rounded-md bg-white/[0.06] px-1.5 text-xs text-muted-foreground tabular">
            {tasks.length}
          </span>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => openTaskDialog({ defaults: { status } })}
          aria-label={`Nova tarefa em ${meta.label}`}
        >
          <Plus />
        </Button>
      </header>
      <div className="flex flex-1 flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="grid flex-1 place-items-center rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-xs text-muted-foreground">
            Arraste tarefas para cá
          </div>
        )}
      </div>
    </section>
  );
}

export function BoardPage() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get('projectId') ?? undefined;
  const [mobileColumn, setMobileColumn] = useState<TaskStatus>('todo');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const openTaskDialog = useTaskDialog();
  const projects = useProjects();
  const updateTask = useUpdateTask();
  const { data, isLoading, isError, error, refetch } = useTasks({
    projectId,
    sort: 'priority',
    order: 'desc',
    pageSize: BOARD_LIMIT,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo(() => {
    const grouped = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as Task[]])) as Record<
      TaskStatus,
      Task[]
    >;
    for (const task of data?.data ?? []) grouped[task.status].push(task);
    return grouped;
  }, [data]);

  const onDragStart = ({ active }: DragStartEvent) =>
    setActiveTask((active.data.current?.task as Task) ?? null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    const task = active.data.current?.task as Task | undefined;
    const status = over?.id as TaskStatus | undefined;
    if (!task || !status || status === task.status) return;
    updateTask.mutate({ id: task.id, payload: { status }, silent: true });
  };

  return (
    <>
      <PageHeader
        title="Quadro Kanban"
        description="Arraste os cartões entre as colunas ou altere o status direto no cartão."
        actions={
          <>
            <Select
              value={projectId ?? ALL}
              onValueChange={(value) =>
                setParams(value === ALL ? {} : { projectId: value }, { replace: true })
              }
            >
              <SelectTrigger className="h-9 w-48" aria-label="Filtrar quadro por projeto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os projetos</SelectItem>
                <SelectItem value="none">Sem projeto</SelectItem>
                {projects.data?.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: project.color }}
                      aria-hidden
                    />
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => openTaskDialog()}>
              <Plus /> Nova tarefa
            </Button>
          </>
        }
      />

      {isLoading && (
        <div className="grid gap-3 lg:grid-cols-4">
          {TASK_STATUSES.map((s) => (
            <Skeleton key={s} className="h-80 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && data.pagination.total === 0 && (
        <EmptyState
          icon={SquareKanban}
          title={projectId ? 'Nenhuma tarefa neste projeto' : 'O quadro está vazio'}
          description="Crie tarefas para visualizá-las por status."
          action={
            <Button onClick={() => openTaskDialog()}>
              <Plus /> Criar tarefa
            </Button>
          }
        />
      )}

      {data && data.pagination.total > 0 && (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveTask(null)}
        >
          {/* Seletor de coluna no mobile/tablet */}
          <div
            role="tablist"
            aria-label="Colunas do quadro"
            className="mb-3 grid grid-cols-4 gap-1 rounded-lg border border-white/[0.06] bg-surface p-1 lg:hidden"
          >
            {TASK_STATUSES.map((status) => (
              <button
                key={status}
                role="tab"
                aria-selected={mobileColumn === status}
                onClick={() => setMobileColumn(status)}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:text-xs',
                  mobileColumn === status
                    ? 'bg-white/[0.08] text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                <span className="truncate">{STATUS_META[status].label}</span>
                <span className="tabular opacity-70">{columns[status].length}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            {TASK_STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                tasks={columns[status]}
                className={cn(mobileColumn !== status && 'hidden lg:flex')}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask && <TaskCard task={activeTask} overlay />}
          </DragOverlay>

          {data.pagination.total > BOARD_LIMIT && (
            <p className="mt-3 text-xs text-muted-foreground">
              Exibindo {BOARD_LIMIT} de {data.pagination.total} tarefas (ordenadas por prioridade).
              Use os filtros da página Tarefas para ver todas.
            </p>
          )}
        </DndContext>
      )}
    </>
  );
}
