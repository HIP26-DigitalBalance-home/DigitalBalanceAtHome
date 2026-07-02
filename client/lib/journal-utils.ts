// Date helpers for the daily journal. All dates are the user's *local*
// calendar dates formatted as YYYY-MM-DD — the server stores them verbatim.

export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface WeekRange {
  start: string;
  end: string;
  /** The seven Date objects of the week, Monday first. */
  dates: Date[];
  /** localDateString for each of the seven days, Monday first. */
  days: string[];
}

/** Monday-based week containing today, shifted by `offset` weeks (0 = current, -1 = previous). */
export function weekRange(offset = 0): WeekRange {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return {
    start: localDateString(dates[0]),
    end: localDateString(dates[6]),
    dates,
    days: dates.map(localDateString),
  };
}
