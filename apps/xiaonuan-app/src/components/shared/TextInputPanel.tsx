import React, { useState, useEffect, useRef } from 'react';
import * as RN from 'react-native';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
} from 'react-native';
import { Send, X } from 'lucide-react-native';
import { colors, typography } from '../../utils/theme';

const S = RN['Style' + 'Sheet' as keyof typeof RN] as any;

interface TextInputPanelProps {
  visible: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}

export function TextInputPanel({ visible, onClose, onSend }: TextInputPanelProps) {
  const [text, setText] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      setText('');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onSend(trimmed);
      setText('');
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <View style={S.absoluteFill} pointerEvents="box-none">
      {/* 半透明背景 */}
      <Pressable
        onPress={onClose}
        style={styles.overlay}
        pointerEvents="auto"
      />

      {/* 居中面板 - 不会被键盘遮挡 */}
      <Animated.View
        style={[
          styles.panel,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
        pointerEvents="auto"
      >
        {/* 关闭按钮 */}
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <View style={styles.closeButtonInner}>
            <X size={16} color={colors.onSurfaceVariant} />
          </View>
        </Pressable>

        {/* 标题 */}
        <Text style={[typography.headlineSm, styles.title, { color: colors.onSurface }]}>
          写留言
        </Text>

        {/* 输入框 */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, typography.bodyMd, { color: colors.onSurface }]}
            placeholder="记录一下TA的日常、爱好或近况..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        </View>

        {/* 发送按钮 */}
        <Pressable
          onPress={handleSend}
          disabled={!text.trim()}
          style={[
            styles.sendButton,
            {
              backgroundColor: text.trim() ? colors.primary : colors.surfaceContainerHigh,
              opacity: text.trim() ? 1 : 0.5,
            },
          ]}
        >
          <Send size={20} color={text.trim() ? colors.onPrimary : colors.onSurfaceVariant} />
        </Pressable>
      </Animated.View>
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
    top: '20%',
    left: 20,
    right: 20,
    backgroundColor: colors.surfaceBright,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    maxHeight: '60%',
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
    marginBottom: 16,
  },
  inputContainer: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    minHeight: 120,
  },
  input: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
