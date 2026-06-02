# Voice Playback Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent elder-side AI voice playback toggle that stops current AI speech immediately, prevents future auto-play when off, and keeps a manual play button for the latest reply.

**Architecture:** Keep the feature entirely in the Expo app. Add a small Zustand + AsyncStorage preference store, extend `useCompanioneeConversation` to gate `ai:audio` auto-play, and render a focused `VoicePlaybackToggle` component near the AI reply bubble.

**Tech Stack:** Expo SDK 55, React Native 0.83, Zustand, AsyncStorage, Vitest, @testing-library/react-hooks, @testing-library/react-native.

---

## File Structure

- Modify `apps/xiaonuan-app/src/utils/constants.ts`
  - Add `STORAGE_KEYS.VOICE_PLAYBACK_ENABLED`.
- Create `apps/xiaonuan-app/src/store/conversation-preferences-store.ts`
  - Owns `voicePlaybackEnabled`, `setVoicePlaybackEnabled`, and `loadFromStorage`.
- Modify `apps/xiaonuan-app/src/__tests__/stores.test.ts`
  - Covers default, persistence, and restore behavior for the new store.
- Modify `apps/xiaonuan-app/src/hooks/useCompanioneeConversation.ts`
  - Reads the preference store.
  - Stores the latest AI audio URL.
  - Gates automatic `playAudio`.
  - Stops current playback when voice is turned off.
  - Exposes UI actions.
- Create `apps/xiaonuan-app/src/__tests__/companionee-conversation.test.ts`
  - Covers the hook-level event behavior.
- Create `apps/xiaonuan-app/src/components/companionee/VoicePlaybackToggle.tsx`
  - Displays `语音 开` / `语音 关`.
  - Shows `播放` only when voice is off and the latest audio is available.
- Create `apps/xiaonuan-app/src/__tests__/voice-playback-toggle.test.tsx`
  - Covers component labels and callback wiring.
- Modify `apps/xiaonuan-app/app/(companionee)/home.tsx`
  - Places `VoicePlaybackToggle` inside the AI reply bubble area.

---

### Task 1: Add Persistent Conversation Preference Store

**Files:**
- Modify: `apps/xiaonuan-app/src/utils/constants.ts`
- Create: `apps/xiaonuan-app/src/store/conversation-preferences-store.ts`
- Test: `apps/xiaonuan-app/src/__tests__/stores.test.ts`

- [ ] **Step 1: Write failing store tests**

Append this block to `apps/xiaonuan-app/src/__tests__/stores.test.ts`:

```ts
describe('conversation-preferences-store', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.resetModules();
  });

  it('should default AI voice playback to enabled', async () => {
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(true);
  });

  it('should persist AI voice playback preference', async () => {
    const { STORAGE_KEYS } = await import('../utils/constants');
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    await useConversationPreferencesStore.getState().setVoicePlaybackEnabled(false);

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(false);
    expect(mockStorage[STORAGE_KEYS.VOICE_PLAYBACK_ENABLED]).toBe('false');
  });

  it('should restore AI voice playback preference from storage', async () => {
    const { STORAGE_KEYS } = await import('../utils/constants');
    const { useConversationPreferencesStore } = await import('../store/conversation-preferences-store');

    mockStorage[STORAGE_KEYS.VOICE_PLAYBACK_ENABLED] = 'false';
    useConversationPreferencesStore.setState({ voicePlaybackEnabled: true });

    await useConversationPreferencesStore.getState().loadFromStorage();

    expect(useConversationPreferencesStore.getState().voicePlaybackEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run the failing store tests**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app test -- src/__tests__/stores.test.ts
```

Expected: FAIL because `../store/conversation-preferences-store` and `STORAGE_KEYS.VOICE_PLAYBACK_ENABLED` do not exist.

- [ ] **Step 3: Add the storage key**

In `apps/xiaonuan-app/src/utils/constants.ts`, update `STORAGE_KEYS` to:

```ts
export const STORAGE_KEYS = {
  DEVICE_ID: 'xn:deviceId',
  TOKEN: 'xn:token',
  PAIRING_ID: 'xn:pairingId',
  USER: 'xn:user',
  ROLE: 'xn:role',
  VOICE_PLAYBACK_ENABLED: 'xn:voicePlaybackEnabled',
} as const;
```

- [ ] **Step 4: Create the preference store**

