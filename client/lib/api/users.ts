import { Platform } from 'react-native';
import { apiClient } from './client';
import type { AuthUser } from '@/lib/auth/auth-context';

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
};
