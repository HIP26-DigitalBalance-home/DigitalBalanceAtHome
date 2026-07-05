import { Platform } from 'react-native';
import { apiClient } from './client';
import type { Completion, CompletionStatus } from './challenges';

export interface CompletionHistoryItem {
  id: string;
  activity_id: string;
  activity_title: string;
  challenge_title: string;
  status: CompletionStatus;
  photo_url: string | null;
  caption: string | null;
  rejection_reason?: string | null;
  duration_minutes?: number | null;
  completed_on: string;
  completed_at: string;
}

export interface PhotoUrlResponse {
  url: string;
  expires_at: string;
}

/** Appends an image to a FormData in a way that works on both web and native. */
async function appendImage(form: FormData, imageUri: string, mimeType: string) {
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
}

export const completionsApi = {
  getMyHistory: (limit = 20, offset = 0) =>
    apiClient.get<CompletionHistoryItem[]>('/completions/me', { params: { limit, offset } }),

  createSelfReported: (payload: {
    challenge_activity_id: string;
    duration_minutes: number;
    completed_on: string;
    caption?: string | null;
    shared_to_feed?: boolean;
  }) => apiClient.post<Completion>('/completions', payload),

  getById: (id: string) =>
    apiClient.get<Completion>(`/completions/${id}`),

  delete: (id: string) =>
    apiClient.delete(`/completions/${id}`),
};

export const photosApi = {
  upload: async (
    challengeActivityId: string,
    imageUri: string,
    mimeType: string = 'image/jpeg',
    caption?: string | null,
    sharedToFeed?: boolean,
    durationMinutes?: number | null,
    completedOn?: string,
  ) => {
    const form = new FormData();
    form.append('challenge_activity_id', challengeActivityId);
    await appendImage(form, imageUri, mimeType);

    if (caption) form.append('caption', caption);
    form.append('shared_to_feed', String(sharedToFeed ?? false));
    if (durationMinutes != null) form.append('duration_minutes', String(durationMinutes));
    if (completedOn) form.append('completed_on', completedOn);
    return apiClient.post<{ completion_id: string }>('/photos', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /** Replace the photo on a rejected (or verified) completion. Rejected photos
   *  re-enter the verification pipeline; verified photos are swapped in place. */
  reupload: async (completionId: string, imageUri: string, mimeType: string = 'image/jpeg') => {
    const form = new FormData();
    await appendImage(form, imageUri, mimeType);
    return apiClient.patch<{ completion_id: string; status: CompletionStatus }>(
      `/completions/${completionId}/photo`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  getUrl: (completionId: string) =>
    apiClient.get<PhotoUrlResponse>(`/photos/${completionId}/url`),

  getImageBlob: async (completionId: string): Promise<Blob> => {
    const res = await apiClient.get<Blob>(`/photos/${completionId}/image`, {
      responseType: 'blob',
    });
    return res.data;
  },
};
