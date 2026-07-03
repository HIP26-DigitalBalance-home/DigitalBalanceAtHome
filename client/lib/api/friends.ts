import { apiClient } from './client';

export interface Friend {
  user_id: string;
  display_name: string;
  shared_group_names: string[];
}

export const friendsApi = {
  list: () => apiClient.get<Friend[]>('/friends'),
};
