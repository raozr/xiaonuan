declare const require: ((id: string) => any) | undefined;

type ExpoConstantsLike = {
  expoConfig?: { hostUri?: string };
  manifest?: { debuggerHost?: string };
  manifest2?: { extra?: { expoClient?: { hostUri?: string }; expoGo?: { debuggerHost?: string } } };
};

function getExpoConstants(): ExpoConstantsLike | undefined {
  if (process.env.VITEST) {
    return undefined;
  }

  try {
    const mod = typeof require === 'function' ? require('expo-constants') : undefined;
    return (mod?.default ?? mod) as ExpoConstantsLike | undefined;
  } catch {
    return undefined;
  }
}

function getExpoHost() {
  const constants = getExpoConstants();
  const hostUri =
    constants?.expoConfig?.hostUri ||
    constants?.manifest2?.extra?.expoClient?.hostUri ||
    constants?.manifest2?.extra?.expoGo?.debuggerHost ||
    constants?.manifest?.debuggerHost;

  return hostUri?.split(':')[0];
}

function getDevApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const expoHost = getExpoHost();
  if (expoHost) {
    return `http://${expoHost}:3000`;
  }

  return 'http://localhost:3000';
}

/**
 * Production build uses the deployed URL.
 * Development prefers EXPO_PUBLIC_API_URL, then derives the computer LAN host
 * from Expo so physical devices do not try to connect to their own localhost.
 */
export const API_URL = __DEV__
  ? getDevApiUrl()
  : 'https://www.quirklabs.top/xiaonuan';

export const WS_URL = __DEV__
  ? `ws://${new URL(API_URL).hostname}:3000/ws`
  : API_URL.replace(/^https/, 'wss') + '/ws';

export const STORAGE_KEYS = {
  DEVICE_ID: 'xn:deviceId',
  TOKEN: 'xn:token',
  PAIRING_ID: 'xn:pairingId',
  USER: 'xn:user',
  ROLE: 'xn:role',
} as const;

export const COMPANIONEE_ROLE = 'COMPANIONEE';
export const STEWARD_ROLE = 'STEWARD';
