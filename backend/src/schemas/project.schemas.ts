import { z } from 'zod';
import { optionalText } from './common.js';

const name = z
  .string({ error: 'Informe o nome do projeto' })
  .trim()
  .min(1, 'Informe o nome do projeto')
  .max(80, 'Nome deve ter no máximo 80 caracteres');

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve estar no formato #RRGGBB')
  .transform((value) => value.toLowerCase());

export const createProjectSchema = z.strictObject({
  name,
  description: optionalText(500, 'Descrição').optional(),
  color: color.default('#7c5cff'),
});

export const updateProjectSchema = z
  .strictObject({
    name: name.optional(),
    description: optionalText(500, 'Descrição').optional(),
    color: color.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar');

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
