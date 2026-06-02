import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, ToastAndroid } from 'react-native';
import { router } from 'expo-router';
import { useWebSocket } from './useWebSocket';
import { useVoice } from './useVoice';
import { useAuthStore } from '../store/auth-store';
import { useConversationPreferencesStore } from '../store/conversation-preferences-store';
import type { WebSocketMessage } from '../types/websocket';
import { WS_URL } from '../utils/constants';

const MIN_RECORDING_MS = 500;

export type CompanioneeConversationState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'RESPONDING'
  | 'SPEAKING';

function cleanAssistantText(rawText: string) {
  return rawText.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
}

export function useCompanioneeConversation() {
  const { token, pairingId, stewardName, clearAuth } = useAuthStore();
  const [state, setState] = useState<CompanioneeConversationState>('IDLE');
  const [aiText, setAiText] = useState('您好，想和我聊聊吗？');
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [pendingAutoPlayUrl, setPendingAutoPlayUrl] = useState<string | null>(null);
  const {
    hasLoadedFromStorage: hasLoadedConversationPreferences,
    loadFromStorage: loadConversationPreferences,
    setVoicePlaybackEnabled,
    voicePlaybackEnabled,
  } = useConversationPreferencesStore();

  const sessionReadyRef = useRef(false);
  const sessionCreateSentRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const lastAudioUrlRef = useRef<string | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartTime = useRef<number>(0);

  const {
    getRecordingBase64,
    hasPermission,
    isPlaying,
    isRecording,
    playAudio,
    playError,
    requestPermission,
    startRecording,
    stopAudio,
    stopRecording,
  } = useVoice();

  const handleUnbind = useCallback(() => {
    Alert.alert(
      '退出绑定',
      '退出后可以重新输入绑定码，绑定到其他家庭。确定要退出吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定退出',
          style: 'destructive',
          onPress: async () => {
            await clearAuth();
            router.replace('/(companionee)');
          },
        },
      ]
    );
  }, [clearAuth]);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    loadConversationPreferences();
  }, [loadConversationPreferences]);

  const handleMessage = useCallback(
    (msg: WebSocketMessage) => {
      if (msg.type === 'session:created' || msg.type === 'session:resumed') {
        sessionReadyRef.current = true;
        sessionCreateSentRef.current = false;
      } else if (msg.type === 'message:ai_text') {
        setAiText(cleanAssistantText(msg.payload.text));
        setState('RESPONDING');
      } else if (msg.type === 'ai:audio') {
        const url = msg.payload.url;
        if (!url || lastAudioUrlRef.current === url) return;
        lastAudioUrlRef.current = url;
        setLastAudioUrl(url);
        if (!hasLoadedConversationPreferences) {
          setPendingAutoPlayUrl(url);
          setState('IDLE');
        } else if (voicePlaybackEnabled) {
          setState('SPEAKING');
          playAudio(url);
        } else {
          setState('IDLE');
        }
      } else if (msg.type === 'ai:audio_unavailable') {
        setState('IDLE');
      } else if (msg.type === 'error') {
        if (msg.payload.code === 401) {
          Alert.alert('身份过期', '请重新绑定', [{ text: '确定', onPress: handleUnbind }]);
          return;
        }

        const raw = msg.payload.message || '';
        let friendly = '处理失败';
        if (msg.payload.code === 'ASR_FAILED' || msg.payload.code === 'ASR_EMPTY' || raw.includes('语音识别')) {
          friendly = '语音识别失败，请稍后再试';
        } else if (msg.payload.code === 'SESSION_REQUIRED' || raw.includes('会话')) {
          friendly = '会话已过期，请重新开始';
        } else if (msg.payload.code === 'TTS_FAILED' || raw.includes('合成') || raw.includes('TTS')) {
          friendly = '语音播放失败，请稍后再试';
        }
        Alert.alert('提示', friendly);
        setState('IDLE');
      }
    },
    [handleUnbind, hasLoadedConversationPreferences, playAudio, voicePlaybackEnabled]
  );

  const { isConnected, sendMessage } = useWebSocket(WS_URL, token ?? '', handleMessage);

  useEffect(() => {
    if (!hasLoadedConversationPreferences || !pendingAutoPlayUrl) return;

    const url = pendingAutoPlayUrl;
    setPendingAutoPlayUrl(null);
    if (voicePlaybackEnabled) {
      setState('SPEAKING');
      playAudio(url);
    } else {
      setState('IDLE');
    }
  }, [hasLoadedConversationPreferences, pendingAutoPlayUrl, playAudio, voicePlaybackEnabled]);

  useEffect(() => {
    if (!isConnected && wasConnectedRef.current) {
      sessionReadyRef.current = false;
      sessionCreateSentRef.current = false;
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected || !token || sessionReadyRef.current || sessionCreateSentRef.current) return;
    sessionCreateSentRef.current = sendMessage('session:create', {});
  }, [isConnected, token, sendMessage]);

  useEffect(() => {
    if (wasPlayingRef.current && !isPlaying && state === 'SPEAKING') {
      setState('IDLE');
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, state]);

  useEffect(() => {
    if (state === 'SPEAKING') {
      playbackTimeoutRef.current = setTimeout(() => {
        if (!isPlaying) {
          setState('IDLE');
        }
      }, 8000);
    } else if (state === 'RESPONDING') {
      playbackTimeoutRef.current = setTimeout(() => {
        setState('IDLE');
      }, 12000);
    } else if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }

    return () => {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
    };
  }, [state, isPlaying]);

  useEffect(() => {
    if (state === 'SPEAKING' && playError) {
      setState('IDLE');
    }
  }, [state, playError]);

  const handleLongPress = useCallback(async () => {
    if (!isConnected) {
      Alert.alert('网络未连接', '正在尝试连接小暖...');
      return;
    }
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('需要麦克风权限', '请在设置中允许小暖使用麦克风');
        return;
      }
    }

    pressStartTime.current = Date.now();
    setState('LISTENING');
    if (!sessionReadyRef.current) {
      const sent = sendMessage('session:create', {});
      if (!sent) {
        Alert.alert('提示', '网络不稳定，请松开后重试');
        setState('IDLE');
        return;
      }
    }
    await startRecording();
  }, [hasPermission, isConnected, requestPermission, sendMessage, startRecording]);

  const handlePressOut = useCallback(async () => {
    if (state !== 'LISTENING') return;
    const duration = Date.now() - pressStartTime.current;
    if (!isRecording) {
      setState('IDLE');
      return;
    }

    await stopRecording();
    if (duration < MIN_RECORDING_MS) {
      setState('IDLE');
      const msg = '说话时间太短';
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        Alert.alert('提示', msg);
      }
      return;
    }

    setState('PROCESSING');
    let waited = 0;
    while (!sessionReadyRef.current && waited < 3000) {
      await new Promise((r) => setTimeout(r, 100));
      waited += 100;
    }
    if (!sessionReadyRef.current && isConnected) {
      sendMessage('session:create', {});
      waited = 0;
      while (!sessionReadyRef.current && waited < 2000) {
        await new Promise((r) => setTimeout(r, 100));
        waited += 100;
      }
    }
    if (!sessionReadyRef.current) {
      Alert.alert('提示', '会话创建失败，请重试');
      setState('IDLE');
      return;
    }

    const base64 = await getRecordingBase64();
    if (!base64) {
      Alert.alert('提示', '读取录音失败，请重试');
      setState('IDLE');
      return;
    }
    const sent = sendMessage('message:voice_audio', { audioBase64: base64 });
    if (!sent) {
      Alert.alert('提示', '网络断开，请重试');
      setState('IDLE');
    }
  }, [getRecordingBase64, isConnected, isRecording, sendMessage, state, stopRecording]);

  const toggleVoicePlayback = useCallback(async () => {
    const nextEnabled = !voicePlaybackEnabled;
    if (!nextEnabled && state === 'SPEAKING') {
      stopAudio();
      setState('IDLE');
    }
    await setVoicePlaybackEnabled(nextEnabled);
  }, [setVoicePlaybackEnabled, state, stopAudio, voicePlaybackEnabled]);

  const playLatestAudio = useCallback(async () => {
    if (!lastAudioUrl) return;
    setState('SPEAKING');
    const didPlay = await playAudio(lastAudioUrl);
    if (didPlay === false) {
      setState('IDLE');
    }
  }, [lastAudioUrl, playAudio]);

  const handleStop = useCallback(() => {
    if (state === 'SPEAKING') {
      stopAudio();
      setState('IDLE');
    }
    if (state === 'LISTENING') {
      stopRecording();
      setState('IDLE');
    }
  }, [state, stopAudio, stopRecording]);

  const headerTitle = !isConnected
    ? '连接中...'
    : state === 'IDLE'
    ? `${stewardName ?? '小暖'}的陪伴`
    : state === 'LISTENING'
    ? '正在倾听...'
    : state === 'PROCESSING'
    ? '思考中...'
    : state === 'RESPONDING'
    ? '准备播放...'
    : '正在说...';

  const micLabel = state === 'LISTENING' ? '松开发送' : '按住说话';

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
}
