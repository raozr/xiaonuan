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
import { Mic, Square } from 'lucide-react-native';
import { useWebSocket, type WebSocketMessage } from '../hooks/useWebSocket';
import { useVoice } from '../hooks/useVoice';

interface HomeScreenProps {
  token: string;
  familyId: string;
  onUnbind: () => void;
}

type InteractionState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';

const WS_URL = 'ws://192.168.4.70:3000/ws';
const MIN_RECORDING_MS = 500;

export function HomeScreen({ token, familyId, onUnbind }: HomeScreenProps) {
  const [state, setState] = useState<InteractionState>('IDLE');
  const [aiText, setAiText] = useState('您好，我是小暖，想和我聊聊吗？');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pressStartTime = useRef<number>(0);
  const sessionReadyRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const { isRecording, isPlaying, startRecording, stopRecording, playAudio, stopAudio, getRecordingBase64 } = useVoice();

  const handleMessage = useCallback((msg: WebSocketMessage) => {
    console.log('[HomeScreen] handleMessage:', msg.type, msg.payload);
    if (msg.type === 'session:created' || msg.type === 'session:resumed') {
      sessionReadyRef.current = true;
      console.log('[HomeScreen] Session ready');
    } else if (msg.type === 'message:ai_text') {
      setAiText(msg.payload.text);
    } else if (msg.type === 'ai:audio') {
      setState('SPEAKING');
      playAudio(msg.payload.url);
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
    if (wasPlayingRef.current && !isPlaying && state === 'SPEAKING') {
      setState('IDLE');
    }
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, state]);

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
    pressStartTime.current = Date.now();
    setState('LISTENING');
    if (!sessionReadyRef.current) {
      sendMessage('session:create', {});
    }
    await startRecording();
  }

  async function handlePressOut() {
    if (state !== 'LISTENING') return;

    const duration = Date.now() - pressStartTime.current;
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
    sendMessage('message:voice_audio', { audioBase64: base64 });
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
        <Text style={styles.headerTitle}>{headerTitle}</Text>
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
    justifyContent: 'center',
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
