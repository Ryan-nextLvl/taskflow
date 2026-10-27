import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Ellipsis, FolderKanban, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState } from '@/components/states';
import { FieldError } from '@/components/task-form-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDeleteProject, useProjects, useSaveProject } from '@/hooks/use-taskflow';
import { ApiError, errorMessage } from '@/lib/api';
import { PROJECT_COLORS } from '@/lib/constants';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { projectFormSchema, toProjectPayload, type ProjectFormValues } from '@/lib/validation';
import type { ProjectWithStats } from '@/types/api';

function ProjectFormDialog({
  open,
  project,
  onOpenChange,
}: {
  open: boolean;
  project: ProjectWithStats | null;
  onOpenChange: (open: boolean) => void;
}) {
  const formId = useId();
  const saveProject = useSaveProject();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: '', description: '', color: PROJECT_COLORS[0] },
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset({
        name: project?.name ?? '',
        description: project?.description ?? '',
        color: project?.color ?? PROJECT_COLORS[0],
      });
    }
  }, [open, project, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await saveProject.mutateAsync({ id: project?.id, payload: toProjectPayload(values) });
      onOpenChange(false);
    } catch (error) {
      // Nome duplicado (409) e validações do servidor aparecem no formulário.
      const field = error instanceof ApiError && error.status === 409 ? 'name' : 'root';
      form.setError(field, { message: errorMessage(error) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !saveProject.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? 'Editar projeto' : 'Novo projeto'}</DialogTitle>
          <DialogDescription>
            Projetos agrupam tarefas e aparecem nos indicadores do dashboard.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-name`}>Nome</Label>
            <Input
              id={`${formId}-name`}
              placeholder="Ex.: Site institucional"
              autoComplete="off"
              autoFocus
              aria-invalid={Boolean(errors.name)}
              {...form.register('name')}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-description`}>Descrição</Label>
            <Textarea
              id={`${formId}-description`}
              rows={3}
              placeholder="Objetivo do projeto (opcional)"
              aria-invalid={Boolean(errors.description)}
              {...form.register('description')}
            />
            <FieldError message={errors.description?.message} />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Cor</legend>
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor do projeto">
                  {PROJECT_COLORS.map((color) => {
                    const selected = field.value.toLowerCase() === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`Cor ${color}`}
                        onClick={() => field.onChange(color)}
                        className={cn(
                          'grid size-8 place-items-center rounded-full outline-none ring-offset-2 ring-offset-popover transition-transform focus-visible:ring-2 focus-visible:ring-ring',
                          selected && 'ring-2 ring-white/70',
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {selected && <Check className="size-4 text-white" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          <FieldError message={errors.root?.message} />
        </form>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saveProject.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={saveProject.isPending}>
            {saveProject.isPending && <LoaderCircle className="animate-spin" />}
            {project ? 'Salvar' : 'Criar projeto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectWithStats;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pct = project.task_count ? Math.round((project.done_count / project.task_count) * 100) : 0;
  return (
    <article className="group relative flex flex-col rounded-xl border border-white/[0.07] bg-card p-5 transition-colors hover:border-white/[0.14]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: project.color }}
            aria-hidden
          >
            {project.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">
              <Link
                to={`/tasks?projectId=${project.id}`}
                className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:underline"
              >
                {project.name}
              </Link>
            </h2>
            <p className="text-xs text-muted-foreground">
              {plural(project.task_count, 'tarefa', 'tarefas')}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-10"
              aria-label={`Ações para ${project.name}`}
            >
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {project.description || 'Sem descrição.'}
      </p>
      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span className="tabular">
            {project.done_count}/{project.task_count} · {pct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: project.color }}
          />
        </div>
      </div>
    </article>
  );
}

export function ProjectsPage() {
  const { data, isLoading, isError, error, refetch } = useProjects();
  const deleteProject = useDeleteProject();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectWithStats | null>(null);
  const [deleting, setDeleting] = useState<ProjectWithStats | null>(null);

  const openForm = (project: ProjectWithStats | null) => {
    setEditing(project);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Projetos"
        description={data ? plural(data.length, 'projeto', 'projetos') : 'Carregando…'}
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus /> Novo projeto
          </Button>
        }
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data?.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto ainda"
          description="Agrupe tarefas relacionadas em projetos para acompanhar o progresso de cada frente de trabalho."
          action={
            <Button onClick={() => openForm(null)}>
              <Plus /> Criar projeto
            </Button>
          }
        />
      )}
      {data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => openForm(project)}
              onDelete={() => setDeleting(project)}
            />
          ))}
        </div>
      )}

      <ProjectFormDialog open={formOpen} project={editing} onOpenChange={setFormOpen} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir projeto?"
        description={
          deleting && (
            <>
              O projeto <strong className="text-foreground">{deleting.name}</strong> será removido.
              {deleting.task_count > 0
                ? ` ${plural(deleting.task_count, 'tarefa continuará', 'tarefas continuarão')} existindo, sem projeto.`
                : ' Ele não possui tarefas.'}
            </>
          )
        }
        pending={deleteProject.isPending}
        onConfirm={() =>
          deleting && deleteProject.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </>
  );
}
