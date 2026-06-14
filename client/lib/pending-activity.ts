import type { ActivityItem } from '@/lib/api';

// In-memory hand-off for an activity just created via the create-activity screen.
// The collage builder consumes this on focus to fill the slot the user was editing.
let pending: ActivityItem | null = null;

export const pendingActivity = {
  set(activity: ActivityItem): void {
    pending = activity;
  },
  consume(): ActivityItem | null {
    const a = pending;
    pending = null;
    return a;
  },
};
