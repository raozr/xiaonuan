import { Stack } from 'expo-router';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';

export default function AuthLayout() {
  const { token } = useAuthStore();

  // If already authenticated, go to companionee home
  if (token) {
    return <Redirect href="/(companionee)/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
