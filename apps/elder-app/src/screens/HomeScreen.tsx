import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import { Mic, X, Volume2 } from 'lucide-react-native';
import { useWebSocket } from '../hooks/useWebSocket';
import { useVoice } from '../hooks/useVoice';

interface HomeScreenProps {
  token: string;
  familyId: string;
  onUnbind: () => void;
}

type InteractionState = 'IDLE' | 'LISTENING' | 'SPEAKING';

const WS_URL = 'ws://localhost:3000/ws';
const MIN_RECORDING_MS = 500;

export function HomeScreen({ token, familyId, onUnbind }: HomeScreenProps) {
  const [state, setState] = useState<InteractionState>('IDLE');
  const [aiText, setAiText] = useState('您好，我是小暖，想和我聊聊吗？');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pressStartTime = useRef<number>(0);

  const { isConnected, lastMessage, sendMessage } = useWebSocket(WS_URL, token);
  const { isRecording, isPlaying, startRecording, stopRecording, playAudio, stopAudio } = useVoice();

  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'session:created' || lastMessage.type === 'session:resumed') {
        // Session ready
      } else if (lastMessage.type === 'ai:text') {
        setAiText(lastMessage.payload.text);
      } else if (lastMessage.type === 'ai:audio') {
        setState('SPEAKING');
        playAudio(lastMessage.payload.url);
      } else if (lastMessage.type === 'error') {
        if (lastMessage.payload.code === 401) {
          Alert.alert('身份过期', '请重新绑定', [{ text: '确定', onPress: onUnbind }]);
        }
      }
    }
  }, [lastMessage, onUnbind, playAudio]);

  useEffect(() => {
    if (!isPlaying && state === 'SPEAKING') {
      setState('IDLE');
    }
  }, [isPlaying, state]);

  useEffect(() => {
    if (state === 'LISTENING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
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
    await startRecording();
    sendMessage('session:create', {});
  }

  async function handlePressOut() {
    if (state !== 'LISTENING') return;

    const duration = Date.now() - pressStartTime.current;
    setState('IDLE');
    const uri = await stopRecording();

    if (duration < MIN_RECORDING_MS) {
      const msg = '说话时间太短';
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        Alert.alert('提示', msg);
      }
      return;
    }

    // TODO: integrate real ASR using uri
    console.log('[HomeScreen] Recorded audio URI:', uri);
    sendMessage('message:voice_text', { text: '模拟语音识别内容' });
  }

  function handleStop() {
    if (state === 'SPEAKING') {
      stopAudio();
    }
    setState('IDLE');
    stopRecording();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.statusText}>
          {!isConnected ? '连接中...' : state === 'IDLE' ? '正在陪伴中' : state === 'LISTENING' ? '正在倾听...' : '小暖正在说...'}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <Animated.View style={[styles.avatarPulse, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>Warm</Text>
          </View>
        </View>

        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{aiText}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        {state !== 'IDLE' && (
          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <X size={32} color="#FFF" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.micButton,
            state === 'LISTENING' && styles.micButtonActive,
            state === 'SPEAKING' && styles.micButtonSpeaking,
          ]}
          onLongPress={handleLongPress}
          onPressOut={handlePressOut}
          delayLongPress={100}
        >
          {state === 'SPEAKING' ? (
            <Volume2 size={48} color="#FFF" />
          ) : (
            <Mic size={48} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 18,
    color: '#ADB5BD',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  avatarContainer: {
    width: 160,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  avatarEmoji: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
  },
  avatarPulse: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  bubble: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  bubbleText: {
    fontSize: 24,
    lineHeight: 36,
    color: '#212529',
    textAlign: 'center',
  },
  footer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  micButtonActive: {
    backgroundColor: '#51CF66',
    shadowColor: '#51CF66',
  },
  micButtonSpeaking: {
    backgroundColor: '#339AF0',
    shadowColor: '#339AF0',
  },
  stopButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DEE2E6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 40,
  },
});
