/**
 * Production build uses the deployed URL.
 * Development uses local or EXPO_PUBLIC_API_URL if set.
 *
 * In dev, HTTP goes through nginx (port 80, /xiaonuan prefix),
 * but WebSocket connects directly to gateway (port 3000) since
 * the dev nginx config lacks WebSocket upgrade support.
 */
export const API_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.31/xiaonuan')
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
