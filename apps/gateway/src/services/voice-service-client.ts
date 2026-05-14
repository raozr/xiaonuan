import { env } from '../config/env.js';

const VOICE_SERVICE_URL = env.VOICE_SERVICE_URL;

interface TTSRequest {
  text: string;
  voice_id?: string;
}

interface TTSResponse {
  success: boolean;
  audioUrl: string;
}

interface ASRResponse {
  success: boolean;
  text?: string;
  message?: string;
}

interface CloneResponse {
  voiceId: string;
  status: string;
}

export async function synthesizeVoice(text: string, voiceId?: string): Promise<TTSResponse> {
  const res = await fetch(`${VOICE_SERVICE_URL}/tts/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: voiceId } as TTSRequest),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `TTS failed: ${res.status}`);
  }

  return res.json() as Promise<TTSResponse>;
}

export async function transcribeVoice(audioBuffer: Buffer, format: string, sampleRate: number): Promise<ASRResponse> {
  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: `audio/${format}` });
  form.append('audio', blob, `audio.${format}`);
  form.append('format', format);
  form.append('sample_rate', String(sampleRate));

  const res = await fetch(`${VOICE_SERVICE_URL}/asr/transcribe`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `ASR failed: ${res.status}`);
  }

  return res.json() as Promise<ASRResponse>;
}

export async function createClone(audioBuffers: { buffer: Buffer; filename: string }[], familyId: string): Promise<CloneResponse> {
  const form = new FormData();
  for (const item of audioBuffers) {
    const blob = new Blob([item.buffer]);
    form.append('samples', blob, item.filename);
  }
  form.append('family_id', familyId);

  const res = await fetch(`${VOICE_SERVICE_URL}/voice/clone`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `Clone creation failed: ${res.status}`);
  }

  return res.json() as Promise<CloneResponse>;
}

export async function getCloneStatus(voiceId: string): Promise<CloneResponse> {
  const res = await fetch(`${VOICE_SERVICE_URL}/voice/clone/${voiceId}`);

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `Get clone status failed: ${res.status}`);
  }

  return res.json() as Promise<CloneResponse>;
}

export async function deleteClone(voiceId: string): Promise<void> {
  const res = await fetch(`${VOICE_SERVICE_URL}/voice/clone/${voiceId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `Delete clone failed: ${res.status}`);
  }
}
