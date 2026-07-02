import type { Mood } from '@/constants/journal';

import { apiClient } from './client';

export interface JournalEntry {
  id: string;
  entry_date: string; // YYYY-MM-DD (user's local calendar date)
  mood: Mood;
  created_at: string;
}

export const journalApi = {
  getEntries: (startDate: string, endDate: string) =>
    apiClient.get<JournalEntry[]>('/journal/entries', {
      params: { start_date: startDate, end_date: endDate },
    }),

  createEntry: (entryDate: string, mood: Mood) =>
    apiClient.post<JournalEntry>('/journal/entries', { entry_date: entryDate, mood }),
};
