import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, typography } from '../../utils/theme';

interface TopAppBarProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showSettings?: boolean;
  rightAction?: { icon: React.ReactNode; onPress: () => void };
}

export function TopAppBar({ title, subtitle, showBack, showSettings, rightAction }: TopAppBarProps) {
  const router = useRouter();

  return (
    <View className="flex-row items-center w-full h-touch-target-min px-margin-mobile bg-surface-bright">
      {/* Left: back + title */}
      <View className="flex-1 flex-row items-center gap-2">
        {showBack && (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()}>
            <ChevronLeft size={28} color={colors.secondary} />
          </TouchableOpacity>
        )}
        <View>
          <Text className="text-primary font-bold" style={typography.headlineLg}>
            {title}
          </Text>
          {subtitle && (
            <Text className="text-on-surface-variant" style={typography.bodyMd}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {/* Right: settings */}
      <View className="flex-row items-center gap-2">
        {showSettings && (
          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center border border-outlineVariant"
            activeOpacity={0.7}
            onPress={() => router.push('/(steward)/settings')}
          >
            <Settings size={20} color={colors.secondary} />
          </TouchableOpacity>
        )}
        {rightAction && (
          <TouchableOpacity activeOpacity={0.7} onPress={rightAction.onPress}>
            {rightAction.icon}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
