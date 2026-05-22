import { api } from './api';

export interface VoiceSample {
  id: number;
  label: string;
  phrase: string;
  status: 'completed' | 'active' | 'pending';
  duration?: string;
}

export interface VoiceCloneStatus {
  isCloned: boolean;
  samples: VoiceSample[];
}

export async function getVoiceCloneStatus(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/voice-clone`, { token }) as Promise<VoiceCloneStatus>;
}

export async function uploadVoiceSample(token: string, pairingId: string, sampleId: number, audioUri: string) {
  return api(`/api/pairings/${pairingId}/voice-clone/samples/${sampleId}`, {
    method: 'POST',
    token,
    body: JSON.stringify({ audioUri }),
  });
}

export async function resetVoiceClone(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/voice-clone/reset`, {
    method: 'POST',
    token,
  });
}
