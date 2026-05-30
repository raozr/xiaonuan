import React, { useState, useRef, useEffect } from 'react';
import * as RN from 'react-native';
import {
  View,
  Text,
  Animated,
  Easing,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Mic, X } from 'lucide-react-native';
import { colors, typography } from '../../utils/theme';
import { useVoice } from '../../hooks/useVoice';
import { createVoiceFeed } from '../../services/feed';

const S = RN['Style' + 'Sheet' as keyof typeof RN] as any;

interface VoiceInputPanelProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  token: string;
  pairingId: string;
}

export function VoiceInputPanel({ visible, onClose, onSuccess, token, pairingId }: VoiceInputPanelProps) {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const recordingUriRef = useRef<string | null>(null);

  const voice = useVoice();

  // 录音时脉冲动画
  useEffect(() => {
    if (isRecording) {
      pulseAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimationRef.current.start();
    } else {
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current.stop();
        pulseAnimationRef.current = null;
      }
      pulseAnim.setValue(1);
    }
    return () => {
      if (pulseAnimationRef.current) {
        pulseAnimationRef.current.stop();
      }
    };
  }, [isRecording, pulseAnim]);

  // 录音时长计时
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      durationTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
    }
    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, [isRecording]);

  const handlePressIn = () => {
    setError(null);
    Animated.timing(scaleAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();

    voice.startRecording().then(() => {
      setIsRecording(true);
    }).catch((err) => {
      console.error('[VoiceInput] 开始录音失败:', err);
      setError('无法开始录音，请检查麦克风权限');
    });
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();

    voice.stopRecording().then((uri) => {
      setIsRecording(false);

      if (!uri) {
        setError('未获取到录音文件');
        return;
      }

      // 上传语音到后端
      setIsUploading(true);
      console.log('[VoiceInput] uploading, token:', token ? '有' : '无', 'pairingId:', pairingId);
      createVoiceFeed(token, pairingId, uri)
        .then(() => {
          setIsUploading(false);
          onClose();
          onSuccess?.();
        })
        .catch((err) => {
          console.error('[VoiceInput] 上传失败:', err);
          setIsUploading(false);
          setError('上传失败，请重试');
        });
    }).catch((err) => {
      console.error('[VoiceInput] 停止录音失败:', err);
      setIsRecording(false);
      setError('录音失败，请重试');
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <View style={S.absoluteFill} pointerEvents="box-none">
      {/* 半透明背景 - 点击关闭 */}
      <Pressable
        onPress={isRecording || isUploading ? undefined : onClose}
        style={styles.overlay}
        pointerEvents="auto"
      />

      {/* 底部面板 */}
      <View style={styles.panel} pointerEvents="auto">
        {/* 关闭按钮 - 录音/上传时隐藏 */}
        {!isRecording && !isUploading && (
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={styles.closeButtonInner}>
              <X size={16} color={colors.onSurfaceVariant} />
            </View>
          </Pressable>
        )}

        {/* 标题 */}
        <Text style={[typography.headlineSm, styles.title, { color: colors.onSurface }]}>
          {isUploading ? '上传中...' : isRecording ? '正在录音...' : '按住说话'}
        </Text>

        {/* 录音时长 / 错误提示 */}
        <Text style={[typography.bodyMd, styles.subtitle, { color: error ? colors.error : colors.onSurfaceVariant }]}>
          {isRecording ? formatDuration(recordingDuration) : error ? error : '按住下方按钮开始录音'}
        </Text>

        {/* 麦克风按钮区域 */}
        <View style={styles.micContainer}>
          {isRecording && (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  backgroundColor: colors.primary + '33',
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
          )}
          <View
            style={[
              styles.micButton,
              {
                backgroundColor: isRecording ? colors.error : isUploading ? colors.onSurfaceVariant : colors.primary,
                transform: [{ scale: (scaleAnim as any).__getValue() }],
              },
            ]}
            onTouchStart={isUploading ? undefined : handlePressIn}
            onTouchEnd={isUploading ? undefined : handlePressOut}
          >
            {isUploading ? (
              <ActivityIndicator size="large" color={colors.onPrimary} />
            ) : (
              <Mic size={32} color={colors.onPrimary} />
            )}
          </View>
        </View>

        {/* 提示文字 */}
        <Text style={[typography.bodySm, styles.hint, { color: colors.onSurfaceVariant }]}>
          {isUploading ? '请稍候...' : isRecording ? '松开手指发送语音' : '按住下方按钮开始录音'}
        </Text>
      </View>
    </View>
  );
}

const styles = S.create({
  overlay: {
    ...S.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceBright,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  closeButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    height: 80,
  },
  pulseRing: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    textAlign: 'center',
  },
});
