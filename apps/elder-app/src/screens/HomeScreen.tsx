import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Alert,
  ToastAndroid,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Mic, Square, LogOut } from 'lucide-react-native';
import { useWebSocket, type WebSocketMessage } from '../hooks/useWebSocket';
import { useVoice } from '../hooks/useVoice';

interface HomeScreenProps {
  token: string;
  pairingId: string;
  onUnbind: () => void;
}

type InteractionState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';

// 生产构建强制使用线上地址，避免环境变量未注入导致回退到本地地址
const API_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.31:3000')
  : 'https://www.quirklabs.top/xiaonuan';
const WS_URL = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws') + '/ws';
const MIN_RECORDING_MS = 500;

export function HomeScreen({ token, pairingId, onUnbind }: HomeScreenProps) {
  const [state, setState] = useState<InteractionState>('IDLE');
  const [aiText, setAiText] = useState('您好，我是小暖，想和我聊聊吗？');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pressStartTime = useRef<number>(0);
  const sessionReadyRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const lastAudioUrlRef = useRef<string | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isRecording, isPlaying, playError, hasPermission, requestPermission, startRecording, stopRecording, playAudio, stopAudio, getRecordingBase64 } = useVoice();

  // 页面挂载时预请求麦克风权限，避免在长按交互过程中弹窗打断触摸事件流
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    console.log('[HomeScreen] handleMessage:', msg.type, msg.payload);
    if (msg.type === 'session:created' || msg.type === 'session:resumed') {
      sessionReadyRef.current = true;
      console.log('[HomeScreen] Session ready');
    } else if (msg.type === 'message:ai_text') {
      const rawText = msg.payload.text as string;
      // 防御性清理：移除 LLM 思考过程标签，避免暴露内部推理
      const cleanText = rawText
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .trim();
      setAiText(cleanText);
    } else if (msg.type === 'ai:audio') {
      const url = msg.payload.url as string;
      if (lastAudioUrlRef.current === url) {
        console.log('[HomeScreen] Skip duplicate audio:', url);
        return;
      }
      lastAudioUrlRef.current = url;
      setState('SPEAKING');
      playAudio(url);
    } else if (msg.type === 'error') {
      console.error('[HomeScreen] Server error:', msg.payload);
      if (msg.payload.code === 401) {
        Alert.alert('身份过期', '请重新绑定', [{ text: '确定', onPress: onUnbind }]);
      } else {
        Alert.alert('提示', msg.payload.message || '处理失败');
        setState('IDLE');
      }
    }
  }, [onUnbind, playAudio]);

  const { isConnected, sendMessage } = useWebSocket(WS_URL, token, handleMessage);

  useEffect(() => {
    if (!isConnected && wasConnectedRef.current) {
      sessionReadyRef.current = false;
      console.log('[HomeScreen] Connection lost, resetting session ready');
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
          console.warn('[HomeScreen] Playback timeout, resetting state');
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
      console.warn('[HomeScreen] Audio playback failed, resetting state');
      setState('IDLE');
    }
  }, [state, playError]);

  useEffect(() => {
    if (state === 'LISTENING' || state === 'SPEAKING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state, pulseAnim]);

  async function handleLongPress() {
    if (!isConnected) {
      Alert.alert('网络未连接', '正在尝试连接小暖...');
      return;
    }

    // 确保有麦克风权限；若之前被拒绝（未勾选"不再询问"），再次弹框给用户授权机会
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

    // 若录音尚未实际开始（如权限弹窗导致 onPressOut 提前触发），直接清理状态
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
    console.log('[HomeScreen] Recorded audio URI:', uri);

    // Wait for session ready (max 3s)
    let waited = 0;
    while (!sessionReadyRef.current && waited < 3000) {
      await new Promise((r) => setTimeout(r, 100));
      waited += 100;
    }

    // If still not ready, try to create session again
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

    // Read audio file as base64 and send
    const base64 = await getRecordingBase64();
    if (!base64) {
      Alert.alert('提示', '读取录音失败，请重试');
      setState('IDLE');
      return;
    }

    console.log('[HomeScreen] Sending voice audio, base64 length:', base64.length);
    const sent = sendMessage('message:voice_audio', { audioBase64: base64 });
    if (!sent) {
      Alert.alert('提示', '网络断开，请重试');
      setState('IDLE');
      return;
    }
    // Remain in PROCESSING until server responds with ai:audio or error
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
        { text: '确定退出', style: 'destructive', onPress: onUnbind },
      ]
    );
  }

  const headerTitle = !isConnected
    ? '连接中...'
    : state === 'IDLE'
    ? '小暖的陪伴'
    : state === 'LISTENING'
    ? '正在倾听...'
    : state === 'PROCESSING'
    ? '小暖思考中...'
    : '小暖正在说...';

  const micLabel = state === 'LISTENING' ? '松开 发送' : '按住 说话';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleUnbind} activeOpacity={0.7}>
            <LogOut size={24} color="#8f4e00" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Avatar Area */}
        <View style={styles.avatarContainer}>
          <View style={styles.outerRing} />
          <View style={styles.middleRing} />
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
                opacity: state === 'LISTENING' ? 0.45 : state === 'SPEAKING' ? 0.35 : 0.15,
                backgroundColor: state === 'SPEAKING' ? '#4CAF50' : '#ff9f43',
              },
            ]}
          />
          <View style={styles.avatar}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.avatarImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* AI Text Bubble - always visible */}
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{aiText}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {state === 'SPEAKING' ? (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.micButton, styles.stopButtonMain]}
            onPress={handleStop}
          >
            <Square size={32} color="#FFF" fill="#FFF" />
            <Text style={styles.micButtonText}>停止</Text>
          </TouchableOpacity>
        ) : state === 'PROCESSING' ? (
          <View style={[styles.micButton, styles.processingButton]}>
            <ActivityIndicator size="large" color="#FFF" />
            <Text style={styles.micButtonText}>处理中</Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.micButton,
              state === 'LISTENING' && styles.micButtonActive,
            ]}
            onLongPress={handleLongPress}
            onPressOut={handlePressOut}
            delayLongPress={100}
          >
            <Mic size={40} color="#FFF" />
            <Text style={styles.micButtonText}>{micLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff8f5',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: '#fff8f5',
  },
  headerLeft: {
    width: 64,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ff9f43',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#8f4e00',
    textAlign: 'center',
    flex: 1,
  },
  headerRight: {
    width: 64,
    height: 64,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  avatarContainer: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  outerRing: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 159, 67, 0.12)',
  },
  middleRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255, 159, 67, 0.22)',
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#ff9f43',
  },
  avatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#f0dfd5',
    overflow: 'hidden',
    shadowColor: '#8f4e00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  bubble: {
    backgroundColor: '#fcebe0',
    borderRadius: 20,
    padding: 20,
    marginTop: 12,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bubbleText: {
    fontSize: 20,
    lineHeight: 30,
    color: '#221a13',
    textAlign: 'center',
    fontWeight: '500',
  },
  footer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 32,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#8f4e00',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8f4e00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#fff8f5',
  },
  micButtonActive: {
    backgroundColor: '#6d3a00',
    transform: [{ scale: 1.08 }],
  },
  stopButtonMain: {
    backgroundColor: '#c0392b',
    shadowColor: '#c0392b',
  },
  processingButton: {
    backgroundColor: '#8f4e00',
    opacity: 0.7,
  },
  micButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 6,
    letterSpacing: 0.5,
  },
});
