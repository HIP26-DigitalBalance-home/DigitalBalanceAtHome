import { apiClient } from './client';

export interface NotificationItem {
  id: string;
  type: 'challenge_invite';
  actor_user_id?: string | null;
  actor_display_name?: string | null;
  challenge_id?: string | null;
  challenge_title?: string | null;
  created_at: string;
  read: boolean;
}

export const notificationsApi = {
  list: () => apiClient.get<NotificationItem[]>('/notifications'),
  markAllRead: () => apiClient.post('/notifications/read'),
};
