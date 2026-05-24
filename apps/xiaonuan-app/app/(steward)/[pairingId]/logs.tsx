import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalSearchParams } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';
import { TopAppBar } from '../../../src/components/shared/TopAppBar';
import { Card } from '../../../src/components/ui/Card';
import { colors, typography } from '../../../src/utils/theme';
import { useAuthStore } from '../../../src/store/auth-store';
import { listEvents, type EventItem } from '../../../src/services/events';

interface LogGroup {
  label: string;
  items: EventItem[];
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function getGroupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return '今天';
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function groupEventsByDate(events: EventItem[]): LogGroup[] {
  const groups: Record<string, EventItem[]> = {};
  for (const event of events) {
    const label = getGroupLabel(event.eventTime);
    if (!groups[label]) groups[label] = [];
    groups[label].push(event);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

function LogCardItem({ item }: { item: EventItem }) {
  const time = formatTime(item.eventTime);
  const payload = item.payload as Record<string, unknown> | null;
  const keyFacts = payload?.keyFacts as string[] | undefined;
  const moodSnapshot = payload?.moodSnapshot as string | undefined;

  return (
    <Card className="p-stack-md mb-stack-sm">
      <View className="flex-row items-start gap-stack-md">
        <View className="w-10 h-10 rounded-full bg-primaryFixed items-center justify-center">
          <MessageSquare size={18} color={colors.primary} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-stack-sm mb-1">
            <Text className="text-on-surface-variant font-semibold" style={typography.labelCaps}>
              {time}
            </Text>
          </View>
          <Text className="text-on-surface font-semibold mb-1" style={typography.bodyMd}>
            {item.content}
          </Text>
          {moodSnapshot && (
            <Text className="text-on-surface-variant mb-1" style={typography.bodySm}>
              心情: {moodSnapshot}
            </Text>
          )}
          {keyFacts && keyFacts.length > 0 && (
            <View className="mt-1">
              {keyFacts.map((fact, idx) => (
                <Text key={idx} className="text-on-surface-variant" style={typography.bodySm}>
                  • {fact}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    </Card>
  );
}

export default function LogsTab() {
  const { pairingId } = useGlobalSearchParams<{ pairingId: string }>();
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !pairingId) return;
    (async () => {
      try {
        setLoading(true);
        const result = await listEvents(token, pairingId, { type: 'conversation_extracted' });
        setEvents(result.data);
      } catch (err) {
        console.error('[Logs] 加载失败:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, pairingId]);

  const grouped = groupEventsByDate(events);

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="日志" showBack />
      </View>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} className="mt-8" />
        ) : events.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Text className="text-secondary" style={typography.bodyMd}>
              暂无日志
            </Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.label} className="mb-stack-md">
              <View className="flex-row items-center mb-stack-sm">
                <View
                  className="rounded-full px-stack-md py-1"
                  style={{
                    backgroundColor:
                      group.label === '今天'
                        ? colors.primaryContainer
                        : colors.surfaceContainerHighest,
                  }}
                >
                  <Text
                    className="font-bold"
                    style={[
                      typography.labelCaps,
                      {
                        color:
                          group.label === '今天'
                            ? colors.onPrimaryContainer
                            : colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {group.label}
                  </Text>
                </View>
              </View>
              {group.items.map((item) => (
                <LogCardItem key={item.id} item={item} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
