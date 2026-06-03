import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors, typography } from '../../utils/theme';

interface VoicePlaybackToggleProps {
  enabled: boolean;
  canPlayLatest: boolean;
  onToggle: () => void;
  onPlayLatest: () => void;
}

export function VoicePlaybackToggle({
  enabled,
  canPlayLatest,
  onToggle,
  onPlayLatest,
}: VoicePlaybackToggleProps) {
  return (
    <View className="flex-row items-center justify-end gap-stack-sm">
      <TouchableOpacity
        className="min-h-touch-target-min rounded-full items-center justify-center"
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        accessibilityLabel={enabled ? '关闭语音播放' : '打开语音播放'}
        activeOpacity={0.75}
        onPress={onToggle}
      >
        <View
          className="h-9 rounded-full px-3 items-center justify-center border"
          style={{
            backgroundColor: enabled ? colors.primaryFixed : colors.surfaceContainer,
            borderColor: enabled ? colors.primaryFixedDim : colors.outlineVariant,
          }}
        >
          <Text
            className="font-semibold"
            style={[
              typography.bodyMd,
              { color: enabled ? colors.onPrimaryFixed : colors.onSurfaceVariant },
            ]}
          >
            {enabled ? '语音 开' : '语音 关'}
          </Text>
        </View>
      </TouchableOpacity>

      {!enabled && canPlayLatest ? (
        <TouchableOpacity
          className="min-h-touch-target-min rounded-full items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="播放最近一条语音"
          activeOpacity={0.75}
          onPress={onPlayLatest}
        >
          <View
            className="h-9 rounded-full px-3 items-center justify-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="font-semibold" style={[typography.bodyMd, { color: colors.onPrimary }]}>
              播放
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
