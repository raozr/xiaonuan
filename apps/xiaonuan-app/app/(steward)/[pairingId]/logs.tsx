import React from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pill, Sun, Moon, MessageSquare, Heart } from 'lucide-react-native';
import { TopAppBar } from '../../../src/components/shared/TopAppBar';
import { Card } from '../../../src/components/ui/Card';
import { colors, typography } from '../../../src/utils/theme';

interface LogItem {
  id: string;
  time: string;
  title: string;
  content: string;
  icon: string;
  variant: 'action' | 'normal' | 'weather';
}

const todayLogs: LogItem[] = [
  { id: '1', time: '08:30', title: '早晨用药提醒', content: 'AI 助手提醒妈妈服用早晨降压药，已通过语音确认。', icon: 'pill', variant: 'action' },
  { id: '2', time: '07:45', title: '早晨问候', content: '表示感觉良好且休息充足，语音情绪分析显示心情愉快。', icon: 'mood', variant: 'normal' },
  { id: '3', time: '07:30', title: '天气播报', content: '播报今日天气，建议下午散步带件薄外套。', icon: 'weather', variant: 'weather' },
];

const yesterdayLogs: LogItem[] = [
  { id: '4', time: '20:15', title: '晚间聊天', content: '聊了花园种植计划，讨论了春季新种子的事，语音互动活跃。', icon: 'forum', variant: 'normal' },
  { id: '5', time: '16:00', title: '健康数据同步', content: '智能手表数据同步成功，心率和步数均在正常范围内。', icon: 'heart', variant: 'normal' },
];

function LogCardItem({ item }: { item: LogItem }) {
  const getIcon = () => {
    switch (item.icon) {
      case 'pill': return <Pill size={18} color={colors.error} />;
      case 'mood': return <Sun size={18} color={colors.primaryContainer} />;
      case 'weather': return <Sun size={18} color={colors.primaryContainer} />;
      case 'forum': return <MessageSquare size={18} color={colors.primaryContainer} />;
      case 'heart': return <Heart size={18} color={colors.primaryContainer} />;
      default: return <Moon size={18} color={colors.tertiary} />;
    }
  };

  const iconBg = item.variant === 'action' ? colors.errorContainer : colors.primaryFixed;

  return (
    <Card
      className="p-stack-md mb-stack-sm"
      style={{
        borderLeftWidth: item.variant === 'action' ? 4 : 0,
        borderLeftColor: item.variant === 'action' ? colors.error : 'transparent',
      }}
    >
      <View className="flex-row items-start gap-stack-md">
        <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: iconBg }}>
          {getIcon()}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-stack-sm mb-1">
            <Text className="text-on-surface-variant font-semibold" style={typography.labelCaps}>
              {item.time}
            </Text>
            {item.variant === 'action' && (
              <View className="bg-errorContainer rounded-full px-2 py-0.5">
                <Text className="text-error font-bold" style={typography.labelCaps}>
                  需处理
                </Text>
              </View>
            )}
          </View>
          <Text className="text-on-surface font-semibold mb-1" style={typography.bodyMd}>
            {item.title}
          </Text>
          <Text className="text-on-surface-variant" style={typography.bodyMd}>
            {item.content}
          </Text>
        </View>
      </View>
      {item.variant === 'weather' && (
        <View className="h-0.5 bg-primaryContainer rounded-full mt-stack-sm" />
      )}
    </Card>
  );
}

export default function LogsTab() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="日志" showBack />
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Today */}
        <View className="flex-row items-center mb-stack-md">
          <View className="bg-primaryContainer rounded-full px-stack-md py-1">
            <Text className="text-on-primary font-bold" style={typography.labelCaps}>今天</Text>
          </View>
        </View>
        {todayLogs.map((item) => <LogCardItem key={item.id} item={item} />)}

        {/* Yesterday */}
        <View className="flex-row items-center mb-stack-md mt-stack-md">
          <View className="bg-surfaceContainerHighest rounded-full px-stack-md py-1">
            <Text className="text-on-surface-variant font-bold" style={typography.labelCaps}>昨天</Text>
          </View>
        </View>
        {yesterdayLogs.map((item) => <LogCardItem key={item.id} item={item} />)}
      </ScrollView>
    </View>
  );
}
