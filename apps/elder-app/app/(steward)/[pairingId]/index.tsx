import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Copy, RefreshCw, Smile, MessageSquare, Hash, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { TopAppBar } from '../../../src/components/shared/TopAppBar';
import { Card } from '../../../src/components/ui/Card';
import { API_URL } from '../../../src/utils/constants';
import { colors, typography, spacing } from '../../../src/utils/theme';
import { useAuthStore } from '../../../src/store/auth-store';

export default function StatusTab() {
  const { pairingId } = useLocalSearchParams<{ pairingId: string }>();
  const { token } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const mockSummary = {
    emotion: 'Happy & Calm',
    conversationTime: '40 mins',
    topicCount: 5,
    highlights: [
      'Talked warmly about her son\'s recent visit',
      'Completed morning medication on time',
    ],
    importantNote: 'Requested weather update for tomorrow\'s walk. Ensure she has her raincoat ready.',
    pairingCode: '582 914',
    online: true,
    lastActive: '12 mins ago',
  };

  return (
    <View className="flex-1 bg-surface-bright">
      <ScrollView
        className="flex-1 px-margin-mobile"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {}} tintColor={colors.primaryContainer} />
        }
      >
        {/* Pairing Code Bar */}
        <View className="flex-row items-center justify-between bg-surfaceContainer rounded-xl p-stack-md mb-stack-md">
          <Text className="text-on-surface-variant font-semibold" style={typography.labelCaps}>
            配对码管理
          </Text>
          <View className="flex-row items-center gap-stack-sm">
            <Text className="text-on-surface font-mono font-bold" style={typography.headlineLg}>
              {mockSummary.pairingCode}
            </Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Copy size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => setRefreshing(true)}>
              <RefreshCw size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Row */}
        <View className="flex-row gap-stack-md mb-stack-md">
          {/* Connection */}
          <Card className="flex-1 p-stack-md items-center">
            <View className="w-3 h-3 rounded-full bg-[#4CAF50] mb-stack-sm" />
            <Text className="text-on-surface font-semibold" style={typography.bodyLgElderly}>
              Online Now
            </Text>
          </Card>
          {/* Last Active */}
          <Card className="flex-1 p-stack-md items-center">
            <Text className="text-on-surface-variant mb-stack-sm">Last Active</Text>
            <Text className="text-on-surface font-semibold" style={typography.bodyLgElderly}>
              {mockSummary.lastActive}
            </Text>
          </Card>
        </View>

        {/* Daily Summary */}
        <Card className="p-stack-md mb-stack-md">
          <View className="flex-row items-center gap-stack-sm mb-stack-md">
            <View className="w-10 h-10 rounded-full bg-primaryContainer items-center justify-center">
              <Smile size={22} color={colors.onPrimary} />
            </View>
            <View>
              <Text className="text-on-surface-variant" style={typography.labelCaps}>TODAY'S SUMMARY</Text>
              <Text className="text-primary font-bold" style={typography.headlineLg}>
                {mockSummary.emotion}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row gap-stack-md mb-stack-md">
            <View className="flex-1 bg-surfaceContainer rounded-lg p-stack-sm items-center">
              <MessageSquare size={18} color={colors.primaryContainer} />
              <Text className="text-on-surface font-bold mt-1">{mockSummary.conversationTime}</Text>
              <Text className="text-on-surface-variant" style={typography.labelCaps}>Conv. Time</Text>
            </View>
            <View className="flex-1 bg-surfaceContainer rounded-lg p-stack-sm items-center">
              <Hash size={18} color={colors.primaryContainer} />
              <Text className="text-on-surface font-bold mt-1">{mockSummary.topicCount}</Text>
              <Text className="text-on-surface-variant" style={typography.labelCaps}>Topics</Text>
            </View>
          </View>

          {/* Highlights */}
          <Text className="text-on-surface font-semibold mb-stack-sm" style={typography.bodyMd}>
            Highlights
          </Text>
          {mockSummary.highlights.map((h: string, i: number) => (
            <View key={i} className="flex-row items-start gap-stack-sm mb-stack-sm">
              <CheckCircle2 size={16} color={colors.primaryContainer} style={{ marginTop: 2 }} />
              <Text className="text-on-surface flex-1" style={typography.bodyMd}>
                {h}
              </Text>
            </View>
          ))}

          {/* Important Note */}
          <View className="bg-errorContainer rounded-lg p-stack-md flex-row items-start gap-stack-sm">
            <AlertTriangle size={18} color={colors.error} style={{ marginTop: 2 }} />
            <Text className="text-error flex-1" style={typography.bodyMd}>
              <Text className="font-bold">Important: </Text>
              {mockSummary.importantNote}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
