import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { TaskDialogContext, type TaskDialogOptions } from './task-dialog-context';
import { TaskFormDialog } from './task-form-dialog';

/** Disponibiliza o diálogo de tarefa para qualquer tela (atalho de teclado: N). */
export function TaskDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TaskDialogOptions>({});

  const openDialog = useCallback((next: TaskDialogOptions = {}) => {
    setOptions(next);
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.closest(
        'input, textarea, select, [contenteditable="true"], [role="dialog"]',
      );
      if (
        event.key.toLowerCase() === 'n' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !typing
      ) {
        event.preventDefault();
        openDialog();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openDialog]);

  return (
    <TaskDialogContext.Provider value={openDialog}>
      {children}
      <TaskFormDialog open={open} options={options} onOpenChange={setOpen} />
    </TaskDialogContext.Provider>
  );
}
