import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  RefreshCw,
  Smile,
  Frown,
  Meh,
  Heart,
  AlertCircle,
  CloudRain,
  Moon,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react-native';
import { TopAppBar } from '../../../src/components/shared/TopAppBar';
import { colors, typography } from '../../../src/utils/theme';
import { useAuthStore } from '../../../src/store/auth-store';
import { getPairingDetail, getDailySummary, type DailySummary, refreshPairingCode } from '../../../src/services/pairing';
import { formatTimeAgo } from '../../../src/utils/time';

type EmotionCategory = 'positive' | 'neutral' | 'negative';

interface EmotionConfig {
  category: EmotionCategory;
  bg: string;
  fg: string;
}

const EMOTION_MAP: Record<string, EmotionConfig> = {
  // 积极 - 暖橙色系
  开心: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  快乐: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  高兴: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  愉快: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  喜悦: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  兴奋: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  激动: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  惊喜: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  期待: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  幸福: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  满足: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  温暖: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  欣慰: { category: 'positive', bg: '#FFF4E6', fg: '#D97706' },
  // 中性 - 蓝绿色系
  平静: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  平和: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  淡定: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  一般: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  还好: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  疲惫: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  困: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  倦怠: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  没精神: { category: 'neutral', bg: '#EFF6FF', fg: '#2563EB' },
  // 消极 - 红灰色系
  难过: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  伤心: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  沮丧: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  失落: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  孤独: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  寂寞: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  低落: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  忧郁: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  消沉: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  抑郁: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  悲伤: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  担忧: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  焦虑: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  不安: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  紧张: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  担心: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  生气: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  烦躁: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  愤怒: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  恼火: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
  不高兴: { category: 'negative', bg: '#FEF2F2', fg: '#DC2626' },
};

function getEmotionConfig(label: string): EmotionConfig {
  const key = Object.keys(EMOTION_MAP).find((k) => label.includes(k));
  return key ? EMOTION_MAP[key] : { category: 'positive', bg: '#FFF4E6', fg: '#D97706' };
}

function EmotionIcon({ label, size = 28 }: { label: string; size?: number }) {
  const lowered = label.toLowerCase();
  const { fg } = getEmotionConfig(label);

  if (lowered.includes('幸福') || lowered.includes('满足') || lowered.includes('温暖') || lowered.includes('欣慰')) {
    return <Heart size={size} color={fg} />;
  }
  if (lowered.includes('兴奋') || lowered.includes('激动') || lowered.includes('惊喜') || lowered.includes('期待')) {
    return <Smile size={size} color={fg} />;
  }
  if (lowered.includes('开心') || lowered.includes('高兴') || lowered.includes('愉快') || lowered.includes('快乐') || lowered.includes('喜悦')) {
    return <Smile size={size} color={fg} />;
  }
  if (lowered.includes('平静') || lowered.includes('平和') || lowered.includes('淡定') || lowered.includes('一般') || lowered.includes('还好')) {
    return <Meh size={size} color={fg} />;
  }
  if (lowered.includes('疲惫') || lowered.includes('累') || lowered.includes('困') || lowered.includes('倦怠') || lowered.includes('没精神')) {
    return <Moon size={size} color={fg} />;
  }
  if (lowered.includes('担忧') || lowered.includes('焦虑') || lowered.includes('不安') || lowered.includes('紧张') || lowered.includes('担心')) {
    return <AlertCircle size={size} color={fg} />;
  }
  if (lowered.includes('难过') || lowered.includes('伤心') || lowered.includes('沮丧') || lowered.includes('失落') || lowered.includes('孤独') || lowered.includes('寂寞') || lowered.includes('低落')) {
    return <Frown size={size} color={fg} />;
  }
  if (lowered.includes('生气') || lowered.includes('烦躁') || lowered.includes('愤怒') || lowered.includes('恼火') || lowered.includes('不高兴')) {
    return <Zap size={size} color={fg} />;
  }
  if (lowered.includes('忧郁') || lowered.includes('消沉') || lowered.includes('抑郁') || lowered.includes('悲伤')) {
    return <CloudRain size={size} color={fg} />;
  }

  return <Smile size={size} color={fg} />;
}

