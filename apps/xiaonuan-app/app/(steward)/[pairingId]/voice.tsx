import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, Check, RefreshCw, RotateCcw } from 'lucide-react-native';
import { TopAppBar } from '../../../src/components/shared/TopAppBar';
import { Card } from '../../../src/components/ui/Card';
import { colors, typography } from '../../../src/utils/theme';

interface VoiceSample {
  id: number;
  label: string;
  phrase: string;
  status: 'completed' | 'active' | 'pending';
  duration?: string;
}

const mockSamples: VoiceSample[] = [
  { id: 1, label: '第一段', phrase: '"早上好！昨晚睡得好吗？今天天气真不错。"', status: 'completed', duration: '00:15' },
  { id: 2, label: '第二段', phrase: '"该吃午饭了，今天有你最喜欢的红烧鱼。"', status: 'active' },
  { id: 3, label: '第三段', phrase: '"下午要不要一起去公园散步？"', status: 'pending' },
];

function SampleStep({ sample }: { sample: VoiceSample }) {
  const isCompleted = sample.status === 'completed';
  const isActive = sample.status === 'active';
  const isPending = sample.status === 'pending';

  return (
    <View className="flex-row items-start gap-stack-md relative z-10">
      <View
        className="w-12 h-12 rounded-full items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: isCompleted ? colors.primary : isActive ? colors.primaryContainer : colors.surfaceContainerHigh,
          borderColor: isActive ? colors.primary : 'transparent',
          borderWidth: isActive ? 2 : 0,
        }}
      >
        {isCompleted ? (
          <Check size={20} color={colors.onPrimary} />
        ) : (
          <Text
            className="font-bold"
            style={{ fontSize: 18, color: isPending ? colors.onSurfaceVariant : colors.onPrimaryContainer }}
          >
            {sample.id}
          </Text>
        )}
      </View>
      <View className="flex-1 pt-stack-sm">
        <Text
          className="font-semibold"
          style={{
            ...typography.bodyMd,
            color: isPending ? colors.onSurfaceVariant : colors.onSurface,
          }}
        >
          {sample.label}
        </Text>
        {isActive && (
          <>
            <Text className="text-on-surface-variant mt-1 mb-stack-sm" style={typography.bodyMd}>
              请清晰朗读以下内容：
            </Text>
            <View
              className="p-stack-md rounded-lg mb-stack-md"
              style={{
                backgroundColor: colors.surfaceContainer,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
              }}
            >
              <Text className="italic" style={{ ...typography.bodyLgElderly, color: colors.onSurface }}>
                {sample.phrase}
              </Text>
            </View>
            <View className="flex-row items-center gap-stack-md">
              <TouchableOpacity
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.error }}
                activeOpacity={0.8}
              >
                <Mic size={28} color={colors.onError} fill={colors.onError} />
              </TouchableOpacity>
              <Text className="text-error font-semibold" style={typography.bodyMd}>
                点击录音
              </Text>
            </View>
          </>
        )}
        {isCompleted && (
          <View className="flex-row items-center gap-stack-sm mt-1">
            <Text className="text-on-surface-variant" style={typography.bodyMd}>
              已完成 ({sample.duration})
            </Text>
            <TouchableOpacity className="flex-row items-center gap-1" activeOpacity={0.7}>
              <RefreshCw size={16} color={colors.primary} />
              <Text className="text-primary font-semibold" style={typography.bodyMd}>
                重新录制
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {isPending && (
          <Text className="text-on-surface-variant mt-1" style={typography.bodyMd}>
            等待中
          </Text>
        )}
      </View>
    </View>
  );
}

export default function VoiceTab() {
  const [samples] = useState<VoiceSample[]>(mockSamples);
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="声音克隆" showBack />
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Header */}
        <View className="mb-stack-lg">
          <Text className="text-on-surface-variant" style={typography.bodyMd}>
            录制几段简短的语音，让小暖用你的声音说话。这能创造更熟悉、温暖的陪伴体验。
          </Text>
        </View>

        {/* Voice Cloning Steps Card */}
        <Card className="p-stack-lg">
          <View className="flex-col gap-stack-lg mb-2 relative" style={{ minHeight: 340 }}>
            <View
              className="absolute w-0.5 bg-surfaceContainerHighest z-0"
              style={{ left: 24, top: 24, bottom: 48 }}
            />
            {samples.map((sample) => (
              <SampleStep key={sample.id} sample={sample} />
            ))}
          </View>
        </Card>

        {/* Restart Button */}
        <View className="flex-row items-center justify-center mt-stack-lg mb-gutter">
          <TouchableOpacity
            className="flex-row items-center gap-stack-sm border border-outline rounded-full px-stack-md py-stack-sm"
            activeOpacity={0.7}
          >
            <RotateCcw size={20} color={colors.primary} />
            <Text className="text-primary font-semibold" style={typography.bodyMd}>
              重新开始
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
