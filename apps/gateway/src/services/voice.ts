import { prisma } from '@xiaonuan/prisma';
import { synthesizeVoice } from './voice-service-client.js';

const DEFAULT_VOICE_MALE = 'longanyang';
const DEFAULT_VOICE_FEMALE = 'longanhuan';

export async function resolveVoiceId(familyId: string): Promise<string> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { clonedVoiceId: true, elder: { select: { gender: true } } },
  });

  if (family?.clonedVoiceId) {
    return family.clonedVoiceId;
  }

  const gender = family?.elder?.gender;
  if (gender === 'MALE') return DEFAULT_VOICE_MALE;
  if (gender === 'FEMALE') return DEFAULT_VOICE_FEMALE;

  return DEFAULT_VOICE_FEMALE;
}

export async function synthesizeForFamily(
  familyId: string,
  text: string
): Promise<{ audioBuffer: Buffer; audioUrl: string }> {
  const voiceId = await resolveVoiceId(familyId);
  const result = await synthesizeVoice(text, voiceId);

  const res = await fetch(result.audioUrl);
  if (!res.ok) {
    throw new Error(`下载合成音频失败: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  return { audioBuffer, audioUrl: result.audioUrl };
}
