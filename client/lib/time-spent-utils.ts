export type TimeSpentPeriod = 'weekly' | 'monthly';

export function localDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function shiftPeriod(anchor: string, period: TimeSpentPeriod, amount: number): string {
  const date = parseLocalDate(anchor);
  if (period === 'weekly') date.setDate(date.getDate() + amount * 7);
  else date.setMonth(date.getMonth() + amount, 1);
  return localDateString(date);
}

export function isCurrentOrFuturePeriod(anchor: string, period: TimeSpentPeriod): boolean {
  const selected = parseLocalDate(anchor);
  const today = new Date();
  if (period === 'monthly') {
    return selected.getFullYear() > today.getFullYear()
      || (selected.getFullYear() === today.getFullYear() && selected.getMonth() >= today.getMonth());
  }
  const selectedMonday = new Date(selected);
  selectedMonday.setDate(selectedMonday.getDate() - ((selectedMonday.getDay() + 6) % 7));
  const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
  return selectedMonday >= currentMonday;
}

export function inclusiveDayCount(start: string, end: string): number {
  const ms = parseLocalDate(end).getTime() - parseLocalDate(start).getTime();
  // Math.round absorbs DST offsets in local-time arithmetic
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Days in [start, end] that have actually happened, per `elapsedEnd` (typically
 * the insight's elapsed_end). Returns 0 for a range that's entirely in the future —
 * dividing by that would otherwise dilute an average with unelapsed days.
 * ISO date strings compare lexicographically, so plain string comparison works here.
 */
export function elapsedDayCount(start: string, end: string, elapsedEnd: string): number {
  if (start > elapsedEnd) return 0;
  const clampedEnd = end < elapsedEnd ? end : elapsedEnd;
  return inclusiveDayCount(start, clampedEnd);
}

export function formatMinutes(minutes: number, locale: string): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const hourUnit = locale.startsWith('de') ? 'Std.' : 'h';
  return remainder ? `${hours} ${hourUnit} ${remainder} min` : `${hours} ${hourUnit}`;
}
