/** @jsxImportSource react */
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';
import { useRoleStore } from '../../src/store/role-store';
import { COMPANIONEE_ROLE } from '../../src/utils/constants';

export default function AuthLayout() {
  const { token } = useAuthStore();
  const role = useRoleStore((s) => s.role);

  // If already authenticated, redirect based on role
  if (token) {
    return <Redirect href={role === COMPANIONEE_ROLE ? '/(companionee)/home' : '/(steward)'} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
