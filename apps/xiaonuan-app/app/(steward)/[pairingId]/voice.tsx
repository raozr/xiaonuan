import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalSearchParams } from 'expo-router';
import { Mic } from 'lucide-react-native';
import { TopAppBar } from '../../../src/components/shared/TopAppBar';
import { colors, typography } from '../../../src/utils/theme';
import { useAuthStore } from '../../../src/store/auth-store';
import { useVoice } from '../../../src/hooks/useVoice';
import { createVoiceClone, getVoiceCloneList } from '../../../src/services/voice-clone';

type RecordingStatus = 'idle' | 'recording' | 'uploading' | 'completed';

interface ExistingClone {
  voiceId: string;
  status: string;
  createdAt: string;
}

const SAMPLE_TEXT = '早上好，昨晚睡得怎么样？今天天气不错，适合出去走走。记得按时吃药，中午给你带了你最喜欢的红烧鱼。';

export default function VoiceTab() {
  const { pairingId } = useGlobalSearchParams<{ pairingId: string }>();
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const voice = useVoice();

  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [existingClone, setExistingClone] = useState<ExistingClone | null>(null);
  const [loading, setLoading] = useState(true);
  const durationTimer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing clone on mount
  useEffect(() => {
    if (!token || !pairingId) return;
    (async () => {
      try {
        setLoading(true);
        const result = await getVoiceCloneList(token, pairingId);
        if (result.data && result.data.length > 0) {
          // Get the most recent READY clone
          const ready = result.data.find((c) => c.status === 'READY');
          if (ready) setExistingClone(ready);
        }
      } catch (err) {
        console.error('[VoiceClone] load existing failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, pairingId]);

  const startTimer = () => {
    setRecordingDuration(0);
    durationTimer.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePressIn = async () => {
    if (status === 'uploading') return;
    setError(null);
    try {
      await voice.startRecording();
      setStatus('recording');
      startTimer();
    } catch (err) {
      console.error('[VoiceClone] 开始录音失败:', err);
      setError('无法开始录音，请检查麦克风权限');
    }
  };

  const handlePressOut = async () => {
    if (status !== 'recording') return;
    stopTimer();
    try {
      await voice.stopRecording();
      setStatus('uploading');

      const base64 = await voice.getRecordingBase64();
      if (!base64) {
        setError('未获取到录音文件');
        setStatus('idle');
        return;
      }

      if (!token || !pairingId) {
        setError('缺少认证信息');
        setStatus('idle');
        return;
      }

      const result = await createVoiceClone(token, pairingId, base64, 'sample.mp3');
      if (result.voiceId) {
        setExistingClone({
          voiceId: result.voiceId,
          status: 'READY',
          createdAt: new Date().toISOString(),
        });
      }
      setStatus('completed');
    } catch (err) {
      console.error('[VoiceClone] 上传失败:', err);
      setError('上传失败，请重试');
      setStatus('idle');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setError(null);
    setRecordingDuration(0);
  };

  const micButtonColor =
    status === 'recording'
      ? colors.error
      : status === 'completed'
      ? colors.surfaceContainerHigh
      : colors.primary;

  const micIconColor =
    status === 'recording'
      ? colors.onError
      : status === 'completed'
      ? colors.onSurfaceVariant
      : colors.onPrimary;

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="声音" showBack />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          alignItems: 'center',
        }}
      >
        {/* 说明文字 */}
        <Text className="text-on-surface-variant text-center mb-stack-lg" style={typography.bodyMd}>
          录制一段语音，让小暖用你的声音说话。{'\n'}
          这能创造更熟悉、温暖的陪伴体验。
        </Text>

        {/* 朗读文案卡片 */}
        <View
          className="w-full p-stack-lg mb-stack-lg rounded-2xl"
          style={{
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
            borderWidth: 1,
          }}
        >
          <Text className="text-center text-on-surface font-semibold leading-relaxed mb-stack-sm" style={typography.bodyLg}>
            请清晰朗读以下内容：
          </Text>
          <Text
            className="text-center leading-loose px-2"
            style={{ ...typography.bodyLgElderly, color: colors.onSurface, fontStyle: 'italic' }}
          >
            {SAMPLE_TEXT}
          </Text>
        </View>

        {/* 录音状态 */}
        <View className="items-center mb-stack-lg">
          <Text className="text-on-surface-variant" style={typography.bodyMd}>
            {status === 'idle' && (existingClone ? '已有声音克隆，点击按钮重新录制' : '点击下方按钮开始录音')}
            {status === 'recording' && `录音中 ${formatDuration(recordingDuration)}`}
            {status === 'uploading' && '上传中...'}
            {status === 'completed' && '声音克隆完成'}
          </Text>
          {error && (
            <Text className="text-error mt-2" style={typography.bodySm}>
              {error}
            </Text>
          )}
        </View>

        {/* 录音按钮 */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={status === 'uploading' || status === 'completed'}
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: micButtonColor,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
            opacity: status === 'uploading' ? 0.5 : 1,
          }}
        >
          <Mic size={32} color={micIconColor} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
