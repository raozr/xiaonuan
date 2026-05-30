import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ToastAndroid,
  Platform,
  Image,
  ScrollView,
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
  const [state, setState] = useState<'IDLE' | 'LISTENING' | 'PROCESSING' | 'RESPONDING' | 'SPEAKING'>('IDLE');
  const [aiText, setAiText] = useState('您好，想和我聊聊吗？');
  const sessionReadyRef = useRef(false);
  const sessionCreateSentRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const lastAudioUrlRef = useRef<string | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartTime = useRef<number>(0);

  // Reanimated shared values
  const breatheScale = useSharedValue(1);
  const pulseScale = useSharedValue(0.8);
  const pulseOpacity = useSharedValue(0.8);
  const speakHaloScale = useSharedValue(1);
  const speakHaloOpacity = useSharedValue(0);
  const processingHaloScale = useSharedValue(1);
  const processingHaloOpacity = useSharedValue(0);

  const { isRecording, isPlaying, playError, hasPermission, requestPermission, startRecording, stopRecording, playAudio, stopAudio, getRecordingBase64 } = useVoice();

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Breathing animation
  useEffect(() => {
    if (state === 'LISTENING' || state === 'SPEAKING' || state === 'PROCESSING') {
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

    if (state === 'SPEAKING') {
      cancelAnimation(speakHaloScale);
      cancelAnimation(speakHaloOpacity);
      speakHaloScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1500 }),
          withTiming(1.0, { duration: 1500 })
        ),
        -1
      );
      speakHaloOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1500 }),
          withTiming(0.2, { duration: 1500 })
        ),
        -1
      );
    } else {
      cancelAnimation(speakHaloScale);
      cancelAnimation(speakHaloOpacity);
      speakHaloScale.value = withTiming(1, { duration: 300 });
      speakHaloOpacity.value = withTiming(0, { duration: 300 });
    }

    if (state === 'PROCESSING') {
      cancelAnimation(processingHaloScale);
      cancelAnimation(processingHaloOpacity);
      processingHaloScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1.0, { duration: 800 })
        ),
        -1
      );
      processingHaloOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(0.1, { duration: 800 })
        ),
        -1
      );
    } else {
      cancelAnimation(processingHaloScale);
      cancelAnimation(processingHaloOpacity);
      processingHaloScale.value = withTiming(1, { duration: 300 });
      processingHaloOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [state, breatheScale, speakHaloScale, speakHaloOpacity, processingHaloScale, processingHaloOpacity]);

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
      sessionCreateSentRef.current = false;
    } else if (msg.type === 'message:ai_text') {
      const rawText = msg.payload.text as string;
      const cleanText = rawText
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .trim();
      setAiText(cleanText);
      setState('RESPONDING');
    } else if (msg.type === 'ai:audio') {
      const url = msg.payload.url as string;
      if (lastAudioUrlRef.current === url) return;
      lastAudioUrlRef.current = url;
      setState('SPEAKING');
      playAudio(url);
    } else if (msg.type === 'ai:audio_unavailable') {
      setState('IDLE');
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
    : state === 'RESPONDING'
    ? '准备播放...'
    : '正在说...';

  const micLabel = state === 'LISTENING' ? '松开发送' : '按住说话';

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
  }));

  const speakHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: speakHaloScale.value }],
    opacity: speakHaloOpacity.value,
  }));

  const processingHaloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: processingHaloScale.value }],
    opacity: processingHaloOpacity.value,
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
      <View className="flex-1 px-gutter pt-4 pb-8 justify-between items-center relative">
        {/* Ambient glow */}
        <View className="absolute inset-0" style={{ backgroundColor: 'transparent' }} />

        {/* Top: Mascot */}
        <View className="w-full items-center justify-center my-6 relative">
          {/* Listening Halo */}
          {state === 'LISTENING' && (
            <Animated.View
              style={[
                { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: colors.primaryContainer },
                pulseStyle
              ]}
            />
          )}
          {/* Speaking Halo */}
          {state === 'SPEAKING' && (
            <Animated.View
              style={[
                { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: colors.primaryFixed },
                speakHaloStyle
              ]}
            />
          )}
          {/* Processing Halo */}
          {state === 'PROCESSING' && (
            <Animated.View
              style={[
                { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: colors.secondaryContainer },
                processingHaloStyle
              ]}
            />
          )}
          <Animated.View
            style={[
              { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', zIndex: 10 },
              breatheStyle
            ]}
          >
            <Image
              source={require('../../assets/logo-smalll.jpg')}
              className="w-full h-full"
              resizeMode="cover"
            />
          </Animated.View>
        </View>

        {/* Middle: AI Text Bubble (Scrollable) */}
        <View className="flex-1 w-full items-center justify-center mb-6 mt-4">
          <View className="w-full max-w-[340px] flex-1 max-h-[100%] bg-white rounded-[32px] p-6 border border-surfaceContainerHigh" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
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
          </View>
        </View>

        {/* Bottom: Actions Container */}
        <View className="w-full h-[160px] items-center justify-center relative">
          {(state === 'PROCESSING' || state === 'RESPONDING' || state === 'SPEAKING') ? (
            <View className="items-center">
              {state === 'SPEAKING' ? (
                <TouchableOpacity
                  className="w-[120px] h-[120px] rounded-full items-center justify-center border-4 border-surface-bright"
                  style={{ backgroundColor: '#c0392b' }}
                  activeOpacity={0.8}
                  onPress={handleStop}
                >
                  <Square size={32} color={colors.onPrimary} fill={colors.onPrimary} />
                  <Text className="text-on-primary font-bold mt-1" style={{ fontSize: 16 }}>停止</Text>
                </TouchableOpacity>
              ) : (
                <View className="w-[120px] h-[120px] rounded-full items-center justify-center border-4 border-surface-bright opacity-70" style={{ backgroundColor: colors.primary }}>
                  <Text className="text-on-primary font-bold" style={{ fontSize: 16 }}>
                    {state === 'RESPONDING' ? '回应中' : '处理中'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View className="items-center gap-stack-md">
              <View className="relative items-center justify-center">
                {/* Pulse ring */}
                <Animated.View
                  style={[
                    { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: colors.primaryContainer },
                    pulseStyle
                  ]}
                />
                <TouchableOpacity
                  className="w-[120px] h-[120px] rounded-full items-center justify-center border-4 border-surface-bright"
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
          )}
        </View>

        {/* Unbind button */}
        <TouchableOpacity
          className="absolute bottom-8 right-0 w-touch-target-min h-touch-target-min bg-surfaceContainerHigh rounded-full items-center justify-center"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
          activeOpacity={0.7}
          onPress={handleUnbind}
        >
          <LogOut size={20} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
