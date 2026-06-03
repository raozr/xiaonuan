import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle } from 'lucide-react-native';
import { TopAppBar } from '../../src/components/shared/TopAppBar';
import { useAuthStore } from '../../src/store/auth-store';
import {
  listConversationHistory,
  type ConversationMessage,
} from '../../src/services/conversation-history';
import { colors, typography } from '../../src/utils/theme';

const PAGE_SIZE = 50;

interface MessageGroup {
  label: string;
  messages: ConversationMessage[];
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, now)) return '今天';
  if (isSameDay(date, yesterday)) return '昨天';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function groupMessages(messages: ConversationMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const label = formatDateLabel(message.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) {
      last.messages.push(message);
    } else {
      groups.push({ label, messages: [message] });
    }
  }
  return groups;
}

function mergeMessages(current: ConversationMessage[], incoming: ConversationMessage[]) {
  const seen = new Set<string>();
  return [...incoming, ...current]
    .filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isCompanionee = message.role === 'COMPANIONEE';
  const isAi = message.role === 'AI';

  return (
    <View className={`w-full mb-stack-sm ${isCompanionee ? 'items-end' : 'items-start'}`}>
      <View
        className="max-w-[82%] px-stack-md py-stack-sm"
        style={{
          borderRadius: 20,
          borderTopRightRadius: isCompanionee ? 6 : 20,
          borderTopLeftRadius: isAi ? 6 : 20,
          backgroundColor: isCompanionee ? colors.primary : colors.surfaceContainerHigh,
        }}
      >
        <Text
          style={[
            typography.bodyLgElderly,
            {
              color: isCompanionee ? colors.onPrimary : colors.onSurface,
              letterSpacing: 0,
            },
          ]}
        >
          {message.content}
        </Text>
      </View>
      <Text className="mt-1 px-2 text-on-surface-variant" style={typography.bodySm}>
        {isCompanionee ? '我' : '小暖'} {formatTime(message.createdAt)}
      </Text>
    </View>
  );
}

export default function CompanioneeHistory() {
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const shouldScrollToEndRef = useRef(false);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => groupMessages(messages), [messages]);

  const loadLatest = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setMessages([]);
      setNextCursor(null);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      shouldScrollToEndRef.current = true;
      const result = await listConversationHistory(token, { limit: PAGE_SIZE });
      setMessages(result.data);
      setNextCursor(result.pagination.nextCursor);
    } catch (err) {
      console.error('[ConversationHistory] 加载失败:', err);
      setError('加载失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadOlder = useCallback(async () => {
    if (!token || !nextCursor || loadingOlder) return;

    try {
      setError(null);
      setLoadingOlder(true);
      shouldScrollToEndRef.current = false;
      const result = await listConversationHistory(token, {
        limit: PAGE_SIZE,
        before: nextCursor,
      });
      setMessages((current) => mergeMessages(current, result.data));
      setNextCursor(result.pagination.nextCursor);
    } catch (err) {
      console.error('[ConversationHistory] 加载更早失败:', err);
      setError('加载失败，请稍后再试');
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, nextCursor, token]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  return (
    <SafeAreaView className="flex-1 bg-surface-bright" edges={['top', 'left', 'right']}>
      <TopAppBar title="对话历史" showBack />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 28,
          }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadLatest}
              tintColor={colors.primary}
            />
          }
          onContentSizeChange={() => {
            if (shouldScrollToEndRef.current) {
              scrollRef.current?.scrollToEnd({ animated: false });
              shouldScrollToEndRef.current = false;
            }
          }}
        >
          {nextCursor && (
            <TouchableOpacity
              className="self-center px-stack-lg py-stack-sm rounded-full mb-stack-md bg-surfaceContainerHigh"
              activeOpacity={0.75}
              onPress={loadOlder}
              disabled={loadingOlder}
            >
              <Text className="font-bold text-primary" style={typography.bodyMd}>
                {loadingOlder ? '加载中' : '加载更早'}
              </Text>
            </TouchableOpacity>
          )}

          {error && (
            <View className="rounded-md px-stack-md py-stack-sm mb-stack-md bg-errorContainer">
              <Text style={[typography.bodyMd, { color: colors.onErrorContainer }]}>
                {error}
              </Text>
            </View>
          )}

          {messages.length === 0 ? (
            <View className="items-center justify-center py-20">
              <View className="w-16 h-16 rounded-full items-center justify-center bg-surfaceContainerHigh mb-stack-md">
                <MessageCircle size={28} color={colors.secondary} />
              </View>
              <Text className="text-on-surface font-bold" style={typography.headlineSm}>
                还没有对话记录
              </Text>
            </View>
          ) : (
            groups.map((group) => (
              <View key={group.label} className="mb-stack-md">
                <View className="items-center mb-stack-md">
                  <View className="px-stack-md py-1 rounded-full bg-surfaceContainerHighest">
                    <Text className="font-bold text-on-surface-variant" style={typography.labelCaps}>
                      {group.label}
                    </Text>
                  </View>
                </View>
                {group.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
