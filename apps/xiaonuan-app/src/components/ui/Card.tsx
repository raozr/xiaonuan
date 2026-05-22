import React from 'react';
import { View, ViewStyle } from 'react-native';
import { colors } from '../../utils/theme';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
}

export function Card({ children, className = '', style }: CardProps) {
  return (
    <View
      className={`bg-surfaceLowest rounded-3xl shadow-md p-gutter ${className}`}
      style={{
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 3,
        ...style,
      }}
    >
      {children}
    </View>
  );
}
