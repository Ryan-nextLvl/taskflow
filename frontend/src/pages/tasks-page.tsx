import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Plus,
  Search,
  SearchX,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states';
import { CompleteToggle, StatusMenu, TaskActionsMenu } from '@/components/task-actions';
import { useTaskDialog } from '@/components/task-dialog-context';
import { DueLabel, PriorityBadge, ProjectTag } from '@/components/task-meta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjects, useTasks } from '@/hooks/use-taskflow';
import { PRIORITY_META, SORT_OPTIONS, STATUS_META } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskFilters,
  type TaskPriority,
  type TaskSort,
  type TaskStatus,
} from '@/types/api';

const PAGE_SIZE = 20;
const ALL = 'all';

function useFiltersFromUrl() {
  const [params, setParams] = useSearchParams();

  const filters: TaskFilters = useMemo(
    () => ({
      search: params.get('search') ?? undefined,
      status: (params.get('status') as TaskStatus | null) ?? undefined,
      priority: (params.get('priority') as TaskPriority | null) ?? undefined,
      projectId: params.get('projectId') ?? undefined,
      overdue: params.get('overdue') === 'true' || undefined,
      sort: (params.get('sort') as TaskSort | null) ?? 'created_at',
      order: (params.get('order') as 'asc' | 'desc' | null) ?? 'desc',
      page: Number(params.get('page') ?? 1) || 1,
      pageSize: PAGE_SIZE,
    }),
    [params],
  );

  /** Atualiza filtros na URL; qualquer filtro novo volta para a página 1. */
  const update = (changes: Record<string, string | undefined>) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === '' || value === ALL) next.delete(key);
          else next.set(key, value);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  return { filters, update, clear: () => setParams({}, { replace: true }) };
}

function TaskRow({ task }: { task: Task }) {
  const done = task.status === 'done';
  return (
    <li className="group flex items-start gap-3 px-3 py-3 transition-colors hover:bg-white/[0.02] sm:items-center sm:px-4">
      <div className="pt-0.5 sm:pt-0">
        <CompleteToggle task={task} />
      </div>
      <div className="min-w-0 flex-1">
        <Link
          to={`/tasks/${task.id}`}
          className={cn(
            'line-clamp-2 text-sm font-medium outline-none hover:underline focus-visible:underline sm:line-clamp-1',
            done && 'text-muted-foreground line-through decoration-white/25',
          )}
        >
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ProjectTag project={task.project} className="max-w-44" />
          <span className="md:hidden">
            <PriorityBadge priority={task.priority} />
          </span>
          <span className="md:hidden">
            <DueLabel dueDate={task.due_date} isDone={done} />
          </span>
          <StatusMenu task={task} className="md:hidden" />
        </div>
      </div>
      <div className="hidden w-24 md:block">
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="hidden w-28 md:block">
        <DueLabel dueDate={task.due_date} isDone={done} />
      </div>
      <div className="hidden w-36 md:block">
        <StatusMenu task={task} />
      </div>
      <TaskActionsMenu task={task} />
    </li>
  );
}

