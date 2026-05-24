import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Keyboard,
  ActivityIndicator,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGlobalSearchParams } from 'expo-router';
import { Mic, Send, Plus, Trash2, Heart } from 'lucide-react-native';
import { TopAppBar } from '../../../src/components/shared/TopAppBar';
import { VoiceInputPanel } from '../../../src/components/shared/VoiceInputPanel';
import { TextInputPanel } from '../../../src/components/shared/TextInputPanel';
import { Card } from '../../../src/components/ui/Card';
import { colors, typography } from '../../../src/utils/theme';
import { useAuthStore } from '../../../src/store/auth-store';
import { createFeed, listFeeds, deleteFeed } from '../../../src/services/feed';

interface FeedMessage {
  id: string;
  type: 'TEXT' | 'VOICE';
  content: string;
  audioUrl?: string;
  createdAt: string;
}

function formatDate(dateStr: string): { date: string; time: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const dateLabel = isToday ? '今天' : isYesterday ? '昨天' : `${date.getMonth() + 1}月${date.getDate()}日`;
  const timeLabel = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  return { date: dateLabel, time: timeLabel };
}

function FeedCard({ item, onDelete }: { item: FeedMessage; onDelete: () => void }) {
  const { date, time } = formatDate(item.createdAt);
  const isVoice = item.type === 'VOICE';

  return (
    <View className="flex-row gap-stack-md mb-stack-md">
      <View className="items-center">
        <View className="w-10 h-10 rounded-full bg-primaryContainer items-center justify-center mb-1">
          <Heart size={18} color={colors.primary} />
        </View>
        <View className="w-0.5 flex-1 bg-surfaceContainerHighest" />
      </View>
      <Card className="flex-1 p-stack-md">
        <View className="flex-row items-center justify-between mb-stack-sm">
          <View className="flex-row items-center gap-stack-sm">
            <Text className="text-on-surface-variant font-semibold" style={typography.labelCaps}>
              {date} {time}
            </Text>
            <View className="bg-surfaceContainerHigh rounded-full px-2 py-0.5">
              <Text className="text-on-surface-variant font-bold" style={typography.labelCaps}>
                {isVoice ? '语音' : '文字'}
              </Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={onDelete}>
            <Trash2 size={16} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
        <Text className="text-on-surface font-semibold mb-1" style={typography.bodyMd}>
          {isVoice ? '语音留言' : '文字留言'}
        </Text>
        <Text className="text-on-surface-variant mb-stack-md" style={typography.bodyMd}>
          {item.content}
        </Text>
      </Card>
    </View>
  );
}

export default function FeedTab() {
  const { pairingId } = useGlobalSearchParams<{ pairingId: string }>();
  const { token } = useAuthStore();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [voicePanelVisible, setVoicePanelVisible] = useState(false);
  const [textPanelVisible, setTextPanelVisible] = useState(false);
  const [feeds, setFeeds] = useState<FeedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  // 加载 feed 列表
  const loadFeeds = async (cursor?: string) => {
    if (!token || !pairingId) return;
    try {
      if (!cursor) setLoading(true);
      else setLoadingMore(true);
      const result = await listFeeds(token, pairingId, cursor);
      const newFeeds = result.data;
      if (!cursor) {
        setFeeds(newFeeds);
      } else {
        setFeeds((prev) => [...prev, ...newFeeds]);
      }
      setHasMore(!!result.nextCursor);
      setNextCursor(result.nextCursor);
    } catch (err) {
      console.error('[Feed] 加载失败:', err);
    } finally {
      if (!cursor) setLoading(false);
      else setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadFeeds();
  }, [token, pairingId]);

  // 滚动到底部检测
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    if (isCloseToBottom && hasMore && !loadingMore && !loading) {
      loadFeeds(nextCursor || undefined);
    }
  };

  // 键盘监听：弹出时自动滚动到底部
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleSendText = async (text: string) => {
    if (!token || !pairingId) {
      console.warn('[Feed] 缺少 token 或 pairingId，无法发送');
      return;
    }
    try {
      await createFeed(token, pairingId, text);
      await loadFeeds(); // 刷新列表
    } catch (err) {
      console.error('[Feed] 发送文字失败:', err);
    }
  };

  const handleDelete = (feedId: string) => {
    Alert.alert('确认删除', '删除后无法恢复，确定要删除这条动态吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          if (!token || !pairingId) return;
          try {
            await deleteFeed(token, pairingId, feedId);
            await loadFeeds();
          } catch (err) {
            console.error('[Feed] 删除失败:', err);
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-surface-bright">
      <StatusBar barStyle="dark-content" translucent={false} />
      <View style={{ paddingTop: insets.top / 2 }}>
        <TopAppBar title="留言" showBack />
      </View>

      {/* ScrollView 内容区域 */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: keyboardVisible ? insets.bottom + 120 : insets.bottom + 20,
        }}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} className="mt-8" />
        ) : feeds.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Text className="text-secondary" style={typography.bodyMd}>
              暂无动态
            </Text>
          </View>
        ) : (
          <>
            {feeds.map((item) => (
              <FeedCard key={item.id} item={item} onDelete={() => handleDelete(item.id)} />
            ))}
            {loadingMore && (
              <View className="items-center py-4">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* 底部快捷栏 */}
      <View
        className="px-4 pt-2"
        style={{
          backgroundColor: colors.surfaceBright,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceContainerHigh,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View
          className="flex-row items-center bg-surfaceLowest rounded-2xl px-4"
          style={{
            minHeight: 56,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <TouchableOpacity className="mr-3" activeOpacity={0.7}>
            <Plus size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 py-3"
            activeOpacity={0.7}
            onPress={() => setTextPanelVisible(true)}
          >
            <Text className="text-secondary" style={typography.bodyMd}>
              记录一下TA的日常、爱好或近况...
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="ml-2"
            activeOpacity={0.7}
            onPress={() => setVoicePanelVisible(true)}
          >
            <Mic size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <View
            className="w-9 h-9 rounded-full items-center justify-center ml-2"
            style={{ backgroundColor: colors.surfaceContainerHigh }}
          >
            <Send size={16} color={colors.onSurfaceVariant} />
          </View>
        </View>
      </View>

      {/* 语音输入面板 */}
      <VoiceInputPanel
        visible={voicePanelVisible}
        onClose={() => {
          setVoicePanelVisible(false);
          loadFeeds(); // 刷新列表
        }}
        onSuccess={() => {
          loadFeeds(); // 刷新列表
        }}
        token={token || ''}
        pairingId={pairingId || ''}
      />

      {/* 文字输入面板 */}
      <TextInputPanel
        visible={textPanelVisible}
        onClose={() => setTextPanelVisible(false)}
        onSend={handleSendText}
      />
    </View>
  );
}
