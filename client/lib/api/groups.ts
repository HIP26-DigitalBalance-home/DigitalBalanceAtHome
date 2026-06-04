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

  getAggregatedFeed: async (groups: GroupSummary[], limit = 20): Promise<FeedEntry[]> => {
    if (groups.length === 0) return [];
    const results = await Promise.allSettled(
      groups.map((g) =>
        apiClient.get<FeedEntry[]>(`/groups/${g.id}/feed`, { params: { limit, offset: 0 } }).then((r) =>
          r.data.map((e) => ({ ...e, group_id: g.id, group_name: g.name }))
        )
      )
    );
    const entries: FeedEntry[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') entries.push(...r.value);
    }
    entries.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
    return entries;
  },
};

export interface FeedEntry {
  id: string;
  family_id: string;
  family_name: string | null;
  activity_title: string;
  photo_url: string | null;
  caption: string | null;
  completed_at: string;
  // enriched client-side when fetching aggregated feed
  group_id?: string;
  group_name?: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  is_admin: boolean;
}
