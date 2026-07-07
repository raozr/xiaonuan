import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { ChevronRight, Mic, Clock } from 'lucide-react-native';
import { router } from 'expo-router';
import { StatusBadge } from './StatusBadge';
import { colors, typography } from '../../utils/theme';

interface PairingCardProps {
  pairingId: string;
  name: string | undefined;
  online: boolean;
  lastActive?: string;
  avatar?: number;
  onLongPress?: () => void;
}

export function PairingCard({ pairingId, name, online, lastActive, avatar, onLongPress }: PairingCardProps) {
  const displayName = name ?? '未知';
  return (
    <TouchableOpacity
      className="flex-row items-center bg-surfaceLowest rounded-xl p-stack-md mb-stack-sm shadow-sm"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
      }}
      activeOpacity={0.7}
      onPress={() => router.push(`/(steward)/${pairingId}`)}
      onLongPress={onLongPress}
    >
      {/* Avatar */}
      <View className="relative mr-stack-md">
        <View className="w-16 h-16 rounded-full overflow-hidden items-center justify-center"
          style={{
            backgroundColor: online ? colors.primaryFixed : colors.surfaceContainer,
            borderWidth: 2,
            borderColor: online ? colors.primaryContainer : colors.outlineVariant,
          }}
        >
          {avatar ? (
            <Image source={avatar} className="w-full h-full" resizeMode="cover" />
          ) : (
            <Text className="text-2xl font-bold" style={{ color: online ? colors.primary : colors.onSurfaceVariant }}>
              {displayName.charAt(0)}
            </Text>
          )}
        </View>
        <StatusBadge online={online} />
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text className="text-on-surface font-semibold" style={typography.bodyLgElderly}>
          {displayName}
        </Text>
        <View className="flex-row items-center gap-stack-sm">
          {online ? (
            <Mic size={14} color={colors.primaryContainer} />
          ) : (
            <Clock size={14} color={colors.onSurfaceVariant} />
          )}
          <Text className="text-on-surface-variant" style={typography.bodyMd}>
            {online ? '正在对话' : `${lastActive ?? '2小时前'}在线`}
          </Text>
        </View>
      </View>

      {/* Chevron */}
      <ChevronRight size={24} color={colors.outline} />
    </TouchableOpacity>
  );
}
