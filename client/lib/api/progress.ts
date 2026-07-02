import { apiClient } from './client';

export interface WeekStats {
  activities: number;
  photos: number;
}

export interface StreakStats {
  current_days: number;
  last_days: number | null;
  longest_days: number;
  frozen_today: boolean;
}

export interface AllTimeStats {
  activities: number;
  photos: number;
  challenges: number;
}

export interface FamilyProgress {
  weekly_goal: number;
  this_week: WeekStats;
  streak: StreakStats;
  all_time: AllTimeStats;
}

export interface FamilySettingsUpdate {
  weekly_goal?: number;
}

export const progressApi = {
  getProgress: (familyId: string) =>
    apiClient.get<FamilyProgress>(`/families/${familyId}/progress`),

  updateSettings: (familyId: string, payload: FamilySettingsUpdate) =>
    apiClient.patch(`/families/${familyId}/settings`, payload),
};
