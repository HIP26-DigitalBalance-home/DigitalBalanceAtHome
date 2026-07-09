import { Platform } from 'react-native';
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
  effort_tier?: 'casual' | 'dedicated';
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

export type ResourceKind = 'external' | 'internal';

export interface ActivityResourcePhoto {
  id: string;
  status: 'processing' | 'ready';
  position: number;
  photo_url?: string | null;
}

export interface ActivityResource {
  id: string;
  kind: ResourceKind;
  position: number;
  label?: string | null;
  url?: string | null;
  note_text?: string | null;
  photos?: ActivityResourcePhoto[] | null;
}

export interface ActivityDetail extends ActivityItem {
  can_edit: boolean;
  resources: ActivityResource[];
}

export interface CreateResourcePayload {
  kind: ResourceKind;
  label?: string | null;
  url?: string | null;
  note_text?: string | null;
}

export interface UpdateResourcePayload {
  label?: string | null;
  url?: string | null;
  note_text?: string | null;
}

/** Appends an image to a FormData in a way that works on both web and native. */
async function appendImage(form: FormData, imageUri: string, mimeType: string) {
  if (Platform.OS === 'web') {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    form.append('image', blob, 'photo.jpg');
  } else {
    form.append('image', { uri: imageUri, type: mimeType, name: 'photo.jpg' } as any);
  }
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

  getDetail: (activityId: string) =>
    apiClient.get<ActivityDetail>(`/activities/${activityId}`),

  createResource: (activityId: string, payload: CreateResourcePayload) =>
    apiClient.post<ActivityResource>(`/activities/${activityId}/resources`, payload),

  createResourcePhoto: async (activityId: string, imageUri: string, mimeType: string, noteText?: string | null) => {
    const form = new FormData();
    await appendImage(form, imageUri, mimeType);
    if (noteText) form.append('note_text', noteText);
    return apiClient.post<ActivityResource>(`/activities/${activityId}/resources/photos`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  addResourcePhoto: async (activityId: string, resourceId: string, imageUri: string, mimeType: string) => {
    const form = new FormData();
    await appendImage(form, imageUri, mimeType);
    return apiClient.post<ActivityResourcePhoto>(
      `/activities/${activityId}/resources/${resourceId}/photos`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  updateResource: (activityId: string, resourceId: string, payload: UpdateResourcePayload) =>
    apiClient.patch<ActivityResource>(`/activities/${activityId}/resources/${resourceId}`, payload),

  deleteResource: (activityId: string, resourceId: string) =>
    apiClient.delete(`/activities/${activityId}/resources/${resourceId}`),

  deleteResourcePhoto: (activityId: string, resourceId: string, photoId: string) =>
    apiClient.delete(`/activities/${activityId}/resources/${resourceId}/photos/${photoId}`),
};
