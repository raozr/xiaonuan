import { Tabs, Redirect, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../../src/store/auth-store';
import { colors, typography } from '../../../src/utils/theme';

export default function PairingDetailLayout() {
  const { token } = useAuthStore();
  const { pairingId } = useLocalSearchParams<{ pairingId: string }>();

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surfaceBright,
          borderTopColor: colors.outlineVariant,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
          paddingBottom: 16,
        },
        tabBarLabelStyle: {
          ...typography.labelCaps,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '概览',
          tabBarIcon: ({ color: _color }: { color: string }) => null,
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: '日志',
          tabBarIcon: ({ color: _color }: { color: string }) => null,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: '留言',
          tabBarIcon: ({ color: _color }: { color: string }) => null,
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: '声音',
          tabBarIcon: ({ color: _color }: { color: string }) => null,
        }}
      />
    </Tabs>
  );
}
