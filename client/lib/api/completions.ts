import { apiClient } from './client';
import type { Completion } from './challenges';

export interface PhotoUrlResponse {
  url: string;
  expires_at: string;
}

export const completionsApi = {
  createSelfReported: (payload: {
    challenge_activity_id: string;
    caption?: string | null;
    shared_to_feed?: boolean;
  }) => apiClient.post<Completion>('/completions', payload),

  getById: (id: string) =>
    apiClient.get<Completion>(`/completions/${id}`),
};

export const photosApi = {
  upload: (
    challengeActivityId: string,
    imageUri: string,
    mimeType: string = 'image/jpeg',
    caption?: string | null,
    sharedToFeed?: boolean,
  ) => {
    const form = new FormData();
    form.append('challenge_activity_id', challengeActivityId);
    // On web imageUri is a blob: or data: URL; on native it's a file path
    form.append('image', { uri: imageUri, type: mimeType, name: 'photo.jpg' } as any);
    if (caption) form.append('caption', caption);
    form.append('shared_to_feed', String(sharedToFeed ?? false));
    return apiClient.post<{ completion_id: string }>('/photos', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getUrl: (completionId: string) =>
    apiClient.get<PhotoUrlResponse>(`/photos/${completionId}/url`),
};
