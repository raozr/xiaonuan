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
    <View className="flex-row items-center justify-between w-full h-touch-target-min px-margin-mobile bg-surface-bright">
      {/* Left */}
      <View className="w-16">
        {showBack && (
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()}>
            <ChevronLeft size={28} color={colors.secondary} />
          </TouchableOpacity>
        )}
        {showSettings && (
          <TouchableOpacity
            className="w-16 h-16 rounded-full items-center justify-center border border-outlineVariant"
            activeOpacity={0.7}
            onPress={() => router.push('/(steward)/settings')}
          >
            <Settings size={24} color={colors.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center */}
      <View className="flex-1 items-center">
        <Text className="text-primary font-bold" style={typography.headlineLg}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-on-surface-variant" style={typography.bodyMd}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right */}
      <View className="w-16 items-end">
        {rightAction && (
          <TouchableOpacity activeOpacity={0.7} onPress={rightAction.onPress}>
            {rightAction.icon}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
