import { act, renderHook } from '@testing-library/react-hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestWebSocketMessage = {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
};

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flushAsyncEffects = () => act(async () => {
  await Promise.resolve();
});

const { mockPlayAudio, mockStopAudio, mockStorage, handlers, storageControls } = vi.hoisted(() => ({
  mockPlayAudio: vi.fn(),
  mockStopAudio: vi.fn(),
  mockStorage: {} as Record<string, string>,
  handlers: {
    capturedMessageHandler: undefined as ((msg: TestWebSocketMessage) => void) | undefined,
  },
  storageControls: {
    deferNextGetItem: false,
    deferNextSetItem: false,
    rejectNextGetItem: false,
    resolveGetItem: undefined as ((value?: string | null) => void) | undefined,
    resolveSetItem: undefined as (() => void) | undefined,
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => {
      if (storageControls.rejectNextGetItem) {
        storageControls.rejectNextGetItem = false;
        return Promise.reject(new Error('storage read failed'));
      }
      if (storageControls.deferNextGetItem) {
        storageControls.deferNextGetItem = false;
        return new Promise<string | null>((resolve) => {
          storageControls.resolveGetItem = (value) => {
            storageControls.resolveGetItem = undefined;
            resolve(value === undefined ? mockStorage[key] ?? null : value);
          };
        });
      }
      return Promise.resolve(mockStorage[key] ?? null);
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (storageControls.deferNextSetItem) {
        storageControls.deferNextSetItem = false;
        return new Promise<void>((resolve) => {
          storageControls.resolveSetItem = () => {
            mockStorage[key] = value;
            storageControls.resolveSetItem = undefined;
            resolve();
          };
        });
      }
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    multiSet: vi.fn((pairs: [string, string][]) => {
      pairs.forEach(([key, value]) => {
        mockStorage[key] = value;
      });
      return Promise.resolve();
    }),
    multiGet: vi.fn((keys: string[]) => Promise.resolve(keys.map((key) => [key, mockStorage[key] ?? null]))),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((key) => {
        delete mockStorage[key];
      });
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios' },
  ToastAndroid: { SHORT: 0, show: vi.fn() },
}));

vi.mock('expo-router', () => ({
  router: { replace: vi.fn() },
}));

vi.mock('../hooks/useVoice', () => ({
  useVoice: () => ({
    getRecordingBase64: vi.fn(),
    hasPermission: true,
    isPlaying: false,
    isRecording: false,
    playAudio: mockPlayAudio,
    playError: false,
    requestPermission: vi.fn(() => Promise.resolve(true)),
    startRecording: vi.fn(),
    stopAudio: mockStopAudio,
    stopRecording: vi.fn(),
  }),
}));

vi.mock('../hooks/useWebSocket', async () => {
  return {
    useWebSocket: (_url: string, _token: string, onMessage?: (msg: TestWebSocketMessage) => void) => {
      handlers.capturedMessageHandler = onMessage;
      return {
        isConnected: true,
        sendMessage: vi.fn(() => true),
      };
    },
  };
});

describe('useCompanioneeConversation voice playback preference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    Object.keys(mockStorage).forEach((key) => {
      delete mockStorage[key];
    });
    handlers.capturedMessageHandler = undefined;
    storageControls.deferNextGetItem = false;
    storageControls.deferNextSetItem = false;
    storageControls.rejectNextGetItem = false;
    storageControls.resolveGetItem = undefined;
    storageControls.resolveSetItem = undefined;
  });

  it('should expose voice playback enabled by default', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    expect(result.current.voicePlaybackEnabled).toBe(true);
    expect(result.current.canPlayLatestAudio).toBe(false);
  });

  it('should auto-play ai audio when voice playback is enabled', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(mockPlayAudio).toHaveBeenCalledWith('http://example.com/reply.mp3');
  });

  it('should not auto-play ai audio when voice playback is disabled, but should keep latest audio playable', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    await act(async () => {
      await result.current.toggleVoicePlayback();
    });

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.canPlayLatestAudio).toBe(true);
    expect(result.current.state).toBe('IDLE');
  });

  it('should auto-play pending ai audio after hydration resolves to default enabled', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    storageControls.deferNextGetItem = true;
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/startup-reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe('IDLE');

    await act(async () => {
      storageControls.resolveGetItem?.(null);
      await Promise.resolve();
    });

    expect(mockPlayAudio).toHaveBeenCalledWith('http://example.com/startup-reply.mp3');
    expect(result.current.voicePlaybackEnabled).toBe(true);
    expect(result.current.canPlayLatestAudio).toBe(false);
    expect(result.current.state).toBe('SPEAKING');
  });

  it('should not auto-play pending ai audio after hydration if the elder started recording', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    storageControls.deferNextGetItem = true;
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/startup-reply.mp3' },
        timestamp: Date.now(),
      });
    });

    await act(async () => {
      await result.current.handleLongPress();
    });

    expect(result.current.state).toBe('LISTENING');

    await act(async () => {
      storageControls.resolveGetItem?.(null);
      await Promise.resolve();
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe('LISTENING');
    expect(result.current.canPlayLatestAudio).toBe(false);
  });

  it('should not reset recording state when unhydrated ai audio arrives during recording', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    storageControls.deferNextGetItem = true;
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());

    await act(async () => {
      await result.current.handleLongPress();
    });

    expect(result.current.state).toBe('LISTENING');

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/startup-reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe('LISTENING');

    await act(async () => {
      storageControls.resolveGetItem?.(null);
      await Promise.resolve();
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe('LISTENING');
  });

  it('should not auto-play hydrated ai audio when voice playback is enabled during recording', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    await act(async () => {
      await result.current.handleLongPress();
    });

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/late-reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe('LISTENING');
  });

  it('should not reset recording state when hydrated disabled ai audio arrives during recording', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    await act(async () => {
      await result.current.toggleVoicePlayback();
      await result.current.handleLongPress();
    });

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/late-reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe('LISTENING');
    expect(result.current.canPlayLatestAudio).toBe(false);
  });

  it('should not reset recording state when pending ai audio hydrates to disabled during recording', async () => {
    const { STORAGE_KEYS } = await import('../utils/constants');
    const { useAuthStore } = await import('../store/auth-store');
    storageControls.deferNextGetItem = true;
    mockStorage[STORAGE_KEYS.VOICE_PLAYBACK_ENABLED] = 'false';
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());

    await act(async () => {
      await result.current.handleLongPress();
    });

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/startup-reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(result.current.state).toBe('LISTENING');

    await act(async () => {
      storageControls.resolveGetItem?.('false');
      await Promise.resolve();
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.voicePlaybackEnabled).toBe(false);
    expect(result.current.state).toBe('LISTENING');
    expect(result.current.canPlayLatestAudio).toBe(false);
  });

  it('should not reset recording state when ai audio becomes unavailable during recording', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    await act(async () => {
      await result.current.handleLongPress();
    });

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio_unavailable',
        payload: {},
        timestamp: Date.now(),
      });
    });

    expect(result.current.state).toBe('LISTENING');
  });

  it('should not manually play latest audio during recording', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    await act(async () => {
      await result.current.toggleVoicePlayback();
    });

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(result.current.canPlayLatestAudio).toBe(true);

    await act(async () => {
      await result.current.handleLongPress();
    });

    expect(result.current.canPlayLatestAudio).toBe(false);

    await act(async () => {
      await result.current.playLatestAudio();
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe('LISTENING');
  });

  it('should keep pending ai audio manual-only after hydration resolves to disabled', async () => {
    const { STORAGE_KEYS } = await import('../utils/constants');
    const { useAuthStore } = await import('../store/auth-store');
    storageControls.deferNextGetItem = true;
    mockStorage[STORAGE_KEYS.VOICE_PLAYBACK_ENABLED] = 'false';
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/startup-reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.state).toBe('IDLE');

    await act(async () => {
      storageControls.resolveGetItem?.('false');
      await Promise.resolve();
    });

    expect(result.current.voicePlaybackEnabled).toBe(false);
    expect(result.current.canPlayLatestAudio).toBe(true);

    await act(async () => {
      await result.current.playLatestAudio();
    });

    expect(mockPlayAudio).toHaveBeenCalledWith('http://example.com/startup-reply.mp3');
  });

  it('should stop current playback immediately when turning voice playback off', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(result.current.state).toBe('SPEAKING');

    storageControls.deferNextSetItem = true;

    let togglePromise: Promise<void> | undefined;
    await act(async () => {
      togglePromise = result.current.toggleVoicePlayback();
      await Promise.resolve();
    });

    expect(mockStopAudio).toHaveBeenCalled();
    expect(result.current.state).toBe('IDLE');

    await act(async () => {
      storageControls.resolveSetItem?.();
      await togglePromise;
    });
  });

  it('should play the latest audio manually without changing voice playback preference', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    await act(async () => {
      await result.current.toggleVoicePlayback();
    });

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/reply.mp3' },
        timestamp: Date.now(),
      });
    });

    await act(async () => {
      await result.current.playLatestAudio();
    });

    expect(mockPlayAudio).toHaveBeenCalledWith('http://example.com/reply.mp3');
    expect(result.current.voicePlaybackEnabled).toBe(false);
    expect(result.current.state).toBe('SPEAKING');
  });

  it('should return to idle when manual latest audio playback fails', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());
    await flushAsyncEffects();

    await act(async () => {
      await result.current.toggleVoicePlayback();
    });

    act(() => {
      handlers.capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/reply.mp3' },
        timestamp: Date.now(),
      });
    });

    mockPlayAudio.mockResolvedValueOnce(false);

    await act(async () => {
      await result.current.playLatestAudio();
    });

    expect(mockPlayAudio).toHaveBeenCalledWith('http://example.com/reply.mp3');
    expect(result.current.state).toBe('IDLE');
  });
});
