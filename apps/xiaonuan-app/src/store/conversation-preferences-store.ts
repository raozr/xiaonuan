import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

interface ConversationPreferencesState {
  hasLoadedFromStorage: boolean;
  voicePlaybackEnabled: boolean;
  setVoicePlaybackEnabled: (enabled: boolean) => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useConversationPreferencesStore = create<ConversationPreferencesState>((set) => {
  let localMutationVersion = 0;

  return {
    hasLoadedFromStorage: false,
    voicePlaybackEnabled: true,

    setVoicePlaybackEnabled: async (enabled) => {
      localMutationVersion += 1;
      set({ hasLoadedFromStorage: true, voicePlaybackEnabled: enabled });
      await AsyncStorage.setItem(STORAGE_KEYS.VOICE_PLAYBACK_ENABLED, String(enabled));
    },

    loadFromStorage: async () => {
      const loadStartedMutationVersion = localMutationVersion;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.VOICE_PLAYBACK_ENABLED);
        set((state) => {
          if (localMutationVersion !== loadStartedMutationVersion) {
            return { hasLoadedFromStorage: true, voicePlaybackEnabled: state.voicePlaybackEnabled };
          }
          if (stored === 'true' || stored === 'false') {
            return { hasLoadedFromStorage: true, voicePlaybackEnabled: stored === 'true' };
          }
          return { hasLoadedFromStorage: true, voicePlaybackEnabled: true };
        });
      } catch {
        set((state) => ({
          hasLoadedFromStorage: true,
          voicePlaybackEnabled:
            localMutationVersion !== loadStartedMutationVersion ? state.voicePlaybackEnabled : true,
        }));
      }
    },
  };
});
