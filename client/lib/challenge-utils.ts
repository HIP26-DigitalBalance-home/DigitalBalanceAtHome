import type { ActivityItem, ChallengeActivitySlot } from '@/lib/api';
import type { LocalCompletion } from '@/components/collage-grid';

export type EffortTier = 'casual' | 'dedicated' | 'marketplace';

/** Client mirror of the server's points.resolve_tier — keep the two in sync. */
export function resolveEffortTier(activity: ActivityItem): EffortTier {
  if (activity.cost_indicator === 'paid' || activity.is_partner_content) return 'marketplace';
  return activity.effort_tier ?? 'casual';
}

/** Client mirror of the server's points.compute_points (base + bonus as one
 *  total) — used to preview what a completion earns once verified. */
export function computePotentialPoints(
  activity: ActivityItem,
  isFeatured: boolean,
  durationMinutes?: number | null,
): number {
  const tier = resolveEffortTier(activity);
  let base = 0;
  if (tier === 'marketplace') base = 15;
  else if (tier === 'dedicated') base = 6;
  else if (durationMinutes != null && durationMinutes >= 30) base = 3;
  return base + (isFeatured ? 5 : 0);
}

export function isSlotFilled(
  slot: ChallengeActivitySlot,
  localCompletions?: Record<string, LocalCompletion>,
): boolean {
  const local = localCompletions?.[slot.id];
  if (local?.status === 'deleted') return false;
  const status = local?.status ?? slot.completion?.status ?? null;
  return status !== null && status !== 'processing';
}

export function isChallengeComplete(
  slots: ChallengeActivitySlot[],
  localCompletions?: Record<string, LocalCompletion>,
): boolean {
  if (slots.length === 0) return false;
  return slots.every((slot) => isSlotFilled(slot, localCompletions));
}
