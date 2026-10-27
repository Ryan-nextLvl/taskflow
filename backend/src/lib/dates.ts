/** Utilitários de data baseados em strings ISO "YYYY-MM-DD" num fuso específico. */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

/** Data local (YYYY-MM-DD) de um instante no fuso informado. */
export function toLocalDate(instant: Date | string, timezone: string): string {
  return formatterFor(timezone).format(typeof instant === 'string' ? new Date(instant) : instant);
}

/** Soma dias a uma data YYYY-MM-DD (sem efeito de horário de verão). */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