export function TasksPage() {
  const openTaskDialog = useTaskDialog();
  const { filters, update, clear } = useFiltersFromUrl();
  const projects = useProjects();
  const { data, isLoading, isError, error, refetch, isFetching } = useTasks(filters);

  // Busca com atraso de 300 ms para não consultar a API a cada tecla.
  const [searchText, setSearchText] = useState(filters.search ?? '');
  // Se a URL mudar por fora (ex.: "Limpar"), o campo acompanha.
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (filters.search !== syncedSearch) {
    setSyncedSearch(filters.search);
    if ((filters.search ?? '') !== searchText.trim()) setSearchText(filters.search ?? '');
  }
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((filters.search ?? '') !== searchText.trim()) update({ search: searchText.trim() });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const hasFilters = Boolean(
    filters.search || filters.status || filters.priority || filters.projectId || filters.overdue,
  );
  const pagination = data?.pagination;
  const firstItem = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const lastItem = pagination
    ? Math.min(pagination.total, pagination.page * pagination.pageSize)
    : 0;

  return (
    <>
      <PageHeader
        title="Tarefas"
        description={
          pagination
            ? `${pagination.total} tarefa(s) ${hasFilters ? 'encontrada(s)' : 'no total'}`
            : 'Carregando…'
        }
        actions={
          <Button onClick={() => openTaskDialog()} className="hidden sm:inline-flex">
            <Plus /> Nova tarefa
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
        <div className="relative col-span-2 lg:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar por título…"
            className="h-9 pl-8"
            aria-label="Buscar tarefas por título"
            maxLength={100}
          />
        </div>

        <Select value={filters.status ?? ALL} onValueChange={(value) => update({ status: value })}>
          <SelectTrigger className="h-9 w-full lg:w-40" aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {TASK_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_META[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priority ?? ALL}
          onValueChange={(value) => update({ priority: value })}
        >
          <SelectTrigger className="h-9 w-full lg:w-48" aria-label="Filtrar por prioridade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as prioridades</SelectItem>
            {TASK_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_META[priority].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.projectId ?? ALL}
          onValueChange={(value) => update({ projectId: value })}
        >
          <SelectTrigger className="col-span-2 h-9 w-full lg:w-44" aria-label="Filtrar por projeto">
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

        <div className="col-span-2 flex gap-2">
          <Select value={filters.sort} onValueChange={(value) => update({ sort: value })}>
            <SelectTrigger className="h-9 flex-1 lg:w-44" aria-label="Ordenar por">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => update({ order: filters.order === 'asc' ? 'desc' : 'asc' })}
            aria-label={
              filters.order === 'asc' ? 'Ordem crescente. Inverter' : 'Ordem decrescente. Inverter'
            }
          >
            {filters.order === 'asc' ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
          </Button>
          <Button
            variant="outline"
            className={cn(
              'h-9',
              filters.overdue && 'border-red-400/40 bg-red-400/10 text-red-300 hover:bg-red-400/15',
            )}
            aria-pressed={Boolean(filters.overdue)}
            onClick={() => update({ overdue: filters.overdue ? undefined : 'true' })}
          >
            <TriangleAlert /> Atrasadas
          </Button>
        </div>

        {hasFilters && (
          <Button variant="ghost" className="col-span-2 h-9" onClick={clear}>
            <X /> Limpar
          </Button>
        )}
      </div>

      {isLoading && <ListSkeleton rows={6} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data &&
        data.data.length === 0 &&
        (hasFilters ? (
          <EmptyState
            icon={SearchX}
            title="Nenhuma tarefa encontrada"
            description="Nenhum resultado para os filtros aplicados. Ajuste a busca ou limpe os filtros."
            action={
              <Button variant="outline" onClick={clear}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ListTodo}
            title="Sua lista está vazia"
            description="Crie tarefas com prioridade, prazo e projeto para acompanhar o progresso."
            action={
              <Button onClick={() => openTaskDialog()}>
                <Plus /> Criar tarefa
              </Button>
            }
          />
        ))}

      {data && data.data.length > 0 && (
        <div
          className={cn(
            'overflow-hidden rounded-xl border border-white/[0.07] bg-card transition-opacity',
            isFetching && 'opacity-70',
          )}
        >
          <div className="hidden items-center gap-3 border-b border-white/[0.06] px-4 py-2.5 text-xs font-medium text-muted-foreground md:flex">
            <span className="w-5" />
            <span className="flex-1">Tarefa</span>
            <span className="w-24">Prioridade</span>
            <span className="w-28">Prazo</span>
            <span className="w-36">Status</span>
            <span className="w-7" />
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {data.data.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </div>
      )}

      {pagination && pagination.total > 0 && (
        <nav
          aria-label="Paginação"
          className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground"
        >
          <span className="tabular">
            {firstItem}–{lastItem} de {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => update({ page: String(pagination.page - 1) })}
            >
              <ChevronLeft /> Anterior
            </Button>
            <span className="tabular">
              {pagination.page}/{pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => update({ page: String(pagination.page + 1) })}
            >
              Próxima <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
