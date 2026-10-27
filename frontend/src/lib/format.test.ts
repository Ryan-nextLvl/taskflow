import { describe, expect, it } from 'vitest';
import { daysBetween, describeDue, formatRelative } from './format';

describe('describeDue', () => {
  const today = '2026-10-26';

  it('classifica prazos em relação a hoje', () => {
    expect(describeDue('2026-10-24', false, today)).toEqual({
      state: 'overdue',
      label: 'Atrasada 2d',
    });
    expect(describeDue('2026-10-26', false, today)).toEqual({ state: 'today', label: 'Hoje' });
    expect(describeDue('2026-10-27', false, today)).toEqual({ state: 'soon', label: 'Amanhã' });
    expect(describeDue('2026-11-02', false, today)).toEqual({ state: 'soon', label: 'em 7 dias' });
    expect(describeDue('2026-11-10', false, today).state).toBe('later');
  });

  it('tarefa concluída nunca aparece como atrasada', () => {
    expect(describeDue('2026-10-01', true, today).state).toBe('done');
  });

  it('sem prazo', () => {
    expect(describeDue(null, false, today)).toEqual({ state: 'none', label: 'Sem prazo' });
  });
});

describe('daysBetween', () => {
  it('conta dias de calendário', () => {
    expect(daysBetween('2026-10-26', '2026-11-01')).toBe(6);
    expect(daysBetween('2026-10-26', '2026-10-20')).toBe(-6);
  });
});

describe('formatRelative', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');

  it('usa unidades legíveis e trunca (não arredonda para cima)', () => {
    expect(formatRelative('2026-10-26T11:59:50Z', now)).toBe('agora');
    expect(formatRelative('2026-10-26T11:30:00Z', now)).toBe('há 30 min');
    expect(formatRelative('2026-10-26T09:00:00Z', now)).toBe('há 3 h');
    expect(formatRelative('2026-10-25T06:00:00Z', now)).toBe('ontem');
    expect(formatRelative('2026-10-23T00:00:00Z', now)).toBe('há 3 dias');
  });
});