Create `apps/xiaonuan-app/src/store/conversation-preferences-store.ts`:

```ts
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
```

- [ ] **Step 5: Run store tests to verify they pass**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app test -- src/__tests__/stores.test.ts
```

Expected: PASS. Existing auth-store and role-store tests should still pass.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add apps/xiaonuan-app/src/utils/constants.ts apps/xiaonuan-app/src/store/conversation-preferences-store.ts apps/xiaonuan-app/src/__tests__/stores.test.ts
git commit -m "Add conversation playback preference store"
```

---

### Task 2: Add Hook Tests for Playback Toggle Behavior

**Files:**
- Create: `apps/xiaonuan-app/src/__tests__/companionee-conversation.test.ts`
- Modify later in Task 3: `apps/xiaonuan-app/src/hooks/useCompanioneeConversation.ts`

- [ ] **Step 1: Write failing hook tests**

Create `apps/xiaonuan-app/src/__tests__/companionee-conversation.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebSocketMessage } from '../types/websocket';

const mockPlayAudio = vi.fn();
const mockStopAudio = vi.fn();
let capturedMessageHandler: ((msg: WebSocketMessage) => void) | undefined;

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
  const actual = await vi.importActual<typeof import('../hooks/useWebSocket')>('../hooks/useWebSocket');
  return {
    ...actual,
    useWebSocket: (_url: string, _token: string, onMessage?: (msg: WebSocketMessage) => void) => {
      capturedMessageHandler = onMessage;
      return {
        isConnected: true,
        sendMessage: vi.fn(() => true),
      };
    },
  };
});

describe('useCompanioneeConversation voice playback preference', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    capturedMessageHandler = undefined;
  });

  it('should expose voice playback enabled by default', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());

    expect(result.current.voicePlaybackEnabled).toBe(true);
    expect(result.current.canPlayLatestAudio).toBe(false);
  });

  it('should auto-play ai audio when voice playback is enabled', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    renderHook(() => useCompanioneeConversation());

    act(() => {
      capturedMessageHandler?.({
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

    await act(async () => {
      await result.current.toggleVoicePlayback();
    });

    act(() => {
      capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(mockPlayAudio).not.toHaveBeenCalled();
    expect(result.current.canPlayLatestAudio).toBe(true);
    expect(result.current.state).toBe('IDLE');
  });

  it('should stop current playback immediately when turning voice playback off', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());

    act(() => {
      capturedMessageHandler?.({
        type: 'ai:audio',
        payload: { url: 'http://example.com/reply.mp3' },
        timestamp: Date.now(),
      });
    });

    expect(result.current.state).toBe('SPEAKING');

    await act(async () => {
      await result.current.toggleVoicePlayback();
    });

    expect(mockStopAudio).toHaveBeenCalled();
    expect(result.current.state).toBe('IDLE');
  });

  it('should play the latest audio manually without changing voice playback preference', async () => {
    const { useAuthStore } = await import('../store/auth-store');
    await useAuthStore.getState().setAuth({ token: 'token', pairingId: 'pair-1' });
    const { useCompanioneeConversation } = await import('../hooks/useCompanioneeConversation');

    const { result } = renderHook(() => useCompanioneeConversation());

    await act(async () => {
      await result.current.toggleVoicePlayback();
    });

    act(() => {
      capturedMessageHandler?.({
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
});
```

- [ ] **Step 2: Run hook tests to verify they fail**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app test -- src/__tests__/companionee-conversation.test.ts
```

Expected: FAIL because `voicePlaybackEnabled`, `toggleVoicePlayback`, `canPlayLatestAudio`, and `playLatestAudio` are not exposed yet.

- [ ] **Step 3: Commit failing tests only if your workflow supports red commits**

For this repo, keep the failing tests uncommitted until Task 3 passes. Do not commit a red state.

---

### Task 3: Implement Hook Playback Preference Behavior

**Files:**
- Modify: `apps/xiaonuan-app/src/hooks/useCompanioneeConversation.ts`
- Test: `apps/xiaonuan-app/src/__tests__/companionee-conversation.test.ts`

- [ ] **Step 1: Import the preference store**

In `apps/xiaonuan-app/src/hooks/useCompanioneeConversation.ts`, add:

```ts
import { useConversationPreferencesStore } from '../store/conversation-preferences-store';
```

- [ ] **Step 2: Add preference state and latest audio URL**

Inside `useCompanioneeConversation`, after `aiText` state, add:

```ts
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const {
    loadFromStorage: loadConversationPreferences,
    setVoicePlaybackEnabled,
    voicePlaybackEnabled,
  } = useConversationPreferencesStore();
