import { api } from './api';

export interface VoiceCloneResult {
  voiceId: string;
  status: string;
}

export async function createVoiceClone(
  token: string,
  pairingId: string,
  audioBase64: string,
  filename: string = 'sample.mp3'
) {
  return api<VoiceCloneResult>('/api/voice-clone/', {
    method: 'POST',
    token,
    body: JSON.stringify({
      pairingId,
      samples: [{ filename, base64: audioBase64 }],
    }),
  });
}

export async function getVoiceCloneList(token: string, pairingId: string) {
  return api<{
    data: Array<{ voiceId: string; status: string; createdAt: string }>;
    activeVoiceId: string;
  }>(`/api/voice-clone/pairing/${pairingId}`, { token });
}

export async function getVoiceCloneStatus(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/voice-clone/status`, { token });
}

export async function resetVoiceClone(token: string, pairingId: string) {
  return api(`/api/pairings/${pairingId}/voice-clone/reset`, {
    method: 'POST',
    token,
  });
}
