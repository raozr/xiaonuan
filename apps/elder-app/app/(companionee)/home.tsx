import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ToastAndroid,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { Mic, Square, LogOut, History } from 'lucide-react-native';
import { useWebSocket, type WebSocketMessage } from '../../src/hooks/useWebSocket';
import { useVoice } from '../../src/hooks/useVoice';
import { useAuthStore } from '../../src/store/auth-store';
import { API_URL, WS_URL } from '../../src/utils/constants';
import { colors, typography, spacing } from '../../src/utils/theme';

const MIN_RECORDING_MS = 500;

export default function CompanioneeHome() {
  const { token, pairingId, stewardName, clearAuth } = useAuthStore();
  const [state, setState] = useState<'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'>('IDLE');
  const [aiText, setAiText] = useState('您好，想和我聊聊吗？');
  const sessionReadyRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const lastAudioUrlRef = useRef<string | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartTime = useRef<number>(0);

  // Reanimated shared values
  const breatheScale = useSharedValue(1);
  const pulseScale = useSharedValue(0.8);
  const pulseOpacity = useSharedValue(0.8);

  const { isRecording, isPlaying, playError, hasPermission, requestPermission, startRecording, stopRecording, playAudio, stopAudio, getRecordingBase64 } = useVoice();

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Breathing animation
  useEffect(() => {
    if (state === 'LISTENING' || state === 'SPEAKING') {
      cancelAnimation(breatheScale);
      breatheScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 2000 }),
          withTiming(1, { duration: 2000 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(breatheScale);
      breatheScale.value = withTiming(1, { duration: 300 });
    }
  }, [state, breatheScale]);

  // Pulse animation for voice button
  useEffect(() => {
    if (state === 'LISTENING') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 1000 }),
          withTiming(0.8, { duration: 1000 }),
        ),
        -1,
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1000 }),
          withTiming(0.8, { duration: 1000 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 0.8;
      pulseOpacity.value = 0.8;
    }
  }, [state, pulseScale, pulseOpacity]);

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    if (msg.type === 'session:created' || msg.type === 'session:resumed') {
      sessionReadyRef.current = true;
    } else if (msg.type === 'message:ai_text') {
      const rawText = msg.payload.text as string;
      const cleanText = rawText
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .trim();
      setAiText(cleanText);
    } else if (msg.type === 'ai:audio') {
      const url = msg.payload.url as string;
      if (lastAudioUrlRef.current === url) return;
      lastAudioUrlRef.current = url;
      setState('SPEAKING');
      playAudio(url);
    } else if (msg.type === 'error') {
      if (msg.payload.code === 401) {
        Alert.alert('身份过期', '请重新绑定', [{ text: '确定', onPress: handleUnbind }]);
      } else {
        const raw = msg.payload.message || '';
        let friendly = '处理失败';
        if (raw.includes('语音识别') || raw.includes('ASR') || raw.includes('429')) {
          friendly = '语音识别失败，请稍后再试';
        } else if (raw.includes('会话')) {
          friendly = '会话已过期，请重新开始';
        } else if (raw.includes('合成') || raw.includes('TTS')) {
          friendly = '语音播放失败，请稍后再试';
        }
        Alert.alert('提示', friendly);
        setState('IDLE');
      }
    }
  }, [playAudio]);

  const wsUrl = `${WS_URL}?token=${token}`;
  const { isConnected, sendMessage } = useWebSocket(
    wsUrl.split('?')[0] ?? WS_URL,
    token ?? '',
    handleMessage,
  );

  useEffect(() => {
    if (!isConnected && wasConnectedRef.current) {
      sessionReadyRef.current = false;
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected]);

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
    } else {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
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

  async function handleLongPress() {
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
  }

  async function handlePressOut() {
    if (state !== 'LISTENING') return;
    const duration = Date.now() - pressStartTime.current;
    if (!isRecording) {
      setState('IDLE');
      return;
    }
    const uri = await stopRecording();
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
      return;
    }
  }

  function handleStop() {
    if (state === 'SPEAKING') {
      stopAudio();
      setState('IDLE');
    }
    if (state === 'LISTENING') {
      stopRecording();
      setState('IDLE');
    }
  }

  function handleUnbind() {
    Alert.alert(
      '退出绑定',
      '退出后可以重新输入绑定码，绑定到其他家庭。确定要退出吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '确定退出', style: 'destructive', onPress: async () => {
          await clearAuth();
          router.replace('/(companionee)');
        }},
      ]
    );
  }

  const headerTitle = !isConnected
    ? '连接中...'
    : state === 'IDLE'
    ? `${stewardName ?? '小暖'}的陪伴`
    : state === 'LISTENING'
    ? '正在倾听...'
    : state === 'PROCESSING'
    ? '思考中...'
    : '正在说...';

  const micLabel = state === 'LISTENING' ? '松开发送' : '按住说话';

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <SafeAreaView className="flex-1 bg-surface-bright" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="h-16 flex-row items-center justify-between px-gutter bg-surface-bright">
        <View className="w-16" />
        <Text className="flex-1 text-center font-bold" style={typography.headlineLg}>
          {headerTitle}
        </Text>
        <TouchableOpacity
          className="w-16 items-center justify-center"
          activeOpacity={0.7}
          onPress={() => Alert.alert('对话历史', '功能开发中')}
        >
          <History size={28} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View className="flex-1 items-center justify-center px-gutter relative">
        {/* Ambient glow */}
        <View className="absolute inset-0" style={{ backgroundColor: 'transparent' }} />

        {/* Mascot */}
        <View className="items-center justify-center mb-8 relative">
          <Animated.View className="w-[280px] h-[280px] rounded-full overflow-hidden" style={breatheStyle}>
            <Image
              source={require('../../assets/logo.png')}
              className="w-full h-full"
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* AI Text Bubble */}
        <View className="w-full max-w-[320px] bg-surfaceContainer rounded-2xl p-5 shadow-sm" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
          <Text className="text-center text-on-surface" style={typography.bodyLgElderly}>
            {aiText}
          </Text>
        </View>

        {/* Voice Button */}
        <View className="absolute bottom-[10vh] items-center gap-stack-md">
          <View className="relative items-center justify-center">
            {/* Pulse ring */}
            <Animated.View
              className="absolute w-[120px] h-[120px] rounded-full border-4 border-primaryContainer"
              style={pulseStyle}
            />
            <TouchableOpacity
              className="w-[120px] h-[120px] rounded-full items-center justify-center shadow-lg border-4 border-surface-bright"
              style={{
                backgroundColor: state === 'LISTENING' ? colors.onPrimaryFixedVariant : colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 10,
              }}
              activeOpacity={0.8}
              onLongPress={handleLongPress}
              onPressOut={handlePressOut}
              delayLongPress={100}
            >
              <Mic size={40} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
          <Text className="font-bold text-on-surface-variant tracking-wide" style={typography.bodyLgElderly}>
            {micLabel}
          </Text>
        </View>

        {/* Unbind button */}
        <TouchableOpacity
          className="absolute bottom-margin-mobile right-margin-mobile w-touch-target-min h-touch-target-min bg-secondaryContainer rounded-full items-center justify-center shadow-md"
          activeOpacity={0.7}
          onPress={handleUnbind}
        >
          <LogOut size={24} color={colors.onSecondaryContainer} />
        </TouchableOpacity>
      </View>

      {/* Processing / Speaking overlay */}
      {(state === 'PROCESSING' || state === 'SPEAKING') && (
        <View className="absolute bottom-[10vh] left-1/2 items-center" style={{ transform: [{ translateX: -60 }] }}>
          {state === 'SPEAKING' ? (
            <TouchableOpacity
              className="w-[120px] h-[120px] rounded-full items-center justify-center shadow-lg border-4 border-surface-bright"
              style={{ backgroundColor: '#c0392b' }}
              activeOpacity={0.8}
              onPress={handleStop}
            >
              <Square size={32} color={colors.onPrimary} fill={colors.onPrimary} />
              <Text className="text-on-primary font-bold mt-1" style={{ fontSize: 15 }}>停止</Text>
            </TouchableOpacity>
          ) : (
            <View className="w-[120px] h-[120px] rounded-full items-center justify-center shadow-lg border-4 border-surface-bright opacity-70" style={{ backgroundColor: colors.primary }}>
              <Text className="text-on-primary font-bold" style={{ fontSize: 15 }}>处理中</Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}
