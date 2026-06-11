import { Platform } from 'react-native';
import { apiClient } from './client';
import type { AuthUser } from '@/lib/auth/auth-context';

export interface DeletionPendingResponse {
  message: string;
  deletion_date: string;
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  policy_version: string;
  consented_at: string;
  data_storage_consent: boolean;
  photo_processing_consent: boolean;
  location_consent: boolean;
}

export interface DataExport {
  user: AuthUser;
  children: {
    id: string;
    family_id: string;
    nickname: string;
    date_of_birth: string;
    interests: string[];
    created_at: string;
    updated_at: string;
  }[];
  consents: ConsentRecord[];
  group_memberships: {
    group_id: string;
    group_name: string;
    joined_at: string;
  }[];
  completions: {
    id: string;
    activity_title: string;
    challenge_title: string;
    status: string;
    photo_url: string | null;
    caption: string | null;
    completed_at: string;
  }[];
}

export const usersApi = {
  getMe: () => apiClient.get<AuthUser>('/users/me'),

  updateMe: async (displayName?: string, imageUri?: string, mimeType = 'image/jpeg') => {
    const form = new FormData();
    if (displayName !== undefined) form.append('display_name', displayName);
    if (imageUri) {
      if (Platform.OS === 'web') {
        const res = await fetch(imageUri);
        const blob = await res.blob();
        form.append('image', blob, 'avatar.jpg');
      } else {
        form.append('image', { uri: imageUri, type: mimeType, name: 'avatar.jpg' } as any);
      }
    }
    return apiClient.patch<AuthUser>('/users/me', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteMe: () => apiClient.delete<DeletionPendingResponse>('/users/me'),

  cancelDeletion: () => apiClient.post<AuthUser>('/users/me/cancel-deletion'),

  exportData: () => apiClient.get<DataExport>('/users/me/export'),
};
