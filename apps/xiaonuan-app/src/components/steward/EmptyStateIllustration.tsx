import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Home } from 'lucide-react-native';
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
      <View className="w-40 h-40 bg-primaryFixed rounded-full items-center justify-center mb-gutter">
        <Home size={56} color={colors.primary} />
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
          className="bg-primaryContainer rounded-full px-8 py-stack-md items-center"
          style={{ minWidth: 200, height: 52 }}
          activeOpacity={0.8}
          onPress={onAction}
        >
          <Text className="text-on-primary font-bold" style={{ fontSize: 18, fontWeight: '700', lineHeight: 24 }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
