/** @jsxImportSource react */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/auth-store';
import { useRoleStore } from '../src/store/role-store';
import '../global.css';
import { colors } from '../src/utils/theme';

export default function RootLayout() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const loadRole = useRoleStore((s) => s.loadFromStorage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([loadFromStorage(), loadRole()]).then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.primaryFixed }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(companionee)" />
      <Stack.Screen name="(steward)" />
    </Stack>
  );
}
