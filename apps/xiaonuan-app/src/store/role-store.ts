import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMPANIONEE_ROLE, STEWARD_ROLE, STORAGE_KEYS } from '../utils/constants';

type Role = typeof COMPANIONEE_ROLE | typeof STEWARD_ROLE;

interface RoleState {
  role: Role;
  setRole: (role: Role) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useRoleStore = create<RoleState>((set) => ({
  role: COMPANIONEE_ROLE,

  setRole: async (role) => {
    await AsyncStorage.setItem(STORAGE_KEYS.ROLE, role);
    set({ role });
  },

  loadFromStorage: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
    if (stored && (stored === COMPANIONEE_ROLE || stored === STEWARD_ROLE)) {
      set({ role: stored as Role });
    }
  },
}));
