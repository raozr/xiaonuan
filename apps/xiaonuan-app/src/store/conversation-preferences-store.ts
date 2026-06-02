import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

interface ConversationPreferencesState {
  hasLoadedFromStorage: boolean;
  voicePlaybackEnabled: boolean;
  setVoicePlaybackEnabled: (enabled: boolean) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useConversationPreferencesStore = create<ConversationPreferencesState>((set) => ({
  hasLoadedFromStorage: false,
  voicePlaybackEnabled: true,

  setVoicePlaybackEnabled: async (enabled) => {
    set({ voicePlaybackEnabled: enabled });
    await AsyncStorage.setItem(STORAGE_KEYS.VOICE_PLAYBACK_ENABLED, String(enabled));
  },

  loadFromStorage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.VOICE_PLAYBACK_ENABLED);
      if (stored === 'true' || stored === 'false') {
        set({ hasLoadedFromStorage: true, voicePlaybackEnabled: stored === 'true' });
        return;
      }
    } catch {
      set({ hasLoadedFromStorage: true, voicePlaybackEnabled: true });
      return;
    }
    set({ hasLoadedFromStorage: true, voicePlaybackEnabled: true });
  },
}));
