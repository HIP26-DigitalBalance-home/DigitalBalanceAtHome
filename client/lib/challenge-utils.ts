import type { ChallengeActivitySlot } from '@/lib/api';
import type { LocalCompletion } from '@/components/collage-grid';

export function isSlotFilled(
  slot: ChallengeActivitySlot,
  localCompletions?: Record<string, LocalCompletion>,
): boolean {
  const local = localCompletions?.[slot.id];
  if (local?.status === 'deleted') return false;
  const status = local?.status ?? slot.completion?.status ?? null;
  return status === 'ready' || status === 'self_reported';
}

export function isChallengeComplete(
  slots: ChallengeActivitySlot[],
  localCompletions?: Record<string, LocalCompletion>,
): boolean {
  if (slots.length === 0) return false;
  return slots.every((slot) => isSlotFilled(slot, localCompletions));
}
