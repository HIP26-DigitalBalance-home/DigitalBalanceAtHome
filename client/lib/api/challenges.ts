import { apiClient } from './client';
import type { ActivityItem } from './activities';

export interface Completion {
  id: string;
  challenge_activity_id: string;
  family_id: string;
  completed_by_user_id: string;
  status: 'processing' | 'ready' | 'self_reported';
  photo_url?: string | null;
  caption?: string | null;
  shared_to_feed: boolean;
  completed_at: string;
  updated_at: string;
}

export interface ChallengeActivitySlot {
  id: string;
  activity_id: string;
  activity: ActivityItem;
  grid_position: number;
  completion?: Completion | null;
  families_completed_count?: number | null;
}

export interface ChallengeSummary {
  id: string;
  title: string;
  description?: string | null;
  group_id?: string | null;
  start_date: string;
  end_date: string;
  display_mode: 'collage';
  status: 'upcoming' | 'active' | 'completed';
  created_at: string;
}

export interface ChallengeWithProgress extends ChallengeSummary {
  activities: ChallengeActivitySlot[];
  group_families_count?: number | null;
}

export interface CreateChallengePayload {
  title: string;
  description?: string | null;
  group_id?: string | null;
  activity_ids: string[];
  start_date: string;
  end_date: string;
}

export const challengesApi = {
  create: (payload: CreateChallengePayload) =>
    apiClient.post<ChallengeWithProgress>('/challenges', payload),

  getActive: () =>
    apiClient.get<ChallengeWithProgress[]>('/challenges/active'),

  getMy: (status?: 'upcoming' | 'active' | 'completed') =>
    apiClient.get<ChallengeSummary[]>('/challenges/me', { params: status ? { status } : undefined }),

  getById: (id: string) =>
    apiClient.get<ChallengeWithProgress>(`/challenges/${id}`),

  delete: (id: string) =>
    apiClient.delete(`/challenges/${id}`),
};
