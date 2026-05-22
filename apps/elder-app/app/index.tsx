import { Redirect } from 'expo-router';

/**
 * Entry routing decision point.
 * Phase 7 will replace this with full auth-based routing.
 * For now, default to COMPANIONEE binding page.
 */
export default function Index() {
  return <Redirect href="/(companionee)" />;
}
