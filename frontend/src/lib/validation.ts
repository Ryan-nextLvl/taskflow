import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES, type ProjectPayload, type TaskPayload } from '@/types/api';

z.config(z.locales.pt());

/** Formulário de tarefa: espelha as regras do back-end (que valida de novo). */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(160, 'Máximo de 160 caracteres'),
  description: z.string().max(5000, 'Máximo de 5000 caracteres'),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  due_date: z.union([z.literal(''), z.iso.date({ error: 'Data inválida' })]),
  project_id: z.string(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export function toTaskPayload(values: TaskFormValues): TaskPayload {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    status: values.status,
    priority: values.priority,
    due_date: values.due_date || null,
    project_id: values.project_id || null,
  };
}

export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do projeto').max(80, 'Máximo de 80 caracteres'),
  description: z.string().max(500, 'Máximo de 500 caracteres'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
});

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function toProjectPayload(values: ProjectFormValues): ProjectPayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    color: values.color.toLowerCase(),
  };
}
