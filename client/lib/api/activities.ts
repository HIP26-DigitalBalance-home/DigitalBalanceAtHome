import { apiClient } from './client';

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  estimated_duration_minutes: number;
  age_min: number;
  age_max: number;
  cost_indicator: 'free' | 'low_cost' | 'paid';
  season_relevance: string[] | null;
  weather_suitability: string[] | null;
  is_partner_content: boolean;
}

export interface ActivityFilters {
  age?: number;
  season?: string;
  weather?: string;
  cost?: string;
}

export interface CreateActivityPayload {
  title: string;
  description?: string | null;
  estimated_duration_minutes?: number | null;
  cost_indicator?: 'free' | 'low_cost';
}

export const activitiesApi = {
  list: (filters: ActivityFilters = {}) => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null)
    );
    return apiClient.get<ActivityItem[]>('/activities', { params });
  },

  create: (payload: CreateActivityPayload) => apiClient.post<ActivityItem>('/activities', payload),

  suggestion: (childId?: string | null, city?: string | null) => {
    const params: Record<string, string> = {};
    if (childId) params.child_id = childId;
    if (city) params.city = city;
    return apiClient.get<ActivityItem>('/activities/suggestions', { params });
  },
};
