import { prisma } from '@xiaonuan/prisma';
import { synthesizeVoice } from './voice-service-client.js';
import { env } from '../config/env.js';

const DEFAULT_VOICE_MALE = 'longanyang';
const DEFAULT_VOICE_FEMALE = 'longanhuan';

export async function resolveVoiceId(pairingId: string): Promise<string> {
  // Check for active cloned voice in this pairing
  const activeVoice = await prisma.voiceClone.findFirst({
    where: { pairingId, status: 'READY' },
    select: { voiceId: true },
  });

  if (activeVoice) {
    return activeVoice.voiceId;
  }

  // Fall back to gender-based default from participant metadata
  const companionee = await prisma.participant.findFirst({
    where: { pairingId, role: 'COMPANIONEE', isAI: false },
    select: { metadata: true },
  });

  const gender = (companionee?.metadata as { gender?: string } | null)?.gender;
  if (gender === 'MALE') return DEFAULT_VOICE_MALE;
  if (gender === 'FEMALE') return DEFAULT_VOICE_FEMALE;

  return DEFAULT_VOICE_FEMALE;
}

export async function synthesizeForPairing(
  pairingId: string,
  text: string
): Promise<{ audioBuffer: Buffer; audioUrl: string }> {
  const voiceId = await resolveVoiceId(pairingId);
  const result = await synthesizeVoice(text, voiceId);

  const audioUrl = result.audioUrl.startsWith('http')
    ? result.audioUrl
    : `${env.VOICE_SERVICE_URL}${result.audioUrl}`;

  const res = await fetch(audioUrl);
  if (!res.ok) {
    throw new Error(`下载合成音频失败: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  return { audioBuffer, audioUrl: result.audioUrl };
}
