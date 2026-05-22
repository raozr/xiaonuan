import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { colors, typography } from '../../utils/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const variantStyles: Record<string, { bg: string; text: string }> = {
  primary: { bg: colors.primaryContainer, text: colors.onPrimary },
  secondary: { bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
  outline: { bg: 'transparent', text: colors.primary },
  danger: { bg: colors.errorContainer, text: colors.error },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
}: ButtonProps) {
  const { bg, text } = variantStyles[variant];

  return (
    <TouchableOpacity
      className={`rounded-full items-center justify-center h-steward-target-min ${fullWidth ? 'w-full' : ''}`}
      style={{
        backgroundColor: bg,
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: 24,
      }}
      disabled={disabled || loading}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={text} />
      ) : (
        <View className="flex-row items-center gap-stack-sm">
          <Text className="font-bold" style={{ ...typography.bodyMd, color: text }}>
            {label}
          </Text>
          {icon}
        </View>
      )}
    </TouchableOpacity>
  );
}
