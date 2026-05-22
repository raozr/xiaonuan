import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Pill, Sun, Moon, MessageSquare, Heart } from 'lucide-react-native';
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
  {
    id: '1',
    time: '08:30 AM',
    title: 'Morning Medication Reminder',
    content: 'AI assistant reminded Mom to take morning blood pressure medication. Confirmed via voice response.',
    icon: 'pill',
    variant: 'action',
  },
  {
    id: '2',
    time: '07:45 AM',
    title: 'Morning Check-in',
    content: 'Reported feeling well and rested. Voice tone analysis indicates positive mood state.',
    icon: 'mood',
    variant: 'normal',
  },
  {
    id: '3',
    time: '07:30 AM',
    title: 'Weather Briefing',
    content: 'Provided daily forecast. Suggested bringing a light jacket for the afternoon walk.',
    icon: 'weather',
    variant: 'weather',
  },
];

const yesterdayLogs: LogItem[] = [
  {
    id: '4',
    time: '08:15 PM',
    title: 'Evening Conversation',
    content: 'Extended chat about gardening plans. Discussed ordering new seeds for the spring season. Voice engagement was high.',
    icon: 'forum',
    variant: 'normal',
  },
  {
    id: '5',
    time: '04:00 PM',
    title: 'Vitals Sync',
    content: 'Smart watch data synced successfully. Heart rate and step count within normal targeted ranges.',
    icon: 'heart',
    variant: 'normal',
  },
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
        ...{
          borderLeftWidth: item.variant === 'action' ? 4 : 0,
          borderLeftColor: item.variant === 'action' ? colors.error : 'transparent',
        },
      }}
    >
      <View className="flex-row items-start gap-stack-md">
        {/* Icon */}
        <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: iconBg }}>
          {getIcon()}
        </View>

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-center gap-stack-sm mb-1">
            <Text className="text-on-surface-variant font-semibold" style={typography.labelCaps}>
              {item.time}
            </Text>
            {item.variant === 'action' && (
              <View className="bg-errorContainer rounded-full px-2 py-0.5">
                <Text className="text-error font-bold" style={typography.labelCaps}>
                  Action Required
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

      {/* Bottom border for weather variant */}
      {item.variant === 'weather' && (
        <View className="h-0.5 bg-primaryContainer rounded-full mt-stack-sm" />
      )}
    </Card>
  );
}

export default function LogsTab() {
  return (
    <View className="flex-1 bg-surface-bright">
      <ScrollView className="flex-1 px-margin-mobile" contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}>
        {/* Page header */}
        <Text className="text-on-surface mb-stack-sm" style={typography.displayElderly}>
          Activity Logs
        </Text>
        <Text className="text-on-surface-variant mb-gutter" style={typography.bodyMd}>
          Comprehensive record of daily interactions.
        </Text>

        {/* Today */}
        <View className="flex-row items-center mb-stack-md">
          <View className="bg-primaryContainer rounded-full px-stack-md py-1">
            <Text className="text-on-primary font-bold" style={typography.labelCaps}>TODAY</Text>
          </View>
        </View>
        {todayLogs.map((item) => <LogCardItem key={item.id} item={item} />)}

        {/* Yesterday */}
        <View className="flex-row items-center mb-stack-md mt-stack-md">
          <View className="bg-surfaceContainerHighest rounded-full px-stack-md py-1">
            <Text className="text-on-surface-variant font-bold" style={typography.labelCaps}>YESTERDAY</Text>
          </View>
        </View>
        {yesterdayLogs.map((item) => <LogCardItem key={item.id} item={item} />)}
      </ScrollView>
    </View>
  );
}
