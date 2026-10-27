import { z } from 'zod';

// Mensagens padrão do Zod em português.
z.config(z.locales.pt());

export const idParamSchema = z.object({
  id: z.uuid({ error: 'Identificador inválido' }),
});

/** Converte string vazia em undefined (campos de filtro opcionais na query string). */
export const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/** Texto opcional: "" ou só espaços vira null para limpar o campo no banco. */
export const optionalText = (max: number, label: string) =>
  z
    .string({ error: `${label} deve ser um texto` })
    .trim()
    .max(max, `${label} deve ter no máximo ${max} caracteres`)
    .transform((value) => (value === '' ? null : value))
    .nullable();
