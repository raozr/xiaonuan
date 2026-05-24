import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

interface AuthState {
  token: string | null;
  pairingId: string | null;
  deviceId: string | null;
  stewardName: string | null;
  companioneeName: string | null;
  setAuth: (data: { token: string; pairingId: string; stewardName?: string; companioneeName?: string }) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  pairingId: null,
  deviceId: null,
  stewardName: null,
  companioneeName: null,

  setAuth: async (data) => {
    const pairs: [string, string][] = [
      [STORAGE_KEYS.TOKEN, data.token],
      [STORAGE_KEYS.PAIRING_ID, data.pairingId],
    ];
    if (data.stewardName || data.companioneeName) {
      pairs.push([STORAGE_KEYS.USER, JSON.stringify({ stewardName: data.stewardName, companioneeName: data.companioneeName })]);
    }
    await AsyncStorage.multiSet(pairs);
    set({
      token: data.token,
      pairingId: data.pairingId,
      stewardName: data.stewardName ?? null,
      companioneeName: data.companioneeName ?? null,
    });
  },

  clearAuth: async () => {
    await AsyncStorage.multiRemove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.PAIRING_ID, STORAGE_KEYS.USER]);
    set({
      token: null,
      pairingId: null,
      stewardName: null,
      companioneeName: null,
    });
  },

  loadFromStorage: async () => {
    const results = await AsyncStorage.multiGet([
      STORAGE_KEYS.TOKEN,
      STORAGE_KEYS.PAIRING_ID,
      STORAGE_KEYS.USER,
    ]);
    const token = results[0]?.[1] ?? null;
    const pairingId = results[1]?.[1] ?? null;
    try {
      const userData = results[2]?.[1] ? JSON.parse(results[2][1]) : {};
      set({ token, pairingId, stewardName: userData.stewardName ?? null, companioneeName: userData.companioneeName ?? null });
    } catch {
      set({ token, pairingId, stewardName: null, companioneeName: null });
    }
  },
}));

/**
 * Initialize device ID on first run. Called once at app startup.
 */
export async function ensureDeviceId(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (stored) return stored;
  const uuid = await import('react-native-uuid');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const newId = (uuid.default as any).v4() as string;
  await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, newId);
  return newId;
}
