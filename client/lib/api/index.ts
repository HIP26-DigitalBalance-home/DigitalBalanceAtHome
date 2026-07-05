export { apiClient, registerAuthHandlers } from './client';
export { onboardingApi } from './onboarding';
export type { ConsentPayload, FamilyPayload, ChildPayload } from './onboarding';
export { groupsApi } from './groups';
export type { FeedEntry, GroupSummary } from './groups';
export { activitiesApi } from './activities';
export type { ActivityItem, ActivityFilters, CreateActivityPayload } from './activities';
export { collagePresetsApi } from './collage-presets';
export type { CollagePreset } from './collage-presets';
export { challengesApi } from './challenges';
export type { ChallengeSummary, ChallengeWithProgress, ChallengeActivitySlot, ChallengeParticipant, Completion, CreateChallengePayload } from './challenges';
export { friendsApi } from './friends';
export type { Friend } from './friends';
export { notificationsApi } from './notifications';
export type { NotificationItem } from './notifications';
export { completionsApi, photosApi } from './completions';
export type { PhotoUrlResponse } from './completions';
export { rewardsApi } from './rewards';
export type {
  PendingVerificationItem,
  VerificationQueue,
  VerificationActionResponse,
  RewardLevelProgress,
  RewardLevelState,
  RewardsBalance,
  RedemptionResult,
} from './rewards';
export { devApi } from './dev';
export { usersApi } from './users';
export type { CompletionHistoryItem } from './completions';
export { progressApi } from './progress';
export type { FamilyProgress, WeekStats, StreakStats, AllTimeStats, FamilySettingsUpdate } from './progress';
export { journalApi } from './journal';
export type { JournalEntry } from './journal';
