import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { colors, typography } from '../../utils/theme';

interface EmptyStateIllustrationProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyStateIllustration({ title, description, actionLabel, onAction }: EmptyStateIllustrationProps) {
  return (
    <View className="items-center justify-center py-gutter px-gutter">
      <View className="w-48 h-48 bg-primaryFixed rounded-3xl items-center justify-center mb-gutter opacity-50">
        <Text className="text-6xl">🏠</Text>
      </View>
      <Text className="text-on-surface font-bold text-center mb-stack-sm" style={typography.headlineLg}>
        {title}
      </Text>
      {description && (
        <Text className="text-on-surface-variant text-center mb-stack-lg" style={typography.bodyMd}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          className="bg-primaryContainer rounded-full px-gutter py-stack-md items-center"
          style={{ minWidth: 200, height: 48 }}
          activeOpacity={0.8}
          onPress={onAction}
        >
          <Text className="text-on-primary font-bold" style={typography.bodyMd}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
