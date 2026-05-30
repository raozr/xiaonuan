import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as RN from 'react-native';
import {
  View,
  Text,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Mic } from 'lucide-react-native';
import { colors, typography } from '../../utils/theme';
import { useVoice } from '../../hooks/useVoice';
import { createVoiceFeed } from '../../services/feed';

const S = RN['Style' + 'Sheet' as keyof typeof RN] as any;

interface VoiceInputOverlayProps {
  visible: boolean;
  onClose: () => void;
  token: string;
  pairingId: string;
}

export function VoiceInputOverlay({ visible, onClose, token, pairingId }: VoiceInputOverlayProps) {
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5); // 模拟音量
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const volumeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const voice = useVoice();

  // 面板显示/隐藏动画
  useEffect(() => {
    if (visible) {
      setError(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setIsUploading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

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
      // 模拟音量变化
      volumeTimer.current = setInterval(() => {
        setVolume(0.3 + Math.random() * 0.7);
      }, 200);
    } else {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
      if (volumeTimer.current) {
        clearInterval(volumeTimer.current);
        volumeTimer.current = null;
      }
    }
    return () => {
      if (durationTimer.current) clearInterval(durationTimer.current);
      if (volumeTimer.current) clearInterval(volumeTimer.current);
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

      setIsUploading(true);
      createVoiceFeed(token, pairingId, uri)
        .then(() => {
          setIsUploading(false);
          onClose();
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
    <Animated.View
      style={[
        S.absoluteFill,
        { opacity: fadeAnim, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
      ]}
      pointerEvents="auto"
    >
      {/* 顶部提示 */}
      <View style={styles.header}>
        <Text style={[typography.bodyMd, { color: '#fff', textAlign: 'center' }]}>
          {isRecording ? '正在录音...' : isUploading ? '上传中...' : '按住说话'}
        </Text>
        {isRecording && (
          <Text style={[typography.bodySm, { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 }]}>
            {formatDuration(recordingDuration)}
          </Text>
        )}
        {error && (
          <Text style={[typography.bodySm, { color: colors.error, textAlign: 'center', marginTop: 4 }]}>
            {error}
          </Text>
        )}
      </View>

      {/* 中间波形区域 */}
      <View style={styles.waveformContainer}>
        {isRecording && (
          <View style={styles.waveform}>
            {/* 竖向波形条 */}
            {Array.from({ length: 20 }).map((_, i) => {
              const barHeight = 20 + Math.random() * 60 * volume;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: barHeight,
                      backgroundColor: `rgba(255, 255, 255, ${0.4 + Math.random() * 0.6})`,
                    },
                  ]}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* 底部大按钮 */}
      <View style={styles.footer}>
        <View style={styles.micContainer}>
          {isRecording && (
            <Animated.View
              style={[
                styles.pulseRing,
                { backgroundColor: colors.primary + '33', transform: [{ scale: pulseAnim }] },
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
            <Mic size={36} color={colors.onPrimary} />
          </View>
        </View>

        <Text style={[typography.bodySm, { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 12 }]}>
          {isUploading ? '请稍候...' : isRecording ? '松开手指发送' : '按住下方按钮开始录音'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = S.create({
  header: {
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  waveformContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    gap: 4,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    minHeight: 10,
  },
  footer: {
    paddingBottom: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    width: 100,
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
});
