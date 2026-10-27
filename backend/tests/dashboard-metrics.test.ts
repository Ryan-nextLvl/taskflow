import { describe, expect, it } from 'vitest';
import { computeDashboardSummary } from '../src/services/dashboard-metrics.js';
import type { TaskMetricRow } from '../src/types/domain.js';
import { TEST_TIMEZONE } from './helpers.js';

// 26/10/2026 15:00 em São Paulo (UTC-3).
const NOW = new Date('2026-10-26T18:00:00Z');
const PROJECT = { id: 'p1', name: 'Website', color: '#22c55e' };

const row = (overrides: Partial<TaskMetricRow>): TaskMetricRow => ({
  status: 'todo',
  priority: 'medium',
  due_date: null,
  created_at: '2026-10-20T12:00:00Z',
  completed_at: null,
  project_id: 'p1',
  ...overrides,
});

describe('computeDashboardSummary', () => {
  it('retorna zeros e série vazia sem tarefas', () => {
    const summary = computeDashboardSummary([], [PROJECT], { now: NOW, timezone: TEST_TIMEZONE });

    expect(summary.totals.total).toBe(0);
    expect(summary.totals.completionRate).toBe(0);
    expect(summary.productivity).toHaveLength(14);
    expect(summary.productivity.at(-1)).toEqual({ date: '2026-10-26', created: 0, completed: 0 });
    expect(summary.byProject).toEqual([
      { projectId: 'p1', name: 'Website', color: '#22c55e', total: 0, done: 0 },
    ]);
  });

  it('conta status, pendentes e percentual de conclusão', () => {
    const rows = [
      row({ status: 'todo' }),
      row({ status: 'in_progress' }),
      row({ status: 'review' }),
      row({ status: 'done', completed_at: '2026-10-25T15:00:00Z' }),
    ];
    const { totals, byStatus } = computeDashboardSummary(rows, [PROJECT], {
      now: NOW,
      timezone: TEST_TIMEZONE,
    });

    expect(totals).toMatchObject({
      total: 4,
      todo: 1,
      inProgress: 1,
      review: 1,
      done: 1,
      pending: 3,
    });
    expect(totals.completionRate).toBe(25);
    expect(byStatus.map((s) => s.count)).toEqual([1, 1, 1, 1]);
  });

  it('classifica prazos: atrasada, vence hoje e próximos 7 dias (só tarefas abertas)', () => {
    const rows = [
      row({ due_date: '2026-10-25' }), // atrasada
      row({ due_date: '2026-10-26' }), // hoje
      row({ due_date: '2026-11-02' }), // em 7 dias
      row({ due_date: '2026-11-03' }), // fora da janela
      row({ due_date: '2026-10-01', status: 'done', completed_at: '2026-10-01T12:00:00Z' }),
    ];
    const { totals } = computeDashboardSummary(rows, [PROJECT], {
      now: NOW,
      timezone: TEST_TIMEZONE,
    });

    expect(totals.overdue).toBe(1);
    expect(totals.dueToday).toBe(1);
    expect(totals.dueNext7Days).toBe(1);
  });

  it('usa o fuso configurado para agrupar criação e conclusão por dia', () => {
    const rows = [
      // 02:00 UTC do dia 26 = 23:00 do dia 25 em São Paulo
      row({ created_at: '2026-10-26T02:00:00Z' }),
      row({
        created_at: '2026-10-26T12:00:00Z',
        status: 'done',
        completed_at: '2026-10-26T13:00:00Z',
      }),
    ];
    const { productivity, totals } = computeDashboardSummary(rows, [PROJECT], {
      now: NOW,
      timezone: TEST_TIMEZONE,
    });

    expect(productivity.find((d) => d.date === '2026-10-25')).toEqual({
      date: '2026-10-25',
      created: 1,
      completed: 0,
    });
    expect(productivity.find((d) => d.date === '2026-10-26')).toEqual({
      date: '2026-10-26',
      created: 1,
      completed: 1,
    });
    expect(totals.createdLast7Days).toBe(2);
    expect(totals.completedLast7Days).toBe(1);
  });

  it('agrupa por prioridade e por projeto, incluindo "Sem projeto"', () => {
    const rows = [
      row({ priority: 'urgent' }),
      row({ priority: 'urgent', status: 'done', completed_at: '2026-10-26T12:00:00Z' }),
      row({ priority: 'low', project_id: null }),
    ];
    const { byPriority, byProject } = computeDashboardSummary(rows, [PROJECT], {
      now: NOW,
      timezone: TEST_TIMEZONE,
    });

    expect(byPriority.find((p) => p.priority === 'urgent')).toEqual({
      priority: 'urgent',
      total: 2,
      open: 1,
    });
    expect(byProject).toEqual([
      { projectId: 'p1', name: 'Website', color: '#22c55e', total: 2, done: 1 },
      { projectId: null, name: 'Sem projeto', color: '#64748b', total: 1, done: 0 },
    ]);
  });
});
