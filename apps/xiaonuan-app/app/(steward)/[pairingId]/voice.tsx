import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Mic, Check, RefreshCw, RotateCcw } from 'lucide-react-native';
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
  {
    id: 1,
    label: 'Sample 1',
    phrase: '"Good morning! Did you sleep well? I hope you have a wonderful day today."',
    status: 'completed',
    duration: '00:15',
  },
  {
    id: 2,
    label: 'Sample 2',
    phrase: '"Good morning! Did you sleep well? I hope you have a wonderful day today."',
    status: 'active',
  },
  {
    id: 3,
    label: 'Sample 3',
    phrase: '"Time for your afternoon walk. The weather is lovely today, shall we go?"',
    status: 'pending',
  },
];

function SampleStep({ sample }: { sample: VoiceSample }) {
  const isCompleted = sample.status === 'completed';
  const isActive = sample.status === 'active';
  const isPending = sample.status === 'pending';

  return (
    <View className="flex-row items-start gap-stack-md relative z-10">
      {/* Icon Circle */}
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

      {/* Content */}
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
              Please read the following phrase clearly:
            </Text>
            <View
              className="p-stack-md rounded-lg mb-stack-md"
              style={{
                backgroundColor: colors.surfaceContainer,
                borderWidth: 1,
                borderColor: colors.outlineVariant,
              }}
            >
              <Text
                className="italic"
                style={{ ...typography.bodyLgElderly, color: colors.onSurface }}
              >
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
                Tap to record
              </Text>
            </View>
          </>
        )}

        {isCompleted && (
          <View className="flex-row items-center gap-stack-sm mt-1">
            <Text className="text-on-surface-variant" style={typography.bodyMd}>
              Completed ({sample.duration})
            </Text>
            <TouchableOpacity className="flex-row items-center gap-1" activeOpacity={0.7}>
              <RefreshCw size={16} color={colors.primary} />
              <Text className="text-primary font-semibold" style={typography.bodyMd}>
                Re-record
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isPending && (
          <Text className="text-on-surface-variant mt-1" style={typography.bodyMd}>
            Pending
          </Text>
        )}
      </View>
    </View>
  );
}

export default function VoiceTab() {
  const [samples] = useState<VoiceSample[]>(mockSamples);

  return (
    <View className="flex-1 bg-surface-bright">
      <ScrollView className="flex-1 px-margin-mobile" contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}>
        {/* Header */}
        <View className="mb-stack-lg">
          <Text className="text-on-surface mb-stack-sm" style={typography.headlineLg}>
            Clone Your Voice
          </Text>
          <Text className="text-on-surface-variant" style={typography.bodyMd}>
            Record a few short phrases so Xiao Nuan can speak with your voice. This helps create a more familiar and comforting experience.
          </Text>
        </View>

        {/* Voice Cloning Steps Card */}
        <Card className="p-stack-lg">
          <View className="flex-col gap-stack-lg mb-2 relative" style={{ minHeight: 340 }}>
            {/* Connecting Line */}
            <View
              className="absolute w-0.5 bg-surfaceContainerHighest z-0"
              style={{ left: 24, top: 24, bottom: 48 }}
            />

            {/* Steps */}
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
