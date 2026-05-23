import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { colors, typography } from '../../utils/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  linkLabel?: string;
  onLinkPress?: () => void;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  linkLabel,
  onLinkPress,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="w-full mb-stack-md">
      {/* Label row */}
      {label && (
        <View className="flex-row justify-between items-center mb-1">
          <Text className="font-bold text-outline-variant" style={typography.labelCaps}>
            {label}
          </Text>
          {linkLabel && (
            <TouchableOpacity activeOpacity={0.7} onPress={onLinkPress}>
              <Text className="text-primaryContainer font-semibold" style={typography.bodyMd}>
                {linkLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Input container */}
      <View
        className="flex-row items-center rounded-xl border px-3 h-steward-target-min"
        style={{
          backgroundColor: focused ? colors.surfaceLowest : colors.surfaceLow,
          borderColor: focused ? colors.primaryContainer : colors.outlineVariant,
          borderWidth: focused ? 2 : 1,
        }}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        <TextInput
          className="flex-1 text-on-surface"
          style={typography.bodyMd}
          placeholderTextColor={colors.onSurfaceVariant}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity
            className="ml-2 p-1"
            activeOpacity={0.7}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>

      {/* Error */}
      {error && (
        <Text className="text-error mt-1" style={typography.bodyMd}>
          {error}
        </Text>
      )}
    </View>
  );
}