```

- [ ] **Step 3: Load preference on mount**

After the existing `requestPermission` effect, add:

```ts
  useEffect(() => {
    loadConversationPreferences();
  }, [loadConversationPreferences]);
```

- [ ] **Step 4: Gate `ai:audio` auto-play**

Replace the current `ai:audio` branch in `handleMessage`:

```ts
      } else if (msg.type === 'ai:audio') {
        const url = msg.payload.url;
        if (!url || lastAudioUrlRef.current === url) return;
        lastAudioUrlRef.current = url;
        setState('SPEAKING');
        playAudio(url);
```

with:

```ts
      } else if (msg.type === 'ai:audio') {
        const url = msg.payload.url;
        if (!url || lastAudioUrlRef.current === url) return;
        lastAudioUrlRef.current = url;
        setLastAudioUrl(url);
        if (voicePlaybackEnabled) {
          setState('SPEAKING');
          playAudio(url);
        } else {
          setState('IDLE');
        }
```

- [ ] **Step 5: Update the `handleMessage` dependency list**

Change:

```ts
    [handleUnbind, playAudio]
```

to:

```ts
    [handleUnbind, playAudio, voicePlaybackEnabled]
```

- [ ] **Step 6: Add toggle and manual playback actions**

Before `handleStop`, add:

```ts
  const toggleVoicePlayback = useCallback(async () => {
    const nextEnabled = !voicePlaybackEnabled;
    await setVoicePlaybackEnabled(nextEnabled);
    if (!nextEnabled && state === 'SPEAKING') {
      stopAudio();
      setState('IDLE');
    }
  }, [setVoicePlaybackEnabled, state, stopAudio, voicePlaybackEnabled]);

  const playLatestAudio = useCallback(async () => {
    if (!lastAudioUrl) return;
    setState('SPEAKING');
    await playAudio(lastAudioUrl);
  }, [lastAudioUrl, playAudio]);
```

- [ ] **Step 7: Return new hook values**

Add these properties to the returned object:

```ts
    canPlayLatestAudio: !voicePlaybackEnabled && Boolean(lastAudioUrl),
    playLatestAudio,
    toggleVoicePlayback,
    voicePlaybackEnabled,
```

The return object should still include the existing values:

```ts
  return {
    aiText,
    canPlayLatestAudio: !voicePlaybackEnabled && Boolean(lastAudioUrl),
    headerTitle,
    isConnected,
    micLabel,
    playLatestAudio,
    state,
    toggleVoicePlayback,
    voicePlaybackEnabled,
    handleLongPress,
    handlePressOut,
    handleStop,
    handleUnbind,
    isRecording,
    pairingId,
    token,
  };
```

- [ ] **Step 8: Run hook tests**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app test -- src/__tests__/companionee-conversation.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run store tests again**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app test -- src/__tests__/stores.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2 and Task 3 together**

Run:

```bash
git add apps/xiaonuan-app/src/__tests__/companionee-conversation.test.ts apps/xiaonuan-app/src/hooks/useCompanioneeConversation.ts
git commit -m "Add companionee voice playback behavior"
```

---

### Task 4: Add VoicePlaybackToggle Component

**Files:**
- Create: `apps/xiaonuan-app/src/components/companionee/VoicePlaybackToggle.tsx`
- Create: `apps/xiaonuan-app/src/__tests__/voice-playback-toggle.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `apps/xiaonuan-app/src/__tests__/voice-playback-toggle.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, vi } from 'vitest';
import { VoicePlaybackToggle } from '../components/companionee/VoicePlaybackToggle';

describe('VoicePlaybackToggle', () => {
  it('should show enabled label', () => {
    const screen = render(
      <VoicePlaybackToggle
        enabled
        canPlayLatest={false}
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );

    expect(screen.getByText('语音 开')).toBeTruthy();
  });

  it('should show disabled label and latest play button', () => {
    const screen = render(
      <VoicePlaybackToggle
        enabled={false}
        canPlayLatest
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );

    expect(screen.getByText('语音 关')).toBeTruthy();
    expect(screen.getByText('播放')).toBeTruthy();
  });

  it('should call callbacks when pressed', () => {
    const onToggle = vi.fn();
    const onPlayLatest = vi.fn();
    const screen = render(
      <VoicePlaybackToggle
        enabled={false}
        canPlayLatest
        onToggle={onToggle}
        onPlayLatest={onPlayLatest}
      />
    );

    fireEvent.press(screen.getByText('语音 关'));
    fireEvent.press(screen.getByText('播放'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onPlayLatest).toHaveBeenCalledTimes(1);
  });

  it('should hide play button when latest audio is unavailable', () => {
    const screen = render(
      <VoicePlaybackToggle
        enabled={false}
        canPlayLatest={false}
        onToggle={vi.fn()}
        onPlayLatest={vi.fn()}
      />
    );

    expect(screen.queryByText('播放')).toBeNull();
  });
});
```

- [ ] **Step 2: Run component tests to verify they fail**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app test -- src/__tests__/voice-playback-toggle.test.tsx
```

Expected: FAIL because `VoicePlaybackToggle` does not exist.

- [ ] **Step 3: Create the component**

Create `apps/xiaonuan-app/src/components/companionee/VoicePlaybackToggle.tsx`:

```tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors, typography } from '../../utils/theme';

