import { apiClient } from './client';

export const devApi = {
  seed: () => apiClient.post<{ message: string }>('/dev/seed'),
};
