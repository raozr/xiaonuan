/** @jsxImportSource react */
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';
import { useRoleStore } from '../src/store/role-store';
import { COMPANIONEE_ROLE } from '../src/utils/constants';

/**
 * Entry routing decision point:
 * - No token → COMPANIONEE binding page
 * - Token + COMPANIONEE role → voice home
 * - Token + STEWARD role → pairing list
 */
export default function Index() {
  const token = useAuthStore((s) => s.token);
  const role = useRoleStore((s) => s.role);

  if (!token) {
    return <Redirect href="/(companionee)" />;
  }

  if (role === COMPANIONEE_ROLE) {
    return <Redirect href="/(companionee)/home" />;
  }

  return <Redirect href="/(steward)" />;
}
