import { Platform } from 'react-native';
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
  upload: async (
    challengeActivityId: string,
    imageUri: string,
    mimeType: string = 'image/jpeg',
    caption?: string | null,
    sharedToFeed?: boolean,
  ) => {
    const form = new FormData();
    form.append('challenge_activity_id', challengeActivityId);

    if (Platform.OS === 'web') {
      // On web, expo-image-picker returns a blob: URL.
      // The { uri, type, name } React Native shorthand is not understood by
      // the browser's native FormData — it appends "[object Object]" as text.
      // Fetch the blob URL to get a real Blob, then append it.
      const res = await fetch(imageUri);
      const blob = await res.blob();
      form.append('image', blob, 'photo.jpg');
    } else {
      // On native, React Native's FormData handles file URIs via { uri, type, name }
      form.append('image', { uri: imageUri, type: mimeType, name: 'photo.jpg' } as any);
    }

    if (caption) form.append('caption', caption);
    form.append('shared_to_feed', String(sharedToFeed ?? false));
    return apiClient.post<{ completion_id: string }>('/photos', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getUrl: (completionId: string) =>
    apiClient.get<PhotoUrlResponse>(`/photos/${completionId}/url`),
};
