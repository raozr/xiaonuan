/**
 * Production build uses the deployed URL.
 * Development uses local or EXPO_PUBLIC_API_URL if set.
 */
export const API_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.31:3000')
  : 'https://www.quirklabs.top/xiaonuan';

export const WS_URL = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws') + '/ws';

export const STORAGE_KEYS = {
  DEVICE_ID: 'xn:deviceId',
  TOKEN: 'xn:token',
  PAIRING_ID: 'xn:pairingId',
  USER: 'xn:user',
  ROLE: 'xn:role',
} as const;

export const COMPANIONEE_ROLE = 'COMPANIONEE';
export const STEWARD_ROLE = 'STEWARD';
