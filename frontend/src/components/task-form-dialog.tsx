import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useId } from 'react';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTask, useProjects, useUpdateTask } from '@/hooks/use-taskflow';
import { ApiError } from '@/lib/api';
import { PRIORITY_META, STATUS_META } from '@/lib/constants';
import { taskFormSchema, toTaskPayload, type TaskFormValues } from '@/lib/validation';
import { TASK_PRIORITIES, TASK_STATUSES } from '@/types/api';
import type { TaskDialogOptions } from './task-dialog-context';

const NO_PROJECT = 'none';

function initialValues({ task, defaults }: TaskDialogOptions): TaskFormValues {
  const source = task ?? defaults ?? {};
  return {
    title: source.title ?? '',
    description: source.description ?? '',
    status: source.status ?? 'todo',
    priority: source.priority ?? 'medium',
    due_date: source.due_date ?? '',
    project_id: source.project_id ?? '',
  };
}

export function TaskFormDialog({
  open,
  options,
  onOpenChange,
}: {
  open: boolean;
  options: TaskDialogOptions;
  onOpenChange: (open: boolean) => void;
}) {
  const formId = useId();
  const editing = Boolean(options.task);
  const projects = useProjects();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const pending = createTask.isPending || updateTask.isPending;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: initialValues(options),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) form.reset(initialValues(options));
  }, [open, options, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = toTaskPayload(values);
    try {
      if (options.task) await updateTask.mutateAsync({ id: options.task.id, payload });
      else await createTask.mutateAsync(payload);
      onOpenChange(false);
    } catch (error) {
      // Erros de validação do servidor aparecem no campo correspondente.
      if (error instanceof ApiError && error.details) {
        for (const detail of error.details) {
          if (detail.field && detail.field in values) {
            form.setError(detail.field as FieldPath<TaskFormValues>, { message: detail.message });
          }
        }
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'As alterações ficam registradas no histórico da tarefa.'
              : 'Preencha os dados. Apenas o título é obrigatório.'}
          </DialogDescription>
        </DialogHeader>

        <form id={formId} onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-title`}>Título</Label>
            <Input
              id={`${formId}-title`}
              placeholder="Ex.: Revisar proposta do cliente"
              autoComplete="off"
              autoFocus
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? `${formId}-title-error` : undefined}
              {...form.register('title')}
            />
            <FieldError id={`${formId}-title-error`} message={errors.title?.message} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${formId}-description`}>Descrição</Label>
            <Textarea
              id={`${formId}-description`}
              placeholder="Detalhes, critérios de aceite, links…"
              rows={4}
              aria-invalid={Boolean(errors.description)}
              {...form.register('description')}
            />
            <FieldError message={errors.description?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-status`}>Status</Label>
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`${formId}-status`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_META[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-priority`}>Prioridade</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`${formId}-priority`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {PRIORITY_META[priority].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-due`}>Prazo</Label>
              <Input
                id={`${formId}-due`}
                type="date"
                className="[color-scheme:dark]"
                aria-invalid={Boolean(errors.due_date)}
                {...form.register('due_date')}
              />
              <FieldError message={errors.due_date?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${formId}-project`}>Projeto</Label>
              <Controller
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <Select
                    value={field.value || NO_PROJECT}
                    onValueChange={(value) => field.onChange(value === NO_PROJECT ? '' : value)}
                  >
                    <SelectTrigger id={`${formId}-project`} className="w-full">
                      <SelectValue placeholder={projects.isLoading ? 'Carregando…' : undefined} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>Sem projeto</SelectItem>
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
                )}
              />
              <FieldError message={errors.project_id?.message} />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" />}
            {editing ? 'Salvar alterações' : 'Criar tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-red-400">
      {message}
    </p>
  );
}
