import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

interface ConversationPreferencesState {
  voicePlaybackEnabled: boolean;
  setVoicePlaybackEnabled: (enabled: boolean) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useConversationPreferencesStore = create<ConversationPreferencesState>((set) => ({
  voicePlaybackEnabled: true,

  setVoicePlaybackEnabled: async (enabled) => {
    await AsyncStorage.setItem(STORAGE_KEYS.VOICE_PLAYBACK_ENABLED, String(enabled));
    set({ voicePlaybackEnabled: enabled });
  },

  loadFromStorage: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.VOICE_PLAYBACK_ENABLED);
    if (stored === 'true' || stored === 'false') {
      set({ voicePlaybackEnabled: stored === 'true' });
      return;
    }
    set({ voicePlaybackEnabled: true });
  },
}));
