import { createContext, useContext } from 'react';
import type { Task, TaskPayload } from '@/types/api';

export interface TaskDialogOptions {
  /** Tarefa existente (edição). Sem ela, o diálogo cria uma nova. */
  task?: Task;
  /** Valores iniciais para criação (ex.: status da coluna do Kanban). */
  defaults?: TaskPayload;
}

export const TaskDialogContext = createContext<((options?: TaskDialogOptions) => void) | null>(
  null,
);

export function useTaskDialog() {
  const open = useContext(TaskDialogContext);
  if (!open) throw new Error('useTaskDialog deve ser usado dentro de TaskDialogProvider');
  return open;
}
