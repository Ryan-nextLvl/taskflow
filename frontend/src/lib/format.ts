const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const fullDate = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const time = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const weekday = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "2026-10-26" → Date ao meio-dia local (evita deslocamento de fuso). */
const fromIsoDate = (isoDate: string) => new Date(`${isoDate}T12:00:00`);

/** Data local de hoje no formato YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000,
  );
}

export const formatShortDate = (isoDate: string) =>
  dayMonth.format(fromIsoDate(isoDate)).replace('.', '');
export const formatFullDate = (isoDate: string) => fullDate.format(fromIsoDate(isoDate));
export const formatDateTime = (instant: string) =>
  dateTime.format(new Date(instant)).replace('.', '');
export const formatTime = (instant: string) => time.format(new Date(instant));
export const formatLongToday = (now = new Date()) => weekday.format(now);

export type DueState = 'overdue' | 'today' | 'soon' | 'later' | 'none' | 'done';

/** Situação do prazo e um rótulo curto ("Hoje", "Atrasada 2d", "em 3 dias"). */
export function describeDue(
  dueDate: string | null,
  isDone: boolean,
  today = todayIso(),
): { state: DueState; label: string } {
  if (!dueDate) return { state: 'none', label: 'Sem prazo' };
  if (isDone) return { state: 'done', label: formatShortDate(dueDate) };
  const diff = daysBetween(today, dueDate);
  if (diff < 0) return { state: 'overdue', label: `Atrasada ${Math.abs(diff)}d` };
  if (diff === 0) return { state: 'today', label: 'Hoje' };
  if (diff === 1) return { state: 'soon', label: 'Amanhã' };
  if (diff <= 7) return { state: 'soon', label: `em ${diff} dias` };
  return { state: 'later', label: formatShortDate(dueDate) };
}

export function formatRelative(instant: string, now = Date.now()): string {
  const seconds = Math.round((now - Date.parse(instant)) / 1000);
  if (seconds < 45) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}

export const formatMs = (ms: number) => (ms < 10 ? `${ms.toFixed(2)} ms` : `${Math.round(ms)} ms`);

export const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;
