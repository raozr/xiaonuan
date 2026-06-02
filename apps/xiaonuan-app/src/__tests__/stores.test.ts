import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
const mockStorageControls: {
  deferNextGetItem: boolean;
  deferNextSetItem: boolean;
  rejectNextGetItem: boolean;
  resolveGetItem?: (value?: string | null) => void;
  resolveSetItem?: () => void;
} = {
  deferNextGetItem: false,
  deferNextSetItem: false,
  rejectNextGetItem: false,
};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => {
      if (mockStorageControls.rejectNextGetItem) {
        mockStorageControls.rejectNextGetItem = false;
        return Promise.reject(new Error('storage read failed'));
      }
      if (mockStorageControls.deferNextGetItem) {
        mockStorageControls.deferNextGetItem = false;
        return new Promise<string | null>((resolve) => {
          mockStorageControls.resolveGetItem = (value) => {
            mockStorageControls.resolveGetItem = undefined;
            resolve(value === undefined ? mockStorage[key] ?? null : value);
          };
        });
      }
      return Promise.resolve(mockStorage[key] ?? null);
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (mockStorageControls.deferNextSetItem) {
        mockStorageControls.deferNextSetItem = false;
        return new Promise<void>((resolve) => {
          mockStorageControls.resolveSetItem = () => {
            mockStorage[key] = value;
            mockStorageControls.resolveSetItem = undefined;
            resolve();
          };
        });
      }
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    multiSet: vi.fn((pairs: [string, string][]) => { pairs.forEach(([k, v]) => { mockStorage[k] = v; }); return Promise.resolve(); }),
    multiGet: vi.fn((keys: string[]) => Promise.resolve(keys.map(k => [k, mockStorage[k] ?? null]))),
    multiRemove: vi.fn((keys: string[]) => { keys.forEach(k => { delete mockStorage[k]; }); return Promise.resolve(); }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; return Promise.resolve(); }),
  },
}));

describe('auth-store', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    mockStorageControls.deferNextGetItem = false;
    mockStorageControls.deferNextSetItem = false;
    mockStorageControls.rejectNextGetItem = false;
    mockStorageControls.resolveGetItem = undefined;
    mockStorageControls.resolveSetItem = undefined;
    vi.resetModules();
  });

  it('should set auth and persist to storage', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    const { setAuth } = useAuthStore.getState();

    await setAuth({
      token: 'test-token',
      pairingId: 'pair-1',
      stewardName: 'Alice',
      companioneeName: 'Bob',
    });

    const state = useAuthStore.getState();
    expect(state.token).toBe('test-token');
    expect(state.pairingId).toBe('pair-1');
    expect(state.stewardName).toBe('Alice');
    expect(state.companioneeName).toBe('Bob');
  });

  it('should clear auth and remove from storage', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    const { setAuth, clearAuth } = useAuthStore.getState();

    await setAuth({ token: 'test-token', pairingId: 'pair-1' });
    await clearAuth();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.pairingId).toBeNull();
  });

  it('should load auth from storage', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    const { setAuth, loadFromStorage } = useAuthStore.getState();

    await setAuth({ token: 'persisted-token', pairingId: 'pair-2' });
    useAuthStore.setState({ token: null, pairingId: null });

    await loadFromStorage();

    const state = useAuthStore.getState();
    expect(state.token).toBe('persisted-token');
    expect(state.pairingId).toBe('pair-2');
  });
});

describe('role-store', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    mockStorageControls.deferNextGetItem = false;
    vi.resetModules();
  });

  it('should default to COMPANIONEE role', async () => {
    const { useRoleStore } = await import('../store/role-store');
    expect(useRoleStore.getState().role).toBe('COMPANIONEE');
  });

  it('should set role and persist to storage', async () => {
    const { useRoleStore } = await import('../store/role-store');
    const { setRole } = useRoleStore.getState();

    await setRole('STEWARD');
    expect(useRoleStore.getState().role).toBe('STEWARD');
  });

  it('should load role from storage', async () => {
    const { useRoleStore } = await import('../store/role-store');
    const { setRole, loadFromStorage } = useRoleStore.getState();

    await setRole('STEWARD');
    useRoleStore.setState({ role: 'COMPANIONEE' });

    await loadFromStorage();
    expect(useRoleStore.getState().role).toBe('STEWARD');
  });
});

describe('conversation-preferences-store', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    mockStorageControls.deferNextGetItem = false;
    mockStorageControls.deferNextSetItem = false;
    mockStorageControls.rejectNextGetItem = false;
    mockStorageControls.resolveGetItem = undefined;
    mockStorageControls.resolveSetItem = undefined;
    vi.resetModules();
  });

  it('should default AI voice playback to enabled', async () => {
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(true);
    expect(useConversationPreferencesStore.getState().hasLoadedFromStorage).toBe(false);
  });

  it('should persist AI voice playback preference', async () => {
    const { STORAGE_KEYS } = await import('../utils/constants');
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    await useConversationPreferencesStore.getState().setVoicePlaybackEnabled(false);

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(false);
    expect(mockStorage[STORAGE_KEYS.VOICE_PLAYBACK_ENABLED]).toBe('false');
  });

  it('should update AI voice playback preference in memory before persistence completes', async () => {
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    mockStorageControls.deferNextSetItem = true;
    const persistPromise = useConversationPreferencesStore.getState().setVoicePlaybackEnabled(false);

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(false);
    expect(useConversationPreferencesStore.getState().hasLoadedFromStorage).toBe(true);

    mockStorageControls.resolveSetItem?.();
    await persistPromise;
  });

  it('should not let a slow storage load overwrite a local voice playback change', async () => {
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    mockStorageControls.deferNextGetItem = true;
    const loadPromise = useConversationPreferencesStore.getState().loadFromStorage();
    await useConversationPreferencesStore.getState().setVoicePlaybackEnabled(false);

    mockStorageControls.resolveGetItem?.(null);
    await loadPromise;

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(false);
    expect(useConversationPreferencesStore.getState().hasLoadedFromStorage).toBe(true);
  });

  it('should restore AI voice playback preference from storage', async () => {
    const { STORAGE_KEYS } = await import('../utils/constants');
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    mockStorage[STORAGE_KEYS.VOICE_PLAYBACK_ENABLED] = 'false';
    useConversationPreferencesStore.setState({ voicePlaybackEnabled: true });

    await useConversationPreferencesStore.getState().loadFromStorage();

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(false);
    expect(useConversationPreferencesStore.getState().hasLoadedFromStorage).toBe(true);
  });

  it('should mark conversation preferences loaded when no stored preference exists', async () => {
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    await useConversationPreferencesStore.getState().loadFromStorage();

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(true);
    expect(useConversationPreferencesStore.getState().hasLoadedFromStorage).toBe(true);
  });

  it('should fall back to enabled and mark loaded when preference storage read fails', async () => {
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    useConversationPreferencesStore.setState({ hasLoadedFromStorage: false, voicePlaybackEnabled: false });
    mockStorageControls.rejectNextGetItem = true;

    await useConversationPreferencesStore.getState().loadFromStorage();

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(true);
    expect(useConversationPreferencesStore.getState().hasLoadedFromStorage).toBe(true);
  });
});
