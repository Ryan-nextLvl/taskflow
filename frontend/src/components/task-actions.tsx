import { Check, Ellipsis, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBadge } from '@/components/task-meta';
import { useTaskDialog } from '@/components/task-dialog-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteTask, useUpdateTask } from '@/hooks/use-taskflow';
import { STATUS_META } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { TASK_STATUSES, type Task, type TaskStatus } from '@/types/api';

/** Badge de status clicável que troca o status sem abrir formulário. */
export function StatusMenu({ task, className }: { task: Task; className?: string }) {
  const updateTask = useUpdateTask();
  const change = (status: TaskStatus) => {
    if (status === task.status) return;
    updateTask.mutate({ id: task.id, payload: { status }, silent: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          className,
        )}
        aria-label={`Status: ${STATUS_META[task.status].label}. Alterar status`}
      >
        <StatusBadge status={task.status} className="cursor-pointer hover:bg-white/[0.08]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Alterar status</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={task.status} onValueChange={(v) => change(v as TaskStatus)}>
          {TASK_STATUSES.map((status) => {
            const Icon = STATUS_META[status].icon;
            return (
              <DropdownMenuRadioItem key={status} value={status}>
                <Icon style={{ color: STATUS_META[status].color }} />
                {STATUS_META[status].label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Círculo de conclusão rápida: conclui ou reabre a tarefa. */
export function CompleteToggle({ task }: { task: Task }) {
  const updateTask = useUpdateTask();
  const done = task.status === 'done';
  return (
    <button
      type="button"
      onClick={() =>
        updateTask.mutate({
          id: task.id,
          payload: { status: done ? 'todo' : 'done' },
          silent: true,
        })
      }
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        done
          ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300'
          : 'border-white/20 text-transparent hover:border-emerald-400/60 hover:text-emerald-300/70',
      )}
      aria-label={done ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
      aria-pressed={done}
    >
      <Check className="size-3" strokeWidth={3} />
    </button>
  );
}

export function TaskActionsMenu({
  task,
  onDeleted,
  showOpen = true,
}: {
  task: Task;
  onDeleted?: () => void;
  showOpen?: boolean;
}) {
  const navigate = useNavigate();
  const openTaskDialog = useTaskDialog();
  const deleteTask = useDeleteTask();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Ações para "${task.title}"`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {showOpen && (
            <DropdownMenuItem onSelect={() => navigate(`/tasks/${task.id}`)}>
              <ExternalLink /> Abrir detalhes
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => openTaskDialog({ task })}>
            <Pencil /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Excluir tarefa?"
        description={
          <>
            <strong className="text-foreground">{task.title}</strong> e todo o seu histórico serão
            removidos permanentemente do banco de dados.
          </>
        }
        pending={deleteTask.isPending}
        onConfirm={() =>
          deleteTask.mutate(task, {
            onSuccess: () => {
              setConfirming(false);
              onDeleted?.();
            },
          })
        }
      />
    </>
  );
}
