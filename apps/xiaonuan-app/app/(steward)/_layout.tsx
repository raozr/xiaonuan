import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';

export default function StewardLayout() {
  const { token } = useAuthStore();

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
