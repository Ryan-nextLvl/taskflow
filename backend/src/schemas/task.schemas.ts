import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../types/domain.js';
import { emptyToUndefined, optionalText } from './common.js';

const title = z
  .string({ error: 'Informe o título' })
  .trim()
  .min(1, 'Informe o título')
  .max(160, 'Título deve ter no máximo 160 caracteres');

const status = z.enum(TASK_STATUSES, { error: 'Status inválido' });
const priority = z.enum(TASK_PRIORITIES, { error: 'Prioridade inválida' });

const dueDate = z.iso
  .date({ error: 'Prazo inválido (use AAAA-MM-DD)' })
  .refine(
    (value) => value >= '2000-01-01' && value <= '2100-12-31',
    'Prazo fora do intervalo permitido',
  )
  .nullable();

const projectId = z.uuid({ error: 'Projeto inválido' }).nullable();

export const createTaskSchema = z.strictObject({
  title,
  description: optionalText(5000, 'Descrição').optional(),
  status: status.default('todo'),
  priority: priority.default('medium'),
  due_date: dueDate.optional(),
  project_id: projectId.optional(),
});

export const updateTaskSchema = z
  .strictObject({
    title: title.optional(),
    description: optionalText(5000, 'Descrição').optional(),
    status: status.optional(),
    priority: priority.optional(),
    due_date: dueDate.optional(),
    project_id: projectId.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar');

export const TASK_SORT_FIELDS = ['created_at', 'due_date', 'priority', 'updated_at'] as const;

export const listTasksQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(emptyToUndefined, status.optional()),
  priority: z.preprocess(emptyToUndefined, priority.optional()),
  /** UUID do projeto ou "none" para tarefas sem projeto. */
  projectId: z.preprocess(
    emptyToUndefined,
    z.union([z.uuid({ error: 'Projeto inválido' }), z.literal('none')]).optional(),
  ),
  overdue: z.preprocess(
    emptyToUndefined,
    z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  ),
  sort: z.preprocess(emptyToUndefined, z.enum(TASK_SORT_FIELDS).default('created_at')),
  order: z.preprocess(emptyToUndefined, z.enum(['asc', 'desc']).default('desc')),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(20)),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
