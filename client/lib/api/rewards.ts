import { apiClient } from './client';
import type { CompletionStatus } from './challenges';

export interface PendingVerificationItem {
  completion_id: string;
  /** Family display name only — never child names */
  family_name: string;
  activity_title: string;
  photo_url: string | null;
  duration_minutes: number | null;
  submitted_at: string;
}

export interface VerificationQueue {
  items: PendingVerificationItem[];
  total: number;
}

export interface VerificationActionResponse {
  completion_id: string;
  status: CompletionStatus;
  /** Total points credited on approval (base + bonus); null on reject */
  points_awarded: number | null;
}

export type RewardLevelState = 'locked' | 'unlocked' | 'redeemed_this_quarter';

export interface RewardLevelProgress {
  id: string;
  level_number: number;
  points_threshold: number;
  title: string;
  description: string | null;
  /** Present when redemption requires choosing one option */
  choice_options: string[] | null;
  annual_redemption_cap: number | null;
  state: RewardLevelState;
  /** Only set for levels with an annual redemption cap */
  redemptions_this_year: number | null;
}

export interface RewardsBalance {
  quarter_key: string;
  /** Points awarded in the current calendar quarter (UTC) */
  balance: number;
  levels: RewardLevelProgress[];
}

export interface RedemptionResult {
  redemption_id: string;
  reward_level_id: string;
  chosen_option: string | null;
  voucher_code: string;
  redeemed_at: string;
}

export const rewardsApi = {
  getRewardsBalance: () =>
    apiClient.get<RewardsBalance>('/rewards/balance'),

  redeemLevel: (levelId: string, chosenOption?: string | null) =>
    apiClient.post<RedemptionResult>(`/rewards/levels/${levelId}/redeem`, {
      chosen_option: chosenOption ?? null,
    }),

  getVerificationQueue: (groupId: string, limit = 20, offset = 0) =>
    apiClient.get<VerificationQueue>(`/groups/${groupId}/verification-queue`, {
      params: { limit, offset },
    }),

  approvePhoto: (groupId: string, completionId: string) =>
    apiClient.post<VerificationActionResponse>(
      `/groups/${groupId}/verification-queue/${completionId}/approve`,
    ),

  rejectPhoto: (groupId: string, completionId: string, reason?: string | null) =>
    apiClient.post<VerificationActionResponse>(
      `/groups/${groupId}/verification-queue/${completionId}/reject`,
      { reason: reason?.trim() || null },
    ),
};
