import AsyncStorage from '@react-native-async-storage/async-storage';

const GROUP_KEY = '@dba_pending_group_invite';
const FAMILY_KEY = '@dba_pending_family_invite';

export const pendingInvite = {
  async storeGroupToken(token: string): Promise<void> {
    await AsyncStorage.setItem(GROUP_KEY, token);
  },
  async getGroupToken(): Promise<string | null> {
    return AsyncStorage.getItem(GROUP_KEY);
  },
  async clearGroupToken(): Promise<void> {
    await AsyncStorage.removeItem(GROUP_KEY);
  },

  async storeFamilyToken(token: string): Promise<void> {
    await AsyncStorage.setItem(FAMILY_KEY, token);
  },
  async getFamilyToken(): Promise<string | null> {
    return AsyncStorage.getItem(FAMILY_KEY);
  },
  async clearFamilyToken(): Promise<void> {
    await AsyncStorage.removeItem(FAMILY_KEY);
  },
};
