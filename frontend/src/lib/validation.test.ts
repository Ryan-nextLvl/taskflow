import { describe, expect, it } from 'vitest';
import { projectFormSchema, taskFormSchema, toProjectPayload, toTaskPayload } from './validation';

const validTask = {
  title: 'Escrever README',
  description: '',
  status: 'todo' as const,
  priority: 'medium' as const,
  due_date: '',
  project_id: '',
};

describe('taskFormSchema', () => {
  it('aceita o formulário mínimo', () => {
    expect(taskFormSchema.safeParse(validTask).success).toBe(true);
  });

  it('exige título e limita o tamanho', () => {
    expect(taskFormSchema.safeParse({ ...validTask, title: '   ' }).success).toBe(false);
    expect(taskFormSchema.safeParse({ ...validTask, title: 'x'.repeat(161) }).success).toBe(false);
  });

  it('rejeita data inválida', () => {
    expect(taskFormSchema.safeParse({ ...validTask, due_date: '2026-13-01' }).success).toBe(false);
  });
});

describe('toTaskPayload', () => {
  it('converte campos vazios em null para a API', () => {
    expect(toTaskPayload({ ...validTask, title: '  Título  ', description: '  ' })).toEqual({
      title: 'Título',
      description: null,
      status: 'todo',
      priority: 'medium',
      due_date: null,
      project_id: null,
    });
  });
});

describe('projectFormSchema', () => {
  it('valida cor hexadecimal e normaliza o payload', () => {
    expect(
      projectFormSchema.safeParse({ name: 'Marketing', description: '', color: 'azul' }).success,
    ).toBe(false);
    expect(toProjectPayload({ name: ' Marketing ', description: '', color: '#ABCDEF' })).toEqual({
      name: 'Marketing',
      description: null,
      color: '#abcdef',
    });
  });
});
