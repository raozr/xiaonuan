import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, typography } from '../../utils/theme';

interface NotificationToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function NotificationToggle({ label, description, value, onChange }: NotificationToggleProps) {
  return (
    <View className="flex-row items-center justify-between py-stack-sm">
      <View className="flex-1 mr-stack-md">
        <Text className="text-on-surface font-semibold" style={typography.bodyMd}>
          {label}
        </Text>
        {description && (
          <Text className="text-on-surface-variant" style={typography.bodyMd}>
            {description}
          </Text>
        )}
      </View>
      <TouchableOpacity
        className="w-12 h-7 rounded-full justify-center px-1"
        style={{ backgroundColor: value ? colors.primaryContainer : colors.surfaceContainerHighest }}
        activeOpacity={0.7}
        onPress={() => onChange(!value)}
      >
        <View
          className="w-5 h-5 rounded-full bg-surfaceLowest shadow-sm"
          style={{ transform: [{ translateX: value ? 20 : 0 }] }}
        />
      </TouchableOpacity>
    </View>
  );
}
