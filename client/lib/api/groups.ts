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
};
