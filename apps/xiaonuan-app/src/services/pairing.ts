import { api } from './api';

export interface Pairing {
  id: string;
  companioneeName: string;
  online: boolean;
  lastActive?: string;
}

export interface BindInput {
  code: string;
  deviceId: string;
}

export async function listPairings(token: string) {
  return api('/api/pairings', { token }) as Promise<Pairing[]>;
}

export async function bindPairing(input: BindInput) {
  return api('/api/pairings/bind', {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<{ token: string; pairingId: string; stewardName: string; companioneeName: string }>;
}

export async function refreshPairingCode(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/refresh-code`, {
    method: 'POST',
    token,
  }) as Promise<{ code: string }>;
}

export async function getPairingDetail(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}`, { token }) as Promise<Pairing>;
}
