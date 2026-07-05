import { apiClient } from './client';

export type TimeSpentPeriod = 'weekly' | 'monthly';

export interface DailyTimeTotal {
  date: string;
  activity_minutes: number;
  manual_minutes: number;
  total_minutes: number;
}

export interface WeeklyTimeTotal {
  start_date: string;
  end_date: string;
  total_minutes: number;
}

export interface TimeSpentInsight {
  period: TimeSpentPeriod;
  range_start: string;
  range_end: string;
  /** min(range_end, today) — last non-future date in range; use to exclude unelapsed days from averages */
  elapsed_end: string;
  daily_totals: DailyTimeTotal[];
  weekly_totals: WeeklyTimeTotal[];
  average_weekly_minutes: number | null;
}

export interface ManualTimeEntry {
  id: string;
  entry_date: string;
  minutes: number;
  created_at: string;
  updated_at: string;
}

export const timeSpentApi = {
  getInsight: (period: TimeSpentPeriod, anchorDate: string) =>
    apiClient.get<TimeSpentInsight>('/time-spent', { params: { period, anchor_date: anchorDate } }),

  upsertManualTime: (entryDate: string, minutes: number) =>
    apiClient.put<ManualTimeEntry>('/time-spent/manual', { entry_date: entryDate, minutes }),
};
