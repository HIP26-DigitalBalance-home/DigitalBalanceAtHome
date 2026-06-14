import { apiClient } from './client';

export interface CollagePreset {
  id: string;
  name: string;
  description: string;
  activity_ids: string[]; // exactly 9, ordered by grid_position 0–8
}

export const collagePresetsApi = {
  list: () => apiClient.get<CollagePreset[]>('/collage-presets'),
};
