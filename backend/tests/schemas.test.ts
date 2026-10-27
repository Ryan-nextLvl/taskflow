import { describe, expect, it } from 'vitest';
import { createProjectSchema } from '../src/schemas/project.schemas.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from '../src/schemas/task.schemas.js';

describe('createTaskSchema', () => {
  it('aplica padrões e normaliza textos', () => {
    const parsed = createTaskSchema.parse({ title: '  Escrever relatório  ', description: '   ' });
    expect(parsed).toEqual({
      title: 'Escrever relatório',
      description: null,
      status: 'todo',
      priority: 'medium',
    });
  });

  it('rejeita título vazio, status e prioridade inválidos', () => {
    const result = createTaskSchema.safeParse({ title: '   ', status: 'feito', priority: 'max' });
    expect(result.success).toBe(false);
    const fields = result.error!.issues.map((issue) => issue.path.join('.'));
    expect(fields).toEqual(expect.arrayContaining(['title', 'status', 'priority']));
  });

  it('rejeita campos não permitidos (ex.: completed_at definido pelo cliente)', () => {
    const result = createTaskSchema.safeParse({ title: 'x', completed_at: '2026-01-01' });
    expect(result.success).toBe(false);
  });

  it('valida o prazo no formato AAAA-MM-DD e datas reais', () => {
    expect(createTaskSchema.safeParse({ title: 'x', due_date: '2026-02-30' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'x', due_date: '26/10/2026' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'x', due_date: '2026-10-26' }).success).toBe(true);
    expect(createTaskSchema.safeParse({ title: 'x', due_date: null }).success).toBe(true);
  });

  it('limita o tamanho do título', () => {
    expect(createTaskSchema.safeParse({ title: 'a'.repeat(161) }).success).toBe(false);
  });

  it('exige UUID válido para o projeto', () => {
    expect(createTaskSchema.safeParse({ title: 'x', project_id: '123' }).success).toBe(false);
  });
});

describe('updateTaskSchema', () => {
  it('exige ao menos um campo', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it('aceita atualização parcial de status', () => {
    expect(updateTaskSchema.parse({ status: 'done' })).toEqual({ status: 'done' });
  });
});

describe('listTasksQuerySchema', () => {
  it('converte paginação e ignora filtros vazios', () => {
    const parsed = listTasksQuerySchema.parse({
      page: '2',
      pageSize: '10',
      status: '',
      search: '',
    });
    expect(parsed).toMatchObject({ page: 2, pageSize: 10, sort: 'created_at', order: 'desc' });
    expect(parsed.status).toBeUndefined();
    expect(parsed.search).toBeUndefined();
  });

  it('limita o tamanho da página e converte o filtro de atrasadas', () => {
    expect(listTasksQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(listTasksQuerySchema.parse({ overdue: 'true' }).overdue).toBe(true);
  });
});

describe('createProjectSchema', () => {
  it('normaliza a cor e valida o formato', () => {
    expect(createProjectSchema.parse({ name: 'App', color: '#AABBCC' }).color).toBe('#aabbcc');
    expect(createProjectSchema.safeParse({ name: 'App', color: 'red' }).success).toBe(false);
  });
});
