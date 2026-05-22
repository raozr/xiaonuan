import React from 'react';
import { View, Text } from 'react-native';
import { colors, typography } from '../../utils/theme';

interface StatusBadgeProps {
  online: boolean;
}

export function StatusBadge({ online }: StatusBadgeProps) {
  return (
    <View
      className="w-3 h-3 rounded-full border border-surfaceLowest"
      style={{
        backgroundColor: online ? '#4CAF50' : colors.onSurfaceVariant,
        borderColor: colors.surfaceLowest,
        position: 'absolute',
        bottom: 0,
        right: 0,
      }}
    />
  );
}
