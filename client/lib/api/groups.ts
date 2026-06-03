import { apiClient } from './client';

export const groupsApi = {
  postGroup: (payload: { name: string; description?: string | null }) =>
    apiClient.post('/groups', payload),

  getMyGroups: () =>
    apiClient.get('/groups/me'),

  joinGroup: (token: string) =>
    apiClient.post('/groups/join', { token }),

  getGroup: (groupId: string) =>
    apiClient.get(`/groups/${groupId}`),

  postGroupInvite: (groupId: string) =>
    apiClient.post(`/groups/${groupId}/invites`),

  removeGroupMember: (groupId: string, familyId: string) =>
    apiClient.delete(`/groups/${groupId}/members/${familyId}`),

  grantGroupAdmin: (groupId: string, userId: string) =>
    apiClient.post(`/groups/${groupId}/admins`, { user_id: userId }),

  revokeGroupAdmin: (groupId: string, userId: string) =>
    apiClient.delete(`/groups/${groupId}/admins/${userId}`),

  getGroupFeed: (groupId: string, limit = 20, offset = 0) =>
    apiClient.get<FeedEntry[]>(`/groups/${groupId}/feed`, { params: { limit, offset } }),
};

export interface FeedEntry {
  id: string;
  family_id: string;
  family_name: string | null;
  activity_title: string;
  photo_url: string | null;
  caption: string | null;
  completed_at: string;
}