export default function StatusTab() {
  const { pairingId } = useLocalSearchParams<{ pairingId: string }>();
  const { token } = useAuthStore();
  const [pairingCode, setPairingCode] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastActive, setLastActive] = useState<string | null>(null);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!pairingId || !token) return;

    // Fetch pairing detail (online status, invite code)
    getPairingDetail(token, pairingId)
      .then((data: any) => {
        if (data?.inviteCode) {
          setPairingCode(data.inviteCode);
        }
        setIsOnline(data?.isOnline ?? false);
        setLastActive(data?.lastActive ?? null);
      })
      .catch(() => {
        // silently ignore
      });

    // Fetch daily summary
    getDailySummary(token, pairingId)
      .then((result) => {
        if (result?.success && result.data) {
          setDailySummary(result.data);
        }
      })
      .catch(() => {
        // silently ignore
      });
  }, [pairingId, token]);

  const handleRefreshCode = async () => {
    if (!pairingId || !token) return;
    try {
      const data = await refreshPairingCode(token, pairingId);
      if (data?.inviteCode) {
        setPairingCode(data.inviteCode);
        Alert.alert('刷新成功', '配对码已更新，24小时内有效');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '刷新配对码失败，请稍后再试';
      Alert.alert('刷新失败', message);
    }
  };

  const formatCode = (code: string) =>
    code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="概览" showBack />
      </View>

      {/* Fixed: Pairing Code */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <View
          className="flex-row items-center justify-between bg-surfaceContainerLowest rounded-2xl p-3"
          style={{ borderWidth: 1, borderColor: colors.surfaceContainer }}
        >
          <Text className="font-bold text-on-surface" style={{ fontSize: 18, lineHeight: 28 }}>
            配对码管理
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="bg-surfaceContainerHigh rounded-lg px-3 py-1.5">
              <Text
                className="font-mono font-bold text-on-surface"
                style={{ fontSize: 18, letterSpacing: 4 }}
                numberOfLines={1}
              >
                {pairingCode ? formatCode(pairingCode) : '--- ---'}
              </Text>
            </View>
            <TouchableOpacity className="w-10 h-10 rounded-full items-center justify-center" activeOpacity={0.7} onPress={handleRefreshCode}>
              <RefreshCw size={20} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Fixed: Status Cards */}
      <View className="flex-row gap-4 px-5 mt-4">
        {/* Online Status */}
        <View
          className="flex-1 bg-surfaceContainerLowest rounded-2xl p-4"
          style={{ borderWidth: 1, borderColor: colors.surfaceContainer }}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <View
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: isOnline ? '#10B981' : colors.onSurfaceVariant }}
            />
            <Text className="text-secondary uppercase" style={typography.labelCaps}>
              连接状态
            </Text>
          </View>
          <Text className="text-on-surface font-semibold" style={typography.bodyLgElderly} numberOfLines={1}>
            {isOnline ? '在线' : '离线'}
          </Text>
        </View>

        {/* Last Active */}
        <View
          className="flex-1 bg-surfaceContainerLowest rounded-2xl p-4"
          style={{ borderWidth: 1, borderColor: colors.surfaceContainer }}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <Clock size={18} color={colors.primary} />
            <Text className="text-secondary uppercase" style={typography.labelCaps}>
              最近活跃
            </Text>
          </View>
          <Text className="text-on-surface font-semibold" style={typography.bodyLgElderly} numberOfLines={1}>
            {formatTimeAgo(lastActive)}
          </Text>
        </View>
      </View>

      {/* Scrollable: Daily Summary */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {/* Daily Summary Card */}
        <View
          className="bg-surfaceContainerLowest rounded-3xl p-6 mb-6 relative overflow-hidden"
          style={{ borderWidth: 1, borderColor: colors.surfaceContainer }}
        >
          {/* Decorative blob */}
          <View
            className="absolute -right-10 -top-10 w-40 h-40 rounded-full"
            style={{ backgroundColor: colors.primaryFixed, opacity: 0.25 }}
          />

          {/* Header */}
          <View className="flex-row justify-between items-start mb-6 relative z-10">
            <View style={{ flex: 1, paddingRight: 56 }}>
              <Text className="text-primary font-bold mb-1" style={typography.headlineLg} numberOfLines={1}>
                今日摘要
              </Text>
              <Text className="text-secondary" style={typography.bodyMd} numberOfLines={1}>
                {dailySummary ? '今天陪伴的简要 overview。' : '暂无今日摘要数据。'}
              </Text>
            </View>
            {dailySummary && (
              <View className="w-12 h-12 rounded-full items-center justify-center absolute right-0 top-0" style={{ backgroundColor: getEmotionConfig(dailySummary.mood).bg }}>
                <EmotionIcon label={dailySummary.mood} size={28} />
              </View>
            )}
          </View>

          {/* Stats Grid */}
          {dailySummary ? (
            <View className="flex-row gap-3 mb-6 relative z-10">
              {[
                { label: '情绪状态', value: dailySummary.mood },
                { label: '对话时长', value: `${dailySummary.duration} 分钟` },
                { label: '话题数', value: String(dailySummary.topics) },
              ].map((item) => (
                <View
                  key={item.label}
                  className="flex-1 rounded-xl p-3"
                  style={{ backgroundColor: colors.surfaceBright }}
                >
                  <Text className="text-secondary uppercase mb-1" style={typography.labelCaps} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text className="text-on-surface font-semibold" style={typography.bodyLgElderly} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className="rounded-xl p-4 mb-6 relative z-10" style={{ backgroundColor: colors.surfaceBright }}>
              <Text className="text-on-surface-variant text-center" style={typography.bodyMd}>
                今日暂无对话记录
              </Text>
            </View>
          )}

          {/* Highlights */}
          {dailySummary && dailySummary.highlights && dailySummary.highlights.length > 0 && (
            <View className="relative z-10 mb-6">
              <Text className="text-secondary uppercase mb-3" style={typography.labelCaps}>
                今日亮点
              </Text>
              {dailySummary.highlights.map((h, i) => (
                <View key={i} className="flex-row items-start gap-3 mb-3">
                  <CheckCircle2 size={20} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text className="text-on-surface flex-1" style={typography.bodyMd}>
                    {h}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Important Note */}
          {dailySummary && dailySummary.concerns && (
            <View
              className="rounded-xl p-4 relative z-10"
              style={{ backgroundColor: colors.errorContainer + '26', borderWidth: 1, borderColor: colors.errorContainer + '66' }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <AlertTriangle size={18} color={colors.error} />
                <Text className="text-error uppercase" style={typography.labelCaps}>
                  重要提醒
                </Text>
              </View>
              <Text className="text-on-surface" style={typography.bodyMd}>
                {dailySummary.concerns}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
