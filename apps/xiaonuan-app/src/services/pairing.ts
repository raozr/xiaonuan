import { api } from './api';

export interface Pairing {
  id: string;
  companionee: {
    id: string;
    pairingId: string;
    name: string;
    gender?: string;
    age?: number;
    dialect?: string;
    hobbies?: string;
    healthNotes?: string;
    topicsToAvoid?: string;
    greetingPreference?: string;
  } | undefined;
  isOnline: boolean;
  lastActive: string | null;
}

export interface CreatePairingInput {
  name: string;
  relationship: string;
  notes?: string;
}

export interface BindInput {
  inviteCode: string;
  deviceId: string;
}

export async function listPairings(token: string) {
  return api('/api/pairings', { token }) as Promise<Pairing[]>;
}

export async function createPairing(token: string, input: CreatePairingInput) {
  return api('/api/pairings', {
    method: 'POST',
    token,
    body: JSON.stringify(input),
  }) as Promise<{ id: string; inviteCode: string; inviteCodeExpiresAt: string }>;
}

export async function bindPairing(input: BindInput) {
  return api('/api/pairings/bind', {
    method: 'POST',
    body: JSON.stringify(input),
  }) as Promise<{ token: string; pairingId: string; stewardName: string; companioneeName: string }>;
}

export interface DailySummary {
  mood: string;
  duration: number;
  topics: number;
  highlights: string[];
  concerns: string | null;
}

export async function getDailySummary(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/daily-summary`, { token }) as Promise<{
    success: boolean;
    data: DailySummary | null;
  }>;
}

export async function refreshPairingCode(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/refresh-code`, {
    method: 'POST',
    token,
  }) as Promise<{ inviteCode: string; inviteCodeExpiresAt: string }>;
}

export async function getPairingDetail(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}`, { token }) as Promise<Pairing>;
}