interface VoicePlaybackToggleProps {
  enabled: boolean;
  canPlayLatest: boolean;
  onToggle: () => void;
  onPlayLatest: () => void;
}

export function VoicePlaybackToggle({
  enabled,
  canPlayLatest,
  onToggle,
  onPlayLatest,
}: VoicePlaybackToggleProps) {
  return (
    <View className="flex-row items-center justify-end gap-stack-sm">
      <TouchableOpacity
        className="min-h-[44px] rounded-full px-4 items-center justify-center border"
        style={{
          backgroundColor: enabled ? colors.primaryFixed : colors.surfaceContainer,
          borderColor: enabled ? colors.primaryFixedDim : colors.outlineVariant,
        }}
        activeOpacity={0.75}
        onPress={onToggle}
      >
        <Text
          className="font-bold"
          style={[
            typography.bodyMd,
            { color: enabled ? colors.onPrimaryFixed : colors.onSurfaceVariant },
          ]}
        >
          {enabled ? '语音 开' : '语音 关'}
        </Text>
      </TouchableOpacity>

      {!enabled && canPlayLatest ? (
        <TouchableOpacity
          className="min-h-[44px] rounded-full px-4 items-center justify-center"
          style={{ backgroundColor: colors.primary }}
          activeOpacity={0.75}
          onPress={onPlayLatest}
        >
          <Text className="font-bold" style={[typography.bodyMd, { color: colors.onPrimary }]}>
            播放
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Run component tests**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app test -- src/__tests__/voice-playback-toggle.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add apps/xiaonuan-app/src/components/companionee/VoicePlaybackToggle.tsx apps/xiaonuan-app/src/__tests__/voice-playback-toggle.test.tsx
git commit -m "Add voice playback toggle component"
```

---

### Task 5: Place the Toggle Near the AI Reply Bubble

**Files:**
- Modify: `apps/xiaonuan-app/app/(companionee)/home.tsx`
- Optional Test: `apps/xiaonuan-app/src/__tests__/code-style.test.ts`

- [ ] **Step 1: Import the component**

In `apps/xiaonuan-app/app/(companionee)/home.tsx`, add:

```ts
import { VoicePlaybackToggle } from '../../src/components/companionee/VoicePlaybackToggle';
```

- [ ] **Step 2: Destructure new hook values**

Update the `useCompanioneeConversation` destructuring to include:

```ts
    canPlayLatestAudio,
    playLatestAudio,
    toggleVoicePlayback,
    voicePlaybackEnabled,
```

The top of the component should include:

```ts
  const {
    aiText,
    canPlayLatestAudio,
    headerTitle,
    micLabel,
    state,
    handleLongPress,
    handlePressOut,
    handleStop,
    handleUnbind,
    playLatestAudio,
    toggleVoicePlayback,
    voicePlaybackEnabled,
  } = useCompanioneeConversation();
```

- [ ] **Step 3: Add the toggle to the AI text bubble**

In the AI text bubble view, replace the current direct `ScrollView` content:

```tsx
            <ScrollView 
              contentContainerStyle={{ flexGrow: 1, paddingVertical: 4 }} 
              showsVerticalScrollIndicator={true} 
              bounces={true}
              indicatorStyle="black"
            >
              <Text className="text-on-surface" style={[typography.bodyLgElderly, { textAlign: aiText.length > 20 ? 'left' : 'center', lineHeight: 32 }]}>
                {aiText}
              </Text>
            </ScrollView>
```

with:

```tsx
            <View className="flex-1">
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1, paddingVertical: 4 }}
                showsVerticalScrollIndicator={true}
                bounces={true}
                indicatorStyle="black"
              >
                <Text className="text-on-surface" style={[typography.bodyLgElderly, { textAlign: aiText.length > 20 ? 'left' : 'center', lineHeight: 32 }]}>
                  {aiText}
                </Text>
              </ScrollView>
              <View className="pt-3">
                <VoicePlaybackToggle
                  enabled={voicePlaybackEnabled}
                  canPlayLatest={canPlayLatestAudio}
                  onToggle={toggleVoicePlayback}
                  onPlayLatest={playLatestAudio}
                />
              </View>
            </View>
```

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app exec tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Run app tests**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app test
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add 'apps/xiaonuan-app/app/(companionee)/home.tsx'
git commit -m "Place voice playback toggle near reply"
```

---

### Task 6: Final Verification and Regression Pass

**Files:**
- No new source files.
- Verify all files touched by Tasks 1-5.

- [ ] **Step 1: Run focused mobile checks**

Run:

```bash
pnpm --filter @xiaonuan/xiaonuan-app exec tsc --noEmit
pnpm --filter @xiaonuan/xiaonuan-app test
```

Expected:

- TypeScript exits with code 0.
- App tests pass, including store, hook, and component tests.

- [ ] **Step 2: Run full workspace build and tests**

Run:

```bash
pnpm build
pnpm test
```

Expected:

- Build passes.
- Workspace tests pass.

- [ ] **Step 3: Manual Expo smoke check**

Start Expo:

```bash
cd apps/xiaonuan-app
pnpm start
```

Open the elder home screen and check:

- The AI reply bubble shows `语音 开` by default.
- Tapping it changes the label to `语音 关`.
- Tapping it again changes the label back to `语音 开`.
- Press-and-hold voice input is still available.
- While AI is speaking, tapping `语音 开` to turn it off stops playback.
- With voice off, a later AI reply shows text and does not auto-play.
- With voice off and latest audio available, `播放` appears and manually plays the latest reply.

- [ ] **Step 4: Check Git status**

Run:

```bash
git status --short
```

Expected: only intentional changes are present. Do not stage `apps/xiaonuan-app/.env.development.local`, `.superpowers/`, or `AGENTS.md` unless the user explicitly asks.

- [ ] **Step 5: Final commit if any verification-only adjustments were needed**

If Task 6 required code fixes, commit them:

```bash
git status --short
git add apps/xiaonuan-app/src/utils/constants.ts apps/xiaonuan-app/src/store/conversation-preferences-store.ts apps/xiaonuan-app/src/hooks/useCompanioneeConversation.ts apps/xiaonuan-app/src/components/companionee/VoicePlaybackToggle.tsx apps/xiaonuan-app/app/\(companionee\)/home.tsx apps/xiaonuan-app/src/__tests__/stores.test.ts apps/xiaonuan-app/src/__tests__/companionee-conversation.test.ts apps/xiaonuan-app/src/__tests__/voice-playback-toggle.test.tsx
git commit -m "Fix voice playback toggle regressions"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - Persistent preference is covered in Task 1.
  - AI text always displays is preserved in Task 3.
  - `ai:audio` auto-play gating is covered in Task 3.
  - Immediate stop on disabling voice is covered in Task 3.
  - Manual latest playback is covered in Task 3 and Task 4.
  - Bubble-adjacent UI is covered in Task 5.
  - Testing and regression commands are covered in Task 6.
- Placeholder scan:
  - No `TODO`, `TBD`, or open-ended implementation steps remain.
- Type consistency:
  - Store field is consistently named `voicePlaybackEnabled`.
  - Hook action names are consistently `toggleVoicePlayback` and `playLatestAudio`.
  - UI prop names are consistently `enabled`, `canPlayLatest`, `onToggle`, and `onPlayLatest`.
