import { apiClient } from './client';
import type { ActivityItem } from './activities';

export type CompletionStatus =
  | 'processing'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'self_reported';

export interface Completion {
  id: string;
  challenge_activity_id: string;
  family_id: string;
  completed_by_user_id: string;
  status: CompletionStatus;
  photo_url?: string | null;
  caption?: string | null;
  rejection_reason?: string | null;
  duration_minutes?: number | null;
  completed_on: string;
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
  /** Featured challenges grant +5 bonus points per verified completion */
  is_featured: boolean;
  display_mode: 'collage';
  status: 'active' | 'completed';
  is_private: boolean;
  created_at: string;
}

export interface ChallengeParticipant {
  user_id: string;
  display_name: string;
  family_id: string;
  invited_by_user_id: string;
  created_at: string;
}

export interface ChallengeWithProgress extends ChallengeSummary {
  activities: ChallengeActivitySlot[];
  group_families_count?: number | null;
  shared_group_ids?: string[];
}

export interface CreateChallengePayload {
  title: string;
  description?: string | null;
  group_id?: string | null;
  activity_ids: string[];
  is_private?: boolean;
  shared_group_ids?: string[];
}

export const challengesApi = {
  create: (payload: CreateChallengePayload) =>
    apiClient.post<ChallengeWithProgress>('/challenges', payload),

  getActive: () =>
    apiClient.get<ChallengeWithProgress[]>('/challenges/active'),

  getMy: (status?: 'active' | 'completed') =>
    apiClient.get<ChallengeSummary[]>('/challenges/me', { params: status ? { status } : undefined }),

  getById: (id: string) =>
    apiClient.get<ChallengeWithProgress>(`/challenges/${id}`),

  update: (id: string, payload: { is_private?: boolean }) =>
    apiClient.patch<ChallengeWithProgress>(`/challenges/${id}`, payload),

  delete: (id: string) =>
    apiClient.delete(`/challenges/${id}`),

  getParticipants: (id: string) =>
    apiClient.get<ChallengeParticipant[]>(`/challenges/${id}/participants`),

  inviteParticipant: (id: string, userId: string) =>
    apiClient.post<ChallengeParticipant>(`/challenges/${id}/participants`, { user_id: userId }),
};
