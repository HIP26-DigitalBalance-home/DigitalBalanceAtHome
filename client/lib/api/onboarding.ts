import { apiClient } from './client';

export interface ConsentPayload {
  policy_version: string;
  data_storage_consent: boolean;
  photo_processing_consent: boolean;
  location_consent?: boolean;
}

export interface FamilyPayload {
  name?: string | null;
}

export interface ChildPayload {
  nickname: string;
  date_of_birth: string;
  interests?: string[];
}

export const onboardingApi = {
  postConsent: (payload: ConsentPayload) =>
    apiClient.post('/consents', payload),

  getConsent: () =>
    apiClient.get('/consents'),

  postFamily: (payload: FamilyPayload) =>
    apiClient.post('/families', payload),

  postFamilyJoin: (token: string) =>
    apiClient.post('/families/join', { token }),

  getMyFamilies: () =>
    apiClient.get('/families/me'),

  postChild: (payload: ChildPayload) =>
    apiClient.post('/children', payload),

  getChildren: () =>
    apiClient.get('/children'),
};
